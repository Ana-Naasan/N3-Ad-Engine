// The domain (Gojo and his ad wall) is part of the run. Two things turn it off:
//   ?domain=0 in the URL: the run is the one without it, with the same rules
//     and features and the plain look-away banner
//   its media missing from public/domain/ (the files are not in the repo:
//     public/domain/SOURCES.md)
// With ?fakeout the fake-out counts GLOOP's look-aways itself, so the domain
// leaves GLOOP alone and applies to WRAPZILLA.
import * as domainRule from './attention/rules/domain.js';
import domainFeature, { MEDIA_URLS } from './features/domain.js';

const PROBE_TIMEOUT_MS = 3000;

// Pure: `search` is a query string such as location.search.
export function domainFor(search, mediaPresent = true) {
  const params = new URLSearchParams(search);
  const on = params.get('domain') !== '0' && mediaPresent;
  const leave = params.has('fakeout') ? ['GLOOP'] : [];
  const rule = { id: domainRule.id, createRule: () => domainRule.createRule({ leave }) };
  return {
    on,
    rules: on ? [rule] : [], // main.js adds these after RULES
    features: on ? [domainFeature] : [], // and these after FEATURES
  };
}

// True when every media file is there. A dev server answers a missing file
// with the page itself, so the type is checked too.
async function mediaPresent() {
  try {
    const found = await Promise.all(MEDIA_URLS.map(async (url) => {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return res.ok && !(res.headers.get('content-type') ?? '').startsWith('text/html');
    }));
    return found.every(Boolean);
  } catch {
    return false;
  }
}

// Outside a browser (the tests) there is no media to look for.
const search = globalThis.location?.search;
const wanted = search !== undefined && domainFor(search).on;
const present = wanted && (await mediaPresent());
if (wanted && !present) console.info('The domain is off: its media is not in public/domain/');

export const DOMAIN = domainFor(search ?? '', present);
