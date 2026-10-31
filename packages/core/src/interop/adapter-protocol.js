import { CONTRACT_LIMITS, AdapterResult, TaskPacket } from '../contracts/sigils.js';
import { contract, id, uuid, uint, requireTrue } from '../coordination/contracts.js';

/**
 * Provider-neutral execution-adapter protocol.
 *
 * This module is pure: it defines and validates versioned wire contracts. It
 * never authenticates a participant, grants authority, schedules work or
 * commits canonical state. Adapter advertisements are descriptive only.
 */
export const ADAPTER_PROTOCOL_VERSION = 'chord.adapter-protocol.v1';
export const ADAPTER_DESCRIPTOR_VERSION = 'chord.adapter-descriptor.v1';
export const ADAPTER_CONTEXT_VERSION = 'chord.execution-context.v2';
export const ADAPTER_KINDS = Object.freeze(['tool', 'agent', 'service']);
export const ADAPTER_MESSAGE_TYPES = Object.freeze([
  'describe', 'describe_result',
  'execute', 'result', 'error',
  'cancel', 'cancel_result',
  'shutdown', 'shutdown_result'
]);

const versionString = value => requireTrue(typeof value === 'string' && value.length > 0 && value.length <= 128, 'INVALID_CONTEXT');
const uniqueStrings = values => {
  requireTrue(new Set(values).size === values.length, 'INVALID_SEMANTICS');
  values.forEach(versionString);
};

export const AdapterAdvertisement = contract(
  '{ protocol_version: "chord.adapter-descriptor.v1", adapter_id: string, adapter_kind: "tool" | "agent" | "service", supported_protocol_versions: string[], operations: string[], capabilities: string[], execution_context: "chord.execution-context.v2" | null, limits: { max_concurrent: number, timeout_ms: number | null } }',
  v => {
    id(v.adapter_id);
    requireTrue(v.supported_protocol_versions.length > 0, 'INVALID_CONTEXT');
    uniqueStrings(v.supported_protocol_versions);
    v.operations.forEach(id);
    v.capabilities.forEach(id);
    uint(v.limits.max_concurrent);
    requireTrue(v.limits.max_concurrent >= 1 && v.limits.max_concurrent <= 1024, 'INVALID_CONTEXT');
    if (v.limits.timeout_ms !== null) {
      uint(v.limits.timeout_ms);
      requireTrue(v.limits.timeout_ms >= 1 && v.limits.timeout_ms <= 2_147_483_647, 'INVALID_CONTEXT');
    }
  }
);

/** Descriptive compatibility only. A positive result is not an authority grant. */
export function adapterCompatibility(advertisement, { requiredOperations = [], requireExecutionContext = true } = {}) {
  const a = AdapterAdvertisement.assert(advertisement);
  if (!a.supported_protocol_versions.includes(ADAPTER_PROTOCOL_VERSION)) return { compatible: false, code: 'UNSUPPORTED_PROTOCOL' };
  if (requireExecutionContext && a.execution_context !== ADAPTER_CONTEXT_VERSION) return { compatible: false, code: 'UNSUPPORTED_EXECUTION_CONTEXT' };
  for (const operation of requiredOperations) {
    if (a.operations.length > 0 && !a.operations.includes(operation)) return { compatible: false, code: 'UNSUPPORTED_OPERATION' };
  }
  return { compatible: true, code: 'COMPATIBLE' };
}

export function assertAdapterCompatibility(advertisement, requirements) {
  const result = adapterCompatibility(advertisement, requirements);
  requireTrue(result.compatible, result.code);
  return result;
}

export const AdapterExecutionContext = contract(
  '{ protocol_version: "chord.execution-context.v2", run_id: string, incarnation_id: string, owner_id: string, generation: number, owner_lease_expires_at: number, dispatch_revision: number, operation_id: string, attempt_id: string, idempotency_key: string }',
  v => {
    id(v.run_id); uuid(v.incarnation_id); uuid(v.owner_id);
    uint(v.generation); requireTrue(v.generation > 0, 'INVALID_CONTEXT');
    uint(v.owner_lease_expires_at); uint(v.dispatch_revision);
    id(v.operation_id); id(v.attempt_id); id(v.idempotency_key);
    requireTrue(v.idempotency_key === JSON.stringify(['chord.effect.v1', v.incarnation_id, v.run_id, v.operation_id]), 'INVALID_CONTEXT');
  }
);

