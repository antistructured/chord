import { AuthoritySnapshot, Attempt, TaskAuthority, SCHEMA_VERSION } from "../contracts/sigils.js";

/** Pure authorization evaluator (041-authority-design.md §4).
 * Deterministic: identical inputs and `now` produce identical decisions.
 * No mutations, logging, I/O, randomness, or implicit time. Decisions are
 * data, never transferable permission tokens; the runtime recomputes them
 * from live snapshots and never accepts actor-supplied decisions.
 */

const STAGES = new Set(["admit", "dispatch", "commit"]);
const TASK_STATUSES = new Set(["queued", "leased", "running", "blocked", "completed", "failed", "cancelled", "uncertain", "dead_letter"]);

const deny = code => Object.freeze({ allowed: false, code, grant_ids: Object.freeze([]), approval_id: null });
const allow = (grantIds, approvalId) => ({ allowed: true, code: "ALLOW", grant_ids: [...grantIds].sort(), approval_id: approvalId });

const activeWindow = (record, now) => record.issued_at <= now && now < record.expires_at && record.revoked_at === null;
const codeSort = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function scopeEquals(a, b) {
  return a.run_id === b.run_id && a.project === b.project && a.phase === b.phase &&
    a.task_id === b.task_id && a.target_entity === b.target_entity &&
    a.resource.kind === b.resource.kind && a.resource.id === b.resource.id;
}

export function authorityError(code) {
  const error = new TypeError(String(code));
  error.code = error.message;
  error.path = "$";
  return error;
}

