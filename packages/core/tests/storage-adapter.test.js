import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createChord } from '../src/index.js';
import { installHost, queueOptions } from './fixtures/host.js';
import { DatabaseSync } from 'node:sqlite';
import { openSqliteStore } from '../src/index.js';
import { createRegistry } from '../src/registry/registry.js';
import { createStateOwner } from '../src/registry/owner.js';
import { reduceTrace } from '../src/platform/trace-reducer.js';
import { appendRegistryEvent } from '../src/platform/event-journal.js';
import { stateChanges, canonicalProjection } from '../src/platform/history.js';

test('storage architecture keeps pure validation free of I/O and binds only lazy node:sqlite', () => {
  const pure = readFileSync(new URL('../src/storage/contract.js', import.meta.url), 'utf8');
  assert.equal(/from ['"]node:|createRequire|DatabaseSync|Date\.now/.test(pure), false);
  const shell = readFileSync(new URL('../src/runtime/storage/sqlite.js', import.meta.url), 'utf8');
  assert.match(shell, /createRequire\(import\.meta\.url\)\('node:sqlite'\)/);
  assert.equal(/bun:sqlite|from ['"]node:sqlite|import\(['"]node:sqlite/.test(shell), false);
});

test('storage lazy binding: memory SDK works when node:sqlite loading is denied', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import Module from 'node:module';
    const original = Module._load; let attempts = 0;
    if (globalThis.Bun) {
      const {mock} = await import('bun:test');
      const {createRequire} = await import('node:module');
      mock.module('node:module', () => ({ createRequire: url => {
        const require = createRequire(url);
        return name => { if(name === 'node:sqlite') { attempts++; throw Error('denied'); } return require(name); };
      } }));
    } else {
      Module._load = function(name, ...args) { if (name === 'node:sqlite') { attempts++; throw Error('denied'); } return original.call(this, name, ...args); };
    }
    const {createChord, openSqliteStore} = await import(${JSON.stringify(new URL('../src/index.js', import.meta.url).href)});
    createChord(); if(attempts !== 0) process.exit(7);
    try { openSqliteStore({path:'/unused.sqlite', mode:'existing'}); process.exit(8); }
    catch(e) { if(e.code !== 'UNSUPPORTED_RUNTIME' || attempts !== 1) throw e; }
  `], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});

const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'chord-b2-')), path = join(dir, 'run.sqlite');
  const owner = createStateOwner(createRegistry());
  const initial = structuredClone(owner.read());
  const store = openSqliteStore({ path, mode: 'create' });
  const cleanup = () => { store.close(); rmSync(dir, { recursive: true, force: true }); };
  return { path, owner, initial, store, cleanup };
};
const request = (owner, expectedRevision = 0, logicalNow = 5) => {
  owner.transact('host_commit', r => { r.run.state = 'active'; });
  return { expectedRevision, nextRegistry: structuredClone(owner.read()), operation: 'host_commit', logicalNow };
};
const rejects = (fn, code, status) => assert.throws(fn, e => e instanceof TypeError && e.code === code && e.path === '$' && (!status || e.commitStatus === status) && e.message === code);

test('storage lifecycle, detached disk reopen, owner journal/evidence equality and pagination', () => {
  const f = fixture();
  try {
    rejects(() => f.store.load(), 'STORE_NOT_INITIALIZED');
    assert.equal(f.store.init({ initialRegistry: f.initial, logicalNow: 20 }).revision, 0);
    rejects(() => f.store.init({ initialRegistry: f.initial, logicalNow: 20 }), 'STORE_ALREADY_INITIALIZED', 'not_committed');
    rejects(() => openSqliteStore({ path: f.path, mode: 'create' }), 'STORE_ALREADY_INITIALIZED');
    const contender = openSqliteStore({ path: f.path, mode: 'existing' });
    const args = request(f.owner);
    const ack = f.store.compareAndCommit(args); assert.equal(ack.revision, 1);
    assert.deepEqual(contender.compareAndCommit(args), { ok: false, code: 'STALE_REVISION', revision: 1 });
    assert.deepEqual(f.store.load().registry, args.nextRegistry);
    assert.deepEqual(reduceTrace(f.store.load().registry.event_journal), args.nextRegistry);
    assert.equal(f.store.load().logicalNow, 20);
    f.store.load().registry.run.state = 'paused';
    args.nextRegistry.run.state = 'paused';
    assert.equal(f.store.load().registry.run.state, 'active');
    assert.equal(f.store.readHistory({ limit: 1 }).hasMore, true);
    assert.deepEqual(f.store.readHistory({ afterOrdinal: 1, limit: 1 }).entries.map(e => e.journalOrdinal), [2]);
    assert.equal(f.store.readHistory({ afterOrdinal: 2 }).hasMore, false);
    rejects(() => f.store.readHistory({ limit: 0 }), 'INVALID_CONTEXT');
    contender.close(); f.store.close(); f.store.close();
    rejects(() => f.store.load(), 'STORE_CLOSED');
    rejects(() => f.store.compareAndCommit(args), 'STORE_CLOSED', 'not_committed');
    const reopened = openSqliteStore({ path: f.path, mode: 'existing' });
    assert.equal(reopened.load().commitId, ack.commitId); reopened.close();
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import {openSqliteStore} from ${JSON.stringify(new URL('../src/index.js', import.meta.url).href)}; const s=openSqliteStore({path:${JSON.stringify(f.path)},mode:'existing'}); if(s.load().commitId!==${JSON.stringify(ack.commitId)}) process.exit(9); s.close();`], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
  } finally { f.cleanup(); }
});

test('storage rejects malformed candidate, immutable history, unrelated delta, operation and versions without writes', () => {
  const f = fixture();
  try {
    f.store.init({ initialRegistry: f.initial, logicalNow: 0 });
    const good = request(f.owner);
    const mutations = [
      a => { a.expectedRevision = -1; },
      a => { a.extra = true; },
      a => { a.logicalNow = Infinity; },
      a => { a.operation = 'wrong_operation'; },
      a => { a.nextRegistry.run.schema_version = 'future'; },
      a => { a.nextRegistry.run.run_id = 'other'; },
      a => { a.nextRegistry.run.revision = 2; },
      a => { a.nextRegistry.run.state = 'paused'; },
      a => { a.nextRegistry.event_journal[0].at++; },
      a => { a.nextRegistry.event_journal[1].event_id = a.nextRegistry.event_journal[0].event_id; },
      a => { a.nextRegistry.event_journal[1].payload.diagnostic_ids = ['missing']; },
      a => { a.nextRegistry.event_journal[1].payload.history_version = 'future'; },
      a => { a.nextRegistry.event_journal[1].payload.changes = []; },
      a => { a.nextRegistry.event_journal.reverse(); },
      a => { a.nextRegistry.event_journal = []; }
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(good); mutate(candidate);
      assert.throws(() => f.store.compareAndCommit(candidate), e => e.path === '$' && e.commitStatus === 'not_committed');
      assert.deepEqual(f.store.load().registry, f.initial);
    }
  } finally { f.cleanup(); }
});

test('storage checks supported metadata before decoding and detects malformed headers, JSON and full history', () => {
  const alterations = [
    ["storage_version='future'", 'UNSUPPORTED_STORAGE_VERSION'],
    ["schema_version='future'", 'SCHEMA_MISMATCH'],
    ["run_id='other'", 'STORAGE_CORRUPT'],
    ["revision=9", 'STORAGE_CORRUPT'],
    ["revision=9223372036854775807", 'STORAGE_CORRUPT'],
    ["logical_now=1.5", 'STORAGE_CORRUPT'],
    ["commit_id='unrelated'", 'STORAGE_CORRUPT'],
    ["registry_json='{'", 'STORAGE_CORRUPT'],
    ["registry_json='{}'", 'STORAGE_CORRUPT'],
    ["registry_json=json_set(registry_json, '$.run.state', 'active')", 'STORAGE_CORRUPT'],
    ["registry_json=json_set(registry_json, '$.event_journal[0].payload.history_version', 'future')", 'STORAGE_CORRUPT'],
    ["registry_json=json_set(registry_json, '$.event_journal', json('[]'))", 'STORAGE_CORRUPT'],
    ["registry_json=printf('%.*c', 1048577, 'x')", 'STORAGE_CORRUPT']
  ];
  for (const [sql, code] of alterations) {
    const f = fixture();
    try {
      f.store.init({ initialRegistry: f.initial, logicalNow: 0 });
      const db = new DatabaseSync(f.path); db.exec(`UPDATE chord_store SET ${sql}`); db.close();
      rejects(() => f.store.load(), code);
      rejects(() => f.store.readHistory(), code);
      f.store.close(); rejects(() => openSqliteStore({ path: f.path, mode: 'existing' }), code);
    } finally { f.cleanup(); }
  }
});

test('storage precommit rollback and unknown COMMIT acknowledgement retire handle without replay', () => {
  for (const point of ['UPDATE', 'COMMIT', 'ROLLBACK', 'STALE_ROLLBACK']) {
    const f = fixture(); const prototype = DatabaseSync.prototype, originalExec = prototype.exec, originalPrepare = prototype.prepare;
    try {
      f.store.init({ initialRegistry: f.initial, logicalNow: 0 });
      const args = request(f.owner);
      if (point === 'STALE_ROLLBACK') args.expectedRevision = 1;
      let rollbackFailed = false;
      prototype.exec = function(sql) {
        if (point === 'COMMIT' && sql === 'COMMIT') { originalExec.call(this, sql); throw Error('lost acknowledgement'); }
        if (point.includes('ROLLBACK') && sql === 'ROLLBACK' && !rollbackFailed) { rollbackFailed = true; throw Error('rollback failed'); }
        return originalExec.call(this, sql);
      };
      prototype.prepare = function(sql) {
        if (point !== 'COMMIT' && sql.startsWith('UPDATE')) throw Error('precommit failure');
        return originalPrepare.call(this, sql);
      };
      rejects(() => f.store.compareAndCommit(args), point === 'UPDATE' ? 'STORAGE_UNAVAILABLE' : 'COMMIT_OUTCOME_UNKNOWN', point === 'UPDATE' ? 'not_committed' : 'unknown');
      prototype.exec = originalExec; prototype.prepare = originalPrepare;
      if (point !== 'UPDATE') rejects(() => f.store.load(), 'STORE_CLOSED');
      const reopened = openSqliteStore({ path: f.path, mode: 'existing' });
      assert.equal(reopened.load().revision, point === 'COMMIT' ? 1 : 0);
      if (point === 'COMMIT') assert.equal(reopened.load().commitId, args.nextRegistry.event_journal.at(-1).event_id);
      reopened.close();
    } finally { prototype.exec = originalExec; prototype.prepare = originalPrepare; f.cleanup(); }
  }
});

test('storage persists current SDK execution and reconciliation evidence without claiming live integration', async () => {
  const f = fixture();
  try {
    const c = createChord({ adapterRouter: { fallback: { execute() { throw Error('unknown'); } } } });
    const h = installHost(c);
    const { packets } = c.registerSpecAndQueue({ schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'store', phase: 'test', do: ['effect'] }, queueOptions(h));
    await c.runCycle();
    f.store.init({ initialRegistry: c.getRegistry(), logicalNow: 10 });
    const before = c.getRunRevision();
    c.reconcileTask({ task_id: packets[0].task_id, principal_id: h.human_id, decision: 'confirmed_not_executed', evidence: { kind: 'no_effect_confirmation', reference: 'receipt-1' }, expectedRevision: before });
    const args = { expectedRevision: before, nextRegistry: c.getRegistry(), operation: 'reconcile_effect', logicalNow: 11 };
    assert.equal(f.store.compareAndCommit(args).ok, true);
    assert.deepEqual(f.store.load().registry, c.getRegistry());
    assert.equal(Object.values(f.store.load().registry.reconciliations)[0].evidence.reference, 'receipt-1');
    const forged = c.getRegistry(); forged.reconciliations[Object.keys(forged.reconciliations)[0]].evidence.reference = 'forged';
    const db = new DatabaseSync(f.path); db.prepare('UPDATE chord_store SET registry_json=?').run(JSON.stringify(forged)); db.close();
    rejects(() => f.store.load(), 'STORAGE_CORRUPT');
  } finally { f.cleanup(); }
});

test('storage independent-process CAS has one winner; uncommitted whole-row read is isolated', async () => {
  const f = fixture(), children = [];
  try {
    f.store.init({ initialRegistry: f.initial, logicalNow: 0 });
    const args = request(f.owner), dir = join(f.path, '..');
    const db = new DatabaseSync(f.path);
    db.exec('BEGIN IMMEDIATE');
    db.prepare('UPDATE chord_store SET revision=?, commit_id=?, registry_json=?').run(1, args.nextRegistry.event_journal.at(-1).event_id, JSON.stringify(args.nextRegistry));
    assert.deepEqual(f.store.load().registry, f.initial);
    db.exec('ROLLBACK'); db.close();
    writeFileSync(join(dir, 'proposal'), JSON.stringify(args));
    const exits = [];
    for (let i = 0; i < 2; i++) {
      const child = spawn(process.execPath, [new URL('./storage-process-worker.js', import.meta.url).pathname, f.path, join(dir, 'proposal'), join(dir, `ready${i}`), join(dir, 'go'), join(dir, `result${i}`)], { stdio: 'pipe' });
      children.push(child);
      exits.push(new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); }));
    }
    const deadline = Date.now() + 10000;
    while (![0, 1].every(i => existsSync(join(dir, `ready${i}`)))) {
      if (Date.now() > deadline) throw Error('CAS workers did not reach barrier');
      await new Promise(r => setTimeout(r, 10));
    }
    writeFileSync(join(dir, 'go'), 'go');
    assert.deepEqual(await Promise.all(exits), [0, 0]);
    const results = [0, 1].map(i => JSON.parse(readFileSync(join(dir, `result${i}`), 'utf8')));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal(results.filter(r => r.code === 'STALE_REVISION' && r.revision === 1).length, 1);
    assert.deepEqual(f.store.load().registry, args.nextRegistry);
  } finally { for (const child of children) if (child.exitCode === null) child.kill(); f.cleanup(); }
});

