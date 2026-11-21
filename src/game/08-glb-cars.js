/* ---- built-in .glb cars (GLB_CARS): fetched once, then cloned for every rig ---- */
// A mesh whose triangles sit at several corners of the car (one "Tyres" mesh for both fronts, say) is cut into one
// mesh per corner, so each corner can become its own spinning pivot. Corners are judged around the middle of all wheels.
function splitWheels(root, re) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && re.test(o.material.name || '')) list.push(o); });
  if (!list.length) return 0;
  const all = new THREE.Box3(); list.forEach((o) => all.union(subBox(o)));
  const C = all.getCenter(new THREE.Vector3()), v = new THREE.Vector3();
  for (const o of list) {
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    const vi = (i) => (idx ? idx.getX(i) : i);
    const buckets = new Map();
    for (let t = 0; t < n; t += 3) {
      let x = 0, z = 0;
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, vi(t + k)).applyMatrix4(o.matrixWorld); x += v.x; z += v.z; }
      const key = (x / 3 > C.x ? 1 : 0) + (z / 3 > C.z ? 2 : 0);
      let b = buckets.get(key); if (!b) buckets.set(key, (b = [])); b.push(vi(t), vi(t + 1), vi(t + 2));
    }
    if (buckets.size < 2) { o.userData.wheel = true; continue; }
    for (const tris of buckets.values()) {
      // compact: only the vertices this corner uses, so its bounding box is the corner's alone
      const remap = new Map(), order = [];
      const index = tris.map((i) => { let j = remap.get(i); if (j === undefined) { j = order.length; remap.set(i, j); order.push(i); } return j; });
      const ng = new THREE.BufferGeometry();
      // read through getX..getW: quantized files store attributes interleaved and normalized, so the raw array is not one item per slot
      const get = ['getX', 'getY', 'getZ', 'getW'];
      for (const [name, a] of Object.entries(g.attributes)) {
        const arr = new Float32Array(order.length * a.itemSize);
        order.forEach((src, d) => { for (let c = 0; c < a.itemSize; c++) arr[d * a.itemSize + c] = a[get[c]](src); });
        ng.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
      }
      ng.setIndex(index);
      const m = new THREE.Mesh(ng, o.material); m.name = (o.name || 'wheel') + '_corner';
      m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); m.userData.wheel = true;
      o.parent.add(m);
    }
    o.removeFromParent(); g.dispose();
  }
  return list.length;
}
const glbCars = new Map(); // id -> { promise, cc }
const glbCar = (id) => { const e = glbCars.get(id); return e ? e.cc : null; };
function loadGlbCar(id) {
  const spec = GLB_CARS[id]; if (!spec) return null;
  if (glbCars.has(id)) return glbCars.get(id).promise;
  const ent = { cc: null }; glbCars.set(id, ent);
  ent.promise = fetch(spec.file).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + spec.file); return r.arrayBuffer(); })
    .then((buf) => parseCar(buf))
    .then((cc) => {
      splitWheels(cc.scene, spec.wheels);
      cc.name = modelName(id); cc.wheelFlag = true; cc.yaw = Math.PI / 2; // every one of these models faces +Z
      cc.meta = { ...defaultMeta(cc), length: spec.length, recolor: false, hideBay: false, hideInt: false };
      ent.cc = cc; onGlbReady(id); return cc;
    })
    .catch((e) => { console.warn('[car] could not load ' + spec.file, e); glbCars.delete(id); if (cfg.model === id) say('Could not load ' + modelName(id) + '.', true); });
  return ent.promise;
}
function onGlbReady(id) {
  if (cfg.model === id && !cfg.custom && !roam.active && !race.active) { rebuildCar(); render(); }
  for (const p of net.players.values()) {
    if (!p.rig || !p.rig.parent || p.look.model !== id) continue;
    const parent = p.rig.parent, old = p.rig; p.rig = makeLiteRig(p.look, p.color); p.rig.position.copy(old.position); p.rig.rotation.copy(old.rotation); p.rig.visible = old.visible; parent.remove(old); parent.add(p.rig);
  }
}
async function importCarFile(file) {
  if (!file) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { say('Please choose a .glb file (a single file with textures inside).', true); return; }
  if (file.size > 90e6) { say('That file is over 90 MB. Shrink the textures and export again.', true); return; }
  say('Reading ' + file.name + ' ...');
  try {
    const isText = /\.gltf$/i.test(file.name), buf = isText ? await file.text() : await file.arrayBuffer();
    const cc = await parseCar(buf);
    cc.name = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'My car';
    cc.meta = defaultMeta(cc);
    customCar = cc; cfg.custom = true;
    if (!isText) idbCall('readwrite', (s) => s.put(buf, 'buf')).catch(() => { /* too big to store here; the car will not be kept */ });
    persistMeta(); rebuildCar(); render();
    const i = carRig && carRig.userData.info;
    say(cc.name + ' loaded' + (i ? ' · ' + (i.tris / 1000).toFixed(0) + 'k triangles, ' + i.wheels + ' wheels found.' : '.'));
  } catch (e) { say('Could not read that file: ' + ((e && e.message) || e), true); }
}
async function loadCustomCar() {
  try {
    const meta = await idbCall('readonly', (s) => s.get('meta')), buf = await idbCall('readonly', (s) => s.get('buf'));
    if (!meta || !buf) { if (cfg.custom) { cfg.custom = false; rebuildCar(); } return; }
    const cc = await parseCar(buf); cc.name = meta.name || 'My car'; cc.meta = { ...defaultMeta(cc), ...meta.meta }; customCar = cc; if (meta.use) cfg.custom = true;
    if (cfg.custom) { rebuildCar(); render(); }
  } catch (e) { if (cfg.custom) { cfg.custom = false; rebuildCar(); render(); } }
}
function removeCustomCar() {
  customCar = null; cfg.custom = false;
  idbCall('readwrite', (s) => { s.clear(); return s; }).catch(() => { /* nothing stored */ });
  rebuildCar(); render(); say('Imported car removed.');
}
window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /\.(glb|gltf)$/i.test(f.name)) { e.preventDefault(); importCarFile(f); } });

