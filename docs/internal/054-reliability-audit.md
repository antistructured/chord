# Block 054 — Pass 1: Baseline & Test Reliability

**Agent:** reliability-agent  
**Status:** CLASSIFIED  
**Date:** 2026-10-30  
**Publication:** NOT AUTHORIZED

## Source baseline

| Item | Value |
|---|---|
| Repository | `/home/d/Workspace/other-projects/chord` |
| Branch | `base` |
| HEAD | `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be` |
| Package | `@antistructured/chord` `0.4.0-preview.1` |
| Modified tracked paths | 23 |
| Untracked paths | 29 |

The working tree contains the uncommitted Block 052A corrections and the Block 053 interoperability implementation. All required Block 053 reports exist under `docs/internal/`:

- `053-interoperability-audit.md`
- `053-adapter-protocol.md`
- `053-adapter-runtime.md`
- `053-effect-safety.md`
- `053-reference-adapters.md`
- `053-consumer-integration.md`
- `053-protocol-conformance.md`
- `053-developer-guide.md`
- `053-final-report.md`

No historical audit report was modified to change its original conclusion.

## Exact-source verification

The canonical full Bun suite was run against the exact working tree after the Block 053 bridge adjustment.

```text
Command: bun test
Exit:    0
Result:  422 pass / 0 fail / 1759 expect() calls
Files:   29
Time:    110.68s
```

Shared Node suites were run with Node `v24.22.1` over every test file that imports `node:test`.

```text
Command: node --test <node:test files>
Exit:    0
Result:  229 pass / 0 fail
Time:    76.76s
```

The process-heavy suites were repeated in isolation under normal load.

```text
Command: bun test tests/actor-ingress.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js
Exit:    0
Result:  29 pass / 0 fail
Time:    53.92s
```

After adding the diagnostic hook described below, the storage suites were rerun on both runtimes.

```text
Bun:  33 pass / 0 fail (coordinated-storage, storage-adapter)
Node: 33 pass / 0 fail (coordinated-storage, storage-adapter)
```

## Previous intermittent failure

A prior full-suite run under host load average ~13 on 8 cores produced:

- pre-existing 5s `actor-ingress` test timeouts;
- the 20s child seam timeout in `coordinated-adversarial.test.js`;
- worker startup failures surfaced as `CoordinationError: STORAGE_UNAVAILABLE`.

The `STORAGE_UNAVAILABLE` stack ended at the open-time catch in `src/runtime/storage/coordinated-sqlite.js`. That catch covers, in order:

1. `lstatSync` of an existing database path;
2. `new DatabaseSync(path)`;
3. `PRAGMA quick_check`;
4. layout and existing-identity reads;
5. WAL/synchronous/busy-timeout setup;
6. create-mode layout transaction.

The sanitizer intentionally collapsed all non-corruption physical failures into `STORAGE_UNAVAILABLE`. No run produced a canonical-state corruption, unauthorized effect, or duplicate effect. The failures occurred during worker startup/opening, not during a successful canonical commit.

## Controlled investigation

- The exact-source full suite passed under normal load.
- The process-heavy suites passed repeatedly in isolation under normal load.
- An isolated `actor-ingress` run with a 30s per-test timeout previously passed 18/18 under the same load that made the 5s default timeout fail.
- A bounded descriptor-pressure run (`ulimit -n 64`) passed 7/7, so the prior event cannot be attributed specifically to descriptor exhaustion.
- The host remained disk-constrained (98% used) and memory-constrained (roughly 0.5 GiB available, heavy swap use) during the earlier failures.
- No deterministic product defect reproduced.

### Diagnostic improvement

An env-gated diagnostic was added at the trusted storage boundary in:

- `src/runtime/storage/coordinated-sqlite.js`
- `src/runtime/storage/sqlite.js`

When `CHORD_STORAGE_DIAGNOSTICS=1`, a sanitized failure writes one line to stderr containing only:

- `code` (for example `ENOENT`)
- `errcode` (SQLite numeric code or `null`)
- `syscall` (for example `lstat`)

It never writes paths, SQL, payloads, credentials, or raw error messages. Example verified against a missing coordinated store:

```text
chord.storage.diagnostic {"code":"ENOENT","errcode":null,"syscall":"lstat"}
```

Public error behavior is unchanged: the same operation still reports `STORAGE_UNAVAILABLE`.

## Classification

**CLASSIFIED — supported environmental limitation with controls documented.**

The intermittent failures are consistent with host resource pressure during concurrent child-process startup, not with a reproducible canonical-state or effect-safety defect. The earlier 422-test success was reproduced cleanly on the exact current source after the Block 053 bridge change.

## Controls for release gates

- Run the canonical full Bun suite with the default 5s timeout on an otherwise idle host.
- Run the shared Node suite separately.
- Run process-heavy suites in isolation and repeat them at least once.
- Do not raise default timeouts in repository tests to hide the issue.
- Use `CHORD_STORAGE_DIAGNOSTICS=1` only for trusted-host/test diagnosis.
- Treat any future `STORAGE_CORRUPT`, unauthorized effect, duplicate effect, or post-commit inconsistency as a hard stop, not as this P2 condition.

## Residual risk

Under extreme host load, child-process startup and test timeouts can still occur. This is bounded as a P2 test/process reliability observation. It does not weaken fencing, canonical commit boundaries, or effect safety.

## Gate

CLASSIFIED. Proceed to Pass 2.
