import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ADAPTER_CONTEXT_VERSION, ADAPTER_DESCRIPTOR_VERSION, ADAPTER_PROTOCOL_VERSION, createAdapterBridge, createAdapterServer, runAdapterConformance } from '@antistructured/chord';

const advertisement = {
  protocol_version: ADAPTER_DESCRIPTOR_VERSION, adapter_id: 'consumer.fixture', adapter_kind: 'service',
  supported_protocol_versions: [ADAPTER_PROTOCOL_VERSION], operations: ['complete', 'fail', 'block', 'hold'],
  capabilities: [], execution_context: ADAPTER_CONTEXT_VERSION, limits: { max_concurrent: 8, timeout_ms: null }
};
const fixtureFor = ({ mutate = value => value, instant = false, alwaysComplete = false, counts = {} } = {}) => ({
  advertisement, actions: { completed: 'complete', failed: 'fail', blocked: 'block', pending: 'hold' },
  capabilities: { cancel: true }, createBridge: createAdapterBridge,
  connect({ channel }) {
    counts.opened = (counts.opened || 0) + 1;
    let release = () => {};
    const handle = async request => {
      counts.executed = (counts.executed || 0) + 1;
      const action = request.packet.requested_action[0];
      if (action === 'hold' && !instant) await new Promise(resolve => { release = resolve; });
      const status = alwaysComplete ? 'completed' : action === 'fail' ? 'failed' : action === 'block' ? 'blocked' : 'completed';
      return { status, outcome: status === 'completed' ? 'succeeded' : status };
    };
    const wire = { on: (...args) => channel.on(...args), off: (...args) => channel.off(...args),
      send: (value, callback) => channel.send(JSON.stringify(mutate(JSON.parse(value))), callback) };
    const server = createAdapterServer({ advertisement, handle, channel: wire });
    return { release: () => release(), close() { server.close(); release(); counts.closed = (counts.closed || 0) + 1; } };
  }
});
const failures = report => report.checks.filter(check => check.status === 'fail');

test('public consumer fixture exercises its own endpoint and bridge; omissions remain INCOMPLETE', async () => {
  const counts = {};
  const report = await runAdapterConformance({ fixture: fixtureFor({ counts }), timeoutMs: 100 });
  assert.equal(report.ok, true, JSON.stringify(failures(report)));
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.equal(report.complete, false);
  assert.equal(report.certification, false);
  assert.equal(counts.opened, counts.closed);
  assert.ok(counts.executed >= 5);
  assert.ok(report.checks.filter(check => check.scope === 'supplied-participant' && check.id !== 'participant.registration').every(check => check.status === 'pass'));
  assert.equal(report.checks.filter(check => check.scope === 'supplied-bridge').length, 10);
  assert.ok(report.checks.every(check => typeof check.expected === 'string' && typeof check.actual === 'string'));
  assert.equal(Object.isFrozen(report.checks[0]), true);
});

