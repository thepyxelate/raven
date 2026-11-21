/* ================= import your own car (.glb) ================= */
// The model is only the looks: engine, sound and handling still come from the stock car picked under "Car".
// It is turned to face +X, scaled, set on the ground, and its wheels are split off so they spin and steer.
const WHEEL_RE = /wheel|tyre|tire|rueda|felge|(^|[^a-z])rim([^a-z]|$)/i;
const NOT_WHEEL = /steer|handle|volant|spare|arch|well|cover|fender|(^|[^a-z])rul([^a-z]|$)/i;
const HIDE_LOD = /(^|[^a-z0-9])(vlo|lod\d*|lowlod|collision|collider|col|hitbox|shadow)([^a-z0-9]|$)/i;
const HIDE_BAY = /engine|[0-9]jz|jzx|radiator|intercooler|kebulas|underbody|undercarriage|gearbox|driveshaft/i;
const HIDE_INT = /tarpeda|torpeda|dashboard|interior|seat|ruchnoy|nexia2_|gauge|console|(^|[^a-z])rul([^a-z]|$)/i;
const OPT_RE = /^opt[_\s.-]+(.+?)(?:[_\s.-]+(\d+))?$/i;
const NOT_PAINT = /glass|window|tire|tyre|rubber|wheel|rim|light|lamp|chrome|interior|seat|brake|disc|caliper|grille|mirror|plate|black|plastic|carbon/i;
let customCar = null; // { name, scene, groups, paint, yaw, lenSrc, meta }

const idbCall = (mode, fn) => new Promise((res, rej) => {
  let rq; try { rq = indexedDB.open('raven-rs-mycar', 1); } catch (e) { rej(e); return; }
  rq.onupgradeneeded = () => rq.result.createObjectStore('car');
  rq.onerror = () => rej(rq.error);
  rq.onsuccess = () => {
    const db = rq.result;
    try {
      const tx = db.transaction('car', mode); const out = fn(tx.objectStore('car'));
      tx.oncomplete = () => { db.close(); res(out && out.result); }; tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
    } catch (e) { db.close(); rej(e); }
  };
});
const persistMeta = () => { if (!customCar) return; idbCall('readwrite', (s) => s.put({ name: customCar.name, meta: customCar.meta, use: !!cfg.custom }, 'meta')).catch(() => { /* storage is optional */ }); };

// bounding box of what is actually drawn (hidden parts and LOD stand-ins do not count)
function visBox(root, skipLod) {
  const b = new THREE.Box3(), t = new THREE.Box3();
  root.updateMatrixWorld(true);
  (function walk(o) {
    if (!o.visible || (skipLod && o.name && HIDE_LOD.test(o.name))) return;
    if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); b.union(t); }
    for (const c of o.children) walk(c);
  })(root);
  return b;
}
const subBox = (o) => visBox(o, false);

