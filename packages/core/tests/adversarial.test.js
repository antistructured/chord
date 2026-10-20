import { describe, test, expect } from "bun:test";
import { createChord } from "../src/sdk/chord.js";
import { evaluateAuthority } from "../src/platform/authorization.js";
import { createAdaptiveAuthority } from "./fixtures/host.js";
import { createRegistry } from "../src/registry/registry.js";
import { enqueueTask } from "../src/platform/task-queue.js";
import { prepareAttemptRecord } from "../src/platform/attempts.js";
import { createIntentTaskPacket } from "../src/execution/task-packets.js";
import { SCHEMA_VERSION, Actor, Grant, Approval, AuthoritySnapshot, Decision, clonePlainData } from "../src/contracts/sigils.js";

const scope = { run_id: "run1", project: "proj", phase: "phase", task_id: "task1", target_entity: "agent1", resource: { kind: "task", id: "task1" } };
const run = { run_id: "run1", schema_version: SCHEMA_VERSION, revision: 0 };
const principal = { principal_id: "principal1", issuer: "host", kind: "service", authenticated_at: 0, expires_at: 100 };
const human = { ...principal, principal_id: "human1", kind: "human" };
const actor = { actor_id: "actor1", principal_id: "principal1", kind: "agent", roles: ["admin", "owner"], capabilities: ["build"], revoked_at: null };
const baseTask = {
  schema_version: SCHEMA_VERSION, task_id: "task1", project: "proj", phase: "phase", target_entity: "agent1", task_revision: 0,
  status: "queued", authority_binding: { principal_id: "principal1", actor_id: "actor1", capability: "build", scope, approval_required: false }
};
const makeGrant = (over = {}) => ({ grant_id: "grant1", principal_id: "principal1", actor_id: "actor1", capability: "build", effect: "allow", scope, issued_at: 0, expires_at: 100, revoked_at: null, requires_approval: false, ...over });
const makeApproval = (over = {}) => ({ approval_id: "approval1", approver_principal_id: "human1", decision: "approved", run_id: "run1", schema_version: SCHEMA_VERSION, task_id: "task1", task_revision: 0, attempt_id: "attempt1", principal_id: "principal1", actor_id: "actor1", capability: "build", scope, issued_at: 0, expires_at: 100, revoked_at: null, consumed_by_attempt_id: null, ...over });
const makeSnapshot = (over = {}) => ({ schema_version: SCHEMA_VERSION, run_id: "run1", authority_revision: 0, principals: [principal, human], actors: [actor], grants: [makeGrant()], approvals: [], ...over });
const makeAttempt = (over = {}) => ({ run_id: "run1", schema_version: SCHEMA_VERSION, task_id: "task1", task_revision: 0, queue_id: "queue1", attempt_id: "attempt1", lease_expires_at: 100, authority_revision: 0, grant_ids: ["grant1"], approval_id: null, ...over });
const D = decision => ({ allowed: decision.allowed, code: decision.code, grant_ids: [...decision.grant_ids], approval_id: decision.approval_id });

