import { randomUUID } from 'node:crypto';
import { TaskPacket } from '../contracts/sigils.js';
import { AdapterAdvertisement, AdapterContext, AdapterExecuteRequest, ADAPTER_PROTOCOL_VERSION, adapterError, assertAdapterCompatibility, parseAdapterWire, validateAdapterCancelResponse, validateAdapterDescribeResponse, validateAdapterResponse, validateAdapterShutdownResponse } from './adapter-protocol.js';

const TIMEOUT_MAX = 2_147_483_647;
const normalizeTimeout = value => {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0 || value > TIMEOUT_MAX) throw new TypeError('INVALID_ADAPTER_TIMEOUT');
  return value;
};
const protocolFailure = (error, classification = 'rejected') => adapterError(/^ADAPTER_[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'ADAPTER_PROTOCOL_ERROR', classification, error);
const requireTransport = transport => {
  if (!transport || typeof transport.on !== 'function' || typeof transport.off !== 'function' || typeof transport.send !== 'function') throw new TypeError('INVALID_ADAPTER_TRANSPORT');
};

/**
 * Imperative client shell around the pure adapter protocol. The kernel still
 * schedules, fences and commits; this bridge only carries a captured execution
 * request to an independent participant and matches its reply by fresh
 * session/request identity. It never grants authority or mutates canonical data.
 */
export function createAdapterBridge({ advertisement, transport, timeoutMs = null } = {}) {
  requireTransport(transport);
  const ad = AdapterAdvertisement.assert(advertisement);
  assertAdapterCompatibility(ad, { requireExecutionContext: true });
  const timeout = normalizeTimeout(timeoutMs);
  const adapterId = ad.adapter_id, sessionId = randomUUID();
  const pending = new Map(), controls = new Map();
  let closed = false;

  function detach() {
    try { transport.off('message', listener); } catch {}
    try { transport.off('disconnect', close); } catch {}
    try { transport.off('close', close); } catch {}
  }
  function settle(entry, error, value) {
    if (entry.done) return;
    entry.done = true;
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.kind === 'execute') pending.delete(entry.request.request_id);
    else controls.delete(entry.request.request_id);
    if (error) entry.reject(error); else entry.resolve(value);
  }
  function close() {
    if (closed) return;
    closed = true;
    detach();
    for (const entry of [...pending.values()]) settle(entry, adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown'));
    for (const entry of [...controls.values()]) settle(entry, adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown'));
  }
  function send(request, entry) {
    let wire;
    try { wire = JSON.stringify(request); } catch (error) { settle(entry, adapterError('ADAPTER_PROTOCOL_ERROR', 'rejected', error)); return; }
    try {
      transport.send(wire, error => { if (error) settle(entry, adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown', error)); });
    } catch (error) { settle(entry, adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown', error)); }
  }
  function listener(message) {
    let raw;
    try { raw = parseAdapterWire(message); } catch { return; }
    if (!raw || typeof raw !== 'object' || typeof raw.request_id !== 'string') return;
    const execution = pending.get(raw.request_id);
    if (execution) {
      if (raw.session_id !== sessionId) return; // stale/old-connection reply
      let response;
      try {
        if (raw.adapter_id !== adapterId) throw adapterError('ADAPTER_ID_MISMATCH', 'rejected');
        response = validateAdapterResponse(raw, execution.request);
      } catch (error) { settle(execution, protocolFailure(error)); return; }
      if (response.ok) settle(execution, null, response.result);
      else settle(execution, adapterError(response.code, response.classification));
      return;
    }
    const control = controls.get(raw.request_id);
    if (!control) return;
    if (control.kind !== 'describe' && raw.session_id !== sessionId) return;
    try {
      if (raw.adapter_id !== adapterId) throw adapterError('ADAPTER_ID_MISMATCH', 'rejected');
      if (control.kind === 'describe') settle(control, null, validateAdapterDescribeResponse(raw, control.request));
      else if (control.kind === 'cancel') settle(control, null, validateAdapterCancelResponse(raw, control.request));
      else settle(control, null, validateAdapterShutdownResponse(raw, control.request));
    } catch (error) { settle(control, protocolFailure(error)); }
  }

  transport.on('message', listener);
  transport.on('disconnect', close);
  transport.on('close', close);

  function execute(packet, context) {
    if (closed) return Promise.reject(adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown'));
    if (pending.size >= ad.limits.max_concurrent) return Promise.reject(adapterError('ADAPTER_CONCURRENCY_LIMIT', 'rejected'));
    let request;
    try {
      const p = TaskPacket.assert(packet), c = AdapterContext.assert(context), coordination = c.coordination;
      request = AdapterExecuteRequest.assert({
        protocol_version: ADAPTER_PROTOCOL_VERSION,
        message_type: 'execute',
        adapter_id: adapterId,
        session_id: sessionId,
        request_id: randomUUID(),
        run_id: coordination.run_id,
        incarnation_id: coordination.incarnation_id,
        task_id: p.task_id,
        task_revision: c.task_revision,
        queue_id: c.queue_id,
        attempt_id: coordination.attempt_id,
        operation_id: coordination.operation_id,
        idempotency_key: coordination.idempotency_key,
        deadline: coordination.owner_lease_expires_at,
        packet: p,
        context: c
      });
    } catch (error) { return Promise.reject(protocolFailure(error)); }
    return new Promise((resolve, reject) => {
      const entry = { kind: 'execute', request, resolve, reject, timer: null, done: false };
      pending.set(request.request_id, entry);
      if (timeout !== null) entry.timer = setTimeout(() => settle(entry, adapterError('ADAPTER_COMMAND_TIMEOUT', 'unknown')), timeout);
      send(request, entry);
    });
  }

  function describe() {
    if (closed) return Promise.reject(adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown'));
    const request = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'describe', adapter_id: adapterId, request_id: randomUUID() };
    return new Promise((resolve, reject) => {
      const entry = { kind: 'describe', request, resolve, reject, timer: null, done: false };
      controls.set(request.request_id, entry);
      if (timeout !== null) entry.timer = setTimeout(() => settle(entry, adapterError('ADAPTER_COMMAND_TIMEOUT', 'unknown')), timeout);
      send(request, entry);
    });
  }

  function cancel(target = {}) {
    if (closed) return Promise.reject(adapterError('ADAPTER_CHANNEL_CLOSED', 'unknown'));
    let execution = null;
    if (typeof target.target_request_id === 'string') execution = pending.get(target.target_request_id) || null;
    else {
      for (const entry of pending.values()) {
        if ((target.attempt_id && entry.request.attempt_id !== target.attempt_id) || (target.operation_id && entry.request.operation_id !== target.operation_id) || (target.task_id && entry.request.task_id !== target.task_id)) continue;
        execution = entry; break;
      }
    }
    if (!execution) return Promise.resolve({ acknowledged: false, reason: 'NO_PENDING_REQUEST' });
    const request = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'cancel', adapter_id: adapterId, session_id: sessionId, request_id: randomUUID(), target_request_id: execution.request.request_id, task_id: execution.request.task_id, attempt_id: execution.request.attempt_id, operation_id: execution.request.operation_id };
    return new Promise((resolve, reject) => {
      const entry = { kind: 'cancel', request, resolve, reject, timer: null, done: false };
      controls.set(request.request_id, entry);
      if (timeout !== null) entry.timer = setTimeout(() => settle(entry, adapterError('ADAPTER_COMMAND_TIMEOUT', 'unknown')), timeout);
      send(request, entry);
    });
  }

  async function shutdown() {
    if (closed) return false;
    if (transport.connected === false) { close(); return false; }
    const request = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'shutdown', adapter_id: adapterId, session_id: sessionId, request_id: randomUUID() };
    try {
      await new Promise((resolve, reject) => {
        const entry = { kind: 'shutdown', request, resolve, reject, timer: null, done: false };
        controls.set(request.request_id, entry);
        const bound = timeout ?? 5_000;
        entry.timer = setTimeout(() => settle(entry, adapterError('ADAPTER_COMMAND_TIMEOUT', 'unknown')), bound);
        send(request, entry);
      });
    } catch {}
    close();
    return true;
  }

  return Object.freeze({
    advertisement: ad,
    session_id: sessionId,
    execute,
    describe,
    cancel,
    shutdown,
    close,
    get pending_count() { return pending.size; }
  });
}
