import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { actorFixture } from './fixtures/coordinated-actors.js';
import { reduceCoordinationTrace } from '../src/coordination/history.js';
import { ActorCommand, TrustedBinding, CoordinationPolicy, CommandReceipt, receiptKey, subjectOf, increment } from '../src/coordination/contracts.js';
import { createActorIngress, openCoordinatedSqliteStore } from '../src/index.js';
const raw = f => {const db = new DatabaseSync(f.path);try{return db.prepare('SELECT * FROM chord_coordination').get();}finally{db.close();}};
const ok = response => {assert.equal(response.ok,true,JSON.stringify(response));return response.result;};
const denied = (f,actor,command,code) => {const before = raw(f), response = f.send(actor,command);assert.equal(response.code,code,JSON.stringify(response));assert.equal(response.commit_status,'not_committed');assert.deepEqual(raw(f),before);return response;};
const propose = f => f.command('propose_handoff',{task_id:f.packets.alice.task_id,to_actor_id:'bob',payload:{artifact:'review-only'},expires_at:f.time+5000});
const approval = f => f.command('request_approval',{task_id:f.packets.alice.task_id,reason:'human review',expires_at:f.time+5000});
function setup() {const f=actorFixture();ok(f.submit('alice'));f.policy();return f;}

test('exact SigilJS actor/policy/binding/receipt shapes, descriptor safety and canonical tuple identity',()=>{
 const f=actorFixture();try {
  const cmd=f.command('submit_work',{packets:[f.packets.alice]}); ActorCommand.assert(cmd); TrustedBinding.assert(f.bindings.alice);
  for(const key of ['principal_id','actor_id','grants','capability','owner_id','generation','now','path','method']) assert.throws(()=>ActorCommand.assert({...cmd,[key]:'forged'}));
  assert.throws(()=>ActorCommand.assert({...cmd,expected_revision:null})); assert.throws(()=>ActorCommand.assert({...cmd,payload:{...cmd.payload,issueGrants:[]}}));
  let getters=0; const value={...cmd};Object.defineProperty(value,'payload',{enumerable:true,get(){getters++;return {};}});assert.throws(()=>ActorCommand.assert(value));assert.equal(getters,0);
  assert.throws(()=>TrustedBinding.assert({...f.bindings.alice,principal_id:'constructor'}));
  assert.throws(()=>CoordinationPolicy.assert({policy_revision:1,handoffs:[{rule_id:'bad',from_actor_id:'alice',to_actor_id:'bob',scope:{},actions:['accept'],max_ttl_ms:30001}],approvals:[]}));
  const s=subjectOf(f.bindings.alice), key=receiptKey(s,'x'); assert.deepEqual(JSON.parse(key),[s.issuer,s.binding_id,s.principal_id,s.actor_id,s.run_id,s.incarnation_id,'x']);
  assert.notEqual(key,receiptKey({...s,binding_id:'other'},'x'));assert.throws(()=>increment(Number.MAX_SAFE_INTEGER));
  const result=f.send('alice',cmd);ok(result);const receipt=Object.values(f.store.load().envelope.coordination.commands)[0];CommandReceipt.assert(receipt);assert.throws(()=>CommandReceipt.assert({...receipt,response:{...receipt.response,revision:99}}));
 } finally {f.cleanup();}
});

