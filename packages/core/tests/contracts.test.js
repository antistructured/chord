import { describe, test, expect } from "bun:test";
import * as C from "../src/contracts/sigils.js";
import { createChord } from "../src/sdk/chord.js";
import { createRuntimePolicy } from "../src/platform/policy.js";
import { createRegistry, registerTask, registerExecutionResult } from "../src/registry/registry.js";
import { exportRegistry, importRegistry } from "../src/registry/snapshot.js";
import { createIntentTaskPacket, createHandoffTaskPackets, normalizeExecutionResult, executeTask } from "../src/execution/task-packets.js";
import { enqueueTask } from "../src/platform/task-queue.js";
import { prepareAttemptRecord, activatePendingAttempt } from "../src/platform/attempts.js";
import { installHost, queueOptions } from "./fixtures/host.js";

const bindingFor = (registry, packet) => ({
  principal_id: "host-principal",
  actor_id: "worker-actor",
  capability: "execute",
  scope: {
    run_id: registry.run.run_id,
    project: packet.project,
    phase: packet.phase,
    task_id: packet.task_id,
    target_entity: packet.target_entity,
    resource: { kind: "task", id: packet.task_id }
  },
  approval_required: false
});

const schema_version = C.SCHEMA_VERSION;
const run = { run_id: "run1", schema_version, revision: 0 };
const scope = { run_id: "run1", project: "proj", phase: "phase", task_id: "task1", target_entity: "agent1", resource: { kind: "task", id: "task1" } };
const principal = { principal_id: "principal1", issuer: "host", kind: "service", authenticated_at: 0, expires_at: 100 };
const human = { ...principal, principal_id: "human1", kind: "human" };
const actor = { actor_id: "actor1", principal_id: "principal1", kind: "agent", roles: ["admin"], capabilities: ["build"], revoked_at: null };
const grant = { grant_id: "grant1", principal_id: "principal1", actor_id: "actor1", capability: "build", effect: "allow", scope, issued_at: 0, expires_at: 100, revoked_at: null, requires_approval: true };
const approval = { approval_id: "approval1", approver_principal_id: "human1", decision: "approved", run_id: "run1", schema_version, task_id: "task1", task_revision: 0, attempt_id: "attempt1", principal_id: "principal1", actor_id: "actor1", capability: "build", scope, issued_at: 0, expires_at: 100, revoked_at: null, consumed_by_attempt_id: null };
const authority = { schema_version, run_id: "run1", authority_revision: 0, principals: [principal, human], actors: [actor], grants: [grant], approvals: [approval] };
const attempt = { ...run, task_id: "task1", task_revision: 0, queue_id: "queue1", attempt_id: "attempt1", lease_expires_at: 100, authority_revision: 0, grant_ids: ["grant1"], approval_id: "approval1" };
delete attempt.revision;
const intent = { schema_version, spec_type: "IntentSpec", project: "proj", phase: "phase", target_entity: "agent1", do: ["build"] };
const coord = { schema_version, spec_type: "CoordSpec", project: "proj", phase: "phase", state: { system: "ready" }, authority: { system: "owner" } };
const handoff = { schema_version, spec_type: "HandoffSpec", project: "proj", phase: "phase", artifact: "artifact1", from: "producer1", to: ["consumer1"], requested_action: ["review"] };
const result = { task_id: "task1", status: "completed", outcome: "succeeded", outputs: { done: true } };
const outcome = { ...result, run_id: "run1", schema_version, task_revision: 0, queue_id: "queue1", attempt_id: "attempt1" };
const packet = createIntentTaskPacket(intent);
const fixtures = [
  ["Run", run], ["Principal", principal], ["Scope", scope], ["Actor", actor], ["Grant", grant], ["Approval", approval],
  ["AuthoritySnapshot", authority], ["Attempt", attempt],
  ["TaskAuthority", { principal_id: "principal1", actor_id: "actor1", capability: "build", scope, approval_required: true }],
  ["Decision", { allowed: true, code: "ALLOW", grant_ids: ["grant1"], approval_id: "approval1" }],
  ["ErrorContract", { code: "INVALID_SHAPE", path: "$" }],
  ["Intent", intent], ["Coord", coord], ["Handoff", handoff], ["TaskPacket", packet],
  ["ExecutionResult", result], ["AdapterResult", { status: "completed", outcome: "succeeded" }], ["Outcome", outcome],
  ["RuntimePolicy", createRuntimePolicy()], ["RuntimePolicyInput", { retry: { strategy: "fixed" } }],
  ["RegistryData", createRegistry()], ["Snapshot", exportRegistry(createRegistry())]
];

