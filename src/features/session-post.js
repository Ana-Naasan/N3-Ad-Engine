import { postSession } from '../session-api.js';
import { rlog } from '../remote-log.js';

// Posts the run's frozen stats once, when the finale starts. The KPI board refetches after.
export default function sessionPost() {
  const debug = { sessionPost: 'waiting' };
  return (output) => {
    if (debug.sessionPost === 'waiting' && output.finale) {
      debug.sessionPost = 'posting';
      const summary = { stats: output.stats, timestamp: new Date().toISOString(), usedJump: output.usedJump };
      postSession(summary).then(
        () => {
          debug.sessionPost = 'posted';
          rlog('session-posted', summary);
        },
        (e) => {
          debug.sessionPost = 'failed';
          console.warn('Session post failed:', e.message);
        },
      );
    }
    return { debug };
  };
}
