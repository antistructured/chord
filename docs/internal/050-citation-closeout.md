# Block 050 — Citation closeout

## Pass

**A1 — documentation-verification-agent. PASS for documentation closeout within the stated Level A scope.** This is not A2, a release approval, an implementation pass, or a claim that every historical measurement has been reproduced.

Repository: `/home/d/Workspace/other-projects/chord`. Branch `base`; HEAD `08728e48772db14a247add9143669a8e0eab01fa`. The tested artifact is the **pre-existing dirty Block 050 working tree**, not committed HEAD. Runtime checks used `/home/d/.bun/bin/bun` **1.4.3** and Node **v24.22.1**. No install, source/test edit, manifest/lock edit, staging, commit, checkout, restore, reset, clean, stash, push, tag or publication was performed.

`module#symbol` means “open the named module and search for this function/member,” not a generated HTML anchor. Source references were selected from the inspected claim, not shifted by an assumed line offset. Active references into amended 050 documents use section titles where appropriate.

## Files inspected

All pre-existing documents in the requested set were read:

- `README.md`
- `packages/core/README.md`
- `docs/internal/050-baseline-lock.md`
- `docs/internal/050-product-contract.md`
- `docs/internal/050-developer-api-review.md`
- `docs/internal/050-docs-verification.md`
- `docs/internal/050-durable-coordination-design.md`
- `docs/internal/050-developer-proof-spec.md`
- `docs/internal/050-review.md`

Current implementation evidence included:

- `packages/core/src/sdk/{chord,index}.js`
- `packages/core/src/contracts/sigils.js`
- `packages/core/src/registry/{owner,registry,snapshot,query}.js`
- `packages/core/src/platform/{authorization,runtime-loop,journal-audit,state-invariants,history,trace-reducer,reconciliation,recovery-policy,attempts,transitions,task-queue,event-journal,handoff,approval-flow,adapter-routing,policy,index}.js`
- `packages/core/src/execution/{task-packets,results}.js`
- `packages/core/src/{index,verify-runtime}.js`, `packages/core/src/types/index.js`
- `packages/core/src/utils/{clone,id}.js`, `packages/core/src/runtime/adapter.js`
- `packages/core/package.json` and installed `packages/core/node_modules/@weipertda/sigiljs/src/sigil.js` (`createSigil`, `sigil.version`)
- Both shipped examples, current test-title declarations, and the complete executed core suite and standalone state probes.

## Files changed

Modified documentation only:

1. `README.md`
2. `packages/core/README.md`
3. `docs/internal/050-baseline-lock.md`
4. `docs/internal/050-product-contract.md`
5. `docs/internal/050-developer-api-review.md`
6. `docs/internal/050-docs-verification.md`
7. `docs/internal/050-durable-coordination-design.md`
8. `docs/internal/050-developer-proof-spec.md`
9. `docs/internal/050-review.md`

Created: `docs/internal/050-citation-closeout.md` (this report).

Key corrections:

- Replaced stale/malformed active SDK locators with inspected module/function/member references; repaired citation-index descriptions rather than retaining obsolete numeric inventories. The SigilJS reference now identifies the installed exact version and `createSigil`/`sigil.version` instead of an ambiguous package-local source path.
- Verified both snapshot CAS mechanisms. **`expectedRevision` compares with the installed run revision** via the public setter wrapper → `mutate` → `packages/core/src/registry/owner.js#transact`. **`expectedAuthorityRevision` compares with the incoming/next authority revision**, while the incoming snapshot must independently advance exactly +1 (or start at 0). Both mismatches raise `STALE_REVISION` and leave canonical state unchanged. The proof-spec already had the run-CAS correction at A1 entry; A1 fixed its locator and clarified the next-revision detail.
- Verified the documented union already contained **36** literal error/decision/result codes including `IMMUTABLE_TASK`; corrected the review’s contrary present-tense finding by explicit supersession. Added a direct immutable-task host-commit probe. `UNKNOWN` is a separate uncertainty diagnostic fallback, not an omitted member of that documented union; arbitrary error strings are not made into a promised closed public API.
- Corrected claims about grant validation (`createTaskGrant` really calls `Grant.assert`), host authentication, privileged `commitRun`, `CoordSpec` descriptive registration, public subpaths, runtime support inference, and independently executed runs versus replay of the same journal.
- Distinguished pre-helper setup measurements from the shipped helper-based examples; corrected literal contract field counts. Counted **32** current README guarantee rows, not 23, and retained **45** Class A rows.
- Kept all durable storage/fencing/recovery and Proof 2/3 machinery explicitly future-only. Corrected the unsafe W1 expectation: an expired committed claim is quarantined with zero recovery invocations, not automatically re-dispatched. Corrected the proposed transaction acknowledgement rule: missing acknowledgement does not prove rollback. Corrected the description of the process-local clock guard after restart and the audit comparator typo.
- Added prominent historical-reading notes and explicit supersession sections. Original run output, test totals, baseline snapshots and mutation outcomes remain historical evidence, not retroactively replaced by new measurements.

