import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openCoordinatedSqliteStore, createActorIngress } from '../../src/index.js';
import { createIntentTaskPacket } from '../../src/execution/task-packets.js';
import { scopeOf } from '../../src/coordination/command-authorization.js';
export function actorFixture() {
  const dir = mkdtempSync(join(process.env.TMPDIR || '/home/d/.hermes/cache/scratch','chord-052-actors-'));
  let time = 100, token = null, sequence = 0, samples = [];
  const clock = {now:()=>samples.length ? samples.shift() : time}, path = join(dir,'run.db');
  const store = openCoordinatedSqliteStore({path,mode:'create',expectedIdentity:null,clock}), identity = store.init().identity;
  token = store.commit({expectedRevision:0,credential:null,change:{kind:'acquire',owner_id:randomUUID()}}).result.credential;
  const actors = ['alice','bob','human','human2','foreign'];
  const capabilities = ['work','chord.handoff.propose','chord.handoff.respond','chord.approval.request','chord.approval.respond'];
  const packets = Object.fromEntries(actors.map(name => [name,createIntentTaskPacket({schema_version:'chord.contracts.v1',spec_type:'IntentSpec',project:'project',phase:'build',target_entity:name,do:[`work-${name}`]})]));
  function admin(operation,change,nextPolicy = null) {
    const snapshot = store.load(), r = snapshot.envelope.registry; change(r); r.run.revision++;
    return store.commit({expectedRevision:snapshot.revision,credential:token,change:{kind:'admin',operation,nextRegistry:r,nextPolicy,audit_label:'test-host'}});
  }
  const authority = {schema_version:'chord.contracts.v1',run_id:identity.run_id,authority_revision:0,principals:actors.map(name=>({principal_id:`p-${name}`,issuer:'test-host',kind:name.startsWith('human')?'human':'service',authenticated_at:0,expires_at:100000})),actors:actors.map(name=>({actor_id:name,principal_id:`p-${name}`,kind:name.startsWith('human')?'human':'agent',roles:[],capabilities,revoked_at:null})),grants:[],approvals:[]};
  for (const [name,packet] of Object.entries(packets)) {
    for (const actor of actors) for (const capability of capabilities) {
      // Work visibility is private; coordination capabilities may be shared but
      // only installed policy pairs can see/act on coordination records.
      if (capability === 'work' ? actor !== name : name !== 'alice' || !({alice:['chord.handoff.propose','chord.approval.request'],bob:['chord.handoff.respond'],human:['chord.approval.respond'],human2:['chord.approval.respond']}[actor] || []).includes(capability)) continue;
      authority.grants.push({grant_id:`g-${name}-${actor}-${capability}`,principal_id:`p-${actor}`,actor_id:actor,capability,effect:'allow',scope:scopeOf(store.load().envelope.registry,packet),issued_at:0,expires_at:100000,revoked_at:null,requires_approval:capability==='work' && name==='alice'});
    }
  }
  admin('authority_snapshot',r=>{r.authority=authority;});
  const bindings = Object.fromEntries(actors.map(name=>[name,{binding_id:`b-${name}`,issuer:'test-host',principal_id:`p-${name}`,actor_id:name,...identity,authenticated_at:0,expires_at:100000,work_capability:'work',work_requires_approval:name==='alice'}]));
  const sessions = new Map(); for (const name of actors) sessions.set(name,bindings[name]);
  let authCalls = 0;
  const ingress = createActorIngress({clock,authenticate:channel=>{authCalls++; return sessions.get(channel) || null;},load:()=>store.load(),commitCommand:(binding,command)=>store.commit({expectedRevision:command.expected_revision,credential:token,change:{kind:'actor_command',binding,command}}).result});
  const command = (type,payload,revision = ['project_context','observe_outcomes'].includes(type)?null:store.load().revision,operation_id=`op-${++sequence}`) => ({protocol_version:'chord.actor-command.v1',operation_id,...identity,expected_revision:revision,correlation_id:null,causation_id:null,type,payload});
  const send = (actor,cmd) => ingress.handleAuthenticated(actor,JSON.stringify(cmd));
  const submit = name => send(name,command('submit_work',{packets:[packets[name]]}));
  function policy(revision = store.load().envelope.coordination.policy.policy_revision+1,options = {}) {
    const scope = scopeOf(store.load().envelope.registry,packets.alice);
    const p = {policy_revision:revision,handoffs:[{rule_id:'h-alice-bob',from_actor_id:'alice',to_actor_id:'bob',scope,actions:['accept','reject'],max_ttl_ms:10000}],approvals:[{rule_id:'a-alice-human',requesting_actor_id:'alice',approver_actor_id:'human',scope,max_ttl_ms:10000}],...options};
    return admin('coordination_policy',()=>{},p);
  }
  return {store,path,identity,clock,packets,bindings,sessions,ingress,command,send,submit,admin,policy,
    get authCalls(){return authCalls;},get token(){return token;},set token(v){token=v;},get time(){return time;},set time(v){time=v;},set samples(v){samples=v;},
    cleanup(){store.close();rmSync(dir,{recursive:true,force:true});}};
}
