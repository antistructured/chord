import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openCoordinatedSqliteStore as open, openSqliteStore, createChord } from '../src/index.js';
import { reduceCoordinationTrace } from '../src/coordination/history.js';
import { increment, deadline, LeaseRecord, OwnerCredential, DispatchRecord } from '../src/coordination/contracts.js';
import { quarantine } from '../src/coordination/state.js';
import { markTaskUncertain } from '../src/platform/transitions.js';
import { canonicalProjection } from '../src/platform/history.js';
import { installHost, queueOptions } from './fixtures/host.js';
const scratch = process.env.TMPDIR || '/home/d/.hermes/cache/scratch';
const rejects = (fn,code,status='not_committed') => assert.throws(fn,e => e.code === code && e.path === '$' && e.commitStatus === status && e.message === code);
function fixture(clock) {
  const dir = mkdtempSync(join(scratch,'chord-052-store-')), path = join(dir,'run.db');
  let time = 100;
  const c = clock || {now:()=>time};
  const store = open({path,mode:'create',expectedIdentity:null,clock:c});
  const init = store.init(), identity = init.identity;
  return {path,identity,store,set time(v){time=v;},get time(){return time;},
    observer: () => open({path,mode:'existing',expectedIdentity:identity,clock:c}),
    cleanup(){store.close();rmSync(dir,{recursive:true,force:true});}};
}
const acquire = (s,revision=0,owner_id=randomUUID()) => s.commit({expectedRevision:revision,credential:null,change:{kind:'acquire',owner_id}});
const commit = (s,credential,expectedRevision,kind) => s.commit({credential,expectedRevision,change:{kind}});
const raw = path => {const db = new DatabaseSync(path);try{return db.prepare('SELECT * FROM chord_coordination').get();}finally{db.close();}};

test('v2 pristine genesis, identity pin, detached observer, exact exports and combined pagination', () => {
  const f=fixture(); let observer;
  try {
    const before=raw(f.path); observer=f.observer();
    assert.deepEqual(raw(f.path),before); assert.deepEqual(observer.load(),f.store.load());
    const a=acquire(f.store), token=a.result.credential;
    assert.equal(a.revision,1); assert.equal(token.generation,1);
    const copy=observer.load();copy.envelope.coordination.lease.generation=99;
    assert.equal(f.store.load().envelope.coordination.lease.generation,1);
    assert.deepEqual(reduceCoordinationTrace(f.store.load().envelope),f.store.load().envelope);
    assert.deepEqual(f.store.readHistory({limit:1}).entries.map(x=>x.ordinal),[0]);
    assert.equal(f.store.readHistory({limit:1}).hasMore,true);
    assert.deepEqual(f.store.readHistory({afterOrdinal:0}).entries.map(x=>x.ordinal),[1]);
    assert.deepEqual(f.store.readHistory({afterOrdinal:1}).entries,[]);
    rejects(()=>observer.commit({expectedRevision:1,credential:token,change:{kind:'renew'}}),'OWNER_LOST');
    rejects(()=>open({path:f.path,mode:'existing',expectedIdentity:{...f.identity,run_id:'foreign'}}),'RUN_MISMATCH');
    rejects(()=>open({path:f.path,mode:'existing',expectedIdentity:{...f.identity,incarnation_id:randomUUID()}}),'INCARNATION_MISMATCH');
    rejects(()=>open({path:f.path,mode:'create',expectedIdentity:null}),'STORE_ALREADY_INITIALIZED');
    assert.equal(f.store.load().revision,1);
  } finally {observer?.close();f.cleanup();}
});

