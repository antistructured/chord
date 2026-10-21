# 040 — Baseline verification

Pass 6 executed; baseline FAIL. Block 1 PARTIAL. No implementation fixes or installation changes made. Consulted passes 1–5 and source before executing fake adapters.

## Conditions
Cwd for every command: `packages/core`. Existing node_modules; Bun 1.3.14, Node v24.18.1, npm 12.0.2. Manifest/lock/installed tree: @chord/core 0.3.0, sigiljs 0.0.21, classnames 2.5.1. No clean-install reproducibility claim. Commands use in-memory fake fixtures; no real SMS, providers, publishing, tags or version change.

Raw command output and individual exits: [040-baseline-transcript.md](040-baseline-transcript.md).

| Command / check | Result | Meaning |
|---|---|---|
| `bun test` | PASS, exit 0; 4 pass / 0 fail / 15 expect calls | One hardening test file only |
| `npm test` | PASS, exit 0; 4 pass / 0 fail / 15 expect calls | Same Bun suite, not independent Node coverage |
| `bun run src/verify-runtime.js` | FAIL, exit 1 | success case completed tasks 0; throws `Task did not complete` |
| `bun run demo:via` | FAIL, exit 1 | manifest references missing src/demo/via-demo.js |
| `bun run src/demo/callaback-demo.js` | PASS process exit 0 | direct fake adapter demo; registered task remains queued, not kernel completion |
| `bun run chord:run` | PASS, exit 0 | empty state: ok true, skipped true |
| `bun run chord:replay --journal` | PASS, exit 0 | empty list only |
| `bun run chord:audit` | PASS, exit 0 | empty registry audit only |
| `npm pack --dry-run --json` | PASS, exit 0 | @chord/core@0.3.0; 35 entries, 11,892 bytes packed / 39,931 unpacked; no tarball produced |
| lint | NOT AVAILABLE | no lint script/config in repository inventory; did not invent/run nonexistent script |
| CI | NOT AVAILABLE | no tracked workflow |
| tarball consumer install/smoke | NOT APPLICABLE | audit block, not release/packaging; no fresh install exercised |

Packaging dry-run includes dev_flow.md, tests, demo and verify-runtime; no package root README/license file observed in file list. Manifest has no bin or file whitelist. Packaging command success is not package fitness. Root audit reports are outside package directory and not packed.

## Required checks
- Contract failure tests: PASS for the existing missing actions/numeric target and malformed-map assertions (pass 2). No actual SigilJS coverage.
- No first-party TypeScript source: PASS static filesystem scan (pass 5), including untracked first-party paths; dependency files excluded.
- No unintended dependency additions: PASS; manifest and bun.lock unchanged, no install executed.
- No product kernel coupling: PASS static source imports/manifest; Via name confined to fake example, not required integration.
- Accurate public docs: FAIL. README calls production-ready/stable and advertises broken demo; test README implies runner still needs wiring; dev_flow claims stable scaffold/SigilJS without evidence. Preserve pre-existing modified README; later scoped correction required. Internal audit reports explicitly correct the claims without overwriting user edits.
- Runtime reliability/security/reconstruction: NOT ESTABLISHED; see passes 2–5. Unit suite misses success ingestion and security/replay integrity paths.
- `src/verify-runtime.js:138-147` negative check catches its own sentinel failure if validation does not throw; this is not a sound assertion. Current script fails earlier, so that section did not execute.

## Inspected / changed / next
Inspected: prior reports, package.json, bun.lock, tests/hardening.test.js, tests/README.md, all executed CLI/demo/validation entries (source inspections in preceding passes), pack output, root README and dev_flow claims.
Changed: this report and raw baseline transcript only. No code/test/package edits. Blockers: runtime and advertised demo failures, wrong validation dependency, inadequate negative/security/replay infrastructure, misleading docs. Next audit pass READY for scope lock, not implementation. Stop after final handoff; do not start Block 2 automatically.
