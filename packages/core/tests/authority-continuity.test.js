import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createChord, openSqliteStore } from '../src/index.js';
import { reduceTrace } from '../src/platform/trace-reducer.js';
import { evaluateAuthority } from '../src/platform/authorization.js';
import { installHost, queueOptions } from './fixtures/host.js';

const intent = { schema_version: 'chord.contracts.v1', spec_type: 'IntentSpec', project: 'b4', phase: 'continuity', do: ['protected-effect'] };
const code = value => error => error.code === value;
const clone = value => JSON.parse(JSON.stringify(value));
function raw(path) {
  const s = openSqliteStore({ path, mode: 'existing' });
  try { return s.load(); } finally { s.close(); }
}
function fixture({ required = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'chord-b4-')), path = join(dir, 'run.sqlite');
  let time = 100, calls = 0, args;
  let execute = (...values) => { calls++; args = values; return { status: 'completed', outcome: 'succeeded' }; };
  const options = mode => ({ storage: { path, mode }, trustedHost: { now: () => time, credential: 'B4_HOST_CREDENTIAL', callback: function B4_HOST_CALLBACK() {} }, runtimePolicy: { globalMaxLeased: 1, perEntityMaxLeased: 1 }, adapterRouter: { fallback: { execute: (...v) => execute(...v) } } });
  let c = createChord(options('create'));
  const h = installHost(c, { approvalRequired: required });
  const { packets } = c.registerSpecAndQueue(intent, queueOptions(h, { approval_required: required }));
  const id = packets[0].task_id;
  return {
    get c() { return c; }, h, id, path,
    get calls() { return calls; }, get args() { return args; },
    time(value) { time = value; }, adapter(fn) { execute = (...v) => { calls++; args = v; return fn(...v); }; },
    update(fn) { const a = c.getAuthority(); fn(a); a.authority_revision++; return c.setAuthoritySnapshot(a); },
    approval(opts = {}) { return c.createApproval({ task_id: id, approver_principal_id: h.human_id, ...opts }); },
    reopen(extra = {}) { c.close(); c = createChord({ ...options('existing'), ...extra }); return c; },
    cleanup() { c.close(); rmSync(dir, { recursive: true, force: true }); }
  };
}
function installApproval(f, mutate = () => {}) {
  const approval = f.approval(); mutate(approval);
  f.update(a => a.approvals.push(approval)); return approval;
}
function assertStored(f) {
  const r = f.c.getRegistry(); assert.deepEqual(raw(f.path).registry, r);
  assert.deepEqual(reduceTrace(r.event_journal), r); return r;
}

test('B4 exact prepared approval survives paused restart and continues once with durable identity', async () => {
  const f = fixture();
  try {
    const attempt = f.c.prepareAttempt(f.id), approval = installApproval(f);
    f.c.pauseForApproval();
    const before = assertStored(f);
    f.reopen();
    assert.deepEqual(f.c.getRegistry(), before);
    assert.deepEqual(f.c.getAuthority(), before.authority);
    assert.deepEqual(f.c.registry.pending_attempts[f.id], attempt);
    assert.equal((await f.c.runCycle()).code, 'RUN_NOT_ACTIVE'); assert.equal(f.calls, 0);
    f.c.resumeRun({ principal_id: f.h.human_id, approval_id: approval.approval_id, expectedRevision: before.run.revision });
    const result = await f.c.runCycle();
    assert.equal(result.ok, true); assert.equal(result.attempt_id, attempt.attempt_id); assert.equal(f.calls, 1);
    const after = assertStored(f);
    assert.equal(after.run.run_id, before.run.run_id);
    assert.equal(after.authority.approvals[0].consumed_by_attempt_id, attempt.attempt_id);
    assert.equal(after.tasks[f.id].status, 'completed');
    assert.deepEqual(after.pending_attempts, {}); assert.deepEqual(after.active_attempts, {});
    f.reopen(); assert.deepEqual(f.c.getRegistry(), after);
    assert.equal((await f.c.runCycle()).skipped, true); assert.equal(f.calls, 1);
  } finally { f.cleanup(); }
});

