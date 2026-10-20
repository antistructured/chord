import { createRegistry, registerSpec, transitionArtifact } from "../registry/registry.js";
import { queryArtifacts, queryDomains, listDeadLetterTasks } from "../registry/query.js";
import { serializeRegistry, exportRegistry } from "../registry/snapshot.js";
import { createIntentTaskPacket, createHandoffTaskPackets } from "../execution/task-packets.js";
import { registerTaskPackets } from "../execution/results.js";
import { createTaskQueue, enqueueTask, replayDeadLetterTask, listQueuedTasks } from "../platform/task-queue.js";
import { createAdapterRouter } from "../platform/adapter-routing.js";
import { createRuntimePolicy } from "../platform/policy.js";
import { createDeterministicAuditReport, replayRegistryJournal } from "../platform/journal-audit.js";
import { runRuntimeCycle } from "../platform/runtime-loop.js";
import { appendRegistryEvent, listRegistryEvents } from "../platform/event-journal.js";
import { evaluateAuthority, authorityError } from "../platform/authorization.js";
import { prepareAttemptRecord, invalidatePendingAttempt } from "../platform/attempts.js";
import { deepClone } from "../utils/clone.js";
import { assertTaskPacket, assertSpec, RegistryData, AuthoritySnapshot, TaskAuthority, Grant, SCHEMA_VERSION, CONTRACT_LIMITS, contractError } from "../contracts/sigils.js";

export function createChord(options = {}) {
  const registry = options.registry === undefined ? createRegistry() : RegistryData.assert(options.registry);
  registry.task_queue ||= createTaskQueue();
  registry.pending_attempts ||= {};
  let router = createAdapterRouter(options.adapterRouter || {});
  let policy = createRuntimePolicy(options.runtimePolicy || {});

  // Trusted-host seam: the embedding host owns the clock and installs
  // authority. JavaScript objects passed here are host-trusted arguments,
  // never forwarded request data. Backward clock movement fails closed.
  const trustedHost = options.trustedHost || null;
  let lastNow = -1;
  function hostNow() {
    const raw = trustedHost && typeof trustedHost.now === "function" ? trustedHost.now() : Date.now();
    if (!Number.isSafeInteger(raw) || raw < 0 || raw < lastNow) throw authorityError("INVALID_CONTEXT");
    lastNow = raw;
    return raw;
  }

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

  if (trustedHost && trustedHost.authoritySnapshot !== undefined && trustedHost.authoritySnapshot !== null) {
    setAuthoritySnapshot(trustedHost.authoritySnapshot);
  }

  return {
    registry,
    parseText,
    registerSpec: register,
    registerSpecAndQueue,
    createTaskPackets,
    queueTaskPackets,
    setAuthoritySnapshot,
    prepareAttempt,
    getAuthority: () => (registry.authority ? deepClone(registry.authority) : null),
    getRunRevision: () => registry.run.revision,
    runCycle: async () => runRuntimeCycle(registry, router, policy, { now: () => hostNow() }),
    setAdapterRouter(value) { router = createAdapterRouter(value); return router; },
    setRuntimePolicy(value) { policy = createRuntimePolicy(value); return policy; },
    queryArtifacts: (criteria = {}) => queryArtifacts(registry, criteria),
    queryDomains: (criteria = {}) => queryDomains(registry, criteria),
    queryQueue: (criteria = {}) => listQueuedTasks(registry, criteria),
    queryDeadLetters: () => listDeadLetterTasks(registry),
    replayTask: (taskId) => replayDeadLetterTask(registry, taskId),
    replayJournal: (replayOptions = {}) => replayRegistryJournal(registry, replayOptions),
    inspectAudit: (auditOptions = {}) => createDeterministicAuditReport(registry, auditOptions),
    inspectEvents: (filters = {}) => listRegistryEvents(registry, filters),
    exportRegistry: () => exportRegistry(registry),
    serializeRegistry: () => serializeRegistry(registry),
    _invalidatePendingAttempt: (taskId) => invalidatePendingAttempt(registry, taskId)
  };
}
