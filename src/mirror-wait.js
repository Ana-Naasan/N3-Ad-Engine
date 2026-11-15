// What the card's signals.pick should be while the YouTube mirror may still be
// loading. In VR the first frame takes a few seconds (longer on a cold server),
// and a pinch on the plain "Pinch to play" card would start the placeholder run
// before YouTube ever shows. So while it loads, pinches are ignored (false);
// if it hasn't come up after MIRROR_WAIT_SECONDS, the plain card takes over
// (null: any pinch starts), so a broken mirror can't strand the viewer.
export const MIRROR_WAIT_SECONDS = 12;

// active: an XR session (or ?mirror) drives the mirror. available: a YouTube
// frame has arrived. picked: the viewer opened a video. waited: seconds since
// the mirror was first wanted without being available.
export function cardPick({ active, available, picked, waited }) {
  if (!active) return null;
  if (available) return picked;
  return waited < MIRROR_WAIT_SECONDS ? false : null;
}
