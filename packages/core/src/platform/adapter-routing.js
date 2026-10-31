import { own } from '../utils/own.js';
export function createAdapterRouter({ exact = {}, prefix = {}, fallback = null } = {}) {
  return { exact, prefix, fallback };
}

export function resolveAdapter(router, entity) {
  const exact = own(router.exact, entity);
  if (exact) return exact;
  for (const [key, adapter] of Object.entries(router.prefix || {})) {
    if (entity.startsWith(key)) return adapter;
  }
  const fallback = own(router.exact, 'default');
  if (fallback) return fallback;
  return router.fallback || null;
}
