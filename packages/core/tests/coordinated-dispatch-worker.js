import { createCoordinatedChord } from '../src/index.js';
let time=30100, serviceCalls=0, settle, c, cycle;
const success={status:'completed',outcome:'succeeded',summary:'fresh-process-result'};
function open(config) {
  c=createCoordinatedChord({storage:{path:config.path,mode:'existing',expectedIdentity:config.identity},trustedHost:{clock:{now:()=>time}},adapterRouter:{fallback:{execute(){serviceCalls++;process.send?.({type:'entered',pid:process.pid});return new Promise(resolve=>{settle=resolve;});}}}});
  c.owner.acquire({expectedRevision:c.observer.inspect().revision});
  return c.observer.inspect();
}
if(process.argv[2]==='sync-takeover') {
  const config=JSON.parse(process.argv[3]);time=config.time;
  try {const state=open(config);console.log(JSON.stringify({pid:process.pid,revision:state.revision,generation:state.envelope.coordination.lease.generation,status:Object.values(state.envelope.registry.tasks)[0].status,serviceCalls}));c.owner.close();}catch(e){console.error(e.code);process.exitCode=1;}
} else {
  process.on('message',async message=>{
    try {
      if(message.type==='start') {
        time=message.time;const state=open(message);
        const id=message.taskId;
        if(message.reconcile){c.admin.reconcileTask({task_id:id,principal_id:'p-human',expectedRevision:state.revision,decision:'confirmed_not_executed',evidence:{kind:'no_effect_confirmation',reference:'fresh-host-human-attestation'}});c.admin.readmitTask(id,{expectedRevision:c.observer.inspect().revision});cycle=c.owner.runCycle();}
        else process.send({type:'acquired',pid:process.pid,state,serviceCalls});
      }
      if(message.type==='finish'){settle(success);const result=await cycle;process.send({type:'finished',pid:process.pid,result,state:c.observer.inspect(),serviceCalls});}
      if(message.type==='close'){c?.owner.close();process.disconnect();}
    }catch(e){process.send({type:'error',code:e.code || e.message,pid:process.pid});}
  });
  process.send({type:'ready',pid:process.pid});
}