test('storage initialization races, incomplete genesis, overflow and terminal transitions reject atomically', () => {
  const f = fixture();
  try {
    const second = openSqliteStore({ path: f.path, mode: 'create' });
    const invalid = structuredClone(f.initial); invalid.event_journal = [];
    rejects(() => f.store.init({ initialRegistry: invalid, logicalNow: 0 }), 'INVALID_HISTORY', 'not_committed');
    rejects(() => f.store.load(), 'STORE_NOT_INITIALIZED');
    second.init({ initialRegistry: f.initial, logicalNow: 0 }); second.close();
    rejects(() => f.store.init({ initialRegistry: f.initial, logicalNow: 0 }), 'STORE_ALREADY_INITIALIZED', 'not_committed');
  } finally { f.cleanup(); }
  for (const overflow of [false, true]) {
    const f = fixture();
    try {
      const r = createRegistry(); r.run.state = 'completed'; r.run.revision = overflow ? Number.MAX_SAFE_INTEGER : 0;
      const initial = structuredClone(createStateOwner(r).read());
      f.store.init({ initialRegistry: initial, logicalNow: 0 });
      const candidate = structuredClone(initial); candidate.run.state = 'active'; candidate.run.revision++;
      appendRegistryEvent(candidate, 'state_committed', { history_version: 'chord.history.v1', sequence: 1, operation: 'host_commit', previous_commit_id: initial.event_journal[0].event_id, previous_revision: initial.run.revision, changes: stateChanges(canonicalProjection(initial), canonicalProjection(candidate)), diagnostic_ids: [] });
      rejects(() => f.store.compareAndCommit({ expectedRevision: initial.run.revision, nextRegistry: candidate, operation: 'host_commit', logicalNow: 0 }), overflow ? 'INVALID_DATA' : 'INVALID_TRANSITION', 'not_committed');
      assert.deepEqual(f.store.load().registry, initial);
    } finally { f.cleanup(); }
  }
});