test('atomic work admission and exact durable response receipts before stale revision; mismatch and foreign bindings',()=>{
 const f=actorFixture();try {
  const cmd=f.command('submit_work',{packets:[f.packets.alice]});const response=f.send('alice',cmd);ok(response);ok(f.submit('bob'));
  const before=raw(f);assert.deepEqual(f.send('alice',JSON.parse(JSON.stringify(cmd))),response);assert.deepEqual(raw(f),before);
  denied(f,'alice',{...cmd,expected_revision:f.store.load().revision},'OPERATION_ID_MISMATCH');denied(f,'alice',{...cmd,correlation_id:'changed'},'OPERATION_ID_MISMATCH');
  denied(f,'bob',cmd,'STALE_REVISION');
  const sameId=f.command('submit_work',{packets:[f.packets.human]},f.store.load().revision,cmd.operation_id);ok(f.send('human',sameId));assert.equal(Object.keys(f.store.load().envelope.coordination.commands).length,3);
  const snapshot=f.store.load();assert.deepEqual(reduceCoordinationTrace(snapshot.envelope),snapshot.envelope);assert.equal(snapshot.commitId,Object.values(snapshot.envelope.coordination.commands).at(-1).response.commit_id);
 }finally{f.cleanup();}
});

test('fresh out-of-band auth on every write/read/duplicate; payload identity and authority cannot authenticate',()=>{
 const f=actorFixture();try {
  const cmd=f.command('submit_work',{packets:[f.packets.alice]});ok(f.send('alice',cmd));const calls=f.authCalls;
  f.sessions.delete('alice');denied(f,'alice',cmd,'HOST_UNAUTHENTICATED');denied(f,'alice',f.command('project_context',{}),'HOST_UNAUTHENTICATED');assert.equal(f.authCalls,calls+2);
  denied(f,'bob',{...cmd,principal_id:'p-alice'},'INVALID_COMMAND');denied(f,'bob',{...cmd,run_id:'foreign'},'RUN_MISMATCH');denied(f,'bob',{...cmd,incarnation_id:randomUUID()},'INCARNATION_MISMATCH');
  f.sessions.set('alice',{...f.bindings.alice,issuer:'forged'});denied(f,'alice',cmd,'FORBIDDEN');
  f.sessions.set('alice',{...f.bindings.alice,expires_at:f.time});denied(f,'alice',cmd,'HOST_UNAUTHENTICATED');
  f.sessions.set('alice',f.bindings.alice);assert.deepEqual(f.send('alice',cmd).ok,true);
 }finally{f.cleanup();}
});

test('zero-write filtered context/outcomes, no foreign task metadata and no private receipt/history export',()=>{
 const f=actorFixture();try {
  ok(f.submit('alice'));ok(f.submit('bob'));const before=raw(f);
  const a=ok(f.send('alice',f.command('project_context',{}))),b=ok(f.send('bob',f.command('project_context',{})));
  assert.deepEqual(a.context.tasks.map(t=>t.task_id),[f.packets.alice.task_id]);assert.deepEqual(b.context.tasks.map(t=>t.task_id),[f.packets.bob.task_id]);
  const outcomes=ok(f.send('bob',f.command('observe_outcomes',{task_ids:[f.packets.alice.task_id,'missing',f.packets.bob.task_id]}))).outcomes;
  assert.equal(outcomes.length,1);assert.equal(outcomes[0].operation_state,'requested');assert.equal(outcomes[0].last_result,null);assert.deepEqual(raw(f),before);
  denied(f,'bob',f.command('project_context',{},0),'STALE_REVISION');denied(f,'bob',f.command('exportEnvelope',{}),'INVALID_COMMAND');
  for(const value of ['ownercredential','binding_subject','envelope_json','authority_snapshot']) assert.equal(JSON.stringify(a).includes(value),false);
 }finally{f.cleanup();}
});

test('policy fenced exact-next installation, no implicit rule, conflict scope and current permissions',()=>{
 const f=actorFixture();try {
  ok(f.submit('alice'));denied(f,'alice',propose(f),'POLICY_DENIED');f.policy();
  const before=raw(f);assert.throws(()=>f.policy(1),e=>e.code==='STALE_REVISION');assert.deepEqual(raw(f),before);
  const p=f.store.load().envelope.coordination.policy;const conflicting={...p,policy_revision:2,handoffs:[...p.handoffs,{...p.handoffs[0],rule_id:'ambiguous'}]};
  assert.throws(()=>f.admin('coordination_policy',()=>{},conflicting),e=>e.code==='POLICY_CONFLICT');assert.deepEqual(raw(f),before);
  assert.throws(()=>f.policy(2,{handoffs:[{...p.handoffs[0],scope:{...p.handoffs[0].scope,phase:'foreign'}}]}),e=>e.code==='SCOPE_MISMATCH');assert.deepEqual(raw(f),before);
  const h=ok(f.send('alice',propose(f)));assert.ok(h.handoff_id);
 }finally{f.cleanup();}
});

