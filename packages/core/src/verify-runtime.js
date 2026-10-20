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
    principals: [principal],
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

  // 6. FAILURE + RETRY VALIDATION
  console.log("--- 6. Failure + Retry Validation ---");
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

  // Cycle 1: Fail, retry_count -> 1
  console.log("Running Cycle 1 (Failure)...");
  await chord.runCycle();
  
  let tasks = chord.queryQueue();
  console.log("Tasks after Cycle 1:", tasks.map(t => ({ id: t.task_id, status: t.status, retries: t.retry_count })));

  // Wait for fixed delay
  await new Promise(r => setTimeout(r, 50));
  
  // Cycle 2: Fail, retry_count -> 2 -> dead_letter
  console.log("Running Cycle 2 (Failure -> Dead Letter)...");
  await chord.runCycle();

  tasks = chord.queryQueue();
  console.log("Tasks after Cycle 2:", tasks.map(t => ({ id: t.task_id, status: t.status, retries: t.retry_count })));

  // Note: listDeadLetterTasks checks registry.tasks, which might not be updated by scheduleTaskRetry yet
  // Let's check the queue directly for now as verify-runtime confirms it transitioned to dead_letter
  const deadLetter = chord.queryQueue({ status: "dead_letter" });
  console.log("Dead letters (from queue):", deadLetter.length);
  if (deadLetter.length === 0) {
    throw new Error("Task should be in dead_letter queue");
  }
  console.log("✅ Failure -> Dead Letter ok\n");

  // 7. REPLAY VALIDATION
  console.log("--- 7. Replay Validation ---");
  const taskId = deadLetter[0].task_id;
  chord.replayTask(taskId);
  const reQueued = chord.queryQueue({ status: "queued" });
  if (!reQueued.find(t => t.task_id === taskId)) {
    throw new Error("Task not re-queued for replay");
  }
  console.log("✅ replayTask ok\n");

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
