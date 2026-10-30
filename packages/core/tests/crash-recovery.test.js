import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createChord, openSqliteStore } from '../src/index.js';
import { createStateOwner } from '../src/registry/owner.js';
import { reduceTrace } from '../src/platform/trace-reducer.js';
import { installHost, queueOptions } from './fixtures/host.js';

const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'b3', phase: 'recovery', do: ['protected-effect'] };
function fixture({ approvalRequired = false, adapter, now = () => 100 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'chord-b3-')), path = join(dir, 'run.sqlite');
  const c = createChord({ storage: { path, mode: 'create' }, trustedHost: { now, credential: 'DO_NOT_PERSIST_HOST_SECRET' }, adapterRouter: { fallback: adapter || { execute: () => ({ status: 'completed', outcome: 'succeeded' }) } } });
  const h = installHost(c, { approvalRequired });
  const { packets } = c.registerSpecAndQueue(intent, queueOptions(h, { approval_required: approvalRequired }));
  return { c, h, id: packets[0].task_id, path, dir, cleanup() { c.close(); rmSync(dir, { recursive: true, force: true }); } };
}
function load(path) { const s = openSqliteStore({ path, mode: 'existing' }); try { return s.load(); } finally { s.close(); } }
const code = value => e => e.code === value;
const windows = [
  ['before_commit', 'queued', 0],
  ['after_commit', 'running', 0],
  ['before_dispatch', 'running', 0],
  ['dispatch_before_ack', 'running', 1],
  ['ack_before_result_commit', 'running', 1],
  ['confirmed_committed', 'completed', 1],
  ['approval_suspension', 'queued', 0],
  ['reconciliation', 'uncertain', 1]
];
for (const [window, rawStatus, effectCount] of windows) test(`B3 SIGKILL window: ${window}`, async () => {
  const f = fixture({ approvalRequired: window === 'approval_suspension' }); f.c.close();
  let recovered;
  try {
    const effects = join(f.dir, 'effects');
    const child = spawnSync(process.execPath, [new URL('./crash-recovery-worker.js', import.meta.url).pathname, f.path, window, effects], { encoding: 'utf8', timeout: 10000 });
    assert.equal(child.signal, 'SIGKILL', child.stderr);
    assert.equal(child.status, null);
    assert.equal(existsSync(effects) ? readFileSync(effects, 'utf8').trim().split('\n').length : 0, effectCount);
    const before = load(f.path); assert.equal(before.registry.tasks[f.id].status, rawStatus);
    let resolutions = 0, calls = 0;
    recovered = createChord({ storage: { path: f.path, mode: 'existing' }, trustedHost: { now: () => 10 }, adapterRouter: { exact: new Proxy({}, { get() { resolutions++; throw Error('recovery resolved router'); } }), fallback: { execute() { calls++; throw Error('redispatch'); } } } });
    assert.equal(resolutions, 0); assert.equal(calls, 0);
    const after = recovered.getRegistry();
    assert.deepEqual(reduceTrace(after.event_journal), after);
    if (rawStatus === 'running') {
      assert.equal(after.run.revision, before.revision + 1);
      assert.equal(after.tasks[f.id].status, 'uncertain');
      assert.equal(after.task_queue[0].status, 'uncertain');
      assert.deepEqual(after.active_attempts, {}); assert.deepEqual(after.pending_attempts, {});
      assert.equal(Object.values(after.operations)[0].state, 'unknown');
      assert.throws(() => recovered.replayTask(f.id), code('RECONCILIATION_REQUIRED'));
    } else assert.deepEqual(after, before.registry);
    if (window === 'approval_suspension') {
      assert.equal(after.run.state, 'paused');
      assert.ok(after.pending_attempts[f.id]);
      assert.equal((await recovered.runCycle()).code, 'RUN_NOT_ACTIVE');
    } else if (window !== 'before_commit') {
      assert.equal((await recovered.runCycle()).skipped, true);
    }
    if (window === 'reconciliation') {
      assert.equal(Object.values(after.operations)[0].state, 'not_executed');
      assert.equal(Object.keys(after.reconciliations).length, 1);
    }
    assert.equal(resolutions, 0); assert.equal(calls, 0);
    recovered.close();
    recovered = createChord({ storage: { path: f.path, mode: 'existing' }, trustedHost: { now: () => 1 } });
    assert.deepEqual(recovered.getRegistry(), after); // second startup performs no sweep commit
  } finally { recovered?.close(); f.cleanup(); }
});

