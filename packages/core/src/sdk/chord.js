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
import { assertTaskPacket, assertExecutionResult } from "../contracts/sigils.js";

export function createChord(options = {}) {
  const registry = options.registry || createRegistry();
  registry.task_queue ||= createTaskQueue();
  let router = createAdapterRouter(options.adapterRouter || {});
  let policy = createRuntimePolicy(options.runtimePolicy || {});

  function parseText(text) {
    const lines = text.split(/\r?\n/);
    const spec = {};
    let current = null;

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      
      if (line.trimStart().startsWith("@")) {
        const content = line.trimStart().slice(1);
        const [name, ...rest] = content.split(" ");
        current = name;
        if (rest.length) {
          spec[current] = rest.join(" ").trim();
        } else {
          spec[current] = [];
        }
        continue;
      }

      if (current) {
        const trimmed = line.trim();
        const isMapField = (current === "state" || current === "authority");
        
        if (trimmed.startsWith("- ")) {
          if (!Array.isArray(spec[current])) spec[current] = [];
          spec[current].push(trimmed.slice(2).trim());
        } else if (isMapField && trimmed.includes(":")) {
          if (!Array.isArray(spec[current])) spec[current] = [];
          spec[current].push(trimmed);
        } else {
          if (Array.isArray(spec[current])) {
            spec[current].push(trimmed);
          } else {
            spec[current] = (spec[current] + "\n" + trimmed).trim();
          }
        }
      }
    }

    // TARGET 3: Parser Normalization
    const result = {
      project: ensureScalar(spec.project),
      phase: ensureScalar(spec.phase),
      version: ensureScalar(spec.version),
      goal: ensureScalar(spec.goal),
      intent: ensureScalar(spec.intent),
      role: ensureScalar(spec.role),
      stance: ensureScalar(spec.stance),
      entity: ensureArray(spec.entity),
      do: ensureArray(spec.do),
      dont: ensureArray(spec.dont),
      verify: ensureArray(spec.verify),
      stop: ensureArray(spec.stop),
      files: ensureArray(spec.files),
      state: ensureMap(spec.state),
      authority: ensureMap(spec.authority),
      assign: ensureArray(spec.assign),
      artifact: ensureScalar(spec.artifact),
      from: ensureScalar(spec.from),
      to: ensureArray(spec.to)
    };

    result.spec_type = detectSpecType(result);

    return { spec: result };
  }

  function register(spec) {
    registerSpec(registry, spec);
    appendRegistryEvent(registry, "spec_registered", { spec_type: spec.spec_type, project: spec.project, phase: spec.phase });
    return { registry, spec };
  }

  function createTaskPackets(spec) {
    if (spec.spec_type === "HandoffSpec") return createHandoffTaskPackets(spec);
    if (spec.spec_type === "IntentSpec") return [createIntentTaskPacket(spec)];
    return [];
  }

  function queueTaskPackets(packets, options = {}) {
    if (!Array.isArray(packets)) throw new TypeError("packets must be an array");
    packets.forEach(assertTaskPacket);
    registerTaskPackets(registry, packets);
    packets.forEach(packet => {
      enqueueTask(registry, packet, {
        priority: options.priority ?? 0,
        max_attempts: policy.retry.maxAttempts
      });
      appendRegistryEvent(registry, "task_enqueued", { task_id: packet.task_id, target_entity: packet.target_entity });
    });
    return packets;
  }

  function registerSpecAndQueue(spec, options = {}) {
    register(spec);
    const packets = createTaskPackets(spec);
    queueTaskPackets(packets, options);
    return { spec, packets };
  }

  return {
    registry,
    parseText,
    registerSpec: register,
    registerSpecAndQueue,
    createTaskPackets,
    queueTaskPackets,
    runCycle: async () => runRuntimeCycle(registry, router, policy),
    setAdapterRouter(value) { router = createAdapterRouter(value); return router; },
    setRuntimePolicy(value) { policy = createRuntimePolicy(value); return policy; },
    queryArtifacts: (criteria = {}) => queryArtifacts(registry, criteria),
    queryDomains: (criteria = {}) => queryDomains(registry, criteria),
    queryQueue: (criteria = {}) => listQueuedTasks(registry, criteria),
    queryDeadLetters: () => listDeadLetterTasks(registry),
    replayTask: (taskId) => replayDeadLetterTask(registry, taskId),
    replayJournal: (options = {}) => replayRegistryJournal(registry, options),
    inspectAudit: (options = {}) => createDeterministicAuditReport(registry, options),
    inspectEvents: (filters = {}) => listRegistryEvents(registry, filters),
    exportRegistry: () => exportRegistry(registry),
    serializeRegistry: () => serializeRegistry(registry)
  };
}

function detectSpecType(spec) {
  if (spec.artifact && spec.from) return "HandoffSpec";
  if (Object.keys(spec.authority).length > 0 || spec.assign.length > 0 || spec.entity.length > 0) return "CoordSpec";
  return "IntentSpec";
}

function ensureScalar(v) {
  return typeof v === "string" ? v : "";
}

function ensureArray(v) {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim());
  if (v == null || v === "") return [];
  return [String(v).trim()];
}

function ensureMap(v) {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  if (Array.isArray(v)) {
    const out = {};
    for (const item of v) {
      if (typeof item === "string" && item.includes(":")) {
        const index = item.indexOf(":");
        const k = item.slice(0, index).trim();
        const val = item.slice(index + 1).trim();
        if (k) out[k] = val;
      } else if (typeof item === "string" && item.trim()) {
        throw new Error(`Malformed map entry: "${item}". Expected key:value`);
      }
    }
    return out;
  }
  return {};
}
