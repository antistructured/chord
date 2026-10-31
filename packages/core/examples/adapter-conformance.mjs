#!/usr/bin/env node
import {
  ADAPTER_CONTEXT_VERSION, ADAPTER_DESCRIPTOR_VERSION, ADAPTER_PROTOCOL_VERSION,
  createAdapterBridge, createAdapterServer, createLocalToolAdapter, createMockAgentAdapter,
  runAdapterConformance
} from '@antistructured/chord';

// Only predefined in-memory effects. Never point this fixture at production
// credentials or operations: the runner sends adversarial requests repeatedly.
const advertisement = {
  protocol_version: ADAPTER_DESCRIPTOR_VERSION, adapter_id: 'example.consumer', adapter_kind: 'service',
  supported_protocol_versions: [ADAPTER_PROTOCOL_VERSION], operations: ['complete', 'fail', 'block', 'hold'],
  capabilities: [], execution_context: ADAPTER_CONTEXT_VERSION, limits: { max_concurrent: 8, timeout_ms: null }
};
const fixture = {
  advertisement,
  actions: { completed: 'complete', failed: 'fail', blocked: 'block', pending: 'hold' },
  capabilities: { cancel: true },
  // Optional: exercise your bridge implementation using synthetic peer frames.
  // Omit this hook to label those checks chord-harness instead of supplied-bridge.
  createBridge: createAdapterBridge,
  connect({ channel }) {
    let release = () => {};
    const server = createAdapterServer({ advertisement, channel, async handle(request) {
      const action = request.packet.requested_action[0];
      if (action === 'hold') await new Promise(resolve => { release = resolve; });
      if (action === 'fail') return { status: 'failed', outcome: 'failed' };
      if (action === 'block') return { status: 'blocked', outcome: 'blocked' };
      return { status: 'completed', outcome: 'succeeded' };
    } });
    // close must release all held effects, timers and connections even on failure.
    return { release: () => release(), close() { server.close(); release(); } };
  }
};
const reports = [];
for (const adapter of [createMockAgentAdapter(), createLocalToolAdapter({ operations: { work: () => ({ summary: 'local tool completed' }) } })]) {
  reports.push(await runAdapterConformance({ adapter, timeoutMs: 1000 }));
}
reports.push(await runAdapterConformance({ fixture, timeoutMs: 1000 }));
const ok = reports.every(report => report.ok);
// Keep every check's scope, expected, actual, failure code and skip reason visible.
console.log(JSON.stringify({ ok, certification: false, reports }));
// This exit means no observed failures, NOT complete coverage or certification.
if (!ok) process.exitCode = 1;
