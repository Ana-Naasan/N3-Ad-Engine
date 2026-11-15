// The complete rule list. Each rule module exports `id` and `createRule()`;
// createRule() returns update(signals, ad), which returns a partial output
// plus optional `passed` and optional `stats` (amounts to add, e.g.
// { headTurns: 1 }). Merging is by rule id, never list order: see
// ../index.js. Later tickets fill in their rule's file, not this list.
import * as forcePass from './forcePass.js';
import * as lookAway from './lookAway.js';
import * as palms from './palms.js';
import * as skip from './skip.js';
import * as gate from './gate.js';

export const RULES = [forcePass, lookAway, palms, skip, gate];
