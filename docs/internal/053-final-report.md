# Block 053 — B9 Final Report: Adapter Protocol Interoperability

## Pass

**Block 053 B1–B9 COMPLETE for the bounded engineering scope below.** A versioned, provider-neutral execution-adapter protocol, host bridge, participant server, two reference adapters, memory transport, public `./interop` entry point, consumer example, conformance/adversarial tests and developer documentation are installed. Publication, version changes, commits, tags and pushes remain unauthorized and were not performed.

## Scope delivered

| Pass | Result |
|---|---|
| B1 | Interoperability audit and minimum additive design boundary |
| B2 | `chord.adapter-protocol.v1` design, compatibility and failure vocabulary |
| B3 | Pure contracts, bridge, server, reference adapters, memory transport and exports |
| B4 | Effect/fence safety analysis and delayed-result-after-release proof |
| B5 | Reference local-tool and mock-agent adapters plus memory transport |
| B6 | Public-export-only consumer example |
| B7 | 16 conformance/adversarial tests, including a real child process and kernel round trips |
| B8 | Developer guide and package README integration |
| B9 | This closeout report |

## Files added

- `packages/core/src/interop/adapter-protocol.js`
- `packages/core/src/interop/adapter-bridge.js`
- `packages/core/src/interop/adapter-server.js`
- `packages/core/src/interop/reference-adapters.js`
- `packages/core/src/interop/memory-transport.js`
- `packages/core/src/interop/index.js`
- `packages/core/tests/adapter-protocol.test.js`
- `packages/core/tests/adapter-protocol-worker.js`
- `packages/core/examples/adapter-interop.mjs`
- `docs/internal/053-adapter-protocol.md`
- `docs/internal/053-adapter-runtime.md`
- `docs/internal/053-effect-safety.md`
- `docs/internal/053-reference-adapters.md`
- `docs/internal/053-consumer-integration.md`
- `docs/internal/053-protocol-conformance.md`
- `docs/internal/053-developer-guide.md`
- `docs/internal/053-final-report.md`

## Files modified additively

- `packages/core/src/index.js`: re-export the interop surface.
- `packages/core/package.json`: add `"./interop"` and ship `examples/adapter-interop.mjs`.
- `packages/core/README.md`: four entry points, updated root export count, interop group, example and section.

No existing export was removed or renamed. No kernel scheduling, authority, storage, canonical schema or 052 protocol semantics were changed. No dependency was added.

## Verification

Environment: Node `v24.22.1`, Bun `1.4.3`, Linux.

| Command | Result |
|---|---|
| `bun test` in `packages/core` | **422 pass / 0 fail / 1759 expect() calls / 29 files / ~106s** |
| `node --test tests/adapter-protocol.test.js` | **16 pass / 0 fail** |
| `bun test tests/adapter-protocol.test.js` | **16 pass / 0 fail** |
| `bun run examples/adapter-interop.mjs` | Success JSON, `server_executions: 1`, replay equality |
| `node examples/adapter-interop.mjs` | Same success JSON |
| Import check of root/interop exports | Root **63**, interop **28**, sdk **1**, platform **22** |

The historical full-suite Node limitation remains: many pre-existing test files import `bun:test`, so a full Node `--test tests/*.test.js` run cannot execute them. The new test file itself passes under Node. Bun remains the canonical full-suite runtime, as recorded in B1.

**Reliability note:** after the final one-line bridge send-error normalization, a full-suite rerun under heavy host load (load average ~13 on 8 cores) hit the pre-existing 5s `actor-ingress` timeouts and 20s child seam timeout with worker `STORAGE_UNAVAILABLE`. Isolated `actor-ingress.test.js` with `--timeout 30000` passed **18/18**, and the interop file passed again. This is the open P2 test/process reliability observation recorded in B1, not a demonstrated interop regression.

## Invariants verified

- Legacy raw `{ execute }` adapters remain supported with the legacy context.
- Coordinated opt-in registration `{ adapter, execution_context: 'chord.execution-context.v2' }` is unchanged.
- Advertisement is descriptive only and cannot grant authority.
- Unsupported protocol/context fails before handler execution.
- The bridge carries exact kernel-captured task/attempt/operation identity and stable effect key.
- Replies are matched by fresh session/request identity; stale, duplicate, reordered and replacement-session replies cannot settle another request.
- Timeout/close/disconnect are local/unknown, never proof of non-execution.
- A delayed adapter result after owner release commits no canonical result and cannot complete the task.
- The kernel still stamps canonical identity and commits through the existing owner/attempt/authority/lease fences.
- Replay remains pure and equals the exported envelope.
- Lazy SQLite and zero-new-dependency constraints are preserved.
- No commit, push, tag, publish, version change or historical audit edit occurred.

## Residual limitations

1. **No remote exactly-once.** The final database check and the external effect are not atomic. A cooperating downstream must enforce generation fencing and semantic idempotency itself.
2. **No peer authentication.** The protocol assumes the host supplies a trusted transport. The memory transport and inherited IPC are not authenticated network services.
3. **No durable participant cache.** Server idempotency is in-memory for the server lifetime only.
4. **No sandbox.** In-process handlers have host process privileges.
5. **Cancel is best-effort.** Acknowledgement does not prove effect absence; the kernel does not expose a coordinated actor cancel endpoint.
6. **No provider discovery or framework integration.** This is an adapter protocol, not an agent framework, shell executor or cloud connector.
7. **Full Node suite not claimed.** Pre-existing files import `bun:test`; Bun is the canonical full-suite runtime.

## Next recommendations

- Add a real duplex network transport only with authentication, framing limits and explicit participant lifecycle review.
- If stronger effect guarantees are required, design downstream generation fencing and semantic idempotency in the participant, not by weakening kernel fences.
- If durable participant deduplication is needed, treat it as a separately reviewed effect-store concern, not as a hidden extension of the adapter server cache.
- Keep `/interop` experimental until a consumer integration and hostile-transport review justify a stability claim.
- Publication remains a separate release decision.
