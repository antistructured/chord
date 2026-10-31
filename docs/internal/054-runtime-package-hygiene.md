# Block 054 — Pass 6: Runtime and Package Hygiene

**Agent:** compatibility-agent  
**Status:** COMPLETE  
**Date:** 2026-10-30  
**Publication:** NOT AUTHORIZED

## Candidate payload

Repacked from the protected working tree after Pass 5:

```text
package: @antistructured/chord@0.4.0-preview.1
tarball: /tmp/opencode/chord-054-pass6/antistructured-chord-0.4.0-preview.1.tgz
sha256: cd229f7c2b857ba19ddcf7d62712cc667a80a05e71a56f60d3e23648b7b14609
files: 74
package size: 120.3 kB
unpacked size: 451.0 kB
```

The tarball is a temporary local inspection artifact, not a sealed release, version bump, tag,
publication or commit. Pass 7 later replaced machine-specific README paths and repacked; the final
Pass 7 hash is `c951414c1fd561acb1a271b9fcec155a74c53fd4da5899bb61db99a4fdeba364`.

## Manifest and payload checks

- `package.json` exposes exactly `.`, `./sdk`, `./platform` and `./interop`.
- The only runtime dependency is `@weipertda/sigiljs@0.18.0`.
- The payload contains 74 regular files and no symlinks, device nodes or other non-regular entries.
- No `tests/`, `docs/`, `.history/`, `node_modules/`, `.env`, `.sqlite`, `.tgz`, `.ts`, `.map` or
  `src/verify-runtime.js` entry is packed.
- `src/interop/conformance.js` and `examples/adapter-conformance.mjs` are present.
- The six public examples are present: quickstart, cross-actor workflow, adapter interop, adapter
  conformance, process recovery and two-process coordination.
- `src/` contains no TypeScript, no `bun:` imports and no provider/framework imports outside
  `node:` / relative modules / SigilJS.
- Public examples contain no undocumented package subpath or relative `src/` import. Two historical
  example README files mention `src/verify-runtime.js`, but those directories are not in the package
  payload.

## Runtime compatibility

All six public examples passed on Node 24.22.1 and Bun 1.4.3:

```text
node examples/quickstart.mjs                         { completed: true, adapterCalls: 1 }
bun  examples/quickstart.mjs                         { completed: true, adapterCalls: 1 }
node examples/cross-actor-workflow.mjs               replay_verified: true, negative_effect_count: 0
bun  examples/cross-actor-workflow.mjs               replay_verified: true, negative_effect_count: 0
node examples/adapter-interop.mjs                    replay_matches: true, server_executions: 1
bun  examples/adapter-interop.mjs                    replay_matches: true, server_executions: 1
node examples/adapter-conformance.mjs                ok: true, 0 failures
bun  examples/adapter-conformance.mjs                ok: true, 0 failures
node examples/process-recovery.mjs <new-dir> node    B5 PASS, committed_effects: 1, ambiguous_redispatches: 0
bun  examples/process-recovery.mjs <new-dir> bun     B5 PASS, committed_effects: 1, ambiguous_redispatches: 0
node examples/two-process-coordination.mjs <new-dir> node node  ok: true, effects: 2, replayMatches: true
bun  examples/two-process-coordination.mjs <new-dir> bun bun    ok: true, effects: 2, replayMatches: true
```

The process examples require new output directories and were run in
`/tmp/opencode/chord-054-pass6/runtime`. They use real child processes, not fixtures.

## Test compatibility

- Bun full suite: **427 pass / 0 fail / 1770 `expect()` calls / 30 files / 125.02s**.
- Node shared suite (the 14 files that do not import `bun:test`): **234 pass / 0 fail / 81.14s**.
- The 16 Bun-only test files remain Bun-native; this is not a full Node-suite claim.

One existing Node timing test (`ipc-correlation` opt-in timeout) failed only under a loaded 14-file
parallel run because its 30 ms deadline expired before the deliberate 10 ms late-reply check. The
file passed in isolation. The test deadline was widened to 250 ms; it still exercises timeout,
late-response isolation and no-retry behavior, but no longer tests scheduler speed. The full Node
shared suite then passed 234/234.

## Boundary notes

- No lint script exists in this candidate. Syntax checks were run with `node --check` on changed
  entry files during the passes.
- Bun’s deep-import rejection code differs from Node’s, but both reject undocumented subpaths; see
  Pass 4.
- The payload is curated by the existing `files` list, not by a separate build step. Adding a public
  example requires updating that list; `examples/adapter-conformance.mjs` was added.
- No multi-machine, network-transport or exactly-once claim is introduced by packaging.

## Gate

The current package payload is internally consistent, free of test/internal-doc leakage, resolvable
through the declared entry points, and exercised on both supported local runtimes. Proceed to Pass 7.
