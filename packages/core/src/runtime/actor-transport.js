import { CONTRACT_LIMITS } from '../contracts/sigils.js';
import { contract, uuid, id, requireTrue, SuccessResponse, validateCommandResult } from '../coordination/contracts.js';

// Delivery identity is ephemeral, never authority or durable command identity.
export const RequestFrame = contract('{ protocol_version: "chord.actor-ipc-request.v1", session_id: string, request_id: string, command: object }', v => { uuid(v.session_id); uuid(v.request_id); });
export const ResponseFrame = contract('{ protocol_version: "chord.actor-ipc-response.v1", session_id: string, request_id: string, response: object }', v => { uuid(v.session_id); uuid(v.request_id); });
export const RejectionResponse = contract('{ protocol_version: "chord.actor-response.v1", operation_id: string | null, correlation_id: string | null, causation_id: string | null, ok: false, code: string, commit_status: "not_committed" | "unknown" }', v => {
  id(v.code);
  if (v.operation_id === null) requireTrue(v.correlation_id === null && v.causation_id === null);
  else { id(v.operation_id); for (const k of ['correlation_id','causation_id']) if (v[k] !== null) id(v[k]); }
});
export function parseActorWire(wire) {
  requireTrue(typeof wire === 'string' && Buffer.byteLength(wire,'utf8') <= CONTRACT_LIMITS.bytes,'INVALID_ACTOR_FRAME');
  return JSON.parse(wire);
}
export function validateActorResponse(raw, command) {
  const response = raw?.ok === true ? SuccessResponse.assert(raw) : RejectionResponse.assert(raw);
  const keys = response.ok ? ['operation_id','run_id','incarnation_id','correlation_id','causation_id'] : response.operation_id === null ? [] : ['operation_id','correlation_id','causation_id'];
  for (const key of keys) requireTrue(response[key] === command[key],'INVALID_ACTOR_RESPONSE');
  if (response.ok) validateCommandResult(command.type,response.result);
  return response;
}
