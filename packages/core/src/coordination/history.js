import { Envelope, CoordinationState, GenesisRecord, CommitRecord, LeaseEvidence, AdminEvidence, CommandEvidence, requireTrue, PROTOCOL_VERSION } from './contracts.js';
import { replayRuntime } from './runtime.js';
import { replayCommand } from './commands.js';
import { sameData, applyChanges, canonicalProjection } from '../platform/history.js';
import { reduceTrace } from '../platform/trace-reducer.js';
import { lifecycle, adminCandidate, genesisState, crossInvariants, identityOf } from './state.js';

/** Complete, ordered combined replay. No clock, adapters, storage or callbacks. */
export function reduceCoordinationTrace(value) {
  const envelope = Envelope.assert(value), journal = envelope.registry.event_journal;
  const groups = []; let pending = [];
  for (const event of journal) {
    pending.push(event);
    if (['state_initialized','state_committed'].includes(event.type)) { groups.push(pending); pending = []; }
  }
  requireTrue(!pending.length && groups.length === envelope.coordination_history.length && groups.length > 0, 'INVALID_HISTORY');
  let previous, domain, c; const prefix = [];
  for (let i = 0; i < groups.length; i++) {
    const events = groups[i], closing = events.at(-1), record = envelope.coordination_history[i];
    prefix.push(...events);
    const nextDomain = reduceTrace(prefix);
    if (i === 0) {
      GenesisRecord.assert(record);
      c = CoordinationState.assert(record.state);
      requireTrue(closing.type === 'state_initialized' && closing.event_id === record.domain_commit_id && nextDomain.run.revision === 0 && sameData(c,genesisState(identityOf(c),c.logical_now)), 'INVALID_HISTORY');
      const pristine = {
        run:{run_id:c.run_id,schema_version:'chord.contracts.v1',revision:0,state:'created',causation_id:null,correlation_id:null},
        artifacts:{},domains:{},tasks:{},task_queue:[],execution_results:[],trigger_state:{},specs:[],authority:null,pending_attempts:{},active_attempts:{}
      };
      requireTrue(sameData(canonicalProjection(nextDomain),pristine), 'INVALID_HISTORY');
    } else {
      CommitRecord.assert(record);
      requireTrue(record.ordinal === i && record.revision === i && closing.run_revision === i && record.domain_commit_id === closing.event_id && record.previous_domain_commit_id === previous.domain_commit_id && record.operation === closing.payload.operation && record.at === closing.at, 'INVALID_HISTORY');
      const nextC = CoordinationState.assert(applyChanges(c,record.changes));
      requireTrue(nextC.run_id === c.run_id && nextC.incarnation_id === c.incarnation_id && record.at >= c.logical_now && nextC.logical_now >= record.at, 'INVALID_HISTORY');
      let expected;
      if (['acquire','renew','release'].includes(record.operation)) {
        LeaseEvidence.assert(record.evidence);
        expected = lifecycle({registry:domain,coordination:c},{kind:record.operation,owner_id:nextC.lease.owner_id},record.at,nextC.logical_now);
        expected.registry.run.revision = i;
        requireTrue(sameData(record.evidence,expected.evidence) && sameData(canonicalProjection(nextDomain),canonicalProjection(expected.registry)), 'INVALID_HISTORY');
      } else if (record.operation === 'actor_command') {
        CommandEvidence.assert(record.evidence);
        requireTrue(c.lease.owner_id !== null && nextC.logical_now < c.lease.expires_at,'INVALID_HISTORY');
        expected = replayCommand({registry:domain,coordination:c,coordination_history:envelope.coordination_history.slice(0,i)},nextDomain,nextC,record);
        expected.registry.run.revision = i;
        requireTrue(sameData(record.evidence,expected.evidence) && sameData(canonicalProjection(nextDomain),canonicalProjection(expected.registry)),'INVALID_HISTORY');
      } else if (['runtime_claim','runtime_outcome'].includes(record.operation)) {
        requireTrue(c.lease.owner_id !== null && nextC.logical_now < c.lease.expires_at,'INVALID_HISTORY');
        expected = replayRuntime({registry:domain,coordination:c},nextDomain,nextC,record);
        expected.registry.run.revision = i;
        requireTrue(sameData(record.evidence,expected.evidence) && sameData(canonicalProjection(nextDomain),canonicalProjection(expected.registry)),'INVALID_HISTORY');
      } else {
        AdminEvidence.assert(record.evidence);
        requireTrue(record.evidence.operation === record.operation && c.lease.owner_id !== null && nextC.logical_now < c.lease.expires_at, 'INVALID_HISTORY');
        const raw = {...nextDomain,event_journal:nextDomain.event_journal.slice(0,-1)};
        expected = adminCandidate({registry:domain,coordination:c},{operation:record.operation,nextRegistry:raw,nextPolicy:record.operation === 'coordination_policy' ? nextC.policy : null,audit_label:record.evidence.audit_label},nextC.logical_now);
      }
      requireTrue(sameData(expected.coordination,nextC), 'INVALID_HISTORY');
      c = nextC;
    }
    crossInvariants(nextDomain,c); domain = nextDomain; previous = record;
  }
  requireTrue(sameData(domain,envelope.registry) && sameData(c,envelope.coordination), 'INVALID_HISTORY');
  return {registry:domain,coordination:c,coordination_history:envelope.coordination_history};
}