test('renew/release/reacquire, same owner UUID never reuses generation; release loses handle',()=>{
  const f=fixture();let next;
  try {
    const owner=randomUUID(), a=acquire(f.store,0,owner), token=a.result.credential;
    const before=raw(f.path);
    rejects(()=>commit(f.store,token,1,'renew'),'LEASE_NOT_EXTENDED');assert.deepEqual(raw(f.path),before);
    f.time=101;assert.equal(commit(f.store,token,1,'renew').result.lease.expires_at,30101);
    rejects(()=>commit(f.store,token,1,'release'),'STALE_REVISION');
    assert.equal(commit(f.store,token,2,'release').result.lease.generation,1);
    rejects(()=>commit(f.store,token,3,'renew'),'OWNER_LOST');
    next=f.observer();const b=acquire(next,3,owner);assert.equal(b.result.credential.generation,2);
    assert.equal(next.load().envelope.coordination.lease.owner_id,owner);
  }finally{next?.close();f.cleanup();}
});

test('expiry takeover fences stale renew/release/admin/runtime/actor before revision and diagnostics',()=>{
  const f=fixture();let next;
  try {
    const a=acquire(f.store), token=a.result.credential;next=f.observer();
    const before=raw(f.path);rejects(()=>acquire(next,0),'OWNER_HELD');assert.deepEqual(raw(f.path),before);
    f.time=30100;const b=acquire(next,1,token.owner_id);assert.equal(b.result.credential.generation,2);
    const after=raw(f.path);
    for(const kind of ['renew','release','admin','actor_command','runtime_claim','runtime_outcome']) {
      rejects(()=>f.store.commit({expectedRevision:0,credential:token,change:{kind}}),'OWNER_LOST');assert.deepEqual(raw(f.path),after);
    }
    // Even a refreshed read cannot refresh the captured token.
    assert.equal(f.store.load().revision,2);rejects(()=>commit(f.store,token,2,'renew'),'OWNER_LOST');
    const reopened=f.observer();try {rejects(()=>commit(reopened,b.result.credential,2,'renew'),'OWNER_LOST');}finally{reopened.close();}
  }finally{next?.close();f.cleanup();}
});

test('expiry equality loses incumbent without takeover; clock restoration cannot resurrect',()=>{
  const f=fixture();try {const a=acquire(f.store), before=raw(f.path);f.time=30100;rejects(()=>commit(f.store,a.result.credential,1,'release'),'LEASE_EXPIRED');assert.deepEqual(raw(f.path),before);f.time=101;rejects(()=>commit(f.store,a.result.credential,1,'renew'),'CLOCK_ROLLBACK');f.time=30101;rejects(()=>commit(f.store,a.result.credential,1,'renew'),'OWNER_LOST');}finally{f.cleanup();}
});

test('clock floor and local observation rollback are sticky, no writes',()=>{
  const f=fixture();try {const a=acquire(f.store),before=raw(f.path);f.time=99;rejects(()=>commit(f.store,a.result.credential,1,'renew'),'CLOCK_ROLLBACK');assert.deepEqual(raw(f.path),before);f.time=102;rejects(()=>commit(f.store,a.result.credential,1,'renew'),'OWNER_LOST');}finally{f.cleanup();}
});

test('clock sampled inside BEGIN and again precommit; final expiry and invalid time roll back',()=>{
  let times=[100],observations=0, begun=false;
  const prototype=DatabaseSync.prototype, original=prototype.exec;
  const f=fixture({now:()=>{observations++;if(observations>1)assert.equal(begun,true);return times.length>1?times.shift():times[0];}});
  try {
    prototype.exec=function(sql){const r=original.call(this,sql);if(sql==='BEGIN IMMEDIATE')begun=true;if(['COMMIT','ROLLBACK'].includes(sql))begun=false;return r;};
    times=[100,30100];const before=raw(f.path);rejects(()=>acquire(f.store),'LEASE_EXPIRED');assert.deepEqual(raw(f.path),before);
  }finally{prototype.exec=original;f.cleanup();}
  for(const bad of [-1,NaN,1.5]) {const f=fixture();try {const a=acquire(f.store);f.time=bad;const before=raw(f.path);rejects(()=>commit(f.store,a.result.credential,1,'renew'),'INVALID_CONTEXT');assert.deepEqual(raw(f.path),before);}finally{f.cleanup();}}
});

