import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { actorFixture } from './fixtures/coordinated-actors.js';
import { createCoordinatedChord } from '../src/index.js';
import { reduceCoordinationTrace } from '../src/coordination/history.js';
import { outcomeCandidate } from '../src/coordination/runtime.js';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
const N='/home/d/.volta/tools/image/node/24.22.1/bin/node',B='/home/d/.bun/bin/bun';
const worker=new URL('./coordinated-adversarial-worker.js',import.meta.url);
const success={status:'completed',outcome:'succeeded'};
const raw=path=>{const db=new DatabaseSync(path);try{return db.prepare('SELECT * FROM chord_coordination').get();}finally{db.close();}};
function released(){const f=actorFixture();assert.equal(f.submit('bob').ok,true);f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind:'release'}});f.store.close();return f;}
function open(f,adapter){return createCoordinatedChord({storage:{path:f.path,mode:'existing',expectedIdentity:f.identity},trustedHost:{clock:f.clock},adapterRouter:{fallback:adapter}});}
for(const owner of [N,B])for(const next of [N,B])test(`real SIGKILL renew/intent/effect/result; ${owner} -> ${next}`,{timeout:120000},async t=>{
  for(const point of ['renew','intent','effect','result']){
    const f=released(),effect=join(dirname(f.path),'business-effect.txt');let child;
    try{
      const config={path:f.path,identity:f.identity,effect,point};
      child=fork(worker,['crash',JSON.stringify(config)],{execPath:owner,execArgv:[],stdio:['ignore','pipe','pipe','ipc']});
      let stderr='';child.stderr.on('data',b=>stderr+=b);
      const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
      const message=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`seam timeout ${stderr}`)),20000);child.once('message',m=>{clearTimeout(timer);resolve(m);});child.once('error',reject);});
      assert.equal(message.pid,child.pid);assert.equal(message.point,point);assert.equal(message.calls,['effect','result'].includes(point)?1:0);
      const before=raw(f.path),persisted=JSON.parse(before.envelope_json);
      assert.equal(persisted.coordination.lease.generation,2);assert.equal(persisted.coordination.lease.expires_at,30102);
      assert.equal(persisted.registry.tasks[f.packets.bob.task_id].status,point==='renew'?'queued':point==='result'?'completed':'running');
      assert.equal(existsSync(effect),['effect','result'].includes(point));
      child.kill('SIGKILL');assert.deepEqual(await exit,{code:null,signal:'SIGKILL'});assert.deepEqual(raw(f.path),before);
      const restored=spawnSync(next,[worker.pathname,'restore',JSON.stringify({...config,point:'restore'})],{encoding:'utf8',timeout:20000});
      assert.equal(restored.status,0,restored.stderr);const proof=JSON.parse(restored.stdout);assert.equal(proof.pid,restored.pid);
      assert.equal(proof.acquired.envelope.coordination.lease.generation,3);assert.equal(proof.calls,point==='renew'?1:0);
      const status=proof.acquired.envelope.registry.tasks[f.packets.bob.task_id].status;
      assert.equal(status,point==='renew'?'queued':point==='result'?'completed':'uncertain');
      assert.equal(proof.final.envelope.registry.execution_results.length,['renew','result'].includes(point)?1:0);
      if(['intent','effect'].includes(point)){assert.equal(proof.outcome.skipped,true);assert.equal(Object.values(proof.final.envelope.registry.operations)[0].state,'unknown');}
      assert.deepEqual(proof.replay,proof.final.envelope);assert.deepEqual(reduceCoordinationTrace(proof.final.envelope),proof.final.envelope);
      assert.equal(existsSync(effect)?readFileSync(effect,'utf8'):'',point==='intent'?'':'effect\n');
      assert.deepEqual(JSON.parse(raw(f.path).envelope_json),proof.final.envelope);
      t.diagnostic(JSON.stringify({point,ownerPid:message.pid,restorerPid:proof.pid,status,calls:proof.calls,generation:3}));
    }finally{if(child?.exitCode===null&&child?.signalCode===null)child.kill('SIGKILL');f.cleanup();}
  }
});

