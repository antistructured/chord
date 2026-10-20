# 040 — Raw baseline command transcript

Cwd: packages/core. Existing installation; no install performed.

## bun test
Exit: 0
```text
bun test v1.3.14 (0d9b296a)

tests/hardening.test.js:
(pass) Chord Core Hardening > TARGET 1 & 3: CoordSpec Parsing & Normalization [1.02ms]
(pass) Chord Core Hardening > TARGET 2: Dead-Letter Consistency [1.47ms]
(pass) Chord Core Hardening > TARGET 4: Contract Enforcement [0.14ms]
(pass) Chord Core Hardening > TARGET 5: Deterministic Dequeue [0.07ms]

 4 pass
 0 fail
 15 expect() calls
Ran 4 tests across 1 file. [13.00ms]
```

## npm test
Exit: 0
```text
npm notice run @chord/core@0.3.0 test
npm notice run bun test
bun test v1.3.14 (0d9b296a)

tests/hardening.test.js:
(pass) Chord Core Hardening > TARGET 1 & 3: CoordSpec Parsing & Normalization [1.18ms]
(pass) Chord Core Hardening > TARGET 2: Dead-Letter Consistency [1.65ms]
(pass) Chord Core Hardening > TARGET 4: Contract Enforcement [0.16ms]
(pass) Chord Core Hardening > TARGET 5: Deterministic Dequeue [0.08ms]

 4 pass
 0 fail
 15 expect() calls
Ran 4 tests across 1 file. [15.00ms]
```

## bun run src/verify-runtime.js
Exit: 1
```text
🚀 Starting Chord Core Runtime Validation (Revised)...

--- 1. SDK: parseText ---
Parsed Spec Type: IntentSpec
✅ parseText ok

--- 2. Registry: registerSpec ---
✅ registerSpec ok

--- 3. Execution: createTaskPackets ---
Packets generated: 1
✅ createTaskPackets + queue ok

--- 4. Queue Validation ---
Queued tasks: 1
✅ Queue entries found

--- 5. Runtime Loop (Success Case) ---
Completed tasks: 0

❌ VALIDATION FAILED:
67 |     }
68 |   });
69 |   await chord.runCycle();
70 |   const completed = chord.queryQueue({ status: "completed" });
71 |   console.log("Completed tasks:", completed.length);
72 |   if (completed.length === 0) throw new Error("Task did not complete");
                                             ^
error: Task did not complete
      at runValidation (/home/d/Workspace/other-projects/chord-v0.3.0/packages/core/src/verify-runtime.js:72:41)
```

## bun run demo:via
Exit: 1
```text
$ bun run src/demo/via-demo.js
error: Module not found "src/demo/via-demo.js"
error: script "demo:via" exited with code 1
```

## bun run src/demo/callaback-demo.js
Exit: 0
```text
=== VIA DEMO (Chord-powered) ===

task_packets: 1

📤 SMS → User:
Hey — sorry we missed your call. What happened?

📥 User:
I was in a car accident

📤 SMS → User:
Got it. When did it happen?

📥 User:
Yesterday

📤 SMS → User:
Were you injured?

📥 User:
Yes, my neck hurts

🧠 Classification:
{
  "type": "personal_injury",
  "urgency": "high",
  "qualified": true
}

🚨 Notification to Firm:
🔥 New potential case: Car accident, injury reported, happened yesterday. CALL NOW.

📊 Audit:
{
  "audit_type": "chord.audit",
  "audit_version": "0.3.0",
  "created_at": "2026-10-19T23:56:13.452Z",
  "counts": {
    "artifacts": 0,
    "domains": 0,
    "tasks": 1,
    "queued": 1,
    "events": 2
  },
  "artifacts": [],
  "domains": [],
  "tasks": [
    {
      "task_id": "task_1792454173452_mv4f7cu6",
      "task_kind": "intent_execution",
      "source_type": "IntentSpec",
      "source_spec_id": null,
      "project": "Via",
      "phase": "demo-flow",
      "target_entity": "default",
      "role": "implementer",
      "stance": "strict",
      "requested_action": [
        "send SMS within 5 seconds",
        "ask what happened",
        "ask when it happened",
        "ask if the caller is injured"
      ],
      "inputs": {
        "spec": {
          "project": "Via",
          "phase": "demo-flow",
          "version": "spec:0.2.1",
          "goal": "",
          "intent": "",
          "role": "implementer",
          "stance": "strict",
          "entity": [],
          "do": [
            "send SMS within 5 seconds",
            "ask what happened",
            "ask when it happened",
            "ask if the caller is injured"
          ],
          "dont": [
            "do not delay response"
          ],
          "verify": [
            "at least 2 qualification signals captured"
          ],
          "stop": [
            "one lead classified"
          ],
          "files": [
            "lead/session.json"
          ],
          "state": {},
          "authority": {},
          "assign": [],
          "artifact": "",
          "from": "",
          "to": [],
          "spec_type": "IntentSpec"
        },
        "files": [
          "lead/session.json"
        ],
        "verify": [
          "at least 2 qualification signals captured"
        ],
        "stop": [
          "one lead classified"
        ]
      },
      "constraints": {
        "dont": [
          "do not delay response"
        ],
        "rules": [],
        "depends": []
      },
      "status": "queued",
      "created_at": 1792454173452,
      "retry_count": 0
    }
  ],
  "queue": [
    {
      "queue_id": "queue_1792454173452_038joru4",
      "task_id": "task_1792454173452_mv4f7cu6",
      "target_entity": "default",
      "status": "queued",
      "priority": 0,
      "available_at": 1792454173452,
      "lease_expires_at": null,
      "max_attempts": 3,
      "retry_count": 0,
      "last_error": null
    }
  ],
  "replay": [
    {
      "sequence": 1,
      "event_id": "evt_1792454173451_vkrc2xmh",
      "type": "spec_registered",
      "at": 1792454173451,
      "payload": {
        "spec_type": "IntentSpec",
        "project": "Via",
        "phase": "demo-flow"
      }
    },
    {
      "sequence": 2,
      "event_id": "evt_1792454173452_8s696zml",
      "type": "task_enqueued",
      "at": 1792454173452,
      "payload": {
        "task_id": "task_1792454173452_mv4f7cu6",
        "target_entity": "default"
      }
    }
  ]
}

=== DEMO COMPLETE ===
```

