import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
import { createCoordinatedChord } from '../src/index.js';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
const [mode,json]=process.argv.slice(2), config=JSON.parse(json);
let time=mode==='restore'?30102:101,calls=0;
const result={status:'completed',outcome:'succeeded',summary:'killed-owner-effect'};
const block=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
const seam=point=>{process.send({point,pid:process.pid,calls},()=>block());};
const execute=()=>{calls++;appendFileSync(config.effect,'effect\n');if(config.point==='effect'){seam('effect');return new Promise(()=>{});}return result;};
const c=createCoordinatedChord({storage:{path:config.path,mode:'existing',expectedIdentity:config.identity},trustedHost:{clock:{now:()=>time}},adapterRouter:{fallback:{execute}}});
c.owner.acquire({expectedRevision:c.observer.inspect().revision});
if(mode==='restore'){
  const acquired=c.observer.inspect();const outcome=await c.owner.runCycle();
  console.log(JSON.stringify({pid:process.pid,acquired,final:c.observer.inspect(),outcome,calls,replay:c.observer.replayEnvelope()}));c.owner.close();
}else{
  time=102;c.owner.renew({expectedRevision:c.observer.inspect().revision});
  if(config.point==='renew')seam('renew');
  else {
    if(config.point==='intent'){
      const apply=Reflect.apply;
      Reflect.apply=function(fn,self,args){if(fn===execute){seam('intent');block();}return apply(fn,self,args);};
    }
    if(config.point==='result'){
      const exec=DatabaseSync.prototype.exec;
      DatabaseSync.prototype.exec=function(sql){const r=exec.call(this,sql);if(sql==='COMMIT'&&calls===1){seam('result');block();}return r;};
    }
    await c.owner.runCycle();
  }
}
