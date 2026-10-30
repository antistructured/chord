import { RegistryData, SCHEMA_VERSION, CONTRACT_LIMITS, clonePlainData } from '../contracts/sigils.js';
import { reduceTrace } from '../platform/trace-reducer.js';
import { canonicalProjection, sameData, stateChanges } from '../platform/history.js';
import { assertCanonicalTransition } from '../platform/state-invariants.js';

export const STORAGE_VERSION = 'chord.local-store.v1';
const codes = new Set(['INVALID_CONTEXT', 'INVALID_DATA', 'LIMIT_EXCEEDED', 'INVALID_SHAPE', 'INVALID_SEMANTICS', 'INVALID_RESULT', 'RUN_MISMATCH', 'SCHEMA_MISMATCH', 'INVALID_HISTORY', 'INVALID_TRANSITION', 'IMMUTABLE_TASK', 'STALE_REVISION', 'STORAGE_UNAVAILABLE', 'COMMIT_OUTCOME_UNKNOWN', 'STORAGE_CORRUPT', 'UNSUPPORTED_STORAGE_VERSION', 'UNSUPPORTED_RUNTIME', 'STORE_NOT_INITIALIZED', 'STORE_ALREADY_INITIALIZED', 'STORE_CLOSED']);
export function storageError(code, commitStatus) {
  const error = new TypeError(codes.has(code) ? code : 'STORAGE_UNAVAILABLE');
  error.code = error.message; error.path = '$';
  if (commitStatus) error.commitStatus = commitStatus;
  return error;
}
export function safeInteger(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw storageError('INVALID_CONTEXT');
  return value;
}
export function exactRequest(value, keys) {
  // Inspect the envelope without spending the registry's depth/node/byte budget
  // on wrapper fields, and never evaluate request accessors.
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw storageError('INVALID_CONTEXT');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some(key => typeof key !== 'string') || !sameData(ownKeys.sort(), [...keys].sort())) throw storageError('INVALID_CONTEXT');
  const copy = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw storageError('INVALID_CONTEXT');
    Object.defineProperty(copy, key, { value: clonePlainData(descriptor.value), enumerable: true });
  }
  return copy;
}
export function validateRegistry(value) {
  if (value?.run?.schema_version !== SCHEMA_VERSION) throw storageError('SCHEMA_MISMATCH');
  const registry = RegistryData.assert(value);
  try {
    if (!sameData(reduceTrace(registry.event_journal), registry)) throw storageError('INVALID_HISTORY');
  } catch (error) {
    // Reducer-specific cause codes remain available through reduceTrace itself.
    throw storageError(codes.has(error.code) ? error.code : 'INVALID_HISTORY');
  }
  return registry;
}
export function validateNext(current, value, operation) {
  const next = validateRegistry(value);
  if (next.run.run_id !== current.run.run_id) throw storageError('RUN_MISMATCH');
  if (current.run.revision === Number.MAX_SAFE_INTEGER || next.run.revision !== current.run.revision + 1) throw storageError('INVALID_CONTEXT');
  const prefix = current.event_journal;
  if (!sameData(next.event_journal.slice(0, prefix.length), prefix)) throw storageError('INVALID_HISTORY');
  const suffix = next.event_journal.slice(prefix.length), last = suffix.at(-1);
  if (suffix.filter(e => e.type === 'state_committed').length !== 1 || last?.type !== 'state_committed' || last.payload.operation !== operation || !sameData(last.payload.changes, stateChanges(canonicalProjection(current), canonicalProjection(next)))) throw storageError('INVALID_HISTORY');
  assertCanonicalTransition(current, next, operation);
  return next;
}
export function decodeRow(row) {
  if (!row) throw storageError('STORE_NOT_INITIALIZED');
  // Inspect independent metadata before any version-pinned assertion.
  if (row.storage_version !== STORAGE_VERSION) throw storageError('UNSUPPORTED_STORAGE_VERSION');
  if (row.schema_version !== SCHEMA_VERSION) throw storageError('SCHEMA_MISMATCH');
  try {
    if (row.singleton !== 1 || typeof row.registry_json !== 'string' || new TextEncoder().encode(row.registry_json).length > CONTRACT_LIMITS.bytes) throw storageError('STORAGE_CORRUPT');
    safeInteger(row.logical_now); safeInteger(row.revision);
    const registry = validateRegistry(JSON.parse(row.registry_json));
    const last = registry.event_journal.at(-1);
    if (row.run_id !== registry.run.run_id || row.revision !== registry.run.revision || row.schema_version !== registry.run.schema_version || row.commit_id !== last?.event_id) throw storageError('STORAGE_CORRUPT');
    return { registry, revision: row.revision, commitId: row.commit_id, logicalNow: row.logical_now, storageVersion: row.storage_version };
  } catch { throw storageError('STORAGE_CORRUPT'); }
}