export const AdapterContext = contract(
  '{ run_id: string, schema_version: "chord.contracts.v1", task_id: string, task_revision: number, queue_id: string, attempt_id: string, lease_expires_at: number, coordination: object }',
  v => {
    id(v.run_id); id(v.task_id); id(v.queue_id); id(v.attempt_id);
    uint(v.task_revision); uint(v.lease_expires_at);
    const coordination = AdapterExecutionContext.assert(v.coordination);
    requireTrue(coordination.run_id === v.run_id && coordination.attempt_id === v.attempt_id, 'INVALID_CONTEXT');
  }
);

const executeShape = '{ protocol_version: "chord.adapter-protocol.v1", message_type: "execute", adapter_id: string, session_id: string, request_id: string, run_id: string, incarnation_id: string, task_id: string, task_revision: number, queue_id: string, attempt_id: string, operation_id: string, idempotency_key: string, deadline: number, packet: object, context: object }';
export const AdapterExecuteRequest = contract(executeShape, v => {
  id(v.adapter_id); uuid(v.session_id); uuid(v.request_id);
  id(v.run_id); uuid(v.incarnation_id); id(v.task_id); id(v.queue_id); id(v.attempt_id); id(v.operation_id); id(v.idempotency_key);
  uint(v.task_revision); uint(v.deadline);
  const packet = TaskPacket.assert(v.packet);
  const context = AdapterContext.assert(v.context);
  const coordination = AdapterExecutionContext.assert(context.coordination);
  requireTrue(packet.task_id === v.task_id && context.task_id === v.task_id, 'INVALID_CONTEXT');
  requireTrue(v.task_revision === context.task_revision && v.queue_id === context.queue_id, 'INVALID_CONTEXT');
  requireTrue(v.run_id === coordination.run_id && v.incarnation_id === coordination.incarnation_id, 'INVALID_CONTEXT');
  requireTrue(v.attempt_id === coordination.attempt_id && v.operation_id === coordination.operation_id, 'INVALID_CONTEXT');
  requireTrue(v.idempotency_key === coordination.idempotency_key, 'INVALID_CONTEXT');
  requireTrue(v.deadline > 0 && v.deadline <= coordination.owner_lease_expires_at, 'INVALID_CONTEXT');
});

const responseBase = 'protocol_version: "chord.adapter-protocol.v1", adapter_id: string, session_id: string, request_id: string';
export const AdapterResultResponse = contract(
  `{ ${responseBase}, message_type: "result", run_id: string, incarnation_id: string, task_id: string, attempt_id: string, operation_id: string, ok: true, result: object }`,
  v => {
    id(v.adapter_id); uuid(v.session_id); uuid(v.request_id);
    id(v.run_id); uuid(v.incarnation_id); id(v.task_id); id(v.attempt_id); id(v.operation_id);
    const result = AdapterResult.assert(v.result);
    requireTrue(result.task_id === undefined || result.task_id === v.task_id, 'INVALID_RESULT');
  }
);

export const AdapterErrorResponse = contract(
  `{ ${responseBase}, message_type: "error", task_id: string | null, attempt_id: string | null, operation_id: string | null, ok: false, code: string, classification: "rejected" | "unknown" }`,
  v => {
    id(v.adapter_id); uuid(v.session_id); uuid(v.request_id); id(v.code);
    for (const key of ['task_id', 'attempt_id', 'operation_id']) if (v[key] !== null) id(v[key]);
  }
);

export const AdapterDescribeRequest = contract(
  `{ protocol_version: "chord.adapter-protocol.v1", message_type: "describe", adapter_id: string, request_id: string }`,
  v => { id(v.adapter_id); uuid(v.request_id); }
);
export const AdapterDescribeResponse = contract(
  `{ protocol_version: "chord.adapter-protocol.v1", message_type: "describe_result", adapter_id: string, request_id: string, ok: true, advertisement: object }`,
  v => { id(v.adapter_id); uuid(v.request_id); AdapterAdvertisement.assert(v.advertisement); }
);

export const AdapterCancelRequest = contract(
  `{ protocol_version: "chord.adapter-protocol.v1", message_type: "cancel", adapter_id: string, session_id: string, request_id: string, target_request_id: string, task_id: string, attempt_id: string, operation_id: string }`,
  v => { id(v.adapter_id); uuid(v.session_id); uuid(v.request_id); uuid(v.target_request_id); id(v.task_id); id(v.attempt_id); id(v.operation_id); }
);
export const AdapterCancelResponse = contract(
  `{ protocol_version: "chord.adapter-protocol.v1", message_type: "cancel_result", adapter_id: string, session_id: string, request_id: string, target_request_id: string, ok: true, acknowledged: boolean }`,
  v => { id(v.adapter_id); uuid(v.session_id); uuid(v.request_id); uuid(v.target_request_id); }
);

