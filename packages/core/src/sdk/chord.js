import { createRegistry, registerSpec } from "../registry/registry.js";
import { createStateOwner } from "../registry/owner.js";
import { admitOperation, operationFor, reconcileTask } from "../platform/reconciliation.js";
import { projectContext, proposeHandoff, respondToHandoff } from "../platform/handoff.js";
import { pauseForApproval, resumeRun, rejectApproval, cancelRun } from "../platform/approval-flow.js";
import { queryArtifacts, queryDomains, listDeadLetterTasks } from "../registry/query.js";
import { serializeRegistry, exportRegistry } from "../registry/snapshot.js";
import { createIntentTaskPacket, createHandoffTaskPackets } from "../execution/task-packets.js";
import { registerTaskPackets } from "../execution/results.js";
import { enqueueTask, listQueuedTasks } from "../platform/task-queue.js";
import { createAdapterRouter } from "../platform/adapter-routing.js";
import { createRuntimePolicy } from "../platform/policy.js";
import { createDeterministicAuditReport, replayRegistryJournal } from "../platform/journal-audit.js";
import { runRuntimeCycle } from "../platform/runtime-loop.js";
import { appendRegistryEvent, listRegistryEvents } from "../platform/event-journal.js";
import { evaluateAuthority, authorityError } from "../platform/authorization.js";
import { prepareAttemptRecord, invalidatePendingAttempt, clearActiveAttempt } from "../platform/attempts.js";
import { transitionTaskStatus, canQueueTransition } from "../platform/transitions.js";
import { deepClone } from "../utils/clone.js";
import { assertTaskPacket, assertSpec, ContextRequest, RegistryData, AuthoritySnapshot, TaskAuthority, Grant, Approval, SCHEMA_VERSION, CONTRACT_LIMITS, contractError } from "../contracts/sigils.js";

import { openSqliteStore } from "../runtime/storage/sqlite.js";
import { recoverOwner } from "../runtime/recovery.js";
import { storageError } from "../storage/contract.js";

/** Synchronous trusted-host construction. storage is {path, mode, busyTimeoutMs?}.
 * Existing stores supply canonical authority; host services must be supplied anew.
 * close() releases resources without drain/commit: hosts should await cycles first.
 */
