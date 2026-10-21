import { describe, test, expect } from "bun:test";
import { createChord } from "../src/sdk/chord.js";
import { createRegistry, registerTask, registerExecutionResult, transitionArtifact } from "../src/registry/registry.js";
import { exportRegistry } from "../src/registry/snapshot.js";
import { enqueueTask } from "../src/platform/task-queue.js";
import { prepareAttemptRecord, activatePendingAttempt } from "../src/platform/attempts.js";
import { createIntentTaskPacket } from "../src/execution/task-packets.js";
import { SCHEMA_VERSION, Outcome } from "../src/contracts/sigils.js";
import {
  TASK_TRANSITIONS, QUEUE_TRANSITIONS, ARTIFACT_TRANSITIONS,
  canTaskTransition, assertTaskTransition,
  canQueueTransition, assertQueueTransition,
  canArtifactTransition, assertArtifactTransition,
  canDomainTransition, assertDomainTransition, transitionDomainState,
  markTaskUncertain
} from "../src/platform/transitions.js";
import { installHost, queueOptions, grantFor } from "./fixtures/host.js";

const intent = { schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] };

const bindingFor = (registry, packet) => ({
  principal_id: "host-principal",
  actor_id: "worker-actor",
  capability: "execute",
  scope: {
    run_id: registry.run.run_id,
    project: packet.project,
    phase: packet.phase,
    task_id: packet.task_id,
    target_entity: packet.target_entity,
    resource: { kind: "task", id: packet.task_id }
  },
  approval_required: false
});

function gate() {
  let release;
  const promise = new Promise(r => { release = r; });
  return { promise, release };
}

function dispatchLocal(registry, packet) {
  registerTask(registry, packet, bindingFor(registry, packet));
  enqueueTask(registry, packet);
  const task = registry.tasks[packet.task_id];
  const attempt = prepareAttemptRecord(registry, task);
  task.status = "running";
  registry.task_queue[0].status = "leased";
  registry.run.revision += 1;
  activatePendingAttempt(registry, packet.task_id, registry.run.revision);
  return { task, attempt, queueEntry: registry.task_queue[0] };
}

function outcomeFor(registry, task, attempt, extra = {}) {
  return {
    task_id: task.task_id,
    status: "completed",
    outcome: "succeeded",
    run_id: registry.run.run_id,
    schema_version: registry.run.schema_version,
    task_revision: 0,
    queue_id: attempt.queue_id,
    attempt_id: attempt.attempt_id,
    ...extra
  };
}