test('handoff both parties authorization, recipient-only response and visibility independent of execute grants',()=>{
 const f=setup();try {
  const proposal=propose(f), response=f.send('alice',proposal), h=ok(response).handoff_id;
  const view=ok(f.send('bob',f.command('project_context',{})));assert.equal(view.context.tasks.length,0);assert.equal(view.handoffs[0].handoff_id,h);
  assert.equal(ok(f.send('foreign',f.command('project_context',{}))).handoffs.length,0);
  denied(f,'foreign',f.command('respond_handoff',{handoff_id:h,action:'accept',reason:null}),'FORBIDDEN');
  denied(f,'alice',f.command('respond_handoff',{handoff_id:h,action:'accept',reason:null}),'FORBIDDEN');
  denied(f,'bob',f.command('respond_handoff',{handoff_id:h,action:'accept',reason:null},0),'STALE_REVISION');
  const beforeBinding=f.store.load().envelope.registry.tasks[f.packets.alice.task_id].authority_binding;
  const cmd=f.command('respond_handoff',{handoff_id:h,action:'accept',reason:'reviewed'}), accepted=f.send('bob',cmd);assert.equal(ok(accepted).status,'accepted');
  const before=raw(f);assert.deepEqual(f.send('bob',cmd),accepted);assert.deepEqual(raw(f),before);assert.deepEqual(f.send('alice',proposal),response);
  denied(f,'bob',f.command('respond_handoff',{handoff_id:h,action:'reject',reason:null}),'HANDOFF_RESOLVED');
  const e=f.store.load().envelope;assert.deepEqual(e.registry.tasks[f.packets.alice.task_id].authority_binding,beforeBinding);assert.equal(Object.keys(e.coordination.attempts).length,0);assert.deepEqual(reduceCoordinationTrace(e),e);
  const outcome=ok(f.send('bob',f.command('observe_outcomes',{task_ids:[f.packets.alice.task_id,'unknown']}))).outcomes[0];assert.equal(outcome.handoffs[0].status,'accepted');assert.equal(Object.hasOwn(outcome,'last_result'),false);
  assert.throws(()=>f.admin('host_commit',r=>{r.handoffs[h].status='rejected';}),e=>e.code==='FORBIDDEN');
 }finally{f.cleanup();}
});

test('handoff current grant deny/revocation/expiry and policy revision invalidate responses with zero writes',()=>{
 for(const variant of ['deny','revoked','expiry','policy','action']) {
  const f=setup();try {
   const h=ok(f.send('alice',propose(f))).handoff_id;
   if(variant==='expiry') f.time+=5000;
   else if(variant==='policy' || variant==='action') {const p=f.store.load().envelope.coordination.policy;f.policy(2,variant==='action'?{handoffs:[{...p.handoffs[0],actions:['reject']}]}:{});}
   else f.admin('authority_snapshot',r=>{r.authority.authority_revision++;const g=r.authority.grants.find(g=>g.actor_id==='alice'&&g.capability==='chord.handoff.propose');if(variant==='deny')r.authority.grants.push({...g,grant_id:'denied',effect:'deny'});else g.revoked_at=f.time;});
   denied(f,'bob',f.command('respond_handoff',{handoff_id:h,action:'accept',reason:null}),({deny:'EXPLICIT_DENY',revoked:'NO_ALLOW_GRANT',expiry:'HANDOFF_EXPIRED',policy:'POLICY_STALE',action:'POLICY_DENIED'})[variant]);
   // Visibility is the viewer's current scope permission, not permission to
   // mutate on behalf of a now-revoked/denied counterparty.
   assert.equal(ok(f.send('bob',f.command('project_context',{}))).handoffs[0].handoff_id,h);
  }finally{f.cleanup();}
 }
});