test('actual takeover AFTER final check but BEFORE captured callable proves residual unfenced remote race',async()=>{
  for(const runtime of [N,B]){
    const f=released();let calls=0;const execute=()=>{calls++;return success;};const c=open(f,{execute}),apply=Reflect.apply;
    try{
      c.owner.acquire({expectedRevision:c.observer.inspect().revision});let after;
      Reflect.apply=function(fn,self,args){if(fn===execute){Reflect.apply=apply;const r=spawnSync(runtime,[new URL('./coordinated-dispatch-worker.js',import.meta.url).pathname,'sync-takeover',JSON.stringify({path:f.path,identity:f.identity,time:30100})],{encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).pid,r.pid);after=raw(f.path);f.time=30100;}return apply(fn,self,args);};
      await assert.rejects(c.owner.runCycle(),e=>e.code==='OWNER_LOST');assert.equal(calls,1);assert.ok(after);assert.deepEqual(raw(f.path),after);
      assert.equal(JSON.parse(after.envelope_json).registry.tasks[f.packets.bob.task_id].status,'uncertain');
    }finally{Reflect.apply=apply;c.owner.close();f.cleanup();}
  }
});

test('pure outcome candidate rejects stale success AND error before constructing any uncertainty candidate',async()=>{
  const f=released();let settle;const c=open(f,{execute:()=>new Promise(r=>settle=r)});
  try{
    c.owner.acquire({expectedRevision:c.observer.inspect().revision});const cycle=c.owner.runCycle();
    const dispatch=Object.values(c.observer.inspect().envelope.coordination.attempts)[0];
    c.owner.release({expectedRevision:c.observer.inspect().revision});const current=c.observer.exportEnvelope(),before=structuredClone(current),row=raw(f.path);
    const codes=[false,true].map(throws=>{try{outcomeCandidate(current,{dispatch,adapter_result:throws?null:success,error_code:throws?'ADAPTER_ERROR':null},100,100);return 'ACCEPTED';}catch(e){return e.code;}});
    assert.deepEqual(codes,['STALE_ATTEMPT','STALE_ATTEMPT']);
    assert.deepEqual(current,before);assert.deepEqual(raw(f.path),row);settle(success);await assert.rejects(cycle,e=>e.code==='OWNER_LOST');assert.deepEqual(raw(f.path),row);
  }finally{c.owner.close();f.cleanup();}
});

test('consumed exact approval survives transfer but cannot authorize a readmitted generation attempt',async()=>{
  const f=actorFixture();let c,next,settle;
  try{
    assert.equal(f.submit('alice').ok,true);f.policy();
    const requested=f.send('alice',f.command('request_approval',{task_id:f.packets.alice.task_id,reason:'review',expires_at:10000}));assert.equal(requested.ok,true);
    assert.equal(f.send('human',f.command('respond_approval',{approval_request_id:requested.result.approval_request_id,decision:'approve',reason:null})).ok,true);
    f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind:'release'}});f.store.close();
    c=open(f,{execute:()=>new Promise(r=>settle=r)});c.owner.acquire({expectedRevision:c.observer.inspect().revision});const cycle=c.owner.runCycle();
    const consumed=c.observer.inspect().envelope.registry.authority.approvals[0];assert.ok(consumed.consumed_by_attempt_id);
    f.time=101;c.owner.release({expectedRevision:c.observer.inspect().revision});next=open(f,{execute:()=>assert.fail('consumed approval dispatched')});next.owner.acquire({expectedRevision:next.observer.inspect().revision});
    assert.ok(consumed.expires_at>f.time);assert.equal(consumed.revoked_at,null);
    assert.deepEqual(next.observer.inspect().envelope.registry.authority.approvals[0],consumed);
    next.admin.reconcileTask({task_id:f.packets.alice.task_id,principal_id:'p-human',expectedRevision:next.observer.inspect().revision,decision:'confirmed_not_executed',evidence:{kind:'no_effect_confirmation',reference:'fresh-host-human-check'}});
    next.admin.readmitTask(f.packets.alice.task_id,{expectedRevision:next.observer.inspect().revision});
    const before=raw(f.path);await assert.rejects(next.owner.runCycle(),e=>e.code==='APPROVAL_REQUIRED');assert.deepEqual(raw(f.path),before);
    settle(success);await assert.rejects(cycle,e=>e.code==='OWNER_LOST');assert.deepEqual(raw(f.path),before);assert.deepEqual(next.observer.replayEnvelope(),next.observer.exportEnvelope());
  }finally{c?.owner.close();next?.owner.close();f.cleanup();}
});