## Test commands

Commands below were actually executed. Package commands ran from `packages/core`; the state-probe and documentation commands ran from the repository root.

| Command | Exit | Result |
|---|---:|---|
| `/home/d/.bun/bin/bun test` | 0 | **166 pass, 0 fail, 1418 expect() calls, 15 files** |
| `/home/d/.bun/bin/bun run src/verify-runtime.js` | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `/home/d/.bun/bin/bun run examples/quickstart.mjs` | 0 | `completed: true`, `adapterCalls: 1` |
| `/home/d/.bun/bin/bun run examples/cross-actor-workflow.mjs` | 0 | completed; protected effect count 1, negative effect count 0, replay verified; final revision 14 |
| `node examples/quickstart.mjs` | 0 | `completed: true`, `adapterCalls: 1` |
| `node examples/cross-actor-workflow.mjs` | 0 | same governed outcome, zero-effect replay verified |
| `node --test docs/internal/046-state-probes.mjs` | 0 | **21 pass, 0 fail** |
| `node /home/d/.hermes/cache/scratch/chord-a1/probe.mjs` | 0 | independent CAS rejection/acceptance, unchanged state, Grant validation, SigilJS `.version()`, `IMMUTABLE_TASK`; exports **30/1/22**, SDK members **38** |
| `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-a1/probe.mjs` | 0 | same CAS/validation/state results; documented runtime-specific resolution difference below |
| `python /home/d/.hermes/cache/scratch/chord-a1/audit.py` | 0 (final run) | active source-range/symbol checks, error-union equality and example-block identity passed |
| Python quoted-test-title scan of README against current test declarations | 0 | 88 quoted title occurrences; no missing non-abbreviated titles |
| `git diff --check -- README.md packages/core/README.md` | 0 | no tracked A1 documentation whitespace errors |
| `git diff --check` | 2 | pre-existing trailing whitespace in `049-final-report.md` (two lines) and `release-notes-and-limitations.md` (one line); untouched |
| `npm view @antistructured/chord version --json --fetch-retries=0 --fetch-timeout=15000` | 1 | expected `E404`; no public registry install established |
| `npm view @weipertda/chord version --json --fetch-retries=0 --fetch-timeout=15000` | 1 | expected `E404`; no public registry install established |
| `npm view @weipertda/sigiljs@0.18.0 version --json --fetch-retries=0 --fetch-timeout=15000` | 0 | exact dependency version `0.18.0` available |
| Entry-hash versus exit-hash preservation check | 0 | only the nine existing permitted documentation files changed; no source, tests or other pre-existing file changed |

## Exit codes and results

All behavioral tests and the final active-documentation audit passed. Nonzero registry exits are the measured E404 outcomes, not build failures. The whole-tree whitespace failure predates A1 and was deliberately not repaired out of scope.

Before this report was added, the mechanical audit covered the **nine requested documents**, parsed **640 numeric source-citation occurrences** and **129 stable module/symbol occurrences**. All active ranges and stable symbol occurrences resolved under that scanner. Three invalid citation examples remain **only in the historical review body**: its malformed SDK range and two quotations of its claimed missing `src/sigil.js` path. They are explicitly superseded; they are not active implementation citations. These counts describe this scanner and the pre-closeout-report document set, not a remeasurement of Pass 7’s “1155” or “58/100” claims.

