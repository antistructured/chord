import { test, expect } from 'bun:test';
import { createChord } from '../src/index.js';
import { installHost, queueOptions } from './fixtures/host.js';
const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'integrity', phase: 'verify', do: ['mock-effect'] };
export function setup(extra = {}) {
  const c = createChord(extra); const host = installHost(c);
  const { packets } = c.registerSpecAndQueue(intent, queueOptions(host));
  return { c, host, id: packets[0].task_id };
}
test('STATE-01/02: installed owner and revision-exclusive commits', () => {
  const { c } = setup(); const revision = c.getRunRevision();
  const next = c.exportRegistry().registry; next.run.state = 'active'; next.run.revision++;
  expect(c.commitRun({ expectedRevision: revision, nextRegistry: next }).ok).toBe(true);
  expect(c.getRunState()).toBe('active'); expect(c.getRunRevision()).toBe(revision + 1);
  next.run.state = 'failed';
  expect(c.getRunState()).toBe('active');
  expect(c.commitRun({ expectedRevision: revision, nextRegistry: next }).ok).toBe(false);
});
test('STATE-03/05: rejected compound candidate changes no collection or event', () => {
  const { c } = setup(); const before = c.exportRegistry().registry;
  const next = c.exportRegistry().registry; next.tasks = {}; next.run.state = 'failed'; next.event_journal = [];
  expect(() => c.commitRun({ expectedRevision: before.run.revision, nextRegistry: next })).toThrow();
  expect(c.getRegistry()).toEqual(before);
  expect(() => c.registerSpecAndQueue(intent, { actor_id: 'absent', principal_id: 'absent', capability: 'execute' })).toThrow();
  expect(c.getRegistry()).toEqual(before);
});
test('STATE-04: reads and retained inputs cannot change canonical state', () => {
  const { c, id } = setup(); const before = c.exportRegistry().registry;
  c.registry.tasks[id].status = 'completed'; c.getRegistry().run.state = 'failed';
  c.queryQueue()[0].status = 'completed'; c.inspectEvents()[0].payload.changed = true;
  c.inspectAudit().tasks[0].status = 'completed';
  c.exportRegistry().registry.tasks[id].status = 'completed';
  expect(c.getRegistry()).toEqual(before);
});
test('STATE-03: reservation and corresponding evidence share a revision', () => {
  const { c, id } = setup(); const before = c.getRunRevision();
  const n = c.inspectEvents().length; c.prepareAttempt(id);
  expect(c.getRunRevision()).toBe(before + 1);
  expect(c.inspectEvents().length).toBeGreaterThan(n);
  expect(c.inspectEvents().at(-1).run_revision).toBe(c.getRunRevision());
});
test('STATE: host commit cannot validate one operation while recording another', async () => {
  const c = createChord({ runtimePolicy: { retry: { maxAttempts: 1 } } }); const host = installHost(c);
  const { packets } = c.registerSpecAndQueue(intent, queueOptions(host)); await c.runCycle();
  const before = c.getRegistry(); const next = c.getRegistry(); next.run.revision++; next.run.state = 'cancelled'; next.tasks[packets[0].task_id].status = 'cancelled'; next.task_queue[0].status = 'cancelled';
  expect(() => c.commitRun({ expectedRevision: c.getRunRevision(), nextRegistry: next, operation: 'cancel_run' })).toThrow();
  expect(c.getRegistry()).toEqual(before);
});
test('STATE: malformed handoff identity cannot enter persisted canonical metadata', () => {
  const { c } = setup(); const before = c.getRegistry();
  expect(() => c.proposeHandoff({ from_actor_id: { forged: true }, to_actor_id: 'reviewer' })).toThrow();
  expect(c.getRegistry()).toEqual(before);
});
test('STATE: host candidates cannot append fabricated kernel history', () => {
  const { c } = setup(); const before = c.getRegistry(); const next = c.getRegistry(); next.run.revision++;
  next.event_journal.push({ event_id: 'caller-event', type: 'unsupported_type', at: 0, payload: {}, schema_version: 'chord.contracts.v1', run_id: next.run.run_id, run_revision: next.run.revision });
  expect(() => c.commitRun({ expectedRevision: c.getRunRevision(), nextRegistry: next })).toThrow(/INVALID_HISTORY/);
  expect(c.getRegistry()).toEqual(before);
});



