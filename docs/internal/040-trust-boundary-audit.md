# 040 — Trust boundary audit

Pass 5 COMPLETE as risk inventory; no fixes. Consulted reports 1–4. No security certification implied. Paths below relative to packages/core unless noted.

| Priority | Boundary / evidence | Finding and minimal candidate response |
|---|---|---|
| P0 | `src/sdk/chord.js:20-119`; `src/registry/registry.js:17-59` | Actor/domain owner/authority are caller text/data, not authenticated provenance. Introduce explicit trusted-host identity/grant input separate from parsed specs; reject actor self-grants. No need for hosted auth product. |
| P0 | `src/platform/runtime-loop.js:15-25` | Exact/prefix/default/fallback routing authorizes nothing. No verified scope, approval, expiry/revocation or cancellation check before execute. Gate effects deny-by-default; human approval must bind task/action/attempt scope. |
| P0 | `src/execution/task-packets.js:56-72` | Raw adapter output untrusted but normalized optimistically; absent result claims completion. Require explicit valid result/evidence, keep requested/dispatched/confirmed distinct. |
| P0 | `src/platform/runtime-loop.js:24` | Adapter gets live registry and task. It can mutate other tasks, owners, events. Treat in-process adapter code as trusted host code, never a sandbox; restrict context and don't expose authoritative writes to model output. |
| P0 | `src/platform/task-queue.js:7-89` | Duplicate admission allowed; first-match task-ID updates; no CAS/version/attempt ownership. Lease recorded but not recovered; caps in policy not enforced. Define single-process ordering and rejection of stale/duplicate writes before claiming concurrency safety. |
| P0 | runtime ingestion and retry | Post-effect ingestion error becomes retriable adapter failure. Fix missing imports plus receipt/idempotency and ambiguous-outcome handling before real effects. |
| P0 | `src/platform/journal-audit.js`; `src/registry/snapshot.js` | Mutable diagnostic history; raw snapshot import. Validate before accepting state, label diagnostic/re-execution honestly. No historical reconstruction guarantee. |
| P0 | runtime :33-37; queue :62 | `String(error)` enters stored last_error, journal and returned error. Provider credentials/payloads may leak through arbitrary errors. Structured sanitized error codes; no raw secret-bearing provider exceptions. |
| P0 | ordinary objects keyed by caller IDs; registry :23,47,74 | Prototype-sensitive keys, inherited-property lookup and unchecked nested objects are not excluded. Closed contracts and safe key handling required. This is source-identified risk, not an executed exploit claim. |
| P1 | SDK registry exposure, query helpers, journal payload references | Direct mutation bypasses all SDK checks. Existing platform exports are trusted-host experimental plumbing, not an actor-safe API. Document compatibility before tightening/removing surfaces. |
| P1 | `src/runtime/adapter.js` | Generic filesystem read/write accepts caller paths without confinement; not wired into kernel execution. Keep internal/trusted-host only; do not present as sandboxed tool capability. |

## Approval bypass and adapter bypass
No approval implementation exists to bypass; absence of a gate is the issue. Demo calls `smsAdapter.execute` directly (`src/demo/callaback-demo.js:51-65`) and prints fabricated example classification/notification. This fake example is not verified authorized execution. An external host can always call its own adapter: Chord cannot claim control of arbitrary host code; guarantee only gated kernel-dispatched paths.

## Secret and dependency inspection
Metadata-only regex scan of all 69 tracked files (including tracked .history copies) for private-key headers, quoted credential assignments and common provider-token forms returned **no matches**; tracked credential-named files: none. No secret values printed. This is a limited pattern scan, not proof of absence; no external credential stores or ignored private files inspected. Reviewed source logging: fake adapter prints messages/replies, CLI serializes audit, runtime stores raw errors and snapshots serialize registry. Real sensitive input would not be redacted.

First-party filesystem scan excluding node_modules/.git found no .ts/.tsx/.mts/.cts files. Source import inventory and manifest show no PotentiaJS/Runvia/Via kernel dependency, LLM SDK or hosted infrastructure requirement. Via occurs in fake demo branding only. Current installed dependency is unrelated sigiljs web-component package (pass 2); no dependency changes made.

## Verification and inspection
No new exploit scripts or tests introduced. Existing negative and retry tests are recorded in passes 2–3; they do not test identity, grant expiry/revocation, approval, cancellation, concurrent writers, secret redaction or adapter isolation. Security guarantees are **not established**.
Inspected prior reports and all relevant SDK, registry, contract, execution, platform, runtime IO, utility and demo source already enumerated in passes 1–4; focused auth/approval/cancel/expiry/credential/coupling source search; metadata-only tracked-file scan; filesystem TypeScript scan.
Changed: this report only. Next audit pass READY. P0 defects remain; no implementation, publishing or version changes authorized by this audit.
