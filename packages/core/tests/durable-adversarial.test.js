import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createChord, openSqliteStore } from '../src/index.js';
import { createStateOwner } from '../src/registry/owner.js';
import { ingestExecutionResult } from '../src/execution/results.js';
import { reduceTrace } from '../src/platform/trace-reducer.js';
import { installHost, queueOptions } from './fixtures/host.js';

const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'b6', phase: 'adversarial', do: ['effect'] };
const code = expected => e => e.code === expected;
const worker = new URL('./durable-adversarial-worker.js', import.meta.url).pathname;
function fixture(adapter) {
  const dir = mkdtempSync(join(tmpdir(), 'chord-b6-')), path = join(dir, 'run.sqlite');
  const c = createChord({ storage: { path, mode: 'create' }, trustedHost: { now: () => 100 }, adapterRouter: { fallback: adapter } });
  const h = installHost(c);
  const { packets } = c.registerSpecAndQueue(intent, queueOptions(h));
  return { c, h, packets, id: packets[0].task_id, path, dir, cleanup() { c.close(); rmSync(dir, { recursive: true, force: true }); } };
}
function load(path) { const s = openSqliteStore({ path, mode: 'existing' }); try { return s.load(); } finally { s.close(); } }
function rawRow(path) {
  const db = new DatabaseSync(path);
  try { return db.prepare('SELECT * FROM chord_store').get(); }
  finally { db.close(); }
}
function matched(path) {
  const state = load(path);
  assert.deepEqual(reduceTrace(state.registry.event_journal), state.registry);
  assert.equal(state.commitId, state.registry.event_journal.at(-1).event_id);
  const db = new DatabaseSync(path);
  try { assert.deepEqual(JSON.parse(db.prepare('SELECT registry_json FROM chord_store').get().registry_json), state.registry); }
  finally { db.close(); }
  return state;
}
function killed(f, mode) {
  const child = spawnSync(process.execPath, [worker, mode, f.path, f.dir], { encoding: 'utf8', timeout: 20000 });
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  const evidence = JSON.parse(readFileSync(join(f.dir, '0.json'), 'utf8'));
  assert.equal(evidence.pid, child.pid);
  assert.notEqual(evidence.pid, process.pid);
  return evidence;
}
async function contend(f, mode) {
  const children = [], exits = [];
  try {
    for (let i = 0; i < 2; i++) {
      const child = spawn(process.execPath, [worker, mode, f.path, f.dir, String(i)], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = ''; child.stderr.on('data', b => { stderr += b; });
      children.push(child);
      exits.push(new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (status, signal) => resolve({ status, signal, stderr })); }));
    }
    const deadline = Date.now() + 15000;
    while (![0, 1].every(i => existsSync(join(f.dir, `${i}.ready`)))) {
      if (Date.now() > deadline) throw Error('contention barrier timeout');
      await new Promise(r => setTimeout(r, 10));
    }
    writeFileSync(join(f.dir, 'go'), 'go');
    for (const exit of await Promise.all(exits)) {
      assert.equal(exit.status, 0, exit.stderr); assert.equal(exit.signal, null, exit.stderr);
    }
    const results = [0, 1].map(i => JSON.parse(readFileSync(join(f.dir, `${i}.json`), 'utf8')));
    results.forEach((r, i) => { assert.equal(r.pid, children[i].pid); assert.notEqual(r.pid, process.pid); });
    assert.notEqual(results[0].pid, results[1].pid);
    return results;
  } finally { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); }
}

test('B6 independent process claim conflict: losing prepared invocation has zero effects', async () => {
  const f = fixture(); f.c.close();
  try {
    const before = matched(f.path), results = await contend(f, 'claim');
    const winner = results.find(r => r.result?.ok), loser = results.find(r => r.code === 'STALE_REVISION');
    assert.ok(winner); assert.ok(loser);
    assert.equal(winner.calls, 1); assert.equal(loser.calls, 0);
    assert.equal(winner.resolutions, 1); assert.equal(loser.resolutions, 1);
    const state = matched(f.path);
    assert.equal(state.revision, before.revision + 2);
    assert.equal(state.registry.tasks[f.id].status, 'completed');
    assert.equal(state.registry.execution_results.length, 1);
    assert.deepEqual(state.registry.event_journal.slice(0, before.registry.event_journal.length), before.registry.event_journal);
    const effects = [0, 1].map(i => existsSync(join(f.dir, `${i}.effects`)) ? readFileSync(join(f.dir, `${i}.effects`), 'utf8') : '');
    assert.equal(effects.join(''), 'effect\n');
  } finally { f.cleanup(); }
});