test('reentrancy from trusted clock is blocked before nested read/write',()=>{
  let store, nested=0;
  const f=fixture({now:()=>{if(store){rejects(()=>store.load(),'REENTRANT_MUTATION');nested++;}return 100;}});
  try {store=f.store;acquire(store);assert.equal(nested,2);}finally{f.cleanup();}
});

test('all unsupported branches fail closed; admin maintenance is owned/revision-linked',()=>{
  const f=fixture();try {
    const a=acquire(f.store),credential=a.result.credential;
    for(const kind of ['actor_command','runtime_claim','runtime_outcome']) {const before=raw(f.path);rejects(()=>f.store.commit({expectedRevision:1,credential,change:{kind}}),'UNSUPPORTED_OPERATION');assert.deepEqual(raw(f.path),before);}
    rejects(()=>f.store.checkDispatch({credential,dispatch:{}}),'UNSUPPORTED_OPERATION');
    const next=f.store.load().envelope.registry;next.run.revision=2;next.run.state='active';
    next.specs.push({schema_version:'chord.contracts.v1',spec_type:'IntentSpec',project:'storage',phase:'admin',do:['descriptive registration']});
    next.event_journal.push({event_id:randomUUID(),type:'spec_registered',at:1,schema_version:'chord.contracts.v1',run_id:f.identity.run_id,run_revision:2,payload:{spec_type:'IntentSpec'}});
    const result=f.store.commit({expectedRevision:1,credential,change:{kind:'admin',operation:'host_commit',nextRegistry:next,nextPolicy:null,audit_label:'host-maintenance'}});
    assert.deepEqual(result.result,{operation:'host_commit'});assert.equal(f.store.load().envelope.registry.run.state,'active');
    assert.deepEqual(reduceCoordinationTrace(f.store.load().envelope),f.store.load().envelope);
  }finally{f.cleanup();}
});

test('exact data contracts reject accessors, extras, unsafe integers and forged leases',()=>{
  const f=fixture();try {
    let calls=0;const args={expectedRevision:0,credential:null,get change(){calls++;return {kind:'acquire',owner_id:randomUUID()};}};
    assert.throws(()=>f.store.commit(args));assert.equal(calls,0);assert.equal(f.store.load().revision,0);
    for(const mutate of [v=>v.extra=1,v=>v.generation=1.5,v=>v.owner_id=randomUUID()]) {const value={generation:0,owner_id:null,acquired_at:null,renewed_at:null,expires_at:null};mutate(value);assert.throws(()=>LeaseRecord.assert(value));}
    assert.throws(()=>OwnerCredential.assert({...f.identity,owner_id:randomUUID(),generation:0}));
  }finally{f.cleanup();}
});

test('combined replay rejects missing/reordered/forged/detached lease evidence at intermediate revision',()=>{
  const f=fixture();try {
    const a=acquire(f.store);f.time=101;commit(f.store,a.result.credential,1,'renew');const good=f.store.load().envelope;
    const mutations=[e=>e.coordination_history.pop(),e=>e.coordination_history.reverse(),e=>e.coordination_history[1].evidence.after.generation++,e=>e.coordination_history[1].domain_commit_id='foreign',e=>e.coordination_history[1].changes=[],e=>e.coordination_history[1].evidence.quarantined_attempt_ids=['invented'],e=>e.coordination.lease.generation++,e=>e.registry.event_journal[1].payload.operation='renew',e=>e.coordination_history[0].state.logical_now=200];
    for(const mutate of mutations){const bad=structuredClone(good);mutate(bad);assert.throws(()=>reduceCoordinationTrace(bad));}
  }finally{f.cleanup();}
});