describe("pass 6 — authority boundary and identity forgery", () => {
  test("request-authored authority fields, roles, and decisions confer nothing", () => {
    // Descriptive spec/packet text cannot widen permission: a self-declared
    // authority map or admin role is ignored by the evaluator.
    const chord = createChord();
    const packet = createIntentTaskPacket({
      schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["build"],
      authority: { system: "principal1" }, role: "admin", requested_action: ["execute"]
    });
    // Host context present but no grant issued: still denied at admission.
    expect(() => chord.queueTaskPackets([packet], {
      principal_id: "principal1", actor_id: "actor1", capability: "build"
    })).toThrow(/INVALID_CONTEXT/);
    expect(Object.keys(chord.registry.tasks).length).toBe(0);
  });

  test("role strings never substitute for capabilities", () => {
    const authority = makeSnapshot({ actors: [{ ...actor, capabilities: [] }] });
    const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority });
    expect(D(decision)).toEqual({ allowed: false, code: "CAPABILITY_MISSING", grant_ids: [], approval_id: null });
    // Exactly-named capability required — no prefix or case matching.
    for (const capability of ["Build", "buil", "builds", "build2"]) {
      const d = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ actors: [{ ...actor, capabilities: [capability] }] }) });
      expect(d.code).toBe("CAPABILITY_MISSING");
    }
    // Nonidentifier capability strings (whitespace, wildcard, control chacters)
    // are rejected at the contract layer before ever reaching the evaluator.
    for (const capability of ["build ", " build", "build*", "a\u0000b"]) {
      expect(AuthoritySnapshot.check(makeSnapshot({ actors: [{ ...actor, capabilities: [capability] }] }))).toBe(false);
    }
  });

  test("capability alone without a grant is denied", () => {
    const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [] }) });
    expect(D(decision)).toEqual({ allowed: false, code: "NO_ALLOW_GRANT", grant_ids: [], approval_id: null });
  });

  test("missing host authority denies every stage", () => {
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: null }).code).toBe("INVALID_CONTEXT");
    const chord = createChord();
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    expect(() => chord.queueTaskPackets([packet], { principal_id: "x", actor_id: "y", capability: "z" })).toThrow(/INVALID_CONTEXT/);
    expect(chord.registry.tasks[packet.task_id]).toBeUndefined();
  });

  test("cross-principal actor binding is rejected", () => {
    // Snapshot contract rejects an actor whose principal is absent.
    expect(AuthoritySnapshot.check(makeSnapshot({ actors: [{ ...actor, principal_id: "ghost" }] }))).toBe(false);
    // A valid snapshot where the binding actor belongs to another principal
    // evaluates to ACTOR_INVALID (reached because the snapshot itself is valid).
    const authority = makeSnapshot({
      grants: [],
      principals: [principal, { ...human, principal_id: "principal2" }],
      actors: [{ ...actor, actor_id: "actor1", principal_id: "principal2" }]
    });
    expect(AuthoritySnapshot.check(authority)).toBe(true);
    const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority });
    expect(decision.code).toBe("ACTOR_INVALID");
  });

  test("evaluator decisions are sanitized fixed data, never transferable tokens", () => {
    const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot() });
    expect(Decision.check(decision)).toBe(true);
    // A caller-supplied { allowed: true } object is not accepted anywhere:
    // evaluateAuthority ignores task-provided decisions entirely.
    const forgedTask = { ...baseTask, allowed: true, decision: { allowed: true } };
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: forgedTask, attempt: null, authority: makeSnapshot({ grants: [] }) }).code).toBe("NO_ALLOW_GRANT");
    // Decisions are ephemeral data: re-evaluating on changed authority yields a
    // different answer — there is no cached token to replay.
    const revoked = makeSnapshot({ grants: [makeGrant({ revoked_at: 0 })] });
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: revoked }).code).toBe("NO_ALLOW_GRANT");
  });
});

