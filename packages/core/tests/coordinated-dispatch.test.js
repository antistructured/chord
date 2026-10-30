import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fork, spawnSync } from 'node:child_process';
import { createCoordinatedChord, openCoordinatedSqliteStore } from '../src/index.js';
import { actorFixture } from './fixtures/coordinated-actors.js';
import { reduceCoordinationTrace } from '../src/coordination/history.js';
const {DatabaseSync} = createRequire(import.meta.url)('node:sqlite');
const success = {status:'completed',outcome:'succeeded',summary:'actual result'};
const deferred = () => { let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; };
const code = expected => e => e.code === expected;
function fixture(adapter,options = {}) {
  const f = actorFixture();
  f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind:'release'}});f.store.close();
  const open = (adapterRouter = options.router || {fallback:adapter}) => createCoordinatedChord({storage:{path:f.path,mode:'existing',expectedIdentity:f.identity},trustedHost:{clock:f.clock},adapterRouter});
  const c = open(); c.owner.acquire({expectedRevision:c.observer.inspect().revision});
  let seq=0;
  const ingress = c.createActorIngress({authenticate:ch=>f.sessions.get(ch)||null});
  const cmd=(type,payload,revision = c.observer.inspect().revision)=>({protocol_version:'chord.actor-command.v1',operation_id:`dispatch-command-${++seq}`,...f.identity,expected_revision:revision,correlation_id:null,causation_id:null,type,payload});
  const send=(who,type,payload)=>ingress.handleAuthenticated(who,JSON.stringify(cmd(type,payload)));
  const submit=who=>{const result=send(who,'submit_work',{packets:[f.packets[who]]});assert.equal(result.ok,true,JSON.stringify(result));return result;};
  const read=()=>c.observer.inspect();
  return {f,c,open,ingress,cmd,send,submit,read,cleanup(){c.owner.close();f.cleanup();}};
}
function raw(path) {const db=new DatabaseSync(path);try{return db.prepare('SELECT * FROM chord_coordination').get();}finally{db.close();}}
function reconcile(c,taskId) {
  const revision=c.observer.inspect().revision;
  c.admin.reconcileTask({task_id:taskId,principal_id:'p-human',expectedRevision:revision,decision:'confirmed_not_executed',evidence:{kind:'no_effect_confirmation',reference:'operator-checked'}});
  c.admin.readmitTask(taskId,{expectedRevision:c.observer.inspect().revision});
}

test('factory ports start unacquired; no router getter/service/recovery before ownership; reads never adopt',async()=>{
  const x=fixture({execute:()=>success});let gets=0;
  const other=x.open({get fallback(){gets++;return {execute:()=>success};}});
  try {
    const before=raw(x.f.path);assert.deepEqual(Object.keys(other).sort(),['admin','createActorIngress','observer','owner']);
    await assert.rejects(other.owner.runCycle(),code('NOT_OWNER'));assert.equal(gets,0);assert.deepEqual(raw(x.f.path),before);
    assert.throws(()=>other.owner.acquire({expectedRevision:other.observer.inspect().revision}),code('OWNER_HELD'));
    assert.deepEqual(raw(x.f.path),before);assert.equal(gets,0);
  }finally{other.owner.close();x.cleanup();}
});

