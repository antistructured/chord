# Failure + Recovery

Two distinct failure modes, by design (041-authority-design.md §5):

- **Pre-dispatch routing failure** (no adapter for the target entity): bounded
  retry under policy; exhausted attempts land in `dead_letter`.
- **Post-dispatch ambiguity** (adapter throws, invalid/uncorrelated result,
  expired lease, or a lost commit race): the attempt is marked `uncertain` for
  explicit host reconciliation — never blind-retried or dead-lettered.

Pre-dispatch `dead_letter` recovery uses fresh admission. Post-dispatch
`uncertain` or `blocked` work additionally requires an authorized
`reconcileTask` decision with host-verified no-effect evidence before
`replayTask(taskId)` can requeue it. Permission alone is not reconciliation.
`cancelTask(taskId)` stops task execution but cannot undo an external effect.
See `../../INTEGRITY.md` and `src/verify-runtime.js` §6–7b for the protocol.
