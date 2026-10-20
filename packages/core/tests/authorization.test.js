import { describe, test, expect } from "bun:test";
import { evaluateAuthority, authorityError } from "../src/platform/authorization.js";
import { createChord } from "../src/sdk/chord.js";
import * as C from "../src/contracts/sigils.js";
import { installHost, queueOptions } from "./fixtures/host.js";

const schema_version = C.SCHEMA_VERSION;
const NOW = 1_000;
const run = { run_id: "run1", schema_version, revision: 0 };
const scope = { run_id: "run1", project: "proj", phase: "phase", task_id: "task1", target_entity: "agent1", resource: { kind: "task", id: "task1" } };
const principal = { principal_id: "principal1", issuer: "host", kind: "service", authenticated_at: 0, expires_at: 10_000 };
const human = { ...principal, principal_id: "human1", kind: "human" };
const actor = { actor_id: "actor1", principal_id: "principal1", kind: "agent", roles: [], capabilities: ["build"], revoked_at: null };
const grant = { grant_id: "grant1", principal_id: "principal1", actor_id: "actor1", capability: "build", effect: "allow", scope, issued_at: 0, expires_at: 10_000, revoked_at: null, requires_approval: false };
const makeAuthority = (overrides = {}) => ({
  schema_version,
  run_id: "run1",
  authority_revision: 1,
  principals: [principal, human],
  actors: [actor],
  grants: [grant],
  approvals: [],
  ...overrides
});
const makeTask = (overrides = {}) => ({
  schema_version,
  task_id: "task1",
  project: "proj",
  phase: "phase",
  target_entity: "agent1",
  status: "queued",
  requested_action: ["build"],
  authority_binding: {
    principal_id: "principal1",
    actor_id: "actor1",
    capability: "build",
    scope,
    approval_required: false
  },
  ...overrides
});
const makeAttempt = (overrides = {}) => ({
  run_id: "run1",
  schema_version,
  task_id: "task1",
  task_revision: 0,
  queue_id: "queue1",
  attempt_id: "attempt1",
  lease_expires_at: NOW + 30_000,
  authority_revision: 1,
  grant_ids: ["grant1"],
  approval_id: null,
  ...overrides
});
const evaluate = (stage, overrides = {}) => evaluateAuthority({
  stage,
  now: NOW,
  run,
  task: makeTask(),
  attempt: stage === "admit" ? null : makeAttempt(),
  authority: makeAuthority(),
  ...overrides
});

