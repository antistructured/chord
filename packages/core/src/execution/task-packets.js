import { stableId } from "../utils/id.js";
import { assertTaskPacket, assertExecutionResult, assertAdapter, assertSpec, AdapterResult, SCHEMA_VERSION, contractError } from "../contracts/sigils.js";

export function createIntentTaskPacket(spec, options = {}) {
  spec = assertSpec(spec);
  const packet = {
    schema_version: SCHEMA_VERSION,
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
  spec = assertSpec(spec);
  const tos = Array.isArray(spec.to) ? spec.to : [spec.to].filter(Boolean);
  return tos.map(to => assertTaskPacket({
    schema_version: SCHEMA_VERSION,
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

// Resolve all host-executable properties and validate/freeze the packet before
// a runtime claim is published. Invocation performs no later property lookup.
export function prepareTaskExecution(adapter, packet, context = {}) {
  const execute = adapter?.execute;
  if (typeof execute !== "function") throw contractError("INVALID_SHAPE");
  packet = deepFreeze(assertTaskPacket(packet));
  const frozenContext = Object.freeze({ ...context });
  return async () => {
    let raw;
    try { raw = await Reflect.apply(execute, adapter, [packet, frozenContext]); }
    catch { throw contractError("ADAPTER_ERROR"); }
    return assertExecutionResult(normalizeExecutionResult(packet, raw));
  };
}
export async function executeTask(adapter, packet, context = {}) {
  return prepareTaskExecution(adapter, packet, context)();
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  }
  return value;
}

export function normalizeExecutionResult(packet, value) {
  let raw;
  try { raw = AdapterResult.assert(value); }
  catch { throw contractError("INVALID_RESULT"); }
  if (raw.task_id !== undefined && raw.task_id !== packet.task_id) throw contractError("INVALID_RESULT");
  return assertExecutionResult({ ...raw, task_id: packet.task_id });
}
