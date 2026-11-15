// The showing video's clock. On the card there's no video: t 0, not ended.
export default function tvClock({ tv }) {
  return (signals) => {
    const video = tv.currentVideo;
    signals.video = {
      t: video ? video.currentTime : 0,
      ended: video ? video.ended : false,
      failed: tv.failed,
    };
  };
}
