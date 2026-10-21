import { RegistryData, HostCommitRequest } from "../contracts/sigils.js";
import { commitRun } from "./registry.js";
import { appendRegistryEvent } from "../platform/event-journal.js";
import { authorityError } from "../platform/authorization.js";
import { deepClone } from "../utils/clone.js";
import { canonicalProjection, stateChanges, sameData, HISTORY_VERSION } from "../platform/history.js";

// Private single-process owner. Never expose this object to a consumer/adapter.
export function createStateOwner(initial) {
  const owner = { registry: RegistryData.assert(initial) };
  if (owner.registry.event_journal.length === 0) appendRegistryEvent(owner.registry, "state_initialized", { history_version: HISTORY_VERSION, sequence: 0, state: canonicalProjection(owner.registry) });
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
  function transact(operation, apply, expectedRevision = owner.registry.run.revision) {
    if (busy) throw authorityError("REENTRANT_MUTATION");
    if (expectedRevision !== owner.registry.run.revision) throw authorityError("STALE_REVISION");
    const current = owner.registry;
    const draft = deepClone(current);
    busy = true;
    try {
      const result = apply(draft);
      if (result && typeof result.then === "function") throw authorityError("ASYNC_COMMIT");
      draft.run.revision = current.run.revision + 1;
      for (const [id, active] of Object.entries(draft.active_attempts)) {
        if (!current.active_attempts[id]) active.dispatch_revision = draft.run.revision;
      }
      for (const event of draft.event_journal.slice(current.event_journal.length)) event.run_revision = draft.run.revision;
      capture(current, draft, operation);
      const detachedResult = result === undefined ? undefined : deepClone(result);
      const committed = commitRun(owner, { expectedRevision, nextRegistry: draft, operation });
      if (!committed.ok) throw authorityError(committed.code);
      return detachedResult;
    } finally { busy = false; }
  }
  function install(args) {
    if (busy) throw authorityError("REENTRANT_MUTATION");
    args = HostCommitRequest.assert(args);
    if (args.expectedRevision !== owner.registry.run.revision) return { ok: false, code: "STALE_REVISION" };
    // Trusted-host maintenance, still validated and coupled to evidence.
    const candidate = RegistryData.assert(args.nextRegistry);
    if (!sameData(candidate.event_journal, owner.registry.event_journal)) throw authorityError("INVALID_HISTORY");
    if (candidate.run.revision !== owner.registry.run.revision + 1) throw authorityError("STALE_REVISION");
    capture(owner.registry, candidate, "host_commit");
    return commitRun(owner, { expectedRevision: args.expectedRevision, nextRegistry: candidate, operation: "host_commit" });
  }
  return { read: () => owner.registry, transact, install };
}
