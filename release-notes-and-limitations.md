# Chord 0.4.0-preview.1 — Release Notes & Limitations

**Status:** Public preview candidate (not published to npm)  
**Package:** `@weipertda/chord@0.4.0-preview.1`  
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

## Known Limitations

- **Single-process only** - No built-in durable distributed execution or cross-process distributed CAS
- **In-memory state** - No built-in persistence; host must manage snapshots
- **No exactly-once guarantees** - Universal exactly-once external effects not guaranteed; cancellation cannot undo dispatched effects
- **Trusted host model** - No sandboxing of arbitrary hostile in-process adapters; host is responsible for authentication and security
- **Unsigned evidence** - No cryptographic tamper-proof evidence
- **No automatic auth** - No automatic independent authentication of principals
- **Experimental API** - No stable 1.0 API guarantee; APIs may change
- **Limited replay** - Replay reconstructs from recorded baseline only; missing history causes rejection

## Usage Notes

- Host must authenticate users and manage authority
- Use explicit revisions when proposals depend on prior reads
- Context filtering is not automatic content redaction
- Do not put secrets in task payloads
- Examples show trusted host setup patterns

## Installation (local)
```bash
npm install ./weipertda-chord-0.4.0-preview.1.tgz
```
