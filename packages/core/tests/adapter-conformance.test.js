import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalToolAdapter, createMockAgentAdapter, runAdapterConformance } from '../src/interop/index.js';
import { runAdapterConformance as rootRunAdapterConformance } from '../src/index.js';

test('reference adapters pass the conformance suite', async () => {
  const adapters = [
    createMockAgentAdapter(),
    createLocalToolAdapter({ operations: { work: () => ({ summary: 'ok' }) } })
  ];
  for (const adapter of adapters) {
    const report = await runAdapterConformance({ adapter, timeoutMs: 250 });
    assert.equal(report.ok, true, JSON.stringify(report.checks.filter(item => item.status === 'fail')));
    assert.equal(report.adapter_id, adapter.advertisement.adapter_id);
    assert.equal(report.summary.failed, 0);
    assert.ok(report.summary.passed >= 20);
    assert.equal(report.checks.filter(item => item.status === 'fail').length, 0);
  }
  assert.equal(rootRunAdapterConformance, runAdapterConformance);
});

test('conformance reports missing advertisement and missing handle without throwing', async () => {
  const missingAdvertisement = await runAdapterConformance({ adapter: {}, timeoutMs: 100 });
  assert.equal(missingAdvertisement.ok, false);
  assert.equal(missingAdvertisement.adapter_id, null);
  assert.equal(missingAdvertisement.checks.find(item => item.id === 'adapter.interface').status, 'fail');
  assert.equal(missingAdvertisement.checks.find(item => item.id === 'adapter.interface').code, 'MISSING_ADVERTISEMENT');
  assert.ok(missingAdvertisement.checks.filter(item => item.category === 'protocol').every(item => item.status === 'pass'));

  const advertisement = createMockAgentAdapter().advertisement;
  const missingHandle = await runAdapterConformance({ adapter: { advertisement }, timeoutMs: 100 });
  assert.equal(missingHandle.ok, false);
  assert.equal(missingHandle.adapter_id, advertisement.adapter_id);
  assert.equal(missingHandle.checks.find(item => item.id === 'adapter.interface').code, 'MISSING_HANDLE');
});

test('conformance detects an invalid adapter result instead of reporting success', async () => {
  const advertisement = createMockAgentAdapter().advertisement;
  const report = await runAdapterConformance({
    adapter: { advertisement, handle: async () => ({ status: 'completed', outcome: 'failed' }) },
    timeoutMs: 250
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(item => item.id === 'adapter.valid_outcome').status, 'fail');
  assert.equal(report.checks.find(item => item.id === 'adapter.request_identity').status, 'fail');
  assert.equal(report.checks.find(item => item.id === 'adapter.request_identity').code, 'NO_OBSERVATION');
});

test('conformance detects an unsupported protocol advertisement', async () => {
  const advertisement = { ...createMockAgentAdapter().advertisement, supported_protocol_versions: ['chord.adapter-protocol.v0'] };
  const report = await runAdapterConformance({
    adapter: { advertisement, handle: async () => ({ status: 'completed', outcome: 'succeeded' }) },
    timeoutMs: 100
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(item => item.id === 'adapter.supported_version').code, 'UNSUPPORTED_PROTOCOL');
  assert.equal(report.checks.find(item => item.id === 'adapter.valid_outcome').status, 'fail');
});