for (const phase of ['claim', 'result']) for (const fault of ['update', 'commit_before', 'commit_after']) test(`B3 storage ${phase} ${fault}: no error-as-adapter catch, overwrite or redispatch`, async () => {
  let calls = 0;
  const f = fixture({ adapter: { execute() { calls++; return { status: 'completed', outcome: 'succeeded' }; } } });
  const exec = DatabaseSync.prototype.exec, prepare = DatabaseSync.prototype.prepare;
  let updates = 0, commits = 0, fired = false;
  const target = phase === 'claim' ? 1 : 2;
  try {
    DatabaseSync.prototype.prepare = function(sql) {
      if (sql.startsWith('UPDATE')) {
        updates++;
        if (fault === 'update' && updates === target) { fired = true; throw Error('write failed'); }
      }
      return prepare.call(this, sql);
    };
    DatabaseSync.prototype.exec = function(sql) {
      if (sql === 'COMMIT') {
        commits++;
        if (commits === target && fault !== 'update') {
          fired = true;
          if (fault === 'commit_after') exec.call(this, sql);
          throw Error('ack unavailable');
        }
      }
      return exec.call(this, sql);
    };
    await assert.rejects(f.c.runCycle(), e => e.code === (fault === 'update' ? 'STORAGE_UNAVAILABLE' : 'COMMIT_OUTCOME_UNKNOWN') && e.commitStatus === (fault === 'update' ? 'not_committed' : 'unknown'));
    assert.equal(fired, true); assert.equal(calls, phase === 'claim' ? 0 : 1);
    assert.equal(updates, target); // no compensating runtime_uncertain transaction
    assert.throws(() => f.c.getRegistry(), code('STORE_CLOSED'));
    await assert.rejects(f.c.runCycle(), code('STORE_CLOSED'));
    DatabaseSync.prototype.exec = exec; DatabaseSync.prototype.prepare = prepare;
    const persisted = load(f.path).registry;
    assert.equal(persisted.tasks[f.id].status, phase === 'result' && fault === 'commit_after' ? 'completed' : phase === 'claim' && fault !== 'commit_after' ? 'queued' : 'running');
    const reopened = createChord({ storage: { path: f.path, mode: 'existing' } });
    const status = reopened.registry.tasks[f.id].status;
    assert.ok(['queued', 'uncertain', 'completed'].includes(status));
    if (status !== 'queued') assert.equal((await reopened.runCycle()).skipped, true);
    reopened.close(); assert.equal(calls, phase === 'claim' ? 0 : 1);
  } finally { DatabaseSync.prototype.exec = exec; DatabaseSync.prototype.prepare = prepare; f.cleanup(); }
});

test('B3 real CAS conflict runs callback once and discards prepared dispatch', async () => {
  let invocations = 0, getters = 0;
  const f = fixture();
  const peer = openSqliteStore({ path: f.path, mode: 'existing' });
  try {
    f.c.setAdapterRouter({ fallback: { get execute() {
      getters++;
      const before = peer.load(); const owner = createStateOwner(before.registry);
      owner.transact('host_commit', r => { r.run.state = 'active'; });
      assert.equal(peer.compareAndCommit({ expectedRevision: before.revision, nextRegistry: owner.read(), operation: 'host_commit', logicalNow: 100 }).ok, true);
      return () => { invocations++; return { status: 'completed', outcome: 'succeeded' }; };
    } } });
    await assert.rejects(f.c.runCycle(), code('STALE_REVISION'));
    assert.equal(getters, 1); assert.equal(invocations, 0);
    assert.equal(f.c.registry.tasks[f.id].status, 'queued');
    assert.equal(f.c.registry.run.state, 'active');
  } finally { peer.close(); f.cleanup(); }
});

