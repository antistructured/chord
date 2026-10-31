import { randomUUID } from 'node:crypto';
import { ActorCommand } from '../coordination/contracts.js';
import { RequestFrame, ResponseFrame, parseActorWire, validateActorResponse } from './actor-transport.js';

const clients = new WeakMap();
/** Actor-only inherited JSON IPC client. Framing is delivery correlation, not
 * authentication. timeoutMs is opt-in local abandonment, never rollback. */
export function createActorClient(channel = process, {timeoutMs = null} = {}) {
  if (clients.has(channel)) throw new Error('ACTOR_CHANNEL_IN_USE');
  if (timeoutMs !== null && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)) throw new TypeError('INVALID_ACTOR_TIMEOUT');
  const sessionId = randomUUID();
  let pending = null, closed = false;
  function settle(request, error, response) {
    if (pending !== request) return;
    pending = null;
    if (request.timer) clearTimeout(request.timer);
    if (error) request.reject(error); else request.resolve(response);
  }
  function close() {
    if (closed) return;
    closed = true;
    channel.off('message',listener); channel.off('disconnect',close); channel.off('close',close);
    if (clients.get(channel) === close) clients.delete(channel);
    if (pending) settle(pending,new Error('ACTOR_CHANNEL_CLOSED'));
  }
  function listener(message) {
    const request = pending;
    if (!request) return;
    let frame;
    try { frame = parseActorWire(message); } catch { return; }
    // Unattributable, unframed and other-generation replies cannot acknowledge.
    if (frame?.session_id !== sessionId || frame?.request_id !== request.id) return;
    try {
      frame = ResponseFrame.assert(frame);
      settle(request,null,validateActorResponse(frame.response,request.command));
    } catch { settle(request,new Error('ACTOR_PROTOCOL_ERROR')); }
  }
  clients.set(channel,close);
  channel.on('message',listener); channel.on('disconnect',close); channel.on('close',close);
  return Object.freeze({
    sendCommand(raw) {
      if (closed || !channel.connected) return Promise.reject(new Error('ACTOR_CHANNEL_CLOSED'));
      if (pending) return Promise.reject(new Error('ACTOR_COMMAND_PENDING'));
      const command = ActorCommand.assert(raw), id = randomUUID();
      const wire = JSON.stringify(RequestFrame.assert({protocol_version:'chord.actor-ipc-request.v1',session_id:sessionId,request_id:id,command}));
      return new Promise((resolve,reject) => {
        const request = {resolve,reject,command,id,timer:null}; pending = request;
        if (timeoutMs !== null) request.timer = setTimeout(() => settle(request,new Error('ACTOR_COMMAND_TIMEOUT')),timeoutMs);
        try { channel.send(wire,error => { if (error) settle(request,error); }); }
        catch (error) { settle(request,error); }
      });
    },
    close
  });
}
