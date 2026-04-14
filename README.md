# Chord v0.3.0

**Chord** is a **Mixed-Entity Coordination Kernel**.

This package is a JS-first, Bun-oriented production scaffold for:
- coordination specs
- execution bridge task packets
- registry/state tracking
- runtime loop + queue
- adapter routing
- audit + replay
- CLI + demo flow

Guiding principle:

> it only helps if

## Package
- `@chord/core`

## Quick start

```bash
cd packages/core
bun install
bun run demo:via
```

## Notes
This is a full production-ready **copy/scaffold** of Chord's architecture in its own folder.
It is intended to be a stable working base inside Antigravity for further hardening,
tests, and feature completion.
