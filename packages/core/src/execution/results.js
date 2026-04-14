import { registerExecutionResult, registerTask } from "../registry/registry.js";

export function registerTaskPacket(registry, packet) {
  return registerTask(registry, packet);
}

export function registerTaskPackets(registry, packets) {
  return packets.map(packet => registerTask(registry, packet));
}

export function ingestExecutionResult(registry, result) {
  return registerExecutionResult(registry, result);
}
