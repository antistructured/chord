import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AdapterResult } from '../contracts/sigils.js';
import { createIntentTaskPacket } from '../execution/task-packets.js';
import {
  ADAPTER_CONTEXT_VERSION,
  ADAPTER_PROTOCOL_VERSION,
  AdapterAdvertisement,
  adapterCompatibility,
  adapterError
} from './adapter-protocol.js';
import { createAdapterBridge } from './adapter-bridge.js';
import { createAdapterServer } from './adapter-server.js';
import { createMemoryTransportPair } from './memory-transport.js';
import { createMockAgentAdapter } from './reference-adapters.js';
import { runParticipantChecks } from './conformance-participant.js';

const TIMEOUT_MAX = 2_147_483_647;
const check = (condition, code, message = code) => {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
};
const normalizeTimeout = value => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > TIMEOUT_MAX) throw new TypeError('INVALID_CONFORMANCE_TIMEOUT');
  return value;
};
// Never include participant exception messages, causes, stacks or payloads.
// Even a syntactically valid error code can be attacker-controlled secret text.
const SAFE_ERROR_CODES = new Set(`ADAPTER_CHANNEL_CLOSED ADAPTER_COMMAND_TIMEOUT ADAPTER_CONCURRENCY_LIMIT ADAPTER_IDENTITY_MISMATCH ADAPTER_ID_MISMATCH ADAPTER_REQUEST_MISMATCH ADAPTER_PROTOCOL_ERROR ADAPTER_RETRY ADAPTER_TEST_REJECTED ATTEMPT_MISMATCH AUTHORITY_FIELD AUTHORITY_LEAK CANCEL_NOT_ACKNOWLEDGED CONFORMANCE_CHECK_TIMEOUT CONFORMANCE_FAILURE CONFORMANCE_RESPONSE_TIMEOUT DUPLICATE_SETTLED EXPECTED_REJECTION FALSE_SUCCESS_OR_RETRY FOREIGN_CORRELATION_SETTLED HANDLER_CALLED IDEMPOTENCY_MISMATCH INCARNATION_MISMATCH INPUT_MUTATED INVALID_CONFORMANCE_ADAPTER INVALID_FIXTURE_SESSION INVALID_OUTCOME INVALID_REQUEST_ACCEPTED LATE_RESULT_INVALID LATE_RESULT_LOST LISTENER_LEAK MISSING_ADVERTISEMENT MISSING_CORRELATION MISSING_FIXTURE_CONNECT MISSING_FIXTURE_RELEASE MISSING_HANDLE MISSING_REQUESTS MISSING_RESPONSES NOT_DEDUPLICATED NO_OBSERVATION NO_RESPONSE OPERATION_MISMATCH PENDING_ACTION_COMPLETED PENDING_LEAK RUN_MISMATCH SHARED_CONTEXT SHARED_PACKET SHUTDOWN_FAILED SHUTDOWN_NOT_RECORDED STALE_SETTLED TASK_MISMATCH UNSUPPORTED_EXECUTION_CONTEXT UNSUPPORTED_PROTOCOL WRONG_CLASSIFICATION WRONG_ERROR_CODE WRONG_OUTCOME WRONG_RESULT`.split(' '));
const safeCode = error => SAFE_ERROR_CODES.has(error?.code) ? error.code : 'CONFORMANCE_FAILURE';
const describeError = error => safeCode(error);
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const bounded = async (value, ms) => {
  let timer;
  try {
    return await Promise.race([value, new Promise((_, reject) => {
      timer = setTimeout(() => reject(adapterError('CONFORMANCE_CHECK_TIMEOUT')), ms);
    })]);
  } finally { clearTimeout(timer); }
};
const rejects = async (promise, code) => {
  let error = null;
  try { await promise; } catch (value) { error = value; }
  check(error, 'EXPECTED_REJECTION', `expected ${code}`);
  check(error.code === code, 'WRONG_ERROR_CODE', `expected ${code}, got ${error.code}`);
  return error;
};

class ProbeChannel {
  constructor() {
    this.connected = true;
    this.listeners = new Map();
    this.sent = [];
  }
  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return this;
  }
  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event, value) {
    for (const listener of [...(this.listeners.get(event) || [])]) listener(value);
  }
  send(wire, callback) {
    this.sent.push(JSON.parse(wire));
    callback?.();
  }
  disconnect() {
    this.connected = false;
    this.emit('disconnect');
    this.emit('close');
  }
}

