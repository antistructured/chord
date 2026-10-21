import { deepClone } from "../utils/clone.js";
import { authorityError } from "./authorization.js";
import { appendRegistryEvent } from "./event-journal.js";
import { stableId } from "../utils/id.js";

/** Pause run pending approval (suspend). Blocks execution while pending. */
export function pauseForApproval(registry, { reason = "approval_required", expectedRevision, expires_at = null, correlation_id = null, causation_id = null } = {}) {
  if (!registry) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== undefined && expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  const prev = registry.run.state || "active";
  if (prev === "paused" || prev === "cancelled" || prev === "completed" || prev === "failed") throw authorityError("INVALID_TRANSITION");
  registry.run.state = "paused";
  if (correlation_id) registry.run.correlation_id = correlation_id;
  if (causation_id) registry.run.causation_id = causation_id;
  registry.approval_pause ||= { reason, expires_at, paused_at: Date.now() };
  registry.run.revision += 1;
  appendRegistryEvent(registry, "run_paused", { reason, expires_at, correlation_id, causation_id });
  return { ok: true, run_state: registry.run.state, previous: prev };
}

/** Resume after authorized approval. */
export function resumeRun(registry, { expectedRevision, correlation_id = null, causation_id = null, approval_id = null } = {}) {
  if (!registry) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== undefined && expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  const prev = registry.run.state || "active";
  if (prev !== "paused") throw authorityError("INVALID_TRANSITION");
  const pause = registry.approval_pause;
  if (pause?.expires_at !== null && pause?.expires_at < Date.now()) throw authorityError("EXPIRED");
  registry.run.state = "active";
  if (correlation_id) registry.run.correlation_id = correlation_id;
  if (causation_id) registry.run.causation_id = causation_id;
  registry.approval_pause = null;
  registry.run.revision += 1;
  appendRegistryEvent(registry, "run_resumed", { approval_id, correlation_id, causation_id });
  return { ok: true, run_state: registry.run.state, previous: prev };
}

/** Reject pending approval and fail run. */
export function rejectApproval(registry, { expectedRevision, reason = "rejected", correlation_id = null, causation_id = null } = {}) {
  if (!registry) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== undefined && expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  const prev = registry.run.state || "active";
  if (prev !== "paused") throw authorityError("INVALID_TRANSITION");
  registry.run.state = "failed";
  if (correlation_id) registry.run.correlation_id = correlation_id;
  if (causation_id) registry.run.causation_id = causation_id;
  registry.approval_pause = null;
  registry.run.revision += 1;
  appendRegistryEvent(registry, "run_failed", { reason: String(reason).slice(0, 64), correlation_id, causation_id });
  return { ok: true, run_state: registry.run.state, previous: prev };
}

/** Cancel run (authorized). */
export function cancelRun(registry, { expectedRevision, reason = "cancelled", correlation_id = null, causation_id = null } = {}) {
  if (!registry) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== undefined && expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  const prev = registry.run.state || "active";
  if (prev === "cancelled" || prev === "completed" || prev === "failed") throw authorityError("INVALID_TRANSITION");
  registry.run.state = "cancelled";
  if (correlation_id) registry.run.correlation_id = correlation_id;
  if (causation_id) registry.run.causation_id = causation_id;
  registry.approval_pause = null;
  // Cancel all non-terminal tasks
  for (const task of Object.values(registry.tasks || {})) {
    if (["completed","failed","cancelled"].includes(task.status)) continue;
    task.status = "cancelled";
  }
  for (const entry of registry.task_queue || []) {
    if (["completed","failed","cancelled"].includes(entry.status)) continue;
    entry.status = "cancelled";
  }
  delete registry.pending_attempts;
  delete registry.active_attempts;
  registry.pending_attempts = {};
  registry.active_attempts = {};
  registry.run.revision += 1;
  appendRegistryEvent(registry, "run_cancelled", { reason: String(reason).slice(0, 64), correlation_id, causation_id });
  return { ok: true, run_state: registry.run.state, previous: prev };
}
