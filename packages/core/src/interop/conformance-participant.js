import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AdapterAdvertisement, AdapterDescribeResponse, AdapterCancelResponse, AdapterShutdownResponse, AdapterErrorResponse, ADAPTER_PROTOCOL_VERSION, adapterCompatibility, validateAdapterResponse } from './adapter-protocol.js';
import { createAdapterBridge } from './adapter-bridge.js';
import { createMemoryTransportPair } from './memory-transport.js';

// Internal runner implementation, not a new public entry point. Only transport
// channels cross the fixture boundary, never host authority or canonical state.
export async function runParticipantChecks({ fixture, timeout, record, helpers }) {
  const { ProbeChannel, packetFor, contextFor, requestFor, tick, check, rejects } = helpers;
  let ad = null;
  await record('participant.interface', 'participant', 'Valid advertisement and synchronous connect returning close()', async () => {
    ad = AdapterAdvertisement.assert(fixture.advertisement);
    check(typeof fixture.connect === 'function', 'MISSING_FIXTURE_CONNECT');
  }, fixture && fixture.connect === undefined && typeof fixture.createBridge === 'function' ? 'Bridge-only fixture; no participant endpoint supplied' : fixture ? null : 'No participant fixture; handler wrapping does not test third-party wire behavior');
  const missing = ad && typeof fixture?.connect === 'function' ? null : 'Participant fixture unavailable';
  const action = key => typeof fixture?.actions?.[key] === 'string' ? fixture.actions[key] : null;
  const skip = key => missing || (action(key) ? null : `fixture.actions.${key} unavailable; no reference substitute`);
  async function session(work) {
    const channel = new ProbeChannel();
    let endpoint;
    try {
      endpoint = fixture.connect({ channel, timeoutMs: timeout });
      check(endpoint && typeof endpoint.close === 'function' && typeof endpoint.then !== 'function', 'INVALID_FIXTURE_SESSION');
      return await work({ channel, endpoint });
    } finally { try { endpoint?.close?.(); } finally { channel.disconnect(); } }
  }
  async function receive(channel, req) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // Every raw participant scenario has one expected response at a time.
      // Inspect even foreign correlation rather than hiding it as a timeout.
      const response = channel.sent.shift();
      if (response) {
        check(response.request_id === req.request_id, 'ADAPTER_REQUEST_MISMATCH');
        return response;
      }
      await tick(1);
    }
    check(false, 'CONFORMANCE_RESPONSE_TIMEOUT');
  }
  const send = (channel, req) => channel.emit('message', JSON.stringify(req));
  function request(key = 'completed') {
    const packet = packetFor(action(key) || 'work');
    return requestFor(ad, packet, contextFor(packet));
  }
  await record('participant.compatibility', 'participant', 'Current protocol/context compatibility is descriptive only', async () => {
    check(adapterCompatibility(ad).compatible, 'UNSUPPORTED_PROTOCOL');
    check(isDeepStrictEqual(Object.keys(adapterCompatibility(ad)).sort(), ['code', 'compatible']), 'AUTHORITY_LEAK');
  }, missing);
  await record('participant.describe', 'participant', 'Exact descriptor and request identity', async () => {
    await session(async ({ channel }) => {
      const req = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'describe', adapter_id: ad.adapter_id, request_id: randomUUID() };
      send(channel, req);
      const response = AdapterDescribeResponse.assert(await receive(channel, req));
      check(response.adapter_id === ad.adapter_id && isDeepStrictEqual(response.advertisement, ad), 'ADAPTER_ID_MISMATCH');
    });
  }, missing);
  for (const status of ['completed', 'failed', 'blocked']) {
    await record(`participant.outcome.${status}`, 'participant', `${status} outcome with exact session/request/run/incarnation/task/attempt/operation identity`, async () => {
      await session(async ({ channel }) => {
        const req = request(status); send(channel, req);
        const response = validateAdapterResponse(await receive(channel, req), req);
        check(response.ok && response.result.status === status, 'WRONG_OUTCOME');
      });
    }, skip(status));
  }
  const malformed = [
    ['version', req => { req.protocol_version = 'chord.adapter-protocol.v0'; }, 'UNSUPPORTED_PROTOCOL'],
    ['adapter_id', req => { req.adapter_id = 'foreign-adapter'; }, 'ADAPTER_ID_MISMATCH'],
    ['extra', req => { req.extra = true; }],
    ['missing', req => { delete req.packet; }],
    ...['task_id', 'attempt_id', 'operation_id', 'run_id', 'incarnation_id'].map(key => [key, req => { req[key] = key === 'incarnation_id' ? randomUUID() : 'foreign-value'; }])
  ];
  for (const [key, mutate, code] of malformed) {
    await record(`participant.reject.${key}`, 'participant', `Explicit rejection of invalid ${key}; never false success`, async () => {
      await session(async ({ channel }) => {
        const req = request(); mutate(req); send(channel, req);
        const response = AdapterErrorResponse.assert(await receive(channel, req));
        check(response.classification === 'rejected', 'INVALID_REQUEST_ACCEPTED');
        check(response.protocol_version === ADAPTER_PROTOCOL_VERSION && response.adapter_id === ad.adapter_id && response.session_id === req.session_id, 'ADAPTER_IDENTITY_MISMATCH');
        check(!code || response.code === code, 'WRONG_ERROR_CODE');
      });
    }, skip('completed'));
  }
  await record('participant.shutdown', 'participant', 'Correlated shutdown_result, not merely bridge shutdown true', async () => {
    await session(async ({ channel }) => {
      const req = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'shutdown', adapter_id: ad.adapter_id, session_id: randomUUID(), request_id: randomUUID() };
      send(channel, req);
      const response = AdapterShutdownResponse.assert(await receive(channel, req));
      check(response.adapter_id === req.adapter_id && response.session_id === req.session_id, 'ADAPTER_IDENTITY_MISMATCH');
    });
  }, missing);
  await record('participant.cancel_late', 'participant', 'Active cancel acknowledged; released late result preserves execution identity', async () => {
    await session(async ({ channel, endpoint }) => {
      check(typeof endpoint.release === 'function', 'MISSING_FIXTURE_RELEASE');
      const req = request('pending'); send(channel, req); await tick();
      check(!channel.sent.some(value => value.request_id === req.request_id), 'PENDING_ACTION_COMPLETED');
      const cancel = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'cancel', adapter_id: ad.adapter_id, session_id: req.session_id, request_id: randomUUID(), target_request_id: req.request_id, task_id: req.task_id, attempt_id: req.attempt_id, operation_id: req.operation_id };
      send(channel, cancel);
      const response = AdapterCancelResponse.assert(await receive(channel, cancel));
      check(response.acknowledged && response.target_request_id === req.request_id && response.session_id === req.session_id && response.adapter_id === ad.adapter_id, 'CANCEL_NOT_ACKNOWLEDGED');
      endpoint.release();
      check(validateAdapterResponse(await receive(channel, req), req).ok, 'LATE_RESULT_INVALID');
    });
  }, skip('pending') || (fixture?.capabilities?.cancel === true ? null : 'Cancellation support not declared'));
  await record('participant.timeout', 'participant', 'Pending action times out unknown with one execute and no retry', async () => {
    const pair = createMemoryTransportPair();
    let endpoint, bridge, sends = 0;
    const originalSend = pair.left.send.bind(pair.left);
    pair.left.send = (wire, callback) => { if (JSON.parse(wire).message_type === 'execute') sends++; originalSend(wire, callback); };
    try {
      endpoint = fixture.connect({ channel: pair.right, timeoutMs: timeout });
      check(endpoint && typeof endpoint.close === 'function', 'INVALID_FIXTURE_SESSION');
      bridge = createAdapterBridge({ advertisement: ad, transport: pair.left, timeoutMs: Math.min(timeout, 30) });
      const packet = packetFor(action('pending'));
      const error = await rejects(bridge.execute(packet, contextFor(packet)), 'ADAPTER_COMMAND_TIMEOUT');
      check(error.classification === 'unknown' && sends === 1, 'FALSE_SUCCESS_OR_RETRY');
      check(bridge.pending_count === 0, 'PENDING_LEAK');
    } finally { try { bridge?.close(); endpoint?.close(); } finally { pair.close(); } }
  }, skip('pending'));
  await record('participant.registration', 'participant', 'Host registration and grants independently governed', null, 'No portable registration protocol; advertisement grants nothing');
}