describe("transition graphs", () => {
  const taskStatuses = Object.keys(TASK_TRANSITIONS);
  test("task graph: every allowed edge commits, every forbidden edge rejects", () => {
    for (const current of taskStatuses) {
      for (const next of taskStatuses) {
        const allowed = TASK_TRANSITIONS[current].includes(next);
        expect(canTaskTransition(current, next)).toBe(allowed);
        if (allowed) expect(() => assertTaskTransition(current, next)).not.toThrow();
        else expect(() => assertTaskTransition(current, next)).toThrow(/INVALID_TRANSITION/);
      }
    }
  });

  test("task graph: terminal states and reconciliation-only exits", () => {
    for (const terminal of ["completed", "failed", "cancelled"]) {
      expect(TASK_TRANSITIONS[terminal]).toEqual([]);
      for (const next of taskStatuses) expect(canTaskTransition(terminal, next)).toBe(false);
    }
    expect(canTaskTransition("uncertain", "running")).toBe(false);
    expect(canTaskTransition("uncertain", "queued")).toBe(true);
    expect(canTaskTransition("dead_letter", "running")).toBe(false);
    expect(canTaskTransition("dead_letter", "queued")).toBe(true);
    expect(canTaskTransition("blocked", "running")).toBe(false);
    expect(canTaskTransition("blocked", "queued")).toBe(true);
  });

  test("queue graph: every allowed edge commits, every forbidden edge rejects", () => {
    for (const current of Object.keys(QUEUE_TRANSITIONS)) {
      for (const next of Object.keys(QUEUE_TRANSITIONS)) {
        const allowed = QUEUE_TRANSITIONS[current].includes(next);
        expect(canQueueTransition(current, next)).toBe(allowed);
        if (allowed) expect(() => assertQueueTransition(current, next)).not.toThrow();
        else expect(() => assertQueueTransition(current, next)).toThrow(/INVALID_TRANSITION/);
      }
    }
    expect(QUEUE_TRANSITIONS.completed).toEqual([]);
    expect(QUEUE_TRANSITIONS.cancelled).toEqual([]);
  });

  test("artifact graph: prefix edges to terminal states only", () => {
    expect(canArtifactTransition("declared", "produced")).toBe(true);
    expect(canArtifactTransition("declared", "accepted")).toBe(true);
    expect(canArtifactTransition("produced", "accepted")).toBe(true);
    expect(canArtifactTransition("produced", "superseded")).toBe(true);
    for (const terminal of ["accepted", "rejected", "superseded"]) {
      for (const next of Object.keys(ARTIFACT_TRANSITIONS)) {
        if (next !== terminal) expect(canArtifactTransition(terminal, next)).toBe(false);
      }
      expect(() => assertArtifactTransition(terminal, "declared")).toThrow(/INVALID_TRANSITION/);
    }
    const record = { name: "a", status: "declared", history: [] };
    transitionArtifact(record, "produced");
    expect(record.status).toBe("produced");
    expect(record.history).toEqual([{ from: "declared", to: "produced", at: expect.any(Number) }]);
    expect(() => transitionArtifact(record, "declared")).toThrow(/INVALID_TRANSITION/);
  });

  test("domain guard: result-derived transitions only, complete terminal", () => {
    expect(canDomainTransition("pending", "complete")).toBe(true);
    expect(canDomainTransition("ready", "blocked")).toBe(true);
    expect(canDomainTransition("blocked", "complete")).toBe(true);
    expect(canDomainTransition("complete", "complete")).toBe(true);
    expect(canDomainTransition("complete", "blocked")).toBe(false);
    expect(canDomainTransition("complete", "pending")).toBe(false);
    expect(canDomainTransition("pending", "ready")).toBe(false);
    expect(() => assertDomainTransition("complete", "blocked")).toThrow(/INVALID_TRANSITION/);
    const record = { name: "d", state: "ready", state_history: [] };
    transitionDomainState(record, "complete");
    expect(record.state).toBe("complete");
    expect(record.state_history).toEqual([{ to: "complete", at: expect.any(Number) }]);
    expect(() => transitionDomainState(record, "blocked")).toThrow(/INVALID_TRANSITION/);
  });

  test("markTaskUncertain clears attempts, bumps revision, skips terminal states", () => {
    const registry = createRegistry();
    const packet = createIntentTaskPacket(intent);
    const { task } = dispatchLocal(registry, packet);
    const revisionBefore = registry.run.revision;
    const marked = markTaskUncertain(registry, packet.task_id, { reason: "ADAPTER_ERROR" });
    expect(marked.marked).toBe(true);
    expect(task.status).toBe("uncertain");
    expect(registry.task_queue[0].status).toBe("uncertain");
    expect(registry.active_attempts[packet.task_id]).toBeUndefined();
    expect(registry.pending_attempts[packet.task_id]).toBeUndefined();
    expect(registry.run.revision).toBe(revisionBefore + 1);
    // Terminal state wins: no mutation, journaled as ignored.
    task.status = "cancelled";
    const revisionAfter = registry.run.revision;
    const skipped = markTaskUncertain(registry, packet.task_id, { reason: "ADAPTER_ERROR" });
    expect(skipped.marked).toBe(false);
    expect(task.status).toBe("cancelled");
    expect(registry.run.revision).toBe(revisionAfter);
    // Unsanitized reasons never reach the journal raw.
    const dirty = markTaskUncertain(registry, packet.task_id, { reason: "provider-secret" });
    expect(dirty.code).toBe("UNKNOWN");
  });
});

