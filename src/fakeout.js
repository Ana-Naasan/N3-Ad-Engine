// The ?fakeout URL flag. Without it the run is the original one: the same
// lineup and the same videos.
import { LINEUP } from './attention/lineup.js';
import { FAKEOUT_LINEUP } from './attention/lineup-fakeout.js';

// Pure: `search` is a query string such as location.search.
export function fakeoutFor(search) {
  const on = new URLSearchParams(search).has('fakeout');
  return {
    on,
    lineup: on ? FAKEOUT_LINEUP : LINEUP, // main.js runs this lineup
    videoNames: on ? ['watchTheAd'] : [], // tv.js loads these as well
  };
}

export const FAKEOUT = fakeoutFor(globalThis.location?.search ?? '');
