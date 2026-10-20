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
import { assertTaskPacket, assertSpec, RegistryData, SCHEMA_VERSION, CONTRACT_LIMITS, contractError } from "../contracts/sigils.js";

export function createChord(options = {}) {
  const registry = options.registry === undefined ? createRegistry() : RegistryData.assert(options.registry);
  registry.task_queue ||= createTaskQueue();
  let router = createAdapterRouter(options.adapterRouter || {});
  let policy = createRuntimePolicy(options.runtimePolicy || {});

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

  function queueTaskPackets(packets, options = {}) {
    if (!Array.isArray(packets)) throw new TypeError("packets must be an array");
    packets = packets.map(assertTaskPacket);
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

