/**
 * Minimal in-memory transport for tests, examples and local embedding.
 * Each endpoint follows the same channel shape as Node/Bun inherited IPC:
 * `connected`, `on(event, listener)`, `off(event, listener)`, `send(string, cb)`.
 * Delivery is asynchronous but never grants identity or authority.
 */
export function createMemoryTransportPair({ delayMs = 0 } = {}) {
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new TypeError('INVALID_TRANSPORT_DELAY');
  const make = () => {
    const listeners = new Map();
    let connected = true;
    const endpoint = {
      peer: null,
      get connected() { return connected; },
      on(event, listener) {
        if (typeof listener !== 'function') throw new TypeError('INVALID_TRANSPORT_LISTENER');
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
        return endpoint;
      },
      off(event, listener) {
        listeners.get(event)?.delete(listener);
        return endpoint;
      },
      emit(event, value) {
        for (const listener of [...(listeners.get(event) || [])]) listener(value);
      },
      send(wire, callback) {
        if (typeof wire !== 'string') throw new TypeError('INVALID_TRANSPORT_MESSAGE');
        const peer = endpoint.peer;
        if (!connected || !peer?.connected) {
          queueMicrotask(() => callback?.(new Error('ADAPTER_CHANNEL_CLOSED')));
          return;
        }
        const deliver = () => {
          if (!connected || !peer.connected) { callback?.(new Error('ADAPTER_CHANNEL_CLOSED')); return; }
          peer.emit('message', wire);
          callback?.();
        };
        if (delayMs === 0) queueMicrotask(deliver); else setTimeout(deliver, delayMs);
      },
      close() {
        if (!connected) return;
        connected = false;
        endpoint.emit('close');
        endpoint.peer?._peerClosed();
      },
      _peerClosed() {
        if (!connected) return;
        connected = false;
        endpoint.emit('disconnect');
        endpoint.emit('close');
      }
    };
    return endpoint;
  };
  const left = make(), right = make();
  left.peer = right; right.peer = left;
  return Object.freeze({ left, right, close() { left.close(); right.close(); } });
}
