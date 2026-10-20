import { createChord } from "../src/sdk/chord.js";
import { expect, test, describe } from "bun:test";
import { dequeueReadyTask } from "../src/platform/task-queue.js";
import { createIntentTaskPacket } from "../src/execution/task-packets.js";
import { installHost, queueOptions } from "./fixtures/host.js";

describe("Chord Core Hardening", () => {
  const chord = createChord();

  test("TARGET 1 & 3: CoordSpec Parsing & Normalization", () => {
    const text = `
@project Hardening
@phase hardening
@state
- system:ready
@authority
- owner:human
@entity user:admin
`;
    const { spec } = chord.parseText(text);

    // Normalization: present fields parsed; absent optional arrays are not fabricated.
    expect(spec.project).toBe("Hardening");
    expect(spec.phase).toBe("hardening");
    expect(spec.entity).toEqual(["user:admin"]);
    expect(spec.do).toBeUndefined();

    // Map parsing
    expect(spec.state).toEqual({ "system": "ready" });
    expect(spec.authority).toEqual({ "owner": "human" });

    // Spec type
    expect(spec.spec_type).toBe("CoordSpec");

    // Invalid map entries reject with the fixed contract error code.
    const invalidText = `@project p\n@phase q\n@state\n- invalid-line`;
    expect(() => chord.parseText(invalidText)).toThrow(/INVALID_SHAPE/);
  });

  test("TARGET 2: Dead-Letter Consistency", async () => {
    const chordFail = createChord({
      runtimePolicy: { retry: { strategy: "fixed", baseDelayMs: 0, maxAttempts: 1 } }
    });
    const host = installHost(chordFail);

    chordFail.setAdapterRouter({ fallback: { execute: () => { throw new Error("fail"); } } });

    const { spec } = chordFail.parseText(`@project hardening\n@phase hardening\n@do\n- fail task`);
    chordFail.registerSpecAndQueue(spec, queueOptions(host));

    await chordFail.runCycle();

    const deadLetters = chordFail.queryDeadLetters();
    expect(deadLetters.length).toBe(1);
    expect(deadLetters[0].status).toBe("dead_letter");

    // Check registry.tasks sync
    const taskId = deadLetters[0].task_id;
    expect(chordFail.registry.tasks[taskId].status).toBe("dead_letter");

    // Replay
    chordFail.replayTask(taskId);
    expect(chordFail.queryQueue({ status: "queued" }).length).toBe(1);
    expect(chordFail.registry.tasks[taskId].status).toBe("queued");
  });

  test("TARGET 4: Contract Enforcement", () => {
    // Malformed packets reject with fixed contract codes and never partially register.
    expect(() => chord.queueTaskPackets([{ task_id: "1" }])).toThrow(/INVALID_SHAPE/);
    expect(() => chord.queueTaskPackets([{ task_id: "1", requested_action: ["do"], target_entity: 123 }])).toThrow(/INVALID_SHAPE/);
    expect(chord.registry.tasks["1"]).toBeUndefined();

    // Structurally valid packets without trusted-host authority arguments are denied.
    const valid = createIntentTaskPacket({ schema_version: "chord.contracts.v1", spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"], target_entity: "e" });
    expect(() => chord.queueTaskPackets([valid])).toThrow(/INVALID_CONTEXT/);
    expect(chord.registry.tasks[valid.task_id]).toBeUndefined();
  });

  test("TARGET 5: Deterministic Dequeue", () => {
    const chordDet = createChord();
    const host = installHost(chordDet);
    const p1 = createIntentTaskPacket({ schema_version: "chord.contracts.v1", spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"], target_entity: "e" });
    const p2 = createIntentTaskPacket({ schema_version: "chord.contracts.v1", spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"], target_entity: "e" });

    chordDet.queueTaskPackets([p1], queueOptions(host, { priority: 0 }));
    chordDet.queueTaskPackets([p2], queueOptions(host, { priority: 10 }));

    // p2 has higher priority, should be first
    const entry = dequeueReadyTask(chordDet.registry);
    expect(entry.task_id).toBe(p2.task_id);
  });
});