test('approval request pauses exact pending attempt; self/service forgery denied; authenticated human approval resumes without dispatch',()=>{
 const f=setup();try {
  const request=approval(f), response=f.send('alice',request), a=ok(response);let e=f.store.load().envelope;
  assert.equal(e.registry.run.state,'paused');assert.equal(e.registry.pending_attempts[f.packets.alice.task_id].attempt_id,a.attempt_id);assert.equal(e.registry.authority.approvals.length,0);
  denied(f,'alice',approval(f),'APPROVAL_REQUEST_EXISTS');
  const p={approval_request_id:a.approval_request_id,decision:'approve',reason:null};
  denied(f,'alice',f.command('respond_approval',p),'FORBIDDEN');denied(f,'bob',f.command('respond_approval',p),'FORBIDDEN');denied(f,'human2',f.command('respond_approval',p),'FORBIDDEN');
  const cmd=f.command('respond_approval',p), approved=f.send('human',cmd);assert.equal(ok(approved).run_state,'active');
  const before=raw(f);assert.deepEqual(f.send('human',cmd),approved);assert.deepEqual(f.send('alice',request),response);assert.deepEqual(raw(f),before);
  e=f.store.load().envelope;const grant=e.registry.authority.approvals[0];assert.equal(grant.approver_principal_id,'p-human');assert.equal(grant.attempt_id,a.attempt_id);assert.equal(grant.consumed_by_attempt_id,null);assert.equal(e.registry.authority.authority_revision,1);assert.equal(Object.keys(e.registry.active_attempts).length,0);assert.equal(Object.keys(e.coordination.attempts).length,0);assert.deepEqual(reduceCoordinationTrace(e),e);
  denied(f,'human',f.command('respond_approval',p),'APPROVAL_REQUEST_RESOLVED');
 }finally{f.cleanup();}
});

test('approval reject records kernel approval and fails run; current revocation, policy, expiry, attempt guards',()=>{
 for(const variant of ['reject','expiry','revoke','policy','attempt','task-revision']) {
  const f=setup();try {
   const a=ok(f.send('alice',approval(f)));
   if(variant==='expiry') f.time+=5000;
   if(variant==='revoke') f.admin('authority_snapshot',r=>{r.authority.authority_revision++;r.authority.actors.find(a=>a.actor_id==='alice').revoked_at=f.time;});
   if(variant==='policy') f.policy(2);
   if(variant==='attempt') f.admin('invalidate_attempt',r=>{delete r.pending_attempts[f.packets.alice.task_id];});
   if(variant==='task-revision') f.admin('prepare_attempt',r=>{r.pending_attempts[f.packets.alice.task_id].task_revision=1;});
   const command=f.command('respond_approval',{approval_request_id:a.approval_request_id,decision:variant==='reject'?'reject':'approve',reason:'review'});
   if(variant==='reject') {const result=ok(f.send('human',command));assert.equal(result.status,'rejected');assert.equal(result.run_state,'failed');assert.equal(f.store.load().envelope.registry.authority.approvals[0].decision,'rejected');}
   else denied(f,'human',command,({expiry:'APPROVAL_REQUEST_EXPIRED',revoke:'FORBIDDEN',policy:'POLICY_STALE',attempt:'STALE_ATTEMPT','task-revision':'STALE_ATTEMPT'})[variant]);
  }finally{f.cleanup();}
 }
});

