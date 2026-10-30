# Block 050 — Independent final review

## Pass

**A3 — independent-review-agent. Gate: COMPLETE for Block 050 engineering closeout within the documented trusted-host, single-process, in-memory scope.** Entry into **Block 051 is explicitly authorized** by this independent engineering gate. No Part B / Block 051 implementation was performed. Public-preview distribution and publication remain **BLOCKED** on the separate maintainer gates below; COMPLETE does not waive them.

Reviewed working tree: `/home/d/Workspace/other-projects/chord`, branch `base`, HEAD `08728e48772db14a247add9143669a8e0eab01fa`. HEAD alone does not contain the dirty Block 050 changes tested here. Runtime measurements: Bun `/home/d/.bun/bin/bun` **1.4.3**; Node **v24.22.1**. No dependency installation, source change, commit, push, tag, publish, remote change or destructive Git command occurred.

## Files inspected

Repository-relative paths unless explicitly identified as package-relative. `#symbol` is a search locator, not an HTML anchor.

- A1/A2 artifacts: `docs/internal/050-citation-closeout.md`, `050-mutation-regression-closeout.md`, and `packages/core/tests/mutation-regression-closeout.test.js`; inspected A1 scratch audit/probe evidence and A2 mutation payloads/results and reran the latter independently.
- Product/API/documentation claims: `README.md`, `packages/core/README.md`, `docs/internal/050-{baseline-lock,product-contract,developer-api-review,docs-verification,durable-coordination-design,developer-proof-spec,review}.md`; active claims and explicit supersessions distinguished from historical measurements and future designs.
- Historical boundary and harness provenance: `docs/internal/041-authority-design.md`, `047-public-api-compatibility.md`, `047-final-report.md`, `046-{repository-reality-audit,state-atomicity-audit,final-report,independent-stop-review}.md`, `046-state-probes.mjs`, and `046-evidence/unknown-redispatch.mjs`.
- Live SDK and ownership chain: `packages/core/src/sdk/chord.js`, `src/registry/{owner,registry}.js`, `src/contracts/sigils.js`, `src/platform/{authorization,runtime-loop,state-invariants,handoff,history,trace-reducer,journal-audit}.js`, `src/execution/task-packets.js` (all `src/` paths in this bullet are package-relative).
- Public entry points / import surface, package manifest and lock, both `packages/core/examples/{quickstart,cross-actor-workflow}.mjs`, `packages/core/tests/{developer-api-review,architecture-integrity}.test.js`, host fixture, full suite output, source import inventory, and complete tracked source/example/manifest/lock diff against HEAD. The added A2 tests are not in `git diff` and were read separately.

## Files changed

Created only **`docs/internal/050-final-report.md`**, this report. No pre-existing repository file was modified. Entry hashes were captured before review; all pre-existing file hashes and presence were checked again before and after this report. Scratch scripts and raw logs are under `/home/d/.hermes/cache/scratch/chord-a3/`; they are review evidence, not shipped code, and may be pruned. The existing profile documentation-verification skill received reusable threat-model/historical-harness/locator lessons outside this repository.

## Independent resolution of A2-B1

**Classification: accepted privileged-host limitation, not an unresolved product-contract violation. A2-B1 is independently superseded as a Block 050 engineering blocker, without retracting any of A2's exploit/characterization evidence.**

