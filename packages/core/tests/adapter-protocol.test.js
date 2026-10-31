import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createIntentTaskPacket } from '../src/execution/task-packets.js';
import {
  ADAPTER_PROTOCOL_VERSION,
  ADAPTER_DESCRIPTOR_VERSION,
  ADAPTER_CONTEXT_VERSION,
  AdapterAdvertisement,
  adapterCompatibility,
  adapterError,
  createAdapterBridge,
  createAdapterServer,
  createLocalToolAdapter,
  createMockAgentAdapter,
  createMemoryTransportPair
} from '../src/interop/index.js';
import { createCoordinatedChord } from '../src/sdk/coordinated-chord.js';
import { actorFixture } from './fixtures/coordinated-actors.js';

const taskPacket = (task_id = 'task-adapter-1', action = 'local.echo') => {
  const packet = createIntentTaskPacket({ schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'adapter', phase: 'test', target_entity: 'worker', do: [action] });
  return { ...packet, task_id };
};
const executionContext = (overrides = {}) => {
  const run_id = overrides.run_id || 'run-adapter-1';
  const incarnation_id = overrides.incarnation_id || randomUUID();
  const operation_id = overrides.operation_id || 'operation-adapter-1';
  const attempt_id = overrides.attempt_id || 'attempt-adapter-1';
  const owner_id = overrides.owner_id || randomUUID();
  const coordination = {
    protocol_version: ADAPTER_CONTEXT_VERSION,
    run_id,
    incarnation_id,
    owner_id,
    generation: overrides.generation ?? 1,
    owner_lease_expires_at: overrides.owner_lease_expires_at ?? 900_000,
    dispatch_revision: overrides.dispatch_revision ?? 1,
    operation_id,
    attempt_id,
    idempotency_key: overrides.idempotency_key || JSON.stringify(['chord.effect.v1', incarnation_id, run_id, operation_id])
  };
  return {
    run_id,
    schema_version: 'chord.contracts.v1',
    task_id: overrides.task_id || 'task-adapter-1',
    task_revision: overrides.task_revision ?? 0,
    queue_id: overrides.queue_id || 'queue-adapter-1',
    attempt_id,
    lease_expires_at: overrides.lease_expires_at ?? 800_000,
    coordination
  };
};
const success = task_id => ({ status: 'completed', outcome: 'succeeded', summary: `done:${task_id}` });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

class FakeChannel extends EventEmitter {
  connected = true;
  sent = [];
  send(wire, callback) { this.sent.push(JSON.parse(wire)); this.emit('sent', this.sent.at(-1)); callback?.(); }
  disconnect() { this.connected = false; this.emit('disconnect'); this.emit('close'); }
}
function reply(channel, response) { channel.emit('message', JSON.stringify(response)); }
function resultResponse(request, result = success(request.task_id)) {
  return { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'result', adapter_id: request.adapter_id, session_id: request.session_id, request_id: request.request_id, run_id: request.run_id, incarnation_id: request.incarnation_id, task_id: request.task_id, attempt_id: request.attempt_id, operation_id: request.operation_id, ok: true, result };
}
function errorResponse(request, code = 'ADAPTER_REJECTED', classification = 'rejected') {
  return { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'error', adapter_id: request.adapter_id, session_id: request.session_id, request_id: request.request_id, task_id: request.task_id, attempt_id: request.attempt_id, operation_id: request.operation_id, ok: false, code, classification };
}
const bridgeFor = (advertisement, channel, options = {}) => createAdapterBridge({ advertisement, transport: channel, ...options });

