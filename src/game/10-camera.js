/* ================= camera views ================= */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let tween = null;
function flyTo(az, el) {
  const d = camera.position.distanceTo(controls.target);
  const from = camera.position.clone().sub(controls.target);
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  const to = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(d);
  if (reduce) { camera.position.copy(controls.target).add(to); return; }
  tween = { from: new THREE.Spherical().setFromVector3(from), to: new THREE.Spherical().setFromVector3(to), t0: performance.now() };
  let dt = tween.to.theta - tween.from.theta; if (dt > Math.PI) tween.to.theta -= Math.PI * 2; if (dt < -Math.PI) tween.to.theta += Math.PI * 2;
}
const VIEWS = [['Front 3/4', 42, 9], ['Side', 0, 6], ['Rear 3/4', -140, 12], ['Front', 90, 6], ['Top', 42, 52]];
const viewsEl = document.getElementById('views');
for (const [label, az, el] of VIEWS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-btn'; b.textContent = label; b.onclick = () => { setSpin(false); flyTo(az, el); }; viewsEl.append(b); }
const spinBtn = document.createElement('button'); spinBtn.type = 'button'; spinBtn.className = 'chip-btn'; spinBtn.textContent = 'Auto-spin';
spinBtn.setAttribute('aria-pressed', 'false');
function setSpin(on) { controls.autoRotate = on; spinBtn.setAttribute('aria-pressed', String(on)); }
spinBtn.onclick = () => setSpin(!controls.autoRotate);
viewsEl.append(spinBtn);
const qBtn = document.createElement('button'); qBtn.type = 'button'; qBtn.className = 'chip-btn';
const LOD = { k: 1, ms: 16, t: 0, lock: false, far0: 620, far: 620, R: [0, 0], chunks: 0, on: [0, 0], PIX: 5, basePR: 1, prs: 1, prT: 0 };
function applyQuality() {
  const L = qLevel, dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(L === 'high' ? Math.min(dpr, 1.5) : L === 'medium' ? Math.min(dpr, 1) : Math.min(dpr, 0.8));
  LOD.basePR = renderer.getPixelRatio(); LOD.prs = 1;
  { const sm = L === 'high' ? 4 : L === 'medium' ? 2 : 0; for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== sm) { rt.samples = sm; rt.dispose(); } }
  bloom.enabled = L !== 'low'; mirror.visible = L !== 'low';
  if (L !== 'low') { const sz = L === 'high' ? 1024 : 512; mirror.getRenderTarget().setSize(sz, sz); }
  for (const e of Object.values(ENVS)) e.sun.castShadow = L !== 'low';
  floor.material.transparent = L !== 'low'; floor.material.needsUpdate = true;
  renderer.shadowMap.needsUpdate = true; resize();
  qBtn.textContent = 'Quality: ' + (qPref === 'eco' ? 'Eco · 30 fps' : (qPref === 'auto' ? 'Auto · ' : '') + L.charAt(0).toUpperCase() + L.slice(1));
}
function setQuality(pref) {
  qPref = pref; qLevel = pref === 'auto' ? 'high' : pref === 'eco' ? 'low' : pref;
  try { localStorage.setItem('raven-rs-quality', pref); } catch (e) { /* storage unavailable */ }
  applyQuality();
}
qBtn.onclick = () => { const order = ['auto', 'high', 'medium', 'low', 'eco']; setQuality(order[(order.indexOf(qPref) + 1) % order.length]); };
viewsEl.append(qBtn);
// Auto quality: step down when continuous rendering runs under ~40 fps
let fpsAcc = 0, fpsN = 0, lastDrop = 0;
function trackFps(dt) {
  if (qPref !== 'auto' || qLevel === 'low' || dt > 0.25) return;
  fpsAcc += dt; fpsN++;
  if (fpsN < 90) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  if (fps < 40 && performance.now() - lastDrop > 4000) { lastDrop = performance.now(); qLevel = qLevel === 'high' ? 'medium' : 'low'; applyQuality(); say('Graphics lowered to keep it smooth.'); }
}
controls.addEventListener('start', () => { tween = null; });
controls.addEventListener('change', invalidate);
