import { test, expect } from 'bun:test';
import { createChord, importRegistry } from '../src/index.js';
import { replayNoSideEffects, reduceTrace, diffTraces } from '../src/platform/trace-reducer.js';
import { installHost, queueOptions } from './fixtures/host.js';
const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'history', phase: 'verify', do: ['mock'] };
function projection(registry) { const { event_journal, ...state } = registry; return state; }
test('REPLAY: committed admission/dispatch/result projection equals original with zero effects', async () => {
  let calls = 0; const c = createChord({ adapterRouter: { fallback: { execute: () => { calls++; return { status: 'completed', outcome: 'succeeded' }; } } } });
  const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h));
  expect(projection(reduceTrace(c.inspectEvents()))).toEqual(projection(c.getRegistry()));
  await c.runCycle(); const before = calls;
  expect(projection(replayNoSideEffects(c.inspectEvents()).projected)).toEqual(projection(c.getRegistry())); expect(calls).toBe(before);
});
test('REPLAY: uncertainty, reconciliation, handoff, pause and cancellation are recorded', async () => {
  const c = createChord({ adapterRouter: { fallback: { execute: () => { throw Error('unknown'); } } } }); const h = installHost(c); const { packets } = c.registerSpecAndQueue(intent, queueOptions(h));
  const handoff = c.proposeHandoff({ from_actor_id: h.actor_id, to_actor_id: 'reviewer' }); c.respondToHandoff({ handoff_id: handoff.handoff_id, actor_id: 'reviewer', action: 'accept' });
  await c.runCycle(); expect(projection(reduceTrace(c.inspectEvents()))).toEqual(projection(c.getRegistry()));
  c.reconcileTask({ task_id: packets[0].task_id, principal_id: h.human_id, decision: 'still_unknown', evidence: { kind: 'operator_review', reference: 'review-1' }, expectedRevision: c.getRunRevision() });
  c.pauseForApproval(); c.cancelRun(); expect(projection(reduceTrace(c.inspectEvents()))).toEqual(projection(c.getRegistry()));
});
test('REPLAY: changed content/order, missing middle/tail, duplicate/mixed-run/version records reject', () => {
  const c = createChord(); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h)); const events = c.inspectEvents();
  const changed = structuredClone(events); changed.at(-1).payload.changed = true; expect(diffTraces(events, changed).equal).toBe(false);
  expect(diffTraces(events, [...events].reverse()).equal).toBe(false);
  for (const bad of [events.slice(1), events.slice(0, -1), [...events, events.at(-1)], events.filter((_, i) => i !== 1)]) expect(() => reduceTrace(bad)).toThrow();
  const foreign = structuredClone(events); foreign.at(-1).run_id = 'foreign'; expect(() => reduceTrace(foreign)).toThrow();
  const version = structuredClone(events); version[0].schema_version = 'foreign'; expect(() => reduceTrace(version)).toThrow();
  expect(() => reduceTrace([{ event_id: 'legacy', type: 'task_enqueued', run_revision: 1 }])).toThrow();
});
test('REPLAY: dead-letter cancellation and imported running quarantine reconstruct', async () => {
  const c = createChord({ runtimePolicy: { retry: { maxAttempts: 1 } } }); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h));
  await c.runCycle(); c.cancelRun(); expect(projection(reduceTrace(c.inspectEvents()))).toEqual(projection(c.getRegistry()));
  let complete;
  const running = createChord({ adapterRouter: { fallback: { execute: () => new Promise(resolve => { complete = resolve; }) } } });
  const host = installHost(running); running.registerSpecAndQueue(intent, queueOptions(host)); const cycle = running.runCycle();
  const restored = createChord({ registry: importRegistry(running.exportRegistry()) });
  expect(projection(reduceTrace(restored.inspectEvents()))).toEqual(projection(restored.getRegistry()));
  expect(Object.values(restored.registry.tasks)[0].status).toBe('uncertain');
  complete({ status: 'completed', outcome: 'succeeded' }); await cycle;
});
test('REPLAY: seeded operation sequences retain equivalence and stale-write rejection', async () => {
  for (let seed = 1; seed <= 8; seed++) {
    let random = seed, calls = 0;
    const c = createChord({ adapterRouter: { fallback: { execute() { calls++; return { status: 'completed', outcome: 'succeeded' }; } } } }); const h = installHost(c);
    for (let step = 0; step < 3; step++) {
      random = (random * 1664525 + 1013904223) >>> 0;
      c.registerSpecAndQueue({ ...intent, do: [`seed-${seed}-operation-${step}`] }, queueOptions(h));
      if (random & 1) { c.pauseForApproval(); const count = calls; await c.runCycle(); expect(calls).toBe(count); c.resumeRun({ principal_id: h.human_id }); }
      const before = c.getRegistry(); expect(() => c.cancelRun({ expectedRevision: c.getRunRevision() - 1 })).toThrow(/STALE_REVISION/); expect(c.getRegistry()).toEqual(before);
      await c.runCycle(); expect(projection(reduceTrace(c.inspectEvents()))).toEqual(projection(c.getRegistry()));
    }
    expect(calls).toBe(3);
  }
});
test('REPLAY: unknown diagnostic type and incompatible version reject independently', () => {
  const c = createChord(); const h = installHost(c); const events = c.inspectEvents();
  const type = structuredClone(events); type[1].type = 'unsupported_diagnostic'; expect(() => reduceTrace(type)).toThrow(/UNSUPPORTED_HISTORY/);
  const version = structuredClone(events); version[0].payload.history_version = 'chord.history.v999'; expect(() => reduceTrace(version)).toThrow();
});