1. **Normative scope predates this decision.** `docs/internal/047-public-api-compatibility.md` explicitly classifies generic `commitRun`, authority configuration, admission and lifecycle methods as trusted-host administration, forbids exposing the SDK as a client endpoint, and calls `projectContext` a scoped view rather than authentication. `041-authority-design.md` explicitly states that exposing the host SDK to an actor defeats the boundary. `050-product-contract.md` §1.5 excludes identity-provider and hostile-adapter sandbox claims, §3.3 classifies generic CAS as Class B trusted-host administration, and §5.2 defines Level A as trusted-host/single-process/in-memory. These are not a newly invented exemption.
2. **The actual capability is possession of the host API reference, not the provenance of JSON.** The SDK closure owns the state owner. `packages/core/src/sdk/chord.js#commitRun` calls `packages/core/src/registry/owner.js#install`; `HostCommitRequest` validates exactly the request shape, not a credential. Anyone given this method can submit contract-valid JSON. A2 correctly demonstrated authority revision rewind and grant insertion. The dedicated authority setter's +1 requirement is not a universal constraint on privileged maintenance. README §5.2 explicitly discloses that bypass.
3. **Ordinary actor data does not acquire the capability through the supported seams.** Inspected exact spec/packet/context/result contracts, projection shaping, runtime invocation and the owner wrapper. No request-key-based SDK dispatch, network actor endpoint, executable evaluation or actor-to-administrative-method router was found in the source inventory. The only source `commitRun` call sites are the SDK wrapper and private owner transactions/install. Frozen packet plus scalar correlation context contain no SDK/owner/registry/authority handle; projection returns validated detached data. Host callbacks/router configuration are supplied by the embedding host, not extracted as executable code from actor data.
4. **Independent negative execution, not just convention.** Node and Bun probes recursively checked projection/packet/context data, rejected injected administrative fields in spec, task packet and context request with `INVALID_SHAPE` and unchanged canonical state, and submitted an adapter result carrying a forged commit request. That result did not become a successful execution result or change installed authority; the already-dispatched effect became uncertain. A2's isolation and maintenance-characterization tests also ran in the full suite. Denied admission/dispatch, role-derived authority, foreign scope/run, expiry/revocation, stale CAS and approval misuse remain covered by the live regression suite.
5. **Explicit failure condition retained.** There is no host-authentication guard, restricted actor facade or sandbox. If an embedding application exposes the SDK or generic method dispatcher to actor requests, forwards actor-controlled identity as authenticated host context, hands out `issueGrants`/authority installation, or supplies hostile callbacks that capture the SDK, the separation is not enforceable by this API. **Such an embedding fails this boundary and would be a real deployment blocker.** No such exposed actor route was found in this checkout. Authentication, endpoint allowlisting and keeping host API references private remain host obligations; this report does not certify an unknown external deployment.

G2 is therefore verified for the documented governed data path, not for arbitrary access to the administrative SDK. Requiring administrative JSON to authenticate its author after the host deliberately exposes that SDK would add an unsupported stronger threat model. Conversely, green tests alone would not justify this decision: the pre-existing normative scope and inspected invocation chain are decisive.

## Test commands

Commands ran from `packages/core` except those explicitly marked repository-root or scratch-copy. Raw outputs and command records are in the scratch directory above.

| Command | Exit | Verified result |
|---|---:|---|
| `/home/d/.bun/bin/bun --version`; `node --version` | 0 each | 1.4.3; v24.22.1 |
| `/home/d/.bun/bin/bun test` | 0 | **193 pass, 0 fail, 1617 expect calls, 16 files** |
| `/home/d/.bun/bin/bun run src/verify-runtime.js` | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `node --test docs/internal/046-state-probes.mjs` (root) | 0 | **21 pass, 0 fail**, original expected-safe acceptance harness |
| `/home/d/.bun/bin/bun examples/quickstart.mjs`; `node examples/quickstart.mjs` | 0 each | `completed: true`, `adapterCalls: 1` |
| `/home/d/.bun/bin/bun examples/cross-actor-workflow.mjs`; `node examples/cross-actor-workflow.mjs` | 0 each | Accepted handoff; protected and builder effects **1 each**; missing-approval/pause negatives invoke no protected effect; approval consumed; snapshot restored; final revision **14**; replay equality with no extra effect |
| `node /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs`; `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` (root) | 0 each, final | Three injected request fields rejected; recursive data-only projection/arguments; forged result rejected; authority unchanged; unknown redispatch rejected; adapter calls remain **1** |
| `node docs/internal/046-evidence/unknown-redispatch.mjs` (root) | **1, expected negative** | Historical exploit diagnostic now stops at `replayTask` with **`RECONCILIATION_REQUIRED`**, before a second invocation; not a failed expected-safe acceptance test |
| `/home/d/.bun/bin/bun test tests/mutation-regression-closeout.test.js tests/developer-api-review.test.js` (each of the 19 retained A2 scratch copies) | control 0; 17 mutants 1; 1 mutant 0 | Independently reproduced **17 killed / 18 mutants**, sole equivalent survivor `approval-zero-task-revision`; all exits match A2 |
| `python /home/d/.hermes/cache/scratch/chord-a3/citation-audit.py` (root, corrected package-relative resolver) | 0, final | **11 documents**, 640 numeric source-citation occurrences, 147 symbol occurrences; no active unresolved target; three explicitly historical broken examples retained; README example blocks identical; 36 error literals, 32 guarantee rows, 45 Class A rows |
| Python original-harness byte comparison against `git show 1efafd1:docs/internal/046-state-probes.mjs` (root) | 0 | Exact original harness, SHA-256 `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb` |
| Python scratch-copy/live-source-and-tests comparison (root) | 0 | Every retained mutant equals current source/tests plus exactly its recorded mutation; control equals live tree |
| Python dependency / extension / import inventory (root) | 0 | Manifest runtime dependencies equal HEAD: only `@weipertda/sigiljs: 0.18.0`; no TS in source/tests/examples; JS ESM; no provider/framework imports |
| `git diff --check` (root) | **2, pre-existing** | Three trailing-whitespace lines in `049-final-report.md` and `release-notes-and-limitations.md`; not changed |
| Python entry/exit hash and new-file scope / report-whitespace checks (root) | 0 | No pre-existing file changed/deleted; only this report added; report has no trailing whitespace |