test('layout/version/header/JSON/large integer corruption retires with no recovery',()=>{
  for(const [sql,code] of [
    ["UPDATE chord_coordination SET storage_version='future'",'UNSUPPORTED_STORAGE_VERSION'],
    ["UPDATE chord_coordination SET schema_version='future'",'SCHEMA_MISMATCH'],
    ["UPDATE chord_coordination SET protocol_version='future'",'UNSUPPORTED_PROTOCOL'],
    ["UPDATE chord_coordination SET generation=9",'STORAGE_CORRUPT'],
    ["UPDATE chord_coordination SET logical_now=1.5",'STORAGE_CORRUPT'],
    ["UPDATE chord_coordination SET revision=9223372036854775807",'STORAGE_CORRUPT'],
    ["UPDATE chord_coordination SET envelope_json='{'",'STORAGE_CORRUPT'],
    ["UPDATE chord_coordination SET envelope_json=json_set(envelope_json,'$.coordination_history',json('[]'))",'STORAGE_CORRUPT'],
    ["CREATE TABLE extra (id INTEGER)",'STORAGE_CORRUPT'],
    ["CREATE TRIGGER forbidden AFTER UPDATE ON chord_coordination BEGIN SELECT 1; END",'STORAGE_CORRUPT']]) {
    const f=fixture();try {const db=new DatabaseSync(f.path);db.exec(sql);db.close();rejects(()=>f.store.load(),code);rejects(()=>f.observer(),code);}finally{f.cleanup();}
  }
});

test('v1/v2 cross-open rejects without changing authoritative row; no implicit migration',()=>{
  const f=fixture();try {const before=raw(f.path);assert.throws(()=>openSqliteStore({path:f.path,mode:'existing'}));assert.deepEqual(raw(f.path),before);}finally{f.cleanup();}
  const dir=mkdtempSync(join(scratch,'chord-052-v1-')),path=join(dir,'legacy.db');
  const c=createChord({storage:{path,mode:'create'}});try {c.close();rejects(()=>open({path,mode:'existing',expectedIdentity:{run_id:'legacy',incarnation_id:randomUUID()}}),'UNSUPPORTED_STORAGE_VERSION');}finally{c.close();rmSync(dir,{recursive:true,force:true});}
});

test('precommit write/SQL predicate mismatch rollback and attempted COMMIT/failed rollback retire',()=>{
  for(const point of ['UPDATE','PREDICATE','BEFORE_COMMIT','AFTER_COMMIT','ROLLBACK','DENIAL_ROLLBACK']) {
    const f=fixture(), prototype=DatabaseSync.prototype,exec=prototype.exec,prepare=prototype.prepare;
    try {
      const before=raw(f.path);let once=false;
      prototype.exec=function(sql){
        if(sql==='COMMIT' && point==='BEFORE_COMMIT')throw Error('before commit');
        if(sql==='COMMIT' && point==='AFTER_COMMIT'){exec.call(this,sql);throw Error('after commit');}
        if(sql==='ROLLBACK' && point.includes('ROLLBACK') && !once){once=true;throw Error('rollback failed');}
        return exec.call(this,sql);
      };
      prototype.prepare=function(sql){if(sql.startsWith('UPDATE')) {if(['UPDATE','ROLLBACK'].includes(point))throw Error('write failed');if(point==='PREDICATE')return {run:()=>({changes:0})};}return prepare.call(this,sql);};
      const operation=()=>acquire(f.store,point==='DENIAL_ROLLBACK'?9:0);
      rejects(operation,['UPDATE'].includes(point)?'STORAGE_UNAVAILABLE':point==='PREDICATE'?'STORAGE_CORRUPT':'COMMIT_OUTCOME_UNKNOWN',['UPDATE','PREDICATE'].includes(point)?'not_committed':'unknown');
      prototype.exec=exec;prototype.prepare=prepare;
      rejects(()=>f.store.load(),'STORE_CLOSED');
      const observer=f.observer();try {assert.equal(observer.load().revision,point==='AFTER_COMMIT'?1:0);if(point!=='AFTER_COMMIT')assert.deepEqual(raw(f.path),before);}finally{observer.close();}
    }finally{prototype.exec=exec;prototype.prepare=prepare;f.cleanup();}
  }
});

