import { Sigil } from "@weipertda/sigiljs";

export const SCHEMA_VERSION = "chord.contracts.v1";
export const CONTRACT_LIMITS = Object.freeze({ bytes: 1_048_576, depth: 32, string: 16_384, array: 1024, keys: 256, nodes: 16_384, id: 256 });
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const errorCodes = ["INVALID_DATA", "LIMIT_EXCEEDED", "INVALID_SHAPE", "INVALID_SEMANTICS", "INVALID_RESULT", "ADAPTER_ERROR", "SCHEMA_MISMATCH"];
export function contractError(code = "INVALID_DATA") {
  const error = new TypeError(errorCodes.includes(code) ? code : "INVALID_DATA");
  error.code = error.message;
  error.path = "$";
  return error;
}
const fail = (code = "INVALID_SEMANTICS") => { throw contractError(code); };

/** Inspect descriptors before reading values: never evaluate submitted accessors.
 * Proxies are not an isolation boundary; callers supplying JS objects are trusted
 * to provide ordinary objects (JSON is the external transport).
 */
export function clonePlainData(value) {
  const ancestors = new Set();
  let nodes = 0;
  function visit(v, depth) {
    if (++nodes > CONTRACT_LIMITS.nodes || depth > CONTRACT_LIMITS.depth) fail("LIMIT_EXCEEDED");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (v.length > CONTRACT_LIMITS.string) fail("LIMIT_EXCEEDED");
      return v;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) fail("INVALID_DATA");
      return v;
    }
    if (typeof v !== "object" || ancestors.has(v)) fail("INVALID_DATA");
    const array = Array.isArray(v);
    const proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail("INVALID_DATA");
    const descriptors = Object.getOwnPropertyDescriptors(v);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(k => typeof k !== "string" || forbidden.has(k))) fail("INVALID_DATA");
    const length = array ? descriptors.length?.value : 0;
    if (array && (!Number.isSafeInteger(length) || length > CONTRACT_LIMITS.array)) fail("LIMIT_EXCEEDED");
    if (!array && keys.length > CONTRACT_LIMITS.keys) fail("LIMIT_EXCEEDED");
    if (array && keys.length !== length + 1) fail("INVALID_DATA");
    ancestors.add(v);
    const out = array ? [] : {};
    for (const key of keys) {
      if (array && key === "length") continue;
      const d = descriptors[key];
      if (!Object.hasOwn(d, "value") || !d.enumerable) fail("INVALID_DATA");
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) fail("INVALID_DATA");
      out[key] = visit(d.value, depth + 1);
    }
    ancestors.delete(v);
    return out;
  }
  try {
    const copy = visit(value, 0);
    if (new TextEncoder().encode(JSON.stringify(copy)).length > CONTRACT_LIMITS.bytes) fail("LIMIT_EXCEEDED");
    return copy;
  } catch (error) {
    // Never expose proxy/library/input diagnostics.
    throw contractError(error instanceof TypeError && errorCodes.includes(error.message) ? error.message : "INVALID_DATA");
  }
}
const id = v => typeof v === "string" && v.length > 0 && v.length <= CONTRACT_LIMITS.id && v.trim() === v && !/[\u0000-\u001f\u007f*]/u.test(v) && !forbidden.has(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const ids = values => values.every(id) && new Set(values).size === values.length;
const requireTrue = condition => { if (!condition) fail(); };
const windowValid = v => requireTrue(v.issued_at < v.expires_at);
const scopeCheck = v => {
  requireTrue([v.run_id, v.project, v.phase, v.task_id, v.target_entity, v.resource.id].every(id));
  if (v.resource.kind === "task") requireTrue(v.resource.id === v.task_id);
};
function semanticWalk(v, key = "") {
  if (v === null) return;
  if (Array.isArray(v)) { v.forEach(x => semanticWalk(x)); return; }
  if (typeof v === "object") {
    for (const [k, x] of Object.entries(v)) semanticWalk(x, k);
    return;
  }
  if (key.endsWith("_id") || ["issuer", "capability", "project", "phase", "target_entity"].includes(key)) requireTrue(id(v));
  if (key.endsWith("_at") || key.endsWith("_revision") || key === "revision") requireTrue(integer(v));
}
function define(shape, semantics = () => {}, options = {}) {
  const schema = Sigil.exact`${shape}`.version(SCHEMA_VERSION);
  const assert = value => {
    const copy = clonePlainData(value);
    try {
      if (!schema.check(copy)) fail("INVALID_SHAPE");
      if (options.walk !== false) semanticWalk(copy);
      semantics(copy);
      return copy;
    } catch (error) {
      throw contractError(error instanceof TypeError && errorCodes.includes(error.message) ? error.message : "INVALID_SEMANTICS");
    }
  };
  return Object.freeze({ schema, assert, check(value) { try { assert(value); return true; } catch { return false; } } });
}
const version = 'schema_version: "chord.contracts.v1"';
const scope = '{ run_id: string, project: string, phase: string, task_id: string, target_entity: string, resource: { kind: "task" | "artifact" | "domain", id: string } }';
const principal = '{ principal_id: string, issuer: string, kind: "human" | "service", authenticated_at: number, expires_at: number }';
const actor = '{ actor_id: string, principal_id: string, kind: "human" | "agent" | "service", roles: string[], capabilities: string[], revoked_at: number | null }';
const grant = `{ grant_id: string, principal_id: string, actor_id: string, capability: string, effect: "allow" | "deny", scope: ${scope}, issued_at: number, expires_at: number, revoked_at: number | null, requires_approval: boolean }`;
const approval = `{ approval_id: string, approver_principal_id: string, decision: "approved" | "rejected", run_id: string, ${version}, task_id: string, task_revision: number, attempt_id: string, principal_id: string, actor_id: string, capability: string, scope: ${scope}, issued_at: number, expires_at: number, revoked_at: number | null, consumed_by_attempt_id: string | null }`;
export const Run = define(`{ run_id: string, ${version}, revision: number }`);
export const Principal = define(principal, v => requireTrue(v.authenticated_at < v.expires_at));
export const Scope = define(scope, scopeCheck);
export const Actor = define(actor, v => requireTrue(ids(v.roles) && ids(v.capabilities)));
export const Grant = define(grant, v => { windowValid(v); scopeCheck(v.scope); });
const taskAuthorityShape = '{ principal_id: string, actor_id: string, capability: string, scope: ' + scope + ', approval_required: boolean }';
export const TaskAuthority = define(taskAuthorityShape, v => scopeCheck(v.scope));
export const Approval = define(approval, v => {
  windowValid(v); scopeCheck(v.scope);
  requireTrue(v.run_id === v.scope.run_id && v.task_id === v.scope.task_id && v.approver_principal_id !== v.principal_id);
  requireTrue(v.consumed_by_attempt_id === null || v.consumed_by_attempt_id === v.attempt_id);
});
export const AuthoritySnapshot = define(`{ ${version}, run_id: string, authority_revision: number, principals: ${principal}[], actors: ${actor}[], grants: ${grant}[], approvals: ${approval}[] }`, v => {
  const groups = [["principals", "principal_id", Principal], ["actors", "actor_id", Actor], ["grants", "grant_id", Grant], ["approvals", "approval_id", Approval]];
  for (const [group, key, contract] of groups) {
    requireTrue(ids(v[group].map(x => x[key])));
    v[group].forEach(x => contract.assert(x));
  }
  const principals = new Map(v.principals.map(x => [x.principal_id, x]));
  const actors = new Map(v.actors.map(x => [x.actor_id, x]));
  v.actors.forEach(x => requireTrue(principals.has(x.principal_id)));
  for (const x of [...v.grants, ...v.approvals]) {
    requireTrue(actors.get(x.actor_id)?.principal_id === x.principal_id && x.scope.run_id === v.run_id);
  }
  v.approvals.forEach(x => requireTrue(principals.get(x.approver_principal_id)?.kind === "human" && x.run_id === v.run_id));
});
export const Attempt = define(`{ run_id: string, ${version}, task_id: string, task_revision: number, queue_id: string, attempt_id: string, lease_expires_at: number, authority_revision: number, grant_ids: string[], approval_id: string | null }`, v => requireTrue(ids(v.grant_ids)));
export const DECISION_CODES = Object.freeze(["INVALID_CONTEXT", "SCHEMA_MISMATCH", "RUN_MISMATCH", "TASK_CANCELLED", "INVALID_TRANSITION", "STALE_ATTEMPT", "PRINCIPAL_INVALID", "ACTOR_INVALID", "CAPABILITY_MISSING", "SCOPE_MISMATCH", "EXPLICIT_DENY", "NO_ALLOW_GRANT", "APPROVAL_REJECTED", "APPROVAL_REQUIRED", "ALLOW"]);
export const Decision = define('{ allowed: boolean, code: string, grant_ids: string[], approval_id: string | null }', v => {
  requireTrue(DECISION_CODES.includes(v.code) && ids(v.grant_ids));
  requireTrue(v.allowed ? v.code === "ALLOW" && v.grant_ids.length > 0 : v.code !== "ALLOW" && v.grant_ids.length === 0 && v.approval_id === null);
});
export const ErrorContract = define('{ code: string, path: "$" }', v => requireTrue(errorCodes.includes(v.code)));

// Descriptive request contracts: authority maps/roles here confer no permission.
const common = `${version}, id?: string, project: string, phase: string, version?: string, goal?: string, intent?: string, role?: string, stance?: string, target_entity?: string, entity?: string[], do?: string[], dont?: string[], verify?: string[], stop?: string[], files?: string[], rules?: string[], depends?: string[], state?: object, authority?: object, assign?: string[], artifact?: string, from?: string, to?: string[], handoff?: string[], evidence?: string[], assumptions?: string[], blockers?: string[], requested_action?: string[], status?: "submitted" | "accepted" | "complete" | "rejected" | "superseded"`;
const specSemantics = v => {
  if (v.id !== undefined) requireTrue(id(v.id));
  for (const key of ["state", "authority"]) if (v[key]) {
    for (const [k, val] of Object.entries(v[key])) requireTrue(id(k) && id(val));
  }
  for (const key of ["do", "requested_action"]) if (v[key]) requireTrue(v[key].every(x => x.trim().length > 0));
};
export const Intent = define(`{ spec_type: "IntentSpec", ${common} }`, v => { specSemantics(v); requireTrue(v.do?.length > 0); });
export const Coord = define(`{ spec_type: "CoordSpec", ${common} }`, specSemantics);
export const Handoff = define(`{ spec_type: "HandoffSpec", ${common} }`, v => { specSemantics(v); requireTrue(id(v.artifact) && id(v.from) && v.to?.length > 0 && ids(v.to) && v.requested_action?.length > 0); });
export function assertSpec(value) {
  const copy = clonePlainData(value);
  const contract = { IntentSpec: Intent, CoordSpec: Coord, HandoffSpec: Handoff }[copy?.spec_type];
  if (!contract || !Object.hasOwn({ IntentSpec: 1, CoordSpec: 1, HandoffSpec: 1 }, copy.spec_type)) fail("INVALID_SHAPE");
  return contract.assert(copy);
}
const packetFields = `${version}, task_id: string, task_kind: "intent_execution" | "handoff_review", source_type: "IntentSpec" | "HandoffSpec", source_spec_id: string | null, project: string, phase: string, target_entity: string, role: string, stance: string, requested_action: string[], inputs: object, constraints: object`;
export const TaskPacket = define(`{ ${packetFields} }`, v => {
  requireTrue(v.requested_action.length > 0 && v.requested_action.every(x => x.trim().length > 0));
  const intent = v.task_kind === "intent_execution";
  requireTrue(v.source_type === (intent ? "IntentSpec" : "HandoffSpec"));
  const inputs = intent ? IntentInputs.assert(v.inputs) : HandoffInputs.assert(v.inputs);
  if (intent) assertSpec(inputs.spec);
  (intent ? IntentConstraints : HandoffConstraints).assert(v.constraints);
});
const IntentInputs = define('{ spec: object, files: string[], verify: string[], stop: string[] }');
const HandoffInputs = define('{ artifact: string, evidence: string[], assumptions: string[], blockers: string[] }', v => requireTrue(id(v.artifact)));
const IntentConstraints = define('{ dont: string[], rules: string[], depends: string[] }');
const HandoffConstraints = define('{ authority: object }', v => specSemantics(v));
// Transitional result contract until pass 4 supplies attempt correlation at dispatch.
const resultFields = 'task_id: string, status: "completed" | "failed" | "blocked", outcome: "succeeded" | "failed" | "blocked", summary?: string, outputs?: object, artifact?: string, domain?: string';
const resultSemantics = v => {
  requireTrue(({ completed: "succeeded", failed: "failed", blocked: "blocked" })[v.status] === v.outcome);
  for (const key of ["artifact", "domain"]) if (v[key] !== undefined) requireTrue(id(v[key]));
};
export const ExecutionResult = define(`{ ${resultFields} }`, resultSemantics);
export const AdapterResult = define(`{ task_id?: string, status: "completed" | "failed" | "blocked", outcome: "succeeded" | "failed" | "blocked", summary?: string, outputs?: object, artifact?: string, domain?: string }`, resultSemantics);
export const Outcome = define(`{ ${resultFields}, run_id: string, ${version}, task_revision: number, queue_id: string, attempt_id: string }`, resultSemantics);
export const RuntimePolicy = define('{ globalMaxLeased: number, perEntityMaxLeased: number, retry: { strategy: "fixed" | "linear" | "exponential", baseDelayMs: number, maxAttempts: number } }', v => {
  requireTrue([v.globalMaxLeased, v.perEntityMaxLeased, v.retry.baseDelayMs, v.retry.maxAttempts].every(integer));
  requireTrue(v.globalMaxLeased >= 1 && v.globalMaxLeased <= 1024 && v.perEntityMaxLeased >= 1 && v.perEntityMaxLeased <= v.globalMaxLeased);
  requireTrue(v.retry.baseDelayMs <= 86_400_000 && v.retry.maxAttempts >= 1 && v.retry.maxAttempts <= 32);
});
export const RuntimePolicyInput = define('{ globalMaxLeased?: number, perEntityMaxLeased?: number, retry?: { strategy?: "fixed" | "linear" | "exponential", baseDelayMs?: number, maxAttempts?: number } }');
// Current registry shape; transition legality and atomic restore remain pass 5.
export const RegistryData = define(`{ run: { run_id: string, ${version}, revision: number }, artifacts: object, domains: object, tasks: object, task_queue: object[], event_journal: object[], execution_results: object[], trigger_state: object, specs: object[], authority: object | null, pending_attempts: object }`, v => {
  for (const [key, record] of Object.entries(v.tasks)) {
    requireTrue(id(key));
    const task = StoredTask.assert(record);
    requireTrue(key === task.task_id);
  }
  for (const [key, record] of Object.entries(v.artifacts)) { ArtifactRecord.assert(record); requireTrue(id(key) && key === record.name); }
  for (const [key, record] of Object.entries(v.domains)) { DomainRecord.assert(record); requireTrue(id(key) && key === record.name); }
  for (const [key, value] of Object.entries(v.trigger_state)) requireTrue(id(key) && typeof value === "boolean");
  v.specs.forEach(assertSpec);
  v.execution_results.forEach(assertExecutionResult);
  v.task_queue.forEach(x => { QueueRecord.assert(x); requireTrue(Object.hasOwn(v.tasks, x.task_id)); });
  requireTrue(ids(v.task_queue.map(x => x.queue_id)));
  v.event_journal.forEach(x => JournalRecord.assert(x));
  requireTrue(ids(v.event_journal.map(x => x.event_id)));
  if (v.authority !== null) { AuthoritySnapshot.assert(v.authority); requireTrue(v.authority.run_id === v.run.run_id); }
  requireTrue(ids(Object.keys(v.pending_attempts)));
  for (const [key, record] of Object.entries(v.pending_attempts)) {
    const attempt = Attempt.assert(record);
    requireTrue(key === attempt.task_id && Object.hasOwn(v.tasks, key) && v.tasks[key].status === "queued");
  }
});
const StoredTask = define(`{ ${packetFields}, authority_binding: ${taskAuthorityShape}, status: "queued" | "leased" | "running" | "blocked" | "completed" | "failed" | "cancelled" | "uncertain" | "dead_letter", created_at: number, retry_count: number, last_result?: object }`, v => {
  const { status, created_at, retry_count, last_result, authority_binding, ...packet } = v;
  TaskPacket.assert(packet); requireTrue(integer(retry_count));
  TaskAuthority.assert(authority_binding);
  requireTrue(authority_binding.scope.task_id === v.task_id && authority_binding.scope.project === v.project && authority_binding.scope.phase === v.phase && authority_binding.scope.target_entity === v.target_entity);
  if (last_result) { ExecutionResult.assert(last_result); requireTrue(last_result.task_id === v.task_id); }
});
const QueueRecord = define('{ queue_id: string, task_id: string, target_entity: string, status: "queued" | "leased" | "running" | "blocked" | "completed" | "failed" | "cancelled" | "uncertain" | "dead_letter", priority: number, available_at: number, lease_expires_at: number | null, max_attempts: number, retry_count: number, last_error: string | null }', v => requireTrue(Number.isSafeInteger(v.priority) && integer(v.max_attempts) && v.max_attempts > 0 && integer(v.retry_count)));
const JournalRecord = define('{ event_id: string, type: string, at: number, payload: object }', v => requireTrue(integer(v.at) && id(v.type)));
const ArtifactRecord = define('{ name: string, status: "declared" | "produced" | "accepted" | "rejected" | "superseded", producers: string[], consumers: string[], project: string, phase: string, history: { from: string | null, to: string, at: number }[] }', v => { requireTrue(id(v.name) && ids(v.producers) && ids(v.consumers)); v.history.forEach(x => requireTrue(integer(x.at))); });
const DomainRecord = define('{ name: string, owner: string | null, delegates: string[], state: string, project: string, phase: string, state_history: { to: string, at: number }[] }', v => { requireTrue(id(v.name) && ids(v.delegates)); v.state_history.forEach(x => requireTrue(integer(x.at))); });
// A validated snapshot is data, not authenticated authority.

// walk disabled: created_at is an ISO string validated explicitly below; nested records are fully asserted.
export const Snapshot = define(`{ snapshot_type: "chord.registry", snapshot_version: "0.3.0", ${version}, run: { run_id: string, ${version}, revision: number }, created_at: string, counts: { artifacts: number, domains: number, tasks: number, queued_tasks: number, journal_events: number }, registry: object }`, v => {
  requireTrue(Object.values(v.counts).every(integer) && Number.isFinite(Date.parse(v.created_at)));
  RegistryData.assert(v.registry);
  requireTrue(v.run.run_id === v.registry.run.run_id && v.run.revision === v.registry.run.revision);
  requireTrue(v.counts.artifacts === Object.keys(v.registry.artifacts).length && v.counts.domains === Object.keys(v.registry.domains).length && v.counts.tasks === Object.keys(v.registry.tasks).length && v.counts.queued_tasks === v.registry.task_queue.length && v.counts.journal_events === v.registry.event_journal.length);
}, { walk: false });
export const assertTaskPacket = value => TaskPacket.assert(value);
export const assertExecutionResult = value => ExecutionResult.assert(value);
export function assertObject(value) {
  const copy = clonePlainData(value);
  if (!copy || typeof copy !== "object" || Array.isArray(copy)) fail("INVALID_SHAPE");
  return copy;
}
export function assertAdapter(adapter) {
  // Host executable, intentionally not a serializable contract.
  if (!adapter || typeof adapter.execute !== "function") fail("INVALID_SHAPE");
  return adapter;
}
