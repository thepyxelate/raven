/* ---- traffic lights: 22 s cycle, east-west first ---- */
function sigState(n, axis) {
  const ph = (roamT + n.sig.off) % 22;
  if (axis === 'ew') return ph < 9 ? 'g' : ph < 10 ? 'a' : 'r';
  return ph >= 11 && ph < 20 ? 'g' : ph >= 20 && ph < 21 ? 'a' : 'r';
}
const SIG_COL = { g: new THREE.Color(0.2, 2.4, 0.7), a: new THREE.Color(2.4, 1.3, 0.1), r: new THREE.Color(2.6, 0.12, 0.1) };
let sigT = 0;
function updateSignals() {
  if (roamT - sigT < 0.2) return; sigT = roamT;
  const m = world.sigMesh; world.sigHeads.forEach((h, i) => m.setColorAt(i, SIG_COL[sigState(h.n, h.axis)]));
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

/* ---- rain in the city ---- */
function setRoamRain(on) {
  roam.rain = on;
  if (on && !world.rainMesh) { world.rainMesh = makeRain(); world.group.add(world.rainMesh); }
  if (world.rainMesh) world.rainMesh.visible = on;
  Object.assign(world.roadMat, on ? { roughness: 0.2, metalness: 0.35, envMapIntensity: 1.25 } : { roughness: 0.78, metalness: 0.0, envMapIntensity: 0.8 });
  world.fog.near = on ? 30 : 70; LOD.far0 = on ? 420 : 620; world.fog.far = LOD.far0; world.fog.color.set(on ? '#8a8490' : '#c79c96'); world.bg.copy(world.fog.color);
  const b = $('roRain'); b.textContent = 'Rain (T): ' + (on ? 'On' : 'Off'); b.setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('raven-rs-rain', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
}

/* ---- routes on the lane graph ---- */
function nearestNode(x, z) { let best = null, bd = Infinity; for (const n of world.nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } return best; }
function routeBetween(a, b) {
  const N = world.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Array(N).fill(null), done = new Uint8Array(N);
  dist[a.id] = 0;
  for (;;) {
    let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === b.id) break; done[u] = 1;
    const n = world.nodes[u];
    for (const e of n.edges) {
      const o = e.a === n ? e.b : e.a, dir = e.a === n ? 1 : -1, w = (e.s1 - e.s0) * (e.type === 'street' ? 1.25 : 1);
      if (dist[u] + w < dist[o.id]) { dist[o.id] = dist[u] + w; prev[o.id] = { e, dir, from: u }; }
    }
  }
  if (a === b || !prev[b.id]) return null;
  const steps = []; let cur = b.id; while (cur !== a.id) { const p = prev[cur]; steps.unshift({ e: p.e, dir: p.dir }); cur = p.from; }
  return steps;
}
const endNodeOf = (st) => (st.dir > 0 ? st.e.b : st.e.a);
function routePolyline(steps) {
  const pts = [];
  for (const st of steps) {
    const e = st.e, n = Math.max(2, Math.ceil((e.s1 - e.s0) / 20));
    for (let i = 0; i <= n; i++) {
      const s = st.dir > 0 ? e.s0 + (e.s1 - e.s0) * i / n : e.s1 - (e.s1 - e.s0) * i / n, p = rPoint(e.road, s);
      const last = pts[pts.length - 1]; if (!last || Math.hypot(p.x - last[0], p.z - last[1]) > 1) pts.push([p.x, p.z, e.road.hAt ? e.road.hAt(s) : 0]);
    }
  }
  return pts;
}
// gates every ~220 m and at every turn
function checkpointsFrom(pts) {
  const cps = []; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i]; acc += Math.hypot(x1 - x0, z1 - z0);
    let turn = false;
    if (i + 1 < pts.length) { const ax = x1 - x0, az = z1 - z0, bx = pts[i + 1][0] - x1, bz = pts[i + 1][1] - z1; turn = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1) < 0.8; }
    if (acc >= 220 || (turn && acc > 60) || i === pts.length - 1) { const l = Math.hypot(x1 - x0, z1 - z0) || 1; cps.push({ x: x1, z: z1, y: pts[i][2], tx: (x1 - x0) / l, tz: (z1 - z0) / l }); acc = 0; }
  }
  return cps;
}
// nearest drivable lane point, optionally lined up with a heading
function snapToRoad(x, z, h) {
  let best = null, bd = Infinity;
  for (const e of world.edges) for (let s = e.lo + 6; s < e.hi - 6; s += 8) {
    const p = rPoint(e.road, s), d = Math.hypot(p.x - x, p.z - z); if (d >= bd) continue;
    bd = d; best = { e, s, dir: h === undefined ? 1 : (Math.cos(h) * p.tx + Math.sin(h) * p.tz >= 0 ? 1 : -1) };
  }
  return best;
}
