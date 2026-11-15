// Dev-only: sends events and errors from the headset to the Vite dev server
// (logs/quest.jsonl), so they can be read on the laptop.

const session = Math.random().toString(36).slice(2, 8);
const queue = [];

export function rlog(type, data = {}) {
  queue.push({ t: new Date().toISOString(), session, type, ...data });
}

function flush() {
  if (!queue.length) return;
  fetch('/api/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(queue.splice(0)),
    keepalive: true,
  }).catch(() => {});
}
setInterval(flush, 1000);
window.addEventListener('pagehide', flush);

window.addEventListener('error', (e) => rlog('error', { message: e.message, at: `${e.filename}:${e.lineno}` }));
window.addEventListener('unhandledrejection', (e) =>
  rlog('rejection', { message: String(e.reason?.message ?? e.reason) }),
);
for (const level of ['warn', 'error']) {
  const original = console[level];
  console[level] = (...args) => {
    rlog(`console.${level}`, { message: args.map(String).join(' ') });
    original.apply(console, args);
  };
}

export function sendSnapshot(blob) {
  fetch('/api/snap', { method: 'POST', body: blob }).catch(() => {});
}
