#!/usr/bin/env node
// Canonical governed workflow: two mock actors, one human approver, one
// protected effect, a snapshot/restore boundary, and a zero-effect replay.
//
// This is ONE host process with SEPARATE ACTOR IDENTITIES. It is not a
// demonstration of distributed workers. Every identity below is attested by
// the embedding host; neither model output nor actor request data installs
// authority.
import { createChord, importRegistry, replayNoSideEffects, canonicalProjection, SCHEMA_VERSION } from '@antistructured/chord';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export async function runCanonicalWorkflow() {
  let builderEffects = 0;
  let protectedEffects = 0;
  const chord = createChord();
  const run_id = chord.getRegistry().run.run_id;

  // 1. Host installs identity. Chord verifies the attestation it is handed;
  //    it does not authenticate anyone.
  const principal = (id, kind) => ({
    principal_id: id, issuer: 'example-host', kind,
    authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER
  });
  const actor = id => ({
    actor_id: id, principal_id: id, kind: 'agent',
    roles: [], capabilities: ['execute'], revoked_at: null
  });
  chord.setAuthoritySnapshot({
    schema_version: SCHEMA_VERSION, run_id, authority_revision: 0,
    principals: [principal('builder', 'service'), principal('reviewer', 'service'), principal('human', 'human')],
    actors: [actor('builder'), actor('reviewer')], grants: [], approvals: []
  });

  // 2. Host helpers shape grants and approvals. They shape data only: a grant
  //    still has to be installed, and an approval still has to be installed.
  const queueFor = (actor_id, requires_approval) => ({
    principal_id: actor_id, actor_id, capability: 'execute',
    approval_required: requires_approval,
    issueGrants: packets => packets.map(packet => chord.createTaskGrant(packet, {
      principal_id: actor_id, actor_id, capability: 'execute', requires_approval
    }))
  });
  const spec = action => ({
    schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec',
    project: 'canonical', phase: 'review', do: [action]
  });
  const completed = () => ({ status: 'completed', outcome: 'succeeded' });

  // 3. Builder performs ordinary work. One cycle, one adapter invocation.
  chord.setAdapterRouter({ fallback: { execute() { builderEffects++; return completed(); } } });
  chord.registerSpecAndQueue(spec('build-review-material'), queueFor('builder', false));
  if (!(await chord.runCycle()).ok) throw new Error('BUILDER_DID_NOT_COMMIT');

  // 4. Handoff: revision-guarded proposal, then an accept by the target actor.
  const handoff = chord.proposeHandoff({
    from_actor_id: 'builder', to_actor_id: 'reviewer',
    expectedRevision: chord.getRunRevision(), correlation_id: 'canonical-review'
  });
  chord.respondToHandoff({
    handoff_id: handoff.handoff_id, actor_id: 'reviewer', action: 'accept',
    expectedRevision: chord.getRunRevision()
  });

  // 5. Protected action: admitted, but dispatch is denied without an approval.
  const { packets } = chord.registerSpecAndQueue(spec('publish-protected'), queueFor('reviewer', true));
  const taskId = packets[0].task_id;
  chord.setAdapterRouter({ fallback: { execute() { protectedEffects++; return completed(); } } });
  const missing = await chord.runCycle();
  if (missing.code !== 'APPROVAL_REQUIRED' || protectedEffects !== 0) throw new Error('MISSING_APPROVAL_EXECUTED');

  // 6. Scoped context: the reviewer sees only what its active grants cover.
  const context = chord.projectContext({ principal_id: 'reviewer', actor_id: 'reviewer' });
  if (!context.tasks.some(t => t.task_id === taskId)) throw new Error('REVIEW_CONTEXT_MISSING');

  // 7. Pause the run, snapshot it, restore it into a second SDK instance.
  const attempt = chord.prepareAttempt(taskId);
  chord.pauseForApproval({ reason: 'protected-publish', expectedRevision: chord.getRunRevision() });
  if ((await chord.runCycle()).code !== 'RUN_NOT_ACTIVE' || protectedEffects !== 0) throw new Error('PAUSE_BYPASSED');
  const snapshot = chord.exportRegistry();
  const restored = createChord({ registry: importRegistry(snapshot) });

  // 8. Human approval: bound to the exact attempt, installed by the host.
  const approval = restored.createApproval({
    task_id: taskId, attempt_id: attempt.attempt_id, approver_principal_id: 'human'
  });
  const authority = restored.getAuthority();
  authority.authority_revision += 1;
  authority.approvals.push(approval);
  restored.setAuthoritySnapshot(authority, { expectedRevision: restored.getRunRevision() });
  restored.resumeRun({ principal_id: 'human', approval_id: approval.approval_id, expectedRevision: restored.getRunRevision() });

  // 9. Dispatch the protected effect: approved, then consumed exactly once.
  restored.setAdapterRouter({ fallback: { execute() { protectedEffects++; return completed(); } } });
  const result = await restored.runCycle();
  if (!result.ok) throw new Error('PROTECTED_RESULT_NOT_COMMITTED');

  // 10. Replay: a pure projection of committed facts, with zero effects.
  const state = restored.getRegistry();
  const beforeReplay = protectedEffects;
  const replay = replayNoSideEffects(restored.inspectEvents());
  const same = isDeepStrictEqual(canonicalProjection(replay.projected), canonicalProjection(state));
  const consumed = restored.getAuthority().approvals
    .find(a => a.approval_id === approval.approval_id)?.consumed_by_attempt_id === attempt.attempt_id;

  const summary = {
    run_id,
    actors: ['builder', 'reviewer', 'human'],
    accepted_handoff: state.handoffs[handoff.handoff_id].status === 'accepted',
    approval_required: missing.code === 'APPROVAL_REQUIRED',
    approval_validated: result.ok && consumed,
    approval_consumed: consumed,
    snapshot_restored: snapshot.registry.run.run_id === state.run.run_id && snapshot.registry.run.state === 'paused',
    final_task_status: state.tasks[taskId].status,
    final_run_revision: state.run.revision,
    effect_dispatch_count: protectedEffects,
    builder_effect_count: builderEffects,
    trace_event_count: state.event_journal.length,
    negative_effect_count: 0,
    replay_verified: same && beforeReplay === protectedEffects && replay.effects_invoked === 0
  };
  if (!summary.accepted_handoff || !summary.approval_consumed || !summary.snapshot_restored ||
      summary.final_task_status !== 'completed' || protectedEffects !== 1 || !summary.replay_verified) {
    throw new Error('WORKFLOW_INVARIANT_FAILED');
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCanonicalWorkflow()
    .then(summary => console.log(JSON.stringify(summary)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
