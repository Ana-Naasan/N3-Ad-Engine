// Features draw from the attention output.
//
// Module shape: export default function setup(ctx) -> update(output, signals)
//   ctx     = { renderer, scene, camera, world, tv }, shared and mutable.
//             ctx.tv has group, screenMaterial and texture (the current video).
//   output  = this frame's attention output (#4's contract)
//   update  draws; it may return { debug: {...} }, whose fields are merged
//           into the 1 s status log line.
// Features run in this order, once per frame, after the attention module.
// One line per module.
import tvScreen from './tv-screen.js';
import bannerTint from './banner-tint.js';
import skip from './skip.js';
import hands from './hands.js';
import palmScreens from './palm-screens.js';
import gateMeter from './gate-meter.js';
import finale from './finale.js';
import sessionPost from './session-post.js';
import kpiBoard from './kpi-board.js';
import debugPanel from './debug-panel.js';

export const FEATURES = [
  tvScreen,
  bannerTint, // #6
  skip, // #7
  hands, // #8
  palmScreens, // #8
  gateMeter, // #9
  finale, // #10
  sessionPost, // #11
  kpiBoard, // #11
  debugPanel,
];
