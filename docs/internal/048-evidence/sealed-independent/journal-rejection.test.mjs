import test from 'node:test';
import assert from 'node:assert/strict';
import { createChord, canonicalProjection, replayNoSideEffects } from '@chord/core';
for (const mode of ['same-run-unsupported', 'foreign-run']) {
  test(`${mode} caller-appended journal rejects atomically and preserves complete replay`, () => {
    const chord = createChord();
    const before = chord.getRegistry();
    const events = chord.inspectEvents();
    const revision = chord.getRunRevision();
    const projection = canonicalProjection(before);
    assert.deepEqual(canonicalProjection(replayNoSideEffects(events).projected), projection);
    const candidate = chord.getRegistry();
    candidate.run.revision++;
    candidate.event_journal.push({ ...candidate.event_journal[0], event_id: `independent-${mode}`, type: mode === 'same-run-unsupported' ? 'unsupported-caller-event' : 'spec_registered', run_id: mode === 'foreign-run' ? 'independent-foreign-run' : before.run.run_id, run_revision: candidate.run.revision, payload: {} });
    let result;
    try { result = chord.commitRun({ expectedRevision: revision, nextRegistry: candidate }); }
    catch (error) { result = { ok: false, code: error.code, message: error.message }; }
    assert.equal(result.ok, false);
    // Foreign run correlation is rejected by RegistryData before owner history comparison.
    assert.equal(result.code, mode === 'foreign-run' ? 'INVALID_SEMANTICS' : 'INVALID_HISTORY');
    assert.deepEqual(chord.getRegistry(), before);
    assert.deepEqual(canonicalProjection(chord.getRegistry()), projection);
    assert.equal(chord.getRunRevision(), revision);
    assert.deepEqual(chord.inspectEvents(), events);
    const replay = replayNoSideEffects(chord.inspectEvents());
    assert.equal(replay.effects_invoked, 0);
    assert.deepEqual(canonicalProjection(replay.projected), projection);
    const valid = chord.getRegistry(); valid.run.revision++;
    assert.equal(chord.commitRun({ expectedRevision: revision, nextRegistry: valid }).ok, true);
    assert.deepEqual(canonicalProjection(replayNoSideEffects(chord.inspectEvents()).projected), canonicalProjection(chord.getRegistry()));
    console.log(JSON.stringify({ mode, rejection: result.code, unchanged: true, replay_intact: true, next_valid_commit: true }));
  });
}
