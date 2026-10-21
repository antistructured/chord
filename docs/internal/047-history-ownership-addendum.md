# 047 — Host candidate history ownership addendum

A valid-shaped caller-appended journal record let generic host CAS report success while authoritative replay rejected the installed history. Reproduced before repair: commit ok/revision1, replay RUN_MISMATCH. A same-run unsupported diagnostic regression likewise failed before correction.

Owner.install now rejects any candidate journal difference before kernel event capture; generic host state maintenance cannot fabricate events or operation labels. Persisted journal run/schema metadata also must match its registry when present (legacy unversioned diagnostics remain explicitly non-authoritative). Regression now rejects INVALID_HISTORY with unchanged canonical state. Entire suite160/0,1371 assertions. No security/046 expectations relaxed. Final source/artifact must be resealed and rechecked; earlier artifacts remain superseded evidence.
