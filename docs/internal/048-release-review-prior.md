# 048 — Prior independent release review (superseded artifact)

Verdict recorded honestly: **NO-GO for the older /final artifact**, SHA2567d78e2f60bfc36d6c21a00cd33468fc9331f45b24ee78a36dd6356cbeaae8f5d. This is not a verdict on the later /sealed artifact. The reviewer ended before the reseal message was delivered.

Same-model reviewer independently ran core159/0, runtime/demo/dry-run, safety21/0, six independently authored public-package tests on Node24.18.1/Bun1.3.14, fresh installed canonical workflow, and source archive extraction/repack identical to that older artifact. F6A01/03/04 tested improvements held. It reproduced the parent-reported accepted host journal append followed by replay RUN_MISMATCH against the old tarball (exit2 diagnostic); source correction rejected unchanged and core160/0. Thus F6A02/05/06 could not close for that artifact.

Old evidence is retained in048-evidence/prior-independent-gate; independently authored public tests are preserved as048-evidence/independent-public-tests.mjs (copy into a fresh installed consumer to execute). Known credential scan63files/zero pattern matches, not universal absence. P1 licensing/extra dev payload remained explicit. No source/report changes, staging, version/tag/push/publication by reviewer.

Replacement inputs:048-evidence/artifact-manifest.json now names /artifacts/sealed/ tarball SHA256b498bfb82729df17e8be5f0a1f73913d07f2a2ef53a31401bd2fdc8d9af74f18 and exact retained source archive. Parent verified zero current-source hash differences, bit-identical source-copy repack and fresh Node/Bun full consumer. A separate independent replacement-artifact gate is pending; do not reinterpret this old NO-GO as approval.