for (const variant of ['missing', 'foreign', 'stale', 'consumed', 'expired', 'revoked']) test(`B4 restored ${variant} approval cannot resume or dispatch`, async () => {
  const f = fixture();
  try {
    const attempt = f.c.prepareAttempt(f.id);
    if (variant === 'foreign') {
      const foreign = f.approval(); foreign.run_id = foreign.scope.run_id = 'foreign-run';
      const before = raw(f.path);
      assert.throws(() => f.update(a => a.approvals.push(foreign)), code('INVALID_SEMANTICS'));
      assert.deepEqual(raw(f.path), before);
    } else if (variant !== 'missing') installApproval(f, a => {
      if (variant === 'stale') a.attempt_id = 'old-attempt';
      if (variant === 'consumed') a.consumed_by_attempt_id = attempt.attempt_id;
      if (variant === 'expired') a.expires_at = 200;
      if (variant === 'revoked') a.revoked_at = 100;
    });
    f.c.pauseForApproval();
    if (variant === 'expired') { f.time(200); f.c.registerSpec({ ...intent, phase: 'persist-expiry-floor' }); }
    const before = raw(f.path); f.time(1); f.reopen();
    assert.deepEqual(f.c.getRegistry(), before.registry);
    assert.throws(() => f.c.resumeRun({ principal_id: f.h.human_id }), code('APPROVAL_REQUIRED'));
    assert.deepEqual(raw(f.path), before); assert.equal(f.calls, 0);
    // Trusted maintenance unpauses only; this does not manufacture an approval.
    const next = f.c.getRegistry(); next.run.state = 'active'; next.approval_pause = null; next.run.revision++;
    f.c.commitRun({ expectedRevision: next.run.revision - 1, nextRegistry: next });
    const denied = await f.c.runCycle(); assert.equal(denied.code, 'APPROVAL_REQUIRED'); assert.equal(f.calls, 0);
    assert.equal(f.c.registry.tasks[f.id].status, 'queued'); assertStored(f);
  } finally { f.cleanup(); }
});

test('B4 invalidated old attempt approval stays stale across reopen; exact replacement succeeds', async () => {
  const f = fixture();
  try {
    const old = f.c.prepareAttempt(f.id); installApproval(f);
    f.c._invalidatePendingAttempt(f.id);
    const fresh = f.c.prepareAttempt(f.id); assert.notEqual(fresh.attempt_id, old.attempt_id);
    f.reopen(); assert.equal((await f.c.runCycle()).code, 'APPROVAL_REQUIRED'); assert.equal(f.calls, 0);
    installApproval(f, a => { a.approval_id = 'fresh-approval'; });
    assert.equal((await f.c.runCycle()).ok, true); assert.equal(f.calls, 1);
    assert.equal(f.c.getAuthority().approvals.find(a => a.approval_id === 'fresh-approval').consumed_by_attempt_id, fresh.attempt_id);
    assertStored(f);
  } finally { f.cleanup(); }
});

