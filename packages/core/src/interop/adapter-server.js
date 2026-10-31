import { AdapterResult } from '../contracts/sigils.js';
import { AdapterAdvertisement, AdapterCancelRequest, AdapterCancelResponse, AdapterDescribeRequest, AdapterDescribeResponse, AdapterErrorResponse, AdapterExecuteRequest, AdapterResultResponse, AdapterShutdownRequest, AdapterShutdownResponse, ADAPTER_PROTOCOL_VERSION, adapterError, assertAdapterCompatibility, parseAdapterWire, validateAdapterExecuteRequest } from './adapter-protocol.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID = /^[^\u0000-\u001f\u007f*]+$/u;
const maybeId = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value && ID.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value) ? value : null;
const maybeUuid = value => typeof value === 'string' && UUID.test(value) ? value : null;
const normalizeCode = value => typeof value === 'string' && /^[A-Z0-9_]{1,64}$/.test(value) ? value : 'ADAPTER_ERROR';

/**
 * Participant-side adapter server. It validates protocol envelopes and calls
 * the participant's handler. It is not a scheduler, authority evaluator or
 * canonical store. `idempotency` deduplicates successful effects by the
 * kernel-supplied stable effect key; it does not make the kernel's commit
 * atomic with the physical effect.
 */
export function createAdapterServer({ advertisement, handle, channel = process, idempotency = true, onCancel = null, onShutdown = null } = {}) {
  if (typeof handle !== 'function') throw new TypeError('INVALID_ADAPTER_HANDLER');
  const ad = AdapterAdvertisement.assert(advertisement);
  assertAdapterCompatibility(ad, { requireExecutionContext: true });
  if (!channel || typeof channel.on !== 'function' || typeof channel.off !== 'function' || typeof channel.send !== 'function') throw new TypeError('INVALID_ADAPTER_TRANSPORT');
  const active = new Map(), cache = new Map();
  const stats = { executions: 0, deduplicated: 0, cancellations: 0, shutdowns: 0, protocol_errors: 0 };
  let closed = false;

  function send(response) {
    if (closed || channel.connected === false) return;
    try { channel.send(JSON.stringify(response), () => {}); } catch {}
  }
  function protocolError(raw, code = 'ADAPTER_PROTOCOL_ERROR') {
    const session = maybeUuid(raw?.session_id), request = maybeUuid(raw?.request_id);
    if (!session || !request) return;
    stats.protocol_errors++;
    const response = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'error', adapter_id: ad.adapter_id, session_id: session, request_id: request, task_id: maybeId(raw?.task_id), attempt_id: maybeId(raw?.attempt_id), operation_id: maybeId(raw?.operation_id), ok: false, code: normalizeCode(code), classification: 'rejected' };
    try { send(AdapterErrorResponse.assert(response)); } catch {}
  }
  function resultResponse(request, result) {
    return AdapterResultResponse.assert({ protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'result', adapter_id: ad.adapter_id, session_id: request.session_id, request_id: request.request_id, run_id: request.run_id, incarnation_id: request.incarnation_id, task_id: request.task_id, attempt_id: request.attempt_id, operation_id: request.operation_id, ok: true, result });
  }
  function errorResponse(request, error) {
    return AdapterErrorResponse.assert({ protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'error', adapter_id: ad.adapter_id, session_id: request.session_id, request_id: request.request_id, task_id: request.task_id, attempt_id: request.attempt_id, operation_id: request.operation_id, ok: false, code: normalizeCode(error?.code), classification: error?.classification === 'rejected' ? 'rejected' : 'unknown' });
  }

  async function execute(raw) {
    if (raw?.protocol_version !== ADAPTER_PROTOCOL_VERSION) { protocolError(raw, 'UNSUPPORTED_PROTOCOL'); return; }
    if (raw?.adapter_id !== ad.adapter_id) { protocolError(raw, 'ADAPTER_ID_MISMATCH'); return; }
    let request;
    try { request = validateAdapterExecuteRequest(raw, { advertisement: ad }); }
    catch (error) { protocolError(raw, error?.code || 'ADAPTER_PROTOCOL_ERROR'); return; }
    const key = request.idempotency_key;
    if (idempotency && cache.has(key)) {
      stats.deduplicated++;
      send(resultResponse(request, cache.get(key)));
      return;
    }
    active.set(request.request_id, request);
    let result;
    try {
      result = AdapterResult.assert(await handle(request));
      if (result.task_id !== undefined && result.task_id !== request.task_id) throw adapterError('INVALID_RESULT', 'rejected');
    } catch (error) {
      active.delete(request.request_id);
      send(errorResponse(request, error));
      return;
    }
    active.delete(request.request_id);
    stats.executions++;
    if (idempotency) cache.set(key, result);
    send(resultResponse(request, result));
  }

  function cancel(raw) {
    let request;
    try { request = AdapterCancelRequest.assert(raw); }
    catch (error) { protocolError(raw, error?.code || 'ADAPTER_PROTOCOL_ERROR'); return; }
    if (request.adapter_id !== ad.adapter_id) { protocolError(raw, 'ADAPTER_ID_MISMATCH'); return; }
    const target = active.get(request.target_request_id) || null;
    const acknowledged = target !== null;
    stats.cancellations++;
    if (target && typeof onCancel === 'function') {
      try { onCancel(target); } catch {}
    }
    send(AdapterCancelResponse.assert({ protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'cancel_result', adapter_id: ad.adapter_id, session_id: request.session_id, request_id: request.request_id, target_request_id: request.target_request_id, ok: true, acknowledged }));
  }

  function describe(raw) {
    let request;
    try { request = AdapterDescribeRequest.assert(raw); }
    catch (error) { return; }
    if (request.adapter_id !== ad.adapter_id) return;
    send(AdapterDescribeResponse.assert({ protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'describe_result', adapter_id: ad.adapter_id, request_id: request.request_id, ok: true, advertisement: ad }));
  }

  function shutdown(raw) {
    let request;
    try { request = AdapterShutdownRequest.assert(raw); }
    catch (error) { return; }
    if (request.adapter_id !== ad.adapter_id) { protocolError(raw, 'ADAPTER_ID_MISMATCH'); return; }
    send(AdapterShutdownResponse.assert({ protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'shutdown_result', adapter_id: ad.adapter_id, session_id: request.session_id, request_id: request.request_id, ok: true }));
    stats.shutdowns++;
    if (typeof onShutdown === 'function') { try { onShutdown(); } catch {} }
    close();
  }

  function listener(message) {
    if (closed) return;
    let raw;
    try { raw = parseAdapterWire(message); } catch { return; }
    if (!raw || typeof raw !== 'object') return;
    if (raw.message_type === 'execute') { execute(raw).catch(() => {}); return; }
    if (raw.message_type === 'cancel') { cancel(raw); return; }
    if (raw.message_type === 'describe') { describe(raw); return; }
    if (raw.message_type === 'shutdown') { shutdown(raw); return; }
  }

  function close() {
    if (closed) return;
    closed = true;
    try { channel.off('message', listener); } catch {}
  }

  channel.on('message', listener);
  return Object.freeze({ advertisement: ad, close, stats: () => ({ ...stats }), active_count: () => active.size });
}

export { AdapterExecuteRequest };
