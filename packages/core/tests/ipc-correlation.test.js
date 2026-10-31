import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fork } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createActorClient } from '../src/runtime/actor-client.js';
import { actorFixture } from './fixtures/coordinated-actors.js';

const tick = () => new Promise(resolve => setTimeout(resolve,10));
class Channel extends EventEmitter {
  connected = true; sent = []; callbacks = [];
  send(wire,callback) { this.sent.push(JSON.parse(wire)); this.callbacks.push(callback); }
}
function setup(options) {
  const f = actorFixture(), channel = new Channel(), client = createActorClient(channel,options);
  const command = () => f.command('observe_outcomes',{task_ids:[]},null,'same-read');
  const response = cmd => f.send('alice',cmd);
  const reply = (i, raw = response(command())) => {
    const request = channel.sent[i];
    // The legacy adapter keeps these tests behavioral on the unfixed client.
    const frame = request.protocol_version === 'chord.actor-command.v1' ? raw : {protocol_version:'chord.actor-ipc-response.v1',session_id:request.session_id,request_id:request.request_id,response:raw};
    channel.emit('message',JSON.stringify(frame));
  };
  return {f,channel,client,command,response,reply,cleanup(){client.close(); f.cleanup();}};
}
const row = f => {const db=new DatabaseSync(f.path);try{return db.prepare('SELECT * FROM chord_coordination').get();}finally{db.close();}};

test('exclusive wrapper, one pending command, detached canonical input and listener cleanup',async()=>{
 const s=setup();try {
  assert.throws(()=>createActorClient(s.channel),/ACTOR_CHANNEL_IN_USE/);
  for(const timeoutMs of [0,-1,1.5,2_147_483_648,NaN])assert.throws(()=>createActorClient(new Channel(),{timeoutMs}),/INVALID_ACTOR_TIMEOUT/);
  const cmd=s.command(), p=s.client.sendCommand(cmd);cmd.operation_id='mutated';
  await assert.rejects(s.client.sendCommand(s.command()),/ACTOR_COMMAND_PENDING/);
  s.reply(0);assert.equal((await p).operation_id,'same-read');
  s.client.close();s.client.close();
  for(const event of ['message','disconnect','close'])assert.equal(s.channel.listenerCount(event),0);
  const replacement=createActorClient(s.channel);replacement.close();
 }finally{s.cleanup();}
});

test('A gets A, B gets B; same read operation, reordered duplicate and unknown delivery ignored',async()=>{
 const s=setup();try {
  const a=s.client.sendCommand(s.command());s.reply(0);const ra=await a;assert.equal(ra.ok,true);
  const b=s.client.sendCommand(s.command());let settled=false;b.then(()=>settled=true,()=>settled=true);
  const response=s.response(s.command());s.reply(0,response);
  s.channel.emit('message',JSON.stringify({protocol_version:'chord.actor-ipc-response.v1',session_id:s.channel.sent[1].session_id,request_id:randomUUID(),response}));
  await tick();assert.equal(settled,false);s.reply(1,response);assert.deepEqual(await b,response);
  assert.notEqual(s.channel.sent[0].request_id,s.channel.sent[1].request_id);
 }finally{s.cleanup();}
});

for(const key of ['operation_id','run_id','incarnation_id','correlation_id','causation_id'])test(`matched invalid ${key} rejects rather than acknowledging`,async()=>{
 const s=setup();try {const p=s.client.sendCommand(s.command());const rejected=assert.rejects(p,/ACTOR_PROTOCOL_ERROR/);const response=s.response(s.command());response[key]=key==='incarnation_id'?randomUUID():'foreign';s.reply(0,response);await rejected;}finally{s.cleanup();}
});
for(const variant of ['missing','wrong-result','extra','bad-rejection','mixed-null'])test(`matched malformed response ${variant}`,async()=>{
 const s=setup();try {
  const p=s.client.sendCommand(s.command()), rejected=assert.rejects(p,/ACTOR_PROTOCOL_ERROR/);let response=s.response(s.command());
  if(variant==='missing')delete response.operation_id;
  if(variant==='wrong-result')response.result={task_ids:['not-an-outcome']};
  if(variant==='extra')response.private_host='no';
  if(variant==='bad-rejection')response={protocol_version:'chord.actor-response.v1',ok:false};
  if(variant==='mixed-null')response={protocol_version:'chord.actor-response.v1',ok:false,operation_id:null,correlation_id:'not-null',causation_id:null,code:'INVALID_COMMAND',commit_status:'not_committed'};
  s.reply(0,response);await rejected;
 }finally{s.cleanup();}
});