test('B6 SIGKILL exact before adapter callable entry retains acknowledged claim, quarantines with zero invocation', async () => {
  const f = fixture(); f.c.close(); let recovered;
  try {
    const evidence = killed(f, 'preinvoke'), before = matched(f.path);
    assert.equal(evidence.calls, 0); assert.equal(evidence.resolutions, 1);
    assert.equal(existsSync(join(f.dir, '0.effects')), false);
    assert.deepEqual(evidence.claimed, before.registry);
    assert.equal(before.registry.tasks[f.id].status, 'running');
    assert.ok(before.registry.active_attempts[f.id]);
    let calls = 0;
    recovered = createChord({ storage: { path: f.path, mode: 'existing' }, adapterRouter: { fallback: { execute() { calls++; } } } });
    assert.equal(recovered.registry.tasks[f.id].status, 'uncertain');
    assert.equal(Object.values(recovered.registry.operations)[0].state, 'unknown');
    assert.deepEqual(recovered.registry.active_attempts, {});
    for (let i = 0; i < 3; i++) assert.equal((await recovered.runCycle()).skipped, true);
    assert.equal(calls, 0);
    assert.deepEqual(matched(f.path).registry, recovered.registry);
  } finally { recovered?.close(); f.cleanup(); }
});

test('B6 competing recovery-only processes: one sweep, stale loser, no dispatch and idempotent reopen', async () => {
  const f = fixture(); f.c.close(); let reopened;
  try {
    killed(f, 'preinvoke');
    const before = matched(f.path), results = await contend(f, 'recovery');
    assert.equal(results.filter(r => r.result?.ok).length, 1);
    assert.equal(results.filter(r => r.code === 'STALE_REVISION').length, 1);
    for (const r of results) { assert.equal(r.calls, 0); assert.equal(r.resolutions, 0); }
    const after = matched(f.path);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.registry.tasks[f.id].status, 'uncertain');
    assert.equal(Object.values(after.registry.operations)[0].state, 'unknown');
    assert.equal(after.registry.event_journal.filter(e => e.type === 'state_committed' && e.payload.operation === 'restart_recovery').length, 1);
    reopened = createChord({ storage: { path: f.path, mode: 'existing' } });
    assert.deepEqual(reopened.registry, after.registry);
    assert.equal((await reopened.runCycle()).skipped, true);
  } finally { reopened?.close(); f.cleanup(); }
});

