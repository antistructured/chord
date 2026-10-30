import { requireTrue } from '../coordination/contracts.js';

/** Private host port. One acknowledged credential for this closure's lifetime.
 * Reads never refresh it. Guard covers synchronous host preparation, not await.
 */
export function createCoordinatedOwner(store, ownerId) {
  let credential = null, lost = false, busy = false, acquired = false;
  const fatal = e => e?.commitStatus === 'unknown' || ['OWNER_LOST','LEASE_EXPIRED','CLOCK_ROLLBACK','STORE_CLOSED','STORAGE_CORRUPT','STORAGE_UNAVAILABLE','COMMIT_OUTCOME_UNKNOWN'].includes(e?.code);
  function guarded(work) {
    requireTrue(!busy,'REENTRANT_MUTATION'); busy = true;
    try { return work(); } catch(e) { if (fatal(e)) lost = true; throw e; } finally { busy = false; }
  }
  function token() { requireTrue(!lost,'OWNER_LOST'); requireTrue(credential !== null,'NOT_OWNER'); return credential; }
  return Object.freeze({
    guarded,
    eligible: () => store.checkOwner({credential:token()}),
    capture: () => Object.freeze({...token()}),
    acquire(expectedRevision) { return guarded(() => {
      requireTrue(!lost && !acquired,'OWNER_LOST');
      const saved = store.commit({expectedRevision,credential:null,change:{kind:'acquire',owner_id:ownerId}});
      credential = Object.freeze({...saved.result.credential}); acquired = true;
      return {ok:true,revision:saved.revision,commitId:saved.commitId,lease:saved.result.lease};
    }); },
    commit(expectedRevision,change,captured = null) { return store.commit({expectedRevision,credential:captured || token(),change}); },
    checkDispatch(captured,dispatch) { return store.checkDispatch({credential:captured,dispatch}); },
    lose() { lost = true; },
    close() { requireTrue(!busy,'REENTRANT_MUTATION'); lost = true; store.close(); }
  });
}
