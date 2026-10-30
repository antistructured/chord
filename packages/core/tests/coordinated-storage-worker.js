import { openCoordinatedSqliteStore } from '../src/index.js';
import { randomUUID } from 'node:crypto';
const [path, encoded] = process.argv.slice(2);
const store = openCoordinatedSqliteStore({path,mode:'existing',expectedIdentity:JSON.parse(encoded),clock:{now:()=>100}});
process.send({ready:true,pid:process.pid});
process.once('message', () => {
  let result;
  try { result = store.commit({expectedRevision:0,credential:null,change:{kind:'acquire',owner_id:randomUUID()}}); }
  catch (e) { result = {ok:false,code:e.code}; }
  process.send({pid:process.pid,result,revision:store.load().revision}, () => { store.close(); process.disconnect(); });
});
