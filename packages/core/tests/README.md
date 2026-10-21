# Tests

Run with [Bun](https://bun.sh) from `packages/core`:

```bash
bun test
```

The immutable Block 6A probes run separately from the repository root:

```bash
node --test docs/internal/046-state-probes.mjs
```

Block 6B adds integrity, lifecycle, admission, recovery, replay and architecture
regressions. See `docs/internal/047-invariant-verification.md` at repository root
for exact invariant/test mapping. Counts in historical reports are not current
release approval.

Files:
- `transitions.test.js` — guarded task/queue/artifact/domain state machines,
  ambiguity → `uncertain`, commit-revision guards.
- `adversarial.test.js` — authority boundary: identity/authority forgery, roles
  vs capabilities, scope/version/run isolation, expiry/revocation boundaries,
  deny/allow ordering, approval misuse, runtime boundaries, approval gate.
- `contracts.test.js` — SigilJS closed contracts, ingress, snapshot import.
- `hardening.test.js` — parsing, dead-letter, contract enforcement, dequeue.

`fixtures/host.js` provides trusted-host stand-ins (`installHost`,
`createAdaptiveAuthority`) used by the suites.
