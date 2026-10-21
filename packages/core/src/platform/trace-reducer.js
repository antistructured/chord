import { deepClone } from "../utils/clone.js";
import { authorityError } from "./authorization.js";
import { JournalRecord, RegistryData, HistoryCommit, HistoryGenesis, SCHEMA_VERSION } from "../contracts/sigils.js";
import { applyChanges, sameData } from "./history.js";
import { assertCanonicalTransition } from "./state-invariants.js";

// Reducer consumes committed facts only; no clocks, adapters or executables.
export function reduceTrace(events = [], initialState = null) {
  if (!Array.isArray(events) || !events.length || initialState !== null) throw authorityError("UNSUPPORTED_HISTORY");
  let state, previous, revision, runId;
  const seen = new Set(); const journal = []; let pending = [];
  for (const raw of events) {
    const event = JournalRecord.assert(raw);
    if (seen.has(event.event_id)) throw authorityError("INVALID_SEMANTICS");
    seen.add(event.event_id);
    if (event.schema_version !== SCHEMA_VERSION) throw authorityError("UNSUPPORTED_HISTORY");
    if (!state) {
      if (event.type !== "state_initialized") throw authorityError("UNSUPPORTED_HISTORY");
      const genesis = HistoryGenesis.assert(event.payload);
      state = deepClone(genesis.state); revision = state.run.revision; runId = state.run.run_id;
      if (event.run_id !== runId || event.run_revision !== revision) throw authorityError("INVALID_HISTORY");
      previous = event;
    } else {
      if (event.run_id !== runId) throw authorityError("RUN_MISMATCH");
      if (event.run_revision < revision) throw authorityError("STALE_REVISION");
      if (event.type === "state_initialized") throw authorityError("INVALID_HISTORY");
      if (event.type === "state_committed") {
        const commit = HistoryCommit.assert(event.payload);
        if (commit.sequence !== previous.payload.sequence + 1 || commit.previous_commit_id !== previous.event_id || commit.previous_revision !== revision || event.run_revision !== revision + 1 || !sameData(commit.diagnostic_ids, pending.map(e => e.event_id))) throw authorityError("INCOMPLETE_HISTORY");
        const next = applyChanges(state, commit.changes);
        if (next.run.run_id !== runId || next.run.revision !== event.run_revision) throw authorityError("INVALID_HISTORY");
        assertCanonicalTransition(state, next, commit.operation);
        RegistryData.assert({ ...next, event_journal: [] });
        state = next; revision = event.run_revision; previous = event; pending = [];
      } else {
        const supported = new Set(["authority_snapshot_set", "grants_installed", "spec_registered", "task_enqueued", "task_cancelled", "task_replayed", "run_paused", "run_resumed", "run_failed", "run_cancelled", "handoff_proposed", "handoff_accepted", "handoff_rejected", "runtime_cycle_skipped", "dispatch_deferred", "task_retry_scheduled", "dispatch_denied", "task_dispatched", "task_uncertain", "task_result_ignored", "commit_rejected", "task_result_ingested", "runtime_cycle_completed", "effect_reconciled"]);
        if (!supported.has(event.type) || event.run_revision !== revision + 1) throw authorityError("UNSUPPORTED_HISTORY");
        pending.push(event);
      }
    }
    journal.push(event);
  }
  if (pending.length) throw authorityError("INCOMPLETE_HISTORY");
  return RegistryData.assert({ ...state, event_journal: journal });
}
export function replayNoSideEffects(events = []) {
  return { ok: true, projected: reduceTrace(events), effects_invoked: 0 };
}
export function diffTraces(a = [], b = []) {
  const idsA = new Set(a.map(e => e.event_id)), idsB = new Set(b.map(e => e.event_id));
  return { missingInB: a.filter(e => !idsB.has(e.event_id)).map(e => e.event_id), missingInA: b.filter(e => !idsA.has(e.event_id)).map(e => e.event_id), equal: sameData(a, b) };
}
