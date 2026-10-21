import { test, expect } from 'bun:test';
import { createChord } from '../src/index.js';
import { installHost, queueOptions } from './fixtures/host.js';
const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'lifecycle', phase: 'verify', do: ['mock'] };
function fixture() { let calls = 0; const c = createChord({ adapterRouter: { fallback: { execute: () => { calls++; return { status: 'completed', outcome: 'succeeded' }; } } } }); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h)); return { c, h, calls: () => calls }; }
for (const state of ['paused', 'failed', 'cancelled', 'completed']) test(`LIFECYCLE: ${state} dispatches zero effects`, async () => {
  const f = fixture();
  if (state === 'paused') f.c.pauseForApproval();
  if (state === 'failed') { f.c.pauseForApproval(); f.c.rejectApproval(); }
  if (state === 'cancelled') f.c.cancelRun();
  if (state === 'completed') { const next = f.c.getRegistry(); next.run.state = state; next.run.revision++; f.c.commitRun({ expectedRevision: f.c.getRunRevision(), nextRegistry: next }); }
  await f.c.runCycle(); expect(f.calls()).toBe(0);
});
test('LIFECYCLE: resume requires an active host-authenticated human', async () => {
  const { c, h, calls } = fixture(); c.pauseForApproval();
  const before = c.getRegistry(); expect(() => c.resumeRun()).toThrow(); expect(c.getRegistry()).toEqual(before);
  expect(() => c.resumeRun({ principal_id: h.principal_id })).toThrow();
  c.resumeRun({ principal_id: h.human_id }); await c.runCycle(); expect(calls()).toBe(1);
});
test('LIFECYCLE: cancellation wins against late adapter result', async () => {
  let finish; const c = createChord({ adapterRouter: { fallback: { execute: () => new Promise(resolve => { finish = resolve; }) } } });
  const h = installHost(c); const { packets } = c.registerSpecAndQueue(intent, queueOptions(h));
  const cycle = c.runCycle(); c.cancelRun(); finish({ status: 'completed', outcome: 'succeeded' });
  expect((await cycle).ok).toBe(false); expect(c.getRunState()).toBe('cancelled'); expect(c.registry.tasks[packets[0].task_id].status).toBe('cancelled'); expect(c.registry.execution_results).toEqual([]);
});
test('LIFECYCLE: executable accessor cannot cancel after claim then execute anyway', async () => {
  let c, calls = 0, reads = 0;
  const adapter = { get execute() { if (++reads === 1) c.cancelRun(); return () => { calls++; return { status: 'completed', outcome: 'succeeded' }; }; } };
  c = createChord({ adapterRouter: { fallback: adapter } }); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h));
  const before = c.getRegistry();
  await expect(c.runCycle()).rejects.toThrow(/REENTRANT_MUTATION/);
  expect(calls).toBe(0); expect(reads).toBe(1); expect(c.getRegistry()).toEqual(before);
});

