import { stableId } from "../utils/id.js";
import { authorityError, evaluateAuthority } from "./authorization.js";
import { ReconciliationRequest, ReconciliationRecord } from "../contracts/sigils.js";
import { appendRegistryEvent } from "./event-journal.js";

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])]));
  return value;
}
export function operationSignature(packet) {
  const copy = structuredClone(packet);
  delete copy.task_id; delete copy.source_spec_id;
  for (const key of ["operation_id", "authority_binding", "status", "created_at", "retry_count", "last_result"]) delete copy[key];
  if (copy.inputs?.spec) delete copy.inputs.spec.id;
  return JSON.stringify(ordered(copy));
}
export function admitOperation(registry, packet) {
  registry.operations ||= {};
  const signature = operationSignature(packet);
  if (Object.values(registry.operations).some(op => op.signature === signature) || Object.values(registry.tasks).some(t => t.task_id !== packet.task_id && operationSignature(t) === signature)) throw authorityError("OPERATION_EXISTS");
  const operation_id = stableId("operation");
  registry.operations[operation_id] = { operation_id, signature, task_id: packet.task_id, state: "requested", attempt_id: null, reconciliation_id: null };
  registry.tasks[packet.task_id].operation_id = operation_id;
}
export function operationFor(registry, taskId) {
  return registry.operations?.[registry.tasks[taskId]?.operation_id] || null;
}
export function reconcileTask(registry, raw, now) {
  const request = ReconciliationRequest.assert(raw);
  if (request.expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  const task = registry.tasks[request.task_id];
  const operation = operationFor(registry, request.task_id);
  if (!task || !["uncertain", "blocked", "cancelled"].includes(task.status) || !operation || operation.state !== "unknown") throw authorityError("INVALID_TRANSITION");
  const principal = registry.authority?.principals.find(p => p.principal_id === request.principal_id && p.kind === "human" && p.authenticated_at <= now && now < p.expires_at);
  if (!principal) throw authorityError("PRINCIPAL_INVALID");
  const permission = evaluateAuthority({ stage: "admit", now, run: registry.run, task: { ...task, status: "queued" }, authority: registry.authority });
  if (!permission.allowed) throw authorityError(permission.code);
  const required = { confirmed_completed: "receipt", confirmed_not_executed: "no_effect_confirmation", authorized_compensated: "compensation_receipt", still_unknown: "operator_review" };
  if (request.evidence.kind !== required[request.decision]) throw authorityError("INSUFFICIENT_EVIDENCE");
  const reconciliation_id = stableId("reconciliation");
  const record = ReconciliationRecord.assert({ reconciliation_id, operation_id: operation.operation_id, task_id: task.task_id, attempt_id: operation.attempt_id, principal_id: principal.principal_id, decision: request.decision, evidence: request.evidence, at: now });
  registry.reconciliations ||= {};
  registry.reconciliations[reconciliation_id] = record;
  operation.reconciliation_id = reconciliation_id;
  operation.state = { confirmed_completed: "confirmed", confirmed_not_executed: "not_executed", authorized_compensated: "compensated", still_unknown: "unknown" }[request.decision];
  if (task.status !== "cancelled" && ["confirmed_completed", "authorized_compensated"].includes(request.decision)) {
    task.status = request.decision === "confirmed_completed" ? "completed" : "cancelled";
    const entry = registry.task_queue.find(q => q.task_id === task.task_id); if (entry) entry.status = task.status;
    delete registry.pending_attempts[task.task_id]; delete registry.active_attempts[task.task_id];
  }
  appendRegistryEvent(registry, "effect_reconciled", { task_id: task.task_id, reconciliation_id, decision: request.decision });
  return record;
}
