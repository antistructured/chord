export function queryArtifacts(registry, criteria = {}) {
  return Object.values(registry.artifacts).filter(a => {
    if (criteria.status && a.status !== criteria.status) return false;
    if (criteria.consumer && !(a.consumers || []).includes(criteria.consumer)) return false;
    if (criteria.producer && !(a.producers || []).includes(criteria.producer)) return false;
    return true;
  });
}

export function queryDomains(registry, criteria = {}) {
  return Object.values(registry.domains).filter(d => {
    if (criteria.owner && d.owner !== criteria.owner) return false;
    if (criteria.state && d.state !== criteria.state) return false;
    return true;
  });
}

export function listDeadLetterTasks(registry) {
  return (registry.task_queue || []).filter(q => q.status === "dead_letter");
}
