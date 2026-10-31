import { own } from '../utils/own.js';
import { RegistryData, HostCommitRequest } from "../contracts/sigils.js";
import { commitRun } from "./registry.js";
import { appendRegistryEvent } from "../platform/event-journal.js";
import { authorityError } from "../platform/authorization.js";
import { deepClone } from "../utils/clone.js";
import { canonicalProjection, stateChanges, sameData, HISTORY_VERSION } from "../platform/history.js";
import { storageError } from "../storage/contract.js";

// Private single-process owner. Never expose this object to a consumer/adapter.
export function createStateOwner(initial, { store = null, now = () => 0, observeFloor = () => {} } = {}) {
  // A durable owner never retains a registry cache as a competing authority.
  const owner = store ? null : { registry: RegistryData.assert(initial) };
  if (owner && owner.registry.event_journal.length === 0) appendRegistryEvent(owner.registry, "state_initialized", { history_version: HISTORY_VERSION, sequence: 0, state: canonicalProjection(owner.registry) });
  let closed = false;
  function assertOpen() { if (closed) throw storageError('STORE_CLOSED'); }
  function retire() { closed = true; store?.close(); }
  function read() {
    assertOpen();
    if (!store) return owner.registry;
    try { const loaded = store.load(); observeFloor(loaded.logicalNow); return loaded.registry; }
    catch (error) { retire(); throw error; }
  }
  function commit(args) {
    assertOpen();
    if (!store) return commitRun(owner, args);
    try { return store.compareAndCommit({ ...args, logicalNow: now() }); }
    catch (error) {
      if (error.commitStatus === 'unknown' || ['STORAGE_UNAVAILABLE', 'STORAGE_CORRUPT', 'STORE_CLOSED'].includes(error.code)) retire();
      throw error;
    }
  }
  function capture(current, draft, operation) {
    const previous = [...current.event_journal].reverse().find(e => ["state_committed", "state_initialized"].includes(e.type) && e.payload.history_version === HISTORY_VERSION);
    const diagnostic_ids = draft.event_journal.slice(current.event_journal.length).map(e => e.event_id);
    appendRegistryEvent(draft, "state_committed", {
      history_version: HISTORY_VERSION, operation, sequence: previous ? previous.payload.sequence + 1 : 1,
      previous_commit_id: previous?.event_id || null, previous_revision: current.run.revision,
      changes: stateChanges(canonicalProjection(current), canonicalProjection(draft)), diagnostic_ids
    });
  }
  let busy = false;
  function transact(operation, apply, expectedRevision) {
    if (busy) throw authorityError("REENTRANT_MUTATION");
    const current = read();
    if (expectedRevision === undefined) expectedRevision = current.run.revision;
    if (expectedRevision !== current.run.revision) throw authorityError("STALE_REVISION");
    const draft = deepClone(current);
    busy = true;
    try {
      const result = apply(draft);
      if (result && typeof result.then === "function") throw authorityError("ASYNC_COMMIT");
      draft.run.revision = current.run.revision + 1;
      for (const [id, active] of Object.entries(draft.active_attempts)) {
        if (!own(current.active_attempts, id)) active.dispatch_revision = draft.run.revision;
      }
      for (const event of draft.event_journal.slice(current.event_journal.length)) event.run_revision = draft.run.revision;
      capture(current, draft, operation);
      const detachedResult = result === undefined ? undefined : deepClone(result);
      const committed = commit({ expectedRevision, nextRegistry: draft, operation });
      if (!committed.ok) throw authorityError(committed.code);
      return detachedResult;
    } finally { busy = false; }
  }
  function install(args) {
    if (busy) throw authorityError("REENTRANT_MUTATION");
    const current = read();
    args = HostCommitRequest.assert(args);
    if (args.expectedRevision !== current.run.revision) return { ok: false, code: "STALE_REVISION" };
    // Trusted-host maintenance, still validated and coupled to evidence.
    const candidate = RegistryData.assert(args.nextRegistry);
    if (!sameData(candidate.event_journal, current.event_journal)) throw authorityError("INVALID_HISTORY");
    if (candidate.run.revision !== current.run.revision + 1) throw authorityError("STALE_REVISION");
    capture(current, candidate, "host_commit");
    busy = true;
    try { return commit({ expectedRevision: args.expectedRevision, nextRegistry: candidate, operation: "host_commit" }); }
    finally { busy = false; }
  }
  function close() {
    if (busy) throw authorityError("REENTRANT_MUTATION");
    retire();
  }
  return { read, transact, install, close };
}
