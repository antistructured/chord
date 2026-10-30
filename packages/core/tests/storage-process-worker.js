import { openSqliteStore } from '../src/index.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [path, proposal, ready, barrier, result] = process.argv.slice(2);
const store = openSqliteStore({ path, mode: 'existing' });
writeFileSync(ready, 'ready');
while (!existsSync(barrier)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
writeFileSync(result, JSON.stringify(store.compareAndCommit(JSON.parse(readFileSync(proposal, 'utf8')))));
store.close();