## Exit codes and results

All final behavioral acceptance checks passed. Counts above are independent executions against the dirty working tree; overlapping suites/probes/mutation runs are not summed as unique coverage. Mutation kills are assertion failures, not imports or parse errors. The equivalent survivor is supported by the exact StoredTask/TaskPacket schema: nonzero `task_revision` is not a supported stored property; A2 verifies attempted installation rejects unchanged. No exhaustive mutation score is claimed.

Two review-tool iterations are retained honestly: the first scratch probe imported internal `evaluateAuthority` from the root, where it is not exported; both runtimes exited 1. Correcting only that scratch import to the internal module produced the green runs above. The first reused citation scanner exited 1 because A2's mutation table uses package-relative `src/...` locators whereas its heading says repository-relative. Resolving those table paths within `packages/core` produced the final green audit; no source symbol was missing. Neither failure was repaired by changing production code or weakening an acceptance assertion.

The original Block 6A harness was located from the actual 046 final/atomicity reports, read, traced through Git history and byte-compared to its introducing commit, not assumed equivalent from its filename. Its companion exploit diagnostic was separately located, inspected and run with its original unsafe expectation preserved.

## Invariants verified

- **FCIS retained:** contracts clone/validate ordinary data; `evaluateAuthority` consumes explicit time with no I/O or mutation; history projection/reduction and transition validation perform no effects. SDK/private owner/runtime form the mutating shell. The Block 050 production diff adds validated data-shaping helpers, response-code fields and an optional audit timestamp; it adds no storage/network/provider layer and changes no authority evaluator guard. Not every registry utility is pure, and whole executions are not byte-deterministic while clocks/IDs use ambient sources.
- **CAS and atomicity:** installed private owner, early run-CAS, independent exact-next authority revision and optional incoming-authority expectation; failed candidates preserve canonical state/history; immutable-task guard remains. A2 mutation recheck genuinely distinguishes early CAS from downstream CAS.
- **Authority / approval:** no request-authored administrative installation through data seams, role strings do not confer authority, admission and dispatch are recomputed, exact attempt approvals are consumed and checked at commit. Data-shaping helpers install nothing; `Grant.assert` and `Approval.assert` are present and mutation-sensitive.
- **Effect truth / lifecycle:** paused/failed/cancelled runs cannot dispatch; malformed/failed post-dispatch results become uncertain, not silent success or automatic redispatch; unknown replay requires reconciliation; historical redispatch exploit no longer reaches its second call.
- **Evidence and isolation:** detached consumer reads, event and snapshot isolation, nonempty roundtrip, canonical workflow replay equality with zero replay effects, history/version/order/content validation and preserved kernel-owned history.
- **Minimal dependency / language:** the manifest's dependency set and pinned SigilJS version are unchanged from HEAD. The existing lockfile diff also corrects a digest, not a new dependency; no install or new lock change was made here. No TypeScript, framework or provider dependency was added. ARCH-18 passes in the full suite.
- Future durability, fencing, restart recovery and independent-process proofs remain labelled proposed. No current Proof 2/3 or distributed guarantee is inferred from design citations.

