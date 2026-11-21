/* ---- road layout, crossings and the lane graph ---- */
import { SHOP_SIGNS } from '../world/signs.js';
// street segments left out of the grid: they merge blocks into parks, plazas and superblocks, and leave T-junctions
const GAPS = {
  x: { '-100': [[-200, 0]], 300: [[430, 560]], '-520': [[-660, -520]], '-660': [[100, 300]], '-300': [[-800, -660]] },
  z: { '-100': [[-200, 0]], 100: [[200, 400]], '-660': [[400, 580]] }
};
const SPECIALS = [{ k: 'park', x0: -200, z0: -200, x1: 0, z1: 0 }, { k: 'fair', x0: 200, z0: 430, x1: 400, z1: 560 }, { k: 'mall', x0: -660, z0: -660, x1: -400, z1: -520 }];
function roadLayout() {
  const roads = [];
  const add = (type, pts, closed = false) => { const r = { id: roads.length, type, w: RW[type], pts, closed, marks: [] }; roads.push(r); return r; };
  const XL = [-800, -660, -520, -400, -300, -200, -100, 0, 100, 200, 300, 400, 580, 800];
  const ZL = [-800, -660, -520, -400, -300, -200, -100, 0, 100, 200, 300, 430, 560];
  const AVE_X = [-400, 0, 400], AVE_Z = [-400, 0, 300], OUT_Z = [-400, 0];
  const spans = (lo, hi, gaps) => { const out = []; let a = lo; for (const [g0, g1] of (gaps || []).slice().sort((p, q) => p[0] - q[0])) { if (g0 > a) out.push([a, g0]); a = Math.max(a, g1); } if (a < hi) out.push([a, hi]); return out; };
  for (const x of XL) for (const [a, b] of spans(-800, 640, GAPS.x[x])) add(AVE_X.includes(x) ? 'avenue' : 'street', [[x, a], [x, b]]);
  for (const z of ZL) { const lim = OUT_Z.includes(z) ? 900 : 800; for (const [a, b] of spans(-lim, lim, GAPS.z[z])) add(AVE_Z.includes(z) ? 'avenue' : 'street', [[a, z], [b, z]]); }
  // ring highway with rounded corners; its south side is the coast boulevard at z = 640
  const ring = add('highway', roundRect(-900, -900, 900, 640, 90), true); ring.ring = true;
  // the harbor bridge to the island, and the island's loop road
  const bridge = add('avenue', [[-200, 640], [-200, 1100]]); bridge.isBridge = true;
  add('avenue', roundRect(-430, 1100, 30, 1260, 40), true).isle = true;
  const sky = add('highway', skywayPts()); sky.sky = true;
  for (const r of roads) { r.cum = [0]; for (let i = 1; i < r.pts.length; i++) r.cum.push(r.cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])); r.len = r.cum[r.cum.length - 1]; }
  ring.hAt = (s) => { const p = rPoint(ring, s); return Math.abs(p.z + 900) < 0.5 ? viaductH(p.x) : 0; };
  bridge.hAt = (s) => bridgeH(640 + s);
  sky.hAt = (s) => skyH(s, sky.len);
  ELEVATED = roads.filter((r) => r.hAt);
  for (const r of roads) r.axis = r.closed ? null : (r.pts[0][0] === r.pts[r.pts.length - 1][0] ? 'ns' : 'ew');
  return { roads, XL, ZB: [...ZL, 640] };
}
function rPoint(r, s) {
  s = r.closed ? ((s % r.len) + r.len) % r.len : clamp(s, 0, r.len);
  let lo = 1, hi = r.cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (r.cum[m] < s) lo = m + 1; else hi = m; }
  const a = r.pts[lo - 1], b = r.pts[lo], L = (r.cum[lo] - r.cum[lo - 1]) || 1, t = (s - r.cum[lo - 1]) / L;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L };
}
function buildGraph(roads) {
  const nodes = [];
  const nodeAt = (x, z) => { for (const n of nodes) if (Math.abs(n.x - x) < 1.5 && Math.abs(n.z - z) < 1.5) return n; const n = { id: nodes.length, x, z, roads: new Set(), edges: [] }; nodes.push(n); return n; };
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
    const A = roads[i], B = roads[j];
    for (let a = 1; a < A.pts.length; a++) for (let b = 1; b < B.pts.length; b++) {
      const p = A.pts[a - 1], q = A.pts[a], r = B.pts[b - 1], s = B.pts[b];
      const rx = q[0] - p[0], rz = q[1] - p[1], sx = s[0] - r[0], sz = s[1] - r[1], den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = r[0] - p[0], qz = r[1] - p[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
      if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
      const x = p[0] + rx * t, z = p[1] + rz * t;
      const sa = A.cum[a - 1] + t * (A.cum[a] - A.cum[a - 1]), sb = B.cum[b - 1] + u * (B.cum[b] - B.cum[b - 1]);
      if ((A.hAt && A.hAt(sa) > 1) || (B.hAt && B.hAt(sb) > 1)) continue; // passes overhead: no junction
      const n = nodeAt(x, z);
      if (!A.marks.some((m) => m.node === n)) A.marks.push({ s: sa, node: n });
      if (!B.marks.some((m) => m.node === n)) B.marks.push({ s: sb, node: n });
      n.roads.add(A); n.roads.add(B);
    }
  }
  const edges = [];
  for (const r of roads) {
    r.marks.sort((a, b) => a.s - b.s);
    if (!r.closed) {
      if (!r.marks.length || r.marks[0].s > 0.5) { const p = rPoint(r, 0), n = nodeAt(p.x, p.z); n.roads.add(r); r.marks.unshift({ s: 0, node: n }); }
      if (r.marks[r.marks.length - 1].s < r.len - 0.5) { const p = rPoint(r, r.len), n = nodeAt(p.x, p.z); n.roads.add(r); r.marks.push({ s: r.len, node: n }); }
    }
    const M = r.marks, cnt = r.closed ? M.length : M.length - 1;
    for (let k = 0; k < cnt; k++) {
      const m0 = M[k], m1 = M[(k + 1) % M.length];
      const e = { id: edges.length, road: r, type: r.type, s0: m0.s, s1: k + 1 < M.length ? m1.s : m1.s + r.len, a: m0.node, b: m1.node };
      edges.push(e); e.a.edges.push(e); e.b.edges.push(e);
    }
  }
  // how far each road stops short of a crossing (half the width of the other road)
  for (const e of edges) {
    e.cA = clrAt(e.a, e.road); e.cB = clrAt(e.b, e.road);
    e.xA = e.a.edges.length >= 3 && e.type !== 'highway'; e.xB = e.b.edges.length >= 3 && e.type !== 'highway'; // zebra crossings
    e.lo = e.s0 + e.cA; e.hi = e.s1 - e.cB;
  }
  return { nodes, edges };
}
// the world position of a lane: road centre plus an offset to the right of travel
function lanePose(e, dir, off, s) {
  const p = rPoint(e.road, s), tx = p.tx * dir, tz = p.tz * dir;
  return { x: p.x - tz * off, z: p.z + tx * off, tx, tz };
}

