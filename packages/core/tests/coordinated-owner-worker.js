import { openCoordinatedSqliteStore } from '../src/index.js';
import { reduceCoordinationTrace } from '../src/coordination/history.js';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const [path, encoded, mode] = process.argv.slice(2);
if (mode === 'lock') {
  const db = new DatabaseSync(path);db.exec('BEGIN IMMEDIATE');
  process.send({ready:true,pid:process.pid});
  process.on('message',()=>setTimeout(()=>{db.exec('ROLLBACK');const released=Date.now();db.close();process.send({released,pid:process.pid},()=>process.disconnect());},100));
} else {
  let time=100, credential=null;
  const store=openCoordinatedSqliteStore({path,mode:'existing',expectedIdentity:JSON.parse(encoded),clock:{now:()=>time}});
  process.send({ready:true,pid:process.pid});
  process.on('message',request=>{
    if(request.kind==='close'){store.close();process.disconnect();return;}
    time=request.time;
    let result;
    try {
      if(request.kind==='inspect') {
        const state=store.load();const replay=reduceCoordinationTrace(state.envelope);
        result={ok:true,revision:state.revision,replayEqual:JSON.stringify(replay)===JSON.stringify(state.envelope),historyCount:store.readHistory().entries.length};
      } else {
        result=store.commit({expectedRevision:request.expectedRevision,credential:request.kind==='acquire'?null:credential,change:{kind:request.kind,...(request.kind==='acquire'?{owner_id:request.owner_id||randomUUID()}: {})}});
        if(request.kind==='acquire')credential=result.result.credential;
      }
    }catch(e){result={ok:false,code:e.code,commitStatus:e.commitStatus};}
    process.send({requestId:request.requestId,pid:process.pid,result});
  });
}
