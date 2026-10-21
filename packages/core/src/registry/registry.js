import { stableId } from "../utils/id.js";
import { deepClone } from "../utils/clone.js";
import { assertTaskPacket, assertSpec, TaskAuthority, Outcome, SCHEMA_VERSION, contractError, RegistryData } from "../contracts/sigils.js";
import { markQueueEntryStatus } from "../platform/task-queue.js";
import { assertArtifactTransition, assertDomainTransition, assertTaskTransition } from "../platform/transitions.js";
import { invalidatePendingAttempt } from "../platform/attempts.js";
import { authorityError } from "../platform/authorization.js";
import { assertCanonicalTransition } from "../platform/state-invariants.js";

export function createRegistry() {
  return {
    run: { run_id: stableId("run"), schema_version: SCHEMA_VERSION, revision: 0, state: "created", causation_id: null, correlation_id: null },
    artifacts: {},
    domains: {},
    tasks: {},
    task_queue: [],
    event_journal: [],
    execution_results: [],
    trigger_state: {},
    specs: [],
    authority: null,
    pending_attempts: {},
    active_attempts: {}
  };
}

/** Whole-run clone-swap CAS (Block 3). Validates nextRegistry, compares
 * expectedRevision against current registry.run.revision, swaps the
 * owner-held reference in one synchronous section with no awaits.
 * Returns { ok: true, revision } or { ok: false, code: "STALE_REVISION" }.
 */
export function commitRun(owner, { expectedRevision, nextRegistry, operation = "host_commit" } = {}) {
  if (!owner || typeof owner !== "object" || !owner.registry) throw authorityError("INVALID_CONTEXT");
  const current = owner.registry;
  if (!Number.isSafeInteger(expectedRevision)) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== current.run.revision) return { ok: false, code: "STALE_REVISION" };
  const next = RegistryData.assert(nextRegistry);
  if (next.run.run_id !== current.run.run_id) throw authorityError("RUN_MISMATCH");
  if (next.run.schema_version !== current.run.schema_version) throw authorityError("SCHEMA_MISMATCH");
  if (next.run.revision !== current.run.revision + 1) throw authorityError("STALE_REVISION");
  // Existing committed evidence cannot be rewritten by a candidate.
  if (JSON.stringify(next.event_journal.slice(0, current.event_journal.length)) !== JSON.stringify(current.event_journal)) throw authorityError("INVALID_HISTORY");
  assertCanonicalTransition(current, next, operation);
  owner.registry = next;
  return { ok: true, revision: next.run.revision };
}

export function registerSpec(registry, spec) {
  spec = assertSpec(spec);
  registry.specs.push(spec);

  const specType = spec?.spec_type || detectSpecTypeFromSpec(spec);
  if (specType === "CoordSpec") {
    for (const domain of Object.keys(spec.state || {})) {
      registry.domains[domain] ||= {
        name: domain,
        owner: spec.authority?.[domain] || null,
        delegates: [],
        state: spec.state?.[domain] || "pending",
        project: spec.project,
        phase: spec.phase,
        state_history: [{ to: spec.state?.[domain] || "pending", at: Date.now() }]
      };
    }
    for (const [artifact, to] of normalizeCoordHandoffs(spec.handoff || [])) {
      registry.artifacts[artifact] ||= {
        name: artifact,
        status: "declared",
        producers: [],
        consumers: Array.from(new Set([...(registry.artifacts[artifact]?.consumers || []), to])),
        project: spec.project,
        phase: spec.phase,
        history: [{ from: null, to: "declared", at: Date.now() }]
      };
    }
  }

  if (specType === "HandoffSpec" && spec.artifact) {
    // Spec registration is descriptive only (design §4): it declares the
    // artifact and its producers/consumers but never changes artifact
    // status. Status moves only through a guarded, authorized committed
    // result below.
    const artifact = registry.artifacts[spec.artifact] ||= {
      name: spec.artifact,
      status: "declared",
      producers: [],
      consumers: [],
      project: spec.project,
      phase: spec.phase,
      history: [{ from: null, to: "declared", at: Date.now() }]
    };
    artifact.producers = Array.from(new Set([...(artifact.producers || []), spec.from].filter(Boolean)));
    artifact.consumers = Array.from(new Set([...(artifact.consumers || []), ...toArray(spec.to)]));
  }

  return registry;
}