test('P4 command approval -> actual captured dispatch and outcome; exact default context and combined replay',async()=>{
  let calls=0,context,packet;
  const x=fixture({execute:(p,c)=>{calls++;packet=p;context=c;return success;}});
  try {
    x.submit('alice');
    const policy={policy_revision:1,handoffs:[],approvals:[{rule_id:'approval-rule',requesting_actor_id:'alice',approver_actor_id:'human',scope:x.f.bindings.alice && x.read().envelope.registry.tasks[x.f.packets.alice.task_id].authority_binding.scope,max_ttl_ms:10000}]};
    x.c.admin.setCoordinationPolicy(policy,{expectedRevision:x.read().revision});
    const req=x.send('alice','request_approval',{task_id:x.f.packets.alice.task_id,reason:'review',expires_at:10000});assert.equal(req.ok,true);
    const approved=x.send('human','respond_approval',{approval_request_id:req.result.approval_request_id,decision:'approve',reason:null});assert.equal(approved.ok,true);assert.equal(calls,0);
    const result=await x.c.owner.runCycle();assert.equal(result.result.classification,'result');assert.equal(calls,1);
    const state=x.read().envelope;assert.equal(state.registry.tasks[packet.task_id].status,'completed');assert.equal(state.registry.authority.approvals[0].consumed_by_attempt_id,context.attempt_id);
    assert.deepEqual(Object.keys(context).sort(),['run_id','schema_version','task_id','task_revision','queue_id','attempt_id','lease_expires_at'].sort());assert.ok(Object.isFrozen(packet));assert.ok(Object.isFrozen(context));
    assert.deepEqual(reduceCoordinationTrace(state),state);
    assert.equal((await x.c.owner.runCycle()).skipped,true);assert.equal(calls,1);
    const outcomes=x.send('alice','observe_outcomes',{task_ids:[packet.task_id]});assert.equal(outcomes.result.outcomes[0].last_result.summary,'actual result');
  }finally{x.cleanup();}
});

test('renewal and unrelated actor receipt advance revision without poisoning an in-flight attempt',async()=>{
  const wait=deferred();let calls=0;
  const x=fixture({execute:()=>{calls++;return wait.promise;}});
  try {
    x.submit('bob');const cycle=x.c.owner.runCycle();assert.equal(calls,1);
    const dispatch=Object.values(x.read().envelope.coordination.attempts)[0];
    x.f.time=101;x.c.owner.renew({expectedRevision:x.read().revision});x.submit('foreign');
    assert.deepEqual(x.read().envelope.coordination.attempts[dispatch.attempt_id],dispatch);
    wait.resolve(success);assert.equal((await cycle).result.classification,'result');assert.equal(x.read().envelope.registry.tasks[dispatch.task_id].status,'completed');
  }finally{x.cleanup();}
});

for (const action of ['authority','pause','task-expiry','cancel','release']) test(`${action} while pending cannot accept a result or redispatch unknown work`,async()=>{
  const wait=deferred();const x=fixture({execute:()=>wait.promise});
  try {
    x.submit('bob');const cycle=x.c.owner.runCycle(),taskId=x.f.packets.bob.task_id;
    if(action==='authority') {const a=x.read().envelope.registry.authority;a.authority_revision++;x.c.admin.setAuthoritySnapshot(a,{expectedRevision:x.read().revision});}
    if(action==='task-expiry'){x.f.time=200;x.c.owner.renew({expectedRevision:x.read().revision});x.f.time=30100;}
    if(['pause','cancel'].includes(action)){const r=x.read().envelope.registry;r.run.revision++;if(action==='pause')r.run.state='paused';else{r.tasks[taskId].status='cancelled';r.task_queue.find(q=>q.task_id===taskId).status='cancelled';delete r.active_attempts[taskId];r.operations[r.tasks[taskId].operation_id].state='unknown';}x.c.admin.commitRun({expectedRevision:x.read().revision,nextRegistry:r});}
    if(action==='release')x.c.owner.release({expectedRevision:x.read().revision});
    const before=raw(x.f.path);wait.resolve(success);
    if(['cancel','release'].includes(action)){await assert.rejects(cycle,code(action==='cancel'?'STALE_ATTEMPT':'OWNER_LOST'));assert.deepEqual(raw(x.f.path),before);}
    else {assert.equal((await cycle).result.classification,'uncertain');assert.equal(x.read().envelope.registry.tasks[taskId].status,'uncertain');}
  }finally{x.cleanup();}
});