test('B3 SDK helpers and all reads refresh authority; close is explicit and idempotent', () => {
  const f = fixture({ approvalRequired: true });
  try {
    f.c.prepareAttempt(f.id);
    const approval = f.c.createApproval({ task_id: f.id, approver_principal_id: f.h.human_id });
    assert.equal(approval.attempt_id, f.c.registry.pending_attempts[f.id].attempt_id);
    let authority = f.c.getAuthority(); authority.approvals.push(approval); authority.authority_revision++;
    f.c.setAuthoritySnapshot(authority);
    authority = f.c.getAuthority(); authority.authority_revision++;
    f.c.setAuthoritySnapshot(authority);
    assert.equal(f.c.getAuthority().authority_revision, authority.authority_revision);
    assert.deepEqual(f.c.getRegistry(), load(f.path).registry);
    assert.deepEqual(f.c.exportRegistry().registry, load(f.path).registry);
    const db = new DatabaseSync(f.path);
    const json = db.prepare('SELECT registry_json FROM chord_store').get().registry_json; db.close();
    assert.equal(json.includes('DO_NOT_PERSIST_HOST_SECRET'), false);
    assert.equal(json.includes('execute()'), false);
    assert.throws(() => createChord({ registry: f.c.registry, storage: { path: f.path, mode: 'existing' } }), code('INVALID_CONTEXT'));
    assert.throws(() => createChord({ storage: { path: f.path, mode: 'existing' }, trustedHost: { authoritySnapshot: authority } }), code('INVALID_CONTEXT'));
    f.c.close(); f.c.close();
    assert.throws(() => f.c.prepareAttempt(f.id), code('STORE_CLOSED'));
    assert.throws(() => f.c.createApproval({ task_id: f.id }), code('STORE_CLOSED'));
    assert.throws(() => f.c.exportRegistry(), code('STORE_CLOSED'));
  } finally { f.cleanup(); }
});

test('B3 persisted policy-clock floor prevents expired grant revival on backward restart', async () => {
  let raw = 100, calls = 0;
  const f = fixture({ now: () => raw });
  let reopened;
  try {
    const authority = f.c.getAuthority(); authority.authority_revision++; authority.grants[0].expires_at = 150;
    f.c.setAuthoritySnapshot(authority);
    raw = 200; f.c.registerSpec({ ...intent, phase: 'clock' }); f.c.close();
    assert.equal(load(f.path).logicalNow, 200);
    reopened = createChord({ storage: { path: f.path, mode: 'existing' }, trustedHost: { now: () => raw }, adapterRouter: { fallback: { execute() { calls++; return { status: 'completed', outcome: 'succeeded' }; } } } });
    raw = 10; // effective time is still persisted floor 200
    const denied = await reopened.runCycle(); assert.equal(denied.denied, true); assert.equal(calls, 0);
    assert.equal(load(f.path).logicalNow, 200);
    raw = 201; reopened.registerSpec({ ...intent, phase: 'clock2' });
    raw = 202; await reopened.runCycle(); // observes 202; denied claim also persists that floor
    raw = 203; await reopened.runCycle();
    // A raw-clock step back is clamped by the durable floor, not permission renewal.
    raw = 200; reopened.registerSpec({ ...intent, phase: 'clock3' });
    assert.equal(load(f.path).logicalNow, 203);
    raw = 204; reopened.cancelTask(f.id);
    raw = 206; assert.equal((await reopened.runCycle()).skipped, true); // observation without a commit
    raw = 205; assert.throws(() => reopened.registerSpec({ ...intent, phase: 'clock4' }), code('INVALID_CONTEXT'));
    assert.equal(load(f.path).logicalNow, 204);
  } finally { reopened?.close(); f.cleanup(); }
});

