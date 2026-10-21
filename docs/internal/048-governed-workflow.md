# 048 — Resumed Block 6A Pass 3: Governed workflow

Gate: READY. packages/core/examples/cross-actor-workflow.mjs now imports only documented @chord/core exports plus Node standard library. No direct canonical registry/status/queue mutation. Test canonical-example.test.js invokes that same function and asserts eleven real outcome conditions.

Workflow: host-directed validated intent; distinct host-attested builder/reviewer service principals and human; builder mock effect commits; handoff proposed/accepted; reviewer protected task missing approval denies with zero effects; filtered context; prepared attempt; pause; detached supported export/import; host installs exact human approval; authorized resume; protected dispatch consumes approval and committed outcome; full projected state replay equals state without extra effects. Outcome not inferred from command exit.

Machine summaries on both available engines: actor identities builder/reviewer/human; accepted_handoff=true; approval_required/validated/consumed=true; snapshot_restored=true; final_task_status=completed; final_run_revision14; protected dispatches1; builder effects1; negative effects0; trace events34; replay_verified=true. Run IDs are recorded in raw outputs, never fabricated. Same installed tarball workflow was repeated on Node26.7.0 and Bun1.3.14 in Pass5.

Independent identities in one host process, not independently deployed processes. Host must authenticate sessions and attest actual human choice; mocks do not provide real credential authentication. Existing Via demo remains a direct fake-adapter illustration, not acceptance evidence.
