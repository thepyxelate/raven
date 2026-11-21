/* ---- race scene objects ---- */
let rivalRig = null, ghostRig = null, trafficRig = null;
const rivalBlob = shadowBlob.clone(); rivalBlob.visible = false; scene.add(rivalBlob);
const smokeTex = radialTex('rgba(215,212,224,0.6)', 'rgba(215,212,224,0)');
const smoke = Array.from({ length: 40 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; s.userData.life = 0; scene.add(s); return s; });
let smokeI = 0;
function puff(x, z) {
  const s = smoke[smokeI++ % smoke.length];
  s.position.set(x + (Math.random() - 0.5) * 0.3, 0.25, z + (Math.random() - 0.5) * 0.3);
  s.scale.setScalar(0.6); s.userData.life = 1; s.visible = true;
}
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fb8ff').multiplyScalar(2.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const flames = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 10), flameMat); m.rotation.z = Math.PI / 2; m.visible = false; scene.add(m); return m; });
function placeCarFx(x, z) {
  shadowBlob.position.set(x, 0.006, z); glow.position.set(x, 0.008, z); glowL.position.set(x, 0.12, z);
  beams.forEach((l, i) => { const s = i ? -1 : 1; l.position.set(x + 2.2, 0.62, z + s * 0.55); l.target.position.set(x + 7, 0, z + s * 1.2); l.target.updateMatrixWorld(); });
}
// a racer's x is its front bumper; each rig is set back by its own nose length
const noseOf = (rig) => (rig && rig.userData.dims ? rig.userData.dims.front + 0.05 : 2.3);
function ensureRival(look) {
  const key = JSON.stringify(look);
  if (rivalRig && rivalRig.userData.key === key) return;
  if (rivalRig) { rivalRig.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(rivalRig); }
  rivalRig = makeRig(clean({ ...DEFAULTS, ...look }), new Map([[CM.paint, rivalPaint], [CM.plain, rivalPaint]]));
  rivalRig.userData.key = key; rivalRig.visible = false; scene.add(rivalRig);
}
function buildGhost(look) {
  if (ghostRig) { ghostRig.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(ghostRig); }
  const swap = new Map(); for (const m of [...Object.values(CM), rivalPaint]) if (m) swap.set(m, ghostMat);
  ghostRig = makeRig(clean({ ...DEFAULTS, ...look }), swap);
  ghostRig.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 6; } });
  ghostRig.visible = false; scene.add(ghostRig);
}
function ensureTraffic() {
  if (trafficRig) return trafficRig;
  const body = [], dark = [], tail = [];
  const b1 = new THREE.BoxGeometry(4.2, 0.62, 1.8); b1.translate(0, 0.62, 0); body.push(b1);
  const b2 = new THREE.BoxGeometry(2.2, 0.5, 1.6); b2.translate(-0.25, 1.17, 0); body.push(b2);
  const w = new THREE.BoxGeometry(2.24, 0.32, 1.64); w.translate(-0.25, 1.18, 0); dark.push(w);
  for (const x of [1.35, -1.35]) for (const z of [0.82, -0.82]) { const cy = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12); cy.rotateX(Math.PI / 2); cy.translate(x, 0.32, z); dark.push(cy); }
  for (const z of [0.6, -0.6]) { const t = new THREE.BoxGeometry(0.05, 0.12, 0.36); t.translate(-2.11, 0.78, z); tail.push(t); }
  const mk = (list, mat) => { const im = new THREE.InstancedMesh(mergeGeometries(plainAttrs(list)), mat, TRAFFIC_N); im.frustumCulled = false; im.visible = false; scene.add(im); return im; };
  trafficRig = {
    body: mk(body, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 })),
    dark: mk(dark, new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.6 })),
    tail: mk(tail, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b3a').multiplyScalar(2) }))
  };
  const cols = ['#4a4f57', '#9aa3ad', '#e9e9ec', '#1f5fd6', '#7a1f2b', '#2e3b2a', '#c9a227', '#121316', '#5a3a7a', '#3a6a8a', '#8a6a4a', '#2a2d33'];
  for (let i = 0; i < TRAFFIC_N; i++) trafficRig.body.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  trafficRig.body.instanceColor.needsUpdate = true;
  return trafficRig;
}
const tm4 = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv3 = new THREE.Vector3(), ts3 = new THREE.Vector3(1, 1, 1), tz3 = new THREE.Vector3(0, 0, 0);
function placeTraffic() {
  if (!trafficRig) return;
  for (let i = 0; i < TRAFFIC_N; i++) {
    const t = race.cars[i];
    if (t) tm4.compose(tv3.set(t.x, 0, LANES3[t.lane]), tq, ts3); else tm4.compose(tv3.set(0, -50, 0), tq, tz3);
    for (const k of ['body', 'dark', 'tail']) trafficRig[k].setMatrixAt(i, tm4);
  }
  for (const k of ['body', 'dark', 'tail']) trafficRig[k].instanceMatrix.needsUpdate = true;
}
function showTraffic(on) { if (trafficRig) for (const k of ['body', 'dark', 'tail']) trafficRig[k].visible = on; }
const ghostX = (g, t) => {
  const s = g.s, f = t * 30, i = Math.floor(f);
  if (i < 0) return 0;
  if (i >= s.length - 1) { const n = s.length; const v = n > 1 ? (s[n - 1] - s[n - 2]) * 30 : 0; return s[n - 1] + v * (t - (n - 1) / 30); }
  return s[i] + (s[i + 1] - s[i]) * (f - i);
};
const ghostTimeAt = (g, x) => { const s = g.s; for (let i = 1; i < s.length; i++) if (s[i] >= x) return (i - 1 + (x - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1])) / 30; return null; };
function loadGhost(track) {
  try { const g = JSON.parse(store.get('ghost-' + track, 'null')); if (g && Array.isArray(g.s) && g.s.length > 10) return { t: g.t, s: g.s, look: g.look || {}, name: 'Your best' }; } catch (e) { /* no ghost */ }
  return null;
}
function encodeChallenge(me) {
  const look = {}; for (const k of LOOK_KEYS) look[k] = cfg[k];
  const s = race.rec; let prev = 0;
  const deltas = s.map((x) => { const d = Math.round((x - prev) * 100); prev += d / 100; return d; }).join(',');
  return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, k: race.track, t: +me.time.toFixed(3), n: (cfg.sticker || 'RAVEN').slice(0, 14), l: look, d: deltas }))));
}
function decodeChallenge(code) {
  const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!o || o.v !== 1 || !TRACKS.some((t) => t[0] === o.k) || typeof o.t !== 'number' || typeof o.d !== 'string') throw new Error('bad code');
  let acc = 0; const s = o.d.split(',').map((d) => { acc += (+d || 0) / 100; return +acc.toFixed(2); });
  if (s.length < 10) throw new Error('short');
  const look = {}; for (const k of LOOK_KEYS) if (o.l && o.l[k] !== undefined) look[k] = o.l[k];
  return { k: o.k, t: o.t, n: String(o.n || 'Friend').slice(0, 14), l: look, s };
}