for (const throws of [false,true]) test(`old ${throws?'throw':'success'} after takeover/reconcile/readmit/new attempt leaves exact new row untouched`,async()=>{
  const old=deferred(),fresh=deferred();let calls=0;const contexts=[];
  const x=fixture({execute:(p,c)=>{calls++;contexts.push(c);return old.promise;}});
  let next;
  try {
    x.submit('bob');const cycle=x.c.owner.runCycle();assert.equal(calls,1);x.f.time=30100;
    next=x.open({fallback:{adapter:{execute:(p,c)=>{calls++;contexts.push(c);return fresh.promise;}},execution_context:'chord.execution-context.v2'}});
    next.owner.acquire({expectedRevision:next.observer.inspect().revision});
    const quarantine=next.observer.inspect().envelope;assert.equal(quarantine.registry.tasks[x.f.packets.bob.task_id].status,'uncertain');assert.equal((await next.owner.runCycle()).skipped,true);assert.equal(calls,1);
    reconcile(next,x.f.packets.bob.task_id);const newCycle=next.owner.runCycle();assert.equal(calls,2);const before=raw(x.f.path);
    if(throws)old.reject(Error('old error'));else old.resolve(success);
    await assert.rejects(cycle,code('OWNER_LOST'));assert.deepEqual(raw(x.f.path),before);
    fresh.resolve(success);assert.equal((await newCycle).result.classification,'result');assert.ok(Object.isFrozen(contexts[1].coordination));
    assert.equal(next.observer.inspect().envelope.registry.execution_results.length,1);
  }finally{next?.owner.close();x.cleanup();}
});

test('same-generation missing attempt success AND throw are zero-write stale callbacks',async()=>{
  for(const throws of [false,true]){const wait=deferred();const x=fixture({execute:()=>wait.promise});try{
    x.submit('bob');const cycle=x.c.owner.runCycle();const r=x.read().envelope.registry,taskId=x.f.packets.bob.task_id;r.run.revision++;r.tasks[taskId].status='uncertain';r.task_queue.find(q=>q.task_id===taskId).status='uncertain';r.operations[r.tasks[taskId].operation_id].state='unknown';delete r.active_attempts[taskId];x.c.admin.commitRun({expectedRevision:x.read().revision,nextRegistry:r});
    const before=raw(x.f.path);if(throws)wait.reject(Error());else wait.resolve(success);await assert.rejects(cycle,code('STALE_ATTEMPT'));assert.deepEqual(raw(x.f.path),before);
  }finally{x.cleanup();}}
});

for(const point of ['claim-before','claim-after','result-before','result-after']) test(`${point} COMMIT acknowledgement unknown releases no new callable or compensating write`,async()=>{
  let calls=0;const wait=deferred(),x=fixture({execute:()=>{calls++;return wait.promise;}}),exec=DatabaseSync.prototype.exec;
  try {
    x.submit('bob');const before=raw(x.f.path);let commits=0;
    DatabaseSync.prototype.exec=function(sql){if(sql==='COMMIT'){commits++;if(point.endsWith('before'))throw Error('ack');const r=exec.call(this,sql);throw Error('ack');}return exec.call(this,sql);};
    if(point.startsWith('claim')) {await assert.rejects(x.c.owner.runCycle(),code('COMMIT_OUTCOME_UNKNOWN'));assert.equal(calls,0);}
    else {DatabaseSync.prototype.exec=exec;const cycle=x.c.owner.runCycle();assert.equal(calls,1);DatabaseSync.prototype.exec=function(sql){if(sql==='COMMIT'){commits++;if(point.endsWith('before'))throw Error('ack');exec.call(this,sql);throw Error('ack');}return exec.call(this,sql);};wait.resolve(success);await assert.rejects(cycle,code('COMMIT_OUTCOME_UNKNOWN'));}
    DatabaseSync.prototype.exec=exec;assert.equal(commits,1);
    const observer=openCoordinatedSqliteStore({path:x.f.path,mode:'existing',expectedIdentity:x.f.identity,clock:x.f.clock});try{const state=observer.load();assert.equal(state.revision,before.revision+(point==='claim-after'?1:point==='claim-before'?0:point==='result-after'?2:1));assert.equal(state.envelope.registry.execution_results.length,point==='result-after'?1:0);}finally{observer.close();}
  }finally{DatabaseSync.prototype.exec=exec;x.cleanup();}
});

