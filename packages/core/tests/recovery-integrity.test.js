import { test, expect } from 'bun:test';
import { createChord } from '../src/index.js';
import { installHost, queueOptions } from './fixtures/host.js';
const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'recovery', phase: 'verify', do: ['protected-business-operation'] };
async function fixture() {
  let calls = 0; const c = createChord({ adapterRouter: { fallback: { execute() { calls++; throw Error('unknown effect'); } } } });
  const h = installHost(c); const { packets } = c.registerSpecAndQueue(intent, queueOptions(h)); const id = packets[0].task_id; await c.runCycle();
  return { c, h, id, calls: () => calls };
}
function decision(f, outcome) { return { task_id: f.id, principal_id: f.h.human_id, decision: outcome, evidence: { kind: outcome === 'confirmed_not_executed' ? 'no_effect_confirmation' : outcome === 'confirmed_completed' ? 'receipt' : 'operator_review', reference: 'host-evidence-1' }, expectedRevision: f.c.getRunRevision() }; }
test('RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID', async () => {
  const f = await fixture(); expect(() => f.c.replayTask(f.id)).toThrow(/RECONCILIATION_REQUIRED/);
  expect(() => f.c.registerSpecAndQueue(intent, queueOptions(f.h))).toThrow(/OPERATION_EXISTS/); await f.c.runCycle(); expect(f.calls()).toBe(1);
});
test('RECOVERY: missing authority/evidence rejected unchanged', async () => {
  const f = await fixture(); const before = f.c.getRegistry();
  expect(() => f.c.reconcileTask({ ...decision(f, 'confirmed_not_executed'), principal_id: 'unknown' })).toThrow();
  expect(() => f.c.reconcileTask({ ...decision(f, 'confirmed_not_executed'), evidence: { kind: 'operator_review', reference: '' } })).toThrow();
  expect(f.c.getRegistry()).toEqual(before);
});
test('RECOVERY: still unknown stays quarantined', async () => {
  const f = await fixture(); f.c.reconcileTask(decision(f, 'still_unknown')); expect(() => f.c.replayTask(f.id)).toThrow(); await f.c.runCycle(); expect(f.calls()).toBe(1);
});
test('RECOVERY: confirmed completion is never executed again', async () => {
  const f = await fixture(); f.c.reconcileTask(decision(f, 'confirmed_completed')); expect(f.c.registry.tasks[f.id].status).toBe('completed'); expect(() => f.c.replayTask(f.id)).toThrow(); await f.c.runCycle(); expect(f.calls()).toBe(1);
});
test('RECOVERY: no-effect evidence enables explicit fresh authorized attempt', async () => {
  const f = await fixture(); f.c.reconcileTask(decision(f, 'confirmed_not_executed'));
  f.c.replayTask(f.id, { expectedRevision: f.c.getRunRevision() }); f.c.setAdapterRouter({ fallback: { execute: () => ({ status: 'completed', outcome: 'succeeded' }) } });
  expect((await f.c.runCycle()).ok).toBe(true); expect(f.calls()).toBe(1); expect(f.c.registry.tasks[f.id].status).toBe('completed');
});
test('RECOVERY: competing/duplicate reconciliation cannot both commit', async () => {
  const f = await fixture(); const d = decision(f, 'confirmed_not_executed'); f.c.reconcileTask(d); const before = f.c.getRegistry();
  expect(() => f.c.reconcileTask(d)).toThrow(/STALE_REVISION/); expect(f.c.getRegistry()).toEqual(before);
});
test('RECOVERY: cancellation preserves unknown effect and supports explicit compensation receipt', async () => {
  let finish;
  const c = createChord({ adapterRouter: { fallback: { execute: () => new Promise(resolve => { finish = resolve; }) } } }); const h = installHost(c); const { packets } = c.registerSpecAndQueue(intent, queueOptions(h)); const id = packets[0].task_id;
  const cycle = c.runCycle(); c.cancelRun();
  expect(Object.values(c.registry.operations)[0].state).toBe('unknown');
  c.reconcileTask({ task_id: id, principal_id: h.human_id, decision: 'authorized_compensated', evidence: { kind: 'compensation_receipt', reference: 'compensation-verified-by-host' }, expectedRevision: c.getRunRevision() });
  finish({ status: 'completed', outcome: 'succeeded' }); expect((await cycle).ok).toBe(false);
  expect(c.registry.tasks[id].status).toBe('cancelled'); expect(Object.values(c.registry.operations)[0].state).toBe('compensated');
});

