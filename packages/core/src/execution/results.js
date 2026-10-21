import { registerExecutionResult, registerTask } from "../registry/registry.js";

export function registerTaskPacket(registry, packet, binding) {
  return registerTask(registry, packet, binding);
}

export function registerTaskPackets(registry, packets, bindings) {
  return packets.map((packet, index) => registerTask(registry, packet, bindings[index]));
}

export function ingestExecutionResult(registry, result) {
  return registerExecutionResult(registry, result);
}