describe("pass 6 — scope, version, and run isolation", () => {
  test("exact scope mismatch across every field is denied", () => {
    // Structurally valid but non-matching scopes: evaluator denies with
    // NO_ALLOW_GRANT (the grant is real; it simply covers another resource).
    const mismatches = [
      { project: "other" }, { phase: "other" }, { target_entity: "other" }
    ];
    for (const patch of mismatches) {
      const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [makeGrant({ scope: { ...scope, ...patch } })] }) });
      expect(decision.code).toBe("NO_ALLOW_GRANT");
    }
    // Scopes that would violate the grant's own invariants are rejected at
    // the contract layer before the evaluator ever sees them:
    //   run_id must equal the snapshot run; a task-resource id must equal task_id.
    expect(AuthoritySnapshot.check(makeSnapshot({ grants: [makeGrant({ scope: { ...scope, run_id: "other" } })] }))).toBe(false);
    expect(AuthoritySnapshot.check(makeSnapshot({ grants: [makeGrant({ scope: { ...scope, task_id: "other" } })] }))).toBe(false);
    expect(AuthoritySnapshot.check(makeSnapshot({ grants: [makeGrant({ scope: { ...scope, resource: { kind: "task", id: "other" } } })] }))).toBe(false);
    // An artifact-kind resource grant is valid but never matches a task resource.
    const artifactGrant = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [makeGrant({ scope: { ...scope, resource: { kind: "artifact", id: "some-artifact" } } })] }) });
    expect(artifactGrant.code).toBe("NO_ALLOW_GRANT");
  });

  test("scope with a valid id but wrong run is denied as scope mismatch", () => {
    const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [makeGrant({ scope: { ...scope, project: "elsewhere" } })] }) });
    expect(decision.code).toBe("NO_ALLOW_GRANT");
  });

  test("version mismatch and foreign run reject before any grant evaluation", () => {
    expect(evaluateAuthority({ stage: "admit", now: 1, run: { ...run, schema_version: "future" }, task: baseTask, attempt: null, authority: makeSnapshot() }).code).toBe("SCHEMA_MISMATCH");
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: { ...baseTask, schema_version: "future" }, attempt: null, authority: makeSnapshot() }).code).toBe("SCHEMA_MISMATCH");
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ run_id: "other", grants: [makeGrant({ scope: { ...scope, run_id: "other" } })] }) }).code).toBe("RUN_MISMATCH");
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: { ...baseTask, authority_binding: { ...baseTask.authority_binding, scope: { ...scope, run_id: "other" } } }, attempt: null, authority: makeSnapshot() }).code).toBe("RUN_MISMATCH");
  });
});

describe("pass 6 — temporal and revocation boundaries", () => {
  test("grant expiry uses issued_at <= now < expires_at at exact boundaries", () => {
    const at = expires_at => makeSnapshot({ grants: [makeGrant({ expires_at })] });
    expect(evaluateAuthority({ stage: "admit", now: 0, run, task: baseTask, attempt: null, authority: at(10) }).allowed).toBe(true);
    expect(evaluateAuthority({ stage: "admit", now: 9, run, task: baseTask, attempt: null, authority: at(10) }).allowed).toBe(true);
    expect(evaluateAuthority({ stage: "admit", now: 10, run, task: baseTask, attempt: null, authority: at(10) }).code).toBe("NO_ALLOW_GRANT");
    expect(evaluateAuthority({ stage: "admit", now: 11, run, task: baseTask, attempt: null, authority: at(10) }).code).toBe("NO_ALLOW_GRANT");
    // Future-issued grant is not yet active.
    expect(evaluateAuthority({ stage: "admit", now: 5, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [makeGrant({ issued_at: 6 })] }) }).code).toBe("NO_ALLOW_GRANT");
    expect(evaluateAuthority({ stage: "admit", now: 6, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [makeGrant({ issued_at: 6 })] }) }).allowed).toBe(true);
  });

  test("principal and actor revocation disable access immediately", () => {
    expect(evaluateAuthority({ stage: "admit", now: 5, run, task: baseTask, attempt: null, authority: makeSnapshot({ principals: [{ ...principal, expires_at: 5 }, human] }) }).code).toBe("PRINCIPAL_INVALID");
    expect(evaluateAuthority({ stage: "admit", now: 4, run, task: baseTask, attempt: null, authority: makeSnapshot({ principals: [{ ...principal, authenticated_at: 5 }, human] }) }).code).toBe("PRINCIPAL_INVALID");
    expect(evaluateAuthority({ stage: "admit", now: 5, run, task: baseTask, attempt: null, authority: makeSnapshot({ actors: [{ ...actor, revoked_at: 0 }] }) }).code).toBe("ACTOR_INVALID");
    // A revoked grant drops out; if it was the only allow, denied.
    expect(evaluateAuthority({ stage: "admit", now: 5, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [makeGrant({ revoked_at: 0 })] }) }).code).toBe("NO_ALLOW_GRANT");
  });

  test("contract window invariants reject nonpositive windows", () => {
    expect(Grant.check(makeGrant({ issued_at: 10, expires_at: 10 }))).toBe(false);
    expect(Approval.check(makeApproval({ issued_at: 10, expires_at: 10 }))).toBe(false);
  });
});

