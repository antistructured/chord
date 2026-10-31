import { AdapterResult } from '../contracts/sigils.js';
import { AdapterAdvertisement, ADAPTER_CONTEXT_VERSION, ADAPTER_DESCRIPTOR_VERSION, ADAPTER_PROTOCOL_VERSION, adapterError } from './adapter-protocol.js';

const advertisement = ({ adapter_id, adapter_kind, operations, capabilities }) => AdapterAdvertisement.assert({
  protocol_version: ADAPTER_DESCRIPTOR_VERSION,
  adapter_id,
  adapter_kind,
  supported_protocol_versions: [ADAPTER_PROTOCOL_VERSION],
  operations,
  capabilities,
  execution_context: ADAPTER_CONTEXT_VERSION,
  limits: { max_concurrent: 8, timeout_ms: null }
});

/**
 * Reference Adapter A: deterministic local tool executor.
 *
 * `operations` is the complete allowlist. No shell, dynamic import, eval or
 * arbitrary code path exists here. A requested action outside the allowlist
 * fails explicitly before any operation handler runs.
 */
export function createLocalToolAdapter({ adapter_id = 'chord.local-tool', operations = {} } = {}) {
  if (!operations || typeof operations !== 'object' || Array.isArray(operations)) throw new TypeError('INVALID_TOOL_ALLOWLIST');
  const names = Object.keys(operations).sort();
  if (names.length === 0) throw new TypeError('INVALID_TOOL_ALLOWLIST');
  for (const name of names) if (typeof operations[name] !== 'function') throw new TypeError('INVALID_TOOL_HANDLER');
  const ad = advertisement({ adapter_id, adapter_kind: 'tool', operations: names, capabilities: ['chord.effect.local-tool'] });
  return Object.freeze({
    advertisement: ad,
    async handle(request) {
      const operation = request.packet.requested_action[0];
      if (!Object.hasOwn(operations, operation)) throw adapterError('UNSUPPORTED_OPERATION', 'rejected');
      const value = await operations[operation]({ packet: request.packet, context: request.context, request });
      return AdapterResult.assert({ status: 'completed', outcome: 'succeeded', ...value });
    }
  });
}

/**
 * Reference Adapter B: deterministic independent agent. It accepts a structured
 * coordination task and returns a deterministic outcome. The adapter protocol
 * server, not the handler, owns correlation identity.
 */
export function createMockAgentAdapter({ adapter_id = 'chord.mock-agent', responder = null } = {}) {
  const ad = advertisement({ adapter_id, adapter_kind: 'agent', operations: [], capabilities: ['chord.effect.mock-agent'] });
  return Object.freeze({
    advertisement: ad,
    async handle(request) {
      if (typeof responder === 'function') return AdapterResult.assert(await responder(request));
      const action = request.packet.requested_action[0] || '';
      if (action.startsWith('fail.')) return AdapterResult.assert({ status: 'failed', outcome: 'failed', summary: `mock-agent:${request.task_id}:failed` });
      if (action.startsWith('block.')) return AdapterResult.assert({ status: 'blocked', outcome: 'blocked', summary: `mock-agent:${request.task_id}:blocked` });
      return AdapterResult.assert({ status: 'completed', outcome: 'succeeded', summary: `mock-agent:${request.task_id}`, outputs: { task_id: request.task_id, action } });
    }
  });
}
