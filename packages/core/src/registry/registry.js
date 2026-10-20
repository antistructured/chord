import { stableId } from "../utils/id.js";
import { deepClone } from "../utils/clone.js";
import { assertExecutionResult, assertTaskPacket, assertSpec, SCHEMA_VERSION, contractError } from "../contracts/sigils.js";
import { markQueueEntryStatus } from "../platform/task-queue.js";

export function createRegistry() {
  return {
    run: { run_id: stableId("run"), schema_version: SCHEMA_VERSION, revision: 0 },
    artifacts: {},
    domains: {},
    tasks: {},
    task_queue: [],
    event_journal: [],
    execution_results: [],
    trigger_state: {},
    specs: []
  };
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
    transitionArtifact(artifact, mapHandoffStatus(spec.status));
  }

  return registry;
}

export function transitionArtifact(record, next) {
  if (record.status === next) return record;
  const prev = record.status || null;
  record.status = next;
  record.history ||= [];
  record.history.push({ from: prev, to: next, at: Date.now() });
  return record;
}

export function registerTask(registry, packet) {
  packet = assertTaskPacket(packet);
  registry.tasks[packet.task_id] = {
    ...deepClone(packet),
    status: "queued",
    created_at: Date.now(),
    retry_count: 0
  };
  return registry.tasks[packet.task_id];
}

export function registerExecutionResult(registry, result) {
  result = assertExecutionResult(result);
  const task = registry.tasks[result.task_id];
  if (!task) throw contractError("INVALID_RESULT");
  registry.execution_results.push(deepClone(result));
  if (task) {
    task.status = result.status;
    task.last_result = result;
  }
  // Sync queue status
  markQueueEntryStatus(registry, result.task_id, task?.status || "completed");

  if (result.artifact && registry.artifacts[result.artifact]) {
    transitionArtifact(registry.artifacts[result.artifact], result.outcome === "succeeded" ? "accepted" : "rejected");
  }
  if (result.domain && registry.domains[result.domain]) {
    registry.domains[result.domain].state = result.outcome === "succeeded" ? "complete" : "blocked";
    registry.domains[result.domain].state_history ||= [];
    registry.domains[result.domain].state_history.push({ to: registry.domains[result.domain].state, at: Date.now() });
  }
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

function mapHandoffStatus(status = "submitted") {
  if (status === "accepted" || status === "complete") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "superseded") return "superseded";
  return "produced";
}
