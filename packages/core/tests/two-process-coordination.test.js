import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runProof,resolveRuntime} from '../examples/two-process-coordination.mjs';

const scratch=process.env.TMPDIR || '/home/d/.hermes/cache/scratch';
const node=resolveRuntime(process.env.CHORD_PROOF_NODE || '/home/d/.volta/tools/image/node/24.22.1/bin/node');
const bun=resolveRuntime(process.env.CHORD_PROOF_BUN || '/home/d/.bun/bin/bun');
const read=(dir,name)=>JSON.parse(readFileSync(join(dir,name),'utf8'));
for(const [ownerName,ownerRuntime] of [['node',node],['bun',bun]])for(const [actorName,actorRuntime] of [['node',node],['bun',bun]]){
  test(`public live coordination ${ownerName} owner / ${actorName} actor`,{timeout:60000},async t=>{
    const parent=mkdtempSync(join(scratch,'chord-052-live-')),dir=join(parent,'proof');
    const e=await runProof({dir,ownerRuntime,actorRuntime});
    assert.equal(e.owner.execPath,ownerRuntime);assert.equal(e.actor.execPath,actorRuntime);
    assert.equal(new Set([process.pid,e.owner.pid,e.actor.pid,e.standby.pid]).size,4);
    assert.equal(e.simultaneouslyAlive,true);assert.deepEqual(e.actor.api,['close','sendCommand']);
    assert.deepEqual(e.actor.argv,['--role','actor']);assert.equal(e.competition.acquire,'OWNER_HELD');assert.equal(e.competition.dispatch,'NOT_OWNER');assert.equal(e.competition.unchanged,true);
    assert.equal(e.revision,14);assert.equal(e.calls,2);assert.equal(e.effects,2);assert.equal(e.receiptCount,6);assert.equal(e.attemptCount,2);
    const final=read(dir,'final.json'),replay=read(dir,'replay.json'),reopened=read(dir,'reopened.json'),p=read(dir,'processes.json');
    assert.deepEqual(replay,final.envelope);assert.deepEqual(reopened,final);
    assert.equal(p.ownerSpawnPid,e.owner.pid);assert.equal(p.ownerCleaned,true);assert.equal(p.childrenCleaned,true);assert.equal(p.independentReopenMatches,true);
    for(const pid of [e.owner.pid,e.actor.pid,e.standby.pid])assert.throws(()=>process.kill(pid,0),err=>err.code==='ESRCH');
    for(const role of ['owner','actor','standby']){const exit=read(dir,`${role}.exit.json`);assert.equal(exit.code,0);assert.equal(exit.signal,null);}
    const effects=readFileSync(join(dir,'effects.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(effects.map(x=>x.task_id).sort(),['task-alice','task-bob']);
    assert.equal(new Set(effects.map(x=>x.context.coordination.idempotency_key)).size,2);
    const r=final.envelope.registry,c=final.envelope.coordination;
    const receipts=Object.values(c.commands);assert.equal(receipts.length,6);
    assert.deepEqual(receipts.map(x=>x.command.type).sort(),['propose_handoff','request_approval','respond_approval','respond_handoff','submit_work','submit_work']);
    assert.equal(Object.values(r.handoffs)[0].responded_by,'bob');assert.equal(Object.values(r.handoffs)[0].status,'accepted');
    assert.equal(Object.values(c.approval_requests)[0].response_subject.actor_id,'human');
    const attempts=Object.values(c.attempts);assert.equal(attempts.length,2);
    for(const effect of effects){
      assert.equal(effect.pid,e.owner.pid);assert.equal(effect.context.coordination.generation,1);
      assert.equal(effect.context.coordination.owner_id,c.lease.owner_id);
      const attempt=attempts.find(x=>x.attempt_id===effect.context.attempt_id);assert.ok(attempt);
      assert.equal(attempt.state,'completed');assert.equal(attempt.operation_id,r.tasks[effect.task_id].operation_id);
      assert.equal(r.operations[attempt.operation_id].state,'confirmed');assert.equal(r.tasks[effect.task_id].status,'completed');
      assert.equal(readFileSync(join(dir,`${r.tasks[effect.task_id].target_entity}.effect.txt`),'utf8'),effect.artifact);
      assert.equal(effect.context.coordination.idempotency_key,JSON.stringify(['chord.effect.v1',e.identity.incarnation_id,e.identity.run_id,attempt.operation_id]));
    }
    const transcript=read(dir,'actor-transcript.json');
    const denials=transcript.filter(x=>x.label && x.response.ok===false);
    assert.equal(denials.length,11);
    assert.deepEqual(denials.map(x=>x.response.code).sort(),['STALE_REVISION','NO_ALLOW_GRANT','RUN_MISMATCH','INCARNATION_MISMATCH',...Array(5).fill('INVALID_COMMAND'),'HOST_UNAUTHENTICATED','FORBIDDEN'].sort());
    assert.ok(denials.every(x=>x.unchanged));
    for(const label of ['duplicate-handoff','duplicate-submit','post-effect-duplicate'])assert.equal(transcript.find(x=>x.label===label).unchanged,true);
    const observations=transcript.filter(x=>x.command?.type==='observe_outcomes' && x.response.ok).map(x=>x.response.result.outcomes);
    assert.equal(observations[0].length,1);assert.equal(Object.hasOwn(observations[0][0],'last_result'),false);
    const preGrant=observations.at(-2);assert.equal(Object.hasOwn(preGrant.find(x=>x.task_id==='task-alice'),'last_result'),false);
    assert.equal(preGrant.find(x=>x.task_id==='task-bob').last_result.outcome,'succeeded');
    assert.deepEqual(observations.at(-1).map(x=>[x.task_id,x.status,x.last_result.summary]),[['task-alice','completed','fenced artifact written'],['task-bob','completed','fenced artifact written']]);
    assert.ok(observations.every(xs=>xs.every(x=>x.task_id!=='task-foreign')));
    t.diagnostic(`evidence ${dir}; owner ${e.owner.pid}, actor ${e.actor.pid}, standby ${e.standby.pid}; effects 2, receipts 6, revision 14`);
  });
}