test('duplicate reauthorization rejects revoked subject; original receipt remains immutable',()=>{
 const f=actorFixture();try {
  const cmd=f.command('submit_work',{packets:[f.packets.alice]});ok(f.send('alice',cmd));
  const receipt=Object.values(f.store.load().envelope.coordination.commands)[0];
  f.admin('authority_snapshot',r=>{r.authority.authority_revision++;r.authority.grants.find(g=>g.actor_id==='alice'&&g.capability==='work').revoked_at=f.time;});
  denied(f,'alice',cmd,'NO_ALLOW_GRANT');assert.deepEqual(Object.values(f.store.load().envelope.coordination.commands)[0],receipt);
 }finally{f.cleanup();}
});

test('combined replay rejects forged response, detached receipt replacement, command evidence, domain/policy deltas',()=>{
 const f=setup();try {
  const h=ok(f.send('alice',propose(f))).handoff_id;ok(f.send('bob',f.command('respond_handoff',{handoff_id:h,action:'reject',reason:null})));
  const original=f.store.load().envelope;
  const changes=[e=>{Object.values(e.coordination.commands)[0].response.result.task_ids=['foreign'];},e=>{e.coordination_history.at(-1).evidence.grant_ids=['fabricated'];},e=>{e.registry.handoffs[h].status='accepted';},e=>{e.coordination.policy.policy_revision++;},e=>{e.coordination_history.splice(2,1);}];
  for(const change of changes){const e=structuredClone(original);change(e);assert.throws(()=>reduceCoordinationTrace(e));}
  assert.deepEqual(reduceCoordinationTrace(original),original);
 }finally{f.cleanup();}
});

test('work batch authorization atomic, operation signature quarantine, SQL rollback and final auth-time check',()=>{
 const f=actorFixture();try {
  denied(f,'alice',f.command('submit_work',{packets:[f.packets.alice,f.packets.bob]}),'NO_ALLOW_GRANT');assert.equal(Object.keys(f.store.load().envelope.registry.tasks).length,0);
  const exec=DatabaseSync.prototype.exec, before=raw(f);DatabaseSync.prototype.exec=function(sql){if(sql==='COMMIT')throw Error('fault');return exec.call(this,sql);};
  let response;try{response=f.submit('alice');}finally{DatabaseSync.prototype.exec=exec;}
  assert.equal(response.code,'COMMIT_OUTCOME_UNKNOWN');assert.equal(response.commit_status,'unknown');assert.deepEqual(raw(f),before);
 }finally{f.cleanup();}
 const g=actorFixture();try {
  const cmd=g.command('submit_work',{packets:[g.packets.alice]});ok(g.send('alice',cmd));
  const copy={...g.packets.alice,task_id:'new-id'};
  g.admin('authority_snapshot',r=>{r.authority.authority_revision++;const grant=r.authority.grants.find(g=>g.actor_id==='alice'&&g.capability==='work');r.authority.grants.push({...grant,grant_id:'new-task',scope:{...grant.scope,task_id:'new-id',resource:{kind:'task',id:'new-id'}}});});
  denied(g,'alice',g.command('submit_work',{packets:[copy]}),'OPERATION_EXISTS');
 }finally{g.cleanup();}
});

test('standby actor writes cannot adopt token; observer reads do not acquire/recover; runtime branches remain closed',()=>{
 const f=actorFixture();let observer;try {
  observer=openCoordinatedSqliteStore({path:f.path,mode:'existing',expectedIdentity:f.identity,clock:f.clock});
  const gateway=createActorIngress({clock:f.clock,authenticate:()=>f.bindings.alice,load:()=>observer.load(),commitCommand:(binding,command)=>observer.commit({expectedRevision:command.expected_revision,credential:null,change:{kind:'actor_command',binding,command}}).result});
  const before=raw(f);assert.equal(gateway.handleAuthenticated({},JSON.stringify(f.command('submit_work',{packets:[f.packets.alice]}))).code,'NOT_OWNER');assert.deepEqual(raw(f),before);
  assert.equal(gateway.handleAuthenticated({},JSON.stringify(f.command('project_context',{}))).ok,true);assert.deepEqual(raw(f),before);
  for(const kind of ['runtime_claim','runtime_outcome'])assert.throws(()=>f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind}}),e=>e.code==='UNSUPPORTED_OPERATION');
  const command=f.command('submit_work',{packets:[f.packets.alice]});ok(f.send('alice',command));
  f.time=30100;observer.commit({expectedRevision:observer.load().revision,credential:null,change:{kind:'acquire',owner_id:randomUUID()}});
  denied(f,'alice',command,'OWNER_LOST');
 }finally{observer?.close();f.cleanup();}
});