describe("guarded runtime: ambiguity and commit guards", () => {
  test("adapter throw after dispatch marks uncertain, never retries or dead-letters", async () => {
    const chord = createChord({ runtimePolicy: { retry: { strategy: "fixed", baseDelayMs: 0, maxAttempts: 1 } } });
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => { throw new Error("boom"); } } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];

    const result = await chord.runCycle();
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(chord.registry.tasks[taskId].status).toBe("uncertain");
    expect(chord.queryQueue({ status: "uncertain" }).length).toBe(1);
    expect(chord.queryDeadLetters().length).toBe(0);
    expect(chord.queryQueue({ status: "queued" }).length).toBe(0);
    expect(chord.registry.execution_results.length).toBe(0);
    expect(chord.registry.active_attempts[taskId]).toBeUndefined();

    // Uncertain tasks are not selectable for execution.
    const idle = await chord.runCycle();
    expect(idle.skipped).toBe(true);
  });

  test("invalid adapter result marks uncertain without committing anything", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => undefined } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];
    const result = await chord.runCycle();
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(chord.registry.tasks[taskId].status).toBe("uncertain");
    expect(chord.registry.tasks[taskId].last_result).toBeUndefined();
    expect(chord.registry.execution_results.length).toBe(0);
  });

  test("intervening revision bump during await makes the commit stale", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: async () => {
      // Consumer registry views are detached; exercise a real host CAS instead.
      const next = chord.getRegistry(); next.run.revision += 1;
      expect(chord.commitRun({ expectedRevision: chord.getRunRevision(), nextRegistry: next }).ok).toBe(true);
      return { status: "completed", outcome: "succeeded" };
    } } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];
    const result = await chord.runCycle();
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(result.code).toBe("STALE_REVISION");
    expect(chord.registry.tasks[taskId].status).toBe("uncertain");
    expect(chord.registry.execution_results.length).toBe(0);
  });

  test("authority replacement during await invalidates the in-flight attempt", async () => {
    const chord = createChord();
    const host = installHost(chord);
    const g = gate();
    chord.setAdapterRouter({ fallback: { execute: () => g.promise.then(() => ({ status: "completed", outcome: "succeeded" })) } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];
    const cycle = chord.runCycle();
    // Host rotates the authority snapshot while the adapter is in flight.
    const snapshot = chord.getAuthority();
    snapshot.authority_revision += 1;
    chord.setAuthoritySnapshot(snapshot);
    g.release();
    const result = await cycle;
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(chord.registry.tasks[taskId].status).toBe("uncertain");
    expect(chord.registry.execution_results.length).toBe(0);
  });

  test("expired lease at commit marks uncertain", async () => {
    let now = 1000;
    const chord = createChord({ trustedHost: { now: () => now } });
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: async () => {
      now += 30_001; // trusted clock advances beyond the actual lease
      return { status: "completed", outcome: "succeeded" };
    } } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];
    const result = await chord.runCycle();
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(result.code).toBe("STALE_ATTEMPT");
    expect(chord.registry.tasks[taskId].status).toBe("uncertain");
  });

  test("successful run commits a correlated outcome and keeps export valid", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded", outputs: { ok: 1 } }) } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];
    const result = await chord.runCycle();
    expect(result.ok).toBe(true);
    const stored = chord.registry.tasks[taskId];
    expect(stored.status).toBe("completed");
    expect(Outcome.check(stored.last_result)).toBe(true);
    expect(stored.last_result.run_id).toBe(chord.registry.run.run_id);
    expect(stored.last_result.attempt_id).toBe(result.attempt_id);
    expect(chord.registry.task_queue[0].status).toBe("completed");
    expect(chord.registry.pending_attempts).toEqual({});
    expect(chord.registry.active_attempts).toEqual({});
    // Regression: export threw INVALID_SEMANTICS when attempts outlived dispatch.
    const snapshot = chord.exportRegistry();
    expect(snapshot.registry.tasks[taskId].status).toBe("completed");
  });

  test("blocked adapter result transitions to blocked and is not dead-lettered", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "blocked", outcome: "blocked" }) } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = Object.keys(chord.registry.tasks)[0];
    const result = await chord.runCycle();
    expect(result.ok).toBe(true);
    expect(chord.registry.tasks[taskId].status).toBe("blocked");
    expect(chord.registry.task_queue[0].status).toBe("blocked");
    expect(chord.queryDeadLetters().length).toBe(0);
  });

  test("direct ingestion on a non-running task is rejected", () => {
    const registry = createRegistry();
    const packet = createIntentTaskPacket(intent);
    registerTask(registry, packet, bindingFor(registry, packet));
    enqueueTask(registry, packet);
    const task = registry.tasks[packet.task_id];
    const attempt = prepareAttemptRecord(registry, task);
    const outcome = outcomeFor(registry, task, attempt);
    // Task still queued: no active attempt, no running source.
    expect(() => registerExecutionResult(registry, outcome)).toThrow(/INVALID_RESULT/);
    // Running but with a foreign attempt identifier: stale correlation.
    task.status = "running";
    registry.task_queue[0].status = "leased";
    registry.run.revision += 1;
    activatePendingAttempt(registry, packet.task_id, registry.run.revision);
    expect(() => registerExecutionResult(registry, { ...outcome, attempt_id: "attempt_other" })).toThrow(/INVALID_RESULT/);
    expect(() => registerExecutionResult(registry, { ...outcome, run_id: "run_other" })).toThrow(/INVALID_RESULT/);
  });
});