test('unframed/missing identity/malformed JSON cannot acknowledge; matched malformed frame is local error',async()=>{
 const s=setup();try {
  const p=s.client.sendCommand(s.command());let settled=false;p.then(()=>settled=true,()=>settled=true);
  for(const message of ['{',JSON.stringify(s.response(s.command())),JSON.stringify({protocol_version:'chord.actor-ipc-response.v1',response:s.response(s.command())})])s.channel.emit('message',message);
  await tick();assert.equal(settled,false);
  const rejected=assert.rejects(p,/ACTOR_PROTOCOL_ERROR/);s.channel.emit('message',JSON.stringify({...s.channel.sent[0],response:s.response(s.command())}));await rejected;
 }finally{s.cleanup();}
});

test('null identity host rejection is accepted only for the exact delivery, no invented run identity',async()=>{
 const s=setup();try {
  const p=s.client.sendCommand(s.command());s.f.sessions.delete('alice');
  const response=s.response(s.command());assert.equal(response.operation_id,null);s.reply(0,response);
  assert.deepEqual(await p,response);assert.equal(response.code,'HOST_UNAUTHENTICATED');assert.equal(Object.hasOwn(response,'run_id'),false);
 }finally{s.cleanup();}
});

test('stale send callback cannot orphan B; synchronous throw clears only captured A',async()=>{
 const s=setup();try {
  const a=s.client.sendCommand(s.command());s.reply(0);await a;
  const b=s.client.sendCommand(s.command());s.channel.callbacks[0](Error('late A send'));s.reply(1);assert.equal((await b).ok,true);
  const send=s.channel.send;s.channel.send=()=>{throw Error('sync send');};await assert.rejects(s.client.sendCommand(s.command()),/sync send/);s.channel.send=send;
  const c=s.client.sendCommand(s.command());s.reply(2);assert.equal((await c).ok,true);
 }finally{s.cleanup();}
});
for(const event of ['disconnect','close'])test(`${event} retires wrapper; replacement rejects old generation and callback`,async()=>{
 const s=setup();let next;try {
  const a=s.client.sendCommand(s.command()), rejected=assert.rejects(a,/ACTOR_CHANNEL_CLOSED/);s.channel.emit(event);await rejected;
  await assert.rejects(s.client.sendCommand(s.command()),/ACTOR_CHANNEL_CLOSED/);
  next=createActorClient(s.channel);const b=next.sendCommand(s.command());let settled=false;b.then(()=>settled=true,()=>settled=true);
  s.reply(0);s.channel.callbacks[0](Error('old callback'));await tick();assert.equal(settled,false);s.reply(1);assert.equal((await b).ok,true);
  assert.notEqual(s.channel.sent[0].session_id,s.channel.sent[1].session_id);
 }finally{next?.close();s.cleanup();}
});

test('opt-in timeout abandons acknowledgement, late response cannot settle next command, no retry',async()=>{
 const s=setup({timeoutMs:250});try {
  await assert.rejects(s.client.sendCommand(s.command()),/ACTOR_COMMAND_TIMEOUT/);
  assert.equal(s.channel.sent.length,1);
  const b=s.client.sendCommand(s.command());let settled=false;b.then(()=>settled=true,()=>settled=true);s.reply(0);await tick();assert.equal(settled,false);s.reply(1);assert.equal((await b).ok,true);
 }finally{s.cleanup();}
});

test('attachChild frames genuine rejection/receipt unchanged and authenticates exact channel every time',async()=>{
 const s=setup();let attachment;try {
  const host=new Channel();s.f.sessions.set(host,s.f.bindings.alice);attachment=s.f.ingress.attachChild(host);
  // Two directional endpoints, like an actual inherited IPC channel.
  const send=s.channel.send.bind(s.channel);s.channel.send=(wire,callback)=>{send(wire,callback);host.emit('message',wire);};
  host.send=wire=>queueMicrotask(()=>s.channel.emit('message',wire));
  const cmd=s.f.command('submit_work',{packets:[s.f.packets.alice]});const first=await s.client.sendCommand(cmd);assert.equal(first.ok,true);const before=row(s.f);
  s.f.sessions.delete(host);assert.equal((await s.client.sendCommand(cmd)).code,'HOST_UNAUTHENTICATED');
  s.f.sessions.set(host,s.f.bindings.alice);assert.deepEqual(await s.client.sendCommand(cmd),first);assert.deepEqual(row(s.f),before);
 }finally{attachment?.detach();s.cleanup();}
});

test('rejection identity mismatch is protocol error, matching unknown status remains truthful',async()=>{
 const s=setup();try {
  const rejection={protocol_version:'chord.actor-response.v1',operation_id:'foreign',correlation_id:null,causation_id:null,ok:false,code:'COMMIT_OUTCOME_UNKNOWN',commit_status:'unknown'};
  const a=s.client.sendCommand(s.command()), denied=assert.rejects(a,/ACTOR_PROTOCOL_ERROR/);s.reply(0,rejection);await denied;
  const b=s.client.sendCommand(s.command());rejection.operation_id='same-read';s.reply(1,rejection);assert.deepEqual(await b,rejection);
 }finally{s.cleanup();}
});