describe("pure authorization evaluator", () => {
  test("admit allows permission regardless of approval requirement", () => {
    const decision = evaluate("admit", { task: makeTask({ authority_binding: { ...makeTask().authority_binding, approval_required: true } }) });
    expect(decision).toEqual({ allowed: true, code: "ALLOW", grant_ids: ["grant1"], approval_id: null });
  });

  test("dispatch without approval requirement allows and selects grants", () => {
    const decision = evaluate("dispatch");
    expect(decision.allowed).toBe(true);
    expect(decision.grant_ids).toEqual(["grant1"]);
    expect(decision.approval_id).toBeNull();
  });

  test("determinism: identical inputs give identical decisions", () => {
    expect(JSON.stringify(evaluate("dispatch"))).toBe(JSON.stringify(evaluate("dispatch")));
    expect(evaluate("dispatch")).not.toBe(evaluate("dispatch"));
  });

  test("fixed failure order, first failure wins", () => {
    expect(evaluate("admit", { stage: "nonsense" }).code).toBe("INVALID_CONTEXT");
    expect(evaluate("admit", { now: 1.5 }).code).toBe("INVALID_CONTEXT");
    expect(evaluate("admit", { run: { ...run, schema_version: "chord.contracts.v9" } }).code).toBe("SCHEMA_MISMATCH");
    expect(evaluate("admit", { run: { ...run, run_id: "other" } }).code).toBe("RUN_MISMATCH");
    expect(evaluate("admit", { authority: null }).code).toBe("INVALID_CONTEXT");
    const foreign = makeAuthority({ run_id: "other", grants: [{ ...grant, scope: { ...scope, run_id: "other" } }] });
    expect(evaluate("admit", { authority: foreign }).code).toBe("RUN_MISMATCH");
    // Cancellation beats everything after context validity.
    expect(evaluate("dispatch", { task: makeTask({ status: "cancelled" }) }).code).toBe("TASK_CANCELLED");
    expect(evaluate("dispatch", { task: makeTask({ status: "running" }) }).code).toBe("INVALID_TRANSITION");
    expect(evaluate("commit", { task: makeTask({ status: "queued" }) }).code).toBe("INVALID_TRANSITION");
    expect(evaluate("commit", { task: makeTask({ status: "running" }), attempt: makeAttempt({ lease_expires_at: NOW }) }).code).toBe("STALE_ATTEMPT");
    expect(evaluate("dispatch", { attempt: makeAttempt({ task_revision: 9 }) }).code).toBe("STALE_ATTEMPT");
    // authority_revision staleness is a commit-stage guard, not a dispatch guard.
    expect(evaluate("dispatch", { attempt: makeAttempt({ authority_revision: 99 }) }).allowed).toBe(true);
  });

  test("principal, actor and capability gates", () => {
    expect(evaluate("dispatch", { task: makeTask({ authority_binding: { ...makeTask().authority_binding, principal_id: "ghost" } }) }).code).toBe("PRINCIPAL_INVALID");
    expect(evaluate("dispatch", { authority: makeAuthority({ principals: [{ ...principal, expires_at: NOW }] }) }).code).toBe("PRINCIPAL_INVALID");
    expect(evaluate("dispatch", { authority: makeAuthority({ actors: [{ ...actor, revoked_at: NOW }] }) }).code).toBe("ACTOR_INVALID");
    // actor.principal_id must match binding.principal_id; snapshot stays valid by updating grant too.
    expect(evaluate("dispatch", {
      authority: makeAuthority({
        actors: [{ ...actor, principal_id: "human1" }],
        grants: [{ ...grant, principal_id: "human1" }]
      })
    }).code).toBe("ACTOR_INVALID");
    expect(evaluate("dispatch", { task: makeTask({ authority_binding: { ...makeTask().authority_binding, capability: "unknown" } }) }).code).toBe("CAPABILITY_MISSING");
  });

  test("roles confer nothing; scope must equal stored task fields", () => {
    expect(evaluate("dispatch", { authority: makeAuthority({ actors: [{ ...actor, roles: ["admin"] }] }) }).code).toBe("ALLOW");
    expect(evaluate("dispatch", { task: makeTask({ target_entity: "agent2" }) }).code).toBe("SCOPE_MISMATCH");
    expect(evaluate("dispatch", { task: makeTask({ authority_binding: { ...makeTask().authority_binding, scope: { ...scope, project: "other" } } }) }).code).toBe("SCOPE_MISMATCH");
  });

  test("deny beats allow; missing allow denies; expiry boundary equality", () => {
    const denyGrant = { ...grant, grant_id: "grant2", effect: "deny" };
    expect(evaluate("dispatch", { authority: makeAuthority({ grants: [grant, denyGrant] }) }).code).toBe("EXPLICIT_DENY");
    expect(evaluate("dispatch", { authority: makeAuthority({ grants: [] }) }).code).toBe("NO_ALLOW_GRANT");
    const expiring = { ...grant, expires_at: NOW };
    expect(evaluate("dispatch", { authority: makeAuthority({ grants: [expiring] }) }).code).toBe("NO_ALLOW_GRANT");
    const future = { ...grant, issued_at: NOW + 1 };
    expect(evaluate("dispatch", { authority: makeAuthority({ grants: [future] }) }).code).toBe("NO_ALLOW_GRANT");
    const boundary = { ...grant, issued_at: NOW, expires_at: NOW + 1 };
    expect(evaluate("dispatch", { authority: makeAuthority({ grants: [boundary] }) }).allowed).toBe(true);
  });

  test("approval rules: required, rejected, exact attempt, consumed", () => {
    const bindingApprovalRequired = makeTask({ authority_binding: { ...makeTask().authority_binding, approval_required: true } });
    expect(evaluate("dispatch", { task: bindingApprovalRequired }).code).toBe("APPROVAL_REQUIRED");

    const grantRequires = { ...grant, requires_approval: true };
    expect(evaluate("dispatch", { authority: makeAuthority({ grants: [grantRequires] }) }).code).toBe("APPROVAL_REQUIRED");

    const rejection = {
      approval_id: "approval-reject",
      approver_principal_id: "human1",
      decision: "rejected",
      run_id: "run1",
      schema_version,
      task_id: "task1",
      task_revision: 0,
      attempt_id: "attempt1",
      principal_id: "principal1",
      actor_id: "actor1",
      capability: "build",
      scope,
      issued_at: 0,
      expires_at: 10_000,
      revoked_at: null,
      consumed_by_attempt_id: null
    };
    // Active rejection wins even over an available approval.
    const approval = { ...rejection, approval_id: "approval-ok", decision: "approved" };
    expect(evaluate("dispatch", { task: bindingApprovalRequired, authority: makeAuthority({ approvals: [rejection, approval] }) }).code).toBe("APPROVAL_REJECTED");

    // Approval bound to a different attempt does not authorize this one.
    const wrongAttempt = { ...approval, attempt_id: "attempt-other" };
    expect(evaluate("dispatch", { task: bindingApprovalRequired, authority: makeAuthority({ approvals: [wrongAttempt] }) }).code).toBe("APPROVAL_REQUIRED");

    // Lexically first eligible approval is selected.
    const second = { ...approval, approval_id: "approval-aaa", attempt_id: "attempt1" };
    const first = { ...approval, approval_id: "approval-aab", attempt_id: "attempt1" };
    const decision = evaluate("dispatch", { task: bindingApprovalRequired, authority: makeAuthority({ approvals: [first, second] }) });
    expect(decision.allowed).toBe(true);
    expect(decision.approval_id).toBe("approval-aaa");

    // Expired approval cannot authorize.
    expect(evaluate("dispatch", { task: bindingApprovalRequired, authority: makeAuthority({ approvals: [{ ...second, expires_at: NOW }] }) }).code).toBe("APPROVAL_REQUIRED");
  });

  test("commit requires unexpired lease, surviving selected grants and consumed approval", () => {
    const runningTask = () => makeTask({ status: "running" });
    const revokedSelected = makeAuthority({ grants: [{ ...grant, revoked_at: NOW - 1 }] });
    expect(evaluate("commit", { task: runningTask(), authority: revokedSelected }).code).toBe("NO_ALLOW_GRANT");
    expect(evaluate("commit", { task: runningTask(), attempt: makeAttempt({ grant_ids: [] }) }).code).toBe("NO_ALLOW_GRANT");
    // Newly added replacement grants cannot retroactively authorize.
    expect(evaluate("commit", {
      task: runningTask(),
      authority: makeAuthority({ grants: [{ ...grant, grant_id: "grant-other" }] }),
      attempt: makeAttempt({ grant_ids: ["grant1"] })
    }).code).toBe("NO_ALLOW_GRANT");
    // An expired lease is stale.
    expect(evaluate("commit", { task: runningTask(), attempt: makeAttempt({ lease_expires_at: NOW }) }).code).toBe("STALE_ATTEMPT");

    const approvalRecord = {
      approval_id: "approval1",
      approver_principal_id: "human1",
      decision: "approved",
      run_id: "run1",
      schema_version,
      task_id: "task1",
      task_revision: 0,
      attempt_id: "attempt1",
      principal_id: "principal1",
      actor_id: "actor1",
      capability: "build",
      scope,
      issued_at: 0,
      expires_at: 10_000,
      revoked_at: null,
      consumed_by_attempt_id: "attempt1"
    };
    const task = makeTask({ status: "running", authority_binding: { ...makeTask().authority_binding, approval_required: true } });
    const ok = evaluateAuthority({ stage: "commit", now: NOW, run, task, attempt: makeAttempt({ approval_id: "approval1" }), authority: makeAuthority({ approvals: [approvalRecord] }) });
    expect(ok.allowed).toBe(true);
    const unconsumed = evaluateAuthority({ stage: "commit", now: NOW, run, task, attempt: makeAttempt({ approval_id: "approval1" }), authority: makeAuthority({ approvals: [{ ...approvalRecord, consumed_by_attempt_id: null }] }) });
    expect(unconsumed.code).toBe("APPROVAL_REQUIRED");
    // An approval whose attempt_id does not match the committing attempt cannot authorize.
    const wrongAttempt = evaluateAuthority({ stage: "commit", now: NOW, run, task, attempt: makeAttempt({ approval_id: "approval1", attempt_id: "attempt2" }), authority: makeAuthority({ approvals: [{ ...approvalRecord, consumed_by_attempt_id: null }] }) });
    expect(wrongAttempt.code).toBe("APPROVAL_REQUIRED");
  });
});

