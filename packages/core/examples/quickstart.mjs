import { createChord, SCHEMA_VERSION } from '@antistructured/chord';

// Trusted host setup, not actor/model-provided credentials or grants.
const chord = createChord();
const run_id = chord.getRegistry().run.run_id;
const expires_at = Date.now() + 60_000;
chord.setAuthoritySnapshot({
  schema_version: SCHEMA_VERSION, run_id, authority_revision: 0,
  principals: [{ principal_id: 'host-user', issuer: 'example-host', kind: 'service',
    authenticated_at: 0, expires_at }],
  actors: [{ actor_id: 'writer', principal_id: 'host-user', kind: 'agent',
    roles: [], capabilities: ['draft'], revoked_at: null }],
  grants: [], approvals: []
});
let calls = 0;
chord.setAdapterRouter({ fallback: { execute() {
  calls++;
  return { status: 'completed', outcome: 'succeeded',
    outputs: { draft: 'Your support request is ready for review.' } };
} } });
const { packets } = chord.registerSpecAndQueue({
  schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec',
  project: 'support', phase: 'draft', do: ['draft-response']
}, {
  principal_id: 'host-user', actor_id: 'writer', capability: 'draft',
  // createTaskGrant derives the exact task scope from the packet. It shapes a
  // grant only: nothing is installed and nothing is authorized by shaping one.
  issueGrants: packets => packets.map(packet => chord.createTaskGrant(packet, {
    principal_id: 'host-user', actor_id: 'writer', capability: 'draft', expires_at
  }))
});
const result = await chord.runCycle();
if (!result.ok || calls !== 1 || chord.getRegistry().tasks[packets[0].task_id].status !== 'completed') {
  throw new Error('Governed draft did not complete');
}
console.log({ completed: result.ok, adapterCalls: calls });
// This mock drafts data only. It does not send a message or prove an external effect.