test('final authoritative check expiry after claim prevents callable, keeps dispatched intent unknown until acquisition',async()=>{
  let calls=0;const x=fixture({execute:()=>{calls++;return success;}}),exec=DatabaseSync.prototype.exec;
  try{x.submit('bob');DatabaseSync.prototype.exec=function(sql){const r=exec.call(this,sql);if(sql==='COMMIT')x.f.time=30100;return r;};
    await assert.rejects(x.c.owner.runCycle(),code('LEASE_EXPIRED'));DatabaseSync.prototype.exec=exec;assert.equal(calls,0);
    const next=x.open();try{next.owner.acquire({expectedRevision:next.observer.inspect().revision});assert.equal(next.observer.inspect().envelope.registry.tasks[x.f.packets.bob.task_id].status,'uncertain');assert.equal((await next.owner.runCycle()).skipped,true);assert.equal(calls,0);}finally{next.owner.close();}
  }finally{DatabaseSync.prototype.exec=exec;x.cleanup();}
});

test('stable opt-in operation key across quarantine/readmission/generation; no extra legacy packet fields',async()=>{
  const wait=deferred(),contexts=[];const adapter={execute:(p,c)=>{contexts.push(c);assert.equal(Object.hasOwn(p,'coordination'),false);return wait.promise;}};
  const x=fixture(null,{router:{fallback:{adapter,execution_context:'chord.execution-context.v2'}}});let next;
  try{x.submit('bob');const cycle=x.c.owner.runCycle();x.f.time=30100;next=x.open({fallback:{adapter:{execute:(p,c)=>{contexts.push(c);return success;}},execution_context:'chord.execution-context.v2'}});next.owner.acquire({expectedRevision:next.observer.inspect().revision});reconcile(next,x.f.packets.bob.task_id);await next.owner.runCycle();wait.resolve(success);await assert.rejects(cycle,code('OWNER_LOST'));assert.equal(contexts[0].coordination.idempotency_key,contexts[1].coordination.idempotency_key);assert.notEqual(contexts[0].attempt_id,contexts[1].attempt_id);assert.ok(contexts[1].coordination.generation>contexts[0].coordination.generation);assert.deepEqual(next.observer.replayEnvelope(),next.observer.exportEnvelope());
  }finally{next?.owner.close();x.cleanup();}
});