for (const fault of ['update', 'commit_after']) test(`B3 leased startup sweep ${fault} fails construction, then reopens effect-free`, () => {
  const f = fixture();
  const next = f.c.registry; next.tasks[f.id].status = 'leased'; next.task_queue[0].status = 'leased';
  next.task_queue[0].lease_expires_at = 999999;
  next.run.revision++;
  f.c.commitRun({ expectedRevision: next.run.revision - 1, nextRegistry: next }); f.c.close();
  const exec = DatabaseSync.prototype.exec, prepare = DatabaseSync.prototype.prepare;
  let reopened, resolutions = 0;
  try {
    DatabaseSync.prototype.prepare = function(sql) {
      if (fault === 'update' && sql.startsWith('UPDATE')) throw Error('sweep failed');
      return prepare.call(this, sql);
    };
    let commits = 0;
    DatabaseSync.prototype.exec = function(sql) {
      const result = exec.call(this, sql);
      if (sql === 'COMMIT' && ++commits === 2 && fault === 'commit_after') throw Error('lost sweep ack'); // open transaction then sweep
      return result;
    };
    assert.throws(() => createChord({ storage: { path: f.path, mode: 'existing' }, adapterRouter: { get exact() { resolutions++; throw Error('router construction before recovery'); } } }), code(fault === 'update' ? 'STORAGE_UNAVAILABLE' : 'COMMIT_OUTCOME_UNKNOWN'));
    assert.equal(resolutions, 0);
    DatabaseSync.prototype.exec = exec; DatabaseSync.prototype.prepare = prepare;
    const before = load(f.path);
    assert.equal(before.registry.tasks[f.id].status, fault === 'update' ? 'leased' : 'uncertain');
    reopened = createChord({ storage: { path: f.path, mode: 'existing' } });
    const r = reopened.registry;
    assert.equal(r.tasks[f.id].status, 'uncertain');
    assert.equal(r.task_queue[0].lease_expires_at, null);
    assert.deepEqual(r.pending_attempts, {}); assert.deepEqual(r.active_attempts, {});
    assert.equal(reopened.getRunRevision(), before.revision + (fault === 'update' ? 1 : 0));
  } finally { DatabaseSync.prototype.exec = exec; DatabaseSync.prototype.prepare = prepare; reopened?.close(); f.cleanup(); }
});

test('B3 unavailable authoritative read retires owner instead of exposing a cached view', () => {
  const f = fixture();
  try {
    const db = new DatabaseSync(f.path); db.exec("UPDATE chord_store SET registry_json='{}'"); db.close();
    assert.throws(() => f.c.getRegistry(), code('STORAGE_CORRUPT'));
    assert.throws(() => f.c.getAuthority(), code('STORE_CLOSED'));
    assert.throws(() => f.c.registerSpec(intent), code('STORE_CLOSED'));
  } finally { f.cleanup(); }
});

test('B3 close during in-flight effect releases handle without claiming cancellation or completion', async () => {
  let finish;
  const f = fixture({ adapter: { execute: () => new Promise(resolve => { finish = resolve; }) } });
  let reopened;
  try {
    const cycle = f.c.runCycle();
    const claimed = load(f.path);
    assert.equal(claimed.registry.tasks[f.id].status, 'running');
    f.c.close();
    finish({ status: 'completed', outcome: 'succeeded' });
    await assert.rejects(cycle, code('STORE_CLOSED'));
    assert.deepEqual(load(f.path), claimed);
    reopened = createChord({ storage: { path: f.path, mode: 'existing' } });
    assert.equal(reopened.registry.tasks[f.id].status, 'uncertain');
  } finally { reopened?.close(); f.cleanup(); }
});

test('B3 durable owner rejects async/reentrant callbacks before commit and reads fresh state', () => {
  const f = fixture(); const store = openSqliteStore({ path: f.path, mode: 'existing' });
  const owner = createStateOwner(undefined, { store, now: () => 100 });
  try {
    const before = owner.read();
    assert.throws(() => owner.transact('host_commit', () => Promise.resolve()), code('ASYNC_COMMIT'));
    assert.throws(() => owner.transact('host_commit', () => owner.transact('host_commit', () => {})), code('REENTRANT_MUTATION'));
    assert.deepEqual(owner.read(), before);
    f.c.prepareAttempt(f.id);
    assert.equal(owner.read().run.revision, before.run.revision + 1);
    let callbacks = 0;
    assert.throws(() => owner.transact('host_commit', () => { callbacks++; }, before.run.revision), code('STALE_REVISION'));
    assert.equal(callbacks, 0);
  } finally { owner.close(); f.cleanup(); }
});
