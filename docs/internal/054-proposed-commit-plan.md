# Block 054 — Proposed commit plan

## Status

Planning artifact only. **No commit, staging, tag, push, version bump, or publication is authorized or performed by Block 054.** This plan is the missing Pass 8 output expected alongside `054-source-integrity.md`; it describes how the verified Block 052A/053/054 working tree could be committed later, once maintainer authorization exists.

## Verified baseline

```text
repository: /home/d/Workspace/other-projects/chord
branch:     base
HEAD:       72f96ab6cdc9d6948ffb7eacba527cc27a32a8be
package:    @antistructured/chord@0.4.0-preview.1 (unchanged)
```

The tracked HEAD is the Block 052 baseline. The current Block 052A/053/054 corrections are **uncommitted**. A hash of `72f96ab` therefore does **not** identify this release candidate; the working-tree manifest recorded in the Pass 9 evidence directory does.

## Exact working-tree inventory

Entry status captured before any Pass 9 execution:

```text
29 tracked modified paths
59 untracked paths
88 total status entries
622 files in the git-visible universe
  (git ls-files --cached --others --exclude-standard)
```

Manifest evidence (local scratch, prunable):

```text
/tmp/opencode/chord-054-pass9/entry-files.txt   sha256 82724246c61676bb29279f771a365a84e2eb5dd21e3387d493227b6cb331a963
/tmp/opencode/chord-054-pass9/entry-hashes.txt  sha256 5f59c6556b7b77b9ca1065d8fcb0939476043fd737d18bf88548438ef63e07b4
/tmp/opencode/chord-054-pass9/entry.diff        sha256 098344b8efe5d38e749bc7885316ff5c293141c4aaec47e681374336a52f1c9f
```

The manifest remained byte-identical after all Pass 9 verification; only the three new 054 reports were added afterwards.

## Classification of intended changes

### A. Production source — tracked modifications (Proposed group 1)

```text
packages/core/src/cli/_shared.js
packages/core/src/cli/inspect-audit.js
packages/core/src/coordination/commands.js
packages/core/src/coordination/runtime.js
packages/core/src/coordination/state.js
packages/core/src/index.js
packages/core/src/platform/adapter-routing.js
packages/core/src/platform/attempts.js
packages/core/src/platform/handoff.js
packages/core/src/platform/reconciliation.js
packages/core/src/platform/runtime-loop.js
packages/core/src/platform/state-invariants.js
packages/core/src/platform/task-queue.js
packages/core/src/platform/transitions.js
packages/core/src/registry/owner.js
packages/core/src/registry/registry.js
packages/core/src/registry/snapshot.js
packages/core/src/runtime/actor-client.js
packages/core/src/runtime/actor-ingress.js
packages/core/src/runtime/storage/coordinated-sqlite.js
packages/core/src/runtime/storage/sqlite.js
packages/core/src/sdk/chord.js
packages/core/src/sdk/coordinated-chord.js
```

### B. Production source — new files (Proposed group 1)

```text
packages/core/src/interop/adapter-bridge.js
packages/core/src/interop/adapter-protocol.js
packages/core/src/interop/adapter-server.js
packages/core/src/interop/conformance.js
packages/core/src/interop/conformance-participant.js
packages/core/src/interop/index.js
packages/core/src/interop/memory-transport.js
packages/core/src/interop/reference-adapters.js
packages/core/src/runtime/actor-transport.js
packages/core/src/runtime/storage/diagnostics.js
packages/core/src/utils/own.js
```

### C. Tests and test workers (Proposed group 2)

```text
packages/core/tests/adapter-conformance-fixture.test.js
packages/core/tests/adapter-conformance.test.js
packages/core/tests/adapter-protocol.test.js
packages/core/tests/adapter-protocol-worker.js
packages/core/tests/error-boundaries.test.js
packages/core/tests/identifier-integrity.test.js
packages/core/tests/ipc-correlation.test.js
packages/core/tests/ipc-correlation-worker.js
packages/core/tests/storage-diagnostics.test.js
```

### D. Public examples (Proposed group 3)

```text
packages/core/examples/adapter-conformance.mjs
packages/core/examples/adapter-interop.mjs
```

### E. Package metadata and shipped documentation (Proposed group 3)