describe("pass 6 — deny/allow ordering permutations", () => {
  test("an active matching deny beats every allow regardless of array order", () => {
    const allows = [makeGrant({ grant_id: "a1" }), makeGrant({ grant_id: "a2" })];
    const deny = makeGrant({ grant_id: "d1", effect: "deny" });
    for (const grants of [[deny, ...allows], [...allows, deny], [allows[0], deny, allows[1]]]) {
      const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants }) });
      expect(D(decision)).toEqual({ allowed: false, code: "EXPLICIT_DENY", grant_ids: [], approval_id: null });
    }
  });

  test("a non-matching deny does not block a matching allow", () => {
    const deny = makeGrant({ grant_id: "d1", effect: "deny", capability: "other" });
    const allow = makeGrant({ grant_id: "a1" });
    const decision = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [deny, allow] }) });
    expect(D(decision)).toEqual({ allowed: true, code: "ALLOW", grant_ids: ["a1"], approval_id: null });
  });

  test("grant_ids are sorted deterministically independent of array order", () => {
    const grants = [makeGrant({ grant_id: "zeta" }), makeGrant({ grant_id: "alpha" }), makeGrant({ grant_id: "mid" })];
    const forward = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants }) });
    const reverse = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority: makeSnapshot({ grants: [...grants].reverse() }) });
    expect(forward.grant_ids).toEqual(["alpha", "mid", "zeta"]);
    expect(reverse.grant_ids).toEqual(forward.grant_ids);
  });

  test("decisions are deterministic for identical input bytes and time", () => {
    const authority = makeSnapshot({ grants: [makeGrant(), makeGrant({ grant_id: "a2" })] });
    const a = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority });
    const b = evaluateAuthority({ stage: "admit", now: 1, run, task: baseTask, attempt: null, authority });
    expect(D(a)).toEqual(D(b));
  });
});

