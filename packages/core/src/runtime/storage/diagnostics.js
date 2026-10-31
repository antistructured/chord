// Trusted host diagnostics only. Never copy native strings, SQL or parameters.
import fs from 'node:fs';
const operations = new Set(['fs.lstat', 'fs.open', 'fs.close', 'sqlite.open', 'sqlite.close', 'sqlite.prepare', 'sqlite.exec', 'sqlite.all', 'sqlite.get', 'sqlite.run', 'sqlite.quick_check', 'sqlite.begin', 'sqlite.commit', 'sqlite.rollback']);
export function nativeCall(operation, work) {
  try { return work(); }
  catch (error) {
    // Even hostile accessors, serializers and stderr failures cannot mask error.
    try {
      if (process.env.CHORD_STORAGE_DIAGNOSTICS === '1' && operations.has(operation)) {
        const descriptors = error == null ? {} : Object.getOwnPropertyDescriptors(error);
        const numeric = key => Number.isInteger(descriptors[key]?.value) ? descriptors[key].value : null;
        const fields = Object.assign(Object.create(null), { operation, errcode: numeric('errcode'), errno: numeric('errno') });
        // Synchronous fd write cannot enqueue a later stream error that escapes
        // this guard or invoke a host-supplied stream callback inside SQL.
        fs.writeSync(2, `chord.storage.diagnostic ${JSON.stringify(fields)}\n`);
      }
    } catch {}
    throw error;
  }
}
const operationFor = (sql, fallback) => sql === 'PRAGMA quick_check' ? 'sqlite.quick_check' : sql === 'BEGIN IMMEDIATE' ? 'sqlite.begin' : sql === 'COMMIT' ? 'sqlite.commit' : sql === 'ROLLBACK' ? 'sqlite.rollback' : fallback;
// Internal fixed native facade, not a host injection point. Native receivers and
// arguments are preserved; logging occurs at the failing call, before cleanup.
export function diagnosticDatabase(db) {
  return {
    exec(sql) { return nativeCall(operationFor(sql, 'sqlite.exec'), () => db.exec(sql)); },
    prepare(sql) {
      const statement = nativeCall(operationFor(sql, 'sqlite.prepare'), () => db.prepare(sql));
      return Object.fromEntries(['all', 'get', 'run'].map(method => [method, (...args) => nativeCall(operationFor(sql, `sqlite.${method}`), () => statement[method](...args))]));
    },
    close() { return nativeCall('sqlite.close', () => db.close()); }
  };
}
