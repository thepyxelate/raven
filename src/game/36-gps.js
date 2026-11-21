/* ---- full map and GPS ---- */
/* ---- GPS ----
   The route starts on the lane the car is actually on, in the direction it is driving (a U-turn costs extra, so the
   GPS only says "turn around" when that is really shorter), and ends at the point of the road nearest the target,
   not at the nearest crossing. While driving, progress is tracked along the route itself, the arrow looks a speed-
   dependent distance ahead, the next turn is announced, and the route is rebuilt when the car leaves it or drives
   the wrong way along it. */
const GPS_UTURN = 160; // metres of detour a U-turn is "worth"
const edgeW = (e) => (e.s1 - e.s0) * (e.type === 'street' ? 1.25 : 1);
// ban: an edge not to use (the one the car is on: turning back along it is the U-turn option, priced separately)
function dijkstraFrom(src, ban) {
  const N = world.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Array(N).fill(null), done = new Uint8Array(N);
  dist[src.id] = 0;
  for (;;) {
    let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0) break; done[u] = 1;
    const n = world.nodes[u];
    for (const e of n.edges) { if (e === ban) continue; const o = e.a === n ? e.b : e.a, w = dist[u] + edgeW(e); if (w < dist[o.id]) { dist[o.id] = w; prev[o.id] = { e, dir: e.a === n ? 1 : -1, from: u }; } }
  }
  return { dist, prev };
}
const stepsTo = (D, src, dst) => { const out = []; let cur = dst.id; while (cur !== src.id) { const p = D.prev[cur]; if (!p) return null; out.unshift({ e: p.e, dir: p.dir }); cur = p.from; } return out; };
// nearest point on any edge; y (when given) keeps the car on the deck or the street it is really on
function gpsSnap(x, z, y) {
  let best = null, bd = Infinity;
  for (const e of world.edges) for (let s = e.s0 + 2; s <= e.s1 - 2; s += 6) {
    const p = rPoint(e.road, s), hy = e.road.hAt ? e.road.hAt(s) : 0;
    if (y !== undefined && Math.abs(hy - y) > 4) continue;
    const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { e, s, p }; }
  }
  if (!best && y !== undefined) return gpsSnap(x, z);
  return best;
}
// points along one edge from s=a to s=b
function edgePts(e, a, b) {
  const pts = [], n = Math.max(1, Math.ceil(Math.abs(b - a) / 15));
  for (let i = 0; i <= n; i++) { const sv = a + (b - a) * i / n, p = rPoint(e.road, sv); pts.push([p.x, p.z, e.road.hAt ? e.road.hAt(sv) : 0]); }
  return pts;
}
function gpsBuild(x, z, h, y, tx, tz) {
  const A = gpsSnap(x, z, y), B = gpsSnap(tx, tz); if (!A || !B) return null;
  const fwd = Math.cos(h) * A.p.tx + Math.sin(h) * A.p.tz >= 0 ? 1 : -1;
  // leaving the current edge: ahead (to its forward end) or after a U-turn (to the end behind)
  const exits = [fwd, -fwd].map((d) => ({ d, node: d > 0 ? A.e.b : A.e.a, cost: (d > 0 ? A.e.s1 - A.s : A.s - A.e.s0) + (d === fwd ? 0 : GPS_UTURN) }));
  // reaching the target edge from either of its ends
  const ins = [{ node: B.e.a, d: 1, cost: B.s - B.e.s0 }, { node: B.e.b, d: -1, cost: B.e.s1 - B.s }];
  let best = null;
  // same edge, target ahead: straight along it
  // same edge: straight to it, or turn around if it is behind
  if (A.e === B.e) best = (B.s - A.s) * fwd >= 0 ? { cost: Math.abs(B.s - A.s), pts: edgePts(A.e, A.s, B.s) } : { cost: Math.abs(B.s - A.s) + GPS_UTURN, uturn: true, pts: edgePts(A.e, A.s, B.s) };
  for (const ex of exits) {
    const D = dijkstraFrom(ex.node, A.e);
    for (const en of ins) {
      const c = ex.cost + D.dist[en.node.id] + en.cost; if (!(c < (best ? best.cost : Infinity))) continue;
      const steps = ex.node === en.node ? [] : stepsTo(D, ex.node, en.node); if (!steps) continue;
      best = { cost: c, uturn: ex.d !== fwd, pts: [...edgePts(A.e, A.s, ex.d > 0 ? A.e.s1 : A.e.s0), ...routePolyline(steps), ...edgePts(B.e, en.d > 0 ? B.e.s0 : B.e.s1, B.s)] };
    }
  }
  if (!best) return null;
  const pts = [[x, z, y || 0], ...best.pts, [tx, tz, 0]].filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.5);
  // cumulative distance along the route, and the turns on it (heading change over ~20 m either side of a point)
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (L) => gpsPointAt({ pts, cum }, L), turns = [];
  for (let L = 25; L < cum[cum.length - 1] - 10; L += 5) {
    const a = at(L - 20), m = at(L), b = at(L + 20), ax = m[0] - a[0], az = m[1] - a[1], bx = b[0] - m[0], bz = b[1] - m[1];
    const ang = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
    if (Math.abs(ang) > 0.6) { const last = turns[turns.length - 1]; if (last && L - last.L < 35) { if (Math.abs(ang) > Math.abs(last.ang)) Object.assign(last, { L, ang }); } else turns.push({ L, ang }); }
  }
  return { pts, cum, turns, uturn: !!best.uturn, idx: 0, along: 0, offT: 0, wrongT: 0 };
}
// the point a given distance along the route
function gpsPointAt(g, L) {
  const { pts, cum } = g; L = clamp(L, 0, cum[cum.length - 1]);
  let i = 1; while (i < cum.length - 1 && cum[i] < L) i++;
  const k = (L - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
}
function setWaypoint(x, z, quiet) {
  const R = roam, r = gpsBuild(R.x, R.z, R.h, R.y, x, z);
  roam.wp = { x, z }; roam.gpsT = roamT; roam.gpsR = r;
  roam.gps = r ? r.pts : [[R.x, R.z, 0], [x, z, 0]];
  if (!quiet) showPop(r && r.uturn ? 'GPS SET · TURN AROUND' : 'GPS SET', 'info');
}
// keep track of where the car is on the route; returns { tgt, left, turn } or null when arrived
function gpsTrack(dt) {
  const R = roam, g = roam.gpsR;
  if (!g) { const d = Math.hypot(roam.wp.x - R.x, roam.wp.z - R.z); return d < 25 ? null : { tgt: roam.wp, left: d }; }
  const { pts, cum } = g;
  // project the car on segments around the last known position (never jump far ahead to a crossing of the route)
  let bi = g.idx, bd = Infinity, bl = g.along;
  for (let i = Math.max(1, g.idx - 3); i < Math.min(pts.length, g.idx + 25); i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((R.x - x0) * dx + (R.z - z0) * dz) / L2, 0, 1), d = Math.hypot(R.x - x0 - dx * t, R.z - z0 - dz * t);
    if (d < bd) { bd = d; bi = i; bl = cum[i - 1] + Math.sqrt(L2) * t; }
  }
  g.idx = bi; g.along = Math.max(g.along - 10, bl);
  const total = cum[cum.length - 1], left = total - g.along;
  if (left < 20 || Math.hypot(roam.wp.x - R.x, roam.wp.z - R.z) < 18) return null;
  // off the route, or driving the wrong way along it: rebuild (at most every 2 s)
  const sx = pts[bi][0] - pts[bi - 1][0], sz = pts[bi][1] - pts[bi - 1][1], sl = Math.hypot(sx, sz) || 1;
  const along = (R.vx * sx + R.vz * sz) / sl;
  g.offT = bd > 16 ? g.offT + dt : 0;
  g.wrongT = along < -4 ? g.wrongT + dt : Math.max(0, g.wrongT - dt);
  if ((g.offT > 1 || g.wrongT > 1.5) && roamT - (roam.gpsT || 0) > 2) { setWaypoint(roam.wp.x, roam.wp.z, true); return gpsTrack(0); }
  // look further ahead the faster the car goes
  const sp = Math.hypot(R.vx, R.vz), p = gpsPointAt(g, g.along + clamp(18 + sp * 1.1, 18, 70));
  const nt = g.turns.find((t) => t.L > g.along + 4);
  return { tgt: { x: p[0], z: p[1] }, left, turn: nt && nt.L - g.along < 400 ? { d: nt.L - g.along, right: nt.ang > 0, sharp: Math.abs(nt.ang) > 2.4 } : null, uturn: g.uturn && g.along < 30 };
}
function setMap(on) {
  roam.mapOpen = on; $('bigmap').hidden = !on;
  for (const k in roam.keys) roam.keys[k] = false;
  if (on) drawBigMap();
}
function drawBigMap() {
  const cv = $('bigmapC'), g = cv.getContext('2d'), W = cv.width, H = cv.height, sc = W / 2000;
  g.drawImage(world.map, 0, 0, W, H);
  const P = (x, z) => [(x + 1000) * sc, (z + 1000) * sc];
  const gr = roam.gpsR ? [[roam.x, roam.z, 0], ...roam.gpsR.pts.slice(roam.gpsR.idx)] : roam.gps;
  if (gr) { g.strokeStyle = '#ff5fa8'; g.lineWidth = 4; g.beginPath(); gr.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }
  g.font = '600 13px "Inter", sans-serif'; g.textBaseline = 'middle';
  for (const m of markers) {
    const [a, b] = P(m.x, m.z); g.fillStyle = m.def.color; g.beginPath(); g.arc(a, b, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = a > W - 160 ? 'right' : 'left'; g.fillText(m.def.name, a + (a > W - 160 ? -11 : 11), b);
  }
  for (const p of net.players.values()) if (p.x !== undefined) { const [a, b] = P(p.x, p.z); g.fillStyle = p.color; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  if (roam.wp) { const [a, b] = P(roam.wp.x, roam.wp.z); g.strokeStyle = '#ff5fa8'; g.lineWidth = 3; g.beginPath(); g.arc(a, b, 10, 0, Math.PI * 2); g.stroke(); }
  const [px, pz] = P(roam.x, roam.z); g.save(); g.translate(px, pz); g.rotate(roam.h + Math.PI / 2);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
}
$('bigmapC').addEventListener('click', (e) => {
  const cv = $('bigmapC'), r = cv.getBoundingClientRect(), sc = cv.width / 2000;
  const x = (e.clientX - r.left) * cv.width / r.width / sc - 1000, z = (e.clientY - r.top) * cv.height / r.height / sc - 1000;
  setWaypoint(x, z); drawBigMap();
});
$('bigmapC').addEventListener('contextmenu', (e) => { e.preventDefault(); roam.gps = null; roam.wp = null; roam.gpsR = null; drawBigMap(); });