describe("host reconciliation: cancel, replay, re-evaluation", () => {
  test("cancelTask wins over an in-flight success and drops the late result", async () => {
    const chord = createChord();
    const host = installHost(chord);
    const g = gate();
    chord.setAdapterRouter({ fallback: { execute: () => g.promise.then(() => ({ status: "completed", outcome: "succeeded" })) } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = packets[0].task_id;
    const cycle = chord.runCycle(); // dispatch happens synchronously up to the adapter await
    expect(chord.registry.tasks[taskId].status).toBe("running");
    chord.cancelTask(taskId);
    expect(chord.registry.tasks[taskId].status).toBe("cancelled");
    expect(chord.registry.task_queue[0].status).toBe("cancelled");
    expect(chord.registry.active_attempts[taskId]).toBeUndefined();
    g.release();
    const result = await cycle;
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TASK_CANCELLED");
    expect(chord.registry.tasks[taskId].status).toBe("cancelled");
    expect(chord.registry.execution_results.length).toBe(0);
  });

  test("cancelTask rejects terminal states, dead letters, and stale revisions", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded" }) } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = packets[0].task_id;
    await chord.runCycle();
    expect(() => chord.cancelTask(taskId)).toThrow(/INVALID_TRANSITION/);
    expect(() => chord.cancelTask("missing_task")).toThrow(/INVALID_DATA/);
    // Queued task with a stale expected revision.
    const { packets: [second] } = chord.registerSpecAndQueue({ ...intent, do: ["b"] }, queueOptions(host));
    expect(() => chord.cancelTask(second.task_id, { expectedRevision: 999999 })).toThrow(/STALE_REVISION/);
    expect(chord.registry.tasks[second.task_id].status).toBe("queued");
  });

  test("uncertain task reconciles only through fresh-admission replay", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => { throw new Error("boom"); } } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = packets[0].task_id;
    await chord.runCycle();
    expect(chord.registry.tasks[taskId].status).toBe("uncertain");
    // Permission alone is not evidence that the effect did not occur.
    expect(() => chord.replayTask(taskId)).toThrow(/RECONCILIATION_REQUIRED/);
    chord.reconcileTask({ task_id: taskId, principal_id: host.human_id, decision: "confirmed_not_executed", evidence: { kind: "no_effect_confirmation", reference: "mock-receipt-not-dispatched" }, expectedRevision: chord.getRunRevision() });
    chord.replayTask(taskId);
    expect(chord.registry.tasks[taskId].status).toBe("queued");
    expect(chord.registry.task_queue[0].status).toBe("queued");
    expect(chord.registry.task_queue[0].retry_count).toBe(0);
    // A working adapter now completes it.
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded" }) } });
    const result = await chord.runCycle();
    expect(result.ok).toBe(true);
    expect(chord.registry.tasks[taskId].status).toBe("completed");
  });

  test("replay denial after revocation leaves the task untouched", async () => {
    const chord = createChord({ runtimePolicy: { retry: { strategy: "fixed", baseDelayMs: 0, maxAttempts: 1 } } });
    const host = installHost(chord);
    const { packets } = chord.registerSpecAndQueue(
      { ...intent, target_entity: "missing-adapter" },
      queueOptions(host)
    );
    const taskId = packets[0].task_id;
    await chord.runCycle(); // no adapter -> dead_letter
    expect(chord.registry.tasks[taskId].status).toBe("dead_letter");
    // Revoke every grant through a fresh authority snapshot.
    const snapshot = chord.getAuthority();
    snapshot.authority_revision += 1;
    for (const grant of snapshot.grants) grant.revoked_at = 0;
    chord.setAuthoritySnapshot(snapshot);
    expect(() => chord.replayTask(taskId)).toThrow(/NO_ALLOW_GRANT/);
    expect(chord.registry.tasks[taskId].status).toBe("dead_letter");
    expect(chord.registry.task_queue[0].status).toBe("dead_letter");
  });

  test("replayTask requires a replayable state", async () => {
    const chord = createChord();
    const host = installHost(chord);
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = packets[0].task_id;
    expect(() => chord.replayTask(taskId)).toThrow(/INVALID_TRANSITION/); // still queued
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded" }) } });
    await chord.runCycle();
    expect(() => chord.replayTask(taskId)).toThrow(/INVALID_TRANSITION/); // terminal
  });

  test("blocked task exits only through explicit re-evaluation", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "blocked", outcome: "blocked" }) } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const taskId = packets[0].task_id;
    await chord.runCycle();
    expect(chord.registry.tasks[taskId].status).toBe("blocked");
    // Not selectable while blocked.
    expect((await chord.runCycle()).skipped).toBe(true);
    // Blocked is an adapter outcome, not proof that an effect never occurred.
    expect(() => chord.replayTask(taskId)).toThrow(/RECONCILIATION_REQUIRED/);
    chord.reconcileTask({ task_id: taskId, principal_id: host.human_id, decision: "confirmed_not_executed", evidence: { kind: "no_effect_confirmation", reference: "mock-blocked-no-effect" }, expectedRevision: chord.getRunRevision() });
    chord.replayTask(taskId);
    expect(chord.registry.tasks[taskId].status).toBe("queued");
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded" }) } });
    expect((await chord.runCycle()).ok).toBe(true);
  });
});

