/* ---- streets: Sunset Strip + Palm Coast ---- */
const RACE_LEN = 402.3;
function checkerTexture() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#f1efe8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#16151c'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function finishTexture() {
  const c = mkCanvas(1024, 96), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = '#ffe2b8'; g.font = 'italic 700 64px "Chakra Petch", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('FINISH  ·  1/4 MILE', 512, 50); return canvasTex(c);
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function skyTexture(stops) {
  const c = mkCanvas(8, 512), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, 8, 512); return canvasTex(c);
}
function sunTexture(top, bottom) {
  const c = mkCanvas(256, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) g.fillRect(0, 150 + i * 15, 256, 2 + i * 1.5);
  return canvasTex(c);
}
function asphaltTexture() {
  const c = mkCanvas(512, 256), g = c.getContext('2d');
  g.fillStyle = '#25232d'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 5000; i++) { const v = 30 + rnd() * 26 | 0; g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`; g.fillRect(rnd() * 512, rnd() * 256, 2, 2); }
  g.fillStyle = '#d9d6cf'; g.fillRect(0, 14, 512, 5); g.fillRect(0, 237, 512, 5);
  g.fillStyle = '#ece8df'; g.fillRect(0, 125, 250, 6);
  const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function windowsTexture() {
  const c = mkCanvas(64, 128), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 10) for (let x = 4; x < 60; x += 10) if (rnd() < 0.42) { const w = rnd(); g.fillStyle = w < 0.5 ? '#ffb35c' : (w < 0.8 ? '#ff7ab8' : '#9fd8ff'); g.fillRect(x, y, 6, 6); }
  return canvasTex(c);
}
const plainAttrs = (list) => list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; });
let PALM = null;
function palmGeometries() {
  const trunk = [], leaves = [];
  const PH = 6.4, segs = 6; let prev = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, p = new THREE.Vector3(t * t * 1.0, t * PH, 0), len = p.distanceTo(prev);
    const geo = new THREE.CylinderGeometry(0.12 + (1 - t) * 0.07, 0.13 + (1 - t + 1 / segs) * 0.07, len * 1.05, 7);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize()));
    const mid = p.clone().add(prev).multiplyScalar(0.5); geo.translate(mid.x, mid.y, mid.z); trunk.push(geo); prev = p;
  }
  const top = prev.clone();
  for (let k = 0; k < 3; k++) { const s = new THREE.SphereGeometry(0.12, 6, 4); s.translate(top.x + Math.cos(k * 2.1) * 0.17, top.y - 0.16, Math.sin(k * 2.1) * 0.17); trunk.push(s); }
  for (let k = 0; k < 10; k++) {
    const leaf = new THREE.PlaneGeometry(3.3, 0.85, 6, 1), pos = leaf.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 1.65, y = pos.getY(i), t = x / 3.3;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - t * 0.3);
      pos.setXYZ(i, x, -Math.pow(t, 1.7) * 1.6 + 0.35 * t + Math.abs(y) * 0.25, y * w);
    }
    leaf.computeVertexNormals();
    leaf.rotateZ(0.3 + (k % 2) * 0.22); leaf.rotateY(k * Math.PI * 2 / 10 + (k % 3) * 0.12); leaf.translate(top.x, top.y, top.z);
    leaves.push(leaf);
  }
  return { trunk: mergeGeometries(plainAttrs(trunk)), leaves: mergeGeometries(plainAttrs(leaves)) };
}
const PALM_MAT = {
  trunk: new THREE.MeshStandardMaterial({ color: '#6a4a3c', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#2f6a45', roughness: 0.75, side: THREE.DoubleSide })
};
function instanced(geo, mat, list, group) {
  const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach(([x, y, z, ry, sx, sy, sz, col], i) => { e.set(0, ry, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy ?? sx, sz ?? sx)); im.setMatrixAt(i, m); if (col) im.setColorAt(i, col); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere(); group.add(im); return im;
}
// split along the road into 60 m chunks so off-screen and fogged-out chunks are skipped
function instancedChunks(geo, mat, list, group, size = 60) {
  const buckets = new Map();
  for (const it of list) { const k = Math.floor(it[0] / size); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); }
  const chunks = group.userData.chunks || (group.userData.chunks = []);
  for (const [k, items] of buckets) { const im = instanced(geo, mat, items, group); im.userData.cx = (k + 0.5) * size; chunks.push(im); }
}
function addPalms(group, spots) {
  if (!PALM) PALM = palmGeometries();
  const list = spots.map(([x, z]) => [x, 0, z, rnd() * Math.PI * 2, 0.85 + rnd() * 0.35]);
  instancedChunks(PALM.trunk, PALM_MAT.trunk, list, group); instancedChunks(PALM.leaves, PALM_MAT.leaf, list, group);
}
function makeRain() {
  const N = 1400, seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seeds[i * 3] = (Math.random() - 0.5) * 70; seeds[i * 3 + 1] = Math.random() * 26; seeds[i * 3 + 2] = (Math.random() - 0.5) * 50; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#a8b8ff', transparent: true, opacity: 0.35, depthWrite: false }));
  lines.frustumCulled = false; lines.userData = { N, seeds, t: 0 };
  return lines;
}
function updateRain(r, dt) {
  const u = r.userData, a = r.geometry.attributes.position.array; u.t += dt;
  for (let i = 0; i < u.N; i++) {
    let y = (u.seeds[i * 3 + 1] - u.t * 24) % 26; if (y < 0) y += 26;
    const x = u.seeds[i * 3] - (26 - y) * 0.08, z = u.seeds[i * 3 + 2], j = i * 6;
    a[j] = x; a[j + 1] = y; a[j + 2] = z; a[j + 3] = x + 0.05; a[j + 4] = y + 0.55; a[j + 5] = z;
  }
  r.geometry.attributes.position.needsUpdate = true;
  r.position.set(camera.position.x, 0, camera.position.z);
}

function buildStreet(kind) {
  const coast = kind === 'coast', rain = kind === 'rain';
  seed = coast ? 11 : rain ? 23 : 7;
  const P = rain
    ? { sky: [[0, '#04050c'], [0.3, '#0a0f2a'], [0.44, '#1d1a48'], [0.5, '#2e2462'], [0.515, '#0a0914'], [1, '#04040a']], sunTop: '#cfd8ff', sunBot: '#7f8fff', sunDir: new THREE.Vector3(-0.5, 0.35, -0.8).normalize(), light: '#9fb4ff', hemiSky: '#4a5aa8', hemiGround: '#0a0a14', fog: '#0b0e1f', road: 16, accent: '#5fb8ff', ink: '#00101d' }
    : coast
    ? { sky: [[0, '#26103f'], [0.26, '#6e1f6b'], [0.41, '#f0466d'], [0.47, '#ff8f52'], [0.5, '#ffd27a'], [0.515, '#3b1d4f'], [1, '#120a1c']], sunTop: '#fff3a6', sunBot: '#ff4f7b', sunDir: new THREE.Vector3(-0.6, 0.025, -0.8).normalize(), light: '#ff9e6b', hemiSky: '#ff9fb0', hemiGround: '#2a1840', fog: '#9c3c6c', road: 11, accent: '#ff5fa8', ink: '#1d0010' }
    : { sky: [[0, '#1c1446'], [0.28, '#5a2a7a'], [0.41, '#e8507a'], [0.47, '#ff8a4c'], [0.5, '#ffc46b'], [0.515, '#2b1a3d'], [1, '#120b1a']], sunTop: '#ffe58a', sunBot: '#ff6a5a', sunDir: new THREE.Vector3(-0.9, 0.05, -0.42).normalize(), light: '#ffb070', hemiSky: '#ffb3a0', hemiGround: '#2a1a3a', fog: '#b05676', road: 16, accent: '#ffb547', ink: '#1d0f00' };
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const far = new THREE.Group(); group.add(far); // sky, sun and hills travel with the camera
  const sky = skyTexture(P.sky);
  far.add(new THREE.Mesh(new THREE.SphereGeometry(230, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false })));
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: sunTexture(P.sunTop, P.sunBot), transparent: true, fog: false, depthWrite: false, color: new THREE.Color(1.35, 1.35, 1.35) }));
  sun.position.copy(P.sunDir).multiplyScalar(210); sun.lookAt(0, 0, 0); if (!rain) far.add(sun);

  // ground + road
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 700), new THREE.MeshStandardMaterial({ color: coast ? '#2a1a33' : '#1f1628', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(200, -0.02, 0); group.add(ground);
  const at = asphaltTexture(); at.repeat.set(900 / 12, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(900, P.road), new THREE.MeshStandardMaterial({ map: at, roughness: rain ? 0.14 : 0.55, metalness: rain ? 0.45 : 0.05, envMapIntensity: rain ? 1.7 : 0.75 }));
  road.rotation.x = -Math.PI / 2; road.position.set(200, 0.001, 0); road.receiveShadow = true; group.add(road);
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.35, P.road), new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.6 }));
  startLine.rotation.x = -Math.PI / 2; startLine.position.set(0, 0.004, 0); group.add(startLine);
  const ct = checkerTexture(); ct.repeat.set(4, P.road * 2);
  const finLine = new THREE.Mesh(new THREE.PlaneGeometry(2, P.road), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.6 }));
  finLine.rotation.x = -Math.PI / 2; finLine.position.set(RACE_LEN + 1, 0.004, 0); group.add(finLine);
  const gm = new THREE.MeshStandardMaterial({ color: '#22202a', roughness: 0.5, metalness: 0.6 });
  for (const s of [1, -1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.2, 0.3), gm); post.position.set(RACE_LEN, 3.1, s * (P.road / 2 + 0.5)); group.add(post); }
  const gBeam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, P.road + 1.4), gm); gBeam.position.set(RACE_LEN, 5.7, 0); group.add(gBeam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(P.road, 0.9), new THREE.MeshBasicMaterial({ map: finishTexture(), color: new THREE.Color(1.4, 1.4, 1.4) }));
  sign.rotation.y = -Math.PI / 2; sign.position.set(RACE_LEN - 0.22, 5.7, 0); group.add(sign);
  const walk = new THREE.MeshStandardMaterial({ color: '#4a3a55', roughness: 0.9 });
  for (const s of coast ? [1] : [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(900, 0.16, 4), walk); b.position.set(200, 0.08, s * (P.road / 2 + 2)); b.receiveShadow = true; group.add(b); }

  // far hills catch the haze
  const hillMat = new THREE.MeshStandardMaterial({ color: '#3a2150', roughness: 1, flatShading: true });
  const hills = [];
  for (let i = 0; i < 14; i++) {
    const a = (coast ? 1.35 : -2.6) + (i - 7) * 0.13 + rnd() * 0.05, r = 170 + rnd() * 30;
    hills.push([Math.cos(a) * r, 0, Math.sin(a) * r, rnd() * 3, 18 + rnd() * 22, 14 + rnd() * 22, 18 + rnd() * 22]);
  }
  instanced(new THREE.ConeGeometry(1, 1, 6), hillMat, hills, far);

  if (!coast) {
    // city blocks with lit windows
    const bm = new THREE.MeshStandardMaterial({ color: '#251a36', roughness: 0.85, emissive: '#ffffff', emissiveMap: windowsTexture(), emissiveIntensity: rain ? 1.5 : 0.85 });
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0);
    const blocks = [];
    for (const s of [1, -1]) for (let x = -190; x < 660; x += 9 + rnd() * 6) {
      if (x > -46 && x < 30) continue;
      const w = 7 + rnd() * 6, d = 6 + rnd() * 6, h = 6 + rnd() * 22;
      blocks.push([x, 0, s * (P.road / 2 + 4.5 + d / 2 + rnd() * 2), 0, w, h, d]);
    }
    instancedChunks(bg, bm, blocks, group);
    if (rain) { // neon signs on the buildings, mirrored in the wet road
      const cols = ['#ff3da8', '#2ee6d6', '#ffb547', '#9b5cff'].map((c) => new THREE.Color(c).multiplyScalar(2.2));
      const signs = [];
      for (const s of [1, -1]) for (let x = -150; x < 640; x += 22 + rnd() * 10) if (x < -30 || x > 24) signs.push([x, 4 + rnd() * 6, s * (P.road / 2 + 4.4), s > 0 ? Math.PI : 0, 1.1, 3.2, 1, cols[Math.floor(rnd() * cols.length)]]);
      instancedChunks(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), signs, group);
    }
    // street lamps
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8); pole.translate(0, 2.6, 0);
    const head = new THREE.BoxGeometry(0.9, 0.12, 0.3); head.translate(-0.35, 5.2, 0);
    const lamps = [];
    for (const s of [1, -1]) for (let x = -170; x < 650; x += 22) if (Math.abs(x + (s > 0 ? 11 : 0)) > 12) lamps.push([x + (s > 0 ? 11 : 0), 0, s * (P.road / 2 + 0.9), s > 0 ? -Math.PI / 2 : Math.PI / 2, 1]);
    instancedChunks(pole, new THREE.MeshStandardMaterial({ color: '#2b2433', roughness: 0.5, metalness: 0.6 }), lamps, group);
    instancedChunks(head, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(rain ? 2.2 : 1.5) }), lamps, group);
    const palms = [];
    for (const s of [1, -1]) for (let x = -160; x < 650; x += 10) if (Math.abs(x) > 4) palms.push([x + rnd() * 2, s * (P.road / 2 + 2.3)]);
    addPalms(group, palms);
  } else {
    // beach, ocean and a guard rail on the sea side
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(900, 10), new THREE.MeshStandardMaterial({ color: '#c08068', roughness: 1 }));
    beach.rotation.x = -Math.PI / 2; beach.position.set(200, -0.01, -(P.road / 2 + 5)); group.add(beach);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 420), new THREE.MeshStandardMaterial({ color: '#2e1c5c', roughness: 0.1, metalness: 0.55, envMapIntensity: 1.4 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(200, -0.25, -(P.road / 2 + 10 + 210)); group.add(sea);
    const metal = new THREE.MeshStandardMaterial({ color: '#a2a8b8', roughness: 0.35, metalness: 0.8 });
    const posts = []; for (let x = -180; x < 660; x += 3) posts.push([x, 0.35, -(P.road / 2 + 0.6), 0, 0.09, 0.7, 0.09]);
    instancedChunks(new THREE.BoxGeometry(1, 1, 1), metal, posts, group);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(860, 0.22, 0.06), metal); rail.position.set(240, 0.58, -(P.road / 2 + 0.66)); group.add(rail);
    const palms = [];
    for (let x = -170; x < 650; x += 6) palms.push([x + rnd() * 3, -(P.road / 2 + 2.5 + rnd() * 6)]);
    for (let x = -160; x < 650; x += 13) if (Math.abs(x) > 5) palms.push([x + rnd() * 2, P.road / 2 + 2.4]);
    addPalms(group, palms);
  }

  // warm low sun + violet fill
  group.add(new THREE.HemisphereLight(P.hemiSky, P.hemiGround, rain ? 0.75 : 1.15));
  const sunL = new THREE.DirectionalLight(P.light, rain ? 0.8 : 2.6);
  sunL.position.set(P.sunDir.x * 30, 7, P.sunDir.z * 30); sunL.target.position.set(0, 0, 0);
  sunL.shadow.mapSize.set(1024, 1024); sunL.shadow.bias = -0.0005; sunL.shadow.normalBias = 0.03;
  Object.assign(sunL.shadow.camera, { left: -6, right: 6, top: 4, bottom: -4, near: 1, far: 70 });
  group.add(sunL, sunL.target);
  const fill = new THREE.DirectionalLight('#6f63ff', 0.7); fill.position.set(6, 5, 8); group.add(fill);

  // reflections come from the same sky
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
  const sb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.sunBot).multiplyScalar(2.2) }));
  sb.position.copy(P.sunDir).multiplyScalar(9); if (!rain) es.add(sb);
  if (rain) for (let i = 0; i < 14; i++) { // neon blobs give the wet surfaces something to reflect
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45 + rnd() * 0.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(['#ff3da8', '#2ee6d6', '#ffb547', '#9b5cff'][i % 4]).multiplyScalar(3.5) }));
    const a = rnd() * Math.PI * 2; b.position.set(Math.cos(a) * 8.5, 0.4 + rnd() * 2.6, Math.sin(a) * 8.5); es.add(b);
  }
  const env = pmrem.fromScene(es, 0.02).texture;
  let rainMesh = null; if (rain) { rainMesh = makeRain(); group.add(rainMesh); }
  return { group, far, env, rain: rainMesh, bg: new THREE.Color(P.fog), fog: new THREE.Fog(P.fog, rain ? 22 : 45, rain ? 150 : 210), exposure: rain ? 1.15 : 1.0, accent: P.accent, ink: P.ink, sun: sunL, sunDir: P.sunDir, sunBase: sunL.position.clone() };
}
const GARAGE_ENV = { group: garage, env: scene.environment, bg: new THREE.Color('#06060b'), fog: new THREE.Fog('#06060b', 14, 26), exposure: 1.05, accent: '#2ee6d6', ink: '#04110f', sun: key };
const ENVS = { garage: GARAGE_ENV };
const LOCS = [['garage', 'Neon Garage', 'Underground tuning bay with a wet, mirrored floor.'], ['strip', 'Sunset Strip', 'Palm-lined city boulevard at golden hour.'], ['coast', 'Palm Coast', 'Ocean road with the sun sinking into the sea.'], ['rain', 'Neon Rain', 'Wet city streets at midnight, neon in every puddle.']];
let loc = 'garage';
try { loc = localStorage.getItem('raven-rs-loc') || 'garage'; } catch (e) { /* storage unavailable */ }
if (!LOCS.some((l) => l[0] === loc)) loc = 'garage';
let qPref = 'auto';
try { qPref = localStorage.getItem('raven-rs-quality') || 'auto'; } catch (e) { /* storage unavailable */ }
if (!['auto', 'high', 'medium', 'low', 'eco'].includes(qPref)) qPref = 'auto';
// eco = low graphics plus a 30 fps cap in the city and races, to keep laptops cool and save battery
let qLevel = qPref === 'auto' ? 'high' : qPref === 'eco' ? 'low' : qPref;
function setLocation(id) {
  if (!ENVS[id]) ENVS[id] = buildStreet(id);
  const e = ENVS[id]; loc = id;
  for (const [k, v] of Object.entries(ENVS)) v.group.visible = k === id;
  scene.environment = e.env; scene.background = e.bg; scene.fog = e.fog; renderer.toneMappingExposure = e.exposure;
  e.sun.castShadow = qLevel !== 'low';
  document.documentElement.style.setProperty('--accent', e.accent);
  document.documentElement.style.setProperty('--accent-ink', e.ink);
  document.getElementById('locName').textContent = LOCS.find((l) => l[0] === id)[1].toUpperCase();
  renderer.shadowMap.needsUpdate = true; invalidate();
  try { localStorage.setItem('raven-rs-loc', id); } catch (err) { /* storage unavailable */ }
}