test('two independently authorized humans approve separate tasks; already-paused deadline tightens and partial approval stays paused',()=>{
 const f=actorFixture();try {
  const scope={run_id:f.identity.run_id,project:'project',phase:'build',task_id:f.packets.bob.task_id,target_entity:'bob',resource:{kind:'task',id:f.packets.bob.task_id}};
  f.bindings.bob.work_requires_approval=true;
  f.admin('authority_snapshot',r=>{r.authority.authority_revision++;for(const [actor,capability] of [['bob','chord.approval.request'],['human2','chord.approval.respond']])r.authority.grants.push({grant_id:`two-${actor}`,principal_id:`p-${actor}`,actor_id:actor,capability,effect:'allow',scope,issued_at:0,expires_at:100000,revoked_at:null,requires_approval:false});});
  ok(f.submit('alice'));ok(f.submit('bob'));
  const aliceScope={...scope,task_id:f.packets.alice.task_id,target_entity:'alice',resource:{kind:'task',id:f.packets.alice.task_id}};
  f.policy(1,{approvals:[{rule_id:'alice-human',requesting_actor_id:'alice',approver_actor_id:'human',scope:aliceScope,max_ttl_ms:10000},{rule_id:'bob-human2',requesting_actor_id:'bob',approver_actor_id:'human2',scope,max_ttl_ms:10000}]});
  const a=ok(f.send('alice',approval(f))), b=ok(f.send('bob',f.command('request_approval',{task_id:f.packets.bob.task_id,reason:'second human',expires_at:4100})));
  assert.equal(f.store.load().envelope.registry.approval_pause.expires_at,4100);
  assert.equal(ok(f.send('human',f.command('respond_approval',{approval_request_id:a.approval_request_id,decision:'approve',reason:null}))).run_state,'paused');
  assert.equal(ok(f.send('human2',f.command('respond_approval',{approval_request_id:b.approval_request_id,decision:'approve',reason:null}))).run_state,'active');
  const e=f.store.load().envelope;assert.deepEqual(e.registry.authority.approvals.map(a=>a.approver_principal_id),['p-human','p-human2']);assert.deepEqual(reduceCoordinationTrace(e),e);
 }finally{f.cleanup();}
});

test('fresh final SQL clock sample rechecks attestation and handoff expiry without receipt/floor writes',()=>{
 const f=actorFixture();try {
  const cmd=f.command('submit_work',{packets:[f.packets.alice]});f.sessions.set('alice',{...f.bindings.alice,expires_at:200});f.samples=[100,100,200];
  denied(f,'alice',cmd,'HOST_UNAUTHENTICATED');
 }finally{f.cleanup();}
 const g=setup();try {const cmd=propose(g);g.samples=[100,100,5100];denied(g,'alice',cmd,'HANDOFF_EXPIRED');}finally{g.cleanup();}
});