for (const kind of ['principal-expired', 'actor-revoked', 'grant-expired', 'grant-revoked', 'deny']) test(`B4 dispatch reevaluates restored ${kind} at persisted floor`, async () => {
  const f = fixture({ required: false });
  try {
    f.c.prepareAttempt(f.id);
    f.update(a => {
      if (kind === 'principal-expired') a.principals[0].expires_at = 200;
      if (kind === 'actor-revoked') a.actors[0].revoked_at = 100;
      if (kind === 'grant-expired') a.grants[0].expires_at = 200;
      if (kind === 'grant-revoked') a.grants[0].revoked_at = 100;
      if (kind === 'deny') a.grants.push({ ...clone(a.grants[0]), grant_id: 'explicit-deny', effect: 'deny' });
    });
    f.time(200); f.c.registerSpec({ ...intent, phase: 'floor' });
    const before = raw(f.path); assert.equal(before.logicalNow, 200);
    f.time(1); f.reopen(); assert.deepEqual(f.c.getAuthority(), before.registry.authority);
    const result = await f.c.runCycle();
    assert.equal(result.code, kind === 'principal-expired' ? 'PRINCIPAL_INVALID' : kind === 'actor-revoked' ? 'ACTOR_INVALID' : kind === 'deny' ? 'EXPLICIT_DENY' : 'NO_ALLOW_GRANT');
    assert.equal(f.calls, 0); assert.equal(raw(f.path).logicalNow, 200); assertStored(f);
  } finally { f.cleanup(); }
});

for (const kind of ['principal-expired', 'grant-expired', 'approval-expired', 'grant-revoked', 'approval-revoked', 'authority-revision', 'run-revision', 'lease-expired']) test(`B4 commit after reopen reevaluates ${kind}, never commits stale success`, async () => {
  const f = fixture();
  try {
    f.c.prepareAttempt(f.id); installApproval(f, a => { if (kind === 'approval-expired') a.expires_at = 200; });
    if (kind === 'principal-expired' || kind === 'grant-expired') f.update(a => { (kind === 'principal-expired' ? a.principals[0] : a.grants[0]).expires_at = 200; });
    f.reopen();
    f.adapter(() => {
      if (kind.endsWith('expired')) f.time(kind === 'lease-expired' ? 30100 : 200);
      else if (kind === 'run-revision') f.c.registerSpec({ ...intent, phase: 'intervening-write' });
      else f.update(a => {
        if (kind === 'grant-revoked') a.grants[0].revoked_at = 100;
        if (kind === 'approval-revoked') a.approvals[0].revoked_at = 100;
      });
      return { status: 'completed', outcome: 'succeeded' };
    });
    const result = await f.c.runCycle();
    const expected = { 'principal-expired': 'PRINCIPAL_INVALID', 'grant-expired': 'NO_ALLOW_GRANT', 'approval-expired': 'APPROVAL_REQUIRED', 'grant-revoked': 'NO_ALLOW_GRANT', 'approval-revoked': 'STALE_ATTEMPT', 'authority-revision': 'STALE_ATTEMPT', 'run-revision': 'STALE_REVISION', 'lease-expired': 'STALE_ATTEMPT' }[kind];
    assert.equal(result.code, expected); assert.equal(result.uncertain, true); assert.equal(f.calls, 1);
    const after = assertStored(f); assert.equal(after.tasks[f.id].status, 'uncertain');
    assert.equal(Object.values(after.operations)[0].state, 'unknown');
    assert.equal(after.authority.approvals[0].consumed_by_attempt_id, after.authority.approvals[0].attempt_id);
    f.time(1); f.reopen(); assert.deepEqual(f.c.getRegistry(), after);
    assert.equal((await f.c.runCycle()).skipped, true); assert.equal(f.calls, 1);
  } finally { f.cleanup(); }
});

test('B4 stale run/authority revisions and foreign authority reject without durable writes', () => {
  const f = fixture();
  try {
    const oldRun = f.c.getRunRevision(), oldAuthority = f.c.getAuthority();
    f.update(() => {}); f.reopen();
    const before = raw(f.path), next = f.c.getAuthority(); next.authority_revision++;
    assert.throws(() => f.c.setAuthoritySnapshot(next, { expectedRevision: oldRun }), code('STALE_REVISION'));
    assert.throws(() => f.c.setAuthoritySnapshot(oldAuthority), code('STALE_REVISION'));
    assert.throws(() => f.c.setAuthoritySnapshot(next, { expectedAuthorityRevision: next.authority_revision - 1 }), code('STALE_REVISION'));
    const foreign = clone(next); foreign.run_id = 'foreign-run'; foreign.grants.forEach(g => { g.scope.run_id = foreign.run_id; });
    assert.throws(() => f.c.setAuthoritySnapshot(foreign), code('RUN_MISMATCH'));
    assert.throws(() => f.c.cancelTask(f.id, { expectedRevision: oldRun }), code('STALE_REVISION'));
    assert.deepEqual(f.c.commitRun({ expectedRevision: oldRun, nextRegistry: before.registry }), { ok: false, code: 'STALE_REVISION' });
    assert.deepEqual(raw(f.path), before); assert.equal(f.calls, 0);
  } finally { f.cleanup(); }
});