describe("artifact and domain derivation", () => {
  test("spec registration declares artifacts but never changes their status", () => {
    const chord = createChord();
    chord.registerSpec({
      schema_version: SCHEMA_VERSION, spec_type: "HandoffSpec", project: "p", phase: "q",
      artifact: "doc1", from: "producer", to: ["reviewer"], requested_action: ["review"], status: "accepted"
    });
    expect(chord.registry.artifacts["doc1"].status).toBe("declared");
    expect(chord.registry.artifacts["doc1"].producers).toEqual(["producer"]);
    expect(chord.registry.artifacts["doc1"].consumers).toEqual(["reviewer"]);
  });

  test("committed result derives artifact acceptance; terminal edge rejects", async () => {
    const chord = createChord();
    const host = installHost(chord);
    const handoff = {
      schema_version: SCHEMA_VERSION, spec_type: "HandoffSpec", project: "p", phase: "q",
      artifact: "doc1", from: "producer", to: ["reviewer"], requested_action: ["review"]
    };
    chord.registerSpec(handoff);
    const packets = chord.createTaskPackets(handoff);
    chord.queueTaskPackets(packets, queueOptions(host));
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded", artifact: "doc1" }) } });
    const result = await chord.runCycle();
    expect(result.ok).toBe(true);
    expect(chord.registry.artifacts["doc1"].status).toBe("accepted");
    expect(() => transitionArtifact(chord.registry.artifacts["doc1"], "superseded")).toThrow(/INVALID_TRANSITION/);
  });

  test("committed result derives domain completion; complete is terminal", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.registerSpec({
      schema_version: SCHEMA_VERSION, spec_type: "CoordSpec", project: "p", phase: "q",
      state: { system: "ready" }, authority: { system: "owner" }
    });
    expect(chord.registry.domains["system"].state).toBe("ready");
    chord.registerSpecAndQueue(intent, queueOptions(host));
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded", domain: "system" }) } });
    const result = await chord.runCycle();
    expect(result.ok).toBe(true);
    expect(chord.registry.domains["system"].state).toBe("complete");
    expect(() => transitionDomainState(chord.registry.domains["system"], "blocked")).toThrow(/INVALID_TRANSITION/);
  });

  test("rejected outcome rejects a declared artifact through the commit path", async () => {
    const chord = createChord();
    const host = installHost(chord);
    const handoff = {
      schema_version: SCHEMA_VERSION, spec_type: "HandoffSpec", project: "p", phase: "q",
      artifact: "doc2", from: "producer", to: ["reviewer"], requested_action: ["review"]
    };
    chord.registerSpec(handoff);
    chord.queueTaskPackets(chord.createTaskPackets(handoff), queueOptions(host));
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "failed", outcome: "failed", artifact: "doc2" }) } });
    const result = await chord.runCycle();
    expect(result.ok).toBe(true);
    expect(chord.registry.tasks[Object.keys(chord.registry.tasks)[0]].status).toBe("failed");
    expect(chord.registry.artifacts["doc2"].status).toBe("rejected");
  });
});