const workerPath = new URL('./coordinated-dispatch-worker.js',import.meta.url);
const runtimes = ['/home/d/.volta/tools/image/node/24.22.1/bin/node','/home/d/.bun/bin/bun'];
function childWorker(executable) {
  const child=fork(workerPath,[],{execPath:executable,execArgv:[],stdio:['ignore','pipe','pipe','ipc']});
  const messages=[],waiters=[];let stderr='';child.stderr.on('data',b=>{stderr+=b;});
  child.on('message',m=>{messages.push(m);for(const check of [...waiters])check();});
  const get=type=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`timeout ${type}: ${stderr}`)),20000);const check=()=>{const error=messages.find(m=>m.type==='error');if(error){clearTimeout(timer);reject(Error(JSON.stringify(error)));return;}const i=messages.findIndex(m=>m.type===type);if(i>=0){clearTimeout(timer);const wi=waiters.indexOf(check);if(wi>=0)waiters.splice(wi,1);resolve(messages.splice(i,1)[0]);}};waiters.push(check);check();});
  const close=async()=>{if(child.exitCode!==null)return;child.send({type:'close'});await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{child.kill('SIGKILL');resolve();},3000).unref();});};
  return {child,get,close};
}
for(const runtime of runtimes) test(`independent ${runtime.includes('volta')?'Node':'Bun'} takeover with fresh services while old callbacks remain live`,{timeout:60000},async t=>{
  for(const throws of [false,true]){
    const old=deferred(),x=fixture({execute:()=>old.promise}),w=childWorker(runtime);
    try{
      const ready=await w.get('ready');assert.equal(ready.pid,w.child.pid);
      x.submit('bob');const cycle=x.c.owner.runCycle();
      w.child.send({type:'start',path:x.f.path,identity:x.f.identity,time:30100,taskId:x.f.packets.bob.task_id,reconcile:true});
      const entered=await w.get('entered');assert.equal(entered.pid,w.child.pid);x.f.time=30100;const before=raw(x.f.path);
      if(throws)old.reject(Error('stale process throw'));else old.resolve(success);
      await assert.rejects(cycle,code('OWNER_LOST'));assert.deepEqual(raw(x.f.path),before);
      w.child.send({type:'finish'});const done=await w.get('finished');assert.equal(done.serviceCalls,1);assert.equal(done.result.result.classification,'result');assert.equal(done.state.envelope.registry.execution_results.length,1);assert.deepEqual(reduceCoordinationTrace(done.state.envelope),done.state.envelope);
      t.diagnostic(`parent ${process.pid} child ${done.pid}; old ${throws?'throw':'success'} zero writes; fresh effect/result 1`);
    }finally{await w.close();x.cleanup();}
  }
});
for(const runtime of runtimes) test(`actual process takeover between claim acknowledgement and final check: ${runtime}`,{timeout:30000},async()=>{
  let calls=0;const x=fixture({execute:()=>{calls++;return success;}}),exec=DatabaseSync.prototype.exec;
  try{x.submit('bob');let proof;
    DatabaseSync.prototype.exec=function(sql){const r=exec.call(this,sql);if(sql==='COMMIT'){
      DatabaseSync.prototype.exec=exec;
      const child=spawnSync(runtime,[workerPath.pathname,'sync-takeover',JSON.stringify({path:x.f.path,identity:x.f.identity,time:30100})],{encoding:'utf8',timeout:20000});
      assert.equal(child.status,0,child.stderr);x.f.time=30100;proof=JSON.parse(child.stdout);assert.equal(proof.serviceCalls,0);assert.equal(proof.status,'uncertain');assert.equal(proof.pid,child.pid);
    }return r;};
    await assert.rejects(x.c.owner.runCycle(),code('OWNER_LOST'));assert.equal(calls,0);assert.ok(proof);assert.equal(raw(x.f.path).revision,proof.revision);
  }finally{DatabaseSync.prototype.exec=exec;x.cleanup();}
});