test('B4 restart without host router does not recover executable services', async () => {
  const f = fixture({ required: false });
  try {
    f.reopen({ adapterRouter: undefined });
    assert.equal((await f.c.runCycle()).code, 'no_adapter'); assert.equal(f.calls, 0);
    assert.equal(f.c.registry.tasks[f.id].status, 'queued'); assertStored(f);
  } finally { f.cleanup(); }
});

for (const variant of ['missing-human', 'service-not-human', 'expired-human', 'foreign-approval-id', 'stale-run']) test(`B4 exact restored approval does not bypass resume ${variant}`, () => {
  const f = fixture();
  try {
    f.c.prepareAttempt(f.id); const approval = installApproval(f);
    if (variant === 'expired-human') f.update(a => { a.principals.find(p => p.principal_id === f.h.human_id).expires_at = 100; });
    f.c.pauseForApproval(); f.reopen(); const before = raw(f.path);
    const opts = { principal_id: f.h.human_id, approval_id: approval.approval_id };
    if (variant === 'missing-human') delete opts.principal_id;
    if (variant === 'service-not-human') opts.principal_id = f.h.principal_id;
    if (variant === 'foreign-approval-id') opts.approval_id = 'foreign-approval';
    if (variant === 'stale-run') opts.expectedRevision = before.revision - 1;
    assert.throws(() => f.c.resumeRun(opts), code(variant === 'stale-run' ? 'STALE_REVISION' : variant === 'foreign-approval-id' ? 'APPROVAL_REQUIRED' : 'PRINCIPAL_INVALID'));
    assert.deepEqual(raw(f.path), before); assert.equal(f.calls, 0);
  } finally { f.cleanup(); }
});

test('B4 host reattestation is an embedding boundary, not restored principal authentication', async () => {
  const f = fixture();
  try {
    f.c.prepareAttempt(f.id); const approval = installApproval(f); f.c.pauseForApproval();
    // Test host ingress: a new process/session starts with no authenticated sessions.
    function hostIngress(sdk) {
      const sessions = new Map();
      return {
        attest(session, principal) { sessions.set(session, principal); },
        resume(request) {
          const principal = sessions.get(request.session);
          if (!principal) throw Object.assign(new TypeError('HOST_UNAUTHENTICATED'), { code: 'HOST_UNAUTHENTICATED' });
          return sdk.resumeRun({ principal_id: principal, approval_id: request.approval_id });
        }
      };
    }
    const first = hostIngress(f.c); first.attest('old-session', f.h.human_id);
    f.reopen(); const fresh = hostIngress(f.c), before = raw(f.path);
    assert.ok(f.c.getAuthority().principals.some(p => p.principal_id === f.h.human_id));
    for (const session of [undefined, 'old-session', f.h.human_id]) assert.throws(() => fresh.resume({ session, principal_id: f.h.human_id, approval_id: approval.approval_id }), code('HOST_UNAUTHENTICATED'));
    assert.deepEqual(raw(f.path), before);
    fresh.attest('new-session', f.h.human_id);
    assert.equal(fresh.resume({ session: 'new-session', principal_id: 'forged-principal', approval_id: approval.approval_id }).ok, true);
    assert.equal((await f.c.runCycle()).ok, true); assert.equal(f.calls, 1);
    // No claim that direct SDK calls verify a login: SDK possession is the capability.
    const db = new DatabaseSync(f.path);
    let text; try { text = db.prepare('SELECT registry_json FROM chord_store').get().registry_json; } finally { db.close(); }
    for (const sentinel of ['B4_HOST_CREDENTIAL', 'B4_HOST_CALLBACK', 'old-session', 'new-session', 'trustedHost', 'adapterRouter', 'runtimePolicy']) assert.equal(text.includes(sentinel), false);
    for (const value of f.args) {
      const text = JSON.stringify(value);
      for (const key of ['B4_HOST_CREDENTIAL', 'principals', 'grants', 'approvals', 'trustedHost', 'runtimePolicy']) assert.equal(text.includes(key), false);
    }
    assertStored(f);
  } finally { f.cleanup(); }
});

