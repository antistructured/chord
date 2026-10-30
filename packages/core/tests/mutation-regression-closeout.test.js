import { test, expect } from 'bun:test';
import {
  createChord, SCHEMA_VERSION, replayDeadLetterTask, queryArtifacts, queryDomains,
  listDeadLetterTasks, listQueuedTasks, exportRegistry, serializeRegistry, importRegistry,
  canonicalProjection, replayNoSideEffects
} from '../src/index.js';
import { createStateOwner } from '../src/registry/owner.js';
import { createRegistry } from '../src/registry/registry.js';
import { installHost, queueOptions } from './fixtures/host.js';

const intent = { schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec', project: 'a2', phase: 'verify', do: ['mock-effect'] };
const completed = () => ({ status: 'completed', outcome: 'succeeded' });
const copy = value => JSON.parse(JSON.stringify(value));
function codeOf(action) {
  try { action(); } catch (error) { return error.code; }
  throw new Error('Expected a machine-coded rejection');
}
function setup({ protectedTask = false, router = { fallback: { execute: completed } }, policy = {} } = {}) {
  const chord = createChord({ trustedHost: { now: () => 1000 }, adapterRouter: router, runtimePolicy: policy });
  const host = installHost(chord, { approvalRequired: protectedTask });
  const opts = queueOptions(host, {
    approval_required: protectedTask,
    issueGrants: packets => packets.map(packet => chord.createTaskGrant(packet, {
      principal_id: host.principal_id, actor_id: host.actor_id, capability: host.capability,
      requires_approval: protectedTask
    }))
  });
  const [packet] = chord.createTaskPackets(intent);
  chord.queueTaskPackets([packet], opts);
  return { chord, host, packet, id: packet.task_id };
}
function installApproval(chord, approval) {
  const next = chord.getAuthority();
  next.authority_revision++;
  next.approvals.push(approval);
  chord.setAuthoritySnapshot(next, { expectedRevision: chord.getRunRevision() });
}

test('A2 CAS: snapshot run CAS rejects stale unchanged and is independent of incoming authority CAS', () => {
  const { chord } = setup();
  // Advance only the run counter: it must not be confused with authority_revision.
  chord.registerSpec(intent);
  const before = chord.getRegistry();
  const next = chord.getAuthority(); next.authority_revision++;
  expect(before.run.revision).not.toBe(next.authority_revision);
  expect(codeOf(() => chord.setAuthoritySnapshot(next, {
    expectedRevision: before.run.revision - 1, expectedAuthorityRevision: next.authority_revision
  }))).toBe('STALE_REVISION');
  expect(chord.getRegistry()).toEqual(before);
  for (const [snapshot, expectedAuthorityRevision] of [
    [next, next.authority_revision - 1],
    [{ ...next, authority_revision: next.authority_revision + 1 }, next.authority_revision + 1],
    [before.authority, before.authority.authority_revision]
  ]) {
    expect(codeOf(() => chord.setAuthoritySnapshot(snapshot, {
      expectedRevision: before.run.revision, expectedAuthorityRevision
    }))).toBe('STALE_REVISION');
    expect(chord.getRegistry()).toEqual(before);
  }
  // Exercise the +1 guard without the optional expectation guard masking it.
  for (const authority_revision of [next.authority_revision + 1, before.authority.authority_revision]) {
    expect(codeOf(() => chord.setAuthoritySnapshot({ ...next, authority_revision }, { expectedRevision: before.run.revision }))).toBe('STALE_REVISION');
    expect(chord.getRegistry()).toEqual(before);
  }
  expect(chord.setAuthoritySnapshot(next, {
    expectedRevision: before.run.revision, expectedAuthorityRevision: next.authority_revision
  })).toEqual(next);
  expect(chord.getRunRevision()).toBe(before.run.revision + 1);
  expect(chord.getAuthority()).toEqual(next);
  expect(chord.inspectEvents().at(-1).payload.operation).toBe('authority_snapshot');
});

test('A2 CAS: owner guard rejects before evaluating a snapshot or invoking a transaction callback', () => {
  const { chord } = setup(); const before = chord.getRegistry();
  // Lower commitRun also checks CAS, so merely expecting a stale error on valid
  // data would not kill removal of the *early* owner guard. Invalid data proves
  // that the SDK never entered snapshot validation on a stale owner revision.
  expect(codeOf(() => chord.setAuthoritySnapshot(null, { expectedRevision: before.run.revision - 1 }))).toBe('STALE_REVISION');
  expect(chord.getRegistry()).toEqual(before);
  const owner = createStateOwner(createRegistry()); const original = copy(owner.read()); let applied = 0;
  expect(codeOf(() => owner.transact('test', () => { applied++; }, original.run.revision + 1))).toBe('STALE_REVISION');
  expect(applied).toBe(0);
  expect(owner.read()).toEqual(original);
});

test('A2 CAS: current run revision never bypasses foreign-run snapshot rejection', () => {
  const { chord } = setup(); const before = chord.getRegistry();
  const next = chord.getAuthority(); next.authority_revision++; next.run_id = 'foreign-run'; next.grants = [];
  expect(codeOf(() => chord.setAuthoritySnapshot(next, { expectedRevision: before.run.revision }))).toBe('RUN_MISMATCH');
  expect(chord.getRegistry()).toEqual(before);
});

for (const [label, options, code] of [
  ['missing identity', {}, 'INVALID_CONTEXT'],
  ['blank principal', { principal_id: '' }, 'INVALID_SEMANTICS'],
  ['invalid actor', { actor_id: '*' }, 'INVALID_SEMANTICS'],
  ['invalid capability', { capability: ' execute' }, 'INVALID_SEMANTICS'],
  ['invalid grant id type', { grant_id: 42 }, 'INVALID_SHAPE'],
  ['empty time window', { issued_at: 10, expires_at: 10 }, 'INVALID_SEMANTICS'],
  ['reversed time window', { issued_at: 11, expires_at: 10 }, 'INVALID_SEMANTICS'],
  ['negative issue time', { issued_at: -1 }, 'INVALID_SEMANTICS']
]) test(`A2 Grant: helper rejects ${label} immediately without installing`, () => {
  const chord = createChord(); const host = installHost(chord);
  const [packet] = chord.createTaskPackets(intent); const before = chord.getRegistry();
  const valid = { principal_id: host.principal_id, actor_id: host.actor_id, capability: host.capability };
  const input = label === 'missing identity' ? options : { ...valid, ...options };
  expect(codeOf(() => chord.createTaskGrant(packet, input))).toBe(code);
  expect(chord.getRegistry()).toEqual(before);
});

test('A2 Grant: invalid packet rejects; valid shaped output installs downstream and dispatches once', async () => {
  let calls = 0;
  const chord = createChord({ trustedHost: { now: () => 1000 }, adapterRouter: { fallback: { execute() { calls++; return completed(); } } } });
  const host = installHost(chord); const before = chord.getRegistry();
  const options = { principal_id: host.principal_id, actor_id: host.actor_id, capability: host.capability };
  expect(codeOf(() => chord.createTaskGrant({}, options))).toBe('INVALID_SHAPE');
  const [packet] = chord.createTaskPackets(intent);
  const grant = chord.createTaskGrant(packet, options);
  expect(chord.getRegistry()).toEqual(before);
  expect(grant.scope).toEqual({ run_id: before.run.run_id, project: packet.project, phase: packet.phase,
    task_id: packet.task_id, target_entity: packet.target_entity, resource: { kind: 'task', id: packet.task_id } });
  const authority = chord.getAuthority(); authority.authority_revision++; authority.grants.push(grant);
  chord.setAuthoritySnapshot(authority);
  grant.scope.project = 'tampered-after-install';
  chord.queueTaskPackets([packet], options);
  expect((await chord.runCycle()).ok).toBe(true);
  expect(calls).toBe(1);
  expect(chord.getRegistry().tasks[packet.task_id].status).toBe('completed');
  expect(chord.getAuthority().grants[0].scope.project).toBe('a2');
  // Downstream validation still protects callers who mutate helper output.
  const bad = chord.createTaskGrant(packet, { ...options, grant_id: 'bad-window' }); bad.expires_at = bad.issued_at;
  const state = chord.getRegistry(); const next = chord.getAuthority(); next.authority_revision++; next.grants.push(bad);
  expect(codeOf(() => chord.setAuthoritySnapshot(next))).toBe('INVALID_SEMANTICS');
  expect(chord.getRegistry()).toEqual(state);
});

test('A2 Approval: no implicit attempt without a reservation, missing task and missing approver are coded', () => {
  const { chord, id, host } = setup({ protectedTask: true }); const before = chord.getRegistry();
  expect(codeOf(() => chord.createApproval({ task_id: id, approver_principal_id: host.human_id }))).toBe('INVALID_CONTEXT');
  expect(codeOf(() => chord.createApproval({ task_id: 'missing', approver_principal_id: host.human_id }))).toBe('INVALID_DATA');
  chord.prepareAttempt(id);
  expect(codeOf(() => chord.createApproval({ task_id: id }))).toBe('INVALID_CONTEXT');
  expect(chord.getRegistry().authority).toEqual(before.authority);
});

for (const variant of ['missing', 'foreign-attempt', 'stale-task-revision', 'expired', 'consumed', 'rejected']) {
  test(`A2 Approval: ${variant} cannot dispatch; exact prepared-attempt approval can`, async () => {
    let calls = 0;
    const { chord, host, id } = setup({ protectedTask: true, router: { fallback: { execute() { calls++; return completed(); } } } });
    const attempt = chord.prepareAttempt(id);
    const approval = chord.createApproval({ task_id: id, approver_principal_id: host.human_id });
    expect(approval.attempt_id).toBe(attempt.attempt_id);
    expect(chord.getAuthority().approvals).toEqual([]);
    const invalid = { ...approval, approval_id: 'invalid-approval' };
    if (variant === 'foreign-attempt') invalid.attempt_id = 'foreign-attempt';
    if (variant === 'stale-task-revision') invalid.task_revision++;
    if (variant === 'expired') invalid.expires_at = 1000;
    if (variant === 'consumed') invalid.consumed_by_attempt_id = invalid.attempt_id;
    if (variant === 'rejected') invalid.decision = 'rejected';
    if (variant !== 'missing') installApproval(chord, invalid);
    const denied = await chord.runCycle();
    expect(denied).toMatchObject({ ok: false, denied: true, code: variant === 'rejected' ? 'APPROVAL_REJECTED' : 'APPROVAL_REQUIRED' });
    expect(calls).toBe(0);
    expect(chord.getRegistry().tasks[id].status).toBe('queued');
    expect(chord.getRegistry().execution_results).toEqual([]);
    expect(chord.getRegistry().pending_attempts[id].attempt_id).toBe(attempt.attempt_id);
    // Replace the negative fixture, never reset consumption on an existing id.
    const next = chord.getAuthority(); next.authority_revision++; next.approvals = [approval];
    chord.setAuthoritySnapshot(next);
    expect((await chord.runCycle()).ok).toBe(true);
    expect(calls).toBe(1);
    expect(chord.getAuthority().approvals[0].consumed_by_attempt_id).toBe(attempt.attempt_id);
  });
}

test('A2 Approval: helper validates self-approval; current StoredTask excludes nonzero task revision', async () => {
  const { chord, host, id } = setup({ protectedTask: true }); const original = chord.getRegistry();
  const candidate = chord.getRegistry(); candidate.run.revision++; candidate.tasks[id].task_revision = 7;
  expect(codeOf(() => chord.commitRun({ expectedRevision: chord.getRunRevision(), nextRegistry: candidate }))).toBe('INVALID_SHAPE');
  expect(chord.getRegistry()).toEqual(original);
  const attempt = chord.prepareAttempt(id); const before = chord.getRegistry();
  expect(codeOf(() => chord.createApproval({ task_id: id, approver_principal_id: host.principal_id }))).toBe('INVALID_SEMANTICS');
  expect(codeOf(() => chord.createApproval({ task_id: id, approver_principal_id: host.human_id, issued_at: 5, expires_at: 5 }))).toBe('INVALID_SEMANTICS');
  expect(chord.getRegistry()).toEqual(before);
  const approval = chord.createApproval({ task_id: id, approver_principal_id: host.human_id });
  expect(approval.task_revision).toBe(0); expect(approval.attempt_id).toBe(attempt.attempt_id);
  installApproval(chord, approval);
  expect((await chord.runCycle()).ok).toBe(true);
});

test('A2 Approval: grant-only approval requirement cannot be dropped by helper or runtime', async () => {
  let calls = 0;
  const chord = createChord({ trustedHost: { now: () => 1000 }, adapterRouter: { fallback: { execute() { calls++; return completed(); } } } });
  const host = installHost(chord);
  const [packet] = chord.createTaskPackets(intent);
  const options = { principal_id: host.principal_id, actor_id: host.actor_id, capability: host.capability };
  const grant = chord.createTaskGrant(packet, { ...options, requires_approval: true });
  expect(grant.requires_approval).toBe(true);
  chord.queueTaskPackets([packet], { ...options, approval_required: false, issueGrants: () => [grant] });
  expect(chord.getRegistry().tasks[packet.task_id].authority_binding.approval_required).toBe(false);
  expect((await chord.runCycle()).code).toBe('APPROVAL_REQUIRED');
  expect(calls).toBe(0);
});

test('A2 Approval: foreign-run approval cannot install and failed resume leaves paused state unchanged', () => {
  const { chord, host, id } = setup({ protectedTask: true }); chord.prepareAttempt(id);
  const approval = chord.createApproval({ task_id: id, approver_principal_id: host.human_id });
  const before = chord.getRegistry();
  const foreign = { ...approval, run_id: 'foreign-run', scope: { ...approval.scope, run_id: 'foreign-run' } };
  expect(codeOf(() => installApproval(chord, foreign))).toBe('INVALID_SEMANTICS');
  expect(chord.getRegistry()).toEqual(before);
  chord.pauseForApproval(); const paused = chord.getRegistry();
  expect(codeOf(() => chord.resumeRun({ principal_id: host.human_id, approval_id: 'missing' }))).toBe('APPROVAL_REQUIRED');
  expect(chord.getRegistry()).toEqual(paused);
});

test('A2 public raw replay: fresh admission, attempt cleanup and detached-state semantics', async () => {
  const { chord, id } = setup({ router: {}, policy: { retry: { maxAttempts: 1 } } });
  expect((await chord.runCycle()).code).toBe('no_adapter');
  const consumed = chord.createApproval({ task_id: id, attempt_id: 'historical-attempt', approver_principal_id: 'human-approver' });
  consumed.consumed_by_attempt_id = consumed.attempt_id;
  installApproval(chord, consumed);
  const before = chord.getRegistry();
  expect(before.authority.approvals[0].consumed_by_attempt_id).toBe('historical-attempt');
  expect(chord.queryDeadLetters().map(x => x.task_id)).toEqual([id]);
  const denied = copy(before); denied.authority.grants[0].revoked_at = 1000;
  const deniedBefore = copy(denied);
  expect(codeOf(() => replayDeadLetterTask(denied, id, { now: 1000 }))).toBe('NO_ALLOW_GRANT');
  expect(denied).toEqual(deniedBefore);
  const data = copy(before);
  data.pending_attempts[id] = { attempt_id: 'old-pending' }; data.active_attempts[id] = { attempt_id: 'old-active' };
  // The low-level helper is a raw caller-owned data function, not an owner commit.
  const entry = replayDeadLetterTask(data, id, { now: 1000 });
  expect(entry).toMatchObject({ task_id: id, status: 'queued', retry_count: 0, available_at: 1000, lease_expires_at: null, last_error: null });
  expect(data.tasks[id].status).toBe('queued'); expect(data.tasks[id].retry_count).toBe(0);
  expect(data.pending_attempts[id]).toBeUndefined(); expect(data.active_attempts[id]).toBeUndefined();
  expect(data.run.revision).toBe(before.run.revision + 1);
  expect(data.authority.approvals).toEqual(before.authority.approvals);
  expect(replayDeadLetterTask(data, id, { now: 1000 })).toBeNull();
  expect(replayDeadLetterTask(data, 'missing', { now: 1000 })).toBeNull();
  expect(chord.getRegistry()).toEqual(before);
  chord.replayTask(id, { expectedRevision: before.run.revision });
  chord.setAdapterRouter({ fallback: { execute: completed } });
  expect((await chord.runCycle()).ok).toBe(true);
});

test('A2 public queries: nonempty include/exclude filters and detached SDK results', () => {
  const chord = createChord();
  chord.registerSpec({ schema_version: SCHEMA_VERSION, spec_type: 'CoordSpec', project: 'a2', phase: 'verify',
    state: { build: 'pending', review: 'complete' }, authority: { build: 'owner-a', review: 'owner-b' },
    handoff: ['artifact-a -> consumer-a', 'artifact-b -> consumer-b'] });
  chord.registerSpec({ schema_version: SCHEMA_VERSION, spec_type: 'HandoffSpec', project: 'a2', phase: 'verify',
    artifact: 'artifact-a', from: 'producer-a', to: ['consumer-a'], requested_action: ['review'] });
  const data = chord.getRegistry();
  expect(queryArtifacts(data, { status: 'declared', producer: 'producer-a', consumer: 'consumer-a' }).map(x => x.name)).toEqual(['artifact-a']);
  expect(chord.queryArtifacts({ producer: 'producer-a', consumer: 'consumer-b' })).toEqual([]);
  expect(chord.queryArtifacts({ status: 'accepted' })).toEqual([]);
  expect(chord.queryArtifacts({ consumer: 'consumer-b' }).map(x => x.name)).toEqual(['artifact-b']);
  expect(queryDomains(data, { owner: 'owner-a', state: 'pending' }).map(x => x.name)).toEqual(['build']);
  expect(chord.queryDomains({ owner: 'owner-a', state: 'complete' })).toEqual([]);
  expect(chord.queryDomains({ state: 'complete' }).map(x => x.name)).toEqual(['review']);
  chord.queryArtifacts()[0].status = 'accepted'; chord.queryDomains()[0].owner = 'intruder';
  expect(chord.getRegistry()).toEqual(data);
});

test('A2 serialization and SDK inspection: full roundtrip, replay equality, queue filters and detached restoration', async () => {
  const { chord, id, packet } = setup();
  expect(listQueuedTasks(chord.getRegistry(), { status: 'queued', target_entity: packet.target_entity }).map(x => x.task_id)).toEqual([id]);
  expect(chord.queryQueue({ target_entity: 'absent' })).toEqual([]);
  expect(chord.queryQueue({ status: 'dead_letter' })).toEqual([]);
  expect(listDeadLetterTasks(chord.getRegistry())).toEqual([]);
  const before = chord.getRegistry();
  for (const snapshot of [exportRegistry(before), JSON.parse(serializeRegistry(before)), chord.exportRegistry(), JSON.parse(chord.serializeRegistry())]) {
    expect(snapshot.counts).toEqual({ artifacts: 0, domains: 0, tasks: 1, queued_tasks: 1, journal_events: before.event_journal.length });
    expect(snapshot.snapshot_type).toBe('chord.registry');
    expect(importRegistry(snapshot)).toEqual(before);
  }
  const restored = createChord({ registry: importRegistry(JSON.parse(chord.serializeRegistry())), trustedHost: { now: () => 1000 } });
  restored.setAdapterRouter({ fallback: { execute: completed } });
  expect((await restored.runCycle()).ok).toBe(true);
  expect(restored.getRunRevision()).toBeGreaterThan(before.run.revision);
  expect(restored.getRegistry().tasks[id].status).toBe('completed');
  expect(chord.getRegistry()).toEqual(before);
  const events = restored.inspectEvents();
  const replay = replayNoSideEffects(events);
  expect(canonicalProjection(replay.projected)).toEqual(canonicalProjection(restored.getRegistry()));
  expect(replay.effects_invoked).toBe(0);
  expect(restored.inspectAudit({ now: 1000 })).toEqual(restored.inspectAudit({ now: 1000 }));
});

test('A2 host boundary: adapter receives data only; actor-shaped request fields cannot install authority', async () => {
  let received;
  const { chord, host, id } = setup({ router: { fallback: { execute(packet, context) { received = { packet, context }; return completed(); } } } });
  const before = chord.getRegistry();
  const attack = { ...intent, commitRun: { expectedRevision: before.run.revision, nextRegistry: before } };
  expect(codeOf(() => chord.registerSpec(attack))).toBe('INVALID_SHAPE');
  expect(codeOf(() => chord.projectContext({ principal_id: host.principal_id, actor_id: host.actor_id, commitRun: true }))).toBe('INVALID_SHAPE');
  expect(chord.getRegistry()).toEqual(before);
  const projection = chord.projectContext({ principal_id: host.principal_id, actor_id: host.actor_id });
  expect(projection.tasks.map(x => x.task_id)).toEqual([id]);
  expect(projection.commitRun).toBeUndefined();
  expect((await chord.runCycle()).ok).toBe(true);
  expect(Object.keys(received.context).sort()).toEqual(['attempt_id', 'lease_expires_at', 'queue_id', 'run_id', 'schema_version', 'task_id', 'task_revision'].sort());
  for (const data of [received.packet, received.context]) {
    expect(data.commitRun).toBeUndefined(); expect(data.registry).toBeUndefined(); expect(data.authority).toBeUndefined();
    expect(Object.values(data).some(v => typeof v === 'function')).toBe(false);
  }
});

test('A2 BOUNDARY LIMITATION: full SDK commitRun accepts plain data with no host credential', () => {
  const { chord, packet } = setup(); const before = chord.getRegistry();
  const candidate = copy(before); candidate.run.revision++;
  candidate.authority.authority_revision = 0; // Dedicated setter would reject this rewind.
  const grant = chord.createTaskGrant(packet, { principal_id: 'host-principal', actor_id: 'worker-actor', capability: 'execute', grant_id: 'host-maintenance' });
  candidate.authority.grants.push(grant);
  // Characterization, NOT an actor-security guarantee. A host that exposes this
  // method as an actor endpoint cannot distinguish this JSON from host data.
  const request = JSON.parse(JSON.stringify({ expectedRevision: before.run.revision, nextRegistry: candidate }));
  expect(chord.commitRun(request)).toEqual({ ok: true, revision: before.run.revision + 1 });
  expect(chord.getAuthority().authority_revision).toBe(0);
  expect(chord.getAuthority().grants.map(g => g.grant_id)).toContain('host-maintenance');
  expect(chord.inspectEvents().at(-1).payload.operation).toBe('host_commit');
  const installed = chord.getRegistry();
  expect(chord.commitRun(request)).toEqual({ ok: false, code: 'STALE_REVISION' });
  expect(chord.getRegistry()).toEqual(installed);
  const invalid = chord.getRegistry(); invalid.run.revision++; invalid.tasks[packet.task_id].requested_action = ['rewrite'];
  expect(codeOf(() => chord.commitRun({ expectedRevision: installed.run.revision, nextRegistry: invalid }))).toBe('IMMUTABLE_TASK');
  expect(chord.getRegistry()).toEqual(installed);
});
