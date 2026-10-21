/** Recovery policy - explicit boundaries, no universal exactly-once guarantee */

export const EffectStates = Object.freeze({
  REQUESTED: "requested",
  DISPATCHED: "dispatched",
  ACKNOWLEDGED: "acknowledged",
  CONFIRMED: "confirmed",
  UNKNOWN: "unknown",
  FAILED: "failed"
});

export function isRetryEligible({ effectState, preDispatch, attemptCount, maxAttempts = 3 } = {}) {
  if (effectState === EffectStates.DISPATCHED || effectState === EffectStates.ACKNOWLEDGED) {
    // Post-dispatch ambiguity - no blind retry (Block 2 design)
    return false;
  }
  if (!preDispatch) return false;
  return attemptCount < maxAttempts;
}

export function shouldQuarantineUnknown() {
  // Unknown outcomes go to uncertain/quarantine, require explicit reconciliation
  return true;
}

/** Idempotency keys must be explicit (adapter responsibility) - kernel does not invent */
export function getIdempotencyKey(task) {
  return task?.idempotency_key || null;
}
