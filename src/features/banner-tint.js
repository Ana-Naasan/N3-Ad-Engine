import { createBanner } from '../banner.js';
import { createRoomTint } from '../room-tint.js';

// The banner under the TV (output.banner, whichever rule or ad set it) and the
// red room tint (output.tint). Both live in `world`, so calibration moves them
// with the room; the banner follows the TV every frame, finale shrink included.
export default function bannerTint({ world, tv }) {
  const banner = createBanner();
  const tint = createRoomTint();
  world.add(banner.mesh, tint.mesh);

  return (output) => {
    tint.setOn(output.tint === 'red');
    banner.setText(output.banner);
    banner.placeUnder(tv.group);
    return { debug: { tint: output.tint, banner: output.banner } };
  };
}