export function createChord(options = {}) {
  const durable = options.storage !== undefined;
  const trustedHost = options.trustedHost || null;
  let lastNow = -1, clockFloor = 0;
  function hostNow() {
    const raw = trustedHost && typeof trustedHost.now === "function" ? trustedHost.now() : Date.now();
    if (!Number.isSafeInteger(raw) || raw < 0) throw authorityError("INVALID_CONTEXT");
    const effective = durable ? Math.max(clockFloor, raw) : raw;
    if (effective < lastNow) throw authorityError("INVALID_CONTEXT");
    lastNow = effective;
    return effective;
  }
  let store = null;
  try {
  if (durable && options.registry !== undefined) throw storageError('INVALID_CONTEXT');
  if (durable && options.storage?.mode === 'existing' && trustedHost?.authoritySnapshot != null) throw storageError('INVALID_CONTEXT');
  if (durable) {
    store = openSqliteStore(options.storage);
    if (options.storage.mode === 'create') {
      const initial = createStateOwner(createRegistry()).read();
      store.init({ initialRegistry: initial, logicalNow: hostNow() });
    } else clockFloor = store.load().logicalNow;
    hostNow();
  }
  const owner = createStateOwner(store ? undefined : options.registry === undefined ? createRegistry() : options.registry, {
    store, now: hostNow, observeFloor: floor => { clockFloor = Math.max(clockFloor, floor); }
  });
  if (store) recoverOwner(owner, hostNow);
  // Bound only during an owner callback; never retain a last-read registry.
  let registry;
  function mutate(operation, action, expectedRevision) {
    // The alias exists only as transaction-local working data, never authority.
    return owner.transact(operation, draft => {
      const previous = registry;
      registry = draft;
      try { return action(draft); } finally { registry = previous; }
    }, expectedRevision);
  }
  const read = () => deepClone(owner.read());
  let router = createAdapterRouter(options.adapterRouter || {});
  let policy = createRuntimePolicy(options.runtimePolicy || {});

  function setAuthoritySnapshot(snapshot, snapshotOptions = {}) {
    const value = AuthoritySnapshot.assert(snapshot);
    if (value.run_id !== registry.run.run_id) throw authorityError("RUN_MISMATCH");
    if (value.schema_version !== registry.run.schema_version) throw authorityError("SCHEMA_MISMATCH");
    const next = registry.authority === null ? 0 : registry.authority.authority_revision + 1;
    if (value.authority_revision !== next) throw authorityError("STALE_REVISION");
    if (snapshotOptions.expectedAuthorityRevision !== undefined && snapshotOptions.expectedAuthorityRevision !== next) throw authorityError("STALE_REVISION");
    // Approval consumption is kernel-owned: a snapshot swap may not reset it.
    if (registry.authority) {
      const consumed = new Map(registry.authority.approvals.filter(a => a.consumed_by_attempt_id !== null).map(a => [a.approval_id, a.consumed_by_attempt_id]));
      for (const approval of value.approvals) {
        const existing = consumed.get(approval.approval_id);
        if (existing !== undefined && approval.consumed_by_attempt_id !== existing && approval.consumed_by_attempt_id !== null) throw authorityError("INVALID_SEMANTICS");
        if (existing !== undefined && approval.consumed_by_attempt_id === null) approval.consumed_by_attempt_id = existing;
      }
    }
    registry.authority = value;
    registry.run.revision += 1;
    appendRegistryEvent(registry, "authority_snapshot_set", { authority_revision: next });
    return deepClone(value);
  }

  function installGrants(grants) {
    if (!Array.isArray(grants) || grants.length === 0) return;
    if (!registry.authority) throw authorityError("INVALID_CONTEXT");
    const validated = grants.map(g => Grant.assert(g));
    const seen = new Set(registry.authority.grants.map(g => g.grant_id));
    for (const grant of validated) {
      if (seen.has(grant.grant_id)) throw contractError("INVALID_SEMANTICS");
      if (grant.scope.run_id !== registry.run.run_id) throw authorityError("RUN_MISMATCH");
      seen.add(grant.grant_id);
    }
    const next = AuthoritySnapshot.assert({
      ...deepClone(registry.authority),
      grants: [...registry.authority.grants, ...validated],
      authority_revision: registry.authority.authority_revision + 1
    });
    registry.authority = next;
    registry.run.revision += 1;
    appendRegistryEvent(registry, "grants_installed", { count: validated.length });
  }

  /** Host helper: build one contract-valid grant for a task packet.
   * Derives the run id and the nested scope shape from this run and the
   * packet, so a host never has to reproduce the scope contract by hand.
   * Shapes data only: it grants nothing, installs nothing and reads no
   * authority state. The grant still has to be installed by the host through
   * setAuthoritySnapshot / the issueGrants callback, and the runtime still
   * re-evaluates it at admit, dispatch and commit.
   */
  function createTaskGrant(packet, grantOptions = {}) {
    const registry = owner.read();
    const value = assertTaskPacket(packet);
    if (typeof grantOptions.principal_id !== "string" || typeof grantOptions.actor_id !== "string" || typeof grantOptions.capability !== "string") throw authorityError("INVALID_CONTEXT");
    return Grant.assert({
      grant_id: grantOptions.grant_id || `grant_${value.task_id}`,
      principal_id: grantOptions.principal_id,
      actor_id: grantOptions.actor_id,
      capability: grantOptions.capability,
      effect: grantOptions.effect === "deny" ? "deny" : "allow",
      scope: {
        run_id: registry.run.run_id,
        project: value.project,
        phase: value.phase,
        task_id: value.task_id,
        target_entity: value.target_entity,
        resource: { kind: "task", id: value.task_id }
      },
      issued_at: Number.isSafeInteger(grantOptions.issued_at) ? grantOptions.issued_at : 0,
      expires_at: Number.isSafeInteger(grantOptions.expires_at) ? grantOptions.expires_at : Number.MAX_SAFE_INTEGER,
      revoked_at: null,
      requires_approval: grantOptions.requires_approval === true
    });
  }

  /** Host helper: build one contract-valid approval for a prepared attempt.
   * Derives the run id, scope, task revision and requesting identity from the
   * stored task, so a host never has to reproduce the approval contract by
   * hand. Shapes data only: it approves nothing and installs nothing. The
   * approval still has to be installed by the host through
   * setAuthoritySnapshot, and resumeRun still requires an attested human
   * principal that differs from the requesting principal.
   */
  function createApproval(approvalOptions = {}) {
    const registry = owner.read();
    const task = registry.tasks[approvalOptions.task_id];
    if (!task || typeof task.task_id !== "string") throw contractError("INVALID_DATA");
    if (typeof approvalOptions.approver_principal_id !== "string") throw authorityError("INVALID_CONTEXT");
    const binding = task.authority_binding;
    const attempt = registry.pending_attempts[task.task_id];
    const attempt_id = approvalOptions.attempt_id || attempt?.attempt_id;
    if (typeof attempt_id !== "string") throw authorityError("INVALID_CONTEXT");
    return Approval.assert({
      approval_id: approvalOptions.approval_id || `approval_${task.task_id}`,
      approver_principal_id: approvalOptions.approver_principal_id,
      decision: "approved",
      run_id: registry.run.run_id,
      schema_version: registry.run.schema_version,
      task_id: task.task_id,
      task_revision: task.task_revision ?? 0,
      attempt_id,
      principal_id: binding.principal_id,
      actor_id: binding.actor_id,
      capability: binding.capability,
      scope: binding.scope,
      issued_at: Number.isSafeInteger(approvalOptions.issued_at) ? approvalOptions.issued_at : 0,
      expires_at: Number.isSafeInteger(approvalOptions.expires_at) ? approvalOptions.expires_at : Number.MAX_SAFE_INTEGER,
      revoked_at: null,
      consumed_by_attempt_id: null
    });
  }

  function parseText(text) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > CONTRACT_LIMITS.bytes) throw contractError("LIMIT_EXCEEDED");
    const arrayFields = new Set(["entity", "do", "dont", "verify", "stop", "files", "rules", "depends", "assign", "to", "handoff", "evidence", "assumptions", "blockers", "requested_action"]);
    const scalarFields = new Set(["id", "project", "phase", "version", "goal", "intent", "role", "stance", "target_entity", "artifact", "from", "status"]);
    const mapFields = new Set(["state", "authority"]);
    const spec = { schema_version: SCHEMA_VERSION };
    let current = null;
    // Accept actual newlines and the historical literal \n input notation.
    for (const raw of text.split(/\r?\n|\\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("@")) {
        const match = /^@([a-z_]+)(?: (.*))?$/.exec(line);
        if (!match) throw contractError("INVALID_SHAPE");
        current = match[1];
        if ((!arrayFields.has(current) && !scalarFields.has(current) && !mapFields.has(current)) || Object.hasOwn(spec, current)) throw contractError("INVALID_SHAPE");
        spec[current] = arrayFields.has(current) || mapFields.has(current) ? [] : "";
        if (match[2]) {
          if (Array.isArray(spec[current])) spec[current].push(match[2]);
          else spec[current] = match[2];
        }
      } else {
        if (!current) throw contractError("INVALID_SHAPE");
        const value = line.startsWith("- ") ? line.slice(2) : line;
        if (Array.isArray(spec[current])) spec[current].push(value);
        else spec[current] += (spec[current] ? "\n" : "") + value;
      }
    }
    for (const field of mapFields) if (spec[field]) {
      const out = Object.create(null);
      for (const item of spec[field]) {
        const index = item.indexOf(":");
        if (index <= 0) throw contractError("INVALID_SHAPE");
        const key = item.slice(0, index).trim();
        if (Object.hasOwn(out, key)) throw contractError("INVALID_SHAPE");
        out[key] = item.slice(index + 1).trim();
      }
      spec[field] = out;
    }
    spec.spec_type = spec.artifact && spec.from ? "HandoffSpec" : (spec.authority || spec.assign || spec.entity) ? "CoordSpec" : "IntentSpec";
    return { spec: assertSpec(spec) };
  }

  function register(spec) {
    spec = assertSpec(spec);
    registerSpec(registry, spec);
    appendRegistryEvent(registry, "spec_registered", { spec_type: spec.spec_type, project: spec.project, phase: spec.phase });
    return { registry, spec };
  }

  function createTaskPackets(spec) {
    spec = assertSpec(spec);
    if (spec.spec_type === "HandoffSpec") return createHandoffTaskPackets(spec);
    if (spec.spec_type === "IntentSpec") return [createIntentTaskPacket(spec)];
    return [];
  }

  function queueTaskPackets(packets, queueOptions = {}) {
    if (!Array.isArray(packets)) throw new TypeError("packets must be an array");
    packets = packets.map(assertTaskPacket);
    const seen = new Set();
    for (const packet of packets) {
      if (seen.has(packet.task_id) || Object.hasOwn(registry.tasks, packet.task_id)) throw contractError("INVALID_SEMANTICS");
      seen.add(packet.task_id);
    }
    if (typeof queueOptions.principal_id !== "string" || typeof queueOptions.actor_id !== "string" || typeof queueOptions.capability !== "string") throw authorityError("INVALID_CONTEXT");
    const now = hostNow();
    if (queueOptions.issueGrants !== undefined) {
      if (typeof queueOptions.issueGrants !== "function") throw authorityError("INVALID_CONTEXT");
      installGrants(queueOptions.issueGrants(packets));
    }
    const bindings = packets.map(packet => TaskAuthority.assert({
      principal_id: queueOptions.principal_id,
      actor_id: queueOptions.actor_id,
      capability: queueOptions.capability,
      scope: {
        run_id: registry.run.run_id,
        project: packet.project,
        phase: packet.phase,
        task_id: packet.task_id,
        target_entity: packet.target_entity,
        resource: { kind: "task", id: packet.task_id }
      },
      approval_required: queueOptions.approval_required === true
    }));
    // Admission: every packet must be allowed before any mutation happens.
    for (let i = 0; i < packets.length; i++) {
      const candidate = { ...packets[i], status: "queued", authority_binding: bindings[i] };
      const decision = evaluateAuthority({ stage: "admit", now, run: registry.run, task: candidate, attempt: null, authority: registry.authority });
      if (!decision.allowed) throw authorityError(decision.code);
    }
    registerTaskPackets(registry, packets, bindings);
    packets.forEach(packet => admitOperation(registry, packet));
    packets.forEach(packet => {
      enqueueTask(registry, packet, {
        priority: queueOptions.priority ?? 0,
        max_attempts: policy.retry.maxAttempts,
        now
      });
      appendRegistryEvent(registry, "task_enqueued", { task_id: packet.task_id, target_entity: packet.target_entity });
    });
    registry.run.revision += 1;
    return packets;
  }

  function registerSpecAndQueue(spec, queueOptions = {}) {
    register(spec);
    const packets = createTaskPackets(spec);
    queueTaskPackets(packets, queueOptions);
    return { spec, packets };
  }

  function prepareAttempt(taskId) {
    const task = registry.tasks[taskId];
    if (!task || typeof task.task_id !== "string") throw contractError("INVALID_DATA");
    if (task.status !== "queued") throw authorityError("INVALID_TRANSITION");
    return deepClone(prepareAttemptRecord(registry, task));
  }

  /** Explicit host cancellation (design §4). Legal from any non-terminal
   * state; terminal states and dead_letter (replay-only exit) reject.
   * Bumps the run revision, so an in-flight attempt's commit guard goes
   * stale: a late result is ignored, never committed over the cancel.
   */
  function cancelTask(taskId, cancelOptions = {}) {
    const task = registry.tasks[taskId];
    if (!task || typeof task.task_id !== "string") throw contractError("INVALID_DATA");
    if (cancelOptions.expectedRevision !== undefined && cancelOptions.expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
    transitionTaskStatus(registry, taskId, "cancelled");
    const operation = operationFor(registry, taskId);
    if (operation?.state === "dispatched") operation.state = "unknown";
    const entry = registry.task_queue.find(x => x.task_id === taskId);
    if (entry && canQueueTransition(entry.status, "cancelled")) entry.status = "cancelled";
    invalidatePendingAttempt(registry, taskId);
    clearActiveAttempt(registry, taskId);
    registry.run.revision += 1;
    appendRegistryEvent(registry, "task_cancelled", { task_id: taskId });
    return deepClone(task);
  }

  /** Explicit host reconciliation / replay (design §5): legal only from
   * `dead_letter`, `uncertain`, or `blocked`, and only through fresh
   * admission — a revoked or denied grant leaves the task exactly where
   * it was. A successful replay is a fresh queued attempt: retry counters
   * reset, prior attempt reservations invalidated, and previously
   * consumed approvals stay consumed (kernel-owned, never reset here).
   */
  function replayTask(taskId, replayOptions = {}) {
    const task = registry.tasks[taskId];
    if (!task || typeof task.task_id !== "string") throw contractError("INVALID_DATA");
    if (replayOptions.expectedRevision !== undefined && replayOptions.expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
    const previousStatus = task.status;
    const operation = operationFor(registry, taskId);
    if (["uncertain", "blocked"].includes(previousStatus) && (!operation || operation.state !== "not_executed" || !operation.reconciliation_id)) throw authorityError("RECONCILIATION_REQUIRED");
    if (!["dead_letter", "uncertain", "blocked"].includes(previousStatus)) throw authorityError("INVALID_TRANSITION");
    const now = hostNow();
    const decision = evaluateAuthority({ stage: "admit", now, run: registry.run, task: { ...task, status: "queued" }, attempt: null, authority: registry.authority });
    if (!decision.allowed) throw authorityError(decision.code);
    transitionTaskStatus(registry, taskId, "queued");
    if (operation) { operation.state = "requested"; operation.attempt_id = null; }
    task.retry_count = 0;
    const entry = registry.task_queue.find(x => x.task_id === taskId);
    if (entry) {
      if (canQueueTransition(entry.status, "queued")) entry.status = "queued";
      entry.retry_count = 0;
      entry.available_at = now;
      entry.lease_expires_at = null;
      entry.last_error = null;
    }
    invalidatePendingAttempt(registry, taskId);
    clearActiveAttempt(registry, taskId);
    registry.run.revision += 1;
    appendRegistryEvent(registry, "task_replayed", { task_id: taskId, from_status: previousStatus });
    return deepClone(task);
  }

  if (trustedHost && trustedHost.authoritySnapshot !== undefined && trustedHost.authoritySnapshot !== null) {
    mutate("authority_snapshot", () => setAuthoritySnapshot(trustedHost.authoritySnapshot));
  }

  return {
    get registry() { return read(); },
    parseText,
    registerSpec: spec => mutate("register_spec", () => register(spec)),
    registerSpecAndQueue: (spec, opts = {}) => mutate("admit_spec", () => registerSpecAndQueue(spec, opts), opts.expectedRevision),
    createTaskPackets,
    queueTaskPackets: (packets, opts = {}) => mutate("admit_tasks", () => queueTaskPackets(packets, opts), opts.expectedRevision),
    setAuthoritySnapshot: (snapshot, opts = {}) => mutate("authority_snapshot", () => setAuthoritySnapshot(snapshot, opts), opts.expectedRevision),
    prepareAttempt: id => mutate("prepare_attempt", () => prepareAttempt(id)),
    cancelTask: (id, opts = {}) => mutate("cancel_task", () => cancelTask(id, opts), opts.expectedRevision),
    getAuthority: () => deepClone(owner.read().authority),
    getRegistry: read,
    getRunState: () => owner.read().run.state || "unknown",
    getRunRevision: () => owner.read().run.revision,
    createTaskGrant,
    createApproval,
    // Trusted-host administrative CAS, not an actor request endpoint.
    commitRun: args => owner.install(args),
    projectContext: (opts = {}) => {
      const input = ContextRequest.assert(opts);
      const at = hostNow();
      return projectContext(read(), { ...input, now: at });
    },
    proposeHandoff: (opts = {}) => mutate("propose_handoff", () => proposeHandoff(registry, opts), opts.expectedRevision),
    respondToHandoff: (opts = {}) => mutate("respond_handoff", () => respondToHandoff(registry, opts), opts.expectedRevision),
    pauseForApproval: (opts = {}) => mutate("pause_run", () => pauseForApproval(registry, opts), opts.expectedRevision),
    resumeRun: (opts = {}) => mutate("resume_run", () => {
      if (registry.run.state !== "paused") throw authorityError("INVALID_TRANSITION");
      const at = hostNow();
      const human = registry.authority?.principals.find(p => p.principal_id === opts.principal_id && p.kind === "human" && p.authenticated_at <= at && at < p.expires_at);
      if (!human) throw authorityError("PRINCIPAL_INVALID");
      for (const task of Object.values(registry.tasks)) {
        if (task.status !== "queued") continue;
        const required = task.authority_binding.approval_required || registry.authority.grants.some(g => g.scope.task_id === task.task_id && g.requires_approval && g.effect === "allow" && g.revoked_at === null && g.issued_at <= at && at < g.expires_at);
        if (!required) continue;
        const attempt = registry.pending_attempts[task.task_id];
        const decision = evaluateAuthority({ stage: "dispatch", now: at, run: registry.run, task, attempt: attempt || null, authority: registry.authority });
        const approval = registry.authority.approvals.find(a => a.approval_id === decision.approval_id);
        if (!decision.allowed || !approval || approval.approver_principal_id !== human.principal_id || (opts.approval_id && opts.approval_id !== approval.approval_id)) throw authorityError("APPROVAL_REQUIRED");
      }
      return resumeRun(registry, opts, at);
    }, opts.expectedRevision),
    rejectApproval: (opts = {}) => mutate("reject_approval", () => rejectApproval(registry, opts), opts.expectedRevision),
    cancelRun: (opts = {}) => mutate("cancel_run", () => {
      const result = cancelRun(registry, opts);
      for (const operation of Object.values(registry.operations || {})) if (operation.state === "dispatched") operation.state = "unknown";
      return result;
    }, opts.expectedRevision),
    runCycle: async () => runRuntimeCycle({ read: () => owner.read(), transact: (op, fn) => mutate(op, fn) }, router, policy, { now: hostNow }),
    setAdapterRouter(value) { router = createAdapterRouter(value); return { ...router, exact: { ...router.exact }, prefix: { ...router.prefix } }; },
    setRuntimePolicy(value) { policy = createRuntimePolicy(value); return deepClone(policy); },
    queryArtifacts: (criteria = {}) => queryArtifacts(read(), criteria),
    queryDomains: (criteria = {}) => queryDomains(read(), criteria),
    queryQueue: (criteria = {}) => listQueuedTasks(read(), criteria),
    queryDeadLetters: () => listDeadLetterTasks(read()),
    reconcileTask: request => mutate("reconcile_effect", () => reconcileTask(registry, request, hostNow()), request?.expectedRevision),
    replayTask: (id, opts = {}) => mutate("readmit_task", () => replayTask(id, opts), opts.expectedRevision),
    replayJournal: (opts = {}) => replayRegistryJournal(read(), opts),
    inspectAudit: (opts = {}) => createDeterministicAuditReport(read(), opts),
    inspectEvents: (opts = {}) => listRegistryEvents(read(), opts),
    exportRegistry: () => exportRegistry(owner.read()),
    serializeRegistry: () => serializeRegistry(owner.read()),
    _invalidatePendingAttempt: id => mutate("invalidate_attempt", () => invalidatePendingAttempt(registry, id)),
    close: () => owner.close()
  };
  } catch (error) { store?.close(); throw error; }
}