describe("real Sigil contracts", () => {
  for (const [name, valid] of fixtures) test(`${name}: valid clone and closed invalid shape`, () => {
    expect(C[name].schema.kind).toBe("sigil.contract");
    expect(C[name].schema.options.exact).toBe(true);
    expect(C[name].assert(valid)).toEqual(valid);
    expect(C[name].assert(valid)).not.toBe(valid);
    expect(C[name].check({ ...valid, unexpected: true })).toBe(false);
    expect(C[name].check(null)).toBe(false);
    expect(C[name].check([])).toBe(false);
  });
  test("Sigil inherited-field caveat is blocked before checking", () => {
    const inherited = Object.create(actor);
    expect(C.Actor.schema.check(inherited)).toBe(true);
    expect(C.Actor.check(inherited)).toBe(false);
    expect(C.Actor.check({ ...actor, roles: undefined })).toBe(false);
    expect(C.Actor.check({ ...actor, extra: undefined })).toBe(false);
  });
  test("plain own-data rejects accessors without evaluating them", () => {
    let calls = 0;
    const value = { ...actor };
    Object.defineProperty(value, "actor_id", { enumerable: true, get() { calls++; return "actor1"; } });
    expect(C.Actor.check(value)).toBe(false);
    expect(calls).toBe(0);
    expect(C.Actor.check({ ...actor, [Symbol("secret")]: true })).toBe(false);
    expect(C.Actor.check(Object.defineProperty({ ...actor }, "hidden", { value: 1 }))).toBe(false);
  });
  test("dangerous values and keys are rejected recursively", () => {
    const cycle = {}; cycle.self = cycle;
    const sparse = []; sparse.length = 1;
    const arrayExtra = []; arrayExtra.extra = true;
    for (const value of [cycle, sparse, arrayExtra, new Date(), new Map(), () => {}, undefined, NaN, Infinity, -Infinity, 2 ** 54, 1n, Symbol("x"), JSON.parse('{"__proto__": {}}'), { nested: { constructor: "x" } }, { nested: { prototype: "x" } }]) {
      expect(() => C.clonePlainData(value)).toThrow();
    }
    expect(C.clonePlainData(Object.assign(Object.create(null), { value: 1 }))).toEqual({ value: 1 });
  });
  test("depth, array, string, byte and node limits", () => {
    let deep = {}; for (let i = 0; i < 34; i++) deep = { deep };
    for (const value of [deep, Array(1025).fill(0), "x".repeat(16385), Array(100).fill("x".repeat(16000)), Array(100).fill(Array(200).fill(0))]) expect(() => C.clonePlainData(value)).toThrow("LIMIT_EXCEEDED");
  });
  test("identifier, enum, numeric, duplicate and nested exactness semantics", () => {
    for (const actor_id of ["", " ", " actor1", "actor1 ", "*", "constructor", "x".repeat(257), "a\u0000b"]) expect(C.Actor.check({ ...actor, actor_id })).toBe(false);
    expect(C.Actor.check({ ...actor, kind: "admin" })).toBe(false);
    expect(C.Actor.check({ ...actor, capabilities: ["build", "build"] })).toBe(false);
    expect(C.Grant.check({ ...grant, scope: { ...scope, extra: true } })).toBe(false);
    expect(C.Grant.check({ ...grant, scope: { ...scope, resource: { ...scope.resource, extra: true } } })).toBe(false);
    expect(C.Grant.check({ ...grant, scope: { ...scope, resource: { kind: "task", id: "other" } } })).toBe(false);
    for (const issued_at of [-1, 0.5, 100, 101]) expect(C.Grant.check({ ...grant, issued_at })).toBe(false);
    expect(C.Run.check({ ...run, revision: 0.5 })).toBe(false);
    expect(C.Run.check({ ...run, schema_version: "future" })).toBe(false);
    expect(C.Principal.check({ ...principal, authenticated_at: 100 })).toBe(false);
  });
  test("authority records and references do not manufacture valid approval", () => {
    expect(C.Approval.check({ ...approval, approver_principal_id: "principal1" })).toBe(false);
    expect(C.Approval.check({ ...approval, consumed_by_attempt_id: "other" })).toBe(false);
    expect(C.Approval.check({ ...approval, task_id: "other" })).toBe(false);
    for (const invalid of [
      { ...authority, actors: [actor, actor] }, { ...authority, grants: [grant, grant] },
      { ...authority, principals: [principal, principal] }, { ...authority, approvals: [approval, approval] },
      { ...authority, actors: [{ ...actor, principal_id: "missing" }] },
      { ...authority, grants: [{ ...grant, actor_id: "missing" }] },
      { ...authority, principals: [principal, { ...human, kind: "service" }] },
      { ...authority, run_id: "other" }
    ]) expect(C.AuthoritySnapshot.check(invalid)).toBe(false);
  });
  test("decisions and errors are fixed, consistent, sanitized data", () => {
    expect(C.Decision.check({ allowed: false, code: "NO_ALLOW_GRANT", grant_ids: [], approval_id: null })).toBe(true);
    expect(C.Decision.check({ allowed: true, code: "NO_ALLOW_GRANT", grant_ids: [], approval_id: null })).toBe(false);
    expect(C.Decision.check({ allowed: false, code: "NO_ALLOW_GRANT", grant_ids: ["g"], approval_id: null })).toBe(false);
    expect(C.ErrorContract.check({ code: "SECRET", path: "$" })).toBe(false);
    try { C.Actor.assert({ secret: "provider-secret" }); } catch (e) {
      expect(e.message).toBe("INVALID_SHAPE"); expect(e.path).toBe("$");
      expect(JSON.stringify(e)).not.toContain("provider-secret");
    }
  });
});

