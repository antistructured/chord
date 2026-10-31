import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSqliteStore, openCoordinatedSqliteStore } from '../src/index.js';
import { nativeCall } from '../src/runtime/storage/diagnostics.js';

const secret = 'SECRET_PAYLOAD_PATH_CREDENTIAL_054';
const scratch = process.env.TMPDIR || '/home/d/.hermes/cache/scratch';
function capture(work, enabled = true) {
  const env = process.env.CHORD_STORAGE_DIAGNOSTICS, write = fs.writeSync;
  let text = '';
  process.env.CHORD_STORAGE_DIAGNOSTICS = enabled ? '1' : '0';
  fs.writeSync = (fd, chunk) => { assert.equal(fd, 2); text += chunk; return Buffer.byteLength(chunk); };
  try { return { value: work(), get text() { return text; } }; }
  finally { fs.writeSync = write; if (env === undefined) delete process.env.CHORD_STORAGE_DIAGNOSTICS; else process.env.CHORD_STORAGE_DIAGNOSTICS = env; }
}
const rows = text => text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line.replace(/^chord.storage.diagnostic /, '')));
const rejection = (fn, code, status) => assert.throws(fn, e => e.code === code && e.message === code && e.path === '$' && (status === undefined || e.commitStatus === status) && !JSON.stringify(e).includes(secret));
const raw = (path, table) => { const db = new DatabaseSync(path); try { return db.prepare(`SELECT * FROM ${table}`).all(); } finally { db.close(); } };
function fixture(version) {
  const dir = mkdtempSync(join(scratch, 'chord-diag-')), path = join(dir, `${secret}.db`);
  const open = () => version === 1 ? openSqliteStore({path, mode:'create'}) : openCoordinatedSqliteStore({path, mode:'create', expectedIdentity:null, clock:{now:()=>100}});
  const store = open();
  const identity = version === 2 ? store.init().identity : null;
  return {dir, path, store, identity, cleanup() {store.close();rmSync(dir,{recursive:true,force:true});}};
}

test('diagnostics only emit allowlisted operations and numeric fields; disabled is silent', () => {
  const root = Object.assign(new Error(secret), {code:secret, syscall:secret, path:secret, errcode:5, errno:-13});
  for (const enabled of [false,true]) {
    const out = capture(() => assert.throws(() => nativeCall('sqlite.begin', () => {throw root;}), e => e === root), enabled);
    assert.deepEqual(rows(out.text), enabled ? [{operation:'sqlite.begin',errcode:5,errno:-13}] : []);
    assert.ok(!out.text.includes(secret));
  }
  assert.equal(capture(() => assert.throws(() => nativeCall(secret, () => {throw root;}))).text, '');
});

test('diagnostic accessors, serialization and logging failures preserve exact native error', () => {
  const root = new Error(secret), old = Object.getOwnPropertyDescriptor(root,'errcode');
  Object.defineProperty(root,'errcode',{get(){throw Error('getter');},configurable:true});
  capture(() => assert.throws(() => nativeCall('sqlite.open', () => {throw root;}), e => e === root));
  if (old) Object.defineProperty(root,'errcode',old); else delete root.errcode;
  const env = process.env.CHORD_STORAGE_DIAGNOSTICS, stringify = JSON.stringify, write = fs.writeSync;
  process.env.CHORD_STORAGE_DIAGNOSTICS='1';
  try {
    JSON.stringify = () => {throw Error('serializer');};
    assert.throws(() => nativeCall('sqlite.open', () => {throw root;}), e => e === root);
    JSON.stringify = stringify;
    fs.writeSync = () => {throw Error('logger');};
    assert.throws(() => nativeCall('sqlite.open', () => {throw root;}), e => e === root);
  } finally { JSON.stringify=stringify;fs.writeSync=write;if(env===undefined)delete process.env.CHORD_STORAGE_DIAGNOSTICS;else process.env.CHORD_STORAGE_DIAGNOSTICS=env; }
});

