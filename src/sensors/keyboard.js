import { rlog } from '../remote-log.js';

// Keys 1-4 jump to that ad (emulator testing on the same machine only).
export default function keyboard() {
  let pending = null;
  window.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '4') {
      pending = Number(e.key);
      rlog('key-jump', { to: pending });
    }
  });
  return (signals) => {
    signals.jumpTo = pending;
    pending = null;
  };
}
