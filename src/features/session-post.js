import { postSession } from '../session-api.js';
import { rlog } from '../remote-log.js';

// Posts the run's frozen stats once, when the finale starts. The KPI board refetches after.
export default function sessionPost() {
  let posted = false;
  return (output) => {
    if (posted || !output.finale) return;
    posted = true;
    const summary = { stats: output.stats, timestamp: new Date().toISOString(), usedJump: output.usedJump };
    postSession(summary)
      .then(() => rlog('session-posted', summary))
      .catch((e) => console.warn('Session post failed:', e.message));
  };
}
