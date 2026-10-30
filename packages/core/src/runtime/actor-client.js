import { ActorCommand } from '../coordination/contracts.js';

/** Actor-only inherited JSON IPC client. Contains no store, owner, principal
 * selection, enrollment, host method dispatcher or grant installation API. */
export function createActorClient(channel = process) {
  let pending = null, closed = false;
  const rejectPending = () => { if (pending) { pending.reject(new Error('ACTOR_CHANNEL_CLOSED')); pending = null; } };
  function listener(message) {
    if (!pending || typeof message !== 'string') return;
    let response; try { response = JSON.parse(message); } catch { return; }
    if (response?.protocol_version !== 'chord.actor-response.v1') return;
    const next = pending; pending = null; next.resolve(response);
  }
  channel.on('message',listener); channel.on('disconnect',rejectPending);
  return Object.freeze({
    sendCommand(raw) {
      if (closed || !channel.connected) return Promise.reject(new Error('ACTOR_CHANNEL_CLOSED'));
      if (pending) return Promise.reject(new Error('ACTOR_COMMAND_PENDING'));
      const command = ActorCommand.assert(raw);
      return new Promise((resolve,reject) => { pending = {resolve,reject}; channel.send(JSON.stringify(command),error => { if (error && pending) { pending = null; reject(error); } }); });
    },
    close() { closed = true; channel.off('message',listener); channel.off('disconnect',rejectPending); rejectPending(); }
  });
}