test('renew/release acknowledgement loss preserves the exact committed lifecycle and retires token',()=>{
  for(const kind of ['renew','release']){
    const f=fixture(),prototype=DatabaseSync.prototype,exec=prototype.exec;
    try {
      const token=acquire(f.store).result.credential;f.time=101;
      prototype.exec=function(sql){const r=exec.call(this,sql);if(sql==='COMMIT')throw Error('lost lifecycle acknowledgement');return r;};
      rejects(()=>commit(f.store,token,1,kind),'COMMIT_OUTCOME_UNKNOWN','unknown');
      prototype.exec=exec;rejects(()=>commit(f.store,token,2,'renew'),'STORE_CLOSED');
      const observer=f.observer();try {const state=observer.load();assert.equal(state.revision,2);assert.equal(state.envelope.coordination.lease.owner_id,kind==='release'?null:token.owner_id);assert.equal(state.envelope.coordination_history.at(-1).operation,kind);rejects(()=>commit(observer,token,2,'renew'),'OWNER_LOST');}finally{observer.close();}
    }finally{prototype.exec=exec;f.cleanup();}
  }
});

test('writer timeout retires rather than falling back to cached ownership',()=>{
  const f=fixture(),db=new DatabaseSync(f.path);try {const before=raw(f.path);db.exec('BEGIN IMMEDIATE');rejects(()=>acquire(f.store),'STORAGE_UNAVAILABLE');db.exec('ROLLBACK');assert.deepEqual(raw(f.path),before);rejects(()=>f.store.load(),'STORE_CLOSED');}finally{db.close();f.cleanup();}
});

test('overflow checked before addition; actual clock deadline overflow rolls back exact row',()=>{
  rejects(()=>increment(Number.MAX_SAFE_INTEGER,'GENERATION_EXHAUSTED'),'GENERATION_EXHAUSTED');
  rejects(()=>increment(Number.MAX_SAFE_INTEGER),'REVISION_EXHAUSTED');
  assert.equal(increment(Number.MAX_SAFE_INTEGER-1),Number.MAX_SAFE_INTEGER);
  const f=fixture();try {const before=raw(f.path);f.time=Number.MAX_SAFE_INTEGER;rejects(()=>acquire(f.store),'REVISION_EXHAUSTED');assert.deepEqual(raw(f.path),before);}finally{f.cleanup();}
});

test('whole envelope budgets reject without partial ownership changes',()=>{
  const f=fixture();try {const a=acquire(f.store),next=f.store.load().envelope.registry;next.run.revision=2;next.trigger_state=Object.fromEntries(Array.from({length:257},(_,i)=>['key'+i,true]));const before=raw(f.path);rejects(()=>f.store.commit({expectedRevision:1,credential:a.result.credential,change:{kind:'admin',operation:'host_commit',nextRegistry:next,nextPolicy:null,audit_label:'budget'}}),'LIMIT_EXCEEDED');assert.deepEqual(raw(f.path),before);}finally{f.cleanup();}
});

test('uncommitted domain/lease/history row remains wholly invisible to independent reader',()=>{
  const f=fixture();try {const db=new DatabaseSync(f.path),before=f.store.load();db.exec('BEGIN IMMEDIATE');db.exec("UPDATE chord_coordination SET generation=99, revision=99, envelope_json='invalid uncommitted bytes'");assert.deepEqual(f.store.load(),before);db.exec('ROLLBACK');db.close();assert.deepEqual(f.store.load(),before);}finally{f.cleanup();}
});