test('advertisement is descriptive; compatibility rejects unsupported protocol, context and operation', () => {
  const ad = AdapterAdvertisement.assert({ protocol_version: ADAPTER_DESCRIPTOR_VERSION, adapter_id: 'adapter-a', adapter_kind: 'tool', supported_protocol_versions: [ADAPTER_PROTOCOL_VERSION], operations: ['local.echo'], capabilities: ['chord.effect.local-tool'], execution_context: ADAPTER_CONTEXT_VERSION, limits: { max_concurrent: 2, timeout_ms: null } });
  assert.deepEqual(adapterCompatibility(ad), { compatible: true, code: 'COMPATIBLE' });
  assert.deepEqual(adapterCompatibility({ ...ad, supported_protocol_versions: ['chord.adapter-protocol.v0'] }), { compatible: false, code: 'UNSUPPORTED_PROTOCOL' });
  assert.deepEqual(adapterCompatibility({ ...ad, execution_context: null }), { compatible: false, code: 'UNSUPPORTED_EXECUTION_CONTEXT' });
  assert.deepEqual(adapterCompatibility(ad, { requiredOperations: ['local.missing'] }), { compatible: false, code: 'UNSUPPORTED_OPERATION' });
  assert.deepEqual(adapterCompatibility({ ...ad, operations: [] }, { requiredOperations: ['anything'] }), { compatible: true, code: 'COMPATIBLE' });
});

test('local tool adapter executes only explicitly allowlisted operations', async () => {
  const calls = [];
  const adapter = createLocalToolAdapter({ operations: { 'local.echo': ({ packet }) => { calls.push(packet.task_id); return { summary: `echo:${packet.task_id}` }; } } });
  const pair = createMemoryTransportPair();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
  const bridge = bridgeFor(adapter.advertisement, pair.left, { timeoutMs: 1000 });
  try {
    const context = executionContext();
    const result = await bridge.execute(taskPacket(context.task_id), context);
    assert.deepEqual(result, { status: 'completed', outcome: 'succeeded', summary: `echo:${context.task_id}` });
    assert.deepEqual(calls, [context.task_id]);
    const denied = executionContext({ operation_id: 'operation-adapter-2' });
    await assert.rejects(bridge.execute(taskPacket(denied.task_id, 'local.not-allowed'), denied), error => error.code === 'UNSUPPORTED_OPERATION' && error.classification === 'rejected');
    assert.deepEqual(calls, [context.task_id]);
  } finally { bridge.close(); server.close(); pair.close(); }
});

test('mock agent returns deterministic completed, failed and blocked outcomes with protocol identity', async () => {
  const adapter = createMockAgentAdapter();
  const pair = createMemoryTransportPair();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
  const bridge = bridgeFor(adapter.advertisement, pair.left, { timeoutMs: 1000 });
  try {
    for (const [action, status, outcome] of [['work', 'completed', 'succeeded'], ['fail.work', 'failed', 'failed'], ['block.work', 'blocked', 'blocked']]) {
      const context = executionContext({ operation_id: `operation-${status}`, attempt_id: `attempt-${status}` });
      const result = await bridge.execute(taskPacket(context.task_id, action), context);
      assert.equal(result.status, status);
      assert.equal(result.outcome, outcome);
      assert.match(result.summary, new RegExp(`mock-agent:${context.task_id}`));
    }
    assert.equal(server.stats().executions, 3);
  } finally { bridge.close(); server.close(); pair.close(); }
});

test('describe round-trips the advertisement without a session identity', async () => {
  const adapter = createMockAgentAdapter();
  const pair = createMemoryTransportPair();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
  const bridge = bridgeFor(adapter.advertisement, pair.left, { timeoutMs: 1000 });
  try {
    const response = await bridge.describe();
    assert.equal(response.adapter_id, adapter.advertisement.adapter_id);
    assert.deepEqual(response.advertisement, adapter.advertisement);
  } finally { bridge.close(); server.close(); pair.close(); }
});

