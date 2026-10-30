#!/usr/bin/env node
// Public-export-only, real-process semantic proof. New output directory required.
// node examples/two-process-coordination.mjs OUT [OWNER_RUNTIME] [ACTOR_RUNTIME]
// Output is retained; no dependencies, test fixtures, timers-as-barriers or SQL injection.
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const save = (dir, name, value) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n');
const info = () => ({pid:process.pid, execPath:process.execPath, version:process.versions.bun || process.versions.node, runtime:process.versions.bun ? 'bun' : 'node'});
const success = {status:'completed', outcome:'succeeded', summary:'fenced artifact written'};
export function resolveRuntime(executable) {
  const r = spawnSync(executable, ['-p','process.execPath'], {encoding:'utf8', timeout:10000});
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim(); // Resolve version-manager launcher BEFORE measuring child PID.
}
function child(role, executable, dir, label) {
  const p = fork(script, ['--role',role], {execPath:executable, execArgv:[], stdio:['pipe','pipe','pipe','ipc']});
  const pending = [], messages = []; let failure;
  const dispatch = () => { while (pending.length && (messages.length || failure)) { const w = pending.shift(); clearTimeout(w.timer); failure ? w.reject(failure) : w.resolve(messages.shift()); } };
  p.on('message', m => { messages.push(m); dispatch(); });
  p.on('error', e => { failure=e; dispatch(); });
  p.on('exit', (code, signal) => { failure=Error(`${role} exited ${code}/${signal}`); dispatch(); });
  p.stderr.on('data', b => appendFileSync(join(dir,`${label}.stderr.log`),b));
  if (role !== 'actor') p.stdout.on('data', b => appendFileSync(join(dir,`${label}.stdout.log`),b));
  const next = () => new Promise((resolve,reject) => { const w={resolve,reject}; w.timer=setTimeout(()=>{const i=pending.indexOf(w);if(i>=0)pending.splice(i,1);reject(Error(`${role} watchdog`));},30000); pending.push(w);dispatch(); });
  async function close() {
    if(p.exitCode !== null || p.signalCode !== null) return {code:p.exitCode,signal:p.signalCode};
    const exited=once(p,'exit');
    if (role === 'actor') p.stdin.end(); else if(p.connected) p.send({close:true}); else p.kill('SIGTERM');
    const timer=setTimeout(()=>p.kill('SIGKILL'),3000);
    try { const [code,signal]=await exited;save(dir,`${label}.exit.json`,{pid:p.pid,code,signal});return {code,signal}; } finally { clearTimeout(timer); }
  }
  return {p,next,close};
}
function packet(name) {
  return {schema_version:'chord.contracts.v1',task_id:`task-${name}`,task_kind:'intent_execution',source_type:'IntentSpec',source_spec_id:null,project:'live-proof',phase:'build',target_entity:name,role:'implementer',stance:'strict',requested_action:[`write-${name}`],inputs:{spec:{schema_version:'chord.contracts.v1',spec_type:'IntentSpec',project:'live-proof',phase:'build',target_entity:name,do:[`write-${name}`]},files:[],verify:[],stop:[]},constraints:{dont:[],rules:[],depends:[]}};
}

