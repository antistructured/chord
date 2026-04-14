#!/usr/bin/env bun
import { createChord } from '../sdk/chord.js';
import { createFakeSmsAdapter } from './fake-sms-adapter.js';
import { demoUserScript } from './fake-user.js';

const chord = createChord()
const smsAdapter = createFakeSmsAdapter({ userScript: demoUserScript })

chord.setAdapterRouter({
  exact: { default: smsAdapter },
  fallback: smsAdapter
})

console.log(`
  === VIA DEMO (Chord-powered) ===\n
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

const { packets } = chord.registerSpecAndQueue(intent)
console.log("task_packets:", packets.length)

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