async function parseCar(buf) {
  const loader = new GLTFLoader(), dr = new DRACOLoader();
  dr.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
  loader.setDRACOLoader(dr); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => (typeof buf === 'string' ? loader.parse(buf, '', res, rej) : loader.parse(buf, '', res, rej)));
  dr.dispose();
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  const triBy = new Map(); let meshes = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return; meshes++;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) triBy.set(m, (triBy.get(m) || 0) + n);
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m.map) m.map.anisotropy = 4;
  });
  if (!meshes) throw new Error('the file has no meshes');
  // game exports often mark every textured part as "blend", which sorts badly: treat them as cut-outs (spokes, grilles) unless they are glass or lights
  for (const m of triBy.keys()) if (m.transparent && m.map && !/glass|window|windscreen|light|lamp|lens/i.test(m.name || '')) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; m.opacity = 1; m.needsUpdate = true; }
  // option groups: Opt_Spoiler_1, Opt_Spoiler_2 ... (variants) or Opt_Rack (on/off)
  const gm = new Map();
  scene.traverse((o) => {
    const m = OPT_RE.exec(o.name || ''); if (!m) return;
    const key = m[1].toLowerCase(); let g = gm.get(key); if (!g) { g = { key, label: m[1].replace(/[_.-]+/g, ' '), nums: new Set(), toggle: true }; gm.set(key, g); }
    if (m[2] !== undefined) { g.nums.add(+m[2]); g.toggle = false; }
  });
  const groups = [...gm.values()].map((g) => ({ key: g.key, label: g.label, toggle: g.toggle, nums: [...g.nums].sort((a, b) => a - b) }));
  // paint: GTA-style "primary"/"secondary" markers, else materials called body/paint, else the biggest plain one
  const paint = []; const seen = new Set();
  const addPaint = (mat, role, guess) => { if (seen.has(mat)) return; seen.add(mat); paint.push({ mat, role, guess, orig: { color: mat.color.clone(), map: mat.map, metalness: mat.metalness, roughness: mat.roughness } }); };
  for (const m of triBy.keys()) { if (/^primary/i.test(m.name)) addPaint(m, 1, false); else if (/^secondary/i.test(m.name)) addPaint(m, 2, false); }
  if (!paint.length) {
    for (const m of triBy.keys()) if (/(^|[^a-z])(body|paint|carpaint|exterior|shell|lak|kuzov)/i.test(m.name) && !NOT_PAINT.test(m.name)) addPaint(m, 1, false);
  }
  if (!paint.length) {
    let best = null, bt = 0; for (const [m, t] of triBy) if (!NOT_PAINT.test(m.name || '') && t > bt && !m.transparent) { best = m; bt = t; }
    if (best) addPaint(best, 1, true);
  }
  // facing: which way is the front, judged from part names (bonnet, bumpers, wheels lf/rf vs lb/rb ...)
  const box = visBox(scene, true), size = box.getSize(new THREE.Vector3()), alongZ = size.z >= size.x;
  const F = /^(front|frontbump|bonnet|hood|grille|grill|fbumper)$/, R = /^(rear|rearbump|boot|trunk|exhaust|spoiler|taillight|taillights|rbumper)$/, WF = /^(lf|rf|fl|fr|f)$/, WR = /^(lb|rb|bl|br|rl|rr|lr|r|b)$/;
  let sum = 0; const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.name) return; const tk = o.name.toLowerCase().split(/[^a-z0-9]+/); let sc = 0;
    if (tk.some((x) => F.test(x))) sc = 1; else if (tk.some((x) => R.test(x))) sc = -1;
    else if (tk.some((x) => x === 'wheel' || x === 'tire' || x === 'tyre')) { if (tk.some((x) => WF.test(x))) sc = 1; else if (tk.some((x) => WR.test(x))) sc = -1; }
    if (!sc) return;
    const sb = subBox(o); if (!sb.isEmpty()) sb.getCenter(v); else o.getWorldPosition(v);
    sum += sc * (alongZ ? v.z : v.x);
  });
  const fs = sum >= 0 ? 1 : -1;
  const yaw = alongZ ? fs * Math.PI / 2 : (fs > 0 ? 0 : Math.PI);
  return { scene, groups, paint, yaw, lenSrc: Math.max(size.x, size.z), meshes };
}
function defaultMeta(cc) {
  const L = cc.lenSrc, tris = (() => { let t = 0; cc.scene.traverse((o) => { if (o.isMesh && !HIDE_LOD.test(o.name || '')) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return t; })();
  return { rot: 0, flip: false, length: L >= 3.4 && L <= 6.2 ? Math.round(L * 20) / 20 : 4.5, lift: 0, recolor: cc.paint.some((p) => /^(primary|secondary)/i.test(p.mat.name)), hideBay: true, hideInt: tris > 400000, opts: {} };
}
const optSel = (g, M) => (M.opts[g.key] !== undefined ? M.opts[g.key] : (g.toggle ? 1 : g.nums[0]));
function applyCustomPaint() {
  const cc = customCar; if (!cc) return;
  const f = CM.paint;
  for (const p of cc.paint) {
    const m = p.mat, had = !!m.map;
    if (cc.meta.recolor) { m.map = null; m.color.set(p.role === 2 ? cfg.color2 : cfg.color); m.metalness = f.metalness; m.roughness = f.roughness; }
    else { m.map = p.orig.map; m.color.copy(p.orig.color); m.metalness = p.orig.metalness; m.roughness = p.orig.roughness; }
    if (had !== !!m.map) m.needsUpdate = true;
  }
  invalidate();
}
function makeCustomRig() { return makeGlbRig(customCar); }
function makeGlbRig(cc) {
  const M = cc.meta, rig = new THREE.Group(), holder = new THREE.Group(), src = cc.scene.clone(true);
  rig.userData.custom = true;
  src.traverse((o) => {
    if (!o.name) return;
    const m = OPT_RE.exec(o.name);
    if (m) { const g = cc.groups.find((x) => x.key === m[1].toLowerCase()); if (g) { const s = optSel(g, M); o.visible = m[2] === undefined ? s !== 0 : +m[2] === s; } }
    if (HIDE_LOD.test(o.name) || (M.hideBay && HIDE_BAY.test(o.name)) || (M.hideInt && HIDE_INT.test(o.name))) o.visible = false;
  });
  holder.add(src); rig.add(holder);
  holder.rotation.y = cc.yaw + M.rot * Math.PI / 2 + (M.flip ? Math.PI : 0);
  let b = visBox(rig); holder.scale.setScalar(M.length / Math.max(0.5, b.max.x - b.min.x));
  b = visBox(rig); holder.position.set(-(b.min.x + b.max.x) / 2, -b.min.y + M.lift, -(b.min.z + b.max.z) / 2);
  rig.updateMatrixWorld(true);
  // wheels: every mesh under a wheel-named part, grouped by corner of the car, each corner turned into a spinning pivot
  const items = [];
  (function collect(o, inW) {
    if (!o.visible) return;
    const w = inW || (cc.wheelFlag ? !!o.userData.wheel : (!!o.name && WHEEL_RE.test(o.name) && !NOT_WHEEL.test(o.name)));
    if (o.isMesh && w) items.push(o);
    for (const c of o.children) collect(c, w);
  })(src, false);
  const wheels = [];
  if (items.length) {
    const cen = items.map((o) => subBox(o).getCenter(new THREE.Vector3()));
    const mx = cen.reduce((s, c) => s + c.x, 0) / cen.length, mz = cen.reduce((s, c) => s + c.z, 0) / cen.length;
    const cl = new Map(); items.forEach((o, i) => { const k = (cen[i].x > mx ? 1 : 0) + (cen[i].z > mz ? 2 : 0); if (!cl.has(k)) cl.set(k, []); cl.get(k).push(o); });
    for (const list of cl.values()) {
      const ub = new THREE.Box3(); list.forEach((o) => ub.union(subBox(o)));
      const sz = ub.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y) / 2;
      if (r < 0.18 || r > 0.62 || sz.z > r * 2) continue;
      const c = ub.getCenter(new THREE.Vector3()), pivot = new THREE.Group(); pivot.position.copy(c); pivot.userData.side = 1; pivot.userData.r = r;
      const inv = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
      for (const o of list) { const mw = o.matrixWorld.clone().premultiply(inv); o.removeFromParent(); mw.decompose(o.position, o.quaternion, o.scale); pivot.add(o); }
      rig.add(pivot); wheels.push(pivot);
    }
  }
  let xf = 1.4, xr = -1.36, r = 0.33;
  if (wheels.length) {
    const xm = wheels.reduce((s, w) => s + w.position.x, 0) / wheels.length;
    holder.position.x -= xm; wheels.forEach((w) => { w.position.x -= xm; });
    const fr = wheels.filter((w) => w.position.x > 0), rr = wheels.filter((w) => w.position.x <= 0), av = (a) => a.reduce((s, w) => s + w.position.x, 0) / a.length;
    if (fr.length) xf = av(fr); if (rr.length) xr = av(rr);
    r = wheels.reduce((s, w) => s + w.userData.r, 0) / wheels.length;
  } else { const bb = visBox(rig); xf = bb.max.x * 0.62; xr = bb.min.x * 0.62; }
  rig.updateMatrixWorld(true);
  const bb = visBox(rig);
  let tris = 0;
  rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; if (o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  rig.userData.wheels = wheels;
  rig.userData.dims = { front: bb.max.x, rear: bb.min.x, xf, xr, r, exY: Math.max(0.12, r * 0.85), exZ: Math.min(0.9, (bb.max.z - bb.min.z) * 0.28) };
  rig.userData.info = { tris: Math.round(tris), wheels: wheels.length, length: bb.max.x - bb.min.x, width: bb.max.z - bb.min.z };
  if (cc === customCar) applyCustomPaint();
  return rig;
}