/* ---- props ---- */
function roamPalmGeo() {
  const trunk = [], leaves = [];
  const PH = 6.6, segs = 4; let prev = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, p = new THREE.Vector3(t * t * 0.9, t * PH, 0), len = p.distanceTo(prev);
    const geo = new THREE.CylinderGeometry(0.13 + (1 - t) * 0.06, 0.14 + (1 - t + 1 / segs) * 0.06, len * 1.04, 5, 1, true);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize()));
    const mid = p.clone().add(prev).multiplyScalar(0.5); geo.translate(mid.x, mid.y, mid.z); trunk.push(geo); prev = p;
  }
  for (let k = 0; k < 7; k++) {
    const leaf = new THREE.PlaneGeometry(3.4, 0.9, 3, 1), pos = leaf.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.max(0, pos.getX(i) + 1.7), y = pos.getY(i), t = x / 3.4, w = Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - t * 0.3);
      pos.setXYZ(i, x, -Math.pow(t, 1.7) * 1.7 + 0.35 * t + Math.abs(y) * 0.25, y * w);
    }
    leaf.computeVertexNormals(); leaf.rotateZ(0.3 + (k % 2) * 0.25); leaf.rotateY(k * Math.PI * 2 / 7); leaf.translate(prev.x, prev.y, prev.z);
    leaves.push(leaf);
  }
  return { trunk: mergeGeometries(plainAttrs(trunk)), leaves: mergeGeometries(plainAttrs(leaves)) };
}
function roamTreeGeo() {
  const t = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 5, 1, true); t.translate(0, 1.3, 0);
  const c = new THREE.IcosahedronGeometry(2.1, 0); c.scale(1, 1.15, 1); c.translate(0, 4.0, 0);
  return { trunk: t.toNonIndexed(), crown: c.toNonIndexed() };
}