for (const key of ['adapter_id', 'session_id', 'request_id', 'run_id', 'incarnation_id', 'task_id', 'attempt_id', 'operation_id']) {
  test(`defective participant wrong ${key} cannot pass`, async () => {
    const counts = {};
    const fixture = fixtureFor({ counts, mutate: value => value.message_type === 'result' ? { ...value, [key]: ['session_id', 'request_id', 'incarnation_id'].includes(key) ? randomUUID() : 'foreign' } : value });
    const report = await runAdapterConformance({ fixture, timeoutMs: 40 });
    assert.equal(report.ok, false);
    assert.equal(report.verdict, 'FAIL');
    assert.equal(report.checks.find(check => check.id === 'participant.outcome.completed').status, 'fail');
    assert.notEqual(report.checks.find(check => check.id === 'participant.outcome.completed').code, 'CONFORMANCE_RESPONSE_TIMEOUT');
    assert.equal(counts.opened, counts.closed);
  });
}
for (const [name, mutate] of [
  ['outcome', value => ({ ...value, result: { status: 'completed', outcome: 'failed' } })],
  ['version', value => ({ ...value, protocol_version: 'chord.adapter-protocol.v0' })],
  ['extra', value => ({ ...value, unexpected: true })],
  ['missing', value => { delete value.result; return value; }]
]) {
  test(`defective participant invalid ${name} fails behavioral assertions`, async () => {
    const fixture = fixtureFor({ mutate: value => value.message_type === 'result' ? mutate(value) : value });
    const report = await runAdapterConformance({ fixture, timeoutMs: 40 });
    assert.equal(report.ok, false);
    assert.equal(report.checks.find(check => check.id === 'participant.outcome.completed').status, 'fail');
  });
}
test('always-completed false success fails expected failed/blocked controls', async () => {
  const report = await runAdapterConformance({ fixture: fixtureFor({ alwaysComplete: true }), timeoutMs: 100 });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(check => check.id === 'participant.outcome.failed').code, 'WRONG_OUTCOME');
  assert.equal(report.checks.find(check => check.id === 'participant.outcome.blocked').code, 'WRONG_OUTCOME');
});
test('broken cancel and falsely immediate pending action fail their own scenarios', async () => {
  const cancel = await runAdapterConformance({ fixture: fixtureFor({ mutate: value => value.message_type === 'cancel_result' ? { ...value, acknowledged: false } : value }), timeoutMs: 100 });
  assert.equal(cancel.checks.find(check => check.id === 'participant.cancel_late').status, 'fail');
  const immediate = await runAdapterConformance({ fixture: fixtureFor({ instant: true }), timeoutMs: 100 });
  assert.equal(immediate.checks.find(check => check.id === 'participant.timeout').status, 'fail');
  assert.equal(immediate.checks.find(check => check.id === 'participant.cancel_late').status, 'fail');
});
test('unsupported cancellation/action hooks skip without silently substituting reference behavior', async () => {
  const fixture = fixtureFor(); delete fixture.capabilities; delete fixture.actions.failed;
  const report = await runAdapterConformance({ fixture, timeoutMs: 100 });
  assert.equal(report.ok, true);
  assert.equal(report.verdict, 'INCOMPLETE');
  for (const id of ['participant.cancel_late', 'participant.outcome.failed', 'participant.registration', 'safety.no_effect_on_replay', 'safety.stale_owner_result']) assert.equal(report.checks.find(check => check.id === id).status, 'skip');
});
test('fixture exceptions are sanitized; opened sessions clean up after failure', async () => {
  const counts = {};
  const fixture = fixtureFor({ counts, mutate: () => { throw new Error('SECRET_TOKEN_TEST'); } });
  const report = await runAdapterConformance({ fixture, timeoutMs: 20 });
  assert.equal(report.ok, false);
  assert.equal(JSON.stringify(report).includes('SECRET_TOKEN_TEST'), false);
  assert.equal(counts.opened, counts.closed);
});
test('defective consumer bridge that reports success on timeout is rejected', async () => {
  const fixture = fixtureFor();
  fixture.createBridge = options => {
    const bridge = createAdapterBridge(options);
    return { ...bridge, execute: (...args) => bridge.execute(...args).catch(error => {
      if (error.code === 'ADAPTER_COMMAND_TIMEOUT') return { status: 'completed', outcome: 'succeeded' };
      throw error;
    }) };
  };
  const report = await runAdapterConformance({ fixture, timeoutMs: 50 });
  assert.equal(report.ok, false);
  const check = report.checks.find(check => check.id === 'protocol.timeout');
  assert.equal(check.scope, 'supplied-bridge');
  assert.equal(check.status, 'fail');
});

test('bridge-only fixture is supported without inventing a participant endpoint', async () => {
  const report = await runAdapterConformance({ fixture: { createBridge: createAdapterBridge }, timeoutMs: 100 });
  assert.equal(report.ok, true, JSON.stringify(failures(report)));
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.ok(report.checks.filter(check => check.scope === 'supplied-bridge').every(check => check.status === 'pass'));
  assert.ok(report.checks.filter(check => check.scope === 'supplied-participant').every(check => check.status === 'skip'));
});

test('unresponsive consumer bridge is independently bounded and retired', { timeout: 5000 }, async () => {
  let opened = 0, closed = 0;
  const fixture = { createBridge(options) {
    const bridge = createAdapterBridge(options); opened++;
    let retired = false;
    return { ...bridge, execute: () => new Promise(() => {}), close() { if (!retired) { retired = true; closed++; } bridge.close(); } };
  } };
  const report = await runAdapterConformance({ fixture, timeoutMs: 20 });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(check => check.id === 'protocol.timeout').status, 'fail');
  assert.equal(opened, closed);
});

test('participant exception codes as well as messages cannot leak secret text', async () => {
  const adapter = { advertisement, async handle() { const error = new Error('SECRET_MESSAGE'); error.code = 'SECRET_UPPERCASE_TOKEN'; throw error; } };
  const report = await runAdapterConformance({ adapter, action: 'complete', timeoutMs: 100 });
  assert.equal(report.ok, false);
  assert.equal(JSON.stringify(report).includes('SECRET'), false);
  assert.equal(report.checks.find(check => check.id === 'adapter.valid_outcome').code, 'CONFORMANCE_FAILURE');
});
