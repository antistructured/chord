# 040 — Repository reality audit

Block 1 status: PARTIAL. All eight audit passes executed; existing runtime validation and advertised demo fail. See [final report](040-audit-final-report.md) and [baseline transcript](040-baseline-transcript.md). Pass 1 inventory complete; no release approval.

## Checkout and installation evidence
- Branch `main`; HEAD `6b07802ba8639b29e7c48534612dbd60c946946d`; sole observed history entry `Initial commit – Chord v0.3.0 baseline` (`git log -5 --oneline`). Origin: https://github.com/weipertda/chord.git.
- Initial user modifications: `.gitignore`, `.vscode/settings.json`, `README.md`. Preserve these; no implementation edits authorized.
- No root package manifest. Actual package: `packages/core/package.json`, `@chord/core@0.3.0`, ES modules. `0.4.0-preview.1` is proposed, not declared.
- Available tools: Bun 1.3.14, Node v24.18.1, npm 12.0.2. Existing node_modules; no install performed.
- `bun pm ls --all` in packages/core: sigiljs@0.0.21 -> classnames@2.5.1; matches bun.lock. This is not proof of the desired validation library API.

## Layout and exposed surface
One package, no restructure justified. `src/` contains SDK, platform, registry, execution, contracts, runtime IO, CLI, demos, JSDoc types and utilities. `tests/hardening.test.js` is tracked; three example folders contain READMEs. No tracked CI workflow or TypeScript source found by git inventory. Tracked `.history/` contains historical copies, not runtime source.

Manifest export paths:
- `.` -> `src/index.js`: SDK + platform + registry query/snapshot + empty JSDoc types module.
- `./sdk` -> `src/sdk/index.js` -> chord.js.
- `./platform` -> `src/platform/index.js`: queue, event journal, adapter routing, policy, journal audit, runtime loop.
No bin, files whitelist, engine declaration, build or lint script. Detailed named surface classification follows in pass 7.

## Runnable commands (cwd packages/core)
- `bun test`, `npm test` (script invokes bun test).
- `bun run chord:run`, `bun run chord:replay --journal`, `bun run chord:audit`.
- `bun run demo:via` points to absent `src/demo/via-demo.js`; actual tracked demo is `src/demo/callaback-demo.js` (spelling preserved).
- `npm pack --dry-run` is applicable package tooling, not a manifest script.
- Existing direct entry `bun run src/verify-runtime.js`; inspect before execution.
CLI creates fresh in-memory Chord instances; it does not load root chord.config.json or persisted registry. README production-ready wording is not evidence.

## Evidence / inspected files
`README.md`, `packages/core/package.json`, `packages/core/bun.lock`, `chord.config.json`, `packages/core/tests/README.md`; `packages/core/src/{index.js,sdk/index.js,platform/index.js,types/index.js,cli/_shared.js,cli/run.js,cli/replay.js,cli/inspect-audit.js}`. Export/import declarations searched throughout `packages/core/src`. Git tracked-file list, status, log, remote and diff stat inspected; no user file content changed.

Files changed: this report only. Tests: none in this inventory pass; tool/version/dependency inventory commands succeeded. Blockers: broken advertised demo; no lint/CI; installed SigilJS identity/API requires pass 2. Next pass READY. No publish/tag/version change.
