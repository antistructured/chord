import { createRequire } from 'node:module';
import { nativeCall, diagnosticDatabase } from './diagnostics.js';
import { lstatSync, openSync, closeSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { SCHEMA_VERSION } from '../../contracts/sigils.js';
import { STORAGE_VERSION, storageError, safeInteger, exactRequest, validateRegistry, validateNext, decodeRow } from '../../storage/contract.js';

const layout = `CREATE TABLE chord_store (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  storage_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  run_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  logical_now INTEGER NOT NULL CHECK(logical_now >= 0),
  commit_id TEXT NOT NULL,
  registry_json TEXT NOT NULL
)`;
const normalize = sql => sql.replace(/\s+/g, ' ').trim();
const known = error => error instanceof TypeError && error.path === '$';
const sanitized = error => known(error) ? storageError(error.code) : storageError([11, 26].includes(error?.errcode) ? 'STORAGE_CORRUPT' : 'STORAGE_UNAVAILABLE');

/** Trusted-host raw store; no owner, scheduling, recovery, or memory fallback.
 * @param {{path: string, mode: 'existing'|'create', busyTimeoutMs?: 1000}} options
 * @returns {{init: Function, load: Function, compareAndCommit: Function, readHistory: Function, close: Function}}
 */
export function openSqliteStore(options) {
  let path, mode, busyTimeoutMs;
  try {
    const value = exactRequest(options, Object.hasOwn(options || {}, 'busyTimeoutMs') ? ['path', 'mode', 'busyTimeoutMs'] : ['path', 'mode']);
    ({ path, mode, busyTimeoutMs = 1000 } = value);
    if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0') || path.startsWith('//') || !['existing', 'create'].includes(mode) || busyTimeoutMs !== 1000) throw storageError('INVALID_CONTEXT');
  } catch (error) { throw sanitized(error); }
  let DatabaseSync;
  try { ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite')); if (typeof DatabaseSync !== 'function') throw new Error(); }
  catch { throw storageError('UNSUPPORTED_RUNTIME'); }
  let db, closed = false;
  function retire() {
    closed = true;
    // Best-effort cleanup never changes the unknown acknowledgement classification.
    try { db?.exec('ROLLBACK'); } catch { /* May already be outside a transaction. */ }
    try { db?.close(); } catch { /* Retired even if the native close fails. */ }
  }
  function assertOpen() { if (closed) throw storageError('STORE_CLOSED'); }
  function checkLayout(allowEmpty = false) {
    const objects = db.prepare('SELECT type, name, sql FROM sqlite_schema').all();
    if (allowEmpty && objects.length === 0) return false;
    if (objects.length !== 1 || objects[0].type !== 'table' || objects[0].name !== 'chord_store' || normalize(objects[0].sql || '') !== normalize(layout)) throw storageError('STORAGE_CORRUPT');
    return true;
  }
  function read() {
    checkLayout();
    let rows;
    try { rows = db.prepare('SELECT * FROM chord_store').all(); }
    catch (error) { if (error.code === 'ERR_OUT_OF_RANGE') throw storageError('STORAGE_CORRUPT'); throw error; }
    if (rows.length > 1) throw storageError('STORAGE_CORRUPT');
    return decodeRow(rows[0]);
  }
  // No host callback or await occurs inside this transaction.
  function transaction(work) {
    assertOpen();
    let began = false, attemptedCommit = false, attemptedRollback = false;
    try {
      db.exec('BEGIN IMMEDIATE'); began = true;
      const result = work();
      if (result?.ok === false) { attemptedRollback = true; db.exec('ROLLBACK'); began = false; return result; }
      attemptedCommit = true; db.exec('COMMIT'); began = false;
      return result;
    } catch (error) {
      if (attemptedCommit || attemptedRollback) { retire(); throw storageError('COMMIT_OUTCOME_UNKNOWN', 'unknown'); }
      if (began) {
        try { db.exec('ROLLBACK'); }
        catch { retire(); throw storageError('COMMIT_OUTCOME_UNKNOWN', 'unknown'); }
      }
      const failure = sanitized(error); failure.commitStatus = 'not_committed'; throw failure;
    }
  }
  try {
    let exists = true;
    try { if (!nativeCall('fs.lstat', () => lstatSync(path)).isFile()) throw storageError('INVALID_CONTEXT'); }
    catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
    if (!exists) {
      if (mode === 'existing') throw storageError('STORAGE_UNAVAILABLE');
      // Exclusive creation prevents existing-mode races from creating a file.
      const fd = nativeCall('fs.open', () => openSync(path, 'wx', 0o600));
      nativeCall('fs.close', () => closeSync(fd));
    }
    db = diagnosticDatabase(nativeCall('sqlite.open', () => new DatabaseSync(path)));
    const check = db.prepare('PRAGMA quick_check').all();
    if (check.length !== 1 || Object.values(check[0])[0] !== 'ok') throw storageError('STORAGE_CORRUPT');
    // Check identity before changing journal mode on an unknown database.
    checkLayout(mode === 'create');
    db.exec('PRAGMA busy_timeout=1000');
    db.exec('PRAGMA journal_mode=WAL'); db.exec('PRAGMA synchronous=FULL');
    if (db.prepare('PRAGMA journal_mode').get().journal_mode !== 'wal' || db.prepare('PRAGMA synchronous').get().synchronous !== 2 || db.prepare('PRAGMA busy_timeout').get().timeout !== 1000) throw storageError('STORAGE_UNAVAILABLE');
    transaction(() => {
      if (!checkLayout(mode === 'create')) db.exec(layout);
      const count = db.prepare('SELECT count(*) AS n FROM chord_store').get().n;
      if (mode === 'create' && count !== 0) {
        read(); // Corrupt/unsupported is never treated as an initialized valid run.
        throw storageError('STORE_ALREADY_INITIALIZED');
      }
      if (mode === 'existing') read();
    });
  } catch (error) {
    retire();
    if (known(error)) throw error;
    // Physical decoding failures have SQLite's CORRUPT / NOTADB numeric codes.
    throw storageError([11, 26].includes(error.errcode) ? 'STORAGE_CORRUPT' : 'STORAGE_UNAVAILABLE');
  }
  function mutation(work) {
    try { assertOpen(); return work(); }
    catch (error) {
      if (error.commitStatus) throw error;
      const failure = sanitized(error); failure.commitStatus = 'not_committed'; throw failure;
    }
  }
  function write(registry, logicalNow, insert, expectedRevision) {
    const values = [STORAGE_VERSION, SCHEMA_VERSION, registry.run.run_id, registry.run.revision, logicalNow, registry.event_journal.at(-1).event_id, JSON.stringify(registry)];
    const result = insert
      ? db.prepare('INSERT INTO chord_store VALUES (1, ?, ?, ?, ?, ?, ?, ?)').run(...values)
      : db.prepare('UPDATE chord_store SET storage_version=?, schema_version=?, run_id=?, revision=?, logical_now=?, commit_id=?, registry_json=? WHERE singleton=1 AND revision=?').run(...values, expectedRevision);
    if (Number(result.changes) !== 1) throw storageError('STORAGE_CORRUPT');
    return { ok: true, revision: registry.run.revision, commitId: values[5] };
  }
  return Object.freeze({
    init(args) { return mutation(() => {
      const { initialRegistry, logicalNow } = exactRequest(args, ['initialRegistry', 'logicalNow']); safeInteger(logicalNow);
      return transaction(() => {
        checkLayout();
        if (mode !== 'create' || db.prepare('SELECT count(*) AS n FROM chord_store').get().n !== 0) throw storageError('STORE_ALREADY_INITIALIZED');
        return write(validateRegistry(initialRegistry), logicalNow, true);
      });
    }); },
    load() {
      assertOpen(); try { return read(); } catch (error) { throw sanitized(error); }
    },
    compareAndCommit(args) { return mutation(() => {
      const { expectedRevision, nextRegistry, operation, logicalNow } = exactRequest(args, ['expectedRevision', 'nextRegistry', 'operation', 'logicalNow']);
      safeInteger(expectedRevision); safeInteger(logicalNow);
      if (typeof operation !== 'string' || operation.trim().length === 0 || operation.length > 256) throw storageError('INVALID_CONTEXT');
      return transaction(() => {
        const current = read();
        if (expectedRevision !== current.revision) return { ok: false, code: 'STALE_REVISION', revision: current.revision };
        return write(validateNext(current.registry, nextRegistry, operation), Math.max(current.logicalNow, logicalNow), false, expectedRevision);
      });
    }); },
    readHistory(args = {}) {
      assertOpen();
      const value = exactRequest(args, Object.keys(args || {}));
      if (Object.keys(value).some(k => !['afterOrdinal', 'limit'].includes(k))) throw storageError('INVALID_CONTEXT');
      const { afterOrdinal = 0, limit = 1024 } = value;
      safeInteger(afterOrdinal); safeInteger(limit); if (limit < 1 || limit > 1024) throw storageError('INVALID_CONTEXT');
      const state = this.load(), journal = state.registry.event_journal;
      return { revision: state.revision, commitId: state.commitId, entries: journal.slice(afterOrdinal, afterOrdinal + limit).map((event, i) => ({ journalOrdinal: afterOrdinal + i + 1, event })), hasMore: afterOrdinal + limit < journal.length };
    },
    close() { if (!closed) retire(); }
  });
}