function renderImportPicker(p, head, left) {
  const cc = customCar, M = cc && cc.meta;
  left.append(el('div', 'p-name', cc ? cc.name : 'Import your car'));
  head.append(el('div', 'p-desc', cc ? (cfg.custom ? 'Your model is in the garage. Engine, sound and handling come from the stock car you picked.' : 'Stock cars are selected.') : 'A .glb file with its textures inside. Drop it on the page or choose it.'));
  const f = el('div', 'form'), fi = el('input'); fi.type = 'file'; fi.accept = '.glb,.gltf,model/gltf-binary'; fi.hidden = true; fi.id = 'carFile'; fi.onchange = () => { importCarFile(fi.files[0]); };
  f.append(fi, skewBtn(cc ? 'Replace .glb' : 'Choose .glb file', 'primary', () => fi.click()));
  if (cc) f.append(skewBtn(cfg.custom ? 'Use stock cars' : 'Use my car', '', () => { cfg.custom = !cfg.custom; persistMeta(); rebuildCar(); render(); }), skewBtn('Remove', '', removeCustomCar));
  const box = el('div', 'impbox'); box.append(f);
  const info = el('div', 'p-desc'); info.style.textAlign = 'left'; info.style.maxWidth = 'none';
  const showInfo = () => {
    const i = carRig && carRig.userData.info; if (!i || !cfg.custom) { info.textContent = ''; return; }
    const w = [];
    if (!i.wheels) w.push('No wheels found, so they will not spin. Name them Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR.');
    else if (i.wheels < 4) w.push('Only ' + i.wheels + ' wheels found.');
    if (i.tris > 450000) w.push('Heavy model: it may run slowly. Hide the interior or engine bay, or reduce the polygons.');
    info.textContent = (i.tris / 1000).toFixed(0) + 'k triangles · ' + i.wheels + ' wheels · ' + i.length.toFixed(2) + ' m long' + (w.length ? ' — ' + w.join(' ') : '');
  };
  let tm = 0; const upd = (patch) => { Object.assign(M, patch); persistMeta(); if (!cfg.custom) return; clearTimeout(tm); tm = setTimeout(() => { rebuildCar(); showInfo(); }, 60); };
  const range = (label, min, max, step, get, set, fmt) => {
    const l = el('label', 'imp-l'), v = el('b', null, fmt(get())), r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = get();
    r.oninput = () => { set(+r.value); v.textContent = fmt(+r.value); }; l.append(label, ' ', v, r); return l;
  };
  const check = (label, get, set) => { const l = el('label', 'imp-l'), c = el('input'); c.type = 'checkbox'; c.checked = get(); c.onchange = () => set(c.checked); l.append(c, ' ' + label); return l; };
  if (cc) {
    const r1 = el('div', 'form');
    r1.append(skewBtn('Rotate 90°', '', () => upd({ rot: (M.rot + 1) % 4 })), skewBtn('Flip front/back', '', () => upd({ flip: !M.flip })),
      range('Length', 3.2, 6.2, 0.05, () => M.length, (v) => upd({ length: v }), (v) => v.toFixed(2) + ' m'),
      range('Height', -10, 25, 1, () => Math.round(M.lift * 100), (v) => upd({ lift: v / 100 }), (v) => v + ' cm'));
    const r2 = el('div', 'form');
    r2.append(check('Recolor body with my Paint colours', () => M.recolor, (v) => { M.recolor = v; persistMeta(); applyCustomPaint(); }),
      check('Hide engine bay and underbody', () => M.hideBay, (v) => upd({ hideBay: v })), check('Hide interior', () => M.hideInt, (v) => upd({ hideInt: v })));
    box.append(r1, r2);
    for (const g of cc.groups) {
      const row = el('div', 'form'); row.append(el('b', 'imp-l', g.label));
      const opts = g.toggle ? [[0, 'Off'], [1, 'On']] : (g.nums.includes(0) ? g.nums.map((n) => [n, n === 0 ? 'None' : 'Style ' + n]) : [[-1, 'None'], ...g.nums.map((n) => [n, 'Style ' + n])]);
      for (const [val, lab] of opts) { const b = skewBtn(lab, optSel(g, M) === val ? 'primary' : '', () => { upd({ opts: { ...M.opts, [g.key]: val } }); row.querySelectorAll('.btn').forEach((x) => x.classList.remove('primary')); b.classList.add('primary'); }); row.append(b); }
      box.append(row);
    }
    const nf = el('div', 'form'); nf.append(info); box.append(nf); showInfo();
  }
  const d = el('details', 'impguide'), s = el('summary', null, 'How to prepare your car'); d.append(s);
  const ul = el('ul');
  for (const t of [
    'Export one .glb with the textures embedded (Blender: File > Export > glTF 2.0, format glTF Binary). Draco and Meshopt compression work too.',
    'Wheels: make each wheel its own object (tyre, rim and brake together, any origin) and name it Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR. Anything with wheel, tyre or rim in its name is found. Front wheels steer, all spin.',
    'Paint: name the body paint material Body or Paint (or primary / secondary), then tick Recolor body to use the Paint colours.',
    'Tuning parts: name optional parts Opt_<Group>_<N>, for example Opt_Spoiler_1, Opt_Spoiler_2, Opt_Hood_1. Add an empty Opt_Spoiler_0 if you want a none choice. A single Opt_Rack becomes an on/off switch. Each group gets buttons here.',
    'Facing: the game points the front toward +X and tries to work it out from names like bonnet, boot, Wheel_FL. If the car faces backwards, press Flip front/back.',
    'Parts named lod, vlo, collision or shadow are hidden automatically.',
    'Keep it under about 300k triangles. Your model is visual only: sound, power and handling come from the stock car under Car and the Performance parts.'
  ]) ul.append(el('li', null, t));
  d.append(ul); box.append(d); p.append(box);
}

