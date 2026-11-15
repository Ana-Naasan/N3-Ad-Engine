import { createPostcard } from './finale/postcard.js';
import { createSkyScreen } from './finale/sky.js';
import { createReceipt } from './finale/receipt.js';

// Finale (VOIDCOLA), while output.finale is set: the TV shrinks to a postcard
// showing a still of the content video, the ad the TV is playing fills a large
// sky screen, and a receipt shows the frozen stats. The banner text comes from
// the lineup and is drawn by the banner feature. Runs after the TV screen
// feature, so tv.texture is already the finale ad on the entry frame.
// The sky screen and receipt live in `world`, which calibration moves.
export default function finale({ world, tv }) {
  const postcard = createPostcard(tv.group, { face: tv.videos.content.texture });
  const sky = createSkyScreen();
  const receipt = createReceipt();
  world.add(sky.mesh, receipt.mesh);

  return (output, signals) => {
    const t = postcard.update(output.finale, signals.t);
    sky.setTexture(output.finale ? tv.texture : null);
    sky.update(t, postcard.startPosition);
    receipt.update(output.finale ? output.stats : null, t, postcard.startPosition?.y);
    return { debug: { finaleShrink: +t.toFixed(2) } };
  };
}