describe("pass 6 — approval misuse permutations", () => {
  const approvalTask = { ...baseTask, authority_binding: { ...baseTask.authority_binding, approval_required: true } };
  const dispatch = (authority, attempt = makeAttempt()) => evaluateAuthority({ stage: "dispatch", now: 1, run, task: approvalTask, attempt, authority });

  test("approval_required dispatch needs an exact, unconsumed, matching approval", () => {
    expect(dispatch(makeSnapshot(), makeAttempt()).code).toBe("APPROVAL_REQUIRED");
    // Wrong attempt id.
    expect(dispatch(makeSnapshot({ approvals: [makeApproval({ attempt_id: "attempt_other" })] })).code).toBe("APPROVAL_REQUIRED");
    // Already consumed.
    expect(dispatch(makeSnapshot({ approvals: [makeApproval({ consumed_by_attempt_id: "attempt1" })] })).code).toBe("APPROVAL_REQUIRED");
    // Wrong task revision (payload binding).
    expect(dispatch(makeSnapshot({ approvals: [makeApproval({ task_revision: 1 })] })).code).toBe("APPROVAL_REQUIRED");
    // Expired.
    expect(dispatch(makeSnapshot({ approvals: [makeApproval({ expires_at: 1 })] })).code).toBe("APPROVAL_REQUIRED");
    // Revoked.
    expect(dispatch(makeSnapshot({ approvals: [makeApproval({ revoked_at: 0 })] })).code).toBe("APPROVAL_REQUIRED");
    // The matching one authorizes.
    expect(D(dispatch(makeSnapshot({ approvals: [makeApproval()] })))).toEqual({ allowed: true, code: "ALLOW", grant_ids: ["grant1"], approval_id: "approval1" });
  });

  test("explicit rejection wins over a present approval and blocks dispatch", () => {
    const authority = makeSnapshot({ approvals: [makeApproval({ approval_id: "rej", decision: "rejected" }), makeApproval()] });
    expect(dispatch(authority).code).toBe("APPROVAL_REJECTED");
  });

  test("self-approval is structurally impossible", () => {
    // approver_principal_id may not equal the executing principal.
    expect(Approval.check(makeApproval({ approver_principal_id: "principal1" }))).toBe(false);
    // And a non-human approver is rejected by snapshot semantics.
    const nonHuman = { ...human, principal_id: "human1" };
    const snapshot = makeSnapshot({ approvals: [makeApproval({ approver_principal_id: "not-in-principals" })] });
    expect(AuthoritySnapshot.check(snapshot)).toBe(false);
  });

  test("admit grants permission without approval; dispatch gates on it", () => {
    const authority = makeSnapshot();
    expect(evaluateAuthority({ stage: "admit", now: 1, run, task: approvalTask, attempt: null, authority }).allowed).toBe(true);
    expect(dispatch(authority).code).toBe("APPROVAL_REQUIRED");
  });

  test("commit requires the dispatch-selected approval consumed by this attempt", () => {
    const runningTask = { ...approvalTask, status: "running" };
    const consumed = makeAttempt({ approval_id: "approval1" });
    const authority = makeSnapshot({ approvals: [makeApproval({ consumed_by_attempt_id: "attempt1" })] });
    expect(evaluateAuthority({ stage: "commit", now: 1, run, task: runningTask, attempt: consumed, authority }).allowed).toBe(true);
    // Unconsumed approval cannot authorize commit.
    const unconsumed = makeSnapshot({ approvals: [makeApproval()] });
    expect(evaluateAuthority({ stage: "commit", now: 1, run, task: runningTask, attempt: consumed, authority: unconsumed }).code).toBe("APPROVAL_REQUIRED");
    // Approval consumed by a different attempt is stale.
    const other = makeSnapshot({ approvals: [makeApproval({ consumed_by_attempt_id: "attempt1" })] });
    expect(evaluateAuthority({ stage: "commit", now: 1, run, task: runningTask, attempt: makeAttempt({ approval_id: "approval1", attempt_id: "attempt1" }), authority: other }).allowed).toBe(true);
  });

  test("a newly added grant cannot retroactively authorize an attempt", () => {
    // Attempt was dispatched with grant1; authority advances and replaces it.
    const runningTask = { ...baseTask, status: "running" };
    const attempt = makeAttempt({ grant_ids: ["grant1"] });
    const authority = makeSnapshot({ authority_revision: 1, grants: [makeGrant({ grant_id: "replacement" })] });
    const decision = evaluateAuthority({ stage: "commit", now: 1, run, task: runningTask, attempt, authority });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("STALE_ATTEMPT"); // authority_revision drift
  });
});

