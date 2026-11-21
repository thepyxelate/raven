/* ================= textures ================= */
import { mkCanvas, canvasTex } from '../lib/canvas.js';

const vinylCanvas = mkCanvas(2048, 1024);
const vinylTex = canvasTex(vinylCanvas);
const PXM = 2048 * 0.5 / 4.6;            // canvas px per metre along the car
const VX = (h, x) => (h * 0.5 + (x + 2.3) / 4.6 * 0.5) * 2048;
const VY = (y) => 1024 - y * 512;         // side: height above body floor
const VT = (f) => 0.28 * f * 1024;        // top: |z| / half-width
const SIDE_SHAPES = {
  flames: [[[2.3, 0.08], [2.3, 0.52], [1.45, 0.56], [1.05, 0.5], [0.75, 0.56], [0.35, 0.48], [0.05, 0.55], [-0.35, 0.44], [0.0, 0.4], [-0.55, 0.34], [-0.1, 0.3], [-0.75, 0.22], [0.1, 0.18], [0.45, 0.24], [0.6, 0.12], [1.0, 0.18], [1.3, 0.08]]],
  bolt: [[[2.3, 0.46], [0.85, 0.46], [0.55, 0.32], [-0.65, 0.32], [-0.95, 0.2], [-2.3, 0.2], [-2.3, 0.12], [-0.9, 0.12], [-0.6, 0.24], [0.6, 0.24], [0.9, 0.38], [2.3, 0.38]]],
  line: [[[2.3, 0.5], [-2.3, 0.5], [-2.3, 0.44], [2.3, 0.44]], [[2.3, 0.415], [-2.3, 0.415], [-2.3, 0.4], [2.3, 0.4]]],
  twotone: [[[2.4, -0.2], [2.4, 0.3], [-2.4, 0.3], [-2.4, -0.2]]],
  slash: [[-1.95, 0.85, 0.62], [-1.5, 1.05, 0.66], [-1.0, 1.2, 0.64], [-0.45, 0.95, 0.56], [0.05, 0.7, 0.46]].map(([x0, len, tp]) =>
    [[x0, 0.1], [x0 + 0.1, 0.1], [x0 + len * 0.5, tp * 0.55], [x0 + len * 0.62, tp * 0.5], [x0 + len + 0.07, tp], [x0 + len * 0.55 + 0.02, tp * 0.72], [x0 + len * 0.42, tp * 0.68], [x0 + len * 0.3, tp * 0.48]])
};
function drawVinyl() {
  const g = vinylCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = cfg.color; g.fillRect(0, 0, 2048, 1024);
  g.fillStyle = cfg.vinylColor;
  for (const h of [0, 1]) {
    let shapes = SIDE_SHAPES[cfg.vinyl] || [];
    if (cfg.vinyl === 'stripes') shapes = SIDE_SHAPES.line;
    for (const poly of shapes) { g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(VX(h, x), VY(y)) : g.moveTo(VX(h, x), VY(y)))); g.closePath(); g.fill(); }
    if (cfg.vinyl === 'checker') for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) { const x0 = -2.3 + i * 0.13, y0 = 0.18 + j * 0.13; g.fillRect(VX(h, x0), VY(y0 + 0.13), 0.13 * PXM, 0.13 * 512); }
    if (cfg.vinyl === 'stripes') for (const [a, b] of [[0.78, 2.3], [-0.82, 0.02], [-2.3, -1.44]]) g.fillRect(VX(h, a), VT(0.1), (b - a) * PXM, VT(0.24) - VT(0.1));
    if (cfg.sticker) {
      g.save(); g.fillStyle = cfg.stickerColor;
      g.font = `italic 700 ${Math.round(0.17 * PXM)}px "Chakra Petch", "Arial Narrow", sans-serif`;
      g.textBaseline = 'alphabetic';
      if (h === 0) { g.translate(VX(0, -0.8 + (modelOf(cfg).decalX || 0)), VY(0.36)); g.scale(1, 512 / PXM); }
      else { g.translate(VX(1, 0.86), VY(0.36)); g.scale(-1, 512 / PXM); }
      g.fillText(cfg.sticker, 0, 0); g.restore();
    }
  }
  vinylTex.needsUpdate = true;
}

function carbonTexture() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = ((i + (j >> 1)) % 2) ? '#22252c' : '#15171b'; g.fillRect(i * 8, j * 8, 8, 8); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(120, 60); return t;
}
const plateCanvas = mkCanvas(256, 64), plateTex = canvasTex(plateCanvas);
function drawPlate() {
  const g = plateCanvas.getContext('2d');
  g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#1b1c20'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#16171b'; g.font = 'italic 700 36px "Chakra Petch", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText((cfg.sticker || 'RAVEN RS').slice(0, 10), 128, 34); plateTex.needsUpdate = true;
}
function bannerTexture() {
  const c = mkCanvas(1024, 320), g = c.getContext('2d');
  g.fillStyle = '#12131b'; g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = '#2a2c3c'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 304);
  // original raven-head mark
  g.fillStyle = '#b8bccb';
  g.beginPath(); g.moveTo(70, 250); g.lineTo(110, 120); g.lineTo(170, 80); g.lineTo(230, 92); g.lineTo(300, 128); g.lineTo(236, 134); g.lineTo(206, 150); g.lineTo(196, 182); g.lineTo(170, 240); g.lineTo(150, 214); g.lineTo(128, 262); g.lineTo(112, 226); g.closePath(); g.fill();
  g.fillStyle = '#e4e6ee'; g.beginPath(); g.moveTo(230, 92); g.lineTo(300, 128); g.lineTo(250, 120); g.closePath(); g.fill();
  g.fillStyle = '#12131b'; g.beginPath(); g.arc(196, 112, 9, 0, Math.PI * 2); g.fill();
  g.font = 'italic 700 150px "Chakra Petch", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
  g.fillStyle = '#d7d9e2'; g.fillText('RAVEN', 330, 172);
  const w = g.measureText('RAVEN ').width; g.fillStyle = '#ff3d5a'; g.fillText('RS', 330 + w, 172);
  return canvasTex(c);
}
function slatTexture() {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  for (let y = 0; y < 256; y += 16) { g.fillStyle = '#2a2d3b'; g.fillRect(0, y, 256, 13); g.fillStyle = '#12131a'; g.fillRect(0, y + 13, 256, 3); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t;
}
function concreteTexture() {
  const c = mkCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#1b1c25'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { const v = 22 + Math.random() * 18 | 0; g.fillStyle = `rgba(${v},${v},${v + 8},0.55)`; g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  g.strokeStyle = '#13141b'; g.lineWidth = 3; for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
}
function puddleAlpha() {
  const c = mkCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = 'rgb(205,205,205)'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(95,95,95,0.9)'); gr.addColorStop(1, 'rgba(205,205,205,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
