# Developer guides

Chord is an embeddable, framework-neutral JavaScript ESM library, not an agent framework or a service.
All APIs and the local preview package are experimental. Start with one governed task before choosing durability or IPC.

## Choose a workflow

| Goal | Guide | Mode / proof boundary |
|---|---|---|
| Complete a first governed task | [First task](first-task.md) | Memory; one mock actor, no external effect. |
| Handoff and approve protected work | [Two actors](two-actor.md) | One process, separate identities, snapshot boundary. |
| Recover after stopping/crashing a process | [Durable restart](durable-restart.md) | Exclusive sequential v1 SQLite, not concurrent owners. |
| Collaborate across local processes | [Cross-process](cross-process.md) | v2 SQLite; one owner, authenticated actor IPC. |
| Connect a tool, agent or service | [Adapter](adapter.md) | Kernel dispatch through bridge/server; memory transport example. |
| Challenge a safe adapter fixture | [Conformance](conformance.md) | Scope-aware checks, not certification. |

## Setup

Run this block from the **repository root**. Install Node and Bun beforehand; measured Linux
versions are Node v24.22.1 and Bun 1.4.3, not a minimum-version or all-platform promise.
Durable examples need `node:sqlite`. Set `TMPDIR` to an existing private absolute local scratch
directory. No credentials are required. Frozen install uses the checked-in package lockfile.

```bash
export CHORD_REPO="$PWD"
: "${TMPDIR:?Set TMPDIR to an existing private absolute local scratch directory}"
export CHORD_EVIDENCE="$(mktemp -d "$TMPDIR/chord-guides.XXXXXX")"
export N="$(node -p process.execPath)"
export B="$(command -v bun)"
"$N" --version
"$B" --version
(cd "$CHORD_REPO/packages/core" && "$B" install --frozen-lockfile)
```

Guide command blocks assume this same shell and repository-root cwd. Each proof directory must
be **new**; rerunning setup gives a new evidence root. Scripts import only public package entry
points plus runtime standard libraries, and are shipped in `examples/`. No global CLI is installed.

## Local consumer installation

This creates a **private local tarball and private consumer**, not a publication. npm's cache must
already contain SigilJS 0.18.0 for the explicit offline install. If offline fails, stop and provision
the dependency cache deliberately; there is no automatic network fallback in these commands.
No version bump, registry publish, tag or release is involved.

```bash
(cd "$CHORD_REPO/packages/core" && npm pack --ignore-scripts --pack-destination "$CHORD_EVIDENCE")
mkdir "$CHORD_EVIDENCE/consumer"
printf '{"private":true,"type":"module"}
' > "$CHORD_EVIDENCE/consumer/package.json"
(cd "$CHORD_EVIDENCE/consumer" && npm install --offline --ignore-scripts --no-audit --no-fund --save-exact "$CHORD_EVIDENCE/antistructured-chord-0.4.0-preview.1.tgz")
(cd "$CHORD_EVIDENCE/consumer" && "$N" node_modules/@antistructured/chord/examples/quickstart.mjs)
(cd "$CHORD_EVIDENCE/consumer" && "$B" node_modules/@antistructured/chord/examples/quickstart.mjs)
```

In that consumer, run other shipped examples from `node_modules/@antistructured/chord/examples/`
and supply fresh absolute evidence paths where requested. This directory is not an exported module
subpath: run the script by file path, but import APIs through documented bare exports.
The repository guides/internal reports are **not included** in the curated tarball.

## Trust roles and resource lifecycle

| Role | Owns | Must not be mistaken for |
|---|---|---|
| Embedding host | Authentication, clock, installed principals/grants/approvals/policy, secrets, private files and process supervision | An actor's self-asserted identity. Never expose a generic admin method dispatcher. |
| Actor | Bounded authenticated requests, scoped observations and handoff responses | An owner, administrator or grant issuer; a role/capability label grants nothing. |
| Kernel execution owner | Authorization, attempts, canonical state/history and result acceptance | Physical control of an external effect or a second simultaneously valid owner. |
| Adapter bridge / participant server | Captured execution transport, reply correlation / handler invocation | Actor command ingress, human authentication, scheduling or an authority evaluator. |
| Downstream effect service | Actual effect, durable semantic dedupe and generation checks where needed | Automatically fenced merely because context contains a token. |

Memory loses live state on exit. V1 restart requires host **stop/join before recovery**. V2 requires
pinned run/incarnation identity, one trusted shared clock, explicit acquire/renew/release and fresh
channel enrollment after restart; v1/v2 cannot cross-open and have no migration. Use `try/finally`
for stores/owners, bridges, servers and transports. Await/drain work before release/close where
possible; detach listeners, disconnect and **join children separately**. Closing is not cancellation.

## Unknown means reconcile, not retry

An effect can happen without a committed result. Timeout, cancel, shutdown, expired owner, process
exit or malformed response does **not** prove nonexecution. Quarantine retains `uncertain` task /
`unknown` operation knowledge. Preserve evidence, stop blind dispatch, authenticate a
human and use host `reconcileTask` with the current revision and matching evidence. Outcomes are
`confirmed_completed` + `receipt`, `confirmed_not_executed` + `no_effect_confirmation`,
`authorized_compensated` + `compensation_receipt`, or `still_unknown` + `operator_review`.
Only eligible confirmed nonexecution permits explicit readmission; approval consumption is not undone.
Unknown local COMMIT acknowledgement also requires exact durable-history inspection, not a new command ID.
See [error handling and recovery](../../packages/core/README.md#raw-store-and-failure-handling-trusted-host-only)
and [v2 takeover limits](../../packages/core/README.md#leases-takeover-and-unknown-outcomes).

Kernel fencing prevents stale **canonical commits**, not every stale physical invocation. A downstream
service must atomically track generations and stable logical-effect keys with semantic mismatch checks;
it can accept an old request before it observes a higher generation. No exactly-once guarantee follows.
