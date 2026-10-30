#!/usr/bin/env node
// Sequential, single-active-host recovery proof. No registry is sent to a child.
// Run: node examples/process-recovery.mjs /absolute/evidence-dir [reader-runtime]
// The output directory must be new. SIGKILL scenario requires POSIX.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createChord, openSqliteStore, SCHEMA_VERSION, reduceTrace } from '@antistructured/chord';

const script = fileURLToPath(import.meta.url);
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const completed = () => ({ status: 'completed', outcome: 'succeeded' });
function stored(path) {
  const store = openSqliteStore({ path, mode: 'existing' });
  try { return store.load().registry; } finally { store.close(); }
}
function recordEffect(dir, phase) {
  const fd = openSync(join(dir, 'effects.ndjson'), 'a');
  try { appendFileSync(fd, JSON.stringify({ phase, pid: process.pid }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
function taskIn(r, phase) { return Object.values(r.tasks).find(t => t.phase === phase); }
function installHost(c) {
  const principal = (id, kind) => ({ principal_id: id, kind, issuer: 'example-host', authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER });
  c.setAuthoritySnapshot({ schema_version: SCHEMA_VERSION, run_id: c.getRegistry().run.run_id, authority_revision: 0,
    principals: [principal('worker', 'service'), principal('human', 'human')],
    actors: [{ actor_id: 'worker', principal_id: 'worker', kind: 'agent', roles: [], capabilities: ['execute'], revoked_at: null }], grants: [], approvals: [] });
}
function queue(c, phase, required = false) {
  const { packets } = c.registerSpecAndQueue({ schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec', project: 'process-proof', phase, do: [phase] }, {
    principal_id: 'worker', actor_id: 'worker', capability: 'execute', approval_required: required,
    issueGrants: packets => packets.map(p => c.createTaskGrant(p, { principal_id: 'worker', actor_id: 'worker', capability: 'execute', requires_approval: required }))
  });
  return packets[0].task_id;
}
// Example ingress only: no login implementation. A real embedding replaces the
// explicit host attestation with its own trusted authentication service. SDK
// stays private in this closure; a request cannot select its own principal.
function ingress(c) {
  const sessions = new Map();
  return {
    attest(session, principal) { sessions.set(session, principal); },
    resume(request) {
      const principal = sessions.get(request.session);
      if (!principal) throw Object.assign(new Error('HOST_UNAUTHENTICATED'), { code: 'HOST_UNAUTHENTICATED' });
      return c.resumeRun({ principal_id: principal, approval_id: request.approval_id, expectedRevision: c.getRunRevision() });
    }
  };
}
async function worker(scenario, stage, dir) {
  const path = join(dir, 'run.sqlite');
  const info = { pid: process.pid, runtime: process.versions.bun ? 'bun' : 'node', version: process.versions.bun || process.versions.node };
  let c;
  const evidence = name => {
    const registry = c.getRegistry();
    assert.deepEqual(stored(path), registry);
    assert.deepEqual(reduceTrace(registry.event_journal), registry);
    json(join(dir, name), { ...info, registry });
  };
  if (stage === 'first') {
    c = createChord({ storage: { path, mode: 'create' }, trustedHost: { now: () => 100 }, adapterRouter: { fallback: { execute() { recordEffect(dir, 'committed'); return completed(); } } } });
    installHost(c);
    queue(c, 'committed');
    assert.equal((await c.runCycle()).ok, true);
    const id = queue(c, scenario, scenario === 'approval');
    if (scenario === 'approval') {
      c.prepareAttempt(id);
      c.pauseForApproval({ reason: 'fresh host human approval required' });
      const oldHost = ingress(c); oldHost.attest('old-session', 'human');
      assert.equal((await c.runCycle()).code, 'RUN_NOT_ACTIVE');
      evidence('first.json'); c.close(); return;
    }
    c.setAdapterRouter({ fallback: { execute() {
      recordEffect(dir, 'ambiguous'); // external effect durable; no adapter acknowledgement
      evidence('first.json');
      process.kill(process.pid, 'SIGKILL');
      throw Error('SIGKILL did not terminate');
    } } });
    await c.runCycle(); throw Error('interruption not reached');
  }
  // First read is exclusively from SQLite, never from the first evidence file.
  const before = stored(path);
  json(join(dir, 'reopened.json'), { ...info, registry: before });
  let calls = 0;
  c = createChord({ storage: { path, mode: 'existing' }, trustedHost: { now: () => 101 }, adapterRouter: { fallback: { execute() { calls++; recordEffect(dir, 'continued'); return completed(); } } } });
  try {
    assert.equal(c.getRegistry().run.run_id, before.run.run_id);
    assert.equal(taskIn(c.getRegistry(), 'committed').status, 'completed');
    let rejectedSessions = 0, attemptId;
    const id = taskIn(before, scenario).task_id;
    if (scenario === 'approval') {
      assert.deepEqual(c.getRegistry(), before);
      attemptId = before.pending_attempts[id].attempt_id;
      assert.equal((await c.runCycle()).code, 'RUN_NOT_ACTIVE');
      const host = ingress(c);
      for (const session of [undefined, 'old-session', 'human']) {
        assert.throws(() => host.resume({ session, principal_id: 'human' }), e => e.code === 'HOST_UNAUTHENTICATED'); rejectedSessions++;
      }
      assert.deepEqual(stored(path), before);
      // Explicit NEW embedding-host human attestation; persisted policy is not login.
      host.attest('fresh-session', 'human');
      const approval = c.createApproval({ task_id: id, approver_principal_id: 'human' });
      const a = c.getAuthority(); a.authority_revision++; a.approvals.push(approval); c.setAuthoritySnapshot(a);
      assert.equal(host.resume({ session: 'fresh-session', principal_id: 'forged' , approval_id: approval.approval_id }).ok, true);
      const result = await c.runCycle(); assert.equal(result.ok, true); assert.equal(result.attempt_id, attemptId);
      assert.equal(c.getAuthority().approvals[0].consumed_by_attempt_id, attemptId);
      assert.equal(calls, 1); assert.equal(c.getRegistry().tasks[id].status, 'completed');
    } else {
      attemptId = before.active_attempts[id].attempt.attempt_id;
      assert.equal(before.tasks[id].status, 'running');
      assert.equal(c.getRegistry().tasks[id].status, 'uncertain');
      assert.ok(Object.values(c.getRegistry().operations).some(o => o.state === 'unknown'));
      assert.equal(calls, 0);
    }
    for (let i = 0; i < 3; i++) assert.equal((await c.runCycle()).skipped, true);
    assert.equal(calls, scenario === 'approval' ? 1 : 0);
    evidence('final.json');
    json(join(dir, 'summary.json'), { ...info, scenario, run_id: before.run.run_id, attempt_id: attemptId, calls, rejectedSessions, journalMatches: true, events: c.getRegistry().event_journal.length });
  } finally { c.close(); }
}

export function runProcessRecoveryProof(directory, { writer = process.execPath, reader = process.execPath } = {}) {
  // Resolve version-manager launchers before measuring child PIDs: a launcher
  // may spawn rather than exec the real runtime, and is not the worker itself.
  const executable = runtime => {
    const probe = spawnSync(runtime, ['-p', 'process.execPath'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(probe.status, 0, probe.stderr || probe.error?.message);
    return probe.stdout.trim();
  };
  writer = executable(writer); reader = executable(reader);
  const root = resolve(directory); mkdirSync(root); // refuse accidental evidence overwrite
  const summaries = [];
  for (const scenario of ['approval', 'ambiguous']) {
    const dir = join(root, scenario); mkdirSync(dir);
    const invoke = (runtime, stage) => {
      const child = spawnSync(runtime, [script, '--worker', scenario, stage, dir], { encoding: 'utf8', timeout: 30000 });
      json(join(dir, `${stage}-process.json`), { runtime, pid: child.pid, status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr, error: child.error?.message });
      return child;
    };
    const first = invoke(writer, 'first');
    assert.equal(first.error, undefined);
    if (scenario === 'ambiguous') assert.equal(first.signal, 'SIGKILL');
    else assert.equal(first.status, 0, first.stderr);
    const second = invoke(reader, 'second');
    assert.equal(second.status, 0, second.stderr); assert.equal(second.error, undefined);
    assert.notEqual(first.pid, second.pid); assert.notEqual(first.pid, process.pid); assert.notEqual(second.pid, process.pid);
    const initial = read(join(dir, 'first.json')), reopened = read(join(dir, 'reopened.json')), final = read(join(dir, 'final.json'));
    assert.equal(initial.pid, first.pid); assert.equal(final.pid, second.pid);
    assert.deepEqual(initial.registry, reopened.registry);
    assert.equal(initial.registry.run.run_id, final.registry.run.run_id);
    assert.deepEqual(final.registry.event_journal.slice(0, initial.registry.event_journal.length), initial.registry.event_journal);
    assert.deepEqual(reduceTrace(final.registry.event_journal), final.registry);
    assert.deepEqual(taskIn(initial.registry, 'committed'), taskIn(final.registry, 'committed'));
    const effects = readFileSync(join(dir, 'effects.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(effects.map(e => e.phase), scenario === 'approval' ? ['committed', 'continued'] : ['committed', 'ambiguous']);
    assert.equal(effects[0].pid, first.pid); assert.equal(effects[1].pid, scenario === 'approval' ? second.pid : first.pid);
    // No credentials are used. Session handles and executable service keys must
    // not leak into the closed SQLite file bytes or registry JSON evidence.
    for (const text of [JSON.stringify(initial), JSON.stringify(final), readFileSync(join(dir, 'run.sqlite')).toString('utf8')]) {
      for (const marker of ['old-session', 'fresh-session', 'adapterRouter', 'trustedHost']) assert.equal(text.includes(marker), false);
    }
    summaries.push({ ...read(join(dir, 'summary.json')), first_pid: first.pid, second_pid: second.pid, first_signal: first.signal, committed_effects: 1, ambiguous_redispatches: 0 });
  }
  const result = { gate: 'B5 PASS', directory: root, scenarios: summaries };
  json(join(root, 'summary.json'), result); return result;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv[2] === '--worker') await worker(...process.argv.slice(3));
  else {
    assert.ok(process.argv[2], 'Usage: node examples/process-recovery.mjs NEW_EVIDENCE_DIRECTORY [reader-runtime]');
    console.log(JSON.stringify(runProcessRecoveryProof(process.argv[2], { reader: process.argv[3] || process.execPath }), null, 2));
  }
}