test('host restart has no authenticated sessions; fresh enrollment plus next owner recovers committed ack-lost receipt exactly',()=>{
 const f=actorFixture();let reopened;try {
  const cmd=f.command('submit_work',{packets:[f.packets.alice]}), exec=DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec=function(sql){const value=exec.call(this,sql);if(sql==='COMMIT')throw Error('after committed ack');return value;};
  let response;try{response=f.send('alice',cmd);}finally{DatabaseSync.prototype.exec=exec;}
  assert.equal(response.code,'COMMIT_OUTCOME_UNKNOWN');assert.equal(response.commit_status,'unknown');
  reopened=openCoordinatedSqliteStore({path:f.path,mode:'existing',expectedIdentity:f.identity,clock:f.clock});
  const recorded=Object.values(reopened.load().envelope.coordination.commands)[0].response;
  let token=null;const sessions=new Map();
  const gateway=createActorIngress({clock:f.clock,authenticate:channel=>sessions.get(channel)||null,load:()=>reopened.load(),commitCommand:(binding,command)=>reopened.commit({expectedRevision:command.expected_revision,credential:token,change:{kind:'actor_command',binding,command}}).result});
  const channel={};const before=raw(f);assert.equal(gateway.handleAuthenticated(channel,JSON.stringify(cmd)).code,'HOST_UNAUTHENTICATED');assert.deepEqual(raw(f),before);
  f.time=30100;token=reopened.commit({expectedRevision:reopened.load().revision,credential:null,change:{kind:'acquire',owner_id:randomUUID()}}).result.credential;
  sessions.set(channel,{...f.bindings.alice,authenticated_at:f.time});const committed=raw(f);
  assert.deepEqual(gateway.handleAuthenticated(channel,JSON.stringify(cmd)),recorded);assert.deepEqual(raw(f),committed);assert.equal(recorded.owner.generation,1);assert.equal(token.generation,2);
 }finally{reopened?.close();f.cleanup();}
});

test('bounded JSON framing and host reentrancy reject before canonical mutation',()=>{
 const f=actorFixture();try {
  const before=raw(f);
  for(const frame of ['{','{} {}','[]',JSON.stringify({...f.command('project_context',{}),method:'setAuthoritySnapshot'})])assert.equal(f.ingress.handleAuthenticated('alice',frame).ok,false);
  assert.equal(f.ingress.handleAuthenticated('alice',' '.repeat(1048577)).code,'LIMIT_EXCEEDED');assert.deepEqual(raw(f),before);
  let ingress, inner;
  ingress=createActorIngress({clock:f.clock,load:()=>f.store.load(),commitCommand:()=>{throw Error('never');},authenticate:()=>{inner=ingress.handleAuthenticated('alice','{}');return f.bindings.alice;}});
  assert.equal(ingress.handleAuthenticated('alice',JSON.stringify(f.command('project_context',{}))).ok,true);assert.equal(inner.code,'REENTRANT_MUTATION');assert.deepEqual(raw(f),before);
 }finally{f.cleanup();}
});

async function childPeer(runtime,f,actor) {
 const child=fork(new URL('./actor-ingress-worker.js',import.meta.url),[],{execPath:runtime,stdio:['pipe','pipe','pipe','ipc'],serialization:'json'});
 let stderr='';child.stderr.on('data',b=>{stderr+=b;});
 const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
 const next=async()=>{const r=await lines.next();assert.equal(r.done,false,stderr);const value=JSON.parse(r.value);assert.equal(value.pid,child.pid);return value;};
 const ready=await next();assert.deepEqual(ready.api,['sendCommand','close']);assert.deepEqual(ready.argv,[]);
 // Explicit trusted test host enrollment after independently selecting launch
 // configuration/identity. This attests human channels, not a real human login.
 f.sessions.set(child,f.bindings[actor]);const attached=f.ingress.attachChild(child);
 return {child,async send(command){child.stdin.write(JSON.stringify({command})+'\n');return (await next()).response;},async raw(raw){child.stdin.write(JSON.stringify({raw})+'\n');return (await next()).response;},async close(){attached.detach();f.sessions.delete(child);child.stdin.end(JSON.stringify({close:true})+'\n');await new Promise((resolve,reject)=>{child.once('exit',code=>code===0?resolve():reject(Error(stderr)));});}};
}

