// B6 private test seams. Not an embedding-host recovery/coordination protocol.
import { writeFileSync, appendFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createChord, openSqliteStore } from '../src/index.js';

const [mode, path, dir, slot = '0'] = process.argv.slice(2);
const emit = value => writeFileSync(`${dir}/${slot}.json`, JSON.stringify({ pid: process.pid, ...value }));
const kill = () => process.kill(process.pid, 'SIGKILL');
function barrier() {
  writeFileSync(`${dir}/${slot}.ready`, String(process.pid));
  const deadline = Date.now() + 15000;
  while (!existsSync(`${dir}/go`)) {
    if (Date.now() > deadline) throw Error('B6 barrier timed out');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}
let calls = 0, resolutions = 0;
const execute = () => {
  calls++;
  appendFileSync(`${dir}/${slot}.effects`, 'effect\n');
  if (mode === 'live') barrier(); // Deliberately unsupported live-peer recovery probe.
  return { status: 'completed', outcome: 'succeeded' };
};
const router = { fallback: { get execute() { resolutions++; if (mode === 'claim') barrier(); return execute; } } };
if (mode === 'partial') {
  // Force dirty pages to spill to WAL, then kill before COMMIT. These are
  // deliberately invalid staged raw bytes, never an accepted Chord candidate.
  const db = new DatabaseSync(path);
  db.exec('PRAGMA cache_size=1; BEGIN IMMEDIATE');
  db.prepare('UPDATE chord_store SET revision=999, commit_id=?, registry_json=?').run('torn-proposal', ' '.repeat(2 * 1024 * 1024) + '{}');
  const walBytes = statSync(`${path}-wal`).size;
  if (walBytes <= 32) throw Error('dirty pages did not spill');
  emit({ stagedRevision: db.prepare('SELECT revision FROM chord_store').get().revision, walBytes });
  kill();
} else if (mode === 'preinvoke') {
  const c = createChord({ storage: { path, mode: 'existing' }, trustedHost: { now: () => 100 }, adapterRouter: router });
  const apply = Reflect.apply;
  Reflect.apply = function(fn, receiver, args) {
    if (fn === execute) {
      const s = openSqliteStore({ path, mode: 'existing' });
      const state = s.load(); s.close();
      emit({ calls, resolutions, claimed: state.registry, revision: state.revision });
      kill(); // Before Reflect.apply enters the actual adapter callable.
    }
    return apply(fn, receiver, args);
  };
  await c.runCycle();
  throw Error('pre-invocation seam not reached');
} else {
  let c;
  const original = DatabaseSync.prototype.exec;
  let begins = 0;
  if (mode === 'recovery') DatabaseSync.prototype.exec = function(sql) {
    if (sql === 'BEGIN IMMEDIATE' && ++begins === 2) barrier();
    return original.call(this, sql);
  };
  try {
    c = createChord({ storage: { path, mode: 'existing' }, trustedHost: { now: () => 100 }, adapterRouter: router });
    const result = ['claim', 'live'].includes(mode) ? await c.runCycle() : { ok: true };
    emit({ result, calls, resolutions });
  } catch (e) { emit({ code: e.code, commitStatus: e.commitStatus, calls, resolutions }); }
  finally { DatabaseSync.prototype.exec = original; c?.close(); }
}
