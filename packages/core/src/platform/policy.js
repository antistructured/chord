export function createRuntimePolicy(policy = {}) {
  return {
    globalMaxLeased: policy.globalMaxLeased ?? 10,
    perEntityMaxLeased: policy.perEntityMaxLeased ?? 3,
    retry: {
      strategy: policy.retry?.strategy ?? "exponential",
      baseDelayMs: policy.retry?.baseDelayMs ?? 250,
      maxAttempts: policy.retry?.maxAttempts ?? 3
    }
  };
}

export function computeBackoffDelayMs(policy, attempt) {
  const base = policy.retry.baseDelayMs;
  if (policy.retry.strategy === "fixed") return base;
  if (policy.retry.strategy === "linear") return base * attempt;
  return base * (2 ** Math.max(0, attempt - 1));
}