describe("contract ingress and prerequisite result repairs", () => {
  test("strict specs, real/literal newline parsing and no discarded unknown fields", () => {
    const chord = createChord();
    expect(chord.parseText("@project proj\n@phase phase\n@do\n- build").spec.do).toEqual(["build"]);
    expect(chord.parseText("@project proj\\n@phase phase\\n@do\\n- build").spec.do).toEqual(["build"]);
    for (const text of ["@project proj\n@phase phase\n@do\n- build\n@grants secret", "@state\n- __proto__: x", "@do\n- build", "@project p\n@project q"]) expect(() => chord.parseText(text)).toThrow();
    expect(() => chord.registerSpec({ ...intent, grants: [] })).toThrow();
    expect(chord.registry.specs.length).toBe(0);
    expect(createHandoffTaskPackets(handoff).length).toBe(1);
    expect(C.Intent.check({ ...intent, do: [] })).toBe(false);
    expect(C.Handoff.check({ ...handoff, to: ["consumer1", "consumer1"] })).toBe(false);
  });
  test("policy validates before defaults and bounds after defaults", () => {
    for (const p of [{ unexpected: 1 }, { retry: { strategy: "random" } }, { globalMaxLeased: Infinity }, { perEntityMaxLeased: -1 }, { retry: { maxAttempts: 0 } }, { retry: { baseDelayMs: 0.5 } }, { retry: { maxAttempts: 33 } }, { retry: { unknown: true } }, { retry: undefined }]) expect(() => createRuntimePolicy(p)).toThrow();
    expect(createRuntimePolicy({ retry: { baseDelayMs: 0 } }).retry.baseDelayMs).toBe(0);
  });
  test("malformed raw outputs never normalize to success", () => {
    for (const raw of [undefined, null, {}, [], { status: "completed" }, { status: "completed", outcome: "failed" }, { status: "invented", outcome: "succeeded" }, { status: "completed", outcome: "succeeded", unexpected: true }, { ...result, task_id: "foreign" }]) expect(() => normalizeExecutionResult(packet, raw)).toThrow("INVALID_RESULT");
    expect(normalizeExecutionResult(packet, { status: "completed", outcome: "succeeded" })).toEqual({ task_id: packet.task_id, status: "completed", outcome: "succeeded" });
    expect(C.Outcome.check({ ...outcome, queue_id: undefined })).toBe(false);
    expect(C.Outcome.check({ ...outcome, status: "failed" })).toBe(false);
  });
  test("correlated result ingestion requires a running attempt and clones input", () => {
    const registry = createRegistry();
    registerTask(registry, packet, bindingFor(registry, packet)); enqueueTask(registry, packet);
    const task = registry.tasks[packet.task_id];
    const attempt = prepareAttemptRecord(registry, task);
    // Simulate the dispatch commit: task running, queue leased, reservation active.
    task.status = "running";
    registry.task_queue[0].status = "leased";
    registry.run.revision += 1;
    activatePendingAttempt(registry, packet.task_id, registry.run.revision);
    const valid = {
      ...result, task_id: packet.task_id,
      run_id: registry.run.run_id, schema_version, task_revision: 0,
      queue_id: registry.task_queue[0].queue_id, attempt_id: attempt.attempt_id
    };
    registerExecutionResult(registry, valid);
    valid.outputs.done = false;
    expect(registry.execution_results[0].outputs.done).toBe(true);
    expect(registry.tasks[packet.task_id].status).toBe("completed");
    expect(registry.task_queue[0].status).toBe("completed");
    expect(registry.active_attempts[packet.task_id]).toBeUndefined();
    const before = JSON.stringify(registry);
    // Duplicate result: the active attempt is consumed; nothing may append.
    expect(() => registerExecutionResult(registry, { ...valid, outputs: { done: true } })).toThrow(/INVALID_RESULT/);
    // Foreign result: no such task.
    expect(() => registerExecutionResult(registry, { ...valid, task_id: "foreign" })).toThrow(/INVALID_RESULT/);
    // Inconsistent status/outcome pair never normalizes.
    expect(() => registerExecutionResult(registry, { ...valid, outcome: "failed" })).toThrow();
    expect(JSON.stringify(registry)).toBe(before);
  });
  test("runtime success, absent output noncompletion, provider error redaction", async () => {
    const chord = createChord({ runtimePolicy: { retry: { maxAttempts: 1 } } });
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded" }) } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    expect((await chord.runCycle()).ok).toBe(true);
    expect(chord.queryQueue({ status: "completed" }).length).toBe(1);
    chord.setAdapterRouter({ fallback: { execute: () => undefined } });
    chord.registerSpecAndQueue(intent, queueOptions(host));
    const invalid = await chord.runCycle();
    expect(invalid.ok).toBe(false);
    expect(chord.registry.execution_results.length).toBe(1);
    expect(chord.queryQueue({ status: "completed" }).length).toBe(1);
    await expect(executeTask({ execute() { throw new Error("provider-secret"); } }, packet)).rejects.toThrow("ADAPTER_ERROR");
    chord.setAdapterRouter({ fallback: { execute() { throw new Error("provider-secret"); } } });
    chord.registerSpecAndQueue(intent, queueOptions(host)); await chord.runCycle();
    expect(JSON.stringify(chord.registry)).not.toContain("provider-secret");
  });
  test("snapshot validates version, counts, nested records, clones and reconciles in-flight import", () => {
    const registry = createRegistry(); registerTask(registry, packet, bindingFor(registry, packet)); enqueueTask(registry, packet);
    const snapshot = exportRegistry(registry);
    const copy = importRegistry(snapshot);
    expect(copy).toEqual(registry); expect(copy).not.toBe(snapshot.registry);
    for (const invalid of [{ registry }, { ...snapshot, schema_version: "future" }, { ...snapshot, counts: { ...snapshot.counts, tasks: 99 } }, { ...snapshot, registry: { ...registry, authority: authority } }, { ...snapshot, registry: { ...registry, tasks: { bad: {} } } }]) expect(() => importRegistry(invalid)).toThrow();
    // Design §6: imported in-flight work becomes uncertain, never executable.
    snapshot.registry.task_queue[0].status = "leased";
    snapshot.registry.tasks[packet.task_id].status = "running";
    const inFlight = importRegistry(snapshot);
    expect(inFlight.tasks[packet.task_id].status).toBe("uncertain");
    expect(inFlight.task_queue[0].status).toBe("uncertain");
    expect(inFlight.active_attempts).toEqual({});
    expect(registry.task_queue[0].status).toBe("queued");
    expect(registry.tasks[packet.task_id].status).toBe("queued");
  });
});
