/**
 * Lightweight runtime contracts.
 * Mimics SigilJS-style validation for data packets and results.
 */

function createValidator(schema) {
  return function(data, name = "value") {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError(`${name} must be an object`);
    }
    for (const [key, type] of Object.entries(schema)) {
      const value = data[key];
      if (Array.isArray(type)) {
        if (!Array.isArray(value)) throw new TypeError(`${name}.${key} is required and must be an array`);
        const itemType = type[0];
        for (const item of value) {
          if (typeof item !== itemType) throw new TypeError(`${name}.${key} items must be ${itemType}`);
        }
      } else {
        if (typeof value !== type) throw new TypeError(`${name}.${key} is required and must be ${type}`);
      }
    }
    return data;
  };
}

const TaskPacketValidator = createValidator({
  task_id: "string",
  requested_action: ["string"],
  target_entity: "string"
});

const ExecutionResultValidator = createValidator({
  task_id: "string",
  status: "string",
  outcome: "string"
});

export function assertObject(value, name = "value") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

export function assertTaskPacket(packet) {
  return TaskPacketValidator(packet, "packet");
}

export function assertExecutionResult(result) {
  return ExecutionResultValidator(result, "result");
}

export function assertAdapter(adapter) {
  assertObject(adapter, "adapter");
  if (typeof adapter.execute !== "function") throw new TypeError("adapter.execute must be a function");
  return adapter;
}