for (const expired of [false, true]) test(`B4 paused deadline uses durable policy clock after backward restart: expired=${expired}`, () => {
  const f = fixture();
  try {
    f.c.prepareAttempt(f.id); installApproval(f);
    f.c.pauseForApproval({ expires_at: 200 });
    f.time(expired ? 201 : 150); f.c.registerSpec({ ...intent, phase: 'pause-floor' });
    f.time(1); f.reopen(); const before = raw(f.path);
    if (expired) {
      assert.throws(() => f.c.resumeRun({ principal_id: f.h.human_id }), code('EXPIRED'));
      assert.deepEqual(raw(f.path), before);
    } else assert.equal(f.c.resumeRun({ principal_id: f.h.human_id }).ok, true);
    assert.equal(raw(f.path).logicalNow, expired ? 201 : 150); assertStored(f);
  } finally { f.cleanup(); }
});

test('B4 consumed approval cannot be reset by replacement after restart', async () => {
  const f = fixture();
  try {
    const attempt = f.c.prepareAttempt(f.id); installApproval(f);
    assert.equal((await f.c.runCycle()).ok, true); f.reopen();
    f.update(a => { a.approvals[0].consumed_by_attempt_id = null; });
    assert.equal(f.c.getAuthority().approvals[0].consumed_by_attempt_id, attempt.attempt_id);
    f.reopen(); assert.equal(f.c.getAuthority().approvals[0].consumed_by_attempt_id, attempt.attempt_id);
    assertStored(f);
  } finally { f.cleanup(); }
});

test('B4 foreign and stale attempt tuples cannot authorize commit from restored data', async () => {
  const f = fixture();
  try {
    const prepared = f.c.prepareAttempt(f.id); installApproval(f); f.reopen();
    f.adapter(() => {
      const r = raw(f.path).registry, active = r.active_attempts[f.id].attempt;
      for (const [field, value, expected] of [['run_id', 'foreign-run', 'RUN_MISMATCH'], ['task_id', 'foreign-task', 'STALE_ATTEMPT'], ['task_revision', 1, 'STALE_ATTEMPT'], ['authority_revision', active.authority_revision + 1, 'STALE_ATTEMPT']]) {
        assert.equal(evaluateAuthority({ stage: 'commit', now: 100, run: r.run, task: r.tasks[f.id], attempt: { ...active, [field]: value }, authority: r.authority }).code, expected);
      }
      // Public adapter boundary rejects a forged attempt before result ingestion.
      return { status: 'completed', outcome: 'succeeded', attempt_id: 'old-attempt' };
    });
    const result = await f.c.runCycle(); assert.equal(result.uncertain, true); assert.equal(f.calls, 1);
    const after = assertStored(f); assert.equal(after.tasks[f.id].status, 'uncertain');
    assert.equal(after.authority.approvals[0].consumed_by_attempt_id, prepared.attempt_id);
    f.reopen(); assert.deepEqual(f.c.getRegistry(), after);
  } finally { f.cleanup(); }
});
