import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorFixture } from './fixtures/coordinated-actors.js';
import { createCoordinatedChord, createChord } from '../src/index.js';
import { installHost, queueOptions } from './fixtures/host.js';
import { createIntentTaskPacket } from '../src/execution/task-packets.js';
import { reduceCoordinationTrace } from '../src/coordination/history.js';
import { prepareAttemptRecord, invalidatePendingAttempt, activatePendingAttempt, clearActiveAttempt } from '../src/platform/attempts.js';
import { operationFor } from '../src/platform/reconciliation.js';
import { createRegistry, registerSpec } from '../src/registry/registry.js';
import { createAdapterRouter, resolveAdapter } from '../src/platform/adapter-routing.js';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const ids = ['ordinary-a2-task','toString','valueOf','hasOwnProperty'];
const raw = path => { const db = new DatabaseSync(path); try { return db.prepare('SELECT * FROM chord_coordination').get(); } finally { db.close(); } };
const ok = response => { assert.equal(response.ok,true,JSON.stringify(response)); return response.result; };

for (const approval of [false,true]) for (const taskId of ids) test(`accepted identifier ${taskId}, reserved approval ${approval}: ingress, reopen, dispatch, no starvation, replay`,{timeout:60000},async()=>{
  const f=actorFixture(), who=approval?'alice':'bob', calls=[], contexts=[]; let c;
  try {
    const old=f.packets[who].task_id; f.packets[who].task_id=taskId;
    f.admin('authority_snapshot',r=>{r.authority.authority_revision++; for(const g of r.authority.grants) if(g.scope.task_id===old){g.scope.task_id=taskId;g.scope.resource.id=taskId;}});
    const command=f.command('submit_work',{packets:[f.packets[who]]}), response=f.send(who,command);ok(response);
    let before=raw(f.path);
    assert.deepEqual(f.send(who,command),response);assert.deepEqual(raw(f.path),before);
    assert.equal(f.submit(who).code,'INVALID_SEMANTICS');assert.deepEqual(raw(f.path),before);
    if(approval) f.policy(); f.time=101;ok(f.submit('foreign'));
    let reserved=null;
    if(approval){const request=ok(f.send(who,f.command('request_approval',{task_id:taskId,reason:'exact reservation',expires_at:5100})));reserved=request.attempt_id;ok(f.send('human',f.command('respond_approval',{approval_request_id:request.approval_request_id,decision:'approve',reason:null})));}
    assert.equal(Object.hasOwn(f.store.load().envelope.registry.pending_attempts,taskId),approval);
    f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind:'release'}});f.store.close();
    const open=()=>createCoordinatedChord({storage:{path:f.path,mode:'existing',expectedIdentity:f.identity},trustedHost:{clock:f.clock},adapterRouter:{fallback:{execute(p,context){calls.push(p.task_id);contexts.push(context);return {status:'completed',outcome:'succeeded'};}}}});
    c=open();c.owner.acquire({expectedRevision:c.observer.inspect().revision});
    assert.deepEqual(c.observer.replayEnvelope(),c.observer.exportEnvelope());
    assert.equal((await c.owner.runCycle()).result.classification,'result');
    assert.equal((await c.owner.runCycle()).result.classification,'result');
    before=raw(f.path);assert.equal((await c.owner.runCycle()).skipped,true);assert.deepEqual(raw(f.path),before);
    const e=c.observer.exportEnvelope();assert.deepEqual(calls,[taskId,f.packets.foreign.task_id]);assert.equal(e.registry.execution_results.length,2);
    assert.ok(Object.values(e.registry.tasks).every(t=>t.status==='completed'));
    if(approval){assert.equal(contexts[0].attempt_id,reserved);assert.equal(e.registry.authority.approvals[0].consumed_by_attempt_id,reserved);}
    assert.deepEqual(reduceCoordinationTrace(JSON.parse(JSON.stringify(e))),e);
    c.owner.release({expectedRevision:c.observer.inspect().revision});c.owner.close();c=open();
    const reopened=c.observer.exportEnvelope();assert.deepEqual(c.observer.replayEnvelope(),reopened);
    c.owner.acquire({expectedRevision:c.observer.inspect().revision});assert.equal((await c.owner.runCycle()).skipped,true);assert.equal(calls.length,2);
  } finally { c?.owner.close();f.cleanup(); }
});

