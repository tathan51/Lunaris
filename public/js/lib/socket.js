// `io` is provided globally by /socket.io/socket.io.js loaded in index.html
export const socket = io();

export function ack(event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response) => resolve(response || { ok: false }));
  });
}