test('B6 unsupported live-peer recovery has no exclusion or fencing; recovery dispatches nothing', async () => {
  const f = fixture(); f.c.close();
  const live = spawn(process.execPath, [worker, 'live', f.path, f.dir, 'live'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; live.stderr.on('data', b => { stderr += b; });
  const exited = new Promise((resolve, reject) => { live.on('error', reject); live.on('exit', (status, signal) => resolve({ status, signal })); });
  try {
    const deadline = Date.now() + 15000;
    while (!existsSync(join(f.dir, 'live.ready'))) {
      if (Date.now() > deadline) throw Error(`live adapter barrier timeout: ${stderr}`);
      await new Promise(r => setTimeout(r, 10));
    }
    const before = matched(f.path);
    assert.equal(before.registry.tasks[f.id].status, 'running');
    const recovery = spawnSync(process.execPath, [worker, 'recover_once', f.path, f.dir, 'recovery'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(recovery.status, 0, recovery.stderr);
    const evidence = JSON.parse(readFileSync(join(f.dir, 'recovery.json'), 'utf8'));
    assert.equal(evidence.pid, recovery.pid); assert.notEqual(evidence.pid, live.pid);
    assert.equal(evidence.result.ok, true); assert.equal(evidence.calls, 0); assert.equal(evidence.resolutions, 0);
    assert.equal(live.exitCode, null); // The old adapter is demonstrably still alive.
    const swept = matched(f.path);
    assert.equal(swept.registry.tasks[f.id].status, 'uncertain');
    assert.equal(swept.revision, before.revision + 1);
    writeFileSync(join(f.dir, 'go'), 'go');
    assert.deepEqual(await exited, { status: 0, signal: null });
    const old = JSON.parse(readFileSync(join(f.dir, 'live.json'), 'utf8'));
    assert.equal(old.pid, live.pid); assert.equal(old.calls, 1); assert.equal(old.result.ok, false);
    const after = matched(f.path);
    assert.equal(after.registry.tasks[f.id].status, 'uncertain');
    assert.equal(after.registry.execution_results.length, 0);
    assert.equal(Object.values(after.registry.operations)[0].state, 'unknown');
    assert.equal(readFileSync(join(f.dir, 'live.effects'), 'utf8'), 'effect\n');
    assert.equal(existsSync(join(f.dir, 'recovery.effects')), false);
  } finally { if (live.exitCode === null) { live.kill('SIGKILL'); await exited; } f.cleanup(); }
});

test('B6 killed partial WAL write rolls back every header/state/evidence byte', () => {
  const f = fixture(); f.c.close();
  try {
    const before = matched(f.path), rawBefore = rawRow(f.path), evidence = killed(f, 'partial');
    assert.equal(evidence.stagedRevision, 999); assert.ok(evidence.walBytes > 32);
    assert.deepEqual(matched(f.path), before);
    assert.deepEqual(rawRow(f.path), rawBefore); // Includes exact registry_json text and every header.
  } finally { f.cleanup(); }
});

test('B6 duplicate task batch and repeat delivery after reopen reject atomically', async () => {
  let calls = 0;
  const f = fixture({ execute() { calls++; return { status: 'completed', outcome: 'succeeded' }; } });
  let reopened;
  try {
    let before = matched(f.path);
    assert.throws(() => f.c.queueTaskPackets(f.packets, queueOptions(f.h)), code('INVALID_SEMANTICS'));
    assert.deepEqual(matched(f.path), before);
    const fresh = f.c.createTaskPackets(intent)[0];
    assert.throws(() => f.c.queueTaskPackets([fresh, fresh], queueOptions(f.h)), code('INVALID_SEMANTICS'));
    assert.deepEqual(matched(f.path), before);
    assert.equal((await f.c.runCycle()).ok, true); assert.equal(calls, 1);
    before = matched(f.path); f.c.close();
    reopened = createChord({ storage: { path: f.path, mode: 'existing' } });
    assert.throws(() => reopened.queueTaskPackets(f.packets, queueOptions(f.h)), code('INVALID_SEMANTICS'));
    assert.deepEqual(matched(f.path), before);
    assert.equal((await reopened.runCycle()).skipped, true);
    assert.equal(calls, 1);
  } finally { reopened?.close(); f.cleanup(); }
});

test('B6 duplicate adapter settlement and internal duplicate result ingestion cannot duplicate evidence', async () => {
  let calls = 0;
  const f = fixture({ execute() { calls++; return { then(resolve) { resolve({ status: 'completed', outcome: 'succeeded' }); resolve({ status: 'failed', outcome: 'failed' }); } }; } });
  let owner;
  try {
    assert.equal((await f.c.runCycle()).ok, true);
    const before = matched(f.path); assert.equal(before.registry.execution_results.length, 1); assert.equal(calls, 1);
    const outcome = before.registry.execution_results[0];
    f.c.close();
    owner = createStateOwner(undefined, { store: openSqliteStore({ path: f.path, mode: 'existing' }), now: () => 100 });
    // Private ingestion seam: there is deliberately no public SDK result endpoint.
    assert.throws(() => owner.transact('runtime_result', r => ingestExecutionResult(r, outcome)), code('INVALID_RESULT'));
    assert.deepEqual(matched(f.path), before);
  } finally { owner?.close(); f.cleanup(); }
});

test('B6 stale attempt result after evidence-backed readmission cannot consume newer active attempt', async () => {
  let finish, calls = 0;
  const f = fixture({ execute() { calls++; if (calls === 1) throw Error('ambiguous'); return new Promise(resolve => { finish = resolve; }); } });
  let owner;
  try {
    const first = f.c.runCycle(), claimed = matched(f.path).registry.active_attempts[f.id].attempt;
    await first;
    assert.throws(() => f.c.replayTask(f.id), code('RECONCILIATION_REQUIRED'));
    f.c.reconcileTask({ task_id: f.id, principal_id: f.h.human_id, decision: 'confirmed_not_executed', evidence: { kind: 'no_effect_confirmation', reference: 'b6-host-receipt' }, expectedRevision: f.c.getRunRevision() });
    f.c.replayTask(f.id);
    const cycle = f.c.runCycle(), before = matched(f.path);
    assert.notEqual(before.registry.active_attempts[f.id].attempt.attempt_id, claimed.attempt_id);
    owner = createStateOwner(undefined, { store: openSqliteStore({ path: f.path, mode: 'existing' }), now: () => 100 });
    const stale = { status: 'completed', outcome: 'succeeded', task_id: f.id, run_id: claimed.run_id, schema_version: claimed.schema_version, task_revision: claimed.task_revision, queue_id: claimed.queue_id, attempt_id: claimed.attempt_id };
    assert.throws(() => owner.transact('runtime_result', r => ingestExecutionResult(r, stale)), code('INVALID_RESULT'));
    assert.deepEqual(matched(f.path), before);
    finish({ status: 'completed', outcome: 'succeeded' });
    assert.equal((await cycle).ok, true);
    const after = matched(f.path);
    assert.equal(after.registry.execution_results.length, 1);
    assert.equal(after.registry.execution_results[0].attempt_id, before.registry.active_attempts[f.id].attempt.attempt_id);
    assert.equal(calls, 2);
  } finally { owner?.close(); f.cleanup(); }
});

test('B6 late completion after durable cancellation preserves terminal facts', async () => {
  let finish;
  const f = fixture({ execute: () => new Promise(resolve => { finish = resolve; }) });
  try {
    const cycle = f.c.runCycle();
    f.c.cancelTask(f.id);
    const cancelled = matched(f.path).registry.tasks[f.id];
    finish({ status: 'completed', outcome: 'succeeded' });
    const result = await cycle;
    assert.equal(result.ok, false); assert.equal(result.uncertain, false);
    const after = matched(f.path).registry;
    assert.deepEqual(after.tasks[f.id], cancelled);
    assert.equal(after.execution_results.length, 0);
    assert.equal(after.task_queue[0].status, 'cancelled');
  } finally { f.cleanup(); }
});

test('B6 journal pagination follows immutable array order, never wall-clock ordering', () => {
  const f = fixture(), originalNow = Date.now;
  try {
    for (const at of [9000, 9000, 1000]) {
      Date.now = () => at;
      f.c.registerSpec({ ...intent, phase: `clock-${at}` });
    }
    Date.now = originalNow;
    const state = matched(f.path), s = openSqliteStore({ path: f.path, mode: 'existing' });
    try {
      const entries = [];
      let afterOrdinal = 0, page;
      do { page = s.readHistory({ afterOrdinal, limit: 2 }); entries.push(...page.entries); afterOrdinal += page.entries.length; } while (page.hasMore);
      assert.deepEqual(entries.map(x => x.journalOrdinal), state.registry.event_journal.map((_, i) => i + 1));
      assert.deepEqual(entries.map(x => x.event), state.registry.event_journal);
      assert.notDeepEqual(entries.map(x => x.event.at), entries.map(x => x.event.at).sort((a, b) => a - b));
    } finally { s.close(); }
  } finally { Date.now = originalNow; f.cleanup(); }
});

test('B6 post-UPDATE exception confirms rollback, lost COMMIT ack resolves by identity even after a later commit', () => {
  const f = fixture(), prepare = DatabaseSync.prototype.prepare, exec = DatabaseSync.prototype.exec;
  let s, reopened;
  try {
    f.c.close(); s = openSqliteStore({ path: f.path, mode: 'existing' });
    const before = matched(f.path), candidate = createStateOwner(before.registry);
    candidate.transact('host_commit', r => { r.run.state = 'active'; });
    const args = { expectedRevision: before.revision, nextRegistry: candidate.read(), operation: 'host_commit', logicalNow: 100 };
    let writes = 0;
    DatabaseSync.prototype.prepare = function(sql) {
      const statement = prepare.call(this, sql);
      if (!sql.startsWith('UPDATE')) return statement;
      return { run(...values) { statement.run(...values); writes++; throw Error('after actual UPDATE'); } };
    };
    assert.throws(() => s.compareAndCommit(args), e => e.code === 'STORAGE_UNAVAILABLE' && e.commitStatus === 'not_committed');
    DatabaseSync.prototype.prepare = prepare;
    assert.deepEqual(matched(f.path), before);
    DatabaseSync.prototype.exec = function(sql) { const value = exec.call(this, sql); if (sql === 'COMMIT') throw Error('lost actual commit acknowledgement'); return value; };
    assert.throws(() => s.compareAndCommit(args), e => e.code === 'COMMIT_OUTCOME_UNKNOWN' && e.commitStatus === 'unknown');
    DatabaseSync.prototype.exec = exec;
    assert.throws(() => s.load(), code('STORE_CLOSED'));
    const committed = matched(f.path);
    assert.deepEqual(committed.registry, args.nextRegistry);
    assert.equal(writes, 1); // No automatic retry of the first failed UPDATE.
    reopened = openSqliteStore({ path: f.path, mode: 'existing' });
    const next = createStateOwner(committed.registry); next.transact('host_commit', () => {});
    reopened.compareAndCommit({ expectedRevision: committed.revision, nextRegistry: next.read(), operation: 'host_commit', logicalNow: 100 });
    const final = matched(f.path), index = final.registry.event_journal.findIndex(e => e.event_id === committed.commitId);
    assert.ok(index > 0);
    assert.equal(final.revision, committed.revision + 1);
    assert.deepEqual(reduceTrace(final.registry.event_journal.slice(0, index + 1)), committed.registry);
  } finally { DatabaseSync.prototype.prepare = prepare; DatabaseSync.prototype.exec = exec; s?.close(); reopened?.close(); f.cleanup(); }
});

test('B6 corrupt execution evidence and reordered diagnostics abort SDK construction before router access', async () => {
  for (const corruption of ['result', 'diagnostic_order']) {
    const f = fixture({ execute: () => ({ status: 'completed', outcome: 'succeeded', outputs: { receipt: 'original' } }) });
    try {
      await f.c.runCycle(); const original = matched(f.path).registry;
      f.c.close();
      const corrupt = structuredClone(original);
      if (corruption === 'result') corrupt.execution_results[0].outputs.receipt = 'forged';
      else {
        const event = corrupt.event_journal.findLast(e => e.type === 'state_committed' && e.payload.diagnostic_ids.length > 1);
        assert.ok(event); event.payload.diagnostic_ids.reverse();
      }
      const db = new DatabaseSync(f.path); db.prepare('UPDATE chord_store SET registry_json=?').run(JSON.stringify(corrupt)); db.close();
      let routers = 0;
      assert.throws(() => createChord({ storage: { path: f.path, mode: 'existing' }, adapterRouter: { get exact() { routers++; throw Error('must not bind router'); } } }), code('STORAGE_CORRUPT'));
      assert.equal(routers, 0);
      assert.throws(() => load(f.path), code('STORAGE_CORRUPT'));
      const raw = new DatabaseSync(f.path);
      try { assert.deepEqual(JSON.parse(raw.prepare('SELECT registry_json FROM chord_store').get().registry_json), corrupt); }
      finally { raw.close(); }
    } finally { f.cleanup(); }
  }
});