test('pure quarantine preserves completed/approval facts; clears live reservations and closes captured sidecars',async()=>{
  let entered,release;
  const arrived=new Promise(r=>entered=r),waiting=new Promise(r=>release=r);
  let calls=0;
  const c=createChord({adapterRouter:{fallback:{execute(){if(++calls===1)return {status:'completed',outcome:'succeeded'};entered();return waiting;}}}}),host=installHost(c,{approvalRequired:true});
  function admit(action){
    const {packets}=c.registerSpecAndQueue({schema_version:'chord.contracts.v1',spec_type:'IntentSpec',project:'fence',phase:'storage',do:[action]},queueOptions(host,{approval_required:true}));
    const task=packets[0].task_id;c.prepareAttempt(task);
    const approval=c.createApproval({task_id:task,approver_principal_id:host.human_id}),authority=c.getAuthority();
    authority.authority_revision++;authority.approvals.push(approval);c.setAuthoritySnapshot(authority);return task;
  }
  const completedId=admit('completed effect');await c.runCycle();
  const task=admit('one live effect'),running=c.runCycle();await arrived;
  const registry=c.getRegistry(),a=registry.active_attempts[task].attempt;
  const completed=structuredClone(registry.tasks[completedId]),results=structuredClone(registry.execution_results);
  const coordination={attempts:{[a.attempt_id]:{attempt_id:a.attempt_id,state:'dispatched'}}};
  const approvals=structuredClone(registry.authority.approvals),equivalent=structuredClone(registry);
  markTaskUncertain(equivalent,task,{reason:'OWNER_ACQUIRE',now:100});equivalent.run.revision=registry.run.revision;
  assert.deepEqual(quarantine(registry,coordination),[a.attempt_id]);
  assert.deepEqual(canonicalProjection(registry),canonicalProjection(equivalent));
  assert.equal(registry.tasks[task].status,'uncertain');assert.equal(registry.task_queue.find(q=>q.task_id===task).lease_expires_at,null);
  assert.equal(completed.status,'completed');assert.deepEqual(registry.tasks[completedId],completed);assert.deepEqual(registry.execution_results,results);
  assert.equal(approvals.length,2);assert.ok(approvals.every(a=>a.consumed_by_attempt_id !== null));
  assert.deepEqual(registry.active_attempts,{});assert.deepEqual(registry.pending_attempts,{});
  assert.equal(Object.values(registry.operations).find(o=>o.task_id===task).state,'unknown');assert.deepEqual(registry.authority.approvals,approvals);
  assert.equal(coordination.attempts[a.attempt_id].state,'quarantined');
  release({status:'completed',outcome:'succeeded'});await running;c.close();
});

function peer(runtime,f,mode='owner') {
  return new Promise((resolve,reject)=>{
    const child=spawn(runtime,[new URL('./coordinated-owner-worker.js',import.meta.url).pathname,f.path,JSON.stringify(f.identity),mode],{stdio:['ignore','pipe','pipe','ipc']});
    let stderr='',sequence=0;const pending=new Map();
    child.stderr.on('data',d=>stderr+=d);child.on('error',reject);
    const exit=new Promise((done,failed)=>{child.on('error',failed);child.on('exit',code=>{if(code===0)done();else failed(Error(stderr+' exit '+code));});});
    child.on('message',message=>{
      assert.equal(message.pid,child.pid);
      if(message.ready)resolve({child,exit,send(request){return new Promise(done=>{const requestId=++sequence;pending.set(requestId,done);child.send({...request,requestId});});}});
      else if(message.requestId) {pending.get(message.requestId)(message.result);pending.delete(message.requestId);}
    });
    exit.catch(reject);
  });
}

