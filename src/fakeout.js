// The ?fakeout URL flag. Without it the run is the original one: the same
// lineup, rules and features.
import { LINEUP } from './attention/lineup.js';
import { FAKEOUT_LINEUP } from './attention/lineup-fakeout.js';
import * as fakeoutRule from './attention/rules/fakeout.js';
import fakeoutVoice from './features/fakeout-voice.js';

// Pure: `search` is a query string such as location.search.
export function fakeoutFor(search) {
  const on = new URLSearchParams(search).has('fakeout');
  return {
    on,
    lineup: on ? FAKEOUT_LINEUP : LINEUP, // main.js runs this lineup
    rules: on ? [fakeoutRule] : [], // main.js adds these after RULES
    features: on ? [fakeoutVoice] : [], // and these after FEATURES
  };
}

export const FAKEOUT = fakeoutFor(globalThis.location?.search ?? '');
