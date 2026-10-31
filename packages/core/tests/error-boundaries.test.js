import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createChord, createCoordinatedChord, createActorIngress } from '../src/index.js';
import { createAdapterBridge, createAdapterServer, createMemoryTransportPair, createMockAgentAdapter, adapterError, ADAPTER_CONTEXT_VERSION } from '../src/interop/index.js';
import { actorFixture } from './fixtures/coordinated-actors.js';
const secret='secret /private/054-password payload';
const raw=f=>{const db=new DatabaseSync(f.path);try{return db.prepare('SELECT * FROM chord_coordination').all();}finally{db.close();}};

test('public actor invalid, unauthenticated, unsupported and stale rejections preserve complete rows',()=>{
  const f=actorFixture();
  try {
    const before=raw(f);
    const cases=[['alice',{...f.command('submit_work',{packets:[f.packets.alice]}),payload:{message:secret}},'INVALID_COMMAND'],['absent',f.command('project_context',{}),'HOST_UNAUTHENTICATED'],['alice',{...f.command('project_context',{}),protocol_version:secret},'UNSUPPORTED_PROTOCOL'],['alice',f.command('submit_work',{packets:[f.packets.alice]},0),'STALE_REVISION']];
    for(const [actor,cmd,code] of cases){const response=f.send(actor,cmd);assert.equal(response.code,code);assert.equal(response.commit_status,'not_committed');assert.ok(!JSON.stringify(response).includes(secret));assert.deepEqual(raw(f),before);}
    const ingress=createActorIngress({authenticate(){throw Error(secret);},load(){throw Error('unexpected');},commitCommand(){throw Error('unexpected');}});
    assert.deepEqual(ingress.handleAuthenticated({},'{}'),{protocol_version:'chord.actor-response.v1',operation_id:null,correlation_id:null,causation_id:null,ok:false,code:'HOST_UNAUTHENTICATED',commit_status:'not_committed'});
    const cmd=f.command('submit_work',{packets:[f.packets.bob]}), committed=f.send('bob',cmd);
    assert.equal(committed.ok,true);const after=raw(f);assert.deepEqual(f.send('bob',cmd),committed);assert.deepEqual(raw(f),after);
  }finally{f.cleanup();}
});

test('trusted adapter raw cause stays local; untrusted error messages never enter wire or canonical state',async()=>{
  const root=Error(secret), local=adapterError('ADAPTER_CHANNEL_CLOSED','unknown',root);
  assert.equal(local.cause,root);assert.equal(local.message,'ADAPTER_CHANNEL_CLOSED');assert.equal(local.classification,'unknown');
  const f=actorFixture(), pair=createMemoryTransportPair();let calls=0;
  const ad=createMockAgentAdapter().advertisement;
  const server=createAdapterServer({advertisement:ad,channel:pair.right,handle(){calls++;throw root;}});
  const wires=[];pair.left.on('message',wire=>wires.push(wire));
  const bridge=createAdapterBridge({advertisement:ad,transport:pair.left,timeoutMs:1000});let c;
  try {
    assert.equal(f.submit('bob').ok,true);
    f.store.commit({expectedRevision:f.store.load().revision,credential:f.token,change:{kind:'release'}});f.store.close();
    c=createCoordinatedChord({storage:{path:f.path,mode:'existing',expectedIdentity:f.identity},trustedHost:{clock:f.clock},adapterRouter:{fallback:{adapter:bridge,execution_context:ADAPTER_CONTEXT_VERSION}}});
    c.owner.acquire({expectedRevision:c.observer.inspect().revision});
    await c.owner.runCycle();
    const envelope=c.observer.exportEnvelope(), table=raw(f);
    assert.equal(calls,1);assert.equal(server.stats().executions,0);assert.equal(wires.length,1);
    const error=JSON.parse(wires[0]);assert.equal(error.code,'ADAPTER_ERROR');assert.equal(error.classification,'unknown');assert.equal(error.message,undefined);assert.equal(error.cause,undefined);
    assert.equal(envelope.registry.tasks[f.packets.bob.task_id].status,'uncertain');
    assert.ok(!JSON.stringify(table).includes(secret));assert.ok(!wires.join('').includes(secret));
    assert.deepEqual(c.observer.replayEnvelope(),envelope);
    const before=raw(f);assert.equal((await c.owner.runCycle()).skipped,true);assert.deepEqual(raw(f),before);assert.equal(calls,1);
  }finally{bridge.close();server.close();pair.close();c?.owner.close();f.cleanup();}
});

test('public SDK lifecycle and malformed reconciliation remain fixed errors, not automatic recovery',()=>{
  const c=createChord();
  try {assert.throws(()=>c.reconcileTask({message:secret}),e=>e.code==='INVALID_SHAPE'&&e.message==='INVALID_SHAPE'&&!e.message.includes(secret));}
  finally{c.close();}
  assert.throws(()=>c.exportRegistry(),e=>e.code==='STORE_CLOSED'&&e.message==='STORE_CLOSED');
});
