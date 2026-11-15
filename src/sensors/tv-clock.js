// The showing video's clock. On the card there's no video: t 0, not ended.
// `playing`: the video is really playing (not paused, loading or stalled).
// When the content is the YouTube mirror itself (no file), that's the remote
// player's own report (YouTube's ad before the video doesn't count).
const HAVE_FUTURE_DATA = 3;

export default function tvClock(ctx) {
  const { tv } = ctx;
  return (signals) => {
    const video = tv.currentVideo;
    const mirror = ctx.picker?.mirror; // the picker sensor sets ctx.picker after this setup
    const live = !video && tv.showingLiveContent;
    signals.video = {
      t: video ? video.currentTime : 0,
      ended: video ? video.ended : false,
      failed: tv.failed,
      playing: video
        ? !video.paused && !video.ended && video.readyState >= HAVE_FUTURE_DATA
        : Boolean(live && mirror?.available && mirror.playing),
    };
  };
}