## Known limitations

- The supported boundary is host-mediated data governance, not an authenticated SDK endpoint, proxy-object sandbox, hostile JavaScript isolation or authentication of arbitrary actor-id strings. Full inspection, import, configuration and maintenance remain privileged.
- These executions exercise the checkout and self-referencing examples, not a newly packed or freshly installed release artifact. No public registry ownership, legal rights, remote canonical ownership or publication readiness was independently established by A3.
- Bun runs the core test suite; Node separately runs examples, boundary probes and standalone safety tests. No broader runtime compatibility matrix is claimed.
- Replay is structural committed-fact reconstruction, not cryptographic integrity or proof of external effect completion. Clock monotonicity is process-local; journal/ID timestamps are not universally injectable.
- A2's measured 18-mutant inventory is focused, not exhaustive. Its explicitly deferred historical mutation scripts remain deferred, not silently counted as kills.

## Severity-classified remaining issues

| ID | Severity / classification | Finding / disposition |
|---|---|---|
| A3-L1 | **LOW — documentation precision, nonblocking** | README §5.1 says authority decisions are frozen. Actual `deny` freezes its result/ids, while `allow` returns detached mutable data (`packages/core/src/platform/authorization.js`, `allow`). Both runtimes independently report `allowDecisionFrozen: false`; mutating that data leaves canonical state unchanged and cannot confer authority. Treat the frozen-decision sentence as superseded here: **decisions are recomputed non-transferable data, not uniformly frozen**. No FCIS/security failure demonstrated; a later authorized docs edit can tighten that sentence without introducing a redundant runtime freeze. |
| A3-L2 | **LOW — locator/readability, nonblocking** | A2's mutation table abbreviates source paths as package-relative although its heading calls all paths repository-relative. Explicit correction here: table `src/...` means `packages/core/src/...`. All symbols resolve. A1's limitations sentence saying the current tree “contains” repaired active SDK citations is also a historical-tense slip, not a currently missing target. |
| A3-L3 | **LOW — pre-existing whitespace, nonblocking** | Whole-tree `git diff --check` exits 2 on three lines outside A3 scope; preserved, no unrelated cleanup. |
| A3-R1 | **Accepted scope limitation; HIGH impact if violated by an embedding** | Administrative SDK exposure would allow the exact A2-B1 JSON maintenance bypass. No such actor endpoint is implemented here. Host must keep the SDK private and authenticate/allowlist its own external interface. |
| RELEASE-1 | **BLOCKER for distribution, not Block 051 engineering** | npm scope/publication authority and final canonical repository/remote decision remain maintainer-owned. Baseline §13.6 already superseded the claim that the target GitHub repository was missing; A3 does not reassert that disproved claim or perform a new network certification. |
| RELEASE-2 | **BLOCKER for redistribution/publication, not Block 051 engineering** | Legal chain-of-title/redistribution clearance remains unestablished by this review; maintainer attestation is not independent legal clearance. |
| RELEASE-3 | **BLOCKER for distribution, not Block 051 engineering** | Fresh final-identity pack, installed-consumer and independent artifact/provenance gates remain required. Historical artifacts/results cannot stand in for the newly chosen package identity. |

## Blockers

**No remaining blocker to Block 050 engineering completion within the documented threat model.** A2-B1's observed privileged behavior is retained and independently verified, but its conditional stronger criterion is not the normative acceptance criterion. There is no evidence of an ordinary actor-data route exercising that capability. An actual exposed actor maintenance endpoint would change this verdict to BLOCKED; it must not be waived by reference to this report.

Public distribution/publication remains **BLOCKED** by RELEASE-1 through RELEASE-3. G9–G12 are not newly certified by local runtime checks, and no launch/publication authorization is given.

## Next-pass readiness

**Block 050 engineering gate: COMPLETE. Entry into Block 051: AUTHORIZED.** Preserve this working tree and the A1/A2 evidence; do not treat HEAD alone as the reviewed source. Carry the explicit host-only boundary and minor documentation qualifications forward. Resolve the proposed design's maintainer decisions before implementation choices that depend on them; entry authorization is not permission to silently choose a new dependency, schema migration or stronger sandbox contract. **No Part B or Block 051 implementation was performed in A3.**