test('forbidden ID values and own keys retain boundary rejection and complete row equality',()=>{
  const f=actorFixture();try{const before=raw(f.path);for(const id of ['constructor','__proto__','prototype']){
    const response=f.send('bob',f.command('submit_work',{packets:[{...f.packets.bob,task_id:id}]}));
    assert.equal(response.code,'INVALID_COMMAND');assert.equal(response.commit_status,'not_committed');assert.equal(response.operation_id,null);assert.deepEqual(raw(f.path),before);
    const wire=JSON.stringify(f.command('project_context',{})).replace('"payload":{}',`"payload":{${JSON.stringify(id)}:1}`);
    assert.equal(f.ingress.handleAuthenticated('bob',wire).code,'INVALID_COMMAND');assert.deepEqual(raw(f.path),before);
  }}finally{f.cleanup();}
});

test('absent and repeated task IDs preserve filtering, batch duplicate checks and canonical operation uniqueness',()=>{
  const f=actorFixture();try{
    const before=raw(f.path);
    for(const id of ids.slice(1)){
      const read=ok(f.send('bob',f.command('observe_outcomes',{task_ids:[id]})));assert.deepEqual(read.outcomes,[]);
      assert.equal(f.send('bob',f.command('observe_outcomes',{task_ids:[id,id]})).code,'INVALID_COMMAND');
      assert.equal(f.send('bob',f.command('request_approval',{task_id:id,reason:'absent',expires_at:5100})).ok,false);
    }
    assert.deepEqual(raw(f.path),before);
    assert.equal(f.send('bob',f.command('submit_work',{packets:[f.packets.bob,f.packets.bob]})).code,'INVALID_SEMANTICS');assert.deepEqual(raw(f.path),before);
    ok(f.submit('bob'));const after=raw(f.path), old=f.packets.bob.task_id;
    f.packets.bob.task_id='canonical-duplicate';
    f.admin('authority_snapshot',r=>{r.authority.authority_revision++;for(const g of r.authority.grants)if(g.scope.task_id===old){g.scope.task_id='canonical-duplicate';g.scope.resource.id='canonical-duplicate';}});
    const renamed=raw(f.path);assert.equal(f.submit('bob').code,'OPERATION_EXISTS');assert.deepEqual(raw(f.path),renamed);assert.notDeepEqual(after,before);
  }finally{f.cleanup();}
});

for(const taskId of ids) test(`shared legacy attempt helper own-record lifecycle: ${taskId}`,()=>{
  const registry={run:{run_id:'run-a2',schema_version:'chord.contracts.v1'},pending_attempts:{},active_attempts:{},task_queue:[{task_id:taskId,queue_id:'queue-a2'}],tasks:{},operations:{}};
  const task={task_id:taskId};
  assert.equal(invalidatePendingAttempt(registry,taskId),null);assert.equal(clearActiveAttempt(registry,taskId),null);assert.equal(activatePendingAttempt(registry,taskId,7),null);
  assert.equal(operationFor(registry,taskId),null);
  const attempt=prepareAttemptRecord(registry,task);assert.equal(attempt.task_id,taskId);assert.equal(prepareAttemptRecord(registry,task),attempt);
  assert.equal(activatePendingAttempt(registry,taskId,7),attempt);assert.equal(registry.active_attempts[taskId].dispatch_revision,7);assert.equal(Object.hasOwn(registry.pending_attempts,taskId),false);
  assert.equal(clearActiveAttempt(registry,taskId).attempt,attempt);assert.equal(clearActiveAttempt(registry,taskId),null);
  registry.tasks[taskId]={operation_id:'valueOf'};assert.equal(operationFor(registry,taskId),null);
  registry.operations.valueOf={operation_id:'valueOf'};assert.equal(operationFor(registry,taskId),registry.operations.valueOf);
});

test('router own exact entries retain exact/prefix/default/fallback precedence',()=>{
  const exact={},prefix={},fallback={execute(){}};
  for(const id of ids.slice(1)){
    assert.equal(resolveAdapter(createAdapterRouter({exact,prefix,fallback}),id),fallback);
    const adapter={execute(){}};exact[id]=adapter;assert.equal(resolveAdapter(createAdapterRouter({exact,prefix,fallback}),id),adapter);delete exact[id];
  }
  const def={execute(){}},pre={execute(){}};exact.default=def;prefix.to=pre;
  assert.equal(resolveAdapter(createAdapterRouter({exact,prefix,fallback}),'toString'),pre);
  assert.equal(resolveAdapter(createAdapterRouter({exact,prefix,fallback}),'valueOf'),def);
});