All **three JavaScript README blocks** remain byte-identical to the shipped examples (two root blocks and one package block). Both examples were exercised under Node and Bun. The mechanical symbol check is an existence check; semantic support came from reading the corresponding functions and targeted execution, not from a range-validity heuristic alone.

During verification, the first Bun probe exited 1 because it incorrectly assumed Node’s package-json export behavior applied to Bun. The corrected probe records resolution instead of asserting uniformity: Node 24.22.1 rejects `@antistructured/chord/package.json` with `ERR_PACKAGE_PATH_NOT_EXPORTED`, while Bun 1.4.3 `createRequire().resolve` resolves it. Both reject the tested internal contracts subpath. Documentation now states the observed distinction. Early citation-scanner failures caused by its `@`-path regex were fixed in scratch and the final audit passed; they were tooling issues, not source defects.

## Invariants verified

- Existing source/tests, examples, package manifest, lockfile, legal files, older reports and dirty work outside A1’s documentation scope were preserved by entry/exit file hashes.
- No revision, authority, approval-consumption, admission, replay, quarantine or immutable-task guard was modified.
- Snapshot run CAS and authority CAS are independent; stale requests leave all canonical state and history unchanged.
- A shaped Grant does not install authority; invalid grant windows reject; immutable task changes through a host commit raise `IMMUTABLE_TASK` unchanged.
- Dedicated admission remains atomic, dispatch/commit remain authority-checked, post-dispatch ambiguity remains quarantined, and replay remains effect-free, as exercised by the unchanged suite, state probes and canonical workflow.
- No durable store, network actor API, cross-process guarantee or Proof 2/3 implementation was introduced or promoted to a current capability.
- Original review mutation results remain historical; a survived removal mutation is not misrepresented as proof that the live assertion is absent.

## Known limitations

- The original Pass 7 “58 stale citations” count was not reproducible from its unavailable heuristic/probes and is not endorsed as an A1 measurement. The current tree contains malformed active SDK citations, which were repaired by semantic targets; some review examples of supposedly stale lines were themselves false.
- Historical baseline/review bodies intentionally retain old measured states, illustrative broken references and original run outputs with explicit supersession. A blanket “zero bad citation strings anywhere” claim would therefore be false.
- The scratch scanner is not a complete Markdown/JavaScript parser and does not prove every prose assertion or measure behavioral coverage. Static literal code sets are not a closed exported error enum. Future proof specifications still require their own design review and implementation verification.
- No A2 mutation pass, new proof harness/test file, fresh installed-consumer gate, pack/repack, storage implementation, runtime compatibility matrix, legal verification, authenticated npm ownership check, or remote mutation was performed.
- E404 establishes current public lookup failure, not namespace ownership, authenticated publication authority or proof a name was never published historically. No historical-registry claim is newly certified here.
- The earlier target-repository-existence correction in baseline §13.6 is retained as historical network evidence; A1 checked the configured local remote but did not independently re-probe GitHub canonical/mirror ownership.
- Scratch scripts and logs live at `/home/d/.hermes/cache/scratch/chord-a1/` (`entry-hashes.json`, `checks.json`, `citation-audit.json`, `probe.mjs`, `audit.py`, command logs and registry results). They are not repository artifacts and may be pruned. The reusable documentation-verification procedure was saved as a profile skill outside the repository.

## Blockers

**No blocker to A1 documentation closeout.** Existing release gates remain: npm scope/publication authority, canonical repository/remote decision, redistribution/chain-of-title clearance, and a freshly packed final-identity candidate with consumer and independent gates. Documentation verification grants none of those approvals.

Historical test/mutation coverage gaps remain for the next authorized testing pass. The out-of-scope whole-tree whitespace findings remain unchanged.

## Next-pass readiness

**Ready for the parent orchestrator’s A2 handoff; A2 was not executed.** Use the working tree and its preserved entry/exit evidence, not committed HEAD or the historical “58 stale” heuristic, as the starting point. A2 should validate remaining test/mutation findings independently and must not inherit the disproved assertions that `expectedRevision` is inert, `createTaskGrant` lacks `Grant.assert`, or the current documented union omits `IMMUTABLE_TASK`.
