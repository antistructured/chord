#!/usr/bin/env bun
import { createChord } from '../sdk/chord.js';
import { createFakeSmsAdapter } from './fake-sms-adapter.js';
import { demoUserScript } from './fake-user.js';

const chord = createChord({ trustedHost: { now: () => Date.now() } })
const smsAdapter = createFakeSmsAdapter({ userScript: demoUserScript })

// Trusted-host authority: the embedding host authenticates and grants.
const principal = { principal_id: "host-principal", issuer: "demo-host", kind: "service", authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER }
const actor = { actor_id: "worker-actor", principal_id: "host-principal", kind: "service", roles: [], capabilities: ["execute"], revoked_at: null }
chord.setAuthoritySnapshot({
  schema_version: "chord.contracts.v1",
  run_id: chord.registry.run.run_id,
  authority_revision: 0,
  principals: [principal],
  actors: [actor],
  grants: [],
  approvals: []
})
const hostOptions = {
  principal_id: principal.principal_id,
  actor_id: actor.actor_id,
  capability: "execute",
  issueGrants: packets => packets.map(p => ({
    grant_id: `grant_${p.task_id}`,
    principal_id: principal.principal_id,
    actor_id: actor.actor_id,
    capability: "execute",
    effect: "allow",
    scope: {
      run_id: chord.registry.run.run_id,
      project: p.project,
      phase: p.phase,
      task_id: p.task_id,
      target_entity: p.target_entity,
      resource: { kind: "task", id: p.task_id }
    },
    issued_at: 0,
    expires_at: Number.MAX_SAFE_INTEGER,
    revoked_at: null,
    requires_approval: false
  }))
}

chord.setAdapterRouter({
  exact: { default: smsAdapter },
  fallback: smsAdapter
})

console.log(`
  === VIA DEMO (Chord-powered) ===
`)

const intent = chord.parseText(`
@project Via
@phase demo-flow
@version spec:0.2.1

@goal
recover a missed call and qualify the lead

@role implementer
@stance strict

@files
- lead/session.json

@do
- send SMS within 5 seconds
- ask what happened
- ask when it happened
- ask if the caller is injured

@dont
- do not delay response

@verify
- at least 2 qualification signals captured

@stop
- one lead classified
`).spec

const { packets } = chord.registerSpecAndQueue(intent, hostOptions)
console.log(`task_packets: ${packets.length}`)

await smsAdapter.execute({
  task_id: "demo_sms_1",
  requested_action: ["send SMS"],
  inputs: { message: "Hey — sorry we missed your call. What happened?" }
})
await smsAdapter.execute({
  task_id: "demo_sms_2",
  requested_action: ["send SMS"],
  inputs: { message: "Got it. When did it happen?" }
})
await smsAdapter.execute({
  task_id: "demo_sms_3",
  requested_action: ["send SMS"],
  inputs: { message: "Were you injured?" }
})

console.log("\n🧠 Classification:")
console.log(JSON.stringify({
  type: "personal_injury",
  urgency: "high",
  qualified: true
}, null, 2))

console.log("\n🚨 Notification to Firm:")
console.log("🔥 New potential case: Car accident, injury reported, happened yesterday. CALL NOW.");

console.log("\n📊 Audit:")
console.log(JSON.stringify(chord.inspectAudit({ limit: 20 }), null, 2))

console.log("\n=== DEMO COMPLETE ===\n")