test('claim final SQL time reauthorization and owner lease expiry are zero-write/no-call',async()=>{
  for(const times of [[100,100,30100],[100,100,100001]]){
    let calls=0;const x=fixture({execute:()=>{calls++;return success;}});
    try{x.submit('bob');const before=raw(x.f.path);x.f.samples=times;await assert.rejects(x.c.owner.runCycle(),e=>['LEASE_EXPIRED','STALE_ATTEMPT'].includes(e.code));assert.equal(calls,0);assert.deepEqual(raw(x.f.path),before);}finally{x.cleanup();}
  }
});
test('every exact/prefix/default/fallback route captures once; no later execute getter; handoff and intent packets',async()=>{
  const {createHandoffTaskPackets}=await import('../src/execution/task-packets.js');
  for(const route of ['exact','prefix','default','fallback'])for(const handoff of [false,true]){
    let getters=0,calls=0;const adapter={get execute(){getters++;return ()=>{calls++;return success;};}};
    const router=route==='exact'?{exact:{bob:adapter}}:route==='prefix'?{prefix:{bo:adapter}}:route==='default'?{exact:{default:adapter}}:{fallback:adapter};
    const x=fixture(null,{router});
    try{if(handoff){const packet=createHandoffTaskPackets({schema_version:'chord.contracts.v1',spec_type:'HandoffSpec',project:'project',phase:'build',artifact:'report',from:'alice',to:['bob'],requested_action:['review']})[0];packet.task_id=x.f.packets.bob.task_id;x.f.packets.bob=packet;}
      x.submit('bob');assert.equal((await x.c.owner.runCycle()).result.classification,'result');assert.equal(calls,1);assert.equal(getters,1);
    }finally{x.cleanup();}
  }
});
test('combined replay rejects altered immutable dispatch identity, closed-record resurrection and outcome evidence',async()=>{
  const x=fixture({execute:()=>success});
  try{x.submit('bob');await x.c.owner.runCycle();const original=x.read().envelope;
    for(const mutate of [e=>{Object.values(e.coordination.attempts)[0].generation++;},e=>{Object.values(e.coordination.attempts)[0].state='dispatched';},e=>{e.coordination_history.at(-1).evidence.generation++;},e=>{e.coordination_history.at(-1).evidence.classification='uncertain';}]){const bad=structuredClone(original);mutate(bad);assert.throws(()=>reduceCoordinationTrace(bad));}
  }finally{x.cleanup();}
});
test('checked invocation is not atomic remote effect: delayed old request, downstream generation fence and stable-key mismatch/dedupe',async()=>{
  let maxGeneration=0,effects=0;const receipts=new Map(),entered=deferred(),deliver=deferred();
  const service=(context,payload)=>{const c=context.coordination;if(c.generation<maxGeneration)throw Error('DOWNSTREAM_STALE');maxGeneration=Math.max(maxGeneration,c.generation);const previous=receipts.get(c.idempotency_key);if(previous){if(previous.payload!==payload)throw Error('IDEMPOTENCY_MISMATCH');return previous.result;}effects++;receipts.set(c.idempotency_key,{payload,result:success});return success;};
  const contexts=[];
  const x=fixture(null,{router:{fallback:{execution_context:'chord.execution-context.v2',adapter:{async execute(p,c){contexts.push(c);entered.resolve();await deliver.promise;return service(c,'same-business-payload');}}}}});let next;
  try{x.submit('bob');const oldCycle=x.c.owner.runCycle();await entered.promise;assert.equal(effects,0); // final check passed and callable actually entered
    x.f.time=30100;next=x.open({fallback:{execution_context:'chord.execution-context.v2',adapter:{execute(p,c){contexts.push(c);return service(c,'same-business-payload');}}}});
    next.owner.acquire({expectedRevision:next.observer.inspect().revision});assert.equal(effects,0);reconcile(next,x.f.packets.bob.task_id);await next.owner.runCycle();assert.equal(effects,1);
    const before=raw(x.f.path);deliver.resolve();await assert.rejects(oldCycle,code('OWNER_LOST'));assert.deepEqual(raw(x.f.path),before);assert.equal(effects,1);
    assert.deepEqual(service(contexts[1],'same-business-payload'),success);assert.equal(effects,1);assert.throws(()=>service(contexts[1],'changed-business-payload'),/IDEMPOTENCY_MISMATCH/);assert.throws(()=>service(contexts[0],'same-business-payload'),/DOWNSTREAM_STALE/);
    // A distinct cooperating service that has NOT observed the new generation
    // may still accept the old generation. Token transport is not revocation.
    let otherHighest=0,otherEffects=0;const old=contexts[0].coordination;assert.ok(old.generation>=otherHighest);otherHighest=old.generation;otherEffects++;assert.equal(otherEffects,1);
  }finally{next?.owner.close();x.cleanup();}
});

