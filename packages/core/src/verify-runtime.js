import { createChord } from "./sdk/chord.js";

async function runValidation() {
  console.log("🚀 Starting Chord Core Runtime Validation (Revised)...\n");

  // Trusted-host seam: the embedding host owns the clock and authority.
  const chord = createChord({
    trustedHost: { now: () => Date.now() },
    runtimePolicy: {
      retry: { 
        strategy: "fixed",
        baseDelayMs: 10,
        maxAttempts: 2 
      }
    }
  });

  const principal = { principal_id: "host-principal", issuer: "verify-host", kind: "service", authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  const actor = { actor_id: "worker-actor", principal_id: "host-principal", kind: "service", roles: [], capabilities: ["execute"], revoked_at: null };
  chord.setAuthoritySnapshot({
    schema_version: "chord.contracts.v1",
    run_id: chord.registry.run.run_id,
    authority_revision: 0,
    principals: [principal, { principal_id: "verify-human", issuer: "verify-host", kind: "human", authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER }],
    actors: [actor],
    grants: [],
    approvals: []
  });
  const hostOptions = packets => ({
    principal_id: principal.principal_id,
    actor_id: actor.actor_id,
    capability: "execute",
    issueGrants: ps => ps.map(p => ({
      grant_id: `grant_${p.task_id}`,
      principal_id: principal.principal_id,
      actor_id: actor.actor_id,
      capability: "execute",
      effect: "allow",
      scope: {
        run_id: chord.registry.run.run_id,
        project: p.project,
        phase: p.phase,
        task_id: p.task_id,
        target_entity: p.target_entity,
        resource: { kind: "task", id: p.task_id }
      },
      issued_at: 0,
      expires_at: Number.MAX_SAFE_INTEGER,
      revoked_at: null,
      requires_approval: false
    }))
  });

  // 1. SDK: parseText (IntentSpec)
  console.log("--- 1. SDK: parseText ---");
  const text = `
@project ValidationProject
@phase v0.1
@do
- first task
- second task
`;
  const { spec } = chord.parseText(text);
  console.log("Parsed Spec Type:", spec.spec_type);
  if (spec.spec_type !== "IntentSpec") {
    throw new Error("Expected IntentSpec");
  }
  console.log("✅ parseText ok\n");

  // 2. REGISTRY: registerSpec
  console.log("--- 2. Registry: registerSpec ---");
  chord.registerSpec(spec);
  if (chord.registry.specs.length !== 1) {
    throw new Error("registerSpec failed: spec not in registry");
  }
  console.log("✅ registerSpec ok\n");

  // 3. EXECUTION: createTaskPackets
  console.log("--- 3. Execution: createTaskPackets ---");
  const packets = chord.createTaskPackets(spec);
  console.log("Packets generated:", packets.length);
  if (packets.length === 0) {
    throw new Error("No packets generated for IntentSpec");
  }
  chord.queueTaskPackets(packets, hostOptions(packets));
  console.log("✅ createTaskPackets + admitted queue ok\n");

  // 4. QUEUE VALIDATION
  console.log("--- 4. Queue Validation ---");
  const queued = chord.queryQueue({ status: "queued" });
  console.log("Queued tasks:", queued.length);
  if (queued.length === 0) throw new Error("Task not in queue");
  console.log("✅ Queue entries found\n");

  // 5. RUNTIME LOOP: runCycle (Success)
  console.log("--- 5. Runtime Loop (Success Case) ---");
  chord.setAdapterRouter({
    fallback: {
      execute: async (packet) => ({
        task_id: packet.task_id,
        status: "completed",
        outcome: "succeeded",
        outputs: { done: true }
      })
    }
  });
  await chord.runCycle();
  const completed = chord.queryQueue({ status: "completed" });
  console.log("Completed tasks:", completed.length);
  if (completed.length === 0) throw new Error("Task did not complete");
  console.log("✅ runCycle success ok\n");

  // 6. POST-DISPATCH AMBIGUITY (design §5 step 6: uncertain, no blind retry)
  console.log("--- 6. Post-Dispatch Ambiguity ---");
  const failSpec = chord.parseText(`
@project FailProject
@phase v0.1
@do
- failing task
`).spec;
  chord.registerSpecAndQueue(failSpec, hostOptions([]));

  chord.setAdapterRouter({
    fallback: {
      execute: async (packet) => {
        throw new Error("Injected Failure");
      }
    }
  });

  const ambiguous = await chord.runCycle();
  console.log("Ambiguous cycle:", { ok: ambiguous.ok, uncertain: ambiguous.uncertain, error: ambiguous.error });
  if (ambiguous.ok !== false || ambiguous.uncertain !== true) {
    throw new Error("Post-dispatch adapter failure must mark the attempt uncertain");
  }
  const uncertainTasks = chord.queryQueue({ status: "uncertain" });
  console.log("Uncertain tasks:", uncertainTasks.length);
  if (uncertainTasks.length === 0) throw new Error("Task should be uncertain for host reconciliation");
  if (chord.queryDeadLetters().length !== 0) {
    throw new Error("Post-dispatch failure must never dead-letter or blind-retry");
  }
  if (chord.registry.tasks[uncertainTasks[0].task_id].last_result !== undefined) {
    throw new Error("Uncertain tasks must not record a result");
  }
  console.log("✅ Post-dispatch ambiguity -> uncertain ok\n");

  // 6b. PRE-DISPATCH DEAD-LETTER (bounded retry on routing failure)
  console.log("--- 6b. Pre-Dispatch Dead Letter ---");
  // Empty router: the target entity has no adapter at all.
  chord.setAdapterRouter({});
  const deadSpec = chord.parseText(`
@project DeadProject
@phase v0.1
@target_entity missing-adapter
@do
- unreachable task
`).spec;
  chord.registerSpecAndQueue(deadSpec, hostOptions([]));

  // Cycle 1: no adapter -> retry_count 1, requeued with backoff.
  await chord.runCycle();
  await new Promise(r => setTimeout(r, 50));
  // Cycle 2: no adapter -> retry_count 2 -> dead_letter.
  await chord.runCycle();

  const deadLetter = chord.queryQueue({ status: "dead_letter" });
  console.log("Dead letters (from queue):", deadLetter.length);
  if (deadLetter.length === 0) {
    throw new Error("Task should be in dead_letter queue");
  }
  console.log("✅ Pre-dispatch exhaustion -> dead_letter ok\n");

  // 7. REPLAY VALIDATION (fresh admission, not attempt reset)
  console.log("--- 7. Replay Validation ---");
  const taskId = deadLetter[0].task_id;
  chord.replayTask(taskId);
  const reQueued = chord.queryQueue({ status: "queued" });
  if (!reQueued.find(t => t.task_id === taskId)) {
    throw new Error("Task not re-queued for replay");
  }
  console.log("✅ replayTask (dead_letter -> queued) ok\n");

  // 7b. UNCERTAIN RECONCILIATION
  console.log("--- 7b. Uncertain Reconciliation ---");
  chord.reconcileTask({ task_id: uncertainTasks[0].task_id, principal_id: "verify-human", decision: "confirmed_not_executed", evidence: { kind: "no_effect_confirmation", reference: "mock-adapter-no-effect-receipt" }, expectedRevision: chord.getRunRevision() });
  chord.replayTask(uncertainTasks[0].task_id);
  if (chord.registry.tasks[uncertainTasks[0].task_id].status !== "queued") {
    throw new Error("Uncertain task should requeue through fresh admission");
  }
  chord.setAdapterRouter({
    fallback: {
      execute: async (packet) => ({
        task_id: packet.task_id,
        status: "completed",
        outcome: "succeeded",
        outputs: { reconciled: true }
      })
    }
  });
  const reconciled = await chord.runCycle();
  if (reconciled.ok !== true) throw new Error("Reconciled task should complete");
  console.log("✅ uncertain -> replay -> completed ok\n");

  // 8. AUDIT VALIDATION
  console.log("--- 8. Audit Validation ---");
  const audit = chord.inspectAudit();
  if (!audit.tasks || !audit.queue || !audit.replay) {
    throw new Error("Audit report missing sections");
  }
  console.log("✅ Audit report structured ok\n");

  // 9. SIGILJS VALIDATION (Negative Test)
  console.log("--- 9. SigilJS Integration (Negative Test) ---");
  try {
    chord.queueTaskPackets([{
        task_id: "invalid_packet",
        // requested_action is missing (SigilJS expects array)
        target_entity: "default"
    }]);
    throw new Error("SigilJS validation should have thrown for invalid packet");
  } catch (e) {
    if (e.message === "SigilJS validation should have thrown for invalid packet") throw e;
    console.log("✅ SigilJS caught invalid packet:", e.message);
  }
  console.log("");

  console.log("🎉 ALL RUNTIME VALIDATIONS PASSED!");
}

runValidation().catch(err => {
  console.error("\n❌ VALIDATION FAILED:");
  console.error(err);
  process.exit(1);
});
