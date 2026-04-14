export function createAdapterRouter({ exact = {}, prefix = {}, fallback = null } = {}) {
  return { exact, prefix, fallback };
}

export function resolveAdapter(router, entity) {
  if (router.exact?.[entity]) return router.exact[entity];
  for (const [key, adapter] of Object.entries(router.prefix || {})) {
    if (entity.startsWith(key)) return adapter;
  }
  if (router.exact?.default) return router.exact.default;
  return router.fallback || null;
}
