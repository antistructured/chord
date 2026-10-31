import { createInterface } from 'node:readline';
import { createActorClient } from '../src/runtime/actor-client.js';
let client;
const log = value => console.log(JSON.stringify({pid:process.pid,...value}));
log({ready:true});
for await (const line of createInterface({input:process.stdin})) {
  const input = JSON.parse(line);
  if (input.close) break;
  client?.close();
  client = createActorClient();
  const promise = client.sendCommand(input.command);
  promise.then(response => log({label:input.label,response}),error => log({label:input.label,error:error.message}));
  log({sent:input.label});
}
client?.close(); process.disconnect();