export function transitionArtifact(record, next) {
  if (record.status === next) return record;
  assertArtifactTransition(record.status, next);
  const prev = record.status || null;
  record.status = next;
  record.history ||= [];
  record.history.push({ from: prev, to: next, at: Date.now() });
  return record;
}

export function registerTask(registry, packet, binding) {
  packet = assertTaskPacket(packet);
  binding = TaskAuthority.assert(binding);
  if (binding.scope.run_id !== registry.run.run_id || binding.scope.task_id !== packet.task_id ||
    binding.scope.project !== packet.project || binding.scope.phase !== packet.phase ||
    binding.scope.target_entity !== packet.target_entity) throw contractError("INVALID_SEMANTICS");
  registry.tasks[packet.task_id] = {
    ...deepClone(packet),
    authority_binding: deepClone(binding),
    status: "queued",
    created_at: Date.now(),
    retry_count: 0
  };
  return registry.tasks[packet.task_id];
}

/** Commit a correlated, authorized result (design §5 steps 4-5). Requires
 * the task to be mid-attempt (`running`) with a matching active attempt;
 * every referenced transition is validated before any mutation so a
 * rejected result leaves the registry unchanged. A second result for a
 * consumed attempt finds no active attempt and is rejected — it cannot
 * append another record or repeat terminal transitions.
 */
export function registerExecutionResult(registry, result) {
  result = Outcome.assert(result);
  const task = registry.tasks[result.task_id];
  if (!task) throw contractError("INVALID_RESULT");
  const active = registry.active_attempts[result.task_id];
  if (!active) throw contractError("INVALID_RESULT");
  const attempt = active.attempt;
  if (result.run_id !== registry.run.run_id ||
    result.schema_version !== registry.run.schema_version ||
    result.task_revision !== (task.task_revision ?? 0) ||
    result.attempt_id !== attempt.attempt_id ||
    result.queue_id !== attempt.queue_id) throw contractError("INVALID_RESULT");

  // Validate every derived transition before mutating anything.
  assertTaskTransition(task.status, result.status);
  if (result.artifact && registry.artifacts[result.artifact]) {
    assertArtifactTransition(registry.artifacts[result.artifact].status, result.outcome === "succeeded" ? "accepted" : "rejected");
  }
  if (result.domain && registry.domains[result.domain]) {
    assertDomainTransition(registry.domains[result.domain].state, result.outcome === "succeeded" ? "complete" : "blocked");
  }

  // Mutations: single synchronous section, no awaits.
  task.status = result.status;
  task.last_result = deepClone(result);
  registry.execution_results.push(deepClone(result));
  markQueueEntryStatus(registry, result.task_id, result.status);
  if (result.artifact && registry.artifacts[result.artifact]) {
    transitionArtifact(registry.artifacts[result.artifact], result.outcome === "succeeded" ? "accepted" : "rejected");
  }
  if (result.domain && registry.domains[result.domain]) {
    const domain = registry.domains[result.domain];
    const next = result.outcome === "succeeded" ? "complete" : "blocked";
    if (domain.state !== next) {
      domain.state = next;
      domain.state_history ||= [];
      domain.state_history.push({ to: next, at: Date.now() });
    }
  }
  delete registry.active_attempts[result.task_id];
  invalidatePendingAttempt(registry, result.task_id);
  registry.run.revision += 1;
  return result;
}

function toArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

function detectSpecTypeFromSpec(spec) {
  if (spec?.artifact && spec?.from) return "HandoffSpec";
  if (spec?.assign || spec?.authority) return "CoordSpec";
  return "IntentSpec";
}

function normalizeCoordHandoffs(handoff) {
  const rows = [];
  for (const item of handoff) {
    if (typeof item === "string" && item.includes("->")) {
      const [a, to] = item.split("->").map(x => x.trim());
      rows.push([a, to]);
    } else if (item && item.artifact && item.to) {
      rows.push([item.artifact, item.to]);
    }
  }
  return rows;
}
