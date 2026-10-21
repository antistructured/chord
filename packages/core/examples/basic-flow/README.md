# Basic Flow

Parse an IntentSpec, register it, queue task packets (requires host authority),
run one governed runtime cycle, then inspect the audit report.

Post-dispatch success commits a correlated outcome; the task and queue entry end
`completed`. See `src/verify-runtime.js` §1–5 for a runnable equivalent.
