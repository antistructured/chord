# Block 054 — Pass 4: External Clean-Project Consumer Proof

**Agent:** consumer-agent  
**Status:** COMPLETE  
**Date:** 2026-10-30  
**Publication:** NOT AUTHORIZED

## Candidate under test

The candidate was packed from the protected working tree, not published:

```text
package: @antistructured/chord@0.4.0-preview.1
tarball: /tmp/opencode/chord-054-consumer/antistructured-chord-0.4.0-preview.1.tgz
sha256: 30422ad18795063fcea7a90f55b47ba3d7897e3cfd0cb57490c1fa98b3dd0c0b
files: 74
```

The tarball is a temporary local proof artifact. It is not a sealed release artifact, version bump,
publication, tag or commit. The payload includes `README.md`, the public examples, the four entry
points and `src/interop/conformance.js`. It excludes tests, internal audits and `src/verify-runtime.js`.

## Fresh consumer

```text
/tmp/opencode/chord-054-consumer/consumer
```

The consumer is outside the repository and declares the tarball as its explicit dependency:

```json
{
  "name": "chord-054-consumer",
  "private": true,
  "type": "module",
  "dependencies": {
    "@antistructured/chord": "file:../antistructured-chord-0.4.0-preview.1.tgz"
  }
}
```

Install command:

```bash
npm install --ignore-scripts --no-audit --no-fund
```

Result: `added 2 packages in 1s` (Chord and SigilJS 0.18.0). No repository path, workspace link or
internal source import was used.

## Consumer checks

`consumer.mjs` imports only the declared public entry points:

- `@antistructured/chord`
- `@antistructured/chord/sdk`
- `@antistructured/chord/platform`
- `@antistructured/chord/interop`

It verifies:

1. Installed name and version are `@antistructured/chord@0.4.0-preview.1`.
2. The manifest exposes exactly `.`, `./sdk`, `./platform` and `./interop`.
3. Export counts are root **64**, `/sdk` **1**, `/platform` **22**, `/interop` **29**.
4. Root `createChord` is the same function as `/sdk` `createChord`.
5. Root `runAdapterConformance` is the same function as `/interop` `runAdapterConformance`.
6. A complete legacy governed workflow runs through the public SDK: authority snapshot, task grant,
   queueing, one adapter call, one completed task.
7. Both reference adapters pass `runAdapterConformance`: **27 passed / 0 failed / 5 skipped** each.
8. An undocumented deep import is rejected. Node reports `ERR_PACKAGE_PATH_NOT_EXPORTED`; Bun reports
   `ERR_MODULE_NOT_FOUND`. Both are closed failures, not successful internal access.

## Results

```text
node consumer.mjs
{"ok":true,"package":"@antistructured/chord","version":"0.4.0-preview.1","exports":{"root":64,"sdk":1,"platform":22,"interop":29},"workflow":{"completed":true,"adapterCalls":1,"taskStatus":"completed"},"conformance":[{"adapter_id":"chord.mock-agent","passed":27,"skipped":5},{"adapter_id":"chord.local-tool","passed":27,"skipped":5}],"deepImportRejected":"ERR_PACKAGE_PATH_NOT_EXPORTED"}

bun consumer.mjs
{"ok":true,"package":"@antistructured/chord","version":"0.4.0-preview.1","exports":{"root":64,"sdk":1,"platform":22,"interop":29},"workflow":{"completed":true,"adapterCalls":1,"taskStatus":"completed"},"conformance":[{"adapter_id":"chord.mock-agent","passed":27,"skipped":5},{"adapter_id":"chord.local-tool","passed":27,"skipped":5}],"deepImportRejected":"ERR_MODULE_NOT_FOUND"}
```

The installed package’s shipped examples also pass from the consumer directory:

```text
node node_modules/@antistructured/chord/examples/adapter-conformance.mjs  exit 0  ok: true
bun  node_modules/@antistructured/chord/examples/adapter-conformance.mjs  exit 0  ok: true
node node_modules/@antistructured/chord/examples/quickstart.mjs           exit 0  { completed: true, adapterCalls: 1 }
bun  node_modules/@antistructured/chord/examples/quickstart.mjs           exit 0  { completed: true, adapterCalls: 1 }
```

## Boundary notes

- Bun’s deep-import error code differs from Node’s, but both reject the undocumented subpath. The
  package boundary is therefore not silently open on either runtime.
- The conformance report proves protocol/adapter behavior, not a physical provider effect, durable
  participant idempotency or exactly-once semantics.
- The temporary tarball is not a release candidate approval. Legal/license, publication, version and
  sealed-artifact gates remain outside this pass.

## Gate

A fresh outside-repo consumer installed the packed candidate and exercised the public root, SDK,
platform and interop entry points without internal imports. Proceed to Pass 5.