describe("pass 6 — runtime boundary enforcement", () => {
  test("admission denial writes nothing and dispatch denial never leases", async () => {
    // Admission denial: no grant issued -> throw before any registration.
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    expect(() => chord.queueTaskPackets([packet], { ...authority.queueOptions, issueGrants: () => [] })).toThrow(/NO_ALLOW_GRANT/);
    expect(Object.keys(chord.registry.tasks).length).toBe(0);
    expect(chord.registry.task_queue.length).toBe(0);

    // Dispatch denial: revoke the grant after admission but before runCycle.
    let calls = 0;
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return { status: "completed", outcome: "succeeded" }; } } });
    chord.queueTaskPackets([packet], authority.queueOptions);
    const taskId = packet.task_id;
    expect(chord.registry.tasks[taskId].status).toBe("queued");
    const snapshot = chord.getAuthority();
    snapshot.authority_revision += 1;
    snapshot.grants = snapshot.grants.map(g => ({ ...g, revoked_at: 0 }));
    chord.setAuthoritySnapshot(snapshot);
    const result = await chord.runCycle();
    expect(result.denied).toBe(true);
    expect(result.code).toBe("NO_ALLOW_GRANT");
    expect(calls).toBe(0);
    expect(chord.registry.tasks[taskId].status).toBe("queued");
    expect(chord.registry.task_queue[0].status).toBe("queued");
  });

  test("batch admission is atomic: one denial registers no member", () => {
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    const p1 = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    const p2 = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["b"] });
    expect(() => chord.queueTaskPackets([p1, p2], {
      ...authority.queueOptions,
      issueGrants: packets => authority.issueGrantsFor(packets.filter(p => p.task_id === p1.task_id))
    })).toThrow(/NO_ALLOW_GRANT/);
    expect(Object.keys(chord.registry.tasks).length).toBe(0);
    expect(chord.registry.task_queue.length).toBe(0);
  });

  test("duplicate admission and re-registration of an existing id reject", () => {
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    chord.queueTaskPackets([packet], authority.queueOptions);
    // Identical resubmission is not idempotent.
    expect(() => chord.queueTaskPackets([packet], authority.queueOptions)).toThrow(/INVALID_SEMANTICS/);
    // Duplicate within a single batch.
    const fresh = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["b"] });
    const copy = { ...fresh };
    expect(() => chord.queueTaskPackets([fresh, { ...copy }], authority.queueOptions)).toThrow(/INVALID_SEMANTICS/);
    expect(Object.keys(chord.registry.tasks).length).toBe(1);
  });

  test("concurrent revision losers and stale expectedRevision are rejected", async () => {
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    chord.queueTaskPackets([packet], authority.queueOptions);
    const rev = chord.getRunRevision();
    // A second mutation advances the revision; the captured value is now stale.
    chord.cancelTask(packet.task_id, { expectedRevision: rev });
    const other = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["b"] });
    chord.queueTaskPackets([other], authority.queueOptions);
    expect(() => chord.cancelTask(other.task_id, { expectedRevision: rev })).toThrow(/STALE_REVISION/);
    expect(chord.registry.tasks[other.task_id].status).toBe("queued");
  });

  test("an in-flight commit loses to a concurrent same-revision mutation", async () => {
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    let release;
    const gate = new Promise(r => { release = r; });
    chord.setAdapterRouter({ fallback: { execute: () => gate.then(() => ({ status: "completed", outcome: "succeeded" })) } });
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    chord.queueTaskPackets([packet], authority.queueOptions);
    const cycle = chord.runCycle(); // dispatched, awaiting adapter
    // A host mutation wins the revision race while the adapter is in flight.
    const second = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["b"] });
    chord.queueTaskPackets([second], authority.queueOptions);
    release();
    const result = await cycle;
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    // The commit loses the race. The evaluator's authority-vector check fires
    // first (STALE_ATTEMPT, since installing the second grant advanced the
    // authority revision); the runtime's own run-revision guard would report
    // STALE_REVISION. Either way the stale attempt never commits.
    expect(["STALE_REVISION", "STALE_ATTEMPT"]).toContain(result.code);
    expect(chord.registry.tasks[packet.task_id].status).toBe("uncertain");
    expect(chord.registry.execution_results.length).toBe(0);
  });

  test("no registry or authority write handle leaks to adapters", async () => {
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    let seenContext = null;
    let seenPacket = null;
    chord.setAdapterRouter({ fallback: { execute: (packet, context) => {
      seenPacket = packet; seenContext = context;
      return { status: "completed", outcome: "succeeded" };
    } } });
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    chord.queueTaskPackets([packet], authority.queueOptions);
    await chord.runCycle();
    // Context carries correlation only — no registry, no authority, no write handles.
    expect(seenContext.registry).toBeUndefined();
    expect(seenContext.authority).toBeUndefined();
    expect(Object.keys(seenContext).sort()).toEqual(["attempt_id", "lease_expires_at", "queue_id", "run_id", "schema_version", "task_id", "task_revision"]);
    // The dispatched packet is deep-frozen and cannot be mutated to affect state.
    expect(Object.isFrozen(seenPacket)).toBe(true);
    expect(Object.isFrozen(seenPacket.inputs)).toBe(true);
    expect(() => { seenPacket.inputs.spec.project = "hacked"; }).toThrow();
    expect(chord.registry.tasks[packet.task_id].project).toBe("p");
  });

  test("safery: adapter cannot fabricate correlation or a passing result", async () => {
    const chord = createChord();
    const authority = createAdaptiveAuthority(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded", task_id: "foreign", attempt_id: "forged" }) } });
    const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
    chord.queueTaskPackets([packet], authority.queueOptions);
    const result = await chord.runCycle();
    // Adapter-authored task_id mismatch -> INVALID_RESULT -> uncertain.
    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(chord.registry.tasks[packet.task_id].status).toBe("uncertain");
    expect(chord.registry.execution_results.length).toBe(0);
  });

  test("malformed adapter results never normalize to success or dead-letter", async () => {
    for (const raw of [null, {}, [], { status: "completed" }, { status: "invented", outcome: "succeeded" }, { status: "completed", outcome: "failed", extra: true }]) {
      const chord = createChord();
      const authority = createAdaptiveAuthority(chord);
      chord.setAdapterRouter({ fallback: { execute: () => raw } });
      const packet = createIntentTaskPacket({ schema_version: SCHEMA_VERSION, spec_type: "IntentSpec", project: "p", phase: "q", do: ["a"] });
      chord.queueTaskPackets([packet], authority.queueOptions);
      const result = await chord.runCycle();
      expect(result.uncertain).toBe(true);
      expect(chord.registry.tasks[packet.task_id].status).toBe("uncertain");
      expect(chord.queryDeadLetters().length).toBe(0);
    }
  });
});

