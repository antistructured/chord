# 047 — Contract boundary addendum during 6A revalidation

Revalidation found malformed object-valued handoff identities could enter the formerly generic persisted handoffs object. Reproduction `STATE: malformed handoff identity cannot enter persisted canonical metadata` failed before correction (the handoff installed), then passed after closed HandoffProposal/HandoffResponse/HandoffRecord and ApprovalPause contracts plus RegistryData cross-record validation. This is shape integrity, not authentication inferred from a schema; host remains responsible for authenticated actor binding. No effect authorization relaxed.

Files: contracts/sigils.js, platform/handoff.js, integrity.test.js. Original046 evidence untouched. Full suite after correction:159/0,1369 assertions; focused/source/package gates rerun against the resealed final artifact rather than reusing the earlier source snapshot. Earlier048 pack/consumer proof is retained as superseded evidence, not final-artifact proof.
