// Features draw from the attention output. Each module default-exports
// setup(ctx) -> update(output, signals). Add one line per feature.
import tvScreen from './tv-screen.js';
import debugPanel from './debug-panel.js';

export const FEATURES = [
  tvScreen,
  debugPanel,
];
