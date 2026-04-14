import { stableId } from "../utils/id.js";
import { assertTaskPacket, assertExecutionResult, assertAdapter } from "../contracts/sigils.js";

export function createIntentTaskPacket(spec, options = {}) {
  const packet = {
    task_id: stableId("task"),
    task_kind: "intent_execution",
    source_type: "IntentSpec",
    source_spec_id: spec.id || null,
    project: spec.project || options.project || "unknown",
    phase: spec.phase || options.phase || "unknown",
    target_entity: options.target_entity || spec.target_entity || "default",
    role: spec.role || "implementer",
    stance: spec.stance || "strict",
    requested_action: Array.isArray(spec.do) ? spec.do : [],
    inputs: {
      spec,
      files: spec.files || [],
      verify: spec.verify || [],
      stop: spec.stop || []
    },
    constraints: {
      dont: spec.dont || [],
      rules: spec.rules || [],
      depends: spec.depends || []
    }
  };
  return assertTaskPacket(packet);
}

export function createHandoffTaskPackets(spec) {
  const tos = Array.isArray(spec.to) ? spec.to : [spec.to].filter(Boolean);
  return tos.map(to => assertTaskPacket({
    task_id: stableId("task"),
    task_kind: "handoff_review",
    source_type: "HandoffSpec",
    source_spec_id: spec.id || null,
    project: spec.project || "unknown",
    phase: spec.phase || "unknown",
    target_entity: to,
    role: "reviewer",
    stance: "strict",
    requested_action: Array.isArray(spec.requested_action) ? spec.requested_action : [spec.requested_action].filter(Boolean),
    inputs: {
      artifact: spec.artifact,
      evidence: spec.evidence || [],
      assumptions: spec.assumptions || [],
      blockers: spec.blockers || []
    },
    constraints: {
      authority: spec.authority || {}
    }
  }));
}

export async function executeTask(adapter, packet, context = {}) {
  assertAdapter(adapter);
  assertTaskPacket(packet);
  const raw = await adapter.execute(packet, context);
  return assertExecutionResult(normalizeExecutionResult(packet, raw));
}

export function normalizeExecutionResult(packet, value) {
  return {
    task_id: packet.task_id,
    status: value?.status || "completed",
    outcome: value?.outcome || "succeeded",
    summary: value?.summary || `executed ${packet.task_id}`,
    outputs: value?.outputs || {},
    artifact: value?.artifact,
    domain: value?.domain
  };
}