test('wrong run, incarnation, task, attempt or operation identity rejects rather than settling', async () => {
  const adapter = createMockAgentAdapter();
  for (const key of ['run_id', 'incarnation_id', 'task_id', 'attempt_id', 'operation_id']) {
    const channel = new FakeChannel();
    const bridge = bridgeFor(adapter.advertisement, channel, { timeoutMs: 200 });
    const context = executionContext({ operation_id: `operation-${key}`, attempt_id: `attempt-${key}` });
    const pending = bridge.execute(taskPacket(context.task_id), context);
    const rejected = assert.rejects(pending, error => error.code === 'ADAPTER_IDENTITY_MISMATCH' || error.code === 'ADAPTER_PROTOCOL_ERROR');
    const request = channel.sent[0];
    const response = resultResponse(request);
    response[key] = key === 'incarnation_id' ? randomUUID() : 'foreign-value';
    reply(channel, response);
    await rejected;
    bridge.close();
  }
});

test('duplicate and reordered responses settle only their exact request', async () => {
  const adapter = createMockAgentAdapter();
  const channel = new FakeChannel();
  const bridge = bridgeFor(adapter.advertisement, channel, { timeoutMs: 1000 });
  try {
    const a = executionContext({ operation_id: 'operation-a', attempt_id: 'attempt-a' });
    const b = executionContext({ operation_id: 'operation-b', attempt_id: 'attempt-b' });
    const pa = bridge.execute(taskPacket(a.task_id), a);
    const pb = bridge.execute(taskPacket(b.task_id), b);
    assert.equal(channel.sent.length, 2);
    const [ra, rb] = channel.sent;
    reply(channel, resultResponse(rb, { status: 'completed', outcome: 'succeeded', summary: 'B' }));
    assert.equal((await pb).summary, 'B');
    reply(channel, resultResponse(ra, { status: 'completed', outcome: 'succeeded', summary: 'A' }));
    assert.equal((await pa).summary, 'A');
    let settled = false;
    const pc = bridge.execute(taskPacket(a.task_id), executionContext({ operation_id: 'operation-c', attempt_id: 'attempt-c' }));
    pc.then(() => { settled = true; }, () => { settled = true; });
    reply(channel, resultResponse(ra, { status: 'completed', outcome: 'succeeded', summary: 'duplicate-A' }));
    await tick();
    assert.equal(settled, false);
    reply(channel, resultResponse(channel.sent[2], { status: 'completed', outcome: 'succeeded', summary: 'C' }));
    assert.equal((await pc).summary, 'C');
  } finally { bridge.close(); }
});

test('old session and stale replies cannot settle a replacement bridge request', async () => {
  const adapter = createMockAgentAdapter();
  const channel = new FakeChannel();
  const first = bridgeFor(adapter.advertisement, channel, { timeoutMs: 1000 });
  const firstContext = executionContext({ operation_id: 'operation-old', attempt_id: 'attempt-old' });
  const oldPending = first.execute(taskPacket(firstContext.task_id), firstContext);
  const oldRequest = channel.sent[0];
  first.close();
  await assert.rejects(oldPending, error => error.code === 'ADAPTER_CHANNEL_CLOSED');
  const second = bridgeFor(adapter.advertisement, channel, { timeoutMs: 1000 });
  try {
    const secondContext = executionContext({ operation_id: 'operation-new', attempt_id: 'attempt-new' });
    const pending = second.execute(taskPacket(secondContext.task_id), secondContext);
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    reply(channel, resultResponse(oldRequest, { status: 'completed', outcome: 'succeeded', summary: 'OLD' }));
    await tick();
    assert.equal(settled, false);
    const newRequest = channel.sent.at(-1);
    reply(channel, resultResponse(newRequest, { status: 'completed', outcome: 'succeeded', summary: 'NEW' }));
    assert.equal((await pending).summary, 'NEW');
  } finally { second.close(); }
});

