import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { lstatSync, openSync, closeSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { SCHEMA_VERSION, CONTRACT_LIMITS, clonePlainData } from '../../contracts/sigils.js';
import { exactRequest } from '../../storage/contract.js';
import { createRegistry } from '../../registry/registry.js';
import { canonicalProjection, sameData, HISTORY_VERSION } from '../../platform/history.js';
import { CoordinationError, STORAGE_VERSION, PROTOCOL_VERSION, Identity, OwnerCredential, uuid, uint, id, requireTrue, fail, increment } from '../../coordination/contracts.js';
import { genesisState, identityOf, assertOwner, lifecycle, adminCandidate, closeCandidate } from '../../coordination/state.js';
import { commandCandidate, duplicateReceipt } from '../../coordination/commands.js';
import { ActorCommand, TrustedBinding, READ_TYPES } from '../../coordination/contracts.js';
import { claimCandidate, outcomeCandidate, dispatchDecision, assertAttempt } from '../../coordination/runtime.js';
import { RuntimeClaim, RuntimeOutcome } from '../../coordination/contracts.js';
import { reduceCoordinationTrace } from '../../coordination/history.js';

const layout = `CREATE TABLE chord_coordination (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  storage_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  run_id TEXT NOT NULL,
  incarnation_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  logical_now INTEGER NOT NULL CHECK(logical_now >= 0),
  generation INTEGER NOT NULL CHECK(generation >= 0),
  owner_id TEXT,
  lease_expires_at INTEGER,
  commit_id TEXT NOT NULL,
  envelope_json TEXT NOT NULL
)`;
const normalize = sql => sql.replace(/\s+/g,' ').trim();
const sanitize = e => e instanceof CoordinationError ? e : new CoordinationError(['INVALID_CONTEXT','INVALID_DATA','INVALID_SHAPE','INVALID_SEMANTICS','LIMIT_EXCEEDED','INVALID_HISTORY','INVALID_TRANSITION','IMMUTABLE_TASK','SCHEMA_MISMATCH','RUN_MISMATCH'].includes(e?.code) ? e.code : [11,26].includes(e?.errcode) ? 'STORAGE_CORRUPT' : 'STORAGE_UNAVAILABLE');

/** Experimental privileged host store. Opening/loading never acquires or recovers.
 * No actor endpoint or scheduler is exposed by this storage foundation.
 */
export function openCoordinatedSqliteStore(options) {
  // Clock is the only executable dependency. Inspect descriptors before reads.
  requireTrue(options && typeof options === 'object' && [Object.prototype,null].includes(Object.getPrototypeOf(options)), 'INVALID_CONTEXT');
  const descriptors = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(descriptors);
  requireTrue(keys.every(k => typeof k === 'string' && ['path','mode','expectedIdentity','clock'].includes(k) && descriptors[k].enumerable && Object.hasOwn(descriptors[k],'value')) && ['path','mode','expectedIdentity'].every(k => keys.includes(k)), 'INVALID_CONTEXT');
  const {path,mode,expectedIdentity} = exactRequest(Object.fromEntries(['path','mode','expectedIdentity'].map(k => [k,descriptors[k].value])), ['path','mode','expectedIdentity']);
  const clock = descriptors.clock?.value ?? {now:Date.now};
  requireTrue(clock && typeof clock.now === 'function', 'INVALID_CONTEXT');
  const now = clock.now.bind(clock);
  requireTrue(typeof path === 'string' && isAbsolute(path) && !path.includes('\0') && !path.startsWith('//') && ['create','existing'].includes(mode), 'INVALID_CONTEXT');
  let pinned = mode === 'existing' ? Identity.assert(expectedIdentity) : null;
  if (mode === 'create') requireTrue(expectedIdentity === null, 'INVALID_CONTEXT');
  let DatabaseSync;
  try { ({DatabaseSync} = createRequire(import.meta.url)('node:sqlite')); } catch { fail('UNSUPPORTED_RUNTIME'); }
  let db, closed = false, busy = false, lost = false, captured = null, lastObservation = 0;
  function retire() { closed = true; lost = true; try { db?.exec('ROLLBACK'); } catch {} try { db?.close(); } catch {} }
  function guard(work) {
    requireTrue(!closed,'STORE_CLOSED'); requireTrue(!busy,'REENTRANT_MUTATION'); busy = true;
    try { return work(); } catch (e) {
      const error = sanitize(e);
      if (['OWNER_LOST','LEASE_EXPIRED','CLOCK_ROLLBACK'].includes(error.code) && captured) lost = true;
      if (['STORAGE_CORRUPT','STORAGE_UNAVAILABLE','COMMIT_OUTCOME_UNKNOWN'].includes(error.code)) retire();
      throw error;
    } finally { busy = false; }
  }
  function checkLayout(empty = false) {
    const objects = db.prepare('SELECT type,name,sql FROM sqlite_schema').all();
    if (empty && !objects.length) return false;
    if (objects.some(o => o.name === 'chord_store')) fail('UNSUPPORTED_STORAGE_VERSION');
    requireTrue(objects.length === 1 && objects[0].type === 'table' && objects[0].name === 'chord_coordination' && normalize(objects[0].sql || '') === normalize(layout), 'STORAGE_CORRUPT');
    return true;
  }
  function read() {
    checkLayout();
    let rows;
    try { rows = db.prepare('SELECT * FROM chord_coordination').all(); }
    catch (e) { if (e.code === 'ERR_OUT_OF_RANGE') fail('STORAGE_CORRUPT'); throw e; }
    requireTrue(rows.length !== 0,'STORE_NOT_INITIALIZED'); requireTrue(rows.length === 1,'STORAGE_CORRUPT');
    const row = rows[0];
    requireTrue(row.storage_version === STORAGE_VERSION,'UNSUPPORTED_STORAGE_VERSION');
    requireTrue(row.schema_version === SCHEMA_VERSION,'SCHEMA_MISMATCH');
    requireTrue(row.protocol_version === PROTOCOL_VERSION,'UNSUPPORTED_PROTOCOL');
    let envelope;
    try {
      requireTrue(row.singleton === 1 && typeof row.envelope_json === 'string' && Buffer.byteLength(row.envelope_json) <= CONTRACT_LIMITS.bytes,'STORAGE_CORRUPT');
      envelope = reduceCoordinationTrace(JSON.parse(row.envelope_json));
      const c = envelope.coordination, lease = c.lease;
      [row.revision,row.logical_now,row.generation].forEach(uint);
      requireTrue(row.run_id === c.run_id && row.incarnation_id === c.incarnation_id && row.revision === envelope.registry.run.revision && row.logical_now === c.logical_now && row.generation === lease.generation && row.owner_id === lease.owner_id && row.lease_expires_at === lease.expires_at && row.commit_id === envelope.registry.event_journal.at(-1).event_id,'STORAGE_CORRUPT');
    } catch { fail('STORAGE_CORRUPT'); }
    const identity = identityOf(envelope.coordination);
    if (pinned) { requireTrue(identity.run_id === pinned.run_id,'RUN_MISMATCH'); requireTrue(identity.incarnation_id === pinned.incarnation_id,'INCARNATION_MISMATCH'); }
    return {identity,revision:row.revision,commitId:row.commit_id,envelope};
  }
  function sample(floor) {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) { lost = true; fail('INVALID_CONTEXT'); }
    if (value < floor || value < lastObservation) { lost = true; fail('CLOCK_ROLLBACK'); }
    lastObservation = value; return value;
  }
  function transaction(work) {
    let began = false, attemptedCommit = false;
    try {
      db.exec('BEGIN IMMEDIATE'); began = true;
      const result = work(); attemptedCommit = true; db.exec('COMMIT'); began = false; return result;
    } catch (e) {
      if (attemptedCommit) { retire(); throw new CoordinationError('COMMIT_OUTCOME_UNKNOWN','unknown'); }
      if (began) try { db.exec('ROLLBACK'); } catch { retire(); throw new CoordinationError('COMMIT_OUTCOME_UNKNOWN','unknown'); }
      throw sanitize(e);
    }
  }
  function write(envelope, current = null) {
    reduceCoordinationTrace(envelope);
    const c = envelope.coordination, l = c.lease, revision = envelope.registry.run.revision, commitId = envelope.registry.event_journal.at(-1).event_id;
    const values = [STORAGE_VERSION,SCHEMA_VERSION,PROTOCOL_VERSION,c.run_id,c.incarnation_id,revision,c.logical_now,l.generation,l.owner_id,l.expires_at,commitId,JSON.stringify(envelope)];
    const previous = current?.envelope.coordination;
    const result = !current ? db.prepare('INSERT INTO chord_coordination VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?)').run(...values) :
      db.prepare('UPDATE chord_coordination SET storage_version=?,schema_version=?,protocol_version=?,run_id=?,incarnation_id=?,revision=?,logical_now=?,generation=?,owner_id=?,lease_expires_at=?,commit_id=?,envelope_json=? WHERE singleton=1 AND run_id=? AND incarnation_id=? AND revision=? AND generation=? AND owner_id IS ? AND lease_expires_at IS ?').run(...values,previous.run_id,previous.incarnation_id,current.revision,previous.lease.generation,previous.lease.owner_id,previous.lease.expires_at);
    requireTrue(Number(result.changes) === 1,'STORAGE_CORRUPT'); return {ok:true,revision,commitId};
  }
  try {
    if (mode === 'create') { try { closeSync(openSync(path,'wx',0o600)); } catch (e) { if (e.code === 'EEXIST') fail('STORE_ALREADY_INITIALIZED'); throw e; } }
    else requireTrue(lstatSync(path).isFile(),'INVALID_CONTEXT');
    db = new DatabaseSync(path);
    const check = db.prepare('PRAGMA quick_check').all();
    requireTrue(check.length === 1 && Object.values(check[0])[0] === 'ok','STORAGE_CORRUPT');
    checkLayout(mode === 'create');
    // Existing identity/version validation occurs before changing PRAGMAs.
    if (mode === 'existing') read();
    db.exec('PRAGMA busy_timeout=1000'); db.exec('PRAGMA journal_mode=WAL'); db.exec('PRAGMA synchronous=FULL');
    requireTrue(db.prepare('PRAGMA journal_mode').get().journal_mode === 'wal' && db.prepare('PRAGMA synchronous').get().synchronous === 2 && db.prepare('PRAGMA busy_timeout').get().timeout === 1000,'STORAGE_UNAVAILABLE');
    if (mode === 'create') transaction(() => { requireTrue(!checkLayout(true),'STORE_ALREADY_INITIALIZED'); db.exec(layout); });
  } catch (e) { retire(); throw sanitize(e); }
  return Object.freeze({
    init() { return guard(() => {
      requireTrue(mode === 'create' && pinned === null,'STORE_ALREADY_INITIALIZED');
      const run = createRegistry(), identity = {run_id:run.run.run_id,incarnation_id:randomUUID()}, eventId = randomUUID();
      const result = transaction(() => {
        requireTrue(db.prepare('SELECT count(*) AS n FROM chord_coordination').get().n === 0,'STORE_ALREADY_INITIALIZED');
        const at = sample(0);
        run.event_journal.push({event_id:eventId,type:'state_initialized',at,schema_version:SCHEMA_VERSION,run_id:run.run.run_id,run_revision:0,payload:{history_version:HISTORY_VERSION,sequence:0,state:canonicalProjection(run)}});
        const coordination = genesisState(identity,at), envelope = {registry:run,coordination,coordination_history:[{kind:'genesis',protocol_version:PROTOCOL_VERSION,ordinal:0,revision:0,domain_commit_id:eventId,state:clonePlainData(coordination)}]};
        return {...write(envelope),identity};
      }); pinned = identity; return result;
    }); },
    load() { return guard(read); },
    commit(args) { return guard(() => {
      const request = exactRequest(args,['expectedRevision','credential','change']); uint(request.expectedRevision);
      const change = request.change;
      requireTrue(change && typeof change.kind === 'string','INVALID_CONTEXT');
      const credential = request.credential === null ? null : OwnerCredential.assert(request.credential);
      // Validate only the outer tag before the owner fence. Unsupported runtime/
      // actor/admin payloads cannot cause diagnostics under a stale credential.
      if (change.kind === 'acquire') { exactRequest(change,['kind','owner_id']); uuid(change.owner_id); requireTrue(credential === null,'INVALID_CONTEXT'); }
      const eventId = randomUUID();
      const outcome = transaction(() => {
        const current = read(), c = current.envelope.coordination, at = sample(c.logical_now);
        requireTrue(!lost,'OWNER_LOST');
        if (change.kind === 'acquire') {
          requireTrue(c.lease.owner_id === null || at >= c.lease.expires_at,'OWNER_HELD');
          requireTrue(captured === null,'OWNER_LOST');
        }
        else {
          assertOwner(c,credential,at);
          requireTrue(captured && sameData(captured,credential),'OWNER_LOST');
        }
        let binding, command;
        if (change.kind === 'actor_command') {
          // Bare foundation-stage tag is still not an implemented command.
          requireTrue(Object.hasOwn(change,'binding') && Object.hasOwn(change,'command'),'UNSUPPORTED_OPERATION');
          exactRequest(change,['kind','binding','command']);
          binding = TrustedBinding.assert(change.binding); command = ActorCommand.assert(change.command);
          requireTrue(!READ_TYPES.includes(command.type) && request.expectedRevision === command.expected_revision,'INVALID_COMMAND');
          const duplicate = duplicateReceipt(current.envelope,binding,command,at);
          if (duplicate) {
            const final = sample(c.logical_now); assertOwner(c,credential,final);
            duplicateReceipt(current.envelope,binding,command,final);
            return {ok:true,revision:duplicate.revision,commitId:duplicate.commit_id,result:duplicate};
          }
        }
        if (change.kind === 'runtime_outcome' && Object.hasOwn(change,'dispatch')) assertAttempt(current.envelope,change.dispatch);
        requireTrue(request.expectedRevision === current.revision,'STALE_REVISION'); increment(current.revision);
        if (['renew','release'].includes(change.kind)) exactRequest(change,['kind']);
        else if (change.kind === 'admin') { exactRequest(change,['kind','operation','nextRegistry','nextPolicy','audit_label']); id(change.audit_label); }
        else if (change.kind === 'runtime_claim') { requireTrue(Object.hasOwn(change,'dispatch'),'UNSUPPORTED_OPERATION'); RuntimeClaim.assert(change); }
        else if (change.kind === 'runtime_outcome') { requireTrue(Object.hasOwn(change,'dispatch'),'UNSUPPORTED_OPERATION'); RuntimeOutcome.assert(change); }
        else if (!['acquire','actor_command'].includes(change.kind)) fail('UNSUPPORTED_OPERATION');
        // First pure validation happens before the final time authorization.
        const prepare = final => change.kind === 'runtime_claim' ? claimCandidate(current.envelope,change,at,final) : change.kind === 'runtime_outcome' ? outcomeCandidate(current.envelope,change,at,final) : change.kind === 'actor_command' ? commandCandidate(current.envelope,binding,command,at,final,eventId) : change.kind === 'admin' ? adminCandidate(current.envelope,change,final) : lifecycle(current.envelope,change,at,final);
        prepare(at);
        const final = sample(c.logical_now);
        if (change.kind !== 'acquire') assertOwner(c,credential,final);
        const prepared = prepare(final);
        const candidate = closeCandidate(current.envelope,prepared,change.kind === 'admin' ? change.operation : change.kind,at,eventId);
        const saved = write(candidate,current), lease = candidate.coordination.lease;
        const result = ['actor_command','runtime_claim','runtime_outcome'].includes(change.kind) ? prepared.result : change.kind === 'acquire' ? {credential:{...current.identity,owner_id:lease.owner_id,generation:lease.generation},lease} : change.kind === 'admin' ? {operation:change.operation} : {lease};
        return {...saved,result};
      });
      if (change.kind === 'acquire') captured = clonePlainData(outcome.result.credential);
      if (change.kind === 'release') lost = true;
      return outcome;
    }); },
    checkOwner(args) { return guard(() => {
      const {credential} = exactRequest(args,['credential']);
      const token = OwnerCredential.assert(credential), current = read();
      requireTrue(!lost,'OWNER_LOST'); const at = sample(current.envelope.coordination.logical_now);
      assertOwner(current.envelope.coordination,token,at); requireTrue(captured && sameData(captured,token),'OWNER_LOST');
      return {...current,now:at};
    }); },
    checkDispatch(args) { return guard(() => {
      const {credential,dispatch} = exactRequest(args,['credential','dispatch']);
      const token = OwnerCredential.assert(credential), current = read();
      requireTrue(!lost,'OWNER_LOST'); const at = sample(current.envelope.coordination.logical_now);
      assertOwner(current.envelope.coordination,token,at); requireTrue(captured && sameData(captured,token),'OWNER_LOST');
      requireTrue(dispatch && typeof dispatch === 'object' && Object.keys(dispatch).length > 0,'UNSUPPORTED_OPERATION');
      dispatchDecision(current.envelope,dispatch,at);
      return {ok:true,revision:current.revision,commitId:current.commitId};
    }); },
    readHistory(args = {}) { return guard(() => {
      const keys = Object.keys(args); requireTrue(keys.every(k => ['afterOrdinal','limit'].includes(k)),'INVALID_CONTEXT');
      const value = exactRequest(args,keys), {afterOrdinal = null,limit = 1024} = value;
      if (afterOrdinal !== null) uint(afterOrdinal); uint(limit); requireTrue(limit >= 1 && limit <= 1024,'INVALID_CONTEXT');
      const current = read(), records = current.envelope.coordination_history, start = afterOrdinal === null ? 0 : afterOrdinal + 1;
      const entries = records.slice(start,start + limit).map(record => ({ordinal:record.ordinal,domain_events:current.envelope.registry.event_journal.filter(e => e.run_revision === record.revision),coordination_record:record}));
      return {identity:current.identity,revision:current.revision,commitId:current.commitId,entries,hasMore:start + limit < records.length};
    }); },
    close() { requireTrue(!busy,'REENTRANT_MUTATION'); if (!closed) retire(); }
  });
}