test('actual concurrently alive actor children: all four Node/Bun IPC pairs, spoof/foreign binding/context/handoff/approval/outcomes and fresh reattestation',{timeout:60000},async t=>{
 const node='/home/d/.volta/tools/image/node/24.22.1/bin/node',bun='/home/d/.bun/bin/bun';
 for(const [ra,rb] of [[node,node],[node,bun],[bun,node],[bun,bun]]) {
  const f=actorFixture();let a,b,human;try {
   a=await childPeer(ra,f,'alice');b=await childPeer(rb,f,'bob');assert.notEqual(a.child.pid,b.child.pid);assert.equal(a.child.exitCode,null);assert.equal(b.child.exitCode,null);
   let ca=f.command('submit_work',{packets:[f.packets.alice]}), cb=f.command('submit_work',{packets:[f.packets.bob]});
   const raced=await Promise.all([a.send(ca),b.send(cb)]);assert.equal(raced.filter(r=>r.ok).length,1);assert.equal(raced.find(r=>!r.ok).code,'STALE_REVISION');assert.equal(f.store.load().revision,3);assert.equal(Object.keys(f.store.load().envelope.coordination.commands).length,1);
   // The losing actor explicitly observes/replans under a NEW operation ID;
   // neither ingress nor the store silently retries its original envelope.
   let accepted=raced[0];
   if(!accepted.ok){ca=f.command('submit_work',{packets:[f.packets.alice]});accepted=await a.send(ca);}
   if(!raced[1].ok){cb=f.command('submit_work',{packets:[f.packets.bob]});ok(await b.send(cb));}
   ok(accepted);f.policy();
   const before=raw(f);assert.deepEqual(await a.send(ca),accepted);assert.deepEqual(raw(f),before);
   assert.equal((await b.raw(JSON.stringify({...f.command('project_context',{}),principal_id:'p-alice'}))).code,'INVALID_COMMAND');assert.deepEqual(raw(f),before);
   assert.equal((await b.send(f.command('project_context',{}))).result.context.tasks[0].task_id,f.packets.bob.task_id);
   const h=ok(await a.send(propose(f))).handoff_id;const context=ok(await b.send(f.command('project_context',{})));assert.equal(context.handoffs[0].handoff_id,h);assert.equal(context.context.tasks.length,1);
   assert.equal(ok(await b.send(f.command('respond_handoff',{handoff_id:h,action:'accept',reason:'child review'}))).status,'accepted');
   const ar=ok(await a.send(approval(f)));assert.equal((await b.send(f.command('respond_approval',{approval_request_id:ar.approval_request_id,decision:'approve',reason:null}))).code,'FORBIDDEN');
   const outcomes=ok(await b.send(f.command('observe_outcomes',{task_ids:[f.packets.alice.task_id,'missing']}))).outcomes;assert.equal(outcomes[0].handoffs[0].status,'accepted');assert.equal(Object.hasOwn(outcomes[0],'last_result'),false);
   f.sessions.delete(a.child);assert.equal((await a.send(ca)).code,'HOST_UNAUTHENTICATED');f.sessions.set(a.child,f.bindings.alice);assert.deepEqual(await a.send(ca),accepted);
   // A third dedicated channel is freshly host-attested as human. This is a
   // test enrollment assertion, not authentication inferred from JSON/kind.
   human=await childPeer(rb,f,'human');assert.equal(ok(await human.send(f.command('respond_approval',{approval_request_id:ar.approval_request_id,decision:'approve',reason:null}))).run_state,'active');
   assert.deepEqual(reduceCoordinationTrace(f.store.load().envelope),f.store.load().envelope);
   t.diagnostic(JSON.stringify({pair:[ra,rb],pids:[a.child.pid,b.child.pid,human.child.pid],revision:f.store.load().revision,receiptCount:Object.keys(f.store.load().envelope.coordination.commands).length}));
  }finally{if(a)await a.close();if(b)await b.close();if(human)await human.close();f.cleanup();}
 }
});
