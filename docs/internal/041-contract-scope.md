# 041 — Contract scope

Block 2 IN PROGRESS. Pass 1 complete. Branch main, SHA 6b07802ba8639b29e7c48534612dbd60c946946d. Package remains @chord/core 0.3.0; proposed preview version not applied.

## Prerequisite exception
Block 1 remains PARTIAL. User explicitly answered “Proceed with Block 2 and scoped prerequisite repairs” after being informed of failed runtime and demo checks. This authorizes remediation, not relabeling the audit COMPLETE. Preserve existing .gitignore, .vscode/settings.json and README edits and all 040 reports.

## Scope mapping
Paths relative to packages/core.
| Audit gap | Target files | Bounded correction / compatibility |
|---|---|---|
| C1 wrong library/imitation schemas | package.json, bun.lock, src/contracts/sigils.js, SDK parser and snapshot ingress | Replace unrelated sigiljs with verified @weipertda/sigiljs; closed versioned contracts, no guessed imports; malformed/unknown data now rejected |
| C2 result failure and fabricated success | src/registry/registry.js, execution/task-packets.js, execution/results.js | Fix bindings, explicit valid outcomes before commit; absent result no longer success |
| C3 authority absent | new pure authorization module in platform/, SDK trusted-host seam, runtime-loop.js | Separate host authenticated identity/actors/grants/approvals from request metadata; default deny; role alone never authorizes; expiry/revocation/cancel gates |
| C4 stale/partial transitions | registry.js, task-queue.js, SDK, runtime-loop.js | Revision checks and preflight/atomic single-process commit, duplicate admission and stale result rejection as required for authority; distributed persistence/exactly-once deferred |
| C5 misleading replay/import/errors | snapshot.js, runtime-loop.js, contract error shape, documentation | Version validation, safe errors; retain diagnostic journal, never invoke effects for history; broader replay reducer deferred |
| C6 failed baseline/docs | verify-runtime.js, tests/, demo files, manifest demo script, README/examples | Update legitimate host fixtures, repair script target and assertion, truthful experimental labels; no rebranding |

Keep root/sdk/platform export paths and functional JS package layout. Existing APIs may accept additional trusted-host context; execution without authority intentionally denied. Low-level exported helpers remain experimental trusted-host APIs, never a sandbox. Do not silently treat actor-provided authority as grants. Persisted run freezes schema version; legacy snapshots must be rejected or explicitly migrated, never silently trusted. Model labels remain descriptive.

## Evidence / inspected
Read 040 final report, preview scope lock, contract gap matrix, trust boundary audit; package.json; src/contracts/sigils.js, platform/policy.js, platform/runtime-loop.js, sdk/chord.js, registry/registry.js, registry/snapshot.js, execution/task-packets.js; tests/hardening.test.js. Git status/branch/SHA rechecked. `bun pm ls --all`: sigiljs 0.0.21 -> classnames 2.5.1. `npm view @weipertda/sigiljs version exports --json`: version 0.18.0, default ./src/index.js, declaration ./index.d.ts. Metadata only: source/API inspection required before implementation.

Files changed: this report only. Tests: none rerun in inventory; known baseline failures preserved from 040. Blockers: resolve exact SigilJS API and enforce boundary design before coding; remaining release gaps not automatically included. Next pass READY.