test('grant expiry at final SQL claim sample reauthorizes before commit/call',async()=>{
  let calls=0;const x=fixture({execute:()=>{calls++;return success;}});
  try{x.submit('bob');const a=x.read().envelope.registry.authority;a.authority_revision++;for(const g of a.grants)if(g.actor_id==='bob'&&g.capability==='work')g.expires_at=150;x.c.admin.setAuthoritySnapshot(a,{expectedRevision:x.read().revision});
    const before=raw(x.f.path);x.f.samples=[100,100,150];await assert.rejects(x.c.owner.runCycle(),code('NO_ALLOW_GRANT'));assert.equal(calls,0);assert.deepEqual(raw(x.f.path),before);
  }finally{x.cleanup();}
});
test('empty claim is an exact replayable no-effect transition; malformed runtime records reject',()=>{
  const f=actorFixture();try{
    const r=f.store.load().envelope.registry;r.run.revision++;
    const saved=f.store.commit({expectedRevision:r.run.revision-1,credential:f.token,change:{kind:'runtime_claim',nextRegistry:r,dispatch:null}});assert.equal(saved.result.dispatch,null);assert.deepEqual(reduceCoordinationTrace(f.store.load().envelope),f.store.load().envelope);
    const before=raw(f.path);assert.throws(()=>f.store.commit({expectedRevision:saved.revision,credential:f.token,change:{kind:'runtime_claim',nextRegistry:r,dispatch:null,extra:true}}));assert.deepEqual(raw(f.path),before);
    f.time=30100;assert.throws(()=>f.store.commit({expectedRevision:saved.revision,credential:null,change:{kind:'acquire',owner_id:randomUUID()}}),code('OWNER_LOST'));assert.deepEqual(raw(f.path),before);
  }finally{f.cleanup();}
});
test('no-adapter and denied/no-work cycles do not create retries/diagnostics or release callables',async()=>{
  const x=fixture(null);try{x.submit('bob');const before=raw(x.f.path);assert.equal((await x.c.owner.runCycle()).code,'no_adapter');assert.deepEqual(raw(x.f.path),before);const r=x.read().envelope.registry;r.run.revision++;r.run.state='paused';x.c.admin.commitRun({expectedRevision:x.read().revision,nextRegistry:r});const paused=raw(x.f.path);await assert.rejects(x.c.owner.runCycle(),code('RUN_NOT_ACTIVE'));assert.deepEqual(raw(x.f.path),paused);}finally{x.cleanup();}
});

test('same owner generation: reconcile/readmit/new active attempt rejects BOTH old callbacks before mutation',async()=>{
  for(const throws of [false,true]){
    const old=deferred(),fresh=deferred();let calls=0;const x=fixture({execute:()=>++calls===1?old.promise:fresh.promise});
    try{x.submit('bob');const oldCycle=x.c.owner.runCycle(),id=x.f.packets.bob.task_id;const r=x.read().envelope.registry;r.run.revision++;r.tasks[id].status='uncertain';r.task_queue.find(q=>q.task_id===id).status='uncertain';delete r.active_attempts[id];r.operations[r.tasks[id].operation_id].state='unknown';x.c.admin.commitRun({expectedRevision:x.read().revision,nextRegistry:r});reconcile(x.c,id);const newCycle=x.c.owner.runCycle();assert.equal(calls,2);const before=raw(x.f.path);if(throws)old.reject(Error('old'));else old.resolve(success);await assert.rejects(oldCycle,code('STALE_ATTEMPT'));assert.deepEqual(raw(x.f.path),before);fresh.resolve(success);assert.equal((await newCycle).result.classification,'result');assert.equal(x.read().envelope.registry.execution_results.length,1);
    }finally{x.cleanup();}
  }
});
test('host maintenance cannot invent unfenced running work or readmit unknown without reconciliation',async()=>{
  const wait=deferred(),x=fixture({execute:()=>wait.promise});let next;
  try{x.submit('bob');const original=x.read().envelope.registry;original.run.revision++;original.tasks[x.f.packets.bob.task_id].status='running';const before=raw(x.f.path);assert.throws(()=>x.c.admin.commitRun({expectedRevision:x.read().revision,nextRegistry:original}),code('STALE_ATTEMPT'));assert.deepEqual(raw(x.f.path),before);
    const cycle=x.c.owner.runCycle();x.f.time=30100;next=x.open();next.owner.acquire({expectedRevision:next.observer.inspect().revision});const r=next.observer.inspect().envelope.registry;r.run.revision++;const id=x.f.packets.bob.task_id;r.tasks[id].status='queued';r.task_queue.find(q=>q.task_id===id).status='queued';r.operations[r.tasks[id].operation_id].state='requested';const quarantined=raw(x.f.path);assert.throws(()=>next.admin.commitRun({expectedRevision:quarantined.revision,nextRegistry:r}),code('RECONCILIATION_REQUIRED'));assert.deepEqual(raw(x.f.path),quarantined);wait.resolve(success);await assert.rejects(cycle,code('OWNER_LOST'));
  }finally{next?.owner.close();x.cleanup();}
});
