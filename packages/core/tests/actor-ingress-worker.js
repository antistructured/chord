import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { createActorClient } from '../src/runtime/actor-client.js';
const client = createActorClient();
console.log(JSON.stringify({ready:true,pid:process.pid,api:Object.keys(client),argv:process.argv.slice(2)}));
for await (const line of createInterface({input:process.stdin})) {
  const input = JSON.parse(line);
  if (input.close) break;
  let response;
  if (input.raw !== undefined) { const wait = once(process,'message'); process.send(input.raw); response = JSON.parse((await wait)[0]); }
  else response = await client.sendCommand(input.command);
  console.log(JSON.stringify({pid:process.pid,response}));
}
client.close(); process.disconnect();
