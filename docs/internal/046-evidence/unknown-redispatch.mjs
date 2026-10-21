
import { createChord } from '../../../packages/core/src/index.js';
import { installHost, queueOptions } from '../../../packages/core/tests/fixtures/host.js';
let calls=0;
const c=createChord({adapterRouter:{fallback:{execute(){calls++;throw Error('mock timeout');}}}});
const h=installHost(c);
const {packets}=c.registerSpecAndQueue({schema_version:'chord.contracts.v1',spec_type:'IntentSpec',project:'audit',phase:'verify',do:['mock']},queueOptions(h));
const first=await c.runCycle();
const statusBefore=c.exportRegistry().registry.tasks[packets[0].task_id].status;
c.replayTask(packets[0].task_id,{expectedRevision:c.getRunRevision()});
const second=await c.runCycle();
console.log(JSON.stringify({calls,statusBefore,firstUncertain:first.uncertain,secondUncertain:second.uncertain}));
if(calls!==2 || statusBefore!=='uncertain') process.exit(1);
