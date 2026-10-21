// Block 6A acceptance probes. Expected-safe assertions intentionally expose
// unresolved defects; run: node --test docs/internal/046-state-probes.mjs
// Audit fixture imports are NOT a packaged-consumer proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as publicApi from '../../packages/core/src/index.js';
import { installHost, queueOptions } from '../../packages/core/tests/fixtures/host.js';
import { reduceTrace, diffTraces } from '../../packages/core/src/platform/trace-reducer.js';
const { createChord, importRegistry } = publicApi;
const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'audit', phase: 'verify', do: ['mock-effect'] };
function fixture(options = {}) {
  let calls = 0;
  const chord = createChord({ adapterRouter: { fallback: { execute() { calls++; if (options.throwAdapter) throw Error('mock ambiguity'); return { status: 'completed', outcome: 'succeeded' }; } } } });
  const host = installHost(chord);
  const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
  return { chord, host, taskId: packets[0].task_id, calls: () => calls };
}
test('CAS success must install candidate in the SDK canonical owner', () => {
  const { chord } = fixture();
  const candidate = chord.exportRegistry().registry;
  candidate.run.state = 'active';
  const revision = chord.getRunRevision();
  candidate.run.revision = revision + 1;
  assert.equal(chord.commitRun({ expectedRevision: revision, nextRegistry: candidate }).ok, true);
  assert.equal(chord.getRunState(), 'active');
  assert.equal(chord.getRunRevision(), revision + 1);
});
test('two same-revision whole-run commits cannot both succeed', () => {
  const { chord } = fixture();
  const revision = chord.getRunRevision();
  const a = chord.exportRegistry().registry;
  const b = structuredClone(a);
  a.run.revision = b.run.revision = revision + 1;
  assert.equal(chord.commitRun({ expectedRevision: revision, nextRegistry: a }).ok, true);
  assert.equal(chord.commitRun({ expectedRevision: revision, nextRegistry: b }).ok, false);
});
test('paused run must invoke zero protected effects', async () => {
  const f = fixture();
  f.chord.pauseForApproval();
  await f.chord.runCycle();
  assert.equal(f.calls(), 0);
});
test('failed run after approval rejection must invoke zero effects', async () => {
  const f = fixture();
  f.chord.pauseForApproval();
  f.chord.rejectApproval();
  await f.chord.runCycle();
  assert.equal(f.calls(), 0);
});
test('denied compound registration must preserve state and journal', () => {
  const chord = createChord();
  const before = chord.exportRegistry().registry;
  assert.throws(() => chord.registerSpecAndQueue(intent, { principal_id: 'unknown', actor_id: 'unknown', capability: 'execute' }));
  assert.deepEqual(chord.exportRegistry().registry, before);
});
test('denied batch must not persist grants installed before its rejection', () => {
  const chord = createChord();
  const host = installHost(chord);
  const packets = chord.createTaskPackets(intent);
  const before = chord.exportRegistry().registry;
  assert.throws(() => chord.queueTaskPackets(packets, queueOptions(host, { actor_id: 'unknown' })));
  assert.deepEqual(chord.exportRegistry().registry, before);
});
test('read-only context cannot expose canonical authority scope aliases', () => {
  const { chord, host } = fixture();
  const before = chord.getAuthority();
  const revision = chord.getRunRevision();
  const context = chord.projectContext({ actor_id: host.actor_id, principal_id: host.principal_id });
  context.authorized_scopes[0].scope.project = 'changed-by-reader';
  assert.deepEqual(chord.getAuthority(), before);
  assert.equal(chord.getRunRevision(), revision);
});
test('context for identity with no grants must not reveal all tasks', () => {
  const { chord } = fixture();
  const context = chord.projectContext({ actor_id: 'no-actor', principal_id: 'no-principal' });
  assert.equal(context.tasks.length, 0);
  assert.equal(context.queue_summary.length, 0);
});
test('event inspection must not return writable canonical events', () => {
  const { chord } = fixture();
  const before = chord.exportRegistry().registry.event_journal;
  chord.inspectEvents()[0].payload.changed_by_reader = true;
  assert.deepEqual(chord.exportRegistry().registry.event_journal, before);
});
test('attempt reservation must advance revision and record the mutation', () => {
  const { chord, taskId } = fixture();
  const revision = chord.getRunRevision();
  const events = chord.inspectEvents().length;
  chord.prepareAttempt(taskId);
  assert.equal(chord.getRunRevision(), revision + 1);
  assert.ok(chord.inspectEvents().length > events);
});
test('unknown effect must not be re-admitted without reconciliation evidence', async () => {
  const f = fixture({ throwAdapter: true });
  await f.chord.runCycle();
  assert.equal(f.chord.exportRegistry().registry.tasks[f.taskId].status, 'uncertain');
  const before = f.chord.exportRegistry().registry;
  assert.throws(() => f.chord.replayTask(f.taskId, { expectedRevision: f.chord.getRunRevision() }));
  assert.deepEqual(f.chord.exportRegistry().registry, before);
});
test('replay must reconstruct committed task and queue state', async () => {
  const { chord } = fixture();
  await chord.runCycle();
  const original = chord.exportRegistry().registry;
  const rebuilt = reduceTrace(original.event_journal);
  assert.deepEqual(rebuilt.tasks, original.tasks);
  assert.deepEqual(rebuilt.task_queue, original.task_queue);
});
test('trace diff must detect altered content under the same event identity', () => {
  const a = [{ event_id: 'e1', run_id: 'r1', run_revision: 0, type: 'run_paused', payload: { reason: 'a' } }];
  const b = structuredClone(a);
  b[0].payload.reason = 'changed';
  assert.equal(diffTraces(a, b).equal, false);
});
test('trace diff must detect reordered events with the same ID set', () => {
  const a = [{ event_id: 'e1' }, { event_id: 'e2' }];
  assert.equal(diffTraces(a, [...a].reverse()).equal, false);
});
test('reducer must reject mixed run identities', () => {
  assert.throws(() => reduceTrace([{ event_id: 'e1', run_id: 'r1', run_revision: 0 }, { event_id: 'e2', run_id: 'r2', run_revision: 1 }]));
});
test('reducer must reject incompatible event versions and unknown event types', () => {
  assert.throws(() => reduceTrace([{ event_id: 'e1', schema_version: 'foreign.v99', type: 'invented', run_id: 'r1', run_revision: 0 }]));
});
test('reducer must reject determinably incomplete history', () => {
  assert.throws(() => reduceTrace([{ event_id: 'e9', type: 'task_result_ingested', run_id: 'r1', run_revision: 9, payload: { task_id: 'missing-task', outcome: 'succeeded' } }]));
});
test('public exports must expose the advertised no-effect replay function', () => {
  assert.equal(typeof publicApi.replayNoSideEffects, 'function');
});
test('snapshot export is a detached view (control)', () => {
  const { chord } = fixture();
  const original = chord.getRunRevision();
  chord.exportRegistry().registry.run.revision = 9999;
  assert.equal(chord.getRunRevision(), original);
});
test('stale cancellation leaves canonical state unchanged (control)', () => {
  const { chord } = fixture();
  const before = chord.exportRegistry().registry;
  assert.throws(() => chord.cancelRun({ expectedRevision: chord.getRunRevision() - 1 }), /STALE_REVISION/);
  assert.deepEqual(chord.exportRegistry().registry, before);
});
test('snapshot malformed schema rejected (control)', () => {
  const { chord } = fixture();
  const snapshot = chord.exportRegistry();
  snapshot.schema_version = 'foreign.v99';
  assert.throws(() => importRegistry(snapshot));
});