test('timeout rejects locally; a late reply cannot settle a newer request', async () => {
  const adapter = createMockAgentAdapter();
  const channel = new FakeChannel();
  const bridge = bridgeFor(adapter.advertisement, channel, { timeoutMs: 30 });
  try {
    const a = executionContext({ operation_id: 'operation-timeout-a', attempt_id: 'attempt-timeout-a' });
    await assert.rejects(bridge.execute(taskPacket(a.task_id), a), error => error.code === 'ADAPTER_COMMAND_TIMEOUT' && error.classification === 'unknown');
    const b = executionContext({ operation_id: 'operation-timeout-b', attempt_id: 'attempt-timeout-b' });
    const pending = bridge.execute(taskPacket(b.task_id), b);
    reply(channel, resultResponse(channel.sent[0], { status: 'completed', outcome: 'succeeded', summary: 'LATE-A' }));
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    await tick(5);
    assert.equal(settled, false);
    reply(channel, resultResponse(channel.sent[1], { status: 'completed', outcome: 'succeeded', summary: 'B' }));
    assert.equal((await pending).summary, 'B');
  } finally { bridge.close(); }
});

test('malformed matching frame fails locally; malformed JSON and unattributable frames are ignored', async () => {
  const adapter = createMockAgentAdapter();
  const channel = new FakeChannel();
  const bridge = bridgeFor(adapter.advertisement, channel, { timeoutMs: 200 });
  try {
    const context = executionContext({ operation_id: 'operation-malformed', attempt_id: 'attempt-malformed' });
    const pending = bridge.execute(taskPacket(context.task_id), context);
    const rejected = assert.rejects(pending, error => error.code === 'ADAPTER_PROTOCOL_ERROR');
    channel.emit('message', '{');
    channel.emit('message', JSON.stringify({ request_id: randomUUID(), ok: true }));
    reply(channel, { ...resultResponse(channel.sent[0]), extra: 'not-allowed' });
    await rejected;
  } finally { bridge.close(); }
});

test('close and disconnect reject outstanding work, detach listeners and are idempotent', async () => {
  const adapter = createMockAgentAdapter();
  for (const method of ['close', 'disconnect']) {
    const channel = new FakeChannel();
    const bridge = bridgeFor(adapter.advertisement, channel, { timeoutMs: 1000 });
    const context = executionContext({ operation_id: `operation-${method}`, attempt_id: `attempt-${method}` });
    const pending = bridge.execute(taskPacket(context.task_id), context);
    const rejected = assert.rejects(pending, error => error.code === 'ADAPTER_CHANNEL_CLOSED');
    if (method === 'close') bridge.close(); else channel.disconnect();
    await rejected;
    assert.equal(channel.listenerCount('message'), 0);
    bridge.close();
  }
});

test('cancel acknowledges an active request and late result remains delivery-only', async () => {
  const adapter = createMockAgentAdapter();
  const channel = new FakeChannel();
  const bridge = bridgeFor(adapter.advertisement, channel, { timeoutMs: 1000 });
  try {
    const context = executionContext({ operation_id: 'operation-cancel', attempt_id: 'attempt-cancel' });
    const pending = bridge.execute(taskPacket(context.task_id), context);
    const request = channel.sent[0];
    const cancellation = bridge.cancel({ attempt_id: context.attempt_id });
    const cancelRequest = channel.sent[1];
    reply(channel, { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'cancel_result', adapter_id: adapter.advertisement.adapter_id, session_id: cancelRequest.session_id, request_id: cancelRequest.request_id, target_request_id: request.request_id, ok: true, acknowledged: true });
    assert.equal((await cancellation).acknowledged, true);
    reply(channel, resultResponse(request, { status: 'completed', outcome: 'succeeded', summary: 'late-but-delivered' }));
    assert.equal((await pending).summary, 'late-but-delivered');
    assert.deepEqual(await bridge.cancel({ attempt_id: 'no-such-attempt' }), { acknowledged: false, reason: 'NO_PENDING_REQUEST' });
  } finally { bridge.close(); }
});