describe("trusted-host seam and runtime gate", () => {
  const intent = { schema_version, spec_type: "IntentSpec", project: "proj", phase: "phase", target_entity: "agent1", do: ["build"] };

  test("missing authority denies admission before any mutation", () => {
    const bare = createChord();
    const p = bare.createTaskPackets(intent);
    expect(() => bare.queueTaskPackets(p, { principal_id: "x", actor_id: "y", capability: "z" })).toThrow(/INVALID_CONTEXT/);
    expect(bare.registry.tasks[p[0].task_id]).toBeUndefined();
    expect(bare.registry.task_queue.length).toBe(0);
    // Foreign-run grants never install or admit either.
    const other = createChord();
    const host = installHost(other);
    const q = other.createTaskPackets(intent);
    expect(() => other.queueTaskPackets(q, {
      principal_id: host.principal_id,
      actor_id: host.actor_id,
      capability: host.capability,
      issueGrants: ps => ps.map(packet => ({
        ...grant,
        grant_id: `g_${packet.task_id}`,
        scope: { ...scope, run_id: "foreign", task_id: packet.task_id, project: packet.project, phase: packet.phase, target_entity: packet.target_entity, resource: { kind: "task", id: packet.task_id } }
      }))
    })).toThrow(/RUN_MISMATCH/);
    expect(other.registry.tasks[q[0].task_id]).toBeUndefined();
  });

  test("unauthorized dispatch invokes zero adapters and leaves the task queued", async () => {
    let calls = 0;
    const chord = createChord({ runtimePolicy: { retry: { maxAttempts: 3 } } });
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return { status: "completed", outcome: "succeeded" }; } } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    // Revoke the grant through a fresh snapshot; the dispatch gate must deny.
    const authority = chord.getAuthority();
    chord.setAuthoritySnapshot({ ...authority, grants: [], authority_revision: authority.authority_revision + 1 });
    const cycle = await chord.runCycle();
    expect(cycle.ok).toBe(false);
    expect(cycle.code).toBe("NO_ALLOW_GRANT");
    expect(calls).toBe(0);
    expect(chord.registry.tasks[packets[0].task_id].status).toBe("queued");
    expect(chord.registry.task_queue[0].status).toBe("queued");
    expect(chord.inspectEvents({ type: "dispatch_denied" }).length).toBe(1);
  });

  test("authorized dispatch executes and records lease, attempt and consumption-free allow", async () => {
    const chord = createChord();
    const host = installHost(chord);
    chord.setAdapterRouter({ fallback: { execute: () => ({ status: "completed", outcome: "succeeded", outputs: { ok: true } }) } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const cycle = await chord.runCycle();
    expect(cycle.ok).toBe(true);
    expect(cycle.attempt_id).toBeTruthy();
    const task = chord.registry.tasks[packets[0].task_id];
    expect(task.status).toBe("completed");
    expect(chord.inspectEvents({ type: "task_dispatched" }).length).toBe(1);
  });

  test("authority snapshot revisions are monotonic and clock rollback fails closed", () => {
    let t = 1_000;
    const chord = createChord({ trustedHost: { now: () => t } });
    const host = installHost(chord);
    expect(chord.getAuthority().authority_revision).toBe(0);
    expect(() => chord.setAuthoritySnapshot({ ...chord.getAuthority(), authority_revision: 0 })).toThrow(/STALE_REVISION/);
    expect(() => chord.setAuthoritySnapshot({ ...chord.getAuthority(), run_id: "foreign", authority_revision: 1 })).toThrow(/RUN_MISMATCH/);
    const packets = chord.createTaskPackets(intent);
    // Forward time is fine; backward movement fails closed.
    t = 2_000;
    chord.queueTaskPackets(packets, queueOptions(host));
    t = 500;
    expect(() => chord.queueTaskPackets(chord.createTaskPackets(intent), queueOptions(host))).toThrow(/INVALID_CONTEXT/);
  });

  test("approval-required task never reaches the adapter without a human approval", async () => {
    let calls = 0;
    let t = 1_000;
    const chord = createChord({ trustedHost: { now: () => t }, runtimePolicy: { retry: { maxAttempts: 1 } } });
    const host = installHost(chord, { approvalRequired: true });
    chord.setAdapterRouter({ fallback: { execute: () => { calls++; return { status: "completed", outcome: "succeeded" }; } } });
    const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
    const attempt = chord.prepareAttempt(packets[0].task_id);
    const denied = await chord.runCycle();
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("APPROVAL_REQUIRED");
    expect(calls).toBe(0);

    // Host attests human approval for this exact prepared attempt.
    const approval = {
      approval_id: "approval1",
      approver_principal_id: "human-approver",
      decision: "approved",
      run_id: chord.registry.run.run_id,
      schema_version,
      task_id: packets[0].task_id,
      task_revision: 0,
      attempt_id: attempt.attempt_id,
      principal_id: host.principal_id,
      actor_id: host.actor_id,
      capability: host.capability,
      scope: {
        run_id: chord.registry.run.run_id,
        project: packets[0].project,
        phase: packets[0].phase,
        task_id: packets[0].task_id,
        target_entity: packets[0].target_entity,
        resource: { kind: "task", id: packets[0].task_id }
      },
      issued_at: 1_000,
      expires_at: 10_000,
      revoked_at: null,
      consumed_by_attempt_id: null
    };
    const authority = chord.getAuthority();
    chord.setAuthoritySnapshot({ ...authority, approvals: [approval], authority_revision: authority.authority_revision + 1 });
    const allowed = await chord.runCycle();
    expect(allowed.ok).toBe(true);
    expect(calls).toBe(1);
    // Consumption is kernel-owned and recorded on the live snapshot.
    expect(chord.getAuthority().approvals[0].consumed_by_attempt_id).toBe(attempt.attempt_id);
    // A consumed approval cannot be replayed for another attempt.
    const { packets: more } = chord.registerSpecAndQueue(intent, queueOptions(host, { priority: 1 }));
    const secondDenied = await chord.runCycle();
    expect(secondDenied.code).toBe("APPROVAL_REQUIRED");
    expect(calls).toBe(1);
  });

  test("authorityError produces fixed sanitized codes", () => {
    const error = authorityError("NO_ALLOW_GRANT");
    expect(error.code).toBe("NO_ALLOW_GRANT");
    expect(String(error.message)).toBe("NO_ALLOW_GRANT");
  });
});
