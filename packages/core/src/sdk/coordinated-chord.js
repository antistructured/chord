import { randomUUID } from 'node:crypto';
import { openCoordinatedSqliteStore } from '../runtime/storage/coordinated-sqlite.js';
import { createCoordinatedOwner } from '../registry/coordinated-owner.js';
import { createActorIngress } from '../runtime/actor-ingress.js';
import { createAdapterRouter, resolveAdapter } from '../platform/adapter-routing.js';
import { createRuntimePolicy } from '../platform/policy.js';
import { selectReadyTask } from '../platform/task-queue.js';
import { prepareTaskExecution } from '../execution/task-packets.js';
import { clonePlainData, AuthoritySnapshot, ReconciliationRequest } from '../contracts/sigils.js';
import { evaluateAuthority } from '../platform/authorization.js';
import { reconcileTask } from '../platform/reconciliation.js';
import { planClaim, packetOf, executable } from '../coordination/runtime.js';
import { reduceCoordinationTrace } from '../coordination/history.js';
import { requireTrue, increment, uuid } from '../coordination/contracts.js';

/** EXPERIMENTAL privileged single-host v2 factory. Starts unacquired. No legacy
 * constructor/recovery, adapter lookup or authority installation at startup.
 * Adapter opt-in registration: {adapter,execution_context:'chord.execution-context.v2'}.
 */
