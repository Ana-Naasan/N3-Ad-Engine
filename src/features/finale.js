import { createPostcard } from './finale/postcard.js';
import { createSkyScreen } from './finale/sky.js';
import { createReceipt } from './finale/receipt.js';
import { createTimeLimit } from './finale/time-limit.js';

// Finale (VOIDCOLA), while output.finale is set: the TV shrinks to a postcard
// showing a still of the content the viewer picked, the ad the TV is playing fills a large
// sky screen, and a receipt shows the frozen stats. The banner text comes from
// the lineup and is drawn by the banner feature. Runs after the TV screen
// feature, so tv.texture is already the finale ad on the entry frame.
// The sky screen and receipt live in `world`, which calibration moves.
// POPUP_AFTER_SECONDS in (output.popup), the TV grows back and the purple
// "Screen Time Limit Reached" pop-up slams over the video (finale/time-limit.js).
export default function finale({ world, tv }) {
  const postcard = createPostcard(tv.group, () => tv.contentTexture);
  const sky = createSkyScreen();
  const receipt = createReceipt();
  const timeLimit = createTimeLimit(tv.group);
  world.add(sky.mesh, receipt.mesh);

  return (output, signals) => {
    const shrink = postcard.update(output.finale, signals.t, output.popup);
    sky.setTexture(output.finale ? tv.texture : null);
    sky.update(shrink, postcard.startPosition);
    // The full-size TV covers the receipt's spot, so it steps aside for the pop-up.
    receipt.update(output.finale && !output.popup ? output.stats : null, shrink);
    const popup = timeLimit.update(output.popup ? output.stats : null, postcard.grown, signals.t);
    return { debug: { finaleShrink: +shrink.toFixed(2), popup } };
  };
}