for (const version of [1,2]) {
  test(`v${version} public startup captures first quick_check failure before retirement, sanitized and silent when disabled`, () => {
    const f=fixture(version), prepare=DatabaseSync.prototype.prepare;
    try {
      for (const enabled of [false,true]) {
        DatabaseSync.prototype.prepare=function(sql) {if(sql==='PRAGMA quick_check')throw Object.assign(Error(secret),{errcode:5, code:secret, syscall:secret});return prepare.call(this,sql);};
        const out=capture(() => rejection(() => version===1 ? openSqliteStore({path:f.path,mode:'existing'}) : openCoordinatedSqliteStore({path:f.path,mode:'existing',expectedIdentity:f.identity}), 'STORAGE_UNAVAILABLE'),enabled);
        assert.ok(!out.text.includes(secret));
        if(enabled) assert.deepEqual(rows(out.text)[0],{operation:'sqlite.quick_check',errcode:5,errno:null}); else assert.equal(out.text,'');
      }
    } finally {DatabaseSync.prototype.prepare=prepare;f.cleanup();}
  });

  test(`v${version} missing file and actual permission failure have first native operation without paths`, () => {
    const f=fixture(version);
    const open=path=>version===1 ? openSqliteStore({path,mode:'existing'}) : openCoordinatedSqliteStore({path,mode:'existing',expectedIdentity:f.identity});
    try {
      const missing=capture(()=>rejection(()=>open(join(f.dir,'missing')), 'STORAGE_UNAVAILABLE'));
      assert.equal(rows(missing.text)[0].operation,'fs.lstat');
      assert.equal(rows(missing.text)[0].errno,-2);
      f.store.close();chmodSync(f.path,0);
      const denied=capture(()=>rejection(()=>open(f.path),'STORAGE_UNAVAILABLE'));
      assert.equal(rows(denied.text)[0].operation,'sqlite.open');
      assert.equal(rows(denied.text)[0].errcode,14);
      assert.ok(!denied.text.includes(secret));
    } finally {chmodSync(f.path,0o600);f.cleanup();}
  });
}

test('v2 canonical unknown COMMIT acknowledgement survives broken logger; no retry, complete row shows one commit', () => {
  const f=fixture(2), exec=DatabaseSync.prototype.exec, write=fs.writeSync, env=process.env.CHORD_STORAGE_DIAGNOSTICS;
  const before=raw(f.path,'chord_coordination');let commits=0;
  try {
    process.env.CHORD_STORAGE_DIAGNOSTICS='1';fs.writeSync=()=>{throw Error(secret);};
    DatabaseSync.prototype.exec=function(sql){const value=exec.call(this,sql);if(sql==='COMMIT'){commits++;throw Object.assign(Error(secret),{errcode:10});}return value;};
    rejection(()=>f.store.commit({expectedRevision:0,credential:null,change:{kind:'acquire',owner_id:randomUUID()}}),'COMMIT_OUTCOME_UNKNOWN','unknown');
    DatabaseSync.prototype.exec=exec;
    const after=raw(f.path,'chord_coordination');
    assert.equal(commits,1);assert.equal(after.length,1);assert.equal(after[0].revision,before[0].revision+1);
    assert.ok(!JSON.stringify(after).includes(secret));
    rejection(()=>f.store.load(),'STORE_CLOSED','not_committed');
  } finally {DatabaseSync.prototype.exec=exec;fs.writeSync=write;if(env===undefined)delete process.env.CHORD_STORAGE_DIAGNOSTICS;else process.env.CHORD_STORAGE_DIAGNOSTICS=env;f.cleanup();}
});

test('actual independent WAL writer contention identifies BEGIN, no canonical row changes', async () => {
  const f=fixture(2), before=raw(f.path,'chord_coordination');
  const child=spawn(process.execPath,['--input-type=module','-e',`import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1]);db.exec('BEGIN IMMEDIATE');process.stdout.write('ready\\n');process.stdin.resume();process.stdin.on('data',()=>{db.exec('ROLLBACK');db.close();process.exit(0);});`,f.path],{stdio:['pipe','pipe','pipe']});
  let stderr='';child.stderr.on('data',v=>{stderr+=v;});
  try {
    const [ready]=await once(child.stdout,'data');assert.match(String(ready),/ready/);
    const out=capture(()=>rejection(()=>f.store.commit({expectedRevision:0,credential:null,change:{kind:'acquire',owner_id:randomUUID()}}),'STORAGE_UNAVAILABLE','not_committed'));
    assert.deepEqual(rows(out.text)[0],{operation:'sqlite.begin',errcode:5,errno:null});
    assert.deepEqual(raw(f.path,'chord_coordination'),before);
  } finally {
    const exited=once(child,'exit');child.stdin.write('release');const [code]=await exited;assert.equal(code,0,stderr);f.cleanup();
  }
});
