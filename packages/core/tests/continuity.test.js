import { describe, test, expect } from "bun:test";
import { createChord } from "../src/sdk/chord.js";
import { SCHEMA_VERSION } from "../src/contracts/sigils.js";
import { installHost, queueOptions } from "./fixtures/host.js";

const intent = { schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["x"] };

describe("Block 3 continuity: concurrency and interruption", () => {
  test("stale expectedRevision rejected on cancelRun", () => {
    const chord = createChord();
    const host = installHost(chord);
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    expect(() => chord.cancelRun({ expectedRevision: 999999 })).toThrow(/STALE_REVISION/);
    expect(chord.getRunState()).toBe("created");
  });

  test("pause/resume/cancel flow with CAS", () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.registerSpecAndQueue(intent, queueOptions(host));
    expect(chord.getRunState()).toBe("created");
    const r1 = chord.pauseForApproval({ correlation_id: "c1" });
    expect(r1.run_state).toBe("paused");
    expect(chord.getRunRevision()).toBeGreaterThan(0);
    expect(() => chord.runCycle()).not.toThrow();
    expect(() => chord.pauseForApproval()).toThrow(/INVALID_TRANSITION/);
    chord.resumeRun({ correlation_id: "c2", principal_id: host.human_id });
    expect(chord.getRunState()).toBe("active");
    chord.cancelRun({ reason: "test" });
    expect(chord.getRunState()).toBe("cancelled");
    expect(() => chord.resumeRun()).toThrow(/INVALID_TRANSITION/);
  });

  test("cancelRun cancels tasks and clears attempts", async () => {
    const chord = createChord();
    const host = installHost(chord);
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    chord.cancelRun();
    expect(chord.getRunState()).toBe("cancelled");
    expect(chord.registry.tasks[packets[0].task_id].status).toBe("cancelled");
    expect(chord.registry.task_queue[0].status).toBe("cancelled");
  });

  test("approval rejection fails run", () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.registerSpecAndQueue(intent, queueOptions(host));
    chord.pauseForApproval();
    chord.rejectApproval({ reason: "denied" });
    expect(chord.getRunState()).toBe("failed");
  });

  test("context projection filters and has provenance", () => {
    const chord = createChord();
    const host = installHost(chord);
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const proj = chord.projectContext({ actor_id: host.actor_id, principal_id: host.principal_id });
    expect(proj.run_id).toBe(chord.registry.run.run_id);
    expect(proj.projection_version).toBe("1.0");
    expect(proj.provenance.authority_revision).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(proj.tasks)).toBe(true);
    expect(proj.tasks.length).toBe(1);
  });

  test("handoff proposal/accept with CAS and causation/correlation", () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const p = chord.proposeHandoff({ from_actor_id: "a1", to_actor_id: "a2", correlation_id: "corr-1", causation_id: "cause-1", expectedRevision: chord.getRunRevision() });
    expect(p.status).toBe("proposed");
    expect(p.correlation_id).toBe("corr-1");
    expect(() => chord.proposeHandoff({ from_actor_id: "a1", to_actor_id: "a2", expectedRevision: 999 })).toThrow(/STALE_REVISION/);
    const r = chord.respondToHandoff({ handoff_id: p.handoff_id, actor_id: "a2", action: "accept", correlation_id: "corr-1", expectedRevision: chord.getRunRevision() });
    expect(r.status).toBe("accepted");
  });

  test("handoff reject and wrong actor", () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const p = chord.proposeHandoff({ from_actor_id: "a1", to_actor_id: "a2", expectedRevision: chord.getRunRevision() });
    expect(() => chord.respondToHandoff({ handoff_id: p.handoff_id, actor_id: "a3", action: "accept", expectedRevision: chord.getRunRevision() })).toThrow(/FORBIDDEN/);
    const p2 = chord.proposeHandoff({ from_actor_id: "a1", to_actor_id: "a2", expectedRevision: chord.getRunRevision() });
    chord.respondToHandoff({ handoff_id: p2.handoff_id, actor_id: "a2", action: "reject", expectedRevision: chord.getRunRevision() });
    expect(() => chord.respondToHandoff({ handoff_id: p2.handoff_id, actor_id: "a2", action: "accept", expectedRevision: chord.getRunRevision() })).toThrow(/INVALID_TRANSITION/);
  });
});