test('artifact and domain inherited names initialize own records, JSON round trip remains ordinary data',()=>{
  const r=createRegistry();
  for(const id of ids.slice(1)){
    registerSpec(r,{schema_version:'chord.contracts.v1',spec_type:'HandoffSpec',project:'project',phase:'build',artifact:id,from:'alice',to:['bob'],requested_action:['review']});
    registerSpec(r,{schema_version:'chord.contracts.v1',spec_type:'CoordSpec',project:'project',phase:'build',state:{[id]:'pending'},authority:{[id]:'alice'}});
    assert.equal(Object.hasOwn(r.artifacts,id),true);assert.equal(r.artifacts[id].status,'declared');assert.equal(Object.hasOwn(r.domains,id),true);assert.equal(r.domains[id].state,'pending');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(r)).artifacts,r.artifacts);
});

for(const approval of [false,true]) for(const id of ids) test(`legacy public helper/dispatch boundaries ${id}, approval ${approval}`,async()=>{
  const calls=[];
  const c=createChord({trustedHost:{clock:{now:()=>100}},adapterRouter:{fallback:{execute(p){calls.push(p.task_id);return {status:'completed',outcome:'succeeded',artifact:'toString',domain:'valueOf'};}}}});
  const h=installHost(c,{approvalRequired:approval});
  const packet=createIntentTaskPacket({schema_version:'chord.contracts.v1',spec_type:'IntentSpec',project:'project',phase:'build',target_entity:'worker',do:['work']});packet.task_id=id;
  c.queueTaskPackets([packet],queueOptions(h,{approval_required:approval}));
  assert.throws(()=>c.createApproval({task_id:id,approver_principal_id:h.human_id}),e=>e.code==='INVALID_CONTEXT');
  const a=c.prepareAttempt(id);assert.deepEqual(c.prepareAttempt(id),a);
  if(approval){const value=c.createApproval({task_id:id,approver_principal_id:h.human_id});assert.equal(value.attempt_id,a.attempt_id);const authority=c.getAuthority();authority.authority_revision++;authority.approvals.push(value);c.setAuthoritySnapshot(authority);c.pauseForApproval();c.resumeRun({principal_id:h.human_id,approval_id:value.approval_id});}
  const result=await c.runCycle();assert.equal(result.ok,true);assert.deepEqual(calls,[id]);assert.equal(c.getRegistry().tasks[id].status,'completed');
  assert.equal((await c.runCycle()).skipped,true);assert.equal(calls.length,1);
});

test('coordinated result references distinguish absent inherited names from installed artifact/domain records',{timeout:60000},async()=>{
  for(const present of [false,true]){
    const f=actorFixture();let c;
    try{
      ok(f.submit('bob'));
      if(present)f.admin('host_commit',r=>{r.artifacts.toString={name:'toString',status:'declared',producers:[],consumers:[],project:'project',phase:'build',history:[]};r.domains.valueOf={name:'valueOf',owner:null,delegates:[],state:'pending',project:'project',phase:'build',state_history:[]};});
      f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind:'release'}});f.store.close();
      c=createCoordinatedChord({storage:{path:f.path,mode:'existing',expectedIdentity:f.identity},trustedHost:{clock:f.clock},adapterRouter:{fallback:{execute(){return {status:'completed',outcome:'succeeded',artifact:'toString',domain:'valueOf'};}}}});
      c.owner.acquire({expectedRevision:c.observer.inspect().revision});assert.equal((await c.owner.runCycle()).result.classification,'result');
      const e=c.observer.exportEnvelope();assert.equal(Object.hasOwn(e.registry.artifacts,'toString'),present);assert.equal(Object.hasOwn(e.registry.domains,'valueOf'),present);
      if(present){assert.equal(e.registry.artifacts.toString.status,'accepted');assert.equal(e.registry.domains.valueOf.state,'complete');}
      assert.deepEqual(c.observer.replayEnvelope(),e);
    }finally{c?.owner.close();f.cleanup();}
  }
});

test('legacy caller-authored missing IDs do not become task/approval/operation records',()=>{
  const c=createChord();installHost(c);
  for(const id of ids.slice(1)){
    const before=c.getRegistry();
    for(const action of [()=>c.prepareAttempt(id),()=>c.createApproval({task_id:id,approver_principal_id:'human-approver'}),()=>c.cancelTask(id),()=>c.replayTask(id)])assert.throws(action,e=>e.code==='INVALID_DATA');
    assert.deepEqual(c.getRegistry(),before);
  }
});