test('live independent owner renews/releases, peer takes over and old captured generation cannot commit (four pairs)',async t=>{
  const runtimes=['/home/d/.volta/tools/image/node/24.22.1/bin/node','/home/d/.bun/bin/bun'];
  for(const first of runtimes)for(const second of runtimes){
    const f=fixture();let a,b;
    try {
      [a,b]=await Promise.all([peer(first,f),peer(second,f)]);
      const owner_id=randomUUID();
      assert.equal((await a.send({kind:'acquire',time:100,expectedRevision:0,owner_id})).result.credential.generation,1);
      assert.equal((await b.send({kind:'acquire',time:100,expectedRevision:0})).code,'OWNER_HELD');
      assert.equal((await a.send({kind:'renew',time:101,expectedRevision:1})).revision,2);
      assert.equal((await a.send({kind:'release',time:102,expectedRevision:2})).revision,3);
      assert.equal((await b.send({kind:'acquire',time:102,expectedRevision:3,owner_id})).result.credential.generation,2);
      const before=raw(f.path);
      for(const kind of ['renew','release','runtime_outcome']){
        assert.equal((await a.send({kind,time:103,expectedRevision:4})).code,'OWNER_LOST');assert.deepEqual(raw(f.path),before);
      }
      const replay=await b.send({kind:'inspect',time:103});assert.equal(replay.replayEqual,true);assert.equal(replay.historyCount,5);
      // B remains alive at exact expiry while a third fresh handle takes over.
      const next=f.observer();f.time=30102;try {assert.equal(acquire(next,4,owner_id).result.credential.generation,3);}finally{next.close();}
      const after=raw(f.path);
      assert.equal((await b.send({kind:'renew',time:30102,expectedRevision:5})).code,'OWNER_LOST');assert.deepEqual(raw(f.path),after);
      t.diagnostic(JSON.stringify({first,second,firstPid:a.child.pid,secondPid:b.child.pid,finalRevision:5,finalGeneration:3}));
      a.child.send({kind:'close'});b.child.send({kind:'close'});await Promise.all([a.exit,b.exit]);
    }finally{for(const p of [a,b])if(p && p.child.exitCode===null)p.child.kill();f.cleanup();}
  }
});

test('clock authority samples only after a real independent writer lock wait',async()=>{
  const samples=[];const f=fixture({now:()=>{const value=Date.now();samples.push(value);return value;}});let lock;
  try {
    lock=await peer(process.execPath,f,'lock');
    const released=new Promise(resolve=>lock.child.on('message',m=>{if(m.released)resolve(m.released);}));
    lock.child.send('release after timer');
    const started=Date.now(),ack=acquire(f.store);
    const releaseTime=await released;await lock.exit;
    assert.equal(ack.ok,true);assert.ok(samples[1]>=releaseTime-1);assert.ok(samples[1]>=started+75);
  }finally{if(lock?.child.exitCode===null)lock.child.kill();f.cleanup();}
});

test('independent simultaneous process acquisitions have exactly one acknowledged generation (four runtime pairs)',async()=>{
  const runtimes=[process.execPath.includes('bun')?'/home/d/.volta/tools/image/node/24.22.1/bin/node':process.execPath,'/home/d/.bun/bin/bun'];
  for(const first of runtimes)for(const second of runtimes){
    const f=fixture(),children=[];
    try {
      const launch=runtime=>new Promise((resolve,reject)=>{
        const child=spawn(runtime,[new URL('./coordinated-storage-worker.js',import.meta.url).pathname,f.path,JSON.stringify(f.identity)],{stdio:['ignore','pipe','pipe','ipc']});children.push(child);let stderr='';child.stderr.on('data',d=>stderr+=d);
        const messages=[];child.on('message',m=>{messages.push(m);if(m.ready)resolve({child,messages});});child.on('error',reject);child.on('exit',code=>{if(!messages.length)reject(Error(stderr+' exit '+code));});
      });
      const peers=await Promise.all([launch(first),launch(second)]);
      for(const p of peers){assert.equal(p.messages[0].pid,p.child.pid);p.child.send('go');}
      await Promise.all(peers.map(p=>new Promise((resolve,reject)=>{p.child.on('exit',code=>code===0?resolve():reject(Error('worker exit '+code)));})));
      const results=peers.map(p=>p.messages.find(m=>m.result));
      assert.equal(results.filter(m=>m.result.ok).length,1);assert.equal(results.filter(m=>m.result.code==='OWNER_HELD').length,1);
      for(const r of results){assert.equal(r.revision,1);assert.equal(r.pid,peers.find(p=>p.child.pid===r.pid).child.pid);}
      assert.equal(f.store.load().envelope.coordination.lease.generation,1);
      assert.equal(f.store.load().envelope.coordination_history.length,2);
    }finally{for(const child of children)if(child.exitCode===null)child.kill();f.cleanup();}
  }
});
