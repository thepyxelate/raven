/* ---- events: glowing markers around the city ---- */
const EVENTS = [
  { id: 'dash', type: 'sprint', name: 'Downtown Dash', from: [-400, 300], to: [400, -400], color: '#ffb547' },
  { id: 'coast', type: 'sprint', name: 'Coast Run to the Island', from: [-800, 640], to: [-200, 1100], color: '#ffb547' },
  { id: 'harbor', type: 'sprint', name: 'Harbor Run', from: [0, -400], to: [800, 560], color: '#ffb547' },
  { id: 'loop', type: 'circuit', name: 'Neon Loop', corners: [[-300, -300], [300, -300], [300, 200], [-300, 200]], laps: 2, color: '#2ee6d6' },
  { id: 'ring', type: 'circuit', name: 'Ring Highway', ring: true, laps: 1, color: '#2ee6d6' },
  { id: 'isle', type: 'drift', name: 'Island Drift', at: [-200, 1180], time: 60, color: '#ff3da8' },
  { id: 'sky', type: 'sprint', name: 'Skyway Sprint', from: [-560, 640], to: [900, -200], color: '#ffb547' },
  { id: 'drag', type: 'drag', name: 'Drag Strip', at: [200, 640], color: '#ffe066' },
  { id: 'garage', type: 'garage', name: 'Raven RS Garage', at: [-100, 250], color: '#ffffff' },
  { id: 'hospital', type: 'hospital', name: 'Neon Bay Hospital', at: [100, -60], color: '#ff4d5e' }
];
const TYPE_LABEL = { sprint: 'Sprint', circuit: 'Circuit', drift: 'Drift', drag: 'Drag race', garage: 'Garage', hospital: 'Ambulance 103' };
const markers = [];
function eventRoute(def) {
  if (def.ring) {
    const es = world.edges.filter((e) => e.road.ring).sort((a, b) => a.s0 - b.s0);
    return es.map((e) => ({ e, dir: 1 }));
  }
  if (def.corners) {
    const ns = def.corners.map(([x, z]) => nearestNode(x, z)), steps = [];
    for (let i = 0; i < ns.length; i++) { const r = routeBetween(ns[i], ns[(i + 1) % ns.length]); if (r) steps.push(...r); }
    return steps;
  }
  return routeBetween(nearestNode(def.from[0], def.from[1]), nearestNode(def.to[0], def.to[1]));
}
function columnTex() {
  const c = mkCanvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return canvasTex(c);
}
function buildMarkers() {
  const ct = columnTex(), colGeo = new THREE.CylinderGeometry(3.4, 3.4, 26, 28, 1, true), ringGeo = new THREE.RingGeometry(3.2, 3.9, 32);
  colGeo.translate(0, 13, 0); ringGeo.rotateX(-Math.PI / 2);
  for (const def of EVENTS) {
    let x, z, h = 0, y = 0, steps = null;
    if (def.type === 'sprint' || def.type === 'circuit') {
      steps = eventRoute(def); if (!steps || !steps.length) continue;
      const st = steps[0], hA = st.e.road.hAt; let s = st.dir > 0 ? st.e.lo + 22 : st.e.hi - 22;
      if (hA && hA(s) > 0.4) s = st.dir > 0 ? st.e.lo + 3 : st.e.hi - 3; // a marker on a ramp sits where it meets the ground
      const p = lanePose(st.e, st.dir, laneOff(st.e.type, 0), s);
      x = p.x; z = p.z; h = Math.atan2(p.tz, p.tx); y = st.e.road.hAt ? st.e.road.hAt(s) : 0;
    } else if (def.type === 'drift') { [x, z] = def.at; h = 0; }
    else { const sn = snapToRoad(def.at[0], def.at[1]), p = lanePose(sn.e, 1, laneOff(sn.e.type, 0), sn.s); x = p.x; z = p.z; h = Math.atan2(p.tz, p.tx); }
    const col = new THREE.Color(def.color);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m1 = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ map: ct, color: col.clone().multiplyScalar(1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const m2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    m2.position.y = 0.12; g.add(m1, m2); world.group.add(g);
    const tag = { el: null, msg: '', msgT: 0 }; ensureTagEl(tag, def.name); tag.el.classList.add('mk'); tag.nm.style.borderColor = def.color;
    const sub = el('span', 'mk-type', TYPE_LABEL[def.type]); sub.style.color = def.color; tag.el.insertBefore(sub, tag.nm);
    markers.push({ def, x, z, y, h, steps, group: g, tag });
  }
  // two checkpoint gates (the next one, and the one after)
  const gateTex = columnTex(), gg = new THREE.PlaneGeometry(22, 7); gg.translate(0, 3.5, 0);
  ev.gates = [0, 1].map((i) => { const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ map: gateTex, color: new THREE.Color(i ? '#ffb547' : '#ffffff').multiplyScalar(i ? 0.8 : 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; world.group.add(m); return m; });
}