describe("lease caps", () => {
  test("per-entity and global lease caps defer dispatch before any effect", async () => {
    const chord = createChord({ runtimePolicy: { globalMaxLeased: 1, perEntityMaxLeased: 1, retry: { strategy: "fixed", baseDelayMs: 0, maxAttempts: 3 } } });
    const host = installHost(chord);
    const g = gate();
    let calls = 0;
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return g.promise.then(() => ({ status: "completed", outcome: "succeeded" })); } } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    chord.registerSpecAndQueue({ ...intent, do: ["b"] }, queueOptions(host));

    const cycleOne = chord.runCycle(); // dispatches one task, holds at the adapter
    // Dispatch order breaks ties by queue_id, not registration order.
    const runningId = Object.keys(chord.registry.tasks).find(id => chord.registry.tasks[id].status === "running");
    const heldId = Object.keys(chord.registry.tasks).find(id => id !== runningId);
    expect(chord.registry.tasks[heldId].status).toBe("queued");

    const cycleTwo = await chord.runCycle(); // second task: lease cap reached
    expect(cycleTwo.deferred).toBe(true);
    expect(calls).toBe(1);
    expect(chord.registry.tasks[heldId].status).toBe("queued");

    g.release();
    await cycleOne;
    expect(chord.registry.tasks[runningId].status).toBe("completed");
    // The cap frees with the completed attempt.
    const cycleThree = await chord.runCycle();
    expect(cycleThree.ok).toBe(true);
    expect(calls).toBe(2);
    expect(chord.registry.tasks[heldId].status).toBe("completed");
  });
});