const packetFor = action => createIntentTaskPacket({
  schema_version: 'chord.contracts.v1',
  spec_type: 'IntentSpec',
  project: 'adapter-conformance',
  phase: 'test',
  target_entity: 'conformance',
  do: [action]
});

const contextFor = (packet, overrides = {}) => {
  const run_id = overrides.run_id || `run-conformance-${randomUUID()}`;
  const incarnation_id = overrides.incarnation_id || randomUUID();
  const owner_id = overrides.owner_id || randomUUID();
  const operation_id = overrides.operation_id || `operation-${randomUUID()}`;
  const attempt_id = overrides.attempt_id || `attempt-${randomUUID()}`;
  const queue_id = overrides.queue_id || `queue-${randomUUID()}`;
  const owner_lease_expires_at = overrides.owner_lease_expires_at ?? 900_000;
  return {
    run_id,
    schema_version: 'chord.contracts.v1',
    task_id: packet.task_id,
    task_revision: overrides.task_revision ?? 0,
    queue_id,
    attempt_id,
    lease_expires_at: overrides.lease_expires_at ?? 800_000,
    coordination: {
      protocol_version: ADAPTER_CONTEXT_VERSION,
      run_id,
      incarnation_id,
      owner_id,
      generation: overrides.generation ?? 1,
      owner_lease_expires_at,
      dispatch_revision: overrides.dispatch_revision ?? 1,
      operation_id,
      attempt_id,
      idempotency_key: overrides.idempotency_key || JSON.stringify(['chord.effect.v1', incarnation_id, run_id, operation_id])
    }
  };
};

const requestFor = (advertisement, packet, context, overrides = {}) => ({
  protocol_version: ADAPTER_PROTOCOL_VERSION,
  message_type: 'execute',
  adapter_id: advertisement.adapter_id,
  session_id: overrides.session_id || randomUUID(),
  request_id: overrides.request_id || randomUUID(),
  run_id: context.run_id,
  incarnation_id: context.coordination.incarnation_id,
  task_id: packet.task_id,
  task_revision: context.task_revision,
  queue_id: context.queue_id,
  attempt_id: context.attempt_id,
  operation_id: context.coordination.operation_id,
  idempotency_key: context.coordination.idempotency_key,
  deadline: context.coordination.owner_lease_expires_at,
  packet,
  context,
  ...overrides
});

const resultFor = (request, result) => ({
  protocol_version: ADAPTER_PROTOCOL_VERSION,
  message_type: 'result',
  adapter_id: request.adapter_id,
  session_id: request.session_id,
  request_id: request.request_id,
  run_id: request.run_id,
  incarnation_id: request.incarnation_id,
  task_id: request.task_id,
  attempt_id: request.attempt_id,
  operation_id: request.operation_id,
  ok: true,
  result
});

const errorFor = (request, code = 'ADAPTER_TEST_REJECTED', classification = 'rejected') => ({
  protocol_version: ADAPTER_PROTOCOL_VERSION,
  message_type: 'error',
  adapter_id: request.adapter_id,
  session_id: request.session_id,
  request_id: request.request_id,
  task_id: request.task_id,
  attempt_id: request.attempt_id,
  operation_id: request.operation_id,
  ok: false,
  code,
  classification
});

async function withBridgeServer(advertisement, handle, timeoutMs, work) {
  const pair = createMemoryTransportPair();
  const server = createAdapterServer({ advertisement, handle, channel: pair.right });
  const bridge = createAdapterBridge({ advertisement, transport: pair.left, timeoutMs });
  try { return await work({ bridge, server, pair }); }
  finally {
    try { bridge.close(); } catch {}
    try { server.close(); } catch {}
    try { pair.close(); } catch {}
  }
}

async function withProbeBridgeUsing(advertisement, timeoutMs, work, factory = createAdapterBridge) {
  const channel = new ProbeChannel();
  const bridge = factory({ advertisement, transport: channel, timeoutMs });
  try { return await work({ channel, bridge }); }
  finally { try { bridge.close(); } catch {} }
}

async function withProbeServer(advertisement, handle, work) {
  const channel = new ProbeChannel();
  const server = createAdapterServer({ advertisement, handle, channel });
  try { return await work({ channel, server }); }
  finally { try { server.close(); } catch {} }
}