```text
packages/core/package.json      additive exports/files only; dependency unchanged
packages/core/README.md
packages/core/CHANGELOG.md
packages/core/INTEGRITY.md
README.md
release-notes-and-limitations.md
```

### F. Developer documentation (Proposed group 3)

```text
docs/guides/README.md
docs/guides/first-task.md
docs/guides/two-actor.md
docs/guides/durable-restart.md
docs/guides/cross-process.md
docs/guides/adapter.md
docs/guides/conformance.md
```

### G. Historical and current internal evidence (Proposed group 4)

All new `docs/internal/052*`, `053*`, and `054*` reports, including this plan, `054-independent-review.md`, and `054-final-report.md`. These are append-only release evidence. Historical reports are **not** edited to change prior conclusions.

### Exclusions — must not be committed

- `/tmp/opencode/**` tarballs, installed consumers, logs and scratch manifests.
- `/home/d/.hermes/cache/scratch/**` evidence directories.
- Any `.sqlite`, `.db`, `.log`, `.tgz`, `node_modules/`, `.env`, or generated database file.
- The local documentation-verification skill changes outside the repository.

## Proposed commit sequence (when authorized)

Prefer a small number of reviewable commits, all on `base` and all after a clean verification of the final bytes:

1. **`feat(core): add adapter interoperability and conformance`**
   Groups A + B + C (implementation and its tests). Keeps the kernel/interop change reviewable without documentation noise.
2. **`docs(core): publish adapter examples and package metadata`**
   Groups D + E.
3. **`docs: add developer guides and Block 053/054 evidence`**
   Groups F + G.

If the maintainer prefers a single corrective commit, all four groups may be combined; the classification above still defines what must be staged and what must not. Do not use `git add -A` blindly.

## Pre-commit verification sequence

Run on the exact bytes to be committed, on an otherwise idle host:

```bash
cd packages/core
/home/d/.bun/bin/bun test
/home/d/.volta/tools/image/node/24.22.1/bin/node --test \
  ./tests/actor-ingress.test.js ./tests/adapter-conformance-fixture.test.js \
  ./tests/adapter-conformance.test.js ./tests/adapter-protocol.test.js \
  ./tests/authority-continuity.test.js ./tests/coordinated-adversarial.test.js \
  ./tests/coordinated-dispatch.test.js ./tests/coordinated-storage.test.js \
  ./tests/crash-recovery.test.js ./tests/durable-adversarial.test.js \
  ./tests/error-boundaries.test.js ./tests/identifier-integrity.test.js \
  ./tests/ipc-correlation.test.js ./tests/process-recovery.test.js \
  ./tests/storage-adapter.test.js ./tests/storage-diagnostics.test.js \
  ./tests/two-process-coordination.test.js
/home/d/.bun/bin/bun test $(cat /tmp/opencode/chord-054-pass9/node-shared-files.txt)
cd ../..
/home/d/.volta/tools/image/node/24.22.1/bin/node --test ./docs/internal/046-state-probes.mjs
/home/d/.bun/bin/bun test ./docs/internal/046-state-probes.mjs
cd packages/core
/home/d/.volta/tools/image/node/24.22.1/bin/node src/verify-runtime.js
/home/d/.bun/bin/bun src/verify-runtime.js
npm pack --ignore-scripts --json --pack-destination /tmp/opencode/chord-final
cd ../..
git diff --check
```

Then re-run the external-consumer tarball install, the six examples on both runtimes, and the separate-process proofs. Recompute the working-tree manifest and compare it to the entry manifest before committing.

## Integrity and licensing notes

- Package identity remains `@antistructured/chord@0.4.0-preview.1`; no version bump is proposed.
- The sole runtime dependency remains `@weipertda/sigiljs@0.18.0`.
- `LICENSE` (Apache-2.0), `NOTICE`, and `THIRD_PARTY_NOTICES.md` are already present and shipped.
- No secret material or machine-specific absolute path is present in the current package payload (verified in Pass 9).
- No historical audit report was modified to change an original conclusion.

## Gate

**Plan complete; commit not created.** The exact source snapshot is identified by the manifest above, not by HEAD. Execution requires explicit maintainer authorization and a fresh verification of the staged bytes.
