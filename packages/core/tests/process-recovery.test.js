import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runProcessRecoveryProof } from '../examples/process-recovery.mjs';

const bun = process.versions.bun ? process.execPath : process.env.BUN_EXECUTABLE || (existsSync(join(homedir(), '.bun/bin/bun')) ? join(homedir(), '.bun/bin/bun') : 'bun');
const node = process.versions.bun ? process.env.NODE_EXECUTABLE || 'node' : process.execPath;
const bunAvailable = spawnSync(bun, ['--version'], { encoding: 'utf8' }).status === 0;
for (const [writerName, readerName, writer, reader] of [
  ['Node', 'Node', node, node], ['Bun', 'Bun', bun, bun], ['Node', 'Bun', node, bun], ['Bun', 'Node', bun, node]
]) test(`B5 independent process ${writerName} -> ${readerName}: approved continuation and ambiguous quarantine`, { skip: (writerName === 'Bun' || readerName === 'Bun') && !bunAvailable ? 'Bun not installed' : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'chord-b5-'));
  try {
    const root = join(dir, 'evidence');
    const result = runProcessRecoveryProof(root, { writer, reader });
    assert.equal(result.gate, 'B5 PASS'); assert.equal(result.scenarios.length, 2);
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'summary.json'), 'utf8')), result);
    const [approval, ambiguous] = result.scenarios;
    assert.equal(approval.calls, 1); assert.equal(approval.rejectedSessions, 3);
    assert.equal(ambiguous.calls, 0); assert.equal(ambiguous.first_signal, 'SIGKILL');
    for (const s of result.scenarios) {
      assert.notEqual(s.first_pid, s.second_pid); assert.equal(s.committed_effects, 1);
      assert.equal(s.ambiguous_redispatches, 0); assert.equal(s.journalMatches, true);
      const first = JSON.parse(readFileSync(join(root, s.scenario, 'first.json'), 'utf8'));
      const final = JSON.parse(readFileSync(join(root, s.scenario, 'final.json'), 'utf8'));
      assert.equal(first.runtime, writerName.toLowerCase()); assert.equal(final.runtime, readerName.toLowerCase());
      const task = Object.values(final.registry.tasks).find(t => t.phase === s.scenario);
      assert.equal(task.status, s.scenario === 'approval' ? 'completed' : 'uncertain');
      if (s.scenario === 'ambiguous') {
        assert.equal(first.registry.active_attempts[task.task_id].attempt.attempt_id, s.attempt_id);
        assert.deepEqual(final.registry.active_attempts, {});
      } else assert.equal(first.registry.pending_attempts[task.task_id].attempt_id, s.attempt_id);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
