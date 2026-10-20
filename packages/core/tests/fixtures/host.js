import { SCHEMA_VERSION } from "../../src/contracts/sigils.js";

/** Host-side authority fixture for tests: authentication and grant issuance
 * are host responsibilities; this helper stands in for the embedding host.
 */
export function installHost(chord, { approvalRequired = false } = {}) {
  const run_id = chord.registry.run.run_id;
  const principal = { principal_id: "host-principal", issuer: "test-host", kind: "service", authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  const human = { principal_id: "human-approver", issuer: "test-host", kind: "human", authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  const actor = { actor_id: "worker-actor", principal_id: "host-principal", kind: "agent", roles: ["implementer"], capabilities: ["execute"], revoked_at: null };
  chord.setAuthoritySnapshot({
    schema_version: SCHEMA_VERSION,
    run_id,
    authority_revision: 0,
    principals: [principal, human],
    actors: [actor],
    grants: [],
    approvals: []
  });
  return {
    principal_id: principal.principal_id,
    actor_id: actor.actor_id,
    human_id: human.principal_id,
    capability: "execute",
    issueGrants: packets => packets.map(packet => grantFor(chord, packet, { capability: "execute", requires_approval: approvalRequired === true }))
  };
}

export function grantFor(chord, packet, { capability = "execute", effect = "allow", requires_approval = false, issued_at = 0, expires_at = Number.MAX_SAFE_INTEGER, revoked_at = null } = {}) {
  return {
    grant_id: `grant_${packet.task_id}`,
    principal_id: "host-principal",
    actor_id: "worker-actor",
    capability,
    effect,
    scope: {
      run_id: chord.registry.run.run_id,
      project: packet.project,
      phase: packet.phase,
      task_id: packet.task_id,
      target_entity: packet.target_entity,
      resource: { kind: "task", id: packet.task_id }
    },
    issued_at,
    expires_at,
    revoked_at,
    requires_approval
  };
}

export function queueOptions(host, extra = {}) {
  return {
    principal_id: host.principal_id,
    actor_id: host.actor_id,
    capability: host.capability,
    issueGrants: host.issueGrants,
    ...extra
  };
}