test('timeout after genuine committed write is not rollback; explicit receipt recovery returns original',async()=>{
 const s=setup({timeoutMs:30});try {
  const cmd=s.f.command('submit_work',{packets:[s.f.packets.alice]});
  const a=s.client.sendCommand(cmd), committed=s.f.send('alice',cmd);assert.equal(committed.ok,true);const before=row(s.f);
  await assert.rejects(a,/ACTOR_COMMAND_TIMEOUT/);assert.deepEqual(row(s.f),before);assert.equal(s.channel.sent.length,1);
  const b=s.client.sendCommand(cmd);s.reply(0,committed);await tick();s.reply(1,s.f.send('alice',cmd));assert.deepEqual(await b,committed);assert.deepEqual(row(s.f),before);
 }finally{s.cleanup();}
});

test('invalid frames cannot select host identity or mutate canonical state; raw legacy edge stays explicit',()=>{
 const f=actorFixture(),host=new Channel();let attachment;try {
  f.sessions.set(host,f.bindings.alice);attachment=f.ingress.attachChild(host);const before=row(f), calls=f.authCalls;
  const cmd=f.command('submit_work',{packets:[f.packets.alice]});
  for(const wire of ['{',' '.repeat(1048577),JSON.stringify({protocol_version:'chord.actor-ipc-request.v1',command:cmd}),JSON.stringify({protocol_version:'chord.actor-ipc-request.v2',session_id:randomUUID(),request_id:randomUUID(),command:cmd})])host.emit('message',wire);
  assert.equal(f.authCalls,calls);assert.deepEqual(row(f),before);assert.equal(host.sent.length,0);
  host.emit('message',JSON.stringify({...cmd,type:'project_context',payload:{},expected_revision:null}));assert.equal(host.sent[0].protocol_version,'chord.actor-response.v1');assert.equal(host.sent[0].ok,true);assert.deepEqual(row(f),before);
 }finally{attachment?.detach();f.cleanup();}
});

for(const repeated of [false,true])test(`actual child late A after replacement: ${repeated?'identical repeated read':'different read types'}`,{timeout:30000},async()=>{
 const f=actorFixture();let child,attachment;try {
  child=fork(new URL('./ipc-correlation-worker.js',import.meta.url),[],{execPath:process.execPath,stdio:['pipe','pipe','pipe','ipc'],serialization:'json'});
  let stderr='';child.stderr.on('data',b=>stderr+=b);
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const next=async()=>{const x=await lines.next();assert.equal(x.done,false,stderr);const v=JSON.parse(x.value);assert.equal(v.pid,child.pid);return v;};
  await next();f.sessions.set(child,f.bindings.alice);
  const deliveries=[], realSend=child.send.bind(child);child.send=(wire,callback)=>{deliveries.push(wire);callback?.(null);return true;};
  attachment=f.ingress.attachChild(child);
  const a=f.command('project_context',{},null,'same-read');
  child.stdin.write(JSON.stringify({label:'A',command:a})+'\n');assert.equal((await next()).sent,'A');
  while(deliveries.length<1)await tick();const before=row(f);assert.equal(f.submit('alice').ok,true);
  const b=repeated?a:f.command('observe_outcomes',{task_ids:[f.packets.alice.task_id]},null,'same-read');
  child.stdin.write(JSON.stringify({label:'B',command:b})+'\n');
  const notices=[await next(),await next()];assert.ok(notices.some(x=>x.label==='A'&&x.error==='ACTOR_CHANNEL_CLOSED'));assert.ok(notices.some(x=>x.sent==='B'));
  while(deliveries.length<2)await tick();const after=row(f);assert.notDeepEqual(before,after);
  realSend(deliveries[0]);realSend(deliveries[0]);realSend(deliveries[1]);
  const result=await next();assert.equal(result.label,'B');assert.equal(result.response.ok,true);
  if(repeated)assert.equal(result.response.result.context.tasks.length,1);else {assert.ok(Array.isArray(result.response.result.outcomes),'B must receive outcomes, not late A context');assert.equal(result.response.result.outcomes.length,1);}
  assert.deepEqual(row(f),after);
  child.stdin.end(JSON.stringify({close:true})+'\n');await new Promise((resolve,reject)=>child.once('exit',(code,signal)=>code===0&&!signal?resolve():reject(Error(stderr))));
 }finally{attachment?.detach();if(child?.exitCode===null)child.kill();f.cleanup();}
});