async function actor() {
  // This role receives no SDK, DB path, credential, binding or grant arguments.
  const {createActorClient} = await import('@antistructured/chord');
  const client=createActorClient();
  process.send({type:'ready',...info(),api:Object.keys(client).sort(),argv:process.argv.slice(2)});
  try {
    for await (const line of createInterface({input:process.stdin})) {
      const {command,raw}=JSON.parse(line);
      let response;
      if(raw){const answer=once(process,'message');process.send(JSON.stringify(command));response=JSON.parse((await answer)[0]);}
      else response=await client.sendCommand(command);
      console.log(JSON.stringify({pid:process.pid,response}));
    }
  } finally { client.close(); if(process.connected)process.disconnect(); }
}
async function standby() {
  const {createCoordinatedChord}=await import('@antistructured/chord');
  process.send({type:'ready',...info()});
  const [m]=await once(process,'message');
  const c=createCoordinatedChord({storage:{path:m.path,mode:'existing',expectedIdentity:m.identity},trustedHost:{clock:{now:()=>100}}});
  try {
    const before=c.observer.exportEnvelope();
    assert.throws(()=>c.owner.acquire({expectedRevision:c.observer.inspect().revision}),e=>e.code==='OWNER_HELD');
    await assert.rejects(c.owner.runCycle(),e=>e.code==='NOT_OWNER');
    assert.deepEqual(c.observer.exportEnvelope(),before);
    process.send({type:'competing-denied',...info(),acquire:'OWNER_HELD',dispatch:'NOT_OWNER',unchanged:true});
    await once(process,'message');
  } finally { c.owner.close(); if(process.connected)process.disconnect(); }
}
async function owner({dir,actorRuntime}) {
  const {createCoordinatedChord}=await import('@antistructured/chord');
  const path=join(dir,'run.sqlite'), clock={now:()=>100};
  let calls=0, effects=0, maxGeneration=0; const downstream=new Map(), contexts=[];
  const adapter={execute(p,context){
    calls++; assert.ok(Object.isFrozen(context.coordination));
    const f=context.coordination;
    assert.equal(f.protocol_version,'chord.execution-context.v2');
    assert.ok(f.generation>=maxGeneration); maxGeneration=f.generation;
    assert.equal(f.idempotency_key,JSON.stringify(['chord.effect.v1',f.incarnation_id,f.run_id,f.operation_id]));
    assert.equal(downstream.has(f.idempotency_key),false);
    // Durable business artifact, not just an adapter-call counter.
    const artifact=`${p.target_entity}: ${p.requested_action.join(',')}\n`;
    writeFileSync(join(dir,`${p.target_entity}.effect.txt`),artifact,{flag:'wx'});
    effects++; downstream.set(f.idempotency_key,artifact); contexts.push(context);
    appendFileSync(join(dir,'effects.ndjson'),JSON.stringify({pid:process.pid,task_id:p.task_id,artifact,context})+'\n');
    return success;
  }};
  const c=createCoordinatedChord({storage:{path,mode:'create',expectedIdentity:null},trustedHost:{clock},adapterRouter:{fallback:{adapter,execution_context:'chord.execution-context.v2'}}});
  const read=()=>c.observer.inspect();
  const identity=read().identity;
  const acquired=c.owner.acquire({expectedRevision:0});
  assert.equal(Object.hasOwn(acquired,'credential'),false);
  const a=packet('alice'), b=packet('bob'), foreign=packet('foreign');
  const scope=p=>({run_id:identity.run_id,project:p.project,phase:p.phase,task_id:p.task_id,target_entity:p.target_entity,resource:{kind:'task',id:p.task_id}});
  const names=['alice','bob','human','foreign'];
  const authority={schema_version:'chord.contracts.v1',run_id:identity.run_id,authority_revision:0,principals:names.map(n=>({principal_id:`p-${n}`,issuer:'proof-host',kind:n==='human'?'human':'service',authenticated_at:0,expires_at:100000})),actors:names.map(n=>({actor_id:n,principal_id:`p-${n}`,kind:n==='human'?'human':'agent',roles:[],capabilities:['work','chord.handoff.propose','chord.handoff.respond','chord.approval.request','chord.approval.respond'],revoked_at:null})),grants:[],approvals:[]};
  const grant=(who,cap,p,approval=false)=>({grant_id:`g-${who}-${cap}-${p.task_id}`,principal_id:`p-${who}`,actor_id:who,capability:cap,effect:'allow',scope:scope(p),issued_at:0,expires_at:100000,revoked_at:null,requires_approval:approval});
  authority.grants.push(grant('alice','work',a,true),grant('bob','work',b),grant('foreign','work',foreign),grant('alice','chord.handoff.propose',a),grant('bob','chord.handoff.respond',a),grant('alice','chord.approval.request',a),grant('human','chord.approval.respond',a));
  c.admin.setAuthoritySnapshot(authority,{expectedRevision:read().revision});
  const binding=n=>({binding_id:`proof-binding-${n}`,issuer:'proof-host',principal_id:`p-${n}`,actor_id:n,...identity,authenticated_at:0,expires_at:100000,work_capability:'work',work_requires_approval:n==='alice'});
  const sessions=new Map(), aliceChannel={}, humanChannel={};
  sessions.set(aliceChannel,binding('alice')); sessions.set(humanChannel,binding('human'));
  let authCalls=0;
  const ingress=c.createActorIngress({authenticate:ch=>{authCalls++;return ch===aliceChannel||ch===humanChannel||ch?.connected ? sessions.get(ch)||null : null;}});
  let sequence=0;
  const cmd=(type,payload,revision=['project_context','observe_outcomes'].includes(type)?null:read().revision)=>({protocol_version:'chord.actor-command.v1',operation_id:`proof-${++sequence}`,...identity,expected_revision:revision,correlation_id:null,causation_id:null,type,payload});
  const host=(ch,type,payload)=>{const response=ingress.handleAuthenticated(ch,JSON.stringify(cmd(type,payload)));assert.equal(response.ok,true,JSON.stringify(response));return response;};
  let actorChild, contender, attachment;
  const trace=[];
  const zero=async(label,fn)=>{const before=read();const result=await fn();assert.deepEqual(read(),before);trace.push({label,response:result,unchanged:true});return result;};
  try {
    actorChild=child('actor',actorRuntime,dir,'actor');
    const ready=await actorChild.next(); assert.equal(ready.pid,actorChild.p.pid);assert.equal(ready.execPath,actorRuntime);assert.deepEqual(ready.api,['close','sendCommand']);assert.deepEqual(ready.argv,['--role','actor']);
    // Bind THIS inherited channel out of band. No identity-selection message exists.
    sessions.set(actorChild.p,binding('bob'));attachment=ingress.attachChild(actorChild.p);
    const lines=createInterface({input:actorChild.p.stdout}); const iterator=lines[Symbol.asyncIterator]();
    const send=async(command,raw=false)=>{actorChild.p.stdin.write(JSON.stringify({command,raw})+'\n');const line=await iterator.next();assert.equal(line.done,false);const answer=JSON.parse(line.value);assert.equal(answer.pid,actorChild.p.pid);trace.push({command,response:answer.response});return answer.response;};
    const good=async(command)=>{const response=await send(command);assert.equal(response.ok,true,JSON.stringify(response));return response;};
    contender=child('standby',process.execPath,dir,'standby');const standbyReady=await contender.next();assert.equal(standbyReady.pid,contender.p.pid);
    contender.p.send({path,identity});const competition=await contender.next();assert.equal(competition.type,'competing-denied');assert.equal(competition.pid,contender.p.pid);
    host(aliceChannel,'submit_work',{packets:[a]});
    c.admin.setCoordinationPolicy({policy_revision:1,handoffs:[{rule_id:'alice-bob',from_actor_id:'alice',to_actor_id:'bob',scope:scope(a),actions:['accept','reject'],max_ttl_ms:10000}],approvals:[{rule_id:'human-review',requesting_actor_id:'alice',approver_actor_id:'human',scope:scope(a),max_ttl_ms:10000}]},{expectedRevision:read().revision});
    const proposal=host(aliceChannel,'propose_handoff',{task_id:a.task_id,to_actor_id:'bob',payload:{review:'verify before writing'},expires_at:10000});
    const context=await good(cmd('project_context',{}));
    assert.equal(context.result.handoffs[0].handoff_id,proposal.result.handoff_id);
    const narrow=await good(cmd('observe_outcomes',{task_ids:[a.task_id,foreign.task_id]}));
    assert.equal(narrow.result.outcomes.length,1);assert.equal(Object.hasOwn(narrow.result.outcomes[0],'last_result'),false);
    const acceptedCommand=cmd('respond_handoff',{handoff_id:proposal.result.handoff_id,action:'accept',reason:'reviewed by independent actor'});
    const accepted=await good(acceptedCommand);assert.equal(accepted.result.status,'accepted');
    assert.deepEqual(await zero('duplicate-handoff',()=>send(acceptedCommand)),accepted);
    const submittedCommand=cmd('submit_work',{packets:[b]});const submitted=await good(submittedCommand);
    assert.deepEqual(await zero('duplicate-submit',()=>send(submittedCommand)),submitted);
    const deny=async(label,command,code)=>{const response=await zero(label,()=>send(command,code==='INVALID_COMMAND'));assert.equal(response.ok,false);assert.equal(response.code,code);};
    await deny('stale-revision',cmd('submit_work',{packets:[foreign]},0),'STALE_REVISION');
    await deny('unauthorized-scope',cmd('submit_work',{packets:[foreign]}),'NO_ALLOW_GRANT');
    await deny('foreign-run',{...cmd('project_context',{}),run_id:'foreign-run'},'RUN_MISMATCH');
    await deny('foreign-incarnation',{...cmd('project_context',{}),incarnation_id:'00000000-0000-4000-8000-000000000001'},'INCARNATION_MISMATCH');
    for(const injected of [{principal_id:'p-alice'},{grants:[]},{sdk:{method:'setAuthoritySnapshot'}},{database:'not-a-real-database.sqlite'},{credential:{generation:1}}]) await deny('actor-authority-injection',{...cmd('project_context',{}),...injected},'INVALID_COMMAND');
    sessions.delete(actorChild.p);
    await deny('unbound-token-not-authentication',cmd('project_context',{}),'HOST_UNAUTHENTICATED');
    sessions.set(actorChild.p,binding('bob'));
    const approval=host(aliceChannel,'request_approval',{task_id:a.task_id,reason:'host-attested human review',expires_at:10000});
    await deny('actor-not-human',cmd('respond_approval',{approval_request_id:approval.result.approval_request_id,decision:'approve',reason:null}),'FORBIDDEN');
    host(humanChannel,'respond_approval',{approval_request_id:approval.result.approval_request_id,decision:'approve',reason:null});
    assert.equal(calls,0);
    const cycles=[];
    for(let i=0;i<2;i++){cycles.push(await c.owner.runCycle());assert.equal(cycles.at(-1).result.classification,'result');}
    assert.equal((await c.owner.runCycle()).skipped,true);assert.equal(calls,2);assert.equal(effects,2);
    // Receipts after execution still return original historical response; no dispatch.
    assert.deepEqual(await zero('post-effect-duplicate',()=>send(submittedCommand)),submitted);assert.equal(effects,2);
    const bobOut=await good(cmd('observe_outcomes',{task_ids:[a.task_id,b.task_id,foreign.task_id]}));
    const bobResult=bobOut.result.outcomes.find(o=>o.task_id===b.task_id);assert.equal(bobResult.status,'completed');assert.equal(bobResult.last_result.summary,success.summary);
    assert.equal(Object.hasOwn(bobOut.result.outcomes.find(o=>o.task_id===a.task_id),'last_result'),false);
    // Handoff visibility is NOT outcome authority. Explicit scoped grant is needed.
    const nextAuthority=read().envelope.registry.authority;nextAuthority.authority_revision++;nextAuthority.grants.push(grant('bob','work',a));c.admin.setAuthoritySnapshot(nextAuthority,{expectedRevision:read().revision});
    const outcomes=await good(cmd('observe_outcomes',{task_ids:[a.task_id,b.task_id,foreign.task_id]}));
    assert.equal(outcomes.result.outcomes.length,2);
    for(const o of outcomes.result.outcomes){assert.equal(o.status,'completed');assert.equal(o.last_result.outcome,'succeeded');}
    const final=read(); const replay=c.observer.replayEnvelope();assert.deepEqual(replay,final.envelope);assert.equal(calls,2);assert.equal(effects,2);
    assert.equal(Object.keys(final.envelope.coordination.commands).length,6);
    assert.equal(Object.keys(final.envelope.coordination.attempts).length,2);
    assert.equal(final.envelope.registry.execution_results.length,2);
    assert.equal(final.envelope.registry.authority.approvals[0].consumed_by_attempt_id,contexts.find(x=>x.task_id===a.task_id).attempt_id);
    assert.equal(new Set(contexts.map(x=>x.coordination.operation_id)).size,2);
    process.kill(actorChild.p.pid,0);process.kill(contender.p.pid,0); // At final outcome, all roles are simultaneously alive.
    const evidence={owner:info(),actor:ready,standby:standbyReady,competition,simultaneouslyAlive:true,authCalls,calls,effects,receiptCount:Object.keys(final.envelope.coordination.commands).length,attemptCount:Object.keys(final.envelope.coordination.attempts).length,revision:final.revision,replayMatches:true,identity,cycles,outcomes,contexts};
    save(dir,'final.json',final);save(dir,'replay.json',replay);save(dir,'actor-transcript.json',trace);save(dir,'evidence.json',evidence);
    return evidence;
  } finally { attachment?.detach();await actorChild?.close();await contender?.close();c.owner.close(); }
}

