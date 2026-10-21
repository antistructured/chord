import { test, expect } from 'bun:test';
import { createChord } from '../src/index.js';
import { installHost, queueOptions } from './fixtures/host.js';
const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'admission', phase: 'verify', do: ['mock'] };
test('READ: grantless/expired/revoked/denied projections disclose no tasks or queue', () => {
  const c = createChord(); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h));
  const none = c.projectContext({ actor_id: 'absent', principal_id: 'absent' }); expect(none.tasks).toEqual([]); expect(none.queue_summary).toEqual([]);
  const snapshot = c.getAuthority(); snapshot.authority_revision++; snapshot.grants[0].revoked_at = 0; c.setAuthoritySnapshot(snapshot);
  const revoked = c.projectContext({ actor_id: h.actor_id, principal_id: h.principal_id }); expect(revoked.tasks).toEqual([]);
});
test('READ: authorized projection detached including nested scope, bounded to permitted tasks', () => {
  const c = createChord(); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h));
  const before = c.exportRegistry().registry;
  const view = c.projectContext({ actor_id: h.actor_id, principal_id: h.principal_id }); expect(view.tasks.length).toBe(1);
  view.authorized_scopes[0].scope.project = 'changed'; expect(c.getRegistry()).toEqual(before);
});
test('ADMIT: grant issuance cannot survive a later batch denial', () => {
  const c = createChord(); const h = installHost(c); const packets = c.createTaskPackets(intent); const before = c.getRegistry();
  expect(() => c.queueTaskPackets(packets, queueOptions(h, { actor_id: 'absent' }))).toThrow(); expect(c.getRegistry()).toEqual(before);
});
test('ADMIT: invalid queue fields and reentrant callback cannot partially commit', () => {
  const c = createChord(); const h = installHost(c); const before = c.getRegistry();
  expect(() => c.registerSpecAndQueue(intent, queueOptions(h, { priority: NaN }))).toThrow(); expect(c.getRegistry()).toEqual(before);
  expect(() => c.registerSpecAndQueue(intent, queueOptions(h, { issueGrants: () => { c.cancelRun(); return []; } }))).toThrow(/REENTRANT_MUTATION/); expect(c.getRegistry()).toEqual(before);
});
test('READ: clock callback revocation precedes context snapshot', () => {
  let c, armed = false;
  c = createChord({ trustedHost: { now() {
    if (armed) { armed = false; const a = c.getAuthority(); a.authority_revision++; a.grants[0].revoked_at = 0; c.setAuthoritySnapshot(a); }
    return Date.now();
  } } });
  const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h)); armed = true;
  const view = c.projectContext({ actor_id: h.actor_id, principal_id: h.principal_id });
  expect(view.tasks).toEqual([]); expect(view.queue_summary).toEqual([]); expect(view.provenance.authority_revision).toBe(c.getAuthority().authority_revision);
});
test('READ: explicit deny and exact expiry boundary suppress protected projections', () => {
  for (const mode of ['deny', 'expired', 'future']) {
    const c = createChord({ trustedHost: { now: () => 1000 } }); const h = installHost(c); c.registerSpecAndQueue(intent, queueOptions(h)); const a = c.getAuthority(); a.authority_revision++;
    if (mode === 'deny') a.grants.push({ ...a.grants[0], grant_id: 'deny', effect: 'deny' });
    if (mode === 'expired') a.grants[0].expires_at = 1000;
    if (mode === 'future') a.grants[0].issued_at = 1001;
    c.setAuthoritySnapshot(a); const view = c.projectContext({ actor_id: h.actor_id, principal_id: h.principal_id }); expect(view.tasks).toEqual([]); expect(view.queue_summary).toEqual([]);
  }
});


