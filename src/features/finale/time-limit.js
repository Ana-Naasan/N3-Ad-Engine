import * as THREE from 'three';

// The finale's last joke: once the TV has grown back (output.popup), a purple
// "Screen Time Limit Reached" pop-up slams over the video, with this run's real
// time on video vs on ads. Drawn here (gradient, hourglass, text); no logos.

const W = 1.15; // m, on the 1.6 x 0.9 m screen
const H = 0.72;
const PX = 1000; // canvas px per metre
const SLAM_SECONDS = 0.3;

const mmss = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawHourglass(ctx, cx, cy, h) {
  const w = h * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = h * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Caps
  ctx.beginPath();
  ctx.moveTo(-w / 2 - h * 0.06, -h / 2);
  ctx.lineTo(w / 2 + h * 0.06, -h / 2);
  ctx.moveTo(-w / 2 - h * 0.06, h / 2);
  ctx.lineTo(w / 2 + h * 0.06, h / 2);
  ctx.stroke();
  // Glass
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.bezierCurveTo(-w / 2, -h * 0.12, -w * 0.08, -h * 0.06, -w * 0.08, 0);
  ctx.bezierCurveTo(-w * 0.08, h * 0.06, -w / 2, h * 0.12, -w / 2, h / 2);
  ctx.moveTo(w / 2, -h / 2);
  ctx.bezierCurveTo(w / 2, -h * 0.12, w * 0.08, -h * 0.06, w * 0.08, 0);
  ctx.bezierCurveTo(w * 0.08, h * 0.06, w / 2, h * 0.12, w / 2, h / 2);
  ctx.stroke();
  // Sand: a little left on top, a heap at the bottom
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, -h * 0.2);
  ctx.lineTo(w * 0.2, -h * 0.2);
  ctx.lineTo(0, -h * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.36, h * 0.44);
  ctx.quadraticCurveTo(0, h * 0.14, w * 0.36, h * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw(ctx, stats) {
  const w = W * PX;
  const h = H * PX;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6a3cd6');
  g.addColorStop(1, '#3a1f9c');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, 56);
  ctx.fill();

  drawHourglass(ctx, w / 2, 150, 130);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px -apple-system, system-ui, sans-serif';
  ctx.fillText('Screen Time Limit Reached', w / 2, 300);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '500 38px -apple-system, system-ui, sans-serif';
  ctx.fillText(`You've spent ${mmss(stats.videoTime)} on your video`, w / 2, 385);
  ctx.fillText(`and ${mmss(stats.adTime)} on ads today.`, w / 2, 435);

  // "Ignore Limit" button
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, w / 2 - 210, 520, 420, 96, 48);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 40px -apple-system, system-ui, sans-serif';
  ctx.fillText('Ignore Limit', w / 2, 569);
}

// The pop-up lives on the TV (a child of tv.group), just in front of the screen.
export function createTimeLimit(tvGroup) {
  const canvas = document.createElement('canvas');
  canvas.width = W * PX;
  canvas.height = H * PX;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  mesh.position.z = 0.004; // in front of the postcard face (0.002)
  mesh.visible = false;
  tvGroup.add(mesh);
  let shownAt = null;

  return {
    // stats: the run's frozen stats while the pop-up shows, else null.
    // ready: the TV has grown back, so the pop-up can slam in.
    update(stats, ready, time) {
      if (!stats) {
        mesh.visible = false;
        shownAt = null;
        return 'off';
      }
      if (!ready) return 'waiting';
      if (shownAt === null) {
        shownAt = time;
        draw(ctx, stats);
        texture.needsUpdate = true;
      }
      // Slam: from 1.25x down to 1x with a small overshoot.
      const k = THREE.MathUtils.clamp((time - shownAt) / SLAM_SECONDS, 0, 1);
      const scale = 1 + 0.25 * (1 - k) * (1 - k) - 0.04 * Math.sin(Math.PI * k);
      mesh.scale.setScalar(scale);
      mesh.visible = true;
      return 'shown';
    },
  };
}