function makeRig(c, swap) {
  if (c.custom && customCar && !swap) return makeCustomRig();
  if (GLB_CARS[c.model]) { const cc = glbCar(c.model); if (cc) return makeGlbRig(cc); loadGlbCar(c.model); }
  const { car, wheels, dims } = buildCar(c);
  const sw = (root) => { if (swap) root.traverse((o) => { if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material); }); };
  sw(car);
  const rig = new THREE.Group(); rig.add(mergeByMaterial(car)); rig.userData.dims = dims;
  rig.userData.wheels = wheels.map((w) => {
    sw(w);
    const pos = w.position.clone(), ry = w.rotation.y;
    w.position.set(0, 0, 0); w.rotation.set(0, 0, 0);
    const m = mergeByMaterial(w); m.position.copy(pos); m.rotation.y = ry; m.userData.side = w.userData.side;
    m.traverse((o) => { o.castShadow = false; });
    rig.add(m); return m;
  });
  return rig;
}
function rebuildCar() {
  const pos = carRig ? carRig.position.clone() : null;
  if (carRig) { if (!carRig.userData.custom) carRig.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(carRig); }
  carRig = makeRig(cfg); if (pos) carRig.position.copy(pos); scene.add(carRig);
  renderer.shadowMap.needsUpdate = true; invalidate();
}
// collapse ~200 part meshes into one mesh per material (far fewer draw calls)
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) if (!(Math.hypot(nn.getX(i), nn.getY(i), nn.getZ(i)) > 1e-6)) nn.setXYZ(i, 0, 1, 0);
    g.clearGroups();
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
    o.geometry.dispose();
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(list, false), mat);
    m.castShadow = true; m.receiveShadow = true; out.add(m);
    list.forEach((g) => g.dispose());
  }
  return out;
}
