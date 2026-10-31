import { createAdapterServer, createMockAgentAdapter } from '../src/interop/index.js';

const adapter = createMockAgentAdapter();
const server = createAdapterServer({
  advertisement: adapter.advertisement,
  handle: adapter.handle,
  channel: process,
  onShutdown: () => setImmediate(() => process.exit(0))
});
process.send({ type: 'ready', advertisement: adapter.advertisement });
process.on('disconnect', () => { server.close(); process.exit(0); });