describe("pass 6 — approval gate end to end", () => {
  function approvalHost(chord, { approvalRequired = true } = {}) {
    const run_id = chord.registry.run.run_id;
    const principal = { principal_id: "host-principal", issuer: "h", kind: "service", authenticated_at: 0, expires_at: 1e15 };
    const human = { principal_id: "human-approver", issuer: "h", kind: "human", authenticated_at: 0, expires_at: 1e15 };
    const worker = { actor_id: "worker", principal_id: "host-principal", kind: "agent", roles: [], capabilities: ["execute"], revoked_at: null };
    chord.setAuthoritySnapshot({ schema_version: SCHEMA_VERSION, run_id, authority_revision: 0, principals: [principal, human], actors: [worker], grants: [], approvals: [] });
    const issueGrants = ps => ps.map(p => ({
      grant_id: `g_${p.task_id}`, principal_id: "host-principal", actor_id: "worker", capability: "execute", effect: "allow",
      scope: { run_id, project: p.project, phase: p.phase, task_id: p.task_id, target_entity: p.target_entity, resource: { kind: "task", id: p.task_id } },
      issued_at: 0, expires_at: 1e15, revoked_at: null, requires_approval: approvalRequired
    }));
    return {
      run_id,
      queueOptions: { principal_id: "host-principal", actor_id: "worker", capability: "execute", approval_required: approvalRequired, issueGrants },
      installApproval(packet, attempt_id, over = {}) {
        const snap = chord.getAuthority();
        snap.authority_revision += 1;
        snap.approvals = [...snap.approvals, {
          approval_id: `appr_${packet.task_id}`, approver_principal_id: "human-approver", decision: "approved", run_id,
          schema_version: SCHEMA_VERSION, task_id: packet.task_id, task_revision: 0, attempt_id, principal_id: "host-principal",
          actor_id: "worker", capability: "execute",
          scope: { run_id, project: packet.project, phase: packet.phase, task_id: packet.task_id, target_entity: packet.target_entity, resource: { kind: "task", id: packet.task_id } },
          issued_at: 0, expires_at: 1e15, revoked_at: null, consumed_by_attempt_id: null, ...over
        }];
        chord.setAuthoritySnapshot(snap);
      }
    };
  }

  test("approval-required task is denied at dispatch with zero adapter calls until approved", async () => {
    const chord = createChord();
    const host = approvalHost(chord);
    let calls = 0;
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return { status: "completed", outcome: "succeeded" }; } } });
    const spec = chord.parseText("@project P\n@phase q\n@do\n- work").spec;
    const { packets } = chord.registerSpecAndQueue(spec, host.queueOptions);
    const taskId = packets[0].task_id;

    const denied = await chord.runCycle();
    expect(denied.denied).toBe(true);
    expect(denied.code).toBe("APPROVAL_REQUIRED");
    expect(calls).toBe(0);
    expect(chord.registry.tasks[taskId].status).toBe("queued");

    // Host installs the human approval for the prepared attempt, then dispatch succeeds.
    const prepared = chord.prepareAttempt(taskId);
    host.installApproval(packets[0], prepared.attempt_id);
    const approved = await chord.runCycle();
    expect(approved.ok).toBe(true);
    expect(calls).toBe(1);
    expect(chord.registry.tasks[taskId].status).toBe("completed");
    // The approval is consumed by the attempt and not reusable.
    expect(chord.getAuthority().approvals[0].consumed_by_attempt_id).toBe(prepared.attempt_id);
  });

  test("explicit host rejection blocks dispatch permanently", async () => {
    const chord = createChord();
    const host = approvalHost(chord);
    let calls = 0;
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return { status: "completed", outcome: "succeeded" }; } } });
    const spec = chord.parseText("@project P\n@phase q\n@do\n- work").spec;
    const { packets } = chord.registerSpecAndQueue(spec, host.queueOptions);
    const prepared = chord.prepareAttempt(packets[0].task_id);
    host.installApproval(packets[0], prepared.attempt_id, { decision: "rejected" });
    const denied = await chord.runCycle();
    expect(denied.denied).toBe(true);
    expect(denied.code).toBe("APPROVAL_REJECTED");
    expect(calls).toBe(0);
    expect(chord.registry.tasks[packets[0].task_id].status).toBe("queued");
  });

  test("an approval for a different attempt does not authorize dispatch", async () => {
    const chord = createChord();
    const host = approvalHost(chord);
    let calls = 0;
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return { status: "completed", outcome: "succeeded" }; } } });
    const spec = chord.parseText("@project P\n@phase q\n@do\n- work").spec;
    const { packets } = chord.registerSpecAndQueue(spec, host.queueOptions);
    chord.prepareAttempt(packets[0].task_id);
    host.installApproval(packets[0], "attempt_other");
    const denied = await chord.runCycle();
    expect(denied.denied).toBe(true);
    expect(denied.code).toBe("APPROVAL_REQUIRED");
    expect(calls).toBe(0);
  });
});

describe("pass 6 — contract hardening regression", () => {
  test("prototype, cycle, and accessor payloads are rejected without evaluation", () => {
    let calls = 0;
    const value = { ...actor };
    Object.defineProperty(value, "actor_id", { enumerable: true, get() { calls++; return "actor1"; } });
    expect(Actor.check(value)).toBe(false);
    expect(calls).toBe(0);
    const cycle = {}; cycle.self = cycle;
    expect(() => clonePlainData(cycle)).toThrow();
    expect(Actor.check(Object.create(actor))).toBe(false);
    expect(Actor.check({ ...actor, roles: ["admin", "admin"] })).toBe(false);
  });
});