export async function runProof({dir,ownerRuntime=process.execPath,actorRuntime=process.execPath}) {
  dir=resolve(dir);mkdirSync(dir,{recursive:false});
  ownerRuntime=resolveRuntime(ownerRuntime);actorRuntime=resolveRuntime(actorRuntime);
  const w=child('owner',ownerRuntime,dir,'owner');
  try {
    const ready=await w.next();assert.equal(ready.pid,w.p.pid);assert.equal(ready.execPath,ownerRuntime);
    w.p.send({dir,actorRuntime});const done=await w.next();assert.equal(done.type,'done',JSON.stringify(done));
    assert.equal(done.evidence.owner.pid,w.p.pid);assert.notEqual(done.evidence.actor.pid,w.p.pid);assert.equal(done.evidence.actor.execPath,actorRuntime);
    // Owner closes its actor/standby children BEFORE reporting done.
    for(const p of [done.evidence.actor.pid,done.evidence.standby.pid])assert.throws(()=>process.kill(p,0),e=>e.code==='ESRCH');
    const {createCoordinatedChord}=await import('@antistructured/chord');
    const observerHost=createCoordinatedChord({storage:{path:join(dir,'run.sqlite'),mode:'existing',expectedIdentity:done.evidence.identity},trustedHost:{clock:{now:()=>100}}});
    try {
      const retained=JSON.parse(readFileSync(join(dir,'final.json'),'utf8'));
      assert.deepEqual(observerHost.observer.inspect(),retained);
      assert.deepEqual(observerHost.observer.replayEnvelope(),retained.envelope);
      save(dir,'reopened.json',observerHost.observer.inspect());
    } finally {observerHost.observer.close();}
    await w.close();assert.throws(()=>process.kill(w.p.pid,0),e=>e.code==='ESRCH');
    save(dir,'processes.json',{orchestrator:info(),ownerSpawnPid:w.p.pid,ownerRuntime,actorRuntime,childrenCleaned:true,ownerCleaned:true,independentReopenMatches:true});
    return done.evidence;
  } finally { await w.close(); }
}
async function main() {
  const role=process.argv[2]==='--role'?process.argv[3]:null;
  if(role==='actor')return actor();
  if(role==='standby')return standby();
  if(role==='owner'){
    process.send({type:'ready',...info()});const [config]=await once(process,'message');
    try {const evidence=await owner(config);process.send({type:'done',evidence});await once(process,'message');}
    catch(e){process.send({type:'error',error:String(e),stack:e.stack});}
    finally {if(process.connected)process.disconnect();}return;
  }
  assert.ok(process.argv[2],'Usage: two-process-coordination.mjs NEW_OUT [OWNER_RUNTIME] [ACTOR_RUNTIME]');
  const evidence=await runProof({dir:process.argv[2],ownerRuntime:process.argv[3],actorRuntime:process.argv[4]});
  console.log(JSON.stringify({ok:true,dir:resolve(process.argv[2]),...evidence}));
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e);process.exitCode=1;if(process.connected)process.disconnect();});
