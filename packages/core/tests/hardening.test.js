import { createChord } from "../src/sdk/chord.js";
import { expect, test, describe } from "bun:test";
import { dequeueReadyTask } from "../src/platform/task-queue.js";

describe("Chord Core Hardening", () => {
  const chord = createChord();

  test("TARGET 1 & 3: CoordSpec Parsing & Normalization", () => {
    const text = `
@project Hardening
@state
- system:ready
@authority
- owner:human
@entity user:admin
`;
    const { spec } = chord.parseText(text);
    
    // Normalization
    expect(spec.project).toBe("Hardening");
    expect(spec.entity).toEqual(["user:admin"]);
    expect(spec.do).toEqual([]);
    
    // Map parsing
    expect(spec.state).toEqual({ "system": "ready" });
    expect(spec.authority).toEqual({ "owner": "human" });

    // Spec type
    expect(spec.spec_type).toBe("CoordSpec");

    // Invalid map
    const invalidText = `@state\ninvalid-line`;
    expect(() => chord.parseText(invalidText)).toThrow(/Malformed map entry/);
  });

  test("TARGET 2: Dead-Letter Consistency", async () => {
    const chordFail = createChord({
      runtimePolicy: { retry: { strategy: "fixed", baseDelayMs: 0, maxAttempts: 1 } }
    });
    
    chordFail.setAdapterRouter({ fallback: { execute: () => { throw new Error("fail"); } } });
    
    const { spec } = chordFail.parseText(`@do\n- fail task`);
    chordFail.registerSpecAndQueue(spec);
    
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
    // Missing required fields
    expect(() => chord.queueTaskPackets([{ task_id: "1" }])).toThrow(/requested_action is required/);
    expect(() => chord.queueTaskPackets([{ task_id: "1", requested_action: ["do"], target_entity: 123 }])).toThrow(/target_entity is required and must be string/);
  });

  test("TARGET 5: Deterministic Dequeue", () => {
    const chordDet = createChord();
    const p1 = { task_id: "t1", requested_action: ["a"], target_entity: "e" };
    const p2 = { task_id: "t2", requested_action: ["a"], target_entity: "e" };
    
    chordDet.queueTaskPackets([p1], { priority: 0 });
    chordDet.queueTaskPackets([p2], { priority: 10 });
    
    const queue = chordDet.registry.task_queue;
    // p2 has higher priority, should be first
    const entry = dequeueReadyTask(chordDet.registry);
    expect(entry.task_id).toBe("t2");
  });
});
