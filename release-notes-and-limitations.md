# Chord 0.4.0-preview.1 — Release Notes & Limitations

**Status:** Public preview candidate (not published to npm)  
**Package:** `@antistructured/chord@0.4.0-preview.1`  
**License:** Apache-2.0  

## What's New / Highlights

This preview provides a governed coordination kernel with:
- **Contract-validated intent** via SigilJS
- **Host-issued scoped authority** with grants, denials, capabilities, and attempt-bound approvals
- **Revision-aware shared state** with atomic commits
- **Actor handoffs** with revision preconditions
- **Human approval gates** for sensitive operations
- **Uncertain-effect reconciliation** for safe handling of ambiguous outcomes
- **Reconstructable execution evidence** with pure replay from recorded history
- **Snapshot/restore** for session continuity
- **Experimental local SQLite restart** and one-machine fenced-owner/actor coordination
- **Experimental provider-neutral adapter protocol** with bridge/server, reference adapters and a public conformance runner

## Known Limitations

- **Single-machine only** - No multi-machine coordination or distributed CAS; the 052 fenced-owner/actor mode is a bounded one-machine subset
- **Memory by default** - Opt-in local SQLite restart is available, but it is not snapshot import, full crash recovery or a distributed store
- **Adapter conformance is not authority** - A passing report does not grant permission or prove a physical effect; the participant cache is not durable
- **No exactly-once guarantees** - Universal exactly-once external effects not guaranteed; cancellation cannot undo dispatched effects
- **Trusted host model** - No sandboxing of arbitrary hostile in-process adapters; host is responsible for authentication and security
- **Unsigned evidence** - No cryptographic tamper-proof evidence
- **No automatic auth** - No automatic independent authentication of principals
- **Experimental API** - No stable 1.0 API guarantee; APIs may change
- **Limited replay** - Replay reconstructs from recorded baseline only; missing history causes rejection
- **Experimental interop** - No network transport, remote authentication, durable participant idempotency or exactly-once external effect

## Usage Notes

- Host must authenticate users and manage authority
- Use explicit revisions when proposals depend on prior reads
- Context filtering is not automatic content redaction
- Do not put secrets in task payloads
- Examples show trusted host setup patterns

## Installation (local)
The package is not published to npm, and no release tarball is shipped in this repository.
Install from the local checkout instead:
```bash
npm install file:/path/to/chord/packages/core
```

To install from a tarball you build yourself, run `npm pack` in `packages/core` and install
the generated file:
```bash
cd packages/core && npm pack --ignore-scripts
npm install ./antistructured-chord-0.4.0-preview.1.tgz
```
