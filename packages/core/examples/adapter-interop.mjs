#!/usr/bin/env node
// Public-export-only interoperability example: kernel -> adapter bridge -> memory
// transport -> trusted adapter server -> reference mock agent. Run from packages/core:
//   bun run examples/adapter-interop.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ADAPTER_CONTEXT_VERSION,
  createAdapterBridge,
  createAdapterServer,
  createCoordinatedChord,
  createMemoryTransportPair,
  createMockAgentAdapter
} from '@antistructured/chord';

const dir = mkdtempSync(join(tmpdir(), 'chord-interop-'));
const path = join(dir, 'run.sqlite');
const clock = { now: () => 100 };
const task_id = 'task-interop';
const packet = {
  schema_version: 'chord.contracts.v1', task_id, task_kind: 'intent_execution',
  source_type: 'IntentSpec', source_spec_id: null, project: 'interop', phase: 'build',
  target_entity: 'worker', role: 'implementer', stance: 'strict',
  requested_action: ['draft-response'],
  inputs: { spec: { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'interop', phase: 'build', target_entity: 'worker', do: ['draft-response'] }, files: [], verify: [], stop: [] },
  constraints: { dont: [], rules: [], depends: [] }
};

const adapter = createMockAgentAdapter();
const pair = createMemoryTransportPair();
const server = createAdapterServer({ advertisement: adapter.advertisement, handle: adapter.handle, channel: pair.right });
const bridge = createAdapterBridge({ advertisement: adapter.advertisement, transport: pair.left, timeoutMs: 5000 });
const chord = createCoordinatedChord({
  storage: { path, mode: 'create', expectedIdentity: null },
  trustedHost: { clock },
  adapterRouter: { fallback: { adapter: bridge, execution_context: ADAPTER_CONTEXT_VERSION } }
});

try {
  chord.owner.acquire({ expectedRevision: 0 });
  const identity = chord.observer.inspect().identity;
  const scope = { run_id: identity.run_id, project: packet.project, phase: packet.phase, task_id, target_entity: packet.target_entity, resource: { kind: 'task', id: task_id } };
  chord.admin.setAuthoritySnapshot({
    schema_version: 'chord.contracts.v1', run_id: identity.run_id, authority_revision: 0,
    principals: [{ principal_id: 'p-worker', issuer: 'example-host', kind: 'service', authenticated_at: 0, expires_at: 100000 }],
    actors: [{ actor_id: 'worker', principal_id: 'p-worker', kind: 'agent', roles: [], capabilities: ['work'], revoked_at: null }],
    grants: [{ grant_id: 'g-worker-work', principal_id: 'p-worker', actor_id: 'worker', capability: 'work', effect: 'allow', scope, issued_at: 0, expires_at: 100000, revoked_at: null, requires_approval: false }],
    approvals: []
  }, { expectedRevision: chord.observer.inspect().revision });

  const channel = {};
  const binding = { binding_id: 'b-worker', issuer: 'example-host', principal_id: 'p-worker', actor_id: 'worker', ...identity, authenticated_at: 0, expires_at: 100000, work_capability: 'work', work_requires_approval: false };
  const ingress = chord.createActorIngress({ authenticate: candidate => candidate === channel ? binding : null });
  const command = { protocol_version: 'chord.actor-command.v1', operation_id: 'op-submit', ...identity, expected_revision: chord.observer.inspect().revision, correlation_id: null, causation_id: null, type: 'submit_work', payload: { packets: [packet] } };
  const submitted = ingress.handleAuthenticated(channel, JSON.stringify(command));
  assert.equal(submitted.ok, true, JSON.stringify(submitted));

  const cycle = await chord.owner.runCycle();
  assert.equal(cycle.result.classification, 'result');
  const envelope = chord.observer.exportEnvelope();
  assert.equal(envelope.registry.tasks[task_id].status, 'completed');
  assert.equal(envelope.registry.execution_results.length, 1);
  assert.deepEqual(chord.observer.replayEnvelope(), envelope);

  console.log(JSON.stringify({
    ok: true,
    adapter: adapter.advertisement.adapter_id,
    protocol: adapter.advertisement.supported_protocol_versions[0],
    task_status: envelope.registry.tasks[task_id].status,
    summary: envelope.registry.execution_results[0].summary,
    replay_matches: true,
    server_executions: server.stats().executions
  }));
} finally {
  bridge.close();
  server.close();
  pair.close();
  chord.owner.close();
  rmSync(dir, { recursive: true, force: true });
}