## bun run chord:run
Exit: 0
```text
$ bun run src/cli/run.js
{
  "ok": true,
  "skipped": true
}
```

## bun run chord:replay --journal
Exit: 0
```text
$ bun run src/cli/replay.js --journal
[]
```

## bun run chord:audit
Exit: 0
```text
$ bun run src/cli/inspect-audit.js
{
  "audit_type": "chord.audit",
  "audit_version": "0.3.0",
  "created_at": "2026-10-19T23:56:13.636Z",
  "counts": {
    "artifacts": 0,
    "domains": 0,
    "tasks": 0,
    "queued": 0,
    "events": 0
  },
  "artifacts": [],
  "domains": [],
  "tasks": [],
  "queue": [],
  "replay": []
}
```

## npm pack --dry-run --json
Exit: 0
```text
{
  "@chord/core": {
    "id": "@chord/core@0.3.0",
    "name": "@chord/core",
    "version": "0.3.0",
    "size": 11892,
    "unpackedSize": 39931,
    "shasum": "6525469e764e9e37034f0037d39890615d49bf1b",
    "integrity": "sha512-S21DblzwK6vn9whJTQW0eexlZGOSBf7p9onK2B/3xdeNFvvdjX0RAoNSA+6BBJMw6JYLcfkP6q7CF2jGMu8COg==",
    "filename": "chord-core-0.3.0.tgz",
    "files": [
      {
        "path": "dev_flow.md",
        "size": 577,
        "mode": 420
      },
      {
        "path": "examples/basic-flow/README.md",
        "size": 95,
        "mode": 420
      },
      {
        "path": "examples/failure-recovery/README.md",
        "size": 72,
        "mode": 420
      },
      {
        "path": "examples/multi-entity-review/README.md",
        "size": 88,
        "mode": 420
      },
      {
        "path": "package.json",
        "size": 552,
        "mode": 420
      },
      {
        "path": "src/cli/_shared.js",
        "size": 357,
        "mode": 420
      },
      {
        "path": "src/cli/inspect-audit.js",
        "size": 170,
        "mode": 420
      },
      {
        "path": "src/cli/replay.js",
        "size": 465,
        "mode": 420
      },
      {
        "path": "src/cli/run.js",
        "size": 572,
        "mode": 420
      },
      {
        "path": "src/contracts/sigils.js",
        "size": 1733,
        "mode": 420
      },
      {
        "path": "src/demo/callaback-demo.js",
        "size": 1819,
        "mode": 420
      },
      {
        "path": "src/demo/fake-sms-adapter.js",
        "size": 648,
        "mode": 420
      },
      {
        "path": "src/demo/fake-user.js",
        "size": 102,
        "mode": 420
      },
      {
        "path": "src/execution/results.js",
        "size": 417,
        "mode": 420
      },
      {
        "path": "src/execution/task-packets.js",
        "size": 2370,
        "mode": 420
      },
      {
        "path": "src/index.js",
        "size": 180,
        "mode": 420
      },
      {
        "path": "src/platform/adapter-routing.js",
        "size": 454,
        "mode": 420
      },
      {
        "path": "src/platform/event-journal.js",
        "size": 460,
        "mode": 420
      },
      {
        "path": "src/platform/index.js",
        "size": 207,
        "mode": 420
      },
      {
        "path": "src/platform/journal-audit.js",
        "size": 1083,
        "mode": 420
      },
      {
        "path": "src/platform/policy.js",
        "size": 624,
        "mode": 420
      },
      {
        "path": "src/platform/runtime-loop.js",
        "size": 2041,
        "mode": 420
      },
      {
        "path": "src/platform/task-queue.js",
        "size": 2600,
        "mode": 420
      },
      {
        "path": "src/registry/query.js",
        "size": 799,
        "mode": 420
      },
      {
        "path": "src/registry/registry.js",
        "size": 4280,
        "mode": 420
      },
      {
        "path": "src/registry/snapshot.js",
        "size": 716,
        "mode": 420
      },
      {
        "path": "src/runtime/adapter.js",
        "size": 514,
        "mode": 420
      },
      {
        "path": "src/sdk/chord.js",
        "size": 6711,
        "mode": 420
      },
      {
        "path": "src/sdk/index.js",
        "size": 28,
        "mode": 420
      },
      {
        "path": "src/types/index.js",
        "size": 1084,
        "mode": 420
      },
      {
        "path": "src/utils/clone.js",
        "size": 81,
        "mode": 420
      },
      {
        "path": "src/utils/id.js",
        "size": 144,
        "mode": 420
      },
      {
        "path": "src/verify-runtime.js",
        "size": 4978,
        "mode": 420
      },
      {
        "path": "tests/hardening.test.js",
        "size": 2817,
        "mode": 420
      },
      {
        "path": "tests/README.md",
        "size": 93,
        "mode": 420
      }
    ],
    "entryCount": 35,
    "bundled": []
  }
}
```
