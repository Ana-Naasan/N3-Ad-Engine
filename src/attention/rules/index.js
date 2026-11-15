// The registered rule list: one line per rule. Each rule is
// { name, create() } and create() returns (signals, ad) => result, where
// result is a partial output plus optional `passed`, `jumpTo` and `addStats`.
// See src/attention/index.js for how results are merged.
import { forcePassJump } from './force-pass-jump.js';

export const RULES = [
  forcePassJump,
];