test('storage persists completed SDK outcomes and authority across close/reopen', async () => {
  const f = fixture();
  try {
    const c = createChord({ adapterRouter: { fallback: { execute: () => ({ status: 'completed', outcome: 'succeeded', outputs: { receipt: 'actual-adapter-result' } }) } } });
    const h = installHost(c);
    c.registerSpecAndQueue({ schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'store', phase: 'test', do: ['effect'] }, queueOptions(h));
    await c.runCycle();
    assert.equal(c.getRegistry().execution_results.length, 1);
    f.store.init({ initialRegistry: c.getRegistry(), logicalNow: 0 }); f.store.close();
    const reopened = openSqliteStore({ path: f.path, mode: 'existing' });
    assert.deepEqual(reopened.load().registry, c.getRegistry());
    assert.equal(reopened.load().registry.execution_results[0].outputs.receipt, 'actual-adapter-result'); reopened.close();
  } finally { f.cleanup(); }
});

test('storage physical layout, missing/foreign files and lock timeout fail closed', () => {
  const f = fixture();
  try {
    rejects(() => openSqliteStore({ path: join(f.path, 'missing'), mode: 'existing' }), 'STORAGE_UNAVAILABLE');
    rejects(() => openSqliteStore({ path: ':memory:', mode: 'create' }), 'INVALID_CONTEXT');
    rejects(() => openSqliteStore({ path: f.path, mode: 'existing', busyTimeoutMs: 0 }), 'INVALID_CONTEXT');
    f.store.init({ initialRegistry: f.initial, logicalNow: 0 });
    const db = new DatabaseSync(f.path);
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    db.exec('BEGIN IMMEDIATE');
    rejects(() => f.store.compareAndCommit(request(f.owner)), 'STORAGE_UNAVAILABLE', 'not_committed');
    assert.equal(f.store.load().revision, 0); db.exec('ROLLBACK');
    db.exec('CREATE TABLE foreign_table (id INTEGER)'); db.close();
    rejects(() => f.store.load(), 'STORAGE_CORRUPT');
    f.store.close(); rejects(() => openSqliteStore({ path: f.path, mode: 'create' }), 'STORAGE_CORRUPT');
    writeFileSync(join(f.path, '..', 'garbage'), 'not sqlite');
    rejects(() => openSqliteStore({ path: join(f.path, '..', 'garbage'), mode: 'existing' }), 'STORAGE_CORRUPT');
  } finally { f.cleanup(); }
});
