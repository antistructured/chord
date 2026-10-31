import { CONTRACT_LIMITS } from '../contracts/sigils.js';
import { ActorCommand, TrustedBinding, READ_TYPES, CoordinationError, requireTrue, uint } from '../coordination/contracts.js';
import { readCommand } from '../coordination/commands.js';
import { RequestFrame, ResponseFrame, RejectionResponse, parseActorWire } from './actor-transport.js';

/** Privileged host composition, not an actor API. authenticate must consult an
 * out-of-band host-attested live channel map on EVERY request. load and
 * commitCommand are narrow private owner closures; never send them to actors.
 * The only actor-visible wire values are bounded JSON commands/responses.
 */
export function createActorIngress({authenticate,load,commitCommand,clock = {now:Date.now}}) {
  requireTrue(typeof authenticate === 'function' && typeof load === 'function' && typeof commitCommand === 'function' && typeof clock?.now === 'function','INVALID_CONTEXT');
  let busy = false, lastNow = 0;
  function handleAuthenticated(channelContext,commandJSON) {
    let command = null, entered = false;
    try {
      requireTrue(!busy,'REENTRANT_MUTATION'); busy = true; entered = true;
      requireTrue(typeof commandJSON === 'string','INVALID_COMMAND');
      requireTrue(Buffer.byteLength(commandJSON,'utf8') <= CONTRACT_LIMITS.bytes,'LIMIT_EXCEEDED');
      // Authentication comes from the actual transport object, not JSON fields.
      const attestation = authenticate(channelContext);
      requireTrue(attestation && typeof attestation.then !== 'function','HOST_UNAUTHENTICATED');
      let binding;
      try { binding = Object.freeze(TrustedBinding.assert(attestation)); }
      catch { throw new CoordinationError('HOST_UNAUTHENTICATED'); }
      let parsed; try { parsed = JSON.parse(commandJSON); } catch { throw new CoordinationError('INVALID_COMMAND'); }
      try { command = ActorCommand.assert(parsed); } catch (e) { throw new CoordinationError(e.code === 'LIMIT_EXCEEDED' ? e.code : e.code === 'UNSUPPORTED_PROTOCOL' ? e.code : 'INVALID_COMMAND'); }
      const now = clock.now(); uint(now); requireTrue(now >= lastNow,'CLOCK_ROLLBACK'); lastNow = now;
      requireTrue(binding.authenticated_at <= now && now < binding.expires_at,'HOST_UNAUTHENTICATED');
      if (READ_TYPES.includes(command.type)) {
        const snapshot = load(), readNow = clock.now(); uint(readNow);
        requireTrue(readNow >= lastNow && readNow >= snapshot.envelope.coordination.logical_now,'CLOCK_ROLLBACK'); lastNow = readNow;
        return readCommand(snapshot,binding,command,readNow);
      }
      return commitCommand(binding,command);
    } catch (e) {
      const code = e instanceof CoordinationError ? e.code : 'HOST_UNAUTHENTICATED';
      return RejectionResponse.assert({protocol_version:'chord.actor-response.v1',operation_id:command?.operation_id ?? null,correlation_id:command?.correlation_id ?? null,causation_id:command?.causation_id ?? null,ok:false,code,commit_status:e.commitStatus === 'unknown' ? 'unknown' : 'not_committed'});
    } finally { if (entered) busy = false; }
  }
  function attachChild(child) {
    // Trusted host must enroll this exact inherited channel out-of-band before
    // attaching. No register/authenticate/bind message exists on the wire.
    requireTrue(child && typeof child.on === 'function' && typeof child.send === 'function','INVALID_CONTEXT');
    const listener = message => {
      let parsed; try { parsed = parseActorWire(message); } catch { return; }
      let response;
      if (parsed?.protocol_version === 'chord.actor-command.v1') {
        // Explicit legacy raw host edge; framed clients never downgrade to it.
        response = handleAuthenticated(child,message);
      } else {
        let frame; try { frame = RequestFrame.assert(parsed); } catch { return; }
        const canonical = handleAuthenticated(child,JSON.stringify(frame.command));
        try { response = ResponseFrame.assert({protocol_version:'chord.actor-ipc-response.v1',session_id:frame.session_id,request_id:frame.request_id,response:canonical}); }
        catch { return; } // Never compensate/retry if a response exceeds bounds.
      }
      // Delivery failure never compensates or re-executes a committed command;
      // the actor must recover its original receipt after fresh authentication.
      if (child.connected) try { child.send(JSON.stringify(response),() => {}); } catch {}
    };
    child.on('message',listener);
    return Object.freeze({detach(){child.off('message',listener);}});
  }
  return Object.freeze({handleAuthenticated,attachChild});
}