export function createCoordinatedChord(options = {}) {
  const clock = options.trustedHost?.clock || {now:Date.now}, ownerId = options.owner_id || randomUUID(); uuid(ownerId);
  const store = openCoordinatedSqliteStore({...options.storage,clock});
  try {
    if (options.storage.mode === 'create') store.init();
    const port = createCoordinatedOwner(store,ownerId);
    // Store references only; router getters/construction are deferred to acquired work.
    const routerConfig = options.adapterRouter || {}, policyConfig = options.runtimePolicy || {};
    function adminMutation(operation,expectedRevision,build,nextPolicy = null,audit_label = 'host-admin') {
      return port.guarded(() => {
        const current = port.eligible(); requireTrue(current.revision === expectedRevision,'STALE_REVISION');
        const r = current.envelope.registry, value = build(r,current.now);
        r.run.revision = increment(current.revision);
        const saved = port.commit(expectedRevision,{kind:'admin',operation,nextRegistry:r,nextPolicy,audit_label});
        return {...saved,value};
      });
    }
    const admin = Object.freeze({
      // Explicit trusted maintenance; not a generic SDK dispatcher or actor API.
      commitRun({expectedRevision,nextRegistry,audit_label = 'host-maintenance'}) {
        return port.guarded(() => { port.eligible(); return port.commit(expectedRevision,{kind:'admin',operation:'host_commit',nextRegistry:clonePlainData(nextRegistry),nextPolicy:null,audit_label}); });
      },
      setAuthoritySnapshot(snapshot,{expectedRevision}) { return adminMutation('authority_snapshot',expectedRevision,r => {
        const value = AuthoritySnapshot.assert(snapshot); requireTrue(value.authority_revision === (r.authority ? increment(r.authority.authority_revision) : 0),'STALE_REVISION');
        requireTrue(value.run_id === r.run.run_id,'RUN_MISMATCH');
        for (const a of r.authority?.approvals || []) if (a.consumed_by_attempt_id !== null) {
          const next = value.approvals.find(x => x.approval_id === a.approval_id);
          requireTrue(next && next.consumed_by_attempt_id === a.consumed_by_attempt_id,'INVALID_SEMANTICS');
        }
        r.authority = value; return value;
      }); },
      setCoordinationPolicy(nextPolicy,{expectedRevision,audit_label = 'host-policy'}) { return adminMutation('coordination_policy',expectedRevision,() => null,nextPolicy,audit_label); },
      reconcileTask(request) {
        const value = ReconciliationRequest.assert(request);
        // Trusted host must freshly authenticate this human out of band.
        return adminMutation('reconcile_effect',value.expectedRevision,(r,now) => {
          const before = r.event_journal.length, result = reconcileTask(r,value,now);
          // Effectful legacy diagnostic is not canonical here; outer v2 commit
          // records the exact reconciliation fact with one linked revision.
          r.event_journal.length = before; return result;
        });
      },
      readmitTask(taskId,{expectedRevision}) { return adminMutation('readmit_task',expectedRevision,(r,now) => {
        const task = r.tasks[taskId], op = r.operations?.[task?.operation_id];
        requireTrue(task && ['uncertain','blocked','dead_letter'].includes(task.status),'INVALID_TRANSITION');
        requireTrue(op?.state === 'not_executed' && op.reconciliation_id,'RECONCILIATION_REQUIRED');
        const decision = evaluateAuthority({stage:'admit',now,run:r.run,task:{...task,status:'queued'},authority:r.authority}); requireTrue(decision.allowed,decision.code);
        task.status = 'queued'; task.retry_count = 0; op.state = 'requested'; op.attempt_id = null;
        const q = r.task_queue.find(q => q.task_id === taskId); requireTrue(q,'STALE_ATTEMPT'); Object.assign(q,{status:'queued',retry_count:0,available_at:now,lease_expires_at:null,last_error:null});
        delete r.active_attempts[taskId]; delete r.pending_attempts[taskId]; return task;
      }); }
    });
    async function runCycle() {
      const prepared = port.guarded(() => {
        const current = port.eligible(), r = current.envelope.registry;
        requireTrue(executable(r),'RUN_NOT_ACTIVE');
        const ready = selectReadyTask(r,current.now);
        if (!ready) return {response:{ok:true,skipped:true}};
        const policy = createRuntimePolicy(policyConfig);
        const leased = r.task_queue.filter(q => q.status === 'leased');
        if (leased.length >= policy.globalMaxLeased || leased.filter(q => q.target_entity === ready.target_entity).length >= policy.perEntityMaxLeased) return {response:{ok:true,deferred:true}};
        const task = r.tasks[ready.task_id], attemptId = r.pending_attempts[task.task_id]?.attempt_id || randomUUID();
        const plan = planClaim(current.envelope,task.task_id,attemptId,current.now);
        const registration = resolveAdapter(createAdapterRouter(routerConfig),task.target_entity);
        if (!registration) return {response:{ok:false,code:'no_adapter'}};
        const optIn = Object.hasOwn(registration,'adapter');
        if (optIn) requireTrue(registration.execution_context === 'chord.execution-context.v2','UNSUPPORTED_PROTOCOL');
        const adapter = optIn ? registration.adapter : registration, d = plan.dispatch;
        const context = {run_id:r.run.run_id,schema_version:r.run.schema_version,task_id:task.task_id,task_revision:task.task_revision ?? 0,queue_id:d.queue_id,attempt_id:d.attempt_id,lease_expires_at:d.task_lease_expires_at};
        if (optIn) context.coordination = Object.freeze({protocol_version:'chord.execution-context.v2',run_id:d.run_id,incarnation_id:d.incarnation_id,owner_id:d.owner_id,generation:d.generation,owner_lease_expires_at:d.owner_lease_expires_at,dispatch_revision:d.dispatch_revision,operation_id:d.operation_id,attempt_id:d.attempt_id,idempotency_key:d.idempotency_key});
        const invoke = prepareTaskExecution(adapter,packetOf(task),context), credential = port.capture();
        const saved = port.commit(current.revision,{kind:'runtime_claim',nextRegistry:plan.registry,dispatch:d},credential);
        return {invoke,credential,dispatch:Object.freeze(saved.result.dispatch)};
      });
      if (prepared.response) return prepared.response;
      const {invoke,credential,dispatch} = prepared;
      // Nothing host-executable (getter/router/hook/await) between this fresh
      // authoritative check and entry of the already captured callable.
      port.guarded(() => port.checkDispatch(credential,dispatch));
      let result, errorCode = null;
      try { result = await invoke(); }
      catch { errorCode = 'ADAPTER_ERROR'; }
      // Persistence failures are NOT adapter failures: never compensate/retry.
      return port.guarded(() => {
        const revision = store.load().revision;
        return port.commit(revision,{kind:'runtime_outcome',dispatch,adapter_result:errorCode ? null : result,error_code:errorCode},credential);
      });
    }
    const observer = Object.freeze({inspect:()=>store.load(),exportEnvelope:()=>store.load().envelope,replayEnvelope:()=>reduceCoordinationTrace(store.load().envelope),readHistory:args=>store.readHistory(args),close:()=>port.close()});
    const owner = Object.freeze({acquire:({expectedRevision})=>port.acquire(expectedRevision),renew:({expectedRevision})=>port.guarded(()=>port.commit(expectedRevision,{kind:'renew'})),release:({expectedRevision})=>port.guarded(()=>{const saved = port.commit(expectedRevision,{kind:'release'}); port.lose(); return saved;}),runCycle,close:()=>port.close()});
    return Object.freeze({observer,owner,admin,createActorIngress:({authenticate})=>createActorIngress({authenticate,clock,load:()=>store.load(),commitCommand:(binding,command)=>port.guarded(()=>port.commit(command.expected_revision,{kind:'actor_command',binding,command}).result)})});
  } catch (e) { store.close(); throw e; }
}