test('server idempotency deduplicates the stable effect key without re-executing', async () => {
  let calls = 0;
  const adapter = createMockAgentAdapter({ responder: request => { calls++; return success(request.task_id); } });
  const channel = new FakeChannel();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel });
  try {
    const context = executionContext({ operation_id: 'operation-idem', attempt_id: 'attempt-idem' });
    const request = { protocol_version: ADAPTER_PROTOCOL_VERSION, message_type: 'execute', adapter_id: adapter.advertisement.adapter_id, session_id: randomUUID(), request_id: randomUUID(), run_id: context.run_id, incarnation_id: context.coordination.incarnation_id, task_id: context.task_id, task_revision: context.task_revision, queue_id: context.queue_id, attempt_id: context.attempt_id, operation_id: context.coordination.operation_id, idempotency_key: context.coordination.idempotency_key, deadline: context.coordination.owner_lease_expires_at, packet: taskPacket(context.task_id), context };
    channel.emit('message', JSON.stringify(request));
    await tick(5);
    assert.equal(calls, 1, JSON.stringify(channel.sent));
    assert.equal(channel.sent.length, 1, JSON.stringify(channel.sent));
    channel.emit('message', JSON.stringify({ ...request, session_id: randomUUID(), request_id: randomUUID() }));
    await tick(5);
    assert.equal(calls, 1);
    assert.equal(channel.sent.length, 2);
    assert.equal(server.stats().deduplicated, 1);
  } finally { server.close(); }
});

test('unsupported protocol version and adapter identity mismatch fail explicitly before handler execution', async () => {
  let calls = 0;
  const adapter = createMockAgentAdapter({ responder: request => { calls++; return success(request.task_id); } });
  const channel = new FakeChannel();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel });
  try {
    const context = executionContext({ operation_id: 'operation-unsupported', attempt_id: 'attempt-unsupported' });
    const base = { protocol_version: 'chord.adapter-protocol.v0', message_type: 'execute', adapter_id: adapter.advertisement.adapter_id, session_id: randomUUID(), request_id: randomUUID(), run_id: context.run_id, incarnation_id: context.coordination.incarnation_id, task_id: context.task_id, task_revision: context.task_revision, queue_id: context.queue_id, attempt_id: context.attempt_id, operation_id: context.coordination.operation_id, idempotency_key: context.coordination.idempotency_key, deadline: context.coordination.owner_lease_expires_at, packet: taskPacket(context.task_id), context };
    channel.emit('message', JSON.stringify(base));
    await tick(5);
    assert.equal(calls, 0);
    assert.equal(channel.sent[0].code, 'UNSUPPORTED_PROTOCOL');
    channel.emit('message', JSON.stringify({ ...base, protocol_version: ADAPTER_PROTOCOL_VERSION, adapter_id: 'foreign-adapter', request_id: randomUUID() }));
    await tick(5);
    assert.equal(calls, 0);
    assert.equal(channel.sent[1].code, 'ADAPTER_ID_MISMATCH');
  } finally { server.close(); }
});

test('adapter crash/disconnect while work is pending rejects the bridge and leaves no canonical claim', async () => {
  const adapter = createMockAgentAdapter();
  const pair = createMemoryTransportPair();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
  const bridge = bridgeFor(adapter.advertisement, pair.left, { timeoutMs: 1000 });
  try {
    const context = executionContext({ operation_id: 'operation-crash', attempt_id: 'attempt-crash' });
    const pending = bridge.execute(taskPacket(context.task_id), context);
    const rejected = assert.rejects(pending, error => error.code === 'ADAPTER_CHANNEL_CLOSED');
    server.close();
    pair.right.close();
    await rejected;
  } finally { bridge.close(); pair.close(); }
});

