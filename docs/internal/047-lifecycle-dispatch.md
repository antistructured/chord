# 047 — Pass 3: Lifecycle dispatch safety

Gate: COMPLETE. Runtime rejects paused/failed/cancelled/completed before queue selection, rechecks inside atomic claim and rechecks on result against the fresh owner. Task permission/approval reevaluation remains unchanged. Terminal run/task cancellation cannot be overwritten by a late result. Resume now requires active host-attested human principal; protected queued tasks also require a valid exact pending-attempt approval by that human. State/authority installation and resume are trusted-host APIs, not authentication inferred from client IDs.

New lifecycle-integrity.test.js: baseline 2 pass/4 fail; corrected 6/0. Focused lifecycle + original authorization/adversarial/continuity: 62/0. Full logs in 047-evidence/lifecycle-*.log. Continuity fixture now supplies human principal to authorized resume; terminal resume still rejects INVALID_TRANSITION. No 046 probe modified. Existing unsafe canonical example's missing-human resume must be corrected after kernel passes, not permitted as a compatibility workaround.

Files: runtime-loop.js, SDK resume seam, new lifecycle tests, one continuity fixture. No dependencies/version/publication changes. Single-process guards only; effects already dispatched cannot be rolled back by pausing/cancelling.