export async function runAdapterConformance({ adapter, fixture = null, action = null, timeoutMs = 1000 } = {}) {
  const timeout = normalizeTimeout(timeoutMs);
  const checks = [];
  let advertisement = null, handle = null, observation = null;
  const openedBridges = new Set();
  const bridgeFactory = options => {
    const bridge = (fixture?.createBridge || createAdapterBridge)(options);
    openedBridges.add(bridge);
    // Bound a defective consumer bridge too; never rely on its own timeout.
    return { ...bridge, get pending_count() { return bridge.pending_count; }, close: () => { openedBridges.delete(bridge); bridge.close(); }, ...Object.fromEntries(['execute', 'describe', 'cancel', 'shutdown'].map(method => [method, (...args) => {
      const pending = bounded(bridge[method](...args), options.timeoutMs + 50);
      // A malformed fixture may fail before the scenario reaches its await.
      pending.catch(() => {});
      return pending;
    }])) };
  };
  const withProbeBridge = (ad, ms, work) => withProbeBridgeUsing(ad, ms, work, bridgeFactory);
  const bridgeIds = new Set(['protocol.correlation', 'protocol.invalid_result', 'protocol.identity_mismatch', 'protocol.reordered_duplicate', 'protocol.stale_replacement', 'protocol.timeout', 'protocol.close_disconnect', 'protocol.cancel', 'protocol.bounded_concurrency', 'protocol.no_retry_after_error']);
  const scopeFor = (id, category) => category === 'participant' ? 'supplied-participant' : category === 'adapter' ? 'supplied-handler/chord-server' : fixture?.createBridge && bridgeIds.has(id) ? 'supplied-bridge' : 'chord-harness';

  async function record(id, category, name, work, skip = null) {
    if (skip !== null) {
      checks.push({ id, category, name, scope: scopeFor(id, category), status: 'skip', expected: name, actual: 'not exercised', reason: skip });
      return;
    }
    try {
      const detail = await work();
      checks.push({ id, category, name, scope: scopeFor(id, category), status: 'pass', expected: name, actual: 'observed', ...(detail === undefined ? {} : { detail }) });
    } catch (error) {
      checks.push({ id, category, name, scope: scopeFor(id, category), status: 'fail', expected: name, actual: safeCode(error), code: safeCode(error), detail: describeError(error) });
    } finally {
      for (const bridge of openedBridges) { try { bridge.close(); } catch {} }
      openedBridges.clear();
    }
  }

  await record('adapter.interface', 'adapter', 'Adapter exposes a valid advertisement and handle', async () => {
    check(adapter && typeof adapter === 'object', 'INVALID_CONFORMANCE_ADAPTER', 'adapter must be an object');
    check(adapter.advertisement !== undefined, 'MISSING_ADVERTISEMENT', 'adapter.advertisement is required');
    advertisement = AdapterAdvertisement.assert(adapter.advertisement);
    check(typeof adapter.handle === 'function', 'MISSING_HANDLE', 'adapter.handle must be a function');
    handle = adapter.handle.bind(adapter);
    return advertisement.adapter_id;
  }, !adapter && fixture ? 'fixture-only run; no handler supplied' : null);

  const adapterReady = advertisement !== null && handle !== null;
  const adapterSkip = adapterReady ? null : !adapter && fixture ? 'no handler supplied (fixture-only run)' : 'adapter interface check failed';
  const selectedAction = action || advertisement?.operations?.[0] || 'work';

  await record('adapter.supported_version', 'adapter', 'Advertisement supports the current protocol version', async () => {
    check(advertisement.supported_protocol_versions.includes(ADAPTER_PROTOCOL_VERSION), 'UNSUPPORTED_PROTOCOL', `expected ${ADAPTER_PROTOCOL_VERSION}`);
    return ADAPTER_PROTOCOL_VERSION;
  }, adapterSkip);

  await record('adapter.execution_context', 'adapter', 'Advertisement declares the current execution context', async () => {
    check(advertisement.execution_context === ADAPTER_CONTEXT_VERSION, 'UNSUPPORTED_EXECUTION_CONTEXT', `expected ${ADAPTER_CONTEXT_VERSION}`);
    return ADAPTER_CONTEXT_VERSION;
  }, adapterSkip);

  await record('adapter.capabilities_descriptive', 'adapter', 'Compatibility is descriptive and grants no authority', async () => {
    const result = adapterCompatibility(advertisement);
    check(result.compatible === true, result.code, 'advertisement is not compatible');
    check(isDeepStrictEqual(Object.keys(result).sort(), ['code', 'compatible']), 'AUTHORITY_LEAK', 'compatibility result must only report compatibility');
    check(!Object.hasOwn(result, 'grants') && !Object.hasOwn(result, 'authority'), 'AUTHORITY_LEAK', 'compatibility result must not contain authority');
    return result.code;
  }, adapterSkip);

  await record('adapter.describe', 'adapter', 'Describe round-trip returns the advertised descriptor', async () => {
    await withBridgeServer(advertisement, handle, timeout, async ({ bridge }) => {
      const response = await bridge.describe();
      check(response.advertisement.adapter_id === advertisement.adapter_id, 'ADAPTER_ID_MISMATCH', 'describe returned another adapter');
    });
  }, adapterSkip);

  await record('adapter.valid_outcome', 'adapter', 'Advertised action produces a valid completed, failed or blocked outcome', async () => {
    const packet = packetFor(selectedAction), context = contextFor(packet);
    const beforePacket = structuredClone(packet), beforeContext = structuredClone(context);
    const calls = [];
    const wrapped = async request => {
      calls.push(request);
      return handle(request);
    };
    let result;
    await withBridgeServer(advertisement, wrapped, timeout, async ({ bridge }) => {
      result = await bridge.execute(packet, context);
    });
    check(calls.length === 1, 'ADAPTER_RETRY', `handler called ${calls.length} times`);
    AdapterResult.assert(result);
    check(['completed', 'failed', 'blocked'].includes(result.status), 'INVALID_OUTCOME', 'unexpected status');
    check(isDeepStrictEqual(packet, beforePacket) && isDeepStrictEqual(context, beforeContext), 'INPUT_MUTATED', 'caller packet or context changed');
    observation = { packet, context, request: calls[0], result };
    return `${result.status}/${result.outcome}`;
  }, adapterSkip);

  await record('adapter.request_identity', 'adapter', 'Handler receives exact task, attempt, operation, run and incarnation identity', async () => {
    check(observation, 'NO_OBSERVATION', 'execute check did not produce a request');
    const { request, context, packet } = observation;
    check(request.run_id === context.run_id, 'RUN_MISMATCH');
    check(request.incarnation_id === context.coordination.incarnation_id, 'INCARNATION_MISMATCH');
    check(request.task_id === packet.task_id && request.task_id === context.task_id, 'TASK_MISMATCH');
    check(request.attempt_id === context.attempt_id, 'ATTEMPT_MISMATCH');
    check(request.operation_id === context.coordination.operation_id, 'OPERATION_MISMATCH');
    check(request.idempotency_key === context.coordination.idempotency_key, 'IDEMPOTENCY_MISMATCH');
    check(request.session_id && request.request_id, 'MISSING_CORRELATION', 'session_id and request_id are required');
    return `${request.run_id}/${request.attempt_id}/${request.operation_id}`;
  }, adapterSkip);

  await record('adapter.stable_effect_key', 'adapter', 'Stable effect key uses incarnation, run and operation identity', async () => {
    check(observation, 'NO_OBSERVATION', 'execute check did not produce a request');
    const { request, context } = observation;
    const expected = JSON.stringify(['chord.effect.v1', context.coordination.incarnation_id, context.run_id, context.coordination.operation_id]);
    check(request.idempotency_key === expected, 'IDEMPOTENCY_MISMATCH', 'stable effect key does not match the protocol');
    return expected;
  }, adapterSkip);

  await record('adapter.input_isolation', 'adapter', 'Adapter receives detached packet and context copies', async () => {
    check(observation, 'NO_OBSERVATION', 'execute check did not produce a request');
    check(observation.request.packet !== observation.packet, 'SHARED_PACKET', 'adapter received the caller packet object');
    check(observation.request.context !== observation.context, 'SHARED_CONTEXT', 'adapter received the caller context object');
  }, adapterSkip);

  await record('adapter.no_authority_fields', 'adapter', 'Packet and context carry no authority, grant or credential fields', async () => {
    check(observation, 'NO_OBSERVATION', 'execute check did not produce a request');
    const forbidden = ['authority', 'grants', 'grant', 'credential', 'credentials', 'admin'];
    for (const value of [observation.request, observation.request.packet, observation.request.context]) {
      for (const key of forbidden) check(!Object.hasOwn(value, key), 'AUTHORITY_FIELD', `unexpected field ${key}`);
    }
  }, adapterSkip);

  await record('adapter.shutdown', 'adapter', 'Chord server records shutdown (bridge true alone is not acknowledgement)', async () => {
    await withBridgeServer(advertisement, handle, timeout, async ({ bridge, server }) => {
      check(await bridge.shutdown() === true, 'SHUTDOWN_FAILED', 'shutdown was not acknowledged');
      check(server.stats().shutdowns === 1, 'SHUTDOWN_NOT_RECORDED', 'server did not record shutdown');
    });
  }, adapterSkip);

  await record('adapter.cancellation', 'adapter', 'Cancellation of an active request', null, adapterReady ? 'requires a deliberately long-running adapter; protocol cancellation is covered by protocol.cancel' : adapterSkip);
  await record('adapter.timeout', 'adapter', 'Timeout classification', null, adapterReady ? 'requires a deliberately non-responsive adapter; protocol timeout is covered by protocol.timeout' : adapterSkip);
  await record('adapter.invalid_response', 'adapter', 'Invalid response shape rejection', null, adapterReady ? 'requires a deliberately malformed participant; protocol rejection is covered by protocol.invalid_result' : adapterSkip);

  const reference = createMockAgentAdapter();

  await record('protocol.reference_outcomes', 'protocol', 'Reference adapter returns completed, failed and blocked outcomes', async () => {
    await withBridgeServer(reference.advertisement, reference.handle, timeout, async ({ bridge }) => {
      for (const [value, status, outcome] of [['work', 'completed', 'succeeded'], ['fail.work', 'failed', 'failed'], ['block.work', 'blocked', 'blocked']]) {
        const packet = packetFor(value), context = contextFor(packet);
        const result = await bridge.execute(packet, context);
        check(result.status === status && result.outcome === outcome, 'INVALID_OUTCOME', `${value}: ${result.status}/${result.outcome}`);
      }
    });
  });

  await record('protocol.describe', 'protocol', 'Describe request/response correlation', async () => {
    await withBridgeServer(reference.advertisement, reference.handle, timeout, async ({ bridge }) => {
      const response = await bridge.describe();
      check(response.adapter_id === reference.advertisement.adapter_id, 'ADAPTER_ID_MISMATCH');
      check(response.advertisement.adapter_id === reference.advertisement.adapter_id, 'ADAPTER_ID_MISMATCH');
    });
  });

  await record('protocol.unsupported_version', 'protocol', 'Unsupported protocol version is rejected before the handler', async () => {
    let calls = 0;
    const handle = async () => { calls++; return { status: 'completed', outcome: 'succeeded' }; };
    await withProbeServer(reference.advertisement, handle, async ({ channel }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      channel.emit('message', JSON.stringify(requestFor(reference.advertisement, packet, context, { protocol_version: 'chord.adapter-protocol.v0' })));
      await tick(5);
      check(calls === 0, 'HANDLER_CALLED', 'handler ran for an unsupported version');
      check(channel.sent.length === 1, 'NO_RESPONSE', 'expected one protocol error');
      check(channel.sent[0].code === 'UNSUPPORTED_PROTOCOL', 'WRONG_ERROR_CODE', channel.sent[0].code);
    });
  });

  await record('protocol.adapter_id_mismatch', 'protocol', 'Foreign adapter identity is rejected before the handler', async () => {
    let calls = 0;
    const handle = async () => { calls++; return { status: 'completed', outcome: 'succeeded' }; };
    await withProbeServer(reference.advertisement, handle, async ({ channel }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      channel.emit('message', JSON.stringify(requestFor(reference.advertisement, packet, context, { adapter_id: 'foreign-adapter' })));
      await tick(5);
      check(calls === 0, 'HANDLER_CALLED', 'handler ran for a foreign adapter id');
      check(channel.sent.length === 1, 'NO_RESPONSE', 'expected one protocol error');
      check(channel.sent[0].code === 'ADAPTER_ID_MISMATCH', 'WRONG_ERROR_CODE', channel.sent[0].code);
    });
  });

  await record('protocol.invalid_result', 'protocol', 'Extra/missing fields, invalid outcome and unsupported response version reject', async () => {
    for (const mutate of [r => { r.extra = true; }, r => { delete r.result; }, r => { r.result = { status: 'completed', outcome: 'failed' }; }, r => { r.protocol_version = 'chord.adapter-protocol.v0'; }]) {
      await withProbeBridge(reference.advertisement, timeout, async ({ channel, bridge }) => {
        const packet = packetFor('work'), context = contextFor(packet);
        const pending = bridge.execute(packet, context);
        const rejected = rejects(pending, 'ADAPTER_PROTOCOL_ERROR');
        rejected.catch(() => {});
        await tick();
        const response = resultFor(channel.sent[0], { status: 'completed', outcome: 'succeeded' });
        mutate(response);
        channel.emit('message', JSON.stringify(response));
        await rejected;
      });
    }
  });

  await record('protocol.identity_mismatch', 'protocol', 'Wrong run/incarnation/task/attempt/operation/adapter identity rejects', async () => {
    for (const key of ['run_id', 'incarnation_id', 'task_id', 'attempt_id', 'operation_id', 'adapter_id']) {
      await withProbeBridge(reference.advertisement, timeout, async ({ channel, bridge }) => {
        const packet = packetFor('work'), context = contextFor(packet);
        const pending = bridge.execute(packet, context);
        const rejected = rejects(pending, key === 'adapter_id' ? 'ADAPTER_ID_MISMATCH' : 'ADAPTER_IDENTITY_MISMATCH');
        rejected.catch(() => {});
        const response = resultFor(channel.sent[0], { status: 'completed', outcome: 'succeeded' });
        response[key] = key === 'incarnation_id' ? randomUUID() : 'foreign-value';
        channel.emit('message', JSON.stringify(response));
        await rejected;
      });
    }
  });

  await record('protocol.correlation', 'protocol', 'Wrong session or request UUID cannot settle a current execution', async () => {
    await withProbeBridge(reference.advertisement, timeout, async ({ channel, bridge }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      const pending = bridge.execute(packet, context);
      let settled = false;
      pending.then(() => { settled = true; }, () => { settled = true; });
      const response = resultFor(channel.sent[0], { status: 'completed', outcome: 'succeeded' });
      for (const key of ['session_id', 'request_id']) {
        channel.emit('message', JSON.stringify({ ...response, [key]: randomUUID() }));
        await tick(2);
        check(!settled, 'FOREIGN_CORRELATION_SETTLED');
      }
      channel.emit('message', JSON.stringify(response));
      await pending;
    });
  });

  await record('protocol.reordered_duplicate', 'protocol', 'Reordered and duplicate responses settle only their exact request', async () => {
    await withProbeBridge(reference.advertisement, timeout, async ({ channel, bridge }) => {
      const packetA = packetFor('work'), contextA = contextFor(packetA);
      const packetB = packetFor('work'), contextB = contextFor(packetB);
      const pendingA = bridge.execute(packetA, contextA);
      const pendingB = bridge.execute(packetB, contextB);
      check(channel.sent.length === 2, 'MISSING_REQUESTS');
      const [requestA, requestB] = channel.sent;
      channel.emit('message', JSON.stringify(resultFor(requestB, { status: 'completed', outcome: 'succeeded', summary: 'B' })));
      check((await pendingB).summary === 'B', 'WRONG_RESULT');
      channel.emit('message', JSON.stringify(resultFor(requestA, { status: 'completed', outcome: 'succeeded', summary: 'A' })));
      check((await pendingA).summary === 'A', 'WRONG_RESULT');
      const packetC = packetFor('work'), contextC = contextFor(packetC);
      const pendingC = bridge.execute(packetC, contextC);
      let settled = false;
      pendingC.then(() => { settled = true; }, () => { settled = true; });
      channel.emit('message', JSON.stringify(resultFor(requestA, { status: 'completed', outcome: 'succeeded', summary: 'duplicate-A' })));
      await tick(5);
      check(settled === false, 'DUPLICATE_SETTLED', 'duplicate old response settled a newer request');
      channel.emit('message', JSON.stringify(resultFor(channel.sent[2], { status: 'completed', outcome: 'succeeded', summary: 'C' })));
      check((await pendingC).summary === 'C', 'WRONG_RESULT');
    });
  });

  await record('protocol.stale_replacement', 'protocol', 'Old session response cannot settle a replacement bridge', async () => {
    const channel = new ProbeChannel();
    const first = bridgeFactory({ advertisement: reference.advertisement, transport: channel, timeoutMs: timeout });
    const packetA = packetFor('work'), contextA = contextFor(packetA);
    const pendingA = first.execute(packetA, contextA);
    const oldRequest = channel.sent[0];
    first.close();
    await rejects(pendingA, 'ADAPTER_CHANNEL_CLOSED');
    const second = bridgeFactory({ advertisement: reference.advertisement, transport: channel, timeoutMs: timeout });
    try {
      const packetB = packetFor('work'), contextB = contextFor(packetB);
      const pendingB = second.execute(packetB, contextB);
      let settled = false;
      pendingB.then(() => { settled = true; }, () => { settled = true; });
      channel.emit('message', JSON.stringify(resultFor(oldRequest, { status: 'completed', outcome: 'succeeded', summary: 'OLD' })));
      await tick(5);
      check(settled === false, 'STALE_SETTLED', 'old session response settled a replacement request');
      channel.emit('message', JSON.stringify(resultFor(channel.sent.at(-1), { status: 'completed', outcome: 'succeeded', summary: 'NEW' })));
      check((await pendingB).summary === 'NEW', 'WRONG_RESULT');
    } finally { second.close(); }
  });

  await record('protocol.timeout', 'protocol', 'Timeout rejects locally with an unknown classification', async () => {
    await withProbeBridge(reference.advertisement, 20, async ({ bridge }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      const error = await rejects(bridge.execute(packet, context), 'ADAPTER_COMMAND_TIMEOUT');
      check(error.classification === 'unknown', 'WRONG_CLASSIFICATION', error.classification);
    });
  });

  await record('protocol.close_disconnect', 'protocol', 'Close and disconnect reject outstanding work', async () => {
    const closed = new ProbeChannel();
    const closedBridge = bridgeFactory({ advertisement: reference.advertisement, transport: closed, timeoutMs: timeout });
    try {
      const packet = packetFor('work'), context = contextFor(packet);
      const pending = closedBridge.execute(packet, context);
      closedBridge.close();
      await rejects(pending, 'ADAPTER_CHANNEL_CLOSED');
      check(closed.listeners.get('message')?.size === 0, 'LISTENER_LEAK', 'message listener was not detached');
    } finally { closedBridge.close(); }
    const disconnected = new ProbeChannel();
    const disconnectedBridge = bridgeFactory({ advertisement: reference.advertisement, transport: disconnected, timeoutMs: timeout });
    try {
      const packet = packetFor('work'), context = contextFor(packet);
      const pending = disconnectedBridge.execute(packet, context);
      disconnected.disconnect();
      await rejects(pending, 'ADAPTER_CHANNEL_CLOSED');
    } finally { disconnectedBridge.close(); }
  });

  await record('protocol.cancel', 'protocol', 'Cancellation acknowledges an active request and late results remain delivery-only', async () => {
    await withProbeBridge(reference.advertisement, timeout, async ({ channel, bridge }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      const pending = bridge.execute(packet, context);
      const request = channel.sent[0];
      const cancellation = bridge.cancel({ attempt_id: context.attempt_id });
      const cancelRequest = channel.sent[1];
      channel.emit('message', JSON.stringify({
        protocol_version: ADAPTER_PROTOCOL_VERSION,
        message_type: 'cancel_result',
        adapter_id: reference.advertisement.adapter_id,
        session_id: cancelRequest.session_id,
        request_id: cancelRequest.request_id,
        target_request_id: request.request_id,
        ok: true,
        acknowledged: true
      }));
      check((await cancellation).acknowledged === true, 'CANCEL_NOT_ACKNOWLEDGED');
      channel.emit('message', JSON.stringify(resultFor(request, { status: 'completed', outcome: 'succeeded', summary: 'late' })));
      check((await pending).summary === 'late', 'LATE_RESULT_LOST');
    });
  });

  await record('protocol.idempotency', 'protocol', 'In-memory sequential result cache only; not durable or concurrent effect deduplication', async () => {
    let calls = 0;
    const handle = async request => { calls++; return { status: 'completed', outcome: 'succeeded', summary: request.task_id }; };
    await withProbeServer(reference.advertisement, handle, async ({ channel, server }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      channel.emit('message', JSON.stringify(requestFor(reference.advertisement, packet, context)));
      await tick(5);
      channel.emit('message', JSON.stringify(requestFor(reference.advertisement, packet, context, { session_id: randomUUID(), request_id: randomUUID() })));
      await tick(5);
      check(calls === 1, 'ADAPTER_RETRY', `handler called ${calls} times`);
      check(channel.sent.length === 2, 'MISSING_RESPONSES');
      check(server.stats().deduplicated === 1, 'NOT_DEDUPLICATED', JSON.stringify(server.stats()));
    });
  });

  await record('protocol.bounded_concurrency', 'protocol', 'Bridge enforces the advertised concurrency limit', async () => {
    const advertisement = { ...reference.advertisement, limits: { ...reference.advertisement.limits, max_concurrent: 1 } };
    await withProbeBridge(advertisement, timeout, async ({ channel, bridge }) => {
      const packetA = packetFor('work'), contextA = contextFor(packetA);
      const packetB = packetFor('work'), contextB = contextFor(packetB);
      const pendingA = bridge.execute(packetA, contextA);
      await rejects(bridge.execute(packetB, contextB), 'ADAPTER_CONCURRENCY_LIMIT');
      channel.emit('message', JSON.stringify(resultFor(channel.sent[0], { status: 'completed', outcome: 'succeeded' })));
      await pendingA;
    });
  });

  await record('protocol.no_retry_after_error', 'protocol', 'Adapter error rejects once without an automatic retry', async () => {
    await withProbeBridge(reference.advertisement, timeout, async ({ channel, bridge }) => {
      const packet = packetFor('work'), context = contextFor(packet);
      const pending = bridge.execute(packet, context);
      await tick();
      channel.emit('message', JSON.stringify(errorFor(channel.sent[0], 'ADAPTER_TEST_REJECTED', 'rejected')));
      const error = await rejects(pending, 'ADAPTER_TEST_REJECTED');
      check(error.classification === 'rejected', 'WRONG_CLASSIFICATION');
      check(channel.sent.length === 1, 'ADAPTER_RETRY', 'bridge retried after an adapter error');
    });
  });

  await record('protocol.shutdown', 'protocol', 'Shutdown is acknowledged and recorded', async () => {
    await withBridgeServer(reference.advertisement, reference.handle, timeout, async ({ bridge, server }) => {
      check(await bridge.shutdown() === true, 'SHUTDOWN_FAILED');
      check(server.stats().shutdowns === 1, 'SHUTDOWN_NOT_RECORDED');
    });
  });

  await record('protocol.no_authority_from_advertisement', 'protocol', 'Advertisement capability is not authority', async () => {
    const result = adapterCompatibility(reference.advertisement);
    check(isDeepStrictEqual(Object.keys(result).sort(), ['code', 'compatible']), 'AUTHORITY_LEAK');
    check(!Object.hasOwn(result, 'grants') && !Object.hasOwn(result, 'authority'), 'AUTHORITY_LEAK');
  });

  await record('safety.no_effect_on_replay', 'safety', 'Adapter is not invoked during historical replay', null, 'kernel-level replay is covered by the 052/053 kernel suites; the adapter protocol has no replay path');
  await record('safety.stale_owner_result', 'safety', 'Stale owner result cannot commit canonical state', null, 'kernel-level fencing is covered by the 052/053 kernel suites; protocol stale replies are covered by protocol.stale_replacement');

  await runParticipantChecks({ fixture, timeout, record, helpers: { ProbeChannel, packetFor, contextFor, requestFor, tick, check, rejects } });
  const passed = checks.filter(item => item.status === 'pass').length;
  const failed = checks.filter(item => item.status === 'fail').length;
  const skipped = checks.filter(item => item.status === 'skip').length;
  return Object.freeze({
    ok: failed === 0,
    complete: failed === 0 && skipped === 0,
    verdict: failed > 0 ? 'FAIL' : skipped > 0 ? 'INCOMPLETE' : 'PASS',
    certification: false,
    adapter_id: advertisement?.adapter_id ?? fixture?.advertisement?.adapter_id ?? null,
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    checks: Object.freeze(checks.map(item => Object.freeze(item))),
    summary: Object.freeze({ total: checks.length, passed, failed, skipped })
  });
}