test('real child process adapter preserves request identity and shuts down cleanly', { timeout: 30000 }, async () => {
  const worker = fileURLToPath(new URL('./adapter-protocol-worker.js', import.meta.url));
  const child = fork(worker, { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  try {
    const [ready] = await once(child, 'message');
    assert.equal(ready.type, 'ready');
    assert.equal(ready.advertisement.adapter_id, 'chord.mock-agent');
    const bridge = createAdapterBridge({ advertisement: ready.advertisement, transport: child, timeoutMs: 5000 });
    const context = executionContext({ operation_id: 'operation-child', attempt_id: 'attempt-child' });
    const result = await bridge.execute(taskPacket(context.task_id, 'work'), context);
    assert.equal(result.status, 'completed');
    assert.match(result.summary, new RegExp(`mock-agent:${context.task_id}`));
    const exited = once(child, 'exit');
    await bridge.shutdown();
    const [code, signal] = await exited;
    assert.equal(signal, null);
    assert.equal(code, 0);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
});

test('coordinated kernel executes through bridge/server and commits the normalized result once', { timeout: 30000 }, async () => {
  const f = actorFixture();
  let captured = null, calls = 0;
  const adapter = createMockAgentAdapter({ responder: request => { calls++; captured = request; return success(request.task_id); } });
  const pair = createMemoryTransportPair();
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
  const bridge = bridgeFor(adapter.advertisement, pair.left, { timeoutMs: 5000 });
  let c;
  try {
    const submitted = f.submit('bob');
    assert.equal(submitted.ok, true);
    const taskId = f.packets.bob.task_id;
    f.store.commit({ expectedRevision: f.store.load().revision, credential: f.token, change: { kind: 'release' } });
    f.store.close();
    c = createCoordinatedChord({ storage: { path: f.path, mode: 'existing', expectedIdentity: f.identity }, trustedHost: { clock: f.clock }, adapterRouter: { fallback: { adapter: bridge, execution_context: ADAPTER_CONTEXT_VERSION } } });
    c.owner.acquire({ expectedRevision: c.observer.inspect().revision });
    const cycle = await c.owner.runCycle();
    assert.equal(cycle.result.classification, 'result');
    assert.equal(calls, 1);
    assert.equal(captured.task_id, taskId);
    assert.equal(captured.context.coordination.idempotency_key, JSON.stringify(['chord.effect.v1', f.identity.incarnation_id, f.identity.run_id, captured.operation_id]));
    const envelope = c.observer.exportEnvelope();
    assert.equal(envelope.registry.tasks[taskId].status, 'completed');
    assert.equal(envelope.registry.execution_results.length, 1);
    assert.equal(envelope.registry.execution_results[0].summary, `done:${taskId}`);
    assert.deepEqual(c.observer.replayEnvelope(), envelope);
    assert.equal((await c.owner.runCycle()).skipped, true);
    assert.equal(calls, 1);
  } finally { bridge.close(); server.close(); pair.close(); c?.owner.close(); f.cleanup(); }
});

test('a delayed adapter result after owner release cannot commit canonical state', { timeout: 30000 }, async () => {
  const f = actorFixture();
  const adapter = createMockAgentAdapter();
  const pair = createMemoryTransportPair({ delayMs: 50 });
  const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
  const bridge = bridgeFor(adapter.advertisement, pair.left, { timeoutMs: 5000 });
  let c;
  try {
    assert.equal(f.submit('bob').ok, true);
    f.store.commit({ expectedRevision: f.store.load().revision, credential: f.token, change: { kind: 'release' } });
    f.store.close();
    c = createCoordinatedChord({ storage: { path: f.path, mode: 'existing', expectedIdentity: f.identity }, trustedHost: { clock: f.clock }, adapterRouter: { fallback: { adapter: bridge, execution_context: ADAPTER_CONTEXT_VERSION } } });
    c.owner.acquire({ expectedRevision: c.observer.inspect().revision });
    const cycle = c.owner.runCycle();
    await tick(15);
    c.owner.release({ expectedRevision: c.observer.inspect().revision });
    await cycle.catch(() => {});
    const envelope = c.observer.exportEnvelope();
    assert.equal(envelope.registry.execution_results.length, 0);
    assert.notEqual(envelope.registry.tasks[f.packets.bob.task_id].status, 'completed');
  } finally { bridge.close(); server.close(); pair.close(); c?.owner.close(); f.cleanup(); }
});