export const AdapterShutdownRequest = contract(
  `{ protocol_version: "chord.adapter-protocol.v1", message_type: "shutdown", adapter_id: string, session_id: string, request_id: string }`,
  v => { id(v.adapter_id); uuid(v.session_id); uuid(v.request_id); }
);
export const AdapterShutdownResponse = contract(
  `{ protocol_version: "chord.adapter-protocol.v1", message_type: "shutdown_result", adapter_id: string, session_id: string, request_id: string, ok: true }`,
  v => { id(v.adapter_id); uuid(v.session_id); uuid(v.request_id); }
);

export function adapterError(code = 'ADAPTER_PROTOCOL_ERROR', classification = 'unknown', cause = null) {
  const normalized = typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'ADAPTER_PROTOCOL_ERROR';
  const error = new TypeError(normalized);
  error.code = normalized;
  error.classification = classification === 'rejected' ? 'rejected' : 'unknown';
  error.path = '$';
  if (cause) error.cause = cause;
  return error;
}

export function parseAdapterWire(wire) {
  requireTrue(typeof wire === 'string' && Buffer.byteLength(wire, 'utf8') <= CONTRACT_LIMITS.bytes, 'INVALID_ADAPTER_FRAME');
  try { return JSON.parse(wire); } catch { throw adapterError('INVALID_ADAPTER_FRAME', 'rejected'); }
}

export function validateAdapterExecuteRequest(raw, { advertisement = null } = {}) {
  const request = AdapterExecuteRequest.assert(raw);
  if (advertisement) {
    const a = AdapterAdvertisement.assert(advertisement);
    requireTrue(request.adapter_id === a.adapter_id, 'ADAPTER_ID_MISMATCH');
    assertAdapterCompatibility(a, { requireExecutionContext: true });
  }
  return request;
}

function matchIdentity(response, request) {
  requireTrue(response.adapter_id === request.adapter_id, 'ADAPTER_ID_MISMATCH');
  requireTrue(response.session_id === request.session_id, 'ADAPTER_SESSION_MISMATCH');
  requireTrue(response.request_id === request.request_id, 'ADAPTER_REQUEST_MISMATCH');
}

export function validateAdapterResponse(raw, request) {
  if (raw?.ok === true) {
    const response = AdapterResultResponse.assert(raw);
    matchIdentity(response, request);
    requireTrue(response.run_id === request.run_id && response.incarnation_id === request.incarnation_id, 'ADAPTER_IDENTITY_MISMATCH');
    requireTrue(response.task_id === request.task_id && response.attempt_id === request.attempt_id && response.operation_id === request.operation_id, 'ADAPTER_IDENTITY_MISMATCH');
    return response;
  }
  const response = AdapterErrorResponse.assert(raw);
  matchIdentity(response, request);
  for (const key of ['task_id', 'attempt_id', 'operation_id']) if (response[key] !== null) requireTrue(response[key] === request[key], 'ADAPTER_IDENTITY_MISMATCH');
  return response;
}

export function validateAdapterDescribeResponse(raw, request) {
  const response = AdapterDescribeResponse.assert(raw);
  requireTrue(response.adapter_id === request.adapter_id, 'ADAPTER_ID_MISMATCH');
  requireTrue(response.request_id === request.request_id, 'ADAPTER_REQUEST_MISMATCH');
  return response;
}

export function validateAdapterCancelResponse(raw, request) {
  const response = AdapterCancelResponse.assert(raw);
  requireTrue(response.adapter_id === request.adapter_id, 'ADAPTER_ID_MISMATCH');
  requireTrue(response.session_id === request.session_id, 'ADAPTER_SESSION_MISMATCH');
  requireTrue(response.request_id === request.request_id, 'ADAPTER_REQUEST_MISMATCH');
  requireTrue(response.target_request_id === request.target_request_id, 'ADAPTER_REQUEST_MISMATCH');
  return response;
}

export function validateAdapterShutdownResponse(raw, request) {
  const response = AdapterShutdownResponse.assert(raw);
  requireTrue(response.adapter_id === request.adapter_id, 'ADAPTER_ID_MISMATCH');
  requireTrue(response.session_id === request.session_id, 'ADAPTER_SESSION_MISMATCH');
  requireTrue(response.request_id === request.request_id, 'ADAPTER_REQUEST_MISMATCH');
  return response;
}

