import * as THREE from 'three';

// Floating text panel drawn on a canvas. Redraws only when the text changes.

export function createPanel({ width = 0.7, height = 0.35, pxPerMetre = 900, fontPx = 34 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * pxPerMetre);
  canvas.height = Math.round(height * pxPerMetre);
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );

  let lastText = null;

  function setLines(lines) {
    const text = lines.join('\n');
    if (text === lastText) return;
    lastText = text;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20, 14, 10, 0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 24);
    ctx.fill();

    ctx.fillStyle = '#f4e9d8';
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, 28, 24 + i * fontPx * 1.35));
    texture.needsUpdate = true;
  }

  return { mesh, setLines };
}