export function evaluateAuthority({ stage, now, run, task, attempt = null, authority }) {
  // 1. Context validity — invalid shapes/semantics, then version, then foreign run.
  if (!STAGES.has(stage) || !Number.isSafeInteger(now) || now < 0) return deny("INVALID_CONTEXT");
  if (!run || typeof run !== "object" || typeof run.run_id !== "string" || run.run_id === "" ||
    typeof run.schema_version !== "string" || !Number.isSafeInteger(run.revision) || run.revision < 0) return deny("INVALID_CONTEXT");
  if (run.schema_version !== SCHEMA_VERSION) return deny("SCHEMA_MISMATCH");
  if (!task || typeof task !== "object" || typeof task.task_id !== "string" || task.task_id === "" || !TASK_STATUSES.has(task.status) && task.status !== undefined) return deny("INVALID_CONTEXT");
  if (task.schema_version !== run.schema_version) return deny("SCHEMA_MISMATCH");
  if (typeof task.project !== "string" || typeof task.phase !== "string" || typeof task.target_entity !== "string") return deny("INVALID_CONTEXT");
  if (!authority) return deny("INVALID_CONTEXT");
  if (!AuthoritySnapshot.check(authority)) return deny("INVALID_CONTEXT");
  if (authority.schema_version !== run.schema_version) return deny("SCHEMA_MISMATCH");
  if (authority.run_id !== run.run_id) return deny("RUN_MISMATCH");
  const binding = task.authority_binding;
  if (!binding || !TaskAuthority.check(binding)) return deny("INVALID_CONTEXT");
  if (binding.scope.run_id !== run.run_id) return deny("RUN_MISMATCH");
  if (attempt !== null) {
    if (!Attempt.check(attempt)) return deny("INVALID_CONTEXT");
    if (attempt.run_id !== run.run_id) return deny("RUN_MISMATCH");
    if (attempt.schema_version !== run.schema_version) return deny("SCHEMA_MISMATCH");
  }
  if (stage === "admit" && attempt !== null) return deny("INVALID_CONTEXT");
  if (stage === "commit" && attempt === null) return deny("INVALID_CONTEXT");

  const taskRevision = task.task_revision ?? 0;

  // 2. Task/attempt state compatibility.
  if (task.status === "cancelled") return deny("TASK_CANCELLED");
  if (stage === "admit") {
    if (task.status !== undefined && task.status !== "queued") return deny("INVALID_TRANSITION");
  } else if (stage === "dispatch") {
    if (task.status !== "queued") return deny("INVALID_TRANSITION");
  } else {
    if (task.status !== "running") return deny("INVALID_TRANSITION");
    if (!(attempt.lease_expires_at > now)) return deny("STALE_ATTEMPT");
  }
  if (attempt !== null) {
    if (attempt.task_id !== task.task_id) return deny("STALE_ATTEMPT");
    if (attempt.task_revision !== taskRevision) return deny("STALE_ATTEMPT");
    // authority_revision is the commit guard: checked at commit, not dispatch
    // (installing an approval legitimately advances authority after prepare).
  }

  // 3. Principal, actor, capability (roles confer nothing).
  const principals = new Map(authority.principals.map(p => [p.principal_id, p]));
  const actors = new Map(authority.actors.map(a => [a.actor_id, a]));
  const principal = principals.get(binding.principal_id);
  if (!principal || !(principal.authenticated_at <= now && now < principal.expires_at)) return deny("PRINCIPAL_INVALID");
  const actor = actors.get(binding.actor_id);
  if (!actor || actor.principal_id !== binding.principal_id || actor.revoked_at !== null) return deny("ACTOR_INVALID");
  if (!actor.capabilities.includes(binding.capability)) return deny("CAPABILITY_MISSING");

  // 4. Scope equality against the immutable stored task/run fields.
  const expectedScope = {
    run_id: run.run_id,
    project: task.project,
    phase: task.phase,
    task_id: task.task_id,
    target_entity: task.target_entity,
    resource: { kind: "task", id: task.task_id }
  };
  if (!scopeEquals(binding.scope, expectedScope)) return deny("SCOPE_MISMATCH");

  // 5. Grants: active matching deny always wins; allow required.
  const matching = authority.grants.filter(g =>
    g.principal_id === binding.principal_id &&
    g.actor_id === binding.actor_id &&
    g.capability === binding.capability &&
    scopeEquals(g.scope, expectedScope) &&
    activeWindow(g, now));
  if (matching.some(g => g.effect === "deny")) return deny("EXPLICIT_DENY");
  const allows = matching.filter(g => g.effect === "allow");
  if (allows.length === 0) return deny("NO_ALLOW_GRANT");

  // 6. Approvals: exact active rejection wins; required approvals gate dispatch/commit.
  const bindingApprovals = authority.approvals.filter(a =>
    a.task_id === task.task_id &&
    a.task_revision === taskRevision &&
    a.principal_id === binding.principal_id &&
    a.actor_id === binding.actor_id &&
    a.capability === binding.capability &&
    scopeEquals(a.scope, expectedScope) &&
    activeWindow(a, now));
  const rejected = bindingApprovals.find(a => a.decision === "rejected") || null;
  const unconsumedApproved = bindingApprovals
    .filter(a => a.decision === "approved" && a.consumed_by_attempt_id === null)
    .sort((a, b) => codeSort(a.approval_id, b.approval_id));

  const approvalRequiredFrom = grantIds =>
    binding.approval_required || grantIds.some(id => allows.find(g => g.grant_id === id)?.requires_approval);

  if (stage === "admit") {
    // Permission only; the task may queue awaiting approval.
    return allow(allows.map(g => g.grant_id), null);
  }

  if (stage === "dispatch") {
    if (rejected) return deny("APPROVAL_REJECTED");
    if (!approvalRequiredFrom(allows.map(g => g.grant_id))) return allow(allows.map(g => g.grant_id), null);
    if (attempt === null) return deny("INVALID_CONTEXT");
    const exact = unconsumedApproved.filter(a => a.attempt_id === attempt.attempt_id);
    if (exact.length === 0) return deny("APPROVAL_REQUIRED");
    return allow(allows.map(g => g.grant_id), exact[0].approval_id);
  }

  // 7. Commit: only dispatch-selected grants/approval can authorize; nothing retroactively substitutes.
  if (attempt.authority_revision !== authority.authority_revision) return deny("STALE_ATTEMPT");
  for (const grantId of attempt.grant_ids) {
    const g = authority.grants.find(x => x.grant_id === grantId);
    if (!g || !activeWindow(g, now) || g.effect !== "allow" ||
      g.principal_id !== binding.principal_id || g.actor_id !== binding.actor_id ||
      g.capability !== binding.capability || !scopeEquals(g.scope, expectedScope)) return deny("NO_ALLOW_GRANT");
  }
  if (attempt.grant_ids.length === 0) return deny("NO_ALLOW_GRANT");
  const required = approvalRequiredFrom(attempt.grant_ids);
  const approvalId = attempt.approval_id;
  if (required) {
    if (rejected) return deny("APPROVAL_REJECTED");
    if (!approvalId) return deny("APPROVAL_REQUIRED");
    const approval = authority.approvals.find(x => x.approval_id === approvalId);
    if (!approval || !activeWindow(approval, now) || approval.decision !== "approved" || approval.attempt_id !== attempt.attempt_id) return deny("APPROVAL_REQUIRED");
    if (approval.consumed_by_attempt_id !== attempt.attempt_id) return deny(approval.consumed_by_attempt_id === null ? "APPROVAL_REQUIRED" : "STALE_ATTEMPT");
  } else if (approvalId !== null) {
    const approval = authority.approvals.find(x => x.approval_id === approvalId);
    if (!approval || approval.consumed_by_attempt_id !== attempt.attempt_id) return deny("STALE_ATTEMPT");
  }
  return allow(attempt.grant_ids, approvalId);
}
