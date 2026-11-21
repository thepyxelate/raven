import { SIGN_KIND, BILLBOARDS, signAtlas } from '../world/signs.js';
/* ---- the world ---- */
// Open-world visibility solver, run once a frame.
//  * draw distance = fog distance: a chunk is drawn only while its nearest edge is inside the fog, so nothing pops
//  * LOD by screen-space size: an object of size S at distance d covers S*H / (2*d*tan(fov/2)) pixels, so a tier is
//    drawn out to d = S*H / (2*tan(fov/2)*PIX), with 12 % hysteresis against flicker at the boundary
//  * frame budget controller: a smoothed frame time above 21 ms shrinks the detail scale k, below 14.5 ms grows it;
//    k scales the tier radii and the fog/draw distance together, so a slow machine trades distance for frame rate
//  * dynamic resolution: pixels cost more than triangles here (a frame is only ~230k triangles), so k also scales
//    the render resolution, in 10 % steps and at most once every 2.5 s so the change is not felt as a hitch
function lodUpdate(dt) {
  const L = LOD, cam = camera.position;
  if (!L.lock && dt > 0 && !roam.mapOpen) {
    L.ms += (Math.min(dt, 0.1) * 1000 - L.ms) * 0.06; L.t += dt;
    if (L.t > 0.5) { L.t = 0; const lo = qLevel === 'low' ? 0.45 : 0.55, hi = qPref === 'eco' ? 0.7 : qLevel === 'low' ? 0.8 : qLevel === 'medium' ? 1 : 1.25; const cap = qPref === 'eco' ? 2 : 1; if (L.ms > 21 * cap) L.k *= 0.94; else if (L.ms < 14.5 * cap) L.k *= 1.03; // eco runs at 30 fps on purpose L.k = clamp(L.k, lo, hi);
      const sc = Math.round(clamp(L.k, 0.6, 1) * 10) / 10, now = performance.now();
      if (sc !== L.prs && now - L.prT > 2500) { L.prs = sc; L.prT = now; renderer.setPixelRatio(L.basePR * sc); composer.setPixelRatio(renderer.getPixelRatio()); const cv = renderer.domElement; renderer.setSize(cv.clientWidth, cv.clientHeight, false); composer.setSize(cv.clientWidth, cv.clientHeight); }
    }
  }
  const H = renderer.domElement.height, px = H / (2 * Math.tan(camera.fov * Math.PI / 360) * L.PIX);
  const far = L.far0 * clamp(0.5 + 0.5 * L.k, 0.7, 1);
  L.far = far; world.fog.far = far; L.chunks = 0; L.on[0] = L.on[1] = 0;
  for (let i = 0; i < 2; i++) L.R[i] = clamp(TIER[i] * px * L.k, i ? 200 : 90, far + 150);
  for (const g of world.cmeshes) {
    const dx = Math.max(0, Math.abs(g.userData.cx - cam.x) - CH / 2), dz = Math.max(0, Math.abs(g.userData.cz - cam.z) - CH / 2), d = Math.hypot(dx, dz);
    g.visible = d < far + 8; if (g.visible) L.chunks++;
    const T = g.userData.tiers; if (T) for (let i = 0; i < 2; i++) { const f = T[i]; if (!f) continue; f.visible = d < (f.visible ? L.R[i] * 1.12 : L.R[i]); if (g.visible && f.visible) L.on[i]++; }
  }
}
function buildWorld() {
  seed = 4242;
  const TT = [performance.now()], mark = () => TT.push(performance.now());
  const { roads, XL, ZB } = roadLayout();
  const { nodes, edges } = buildGraph(roads);
  const districtOf = (x, z) => (x > 400 ? 'harbor' : Math.abs(x) <= 400 && z > -400 && z < 300 ? 'downtown' : z >= 300 ? 'shore' : z < -400 ? 'north' : 'west');
  // which strip of the road atlas an edge is paved with
  const surfOf = (e) => {
    const r = e.road; if (r.type === 'highway') return 2;
    const p = rPoint(r, (e.lo + e.hi) / 2), d = districtOf(p.x, p.z);
    if (r.type === 'avenue') return !r.isBridge && !r.isle && Math.abs(p.z - 300) < 1 ? 8 : 1;
    return d === 'west' ? 5 : d === 'harbor' ? 6 : d === 'north' ? 7 : d === 'shore' ? 9 : 0;
  };
  const chunks = new Map();
  const chunkOf = (x, z) => {
    const cx = clamp(Math.floor((x + 1000) / CH), 0, NCH - 1), cz = clamp(Math.floor((z + 1000) / CH), 0, 10), k = cx * 16 + cz;
    if (!chunks.has(k)) { const city = new GeoBuf(); city.tiers = [new GeoBuf(), new GeoBuf()]; chunks.set(k, { city, road: new GeoBuf(), x: (cx + 0.5) * CH - 1000, z: (cz + 0.5) * CH - 1000 }); }
    return chunks.get(k);
  };
  // collision shapes in a 32 m hash
  const HC = 32, hash = new Map();
  const addShape = (s) => {
    const P = 1.6, x0 = (s.t ? s.x - s.r : s.x0) - P, x1 = (s.t ? s.x + s.r : s.x1) + P, z0 = (s.t ? s.z - s.r : s.z0) - P, z1 = (s.t ? s.z + s.r : s.z1) + P;
    for (let i = Math.floor(x0 / HC); i <= Math.floor(x1 / HC); i++) for (let j = Math.floor(z0 / HC); j <= Math.floor(z1 / HC); j++) {
      const k = i * 4096 + j; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(s);
    }
  };
  const rect = (x0, z0, x1, z1) => addShape({ t: 0, x0, z0, x1, z1 });
  const circ = (x, z, r) => addShape({ t: 1, x, z, r });
  const W0 = [0, 0, 0, 0], Z4 = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const NEON = ['#ff3da8', '#2ee6d6', '#ffb547', '#9b5cff', '#3bff8a', '#ff5a3d', '#5fb8ff'].map(lin);
  const glowW = (c, a = 1) => [c[0], c[1], c[2], a];
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const mm = []; // minimap drawing list

  const C_DECK = lin('#2a2a33'), C_RAIL = lin('#3b3b46'), C_RLIGHT = lin('#7fc8ff'), C_SKYL = lin('#ff5fd2');
  const signs = []; // textured billboards, drawn as one mesh at the end
  // the underside, sides and concrete rails of an elevated road piece
  const deckPiece = (ch, L0, R0, L1, R1, nx, nz, lights) => {
    const dn = (p) => [p[0], p[1] - 1.2, p[2]], inn = (p, sg, d) => [p[0] + nx * sg * d, p[1], p[2] + nz * sg * d], up = (p, d) => [p[0], p[1] + d, p[2]];
    ch.quad(dn(L0), dn(R0), dn(R1), dn(L1), C_DECK, Z4, W0, [0, -1, 0]);
    ch.quad(L0, L1, dn(L1), dn(L0), C_DECK, Z4, W0, [-nx, 0, -nz]);
    ch.quad(R0, R1, dn(R1), dn(R0), C_DECK, Z4, W0, [nx, 0, nz]);
    for (const [A, B, sg] of [[L0, L1, 1], [R0, R1, -1]]) {
      const A2 = inn(A, sg, 0.35), B2 = inn(B, sg, 0.35);
      ch.quad(A2, B2, up(B2, 0.95), up(A2, 0.95), C_RAIL, Z4, W0, [nx * sg, 0, nz * sg]);
      ch.quad(up(A, 0.95), up(B, 0.95), up(B2, 0.95), up(A2, 0.95), lights || C_RAIL, Z4, lights ? [lights[0] * 0.6, lights[1] * 0.6, lights[2] * 0.6, 1] : W0, [0, 1, 0]);
      if (lights === C_SKYL) { const o = (p) => [p[0] - nx * sg * 0.03, p[1], p[2] - nz * sg * 0.03]; ch.quad(o(up(A, -0.55)), o(up(B, -0.55)), o(up(B, -0.3)), o(up(A, -0.3)), C_SKYL, Z4, [C_SKYL[0], C_SKYL[1], C_SKYL[2], 1], [-nx * sg, 0, -nz * sg]); }
      ch.quad(A, B, up(B, 0.95), up(A, 0.95), C_RAIL, Z4, W0, [-nx * sg, 0, -nz * sg]);
    }
  };
  // --- roads ---
  for (const e of edges) {
    const r = e.road, row = surfOf(e), w = r.w;
    const sA = e.lo + (e.xA ? 4 : 0), sB = e.hi - (e.xB ? 4 : 0);
    const strip = (a, b, rw, u0) => {
      // sample at polyline corners and at least every 40 m so pieces land in the right chunk
      const ss = [a];
      for (let s = a; s < b - 0.01;) {
        let nx = Math.min(b, s + (r.hAt ? 8 : 40));
        for (let k = 0; k < r.cum.length; k++) for (const off of r.closed ? [0, r.len] : [0]) { const c = r.cum[k] + off; if (c > s + 0.05 && c < nx) nx = c; }
        ss.push(nx); s = nx;
      }
      for (let k = 1; k < ss.length; k++) {
        const p0 = rPoint(r, ss[k - 1]), p1 = rPoint(r, ss[k]);
        // use the segment direction at the midpoint so corners stay closed
        const pm = rPoint(r, (ss[k - 1] + ss[k]) / 2), nx0 = -pm.tz, nz0 = pm.tx;
        const y0 = r.hAt ? r.hAt(ss[k - 1]) : 0, y1 = r.hAt ? r.hAt(ss[k]) : 0;
        const h = w / 2, L0 = [p0.x - nx0 * h, y0 + 0.06, p0.z - nz0 * h], R0 = [p0.x + nx0 * h, y0 + 0.06, p0.z + nz0 * h], L1 = [p1.x - nx0 * h, y1 + 0.06, p1.z - nz0 * h], R1 = [p1.x + nx0 * h, y1 + 0.06, p1.z + nz0 * h];
        if (Math.max(y0, y1) > 0.05) deckPiece(chunkOf(pm.x, pm.z).city, L0, R0, L1, R1, nx0, nz0, r.isBridge ? C_RLIGHT : r.sky ? C_SKYL : null);
        const u0v = u0 === undefined ? ss[k - 1] / 16 : u0, u1v = u0 === undefined ? ss[k] / 16 : u0 + (ss[k] - ss[k - 1]) / 16;
        chunkOf(pm.x, pm.z).road.quad(L0, L1, R1, R0, W0, [[u0v, rowV(rw, 0)], [u1v, rowV(rw, 0)], [u1v, rowV(rw, 1)], [u0v, rowV(rw, 1)]], W0, [0, 1, 0]);
      }
    };
    if (sB > sA) strip(sA, sB, row);
    if (e.xA) strip(e.lo, e.lo + 4, 4, 0);
    if (e.xB) strip(e.hi - 4, e.hi, 4, 0);
  }
  // intersection squares
  for (const n of nodes) {
    const rs = [...n.roads]; if (rs.length < 2) continue;
    const [A, B] = rs, mA = A.marks.find((m) => m.node === n), mB = B.marks.find((m) => m.node === n);
    const ta = rPoint(A, mA.s), tb = rPoint(B, mB.s), ha = clrAt(n, A), hb = clrAt(n, B);
    const P = (sa, sb) => [n.x + ta.tx * ha * sa + tb.tx * hb * sb, 0.06, n.z + ta.tz * ha * sa + tb.tz * hb * sb];
    const c = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], u1 = Math.max(ha, hb) / 8;
    chunkOf(n.x, n.z).road.quad(c[0], c[1], c[2], c[3], W0, [[0, rowV(3, 0.05)], [u1, rowV(3, 0.05)], [u1, rowV(3, 0.95)], [0, rowV(3, 0.95)]], W0, [0, 1, 0]);
  }
  for (const r of roads) mm.push({ k: 'road', pts: r.pts, w: r.w, type: r.type, closed: r.closed, sky: !!r.sky });

  const SKY = roads.find((r) => r.sky), skyS = [];
  let sbx0 = Infinity, sbz0 = Infinity, sbx1 = -Infinity, sbz1 = -Infinity;
  for (let s = 0; s <= SKY.len; s += 4) { const p = rPoint(SKY, s); skyS.push(p.x, p.z); sbx0 = Math.min(sbx0, p.x); sbx1 = Math.max(sbx1, p.x); sbz0 = Math.min(sbz0, p.z); sbz1 = Math.max(sbz1, p.z); }
  const nearSky = (x0, z0, x1, z1, pad) => {
    if (x1 < sbx0 - pad || x0 > sbx1 + pad || z1 < sbz0 - pad || z0 > sbz1 + pad) return false;
    for (let i = 0; i < skyS.length; i += 2) { const x = skyS[i], z = skyS[i + 1]; if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return true; }
    return false;
  };
  const nearRoad = (x, z, pad, skip) => roads.some((r) => { if (r === skip) return false; for (let k = 1; k < r.pts.length; k++) { const a = r.pts[k - 1], b = r.pts[k], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r.w / 2 + pad) return true; } return false; });
  mark();
  // --- street furniture along every edge: lamps, palms, trees ---
  const PG = roamPalmGeo(), TG = roamTreeGeo(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const C_TRUNK = lin('#6a5446'), C_LEAF = lin('#3f7046'), C_POLE = lin('#24232b'), C_LAMP = lin('#ffcf8a');
  const pools = [];
  const place = (g, x, z, ry, sc, col, y = 0) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); M4.compose(V.set(x, y, z), Q, S.set(sc, sc, sc)); chunkOf(x, z).city.geo(g, M4, col, W0); };
  // knockable props (trees, palms, traffic-light poles): remember which vertices and indices each one wrote into its
  // chunk (base mesh or a LOD tier), so a hit can hide exactly those and drop a copy of them (see knockDown)
  const props = [];
  const knockable = (x, z, y, r, build, extra) => {
    const ch = chunkOf(x, z), bufs = [ch.city, ch.city.tiers[0], ch.city.tiers[1]], before = bufs.map((b) => [b.v, b.i.length]);
    build();
    const ranges = [];
    bufs.forEach((b, k) => { if (b.v > before[k][0]) ranges.push([k, before[k][0], b.v, before[k][1], b.i.length]); });
    const p = { x, z, y, ch, ranges, down: false, ...extra }, sh = { t: 1, x, z, r, prop: p };
    props.push(p); addShape(sh);
  };
  const palm = (x, z, y = 0) => { if (y < 0.3 && nearSky(x, z, x, z, 13)) return; const ry = rnd() * 6.28, sc = 0.85 + rnd() * 0.35, lc = [C_LEAF[0] * (0.8 + rnd() * 0.4), C_LEAF[1], C_LEAF[2]]; knockable(x, z, y, 0.35, () => { place(PG.trunk, x, z, ry, sc, C_TRUNK, y); place(PG.leaves, x, z, ry, sc, lc, y); }); };
  const tree = (x, z, y = 0) => { if (y < 0.3 && nearSky(x, z, x, z, 13)) return; const ry = rnd() * 6.28, sc = 0.8 + rnd() * 0.5, cc = [0.07 + rnd() * 0.05, 0.17 + rnd() * 0.1, 0.07]; knockable(x, z, y, 0.4, () => { place(TG.trunk, x, z, ry, sc, C_TRUNK, y); place(TG.crown, x, z, ry, sc, cc, y); }); };
  const lamp = (x, z, nx, nz, H, reach, y0 = 0) => {
    if (y0 < 0.3 && nearSky(x, z, x, z, 13)) return;
    // pole on the sidewalk (or the deck rail), arm reaching over the road, a glowing head, a pool of light below
    const ch = chunkOf(x, z).city, ang = Math.atan2(nz, nx);
    ch.box(x - 0.09, z - 0.09, x + 0.09, z + 0.09, y0, y0 + H, C_POLE, W0, C_POLE, 0, 0, false);
    ch.obox(x + nx * reach / 2, z + nz * reach / 2, ang, reach / 2, 0.06, y0 + H - 0.12, y0 + H, C_POLE, W0);
    ch.obox(x + nx * reach, z + nz * reach, ang, 0.55, 0.2, y0 + H - 0.22, y0 + H - 0.05, C_LAMP, glowW(C_LAMP));
    pools.push([x + nx * reach, z + nz * reach, H, y0]); if (y0 < 0.3) circ(x, z, 0.25);
  };
  const coastal = (x, z) => z > 600;
  for (const e of edges) {
    const r = e.road, w = r.w, span = e.hi - e.lo; if (span < 14) continue;
    const step = r.type === 'highway' ? 46 : r.type === 'avenue' ? 30 : 36;
    let k = 0;
    for (let s = e.lo + 8; s < e.hi - 8; s += step, k++) {
      const p = rPoint(r, s), nx = -p.tz, nz = p.tx;
      const side = r.type === 'street' ? (k % 2 ? 1 : -1) : 0;
      for (const sd of side ? [side] : [1, -1]) {
        const off = sd > 0 ? 0 : step / 2; const q = off ? rPoint(r, s + off) : p; if (s + off > e.hi - 8) continue;
        if (inTunnel(q.x, q.z)) continue;
        const y0 = r.hAt ? r.hAt(s + off) : 0, edge = y0 > 0.3 ? w / 2 - 0.2 : w / 2 + 1.1;
        const qx = q.x + nx * sd * edge, qz = q.z + nz * sd * edge;
        lamp(qx, qz, -nx * sd, -nz * sd, r.type === 'highway' ? 9 : 7.4, r.type === 'street' ? 2.2 : 3.2, y0);
      }
    }
    // greenery: palms on avenues, the boulevard and the shore, trees on residential streets
    const pz = rPoint(r, (e.lo + e.hi) / 2), mid = { x: pz.x, z: pz.z };
    const downtown = Math.abs(mid.x) < 400 && mid.z > -400 && mid.z < 300;
    const isPalm = r.type !== 'street' || coastal(mid.x, mid.z) || mid.z > 300;
    const gap = r.type === 'highway' ? (coastal(mid.x, mid.z) ? 14 : 0) : r.type === 'avenue' ? 30 : downtown ? 0 : 26;
    if (gap) for (let s = e.lo + 12 + gap / 2; s < e.hi - 10; s += gap) {
      const p = rPoint(r, s), nx = -p.tz, nz = p.tx;
      for (const sd of [1, -1]) {
        if (r.hAt && r.hAt(s) > 0.3) continue;
        const x = p.x + nx * sd * (w / 2 + 2.6), z = p.z + nz * sd * (w / 2 + 2.6);
        if (isPalm) palm(x, z); else tree(x, z);
      }
    }
    // bus shelters on the avenues: a glass back wall, a bench, a lit advert
    if (r.type === 'avenue' && !r.hAt && !r.isle && span > 70 && rnd() < 0.55) {
      const p = rPoint(r, e.lo + 42), sd = rnd() < 0.5 ? 1 : -1, nx = -p.tz * sd, nz = p.tx * sd, x = p.x + nx * (w / 2 + 3.2), z = p.z + nz * (w / 2 + 3.2), ang = Math.atan2(p.tz, p.tx), nc = pick(NEON);
      if (!nearSky(x, z, x, z, 13)) {
        const ch = chunkOf(x, z).city;
        ch.obox(x, z, ang, 2.3, 0.85, 2.5, 2.64, C_POLE, W0);
        ch.obox(x + nx * 0.8, z + nz * 0.8, ang, 2.3, 0.04, 0.2, 2.5, lin('#3a4a5a'), [0.05, 0.08, 0.1, 1]);
        ch.obox(x + p.tx * 2.25, z + p.tz * 2.25, ang, 0.05, 0.8, 0.5, 2.3, nc, glowW(nc));
        ch.obox(x + nx * 0.45, z + nz * 0.45, ang, 1.3, 0.22, 0.2, 0.62, C_TRUNK, W0);
        circ(x - p.tx * 1.4, z - p.tz * 1.4, 0.8); circ(x + p.tx * 1.4, z + p.tz * 1.4, 0.8);
      }
    }
  }

  // --- traffic lights at street-grid crossings: a pole on the far right of every approach ---
  const sigHeads = [], C_SIG = lin('#111116');
  for (const n of nodes) {
    const rs = [...n.roads];
    if (n.edges.length < 3 || rs.length !== 2 || rs.some((r) => r.closed || r.type === 'highway' || r.isBridge)) continue;
    n.sig = { off: rnd() * 22 };
    const [A, B] = rs, ta = rPoint(A, A.marks.find((m) => m.node === n).s), tb = rPoint(B, B.marks.find((m) => m.node === n).s);
    for (const [road, t, other] of [[A, ta, B], [B, tb, A]]) for (const sg of [1, -1]) {
      const dx = t.tx * sg, dz = t.tz * sg, rx = -dz, rz = dx;
      const x = n.x + dx * (other.w / 2 + 2.4) + rx * (road.w / 2 + 1.7), z = n.z + dz * (other.w / 2 + 2.4) + rz * (road.w / 2 + 1.7);
      const ch = chunkOf(x, z).city;
      knockable(x, z, 0, 0.2, () => {
        ch.box(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 0, 4.4, C_POLE, W0, C_POLE, 0, 0, false);
        ch.box(x - 0.24, z - 0.24, x + 0.24, z + 0.24, 4.4, 5.7, C_SIG, W0, C_SIG);
      }, { sig: sigHeads.length });
      sigHeads.push({ n, axis: road.axis, x: x - dx * 0.3, z: z - dz * 0.3 });
    }
  }
  mark();
  // --- blocks: sidewalk slabs and a different building on every lot ---
  // Each lot picks a building type by district (towers, shop rows, restaurants and cafes with terraces,
  // houses, apartments, hotels, fuel stations, car parks, cinemas, columned halls, warehouses, tank farms,
  // plazas), and each type randomises its own size, colours, roof and signs.
  const C_SLAB = lin('#8a8684'), C_GRASS = lin('#465f38'), C_LAWN = lin('#52723f'), C_ROOF = lin('#55555c'), C_LOT = lin('#5e5d62'), C_PATH = lin('#3a3832'), C_STONE = lin('#8a8478'), C_WOOD = lin('#3a2a1e'), C_DARK = lin('#0c0d12'), C_WHITE = lin('#d8d8dc'), C_PALE = lin('#8a8a94'), C_WATER = lin('#0c2c48');
  const SLAB_TOP = { downtown: C_SLAB, west: lin('#33292a'), north: lin('#22252b'), shore: lin('#3b352e'), harbor: C_LOT };
  const FACADE = {
    downtown: ['#3a68a8', '#5a44a0', '#2c8a90', '#8a3a78', '#3a5a90', '#2e7a9a', '#22344e', '#4a4e62', '#1f5a66'],
    west: ['#b0603c', '#7a4aa0', '#3a8098', '#a08a40', '#943a5e', '#5a8a5a', '#a04a32', '#c09060', '#6a4a3a', '#2e6a6a'],
    north: ['#5a78a0', '#7a5a9a', '#4a8a68', '#9a5a5a', '#8a8a5a', '#b8a888', '#8a6a5a', '#6a7a8a'],
    shore: ['#c0784e', '#3a9a9a', '#b04a80', '#6a90b0', '#a09a50', '#8a5ab0', '#d8c8a8', '#e0a070', '#58a888'],
    harbor: ['#5a6070', '#806048', '#4a6a80', '#707070', '#3a5a50', '#8a4a3a']
  };
  const C_UNIT = lin('#3a3c46'), C_UNIT2 = lin('#4a4d58'), SHOPGLOW = lin('#ffd9a8');
  const GLOWS = [SHOPGLOW, SHOPGLOW, lin('#fff0d0'), lin('#cfe8ff'), lin('#ffc0e0')];
  const AWN = ['#d83a3a', '#2e9a6a', '#e0a030', '#3a6ad8', '#d84a9a', '#e8e0d0', '#7a3ad8'].map(lin);
  const EAT_COL = ['#8a3a2a', '#c8a070', '#2a5a5a', '#3a2a4a', '#a85a3a', '#1f3a2a', '#d0c0a0', '#7a2a3a', '#2a3a5a'].map(lin);
  const HOUSE_COL = ['#8f8a7e', '#86795f', '#6f7c8a', '#8a4e3a', '#667866', '#948c84', '#876e68', '#5c6878'].map(lin);
  const ROOF_COL = ['#7a3a2a', '#3a3f4a', '#5a2a2a', '#2f3a34', '#4a3a30'].map(lin);
  const CARCOL = ['#4a4f57', '#9aa3ad', '#e9e9ec', '#1f5fd6', '#7a1f2b', '#2e3b2a', '#c9a227', '#121316', '#5a3a7a', '#3a6a8a'].map(lin);
  const TINTS = { warm: lin('#ffb35c'), soft: lin('#ffd9a0'), cool: lin('#9fd8ff'), white: lin('#dfe8ff'), pink: lin('#ff9ad0') };
  const CONT = ['#7a2a1f', '#1f4a7a', '#2a6a3a', '#a8641f', '#5a5f66', '#7a1f4a', '#2f6f73'].map(lin);
  const WSCALE = [[1, 1], [1, 1], [0.5, 1], [1.7, 1.2], [0.75, 0.8], [2.4, 1], [1.3, 1.4]]; // window width / floor height variants
  const SI = (name) => Math.max(0, SHOP_SIGNS.indexOf(name));
  const POOL = {
    eat: ['RESTAURANT', 'BISTRO', 'STEAK HOUSE', 'TRATTORIA', 'SUSHI BAR', 'RAMEN', 'NOODLES', 'BAR & GRILL', 'SEAFOOD', 'PLOV HOUSE', 'KEBAB', 'BBQ', 'PIZZA', 'TACOS', 'BURGERS', 'DINER'],
    cafe: ['CAFE', 'COFFEE', 'TEA HOUSE', 'CHOYXONA', 'BAKERY', 'DONUTS', 'ICE CREAM', 'SAMSA'],
    shop: ['BOOKS', 'RECORDS', 'FLOWERS', 'PHARMACY', 'MARKET', 'FASHION', 'ELECTRONICS', 'BARBER', 'LAUNDRY', 'TATTOO', 'VIDEO', 'SURF SHOP', 'SUPERMARKET', 'GYM', 'ARCADE', 'KARAOKE', 'PARTS', 'TIRES', 'BODY SHOP', 'PERFORMANCE SHOP', 'TUNER HAVEN', 'BANK'],
    night: ['CLUB', 'JAZZ CLUB', 'ROOFTOP BAR', 'NEON NIGHTS', 'BOWLING', 'KARAOKE', 'ARCADE'],
    hall: ['MUSEUM', 'GALLERY', 'LIBRARY', 'BANK', 'THEATER']
  };
  const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k, 1];
  const mkStyle = (d, lit, tint) => { const ws = pick(WSCALE); return { col: lin(pick(FACADE[d])), tint: tint || (d === 'harbor' ? TINTS.white : pick(rnd() < 0.7 ? [TINTS.warm, TINTS.soft] : [TINTS.cool, TINTS.white, TINTS.pink])), lit, uo: rnd(), vo: rnd(), su: ws[0], sv: ws[1] }; };
  const bx = (ch, r, y0, y1, st, roof = C_ROOF, k = 0) => ch.box(r[0], r[1], r[2], r[3], y0, y1, st.col, glowW(st.tint, st.lit), roof, st.uo + k * 0.37, st.vo, true, st.su, st.sv);
  const bp = (ch, r, y0, y1, col, win = W0, roof = col, top = true) => ch.box(r[0], r[1], r[2], r[3], y0, y1, col, win, roof, 0, 0, top);
  const solid = (r) => { rect(r[0], r[1], r[2], r[3]); mm.push({ k: 'bld', x0: r[0], z0: r[1], x1: r[2], z1: r[3] }); };
  // a face is [axis, wall coordinate, outward sign, from, to]; these place things along a wall and out from it
  const pt = (f, a, o) => (f[0] === 'z' ? [a, f[1] + f[2] * o] : [f[1] + f[2] * o, a]);
  const fr = (f, a0, a1, o0, o1) => { const p = pt(f, a0, o0), q = pt(f, a1, o1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; };
  const faceOf = (r, f) => (f[0] === 'z' ? ['z', f[2] < 0 ? r[1] : r[3], f[2], r[0], r[2]] : ['x', f[2] < 0 ? r[0] : r[2], f[2], r[1], r[3]]);
  const depthOf = (r, f) => (f[0] === 'z' ? r[3] - r[1] : r[2] - r[0]);
  const cut = (r, f, d) => { const t = r.slice(); if (f[0] === 'z') { if (f[2] < 0) { t[3] = r[1] + d; r[1] += d; } else { t[1] = r[3] - d; r[3] -= d; } } else if (f[2] < 0) { t[2] = r[0] + d; r[0] += d; } else { t[0] = r[2] - d; r[2] -= d; } return t; };
  const panel = (ch, f, a0, a1, y0, y1, col, win, off = 0.06, store = false) => {
    const o = f[1] + f[2] * off, L = Math.abs(a1 - a0), H = y1 - y0, U = store ? [[0, 0], [L, 0], [L, H], [0, H]] : Z4;
    if (f[0] === 'z') ch.quad([a0, y0, o], [a1, y0, o], [a1, y1, o], [a0, y1, o], col, U, win, [0, 0, f[2]]);
    else ch.quad([o, y0, a0], [o, y0, a1], [o, y1, a1], [o, y1, a0], col, U, win, [f[2], 0, 0]);
  };
  const awning = (ch, f, a0, a1, y, dp, col) => {
    const o = f[1] + f[2] * dp, w = dim(col, 0.2);
    if (f[0] === 'z') ch.quad([a0, y, f[1]], [a1, y, f[1]], [a1, y - 0.55, o], [a0, y - 0.55, o], col, Z4, w, [0, 1, f[2]]);
    else ch.quad([f[1], y, a0], [f[1], y, a1], [o, y - 0.55, a1], [o, y - 0.55, a0], col, Z4, w, [f[2], 1, 0]);
  };
  // text reads left to right for someone standing in front of the wall
  const signOn = (f, mid, half, y0, y1, shop, off = 0.32) => { const so = f[1] + f[2] * off; signs.push(f[0] === 'z' ? { x: mid, z: so, tx: f[2], tz: 0, half, y0, y1, shop } : { x: so, z: mid, tx: 0, tz: -f[2], half, y0, y1, shop }); };
  const prism = (ch, cx, cz, r0, n, y0, y1, col, win = W0, roof = col, r1 = r0, roofWin = W0, st = null) => {
    const P = (k, rr) => { const a = (k + 0.5) / n * Math.PI * 2; return [cx + rr * Math.cos(a), cz + rr * Math.sin(a)]; };
    const sl = 2 * r0 * Math.sin(Math.PI / n), su = st ? st.su : 1, sv = st ? st.sv : 1, uo = st ? st.uo : 0, vo = st ? st.vo : 0;
    for (let k = 0; k < n; k++) {
      const a = P(k, r0), b = P(k + 1, r0), a1 = P(k, r1), b1 = P(k + 1, r1), u0 = uo + k * sl / 48 * su, u1 = u0 + sl / 48 * su, v1 = vo + (y1 - y0) / 56 * sv;
      ch.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], col, [[u0, vo], [u1, vo], [u1, v1], [u0, v1]], win, [(a[0] + b[0]) / 2 - cx, r1 < r0 ? r0 * 0.6 : 0, (a[1] + b[1]) / 2 - cz]);
      if (r1 > 0.01) ch.quad([cx, y1, cz], [a1[0], y1, a1[1]], [b1[0], y1, b1[1]], [b1[0], y1, b1[1]], roof, Z4, roofWin, [0, 1, 0]);
    }
  };
  const gable = (ch, r, y, h, col, alongX, wall = col, wallWin = W0) => {
    const [x0, z0, x1, z1] = r, o = 0.4;
    if (alongX) {
      const zm = (z0 + z1) / 2;
      ch.quad([x0 - o, y, z0 - o], [x1 + o, y, z0 - o], [x1 + o, y + h, zm], [x0 - o, y + h, zm], col, Z4, W0, [0, 1, -1]);
      ch.quad([x0 - o, y, z1 + o], [x1 + o, y, z1 + o], [x1 + o, y + h, zm], [x0 - o, y + h, zm], col, Z4, W0, [0, 1, 1]);
      for (const [x, s] of [[x0, -1], [x1, 1]]) ch.quad([x, y, z0], [x, y, z1], [x, y + h, zm], [x, y + h, zm], wall, Z4, wallWin, [s, 0, 0]);
    } else {
      const xm = (x0 + x1) / 2;
      ch.quad([x0 - o, y, z0 - o], [x0 - o, y, z1 + o], [xm, y + h, z1 + o], [xm, y + h, z0 - o], col, Z4, W0, [-1, 1, 0]);
      ch.quad([x1 + o, y, z0 - o], [x1 + o, y, z1 + o], [xm, y + h, z1 + o], [xm, y + h, z0 - o], col, Z4, W0, [1, 1, 0]);
      for (const [z, s] of [[z0, -1], [z1, 1]]) ch.quad([x0, y, z], [x1, y, z], [xm, y + h, z], [xm, y + h, z], wall, Z4, wallWin, [0, 0, s]);
    }
  };
  // thin glowing posts on the corners and a rim along the roofline
  const neonEdges = (ch, x0, z0, x1, z1, y0, y1, nc) => {
    const e = 0.18, W = glowW(nc);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) ch.box(x - e, z - e, x + e, z + e, y0, y1, nc, W, nc, 0, 0, false);
    ch.box(x0 - e, z0 - e, x1 + e, z0 + e, y1 - 0.3, y1, nc, W, nc); ch.box(x0 - e, z1 - e, x1 + e, z1 + e, y1 - 0.3, y1, nc, W, nc);
    ch.box(x0 - e, z0 - e, x0 + e, z1 + e, y1 - 0.3, y1, nc, W, nc); ch.box(x1 - e, z0 - e, x1 + e, z1 + e, y1 - 0.3, y1, nc, W, nc);
  };
  const roofRim = (ch, r, y, nc) => neonEdges(ch, r[0], r[1], r[2], r[3], y - 0.01, y, nc);
  // a parked car: body, glass, a pair of tail lights
  const parked = (ch, x, z, alongX, flip) => {
    const c = pick(CARCOL), s = flip ? -1 : 1, R = (a0, a1, hw) => (alongX ? [x + Math.min(a0 * s, a1 * s), z - hw, x + Math.max(a0 * s, a1 * s), z + hw] : [x - hw, z + Math.min(a0 * s, a1 * s), x + hw, z + Math.max(a0 * s, a1 * s)]);
    bp(ch, R(-1.95, 1.95, 0.72), 0.16, 0.45, C_DARK); bp(ch, R(-2.1, 2.1, 0.88), 0.42, 0.95, c); bp(ch, R(-1.45, 0.65, 0.76), 0.95, 1.42, C_DARK, dim(TINTS.cool, 0.04));
    bp(ch, R(-2.14, -2.08, 0.8), 0.68, 0.84, RED0, dim(RED0, 0.5));
    const b = R(-2.1, 2.1, 0.88); rect(b[0], b[1], b[2], b[3]);
  };
  const RED0 = lin('#ff2030');
  // rows of bays with some cars in them
  const carPark = (ch, r, fill = 0.4) => {
    const C = lin('#9a9aa6'), W = dim(C, 0.15), alongX = r[2] - r[0] >= r[3] - r[1], len = alongX ? r[2] - r[0] : r[3] - r[1], wid = alongX ? r[3] - r[1] : r[2] - r[0];
    for (let row = 0; row * 11.5 + 5.4 <= wid; row++) for (let a = 1.5; a + 2.8 <= len - 1; a += 2.8) {
      const v = (alongX ? r[1] : r[0]) + row * 11.5, u = (alongX ? r[0] : r[1]) + a;
      if (alongX) ch.quad([u, 0.2, v + 0.3], [u + 0.12, 0.2, v + 0.3], [u + 0.12, 0.2, v + 5.2], [u, 0.2, v + 5.2], C, Z4, W, [0, 1, 0]);
      else ch.quad([v + 0.3, 0.2, u], [v + 0.3, 0.2, u + 0.12], [v + 5.2, 0.2, u + 0.12], [v + 5.2, 0.2, u], C, Z4, W, [0, 1, 0]);
      if (rnd() < fill) { if (alongX) parked(ch, u + 1.4, v + 2.8, false, rnd() < 0.5); else parked(ch, v + 2.8, u + 1.4, true, rnd() < 0.5); }
    }
  };
  // a round table under an umbrella
  const table = (ch, x, z, col) => {
    bp(ch, [x - 0.45, z - 0.45, x + 0.45, z + 0.45], 0.72, 0.8, C_WOOD); bp(ch, [x - 0.05, z - 0.05, x + 0.05, z + 0.05], 0.2, 2.35, C_POLE, W0, C_POLE, false);
    prism(ch, x, z, 1.3, 6, 2.2, 2.85, col, dim(col, 0.16), col, 0); circ(x, z, 0.55);
  };
  // a line of small bulbs between two points
  const bulbs = (ch, x0, z0, x1, z1, y, c = C_LAMP) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4)); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n, yy = y - 0.35 * Math.sin(k / n * Math.PI); ch.box(x - 0.07, z - 0.07, x + 0.07, z + 0.07, yy, yy + 0.14, c, glowW(c), c); } };
  const planter = (ch, x, z, w, l) => { bp(ch, [x - w / 2, z - l / 2, x + w / 2, z + l / 2], 0.16, 0.75, C_UNIT, W0, lin('#1c4a2a')); rect(x - w / 2, z - l / 2, x + w / 2, z + l / 2); };
  const globe = (ch, x, z, h = 3.2) => { ch.box(x - 0.06, z - 0.06, x + 0.06, z + 0.06, 0.16, h, C_POLE, W0, C_POLE, 0, 0, false); ch.box(x - 0.22, z - 0.22, x + 0.22, z + 0.22, h, h + 0.44, C_LAMP, glowW(C_LAMP), C_LAMP); pools.push([x, z, h, 0]); circ(x, z, 0.2); };
  const fountain = (ch, x, z, r) => {
    prism(ch, x, z, r, 12, 0.16, 0.85, C_STONE, W0, C_STONE, r); prism(ch, x, z, r - 0.4, 12, 0.6, 0.7, C_WATER, dim(lin('#3aa8ff'), 0.5), C_WATER, r - 0.4, dim(lin('#3aa8ff'), 0.5));
    prism(ch, x, z, 0.5, 8, 0.7, 1.9, C_STONE); prism(ch, x, z, 0.16, 6, 1.9, 3.6, lin('#bfe6ff'), dim(lin('#bfe6ff'), 0.6), lin('#bfe6ff'), 0.05); circ(x, z, r + 0.1);
  };
  // lit window band, awning and a sign on one street wall
  const shopfront = (ch, f, pool, y1 = 3.2, aw = 0.6) => {
    const f0 = f[3], f1 = f[4], m0 = f0 + (f1 - f0) * 0.08, m1 = f1 - (f1 - f0) * 0.08, g = pick(GLOWS);
    panel(ch, f, m0, m1, 0.5, y1, g, [g[0] * 0.3, g[1] * 0.3, g[2] * 0.3, 0.97], 0.06, true);
    if (rnd() < aw) awning(ch, f, m0, m1, y1 + 0.55, 1.2 + rnd() * 0.7, pick(AWN));
    if (f1 - f0 > 6 && pool) signOn(f, (f0 + f1) / 2 + (rnd() - 0.5) * Math.max(0, f1 - f0 - 8) * 0.5, Math.min(3, (f1 - f0) / 2 - 0.5), y1 + 0.75, y1 + 2.2, SI(pick(pool)));
  };
  const roofUnits = (ch, r, y, n) => { for (let k = 0; k < n; k++) { const w = 1.4 + rnd() * 2.2, l = 1.4 + rnd() * 2.8, ux = r[0] + 1 + rnd() * Math.max(0.1, r[2] - r[0] - w - 2), uz = r[1] + 1 + rnd() * Math.max(0.1, r[3] - r[1] - l - 2); ch.box(ux, uz, ux + w, uz + l, y, y + 0.9 + rnd() * 1.2, rnd() < 0.5 ? C_UNIT : C_UNIT2, W0, rnd() < 0.5 ? C_UNIT : C_UNIT2); } };

  /* ---- building types ---- */
  const tower = (ch, r, faces, d, hgt) => {
    const st = mkStyle(d, d === 'downtown' ? 0.35 + rnd() * 0.3 : d === 'harbor' ? 0.06 : 0.22 + rnd() * 0.25), w = Math.min(r[2] - r[0], r[3] - r[1]), v = rnd();
    const parts = [[r[0], r[1], r[2], r[3], 0.16, hgt]], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    let round = 0;
    if (d === 'downtown' && hgt > 60 && v < 0.3) { const h1 = hgt * (0.45 + rnd() * 0.2), ins = w * 0.18; parts[0][5] = h1; parts.push([r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins, h1, hgt]); } // setback tower
    else if (d === 'downtown' && hgt > 85 && v < 0.48) { const ins = w * 0.13; parts[0][5] = hgt * 0.4; parts.push([r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins, hgt * 0.4, hgt * 0.72], [r[0] + ins * 2, r[1] + ins * 2, r[2] - ins * 2, r[3] - ins * 2, hgt * 0.72, hgt]); } // three tiers
    else if (hgt > 40 && v < 0.66 && w > 13) { parts[0][5] = 8 + rnd() * 5; round = w / 2 * (0.82 + rnd() * 0.14); } // round tower on a podium
    parts.forEach(([x0, z0, x1, z1, y0, y1], i) => bx(ch, [x0, z0, x1, z1], y0, y1, st, C_ROOF, i));
    const nc = pick(NEON), top = parts[parts.length - 1];
    if (round) {
      const y0 = parts[0][5], n = rnd() < 0.5 ? 8 : 14;
      prism(ch, cx, cz, round, n, y0, hgt, st.col, glowW(st.tint, st.lit), C_ROOF, round, W0, st);
      prism(ch, cx, cz, round + 0.12, n, hgt - 2.4, hgt - 1.5, nc, glowW(nc), nc, round + 0.12); prism(ch, cx, cz, round + 0.12, n, y0 + 0.2, y0 + 0.6, nc, glowW(nc), nc, round + 0.12);
      if (rnd() < 0.4) prism(ch, cx, cz, round * 0.8, n, hgt, hgt + 6 + rnd() * 8, st.col, dim(nc, 0.25), nc, 0.3);
    } else if (d === 'downtown' && hgt > 40 && rnd() < 0.7) { // neon edges and a glowing crown
      parts.forEach(([x0, z0, x1, z1, y0, y1]) => neonEdges(ch, x0, z0, x1, z1, y0 + 4, y1, nc));
      const [x0, z0, x1, z1, , y1] = top, cw = glowW(nc, 1), o = 0.08;
      ch.quad([x0, y1 - 2.4, z0 - o], [x1, y1 - 2.4, z0 - o], [x1, y1 - 1.5, z0 - o], [x0, y1 - 1.5, z0 - o], nc, Z4, cw, [0, 0, -1]);
      ch.quad([x0, y1 - 2.4, z1 + o], [x1, y1 - 2.4, z1 + o], [x1, y1 - 1.5, z1 + o], [x0, y1 - 1.5, z1 + o], nc, Z4, cw, [0, 0, 1]);
      ch.quad([x0 - o, y1 - 2.4, z0], [x0 - o, y1 - 2.4, z1], [x0 - o, y1 - 1.5, z1], [x0 - o, y1 - 1.5, z0], nc, Z4, cw, [-1, 0, 0]);
      ch.quad([x1 + o, y1 - 2.4, z0], [x1 + o, y1 - 2.4, z1], [x1 + o, y1 - 1.5, z1], [x1 + o, y1 - 1.5, z0], nc, Z4, cw, [1, 0, 0]);
    } else if (d !== 'harbor' && hgt > 16 && rnd() < 0.25) roofRim(ch, r, hgt, nc);
    let tip = hgt;
    if (!round && hgt > 95 && rnd() < 0.6) { const sh = 10 + rnd() * 18; ch.box(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, hgt, hgt + sh, C_POLE, W0, C_POLE); tip = hgt + sh; }
    if (hgt > 60 && !round) ch.box(cx - 0.4, cz - 0.4, cx + 0.4, cz + 0.4, tip, tip + 0.8, RED0, glowW(RED0), RED0);
    if (hgt < 45 && !round && rnd() < 0.75) roofUnits(ch, top, hgt, 1 + Math.floor(rnd() * 3));
    if (d !== 'harbor') for (const f of faces) if (rnd() > 0.3) shopfront(ch, f, rnd() < 0.7 ? POOL.shop : POOL.night, 3.2, 0.25);
    if (d === 'downtown' && hgt < 70 && !round && rnd() < 0.35) { // rooftop billboard
      const along = rnd() < 0.5, L = along ? (r[2] - r[0]) * 0.7 : (r[3] - r[1]) * 0.7, half = Math.min(L / 2, 5.5), tx = along ? 1 : 0, tz = along ? 0 : 1;
      signs.push({ x: cx, z: cz, tx, tz, half, y0: hgt + 2.5, y1: hgt + 2.5 + half, panel: pick([0, 1, 3, 4, 5, 6]) });
      for (const o of [-0.7, 0.7]) ch.box(cx + tx * half * o - 0.15, cz + tz * half * o - 0.15, cx + tx * half * o + 0.15, cz + tz * half * o + 0.15, hgt, hgt + 2.5, C_POLE, W0, C_POLE, 0, 0, false);
    }
    if (rnd() < (d === 'downtown' ? 0.75 : d === 'harbor' ? 0.08 : 0.3) && hgt > 14) for (const f of faces) { // vertical neon blades
      if (rnd() < 0.35) continue;
      const c = pick(NEON), pos = f[3] + 2 + rnd() * (f[4] - f[3] - 4), y0 = 6.5 + rnd() * 4, y1 = y0 + 5 + rnd() * Math.min(10, hgt - y0 - 4);
      panel(ch, f, pos - 0.8, pos + 0.8, y0, y1, c, glowW(c), 0.3);
    }
    solid(r);
  };
  // restaurant or cafe: a low building set back behind a terrace with tables, umbrellas and string lights
  const eatery = (ch, r, faces, d, cafe) => {
    const f0 = faces[0], R2 = r.slice(), dep = depthOf(r, f0), tdp = dep > 12 ? Math.min(dep - 8, 4 + rnd() * 3) : 0;
    if (tdp) cut(R2, f0, tdp);
    const ff = faceOf(R2, f0), h = cafe ? 3.8 + rnd() * 1.4 : 4.4 + rnd() * 4, col = pick(EAT_COL), aw = pick(AWN), a0 = ff[3], a1 = ff[4];
    const st = { col, tint: TINTS.warm, lit: 0.45 + rnd() * 0.3, uo: rnd(), vo: rnd(), su: 1, sv: 1 };
    bx(ch, R2, 0.16, h, st, C_ROOF);
    const v = rnd();
    if (v < (cafe ? 0.55 : 0.25)) gable(ch, R2, h, 1.8 + rnd() * 1.2, pick(ROOF_COL), f0[0] === 'z', col, dim(col, 0.5));
    else if (v < 0.7) roofRim(ch, R2, h, pick(NEON));
    else roofUnits(ch, R2, h, 1 + Math.floor(rnd() * 2));
    // glass front, a long awning, the name above it
    const g = pick(GLOWS), m0 = a0 + (a1 - a0) * 0.06, m1 = a1 - (a1 - a0) * 0.06;
    panel(ch, ff, m0, m1, 0.45, 2.95, g, dim(g, 0.36)); awning(ch, ff, m0, m1, 3.5, 1.6, aw);
    signOn(ff, (a0 + a1) / 2, Math.min(3.4, (a1 - a0) / 2 - 0.4), h > 5.6 ? 3.9 : h - 0.2, h > 5.6 ? 5.5 : h + 1.4, SI(pick(cafe ? POOL.cafe : POOL.eat)));
    for (const f of faces.slice(1)) shopfront(ch, faceOf(R2, f), null, 2.9, 0.8);
    if (!cafe && h > 6.5 && rnd() < 0.5) { const c = pick(NEON), pos = a0 + 1.5 + rnd() * (a1 - a0 - 3); panel(ch, ff, pos - 0.6, pos + 0.6, 4.2, h + 2.5, c, glowW(c), 0.4); }
    solid(R2);
    if (!tdp) return;
    const tr = fr(ff, a0, a1, 0.3, tdp - 0.2); bp(ch, tr, 0.16, 0.24, C_WOOD);
    for (let o = 1.9; o < tdp - 1.2; o += 3.1) for (let a = a0 + 2 + rnd(); a < a1 - 1.6; a += 3.3) { if (rnd() < 0.2) continue; const p = pt(ff, a, o); table(ch, p[0], p[1], aw); }
    const e0 = pt(ff, a0 + 0.3, tdp - 0.4), e1 = pt(ff, a1 - 0.3, tdp - 0.4), w0 = pt(ff, a0 + 0.3, 0.2), w1 = pt(ff, a1 - 0.3, 0.2);
    for (const p of [e0, e1]) { ch.box(p[0] - 0.06, p[1] - 0.06, p[0] + 0.06, p[1] + 0.06, 0.2, 3.3, C_POLE, W0, C_POLE, 0, 0, false); circ(p[0], p[1], 0.2); }
    bulbs(ch, e0[0], e0[1], e1[0], e1[1], 3.25); bulbs(ch, e0[0], e0[1], w0[0], w0[1], 3.25); bulbs(ch, e1[0], e1[1], w1[0], w1[1], 3.25);
    pools.push([(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, 3, 0]);
  };
  // a row of narrow shop-houses sharing the lot, each its own height, colour and roof
  const shops = (ch, r, faces, d) => {
    const f = faces.slice().sort((a, b) => (b[4] - b[3]) - (a[4] - a[3]))[0], dep = depthOf(r, f), len = f[4] - f[3], n = Math.max(1, Math.round(len / (6.5 + rnd() * 3.5)));
    for (let k = 0; k < n; k++) {
      const a0 = f[3] + len * k / n, a1 = f[3] + len * (k + 1) / n, u = fr(f, a0, a1, 0, -dep), h = 6.8 + Math.floor(rnd() * 4) * 3.2, st = mkStyle(d, 0.25 + rnd() * 0.35);
      bx(ch, u, 0.16, h, st, C_ROOF, k);
      const v = rnd();
      if (v < 0.35) gable(ch, u, h, 1.6 + rnd() * 1.4, pick(ROOF_COL), f[0] === 'z', st.col, dim(st.col, 0.5));
      else if (v < 0.5) roofRim(ch, u, h, pick(NEON)); else if (v < 0.85) roofUnits(ch, u, h, 1);
      shopfront(ch, [f[0], f[1], f[2], a0 + 0.3, a1 - 0.3], rnd() < 0.3 ? POOL.cafe : rnd() < 0.4 ? POOL.eat : POOL.shop, 3.1, 0.7);
    }
    for (const g of faces) if (g !== f && rnd() < 0.6) shopfront(ch, g, POOL.shop, 3.1, 0.5);
    solid(r);
  };
  // family houses with pitched roofs, lawns, lit windows and the odd car in the drive
  const houses = (ch, r, faces, d) => {
    const f = faces.slice().sort((a, b) => (b[4] - b[3]) - (a[4] - a[3]))[0], dep = depthOf(r, f), len = f[4] - f[3], n = Math.max(1, Math.round(len / (12 + rnd() * 4)));
    bp(ch, r, 0.16, 0.2, C_LAWN); mm.push({ k: 'park', x0: r[0], z0: r[1], x1: r[2], z1: r[3] });
    for (let k = 0; k < n; k++) {
      const a0 = f[3] + len * k / n, a1 = f[3] + len * (k + 1) / n, drive = a1 - a0 > 11.5 && rnd() < 0.55, sb = 2.5 + rnd() * 3, hd = Math.min(dep - sb - 1.5, 7.5 + rnd() * 3.5);
      if (hd < 5) continue;
      const u = fr(f, a0 + 1.2 + (drive ? 3 : 0), a1 - 1.2, -sb, -sb - hd), two = rnd() < 0.5, h = two ? 6.3 : 3.4, col = pick(HOUSE_COL), white = d === 'shore' && rnd() < 0.6;
      const st = { col: white ? C_PALE : col, tint: pick([TINTS.warm, TINTS.soft, TINTS.soft, TINTS.cool]), lit: 0.3 + rnd() * 0.45, uo: rnd(), vo: rnd(), su: 1.25, sv: 1.1 };
      bx(ch, u, 0.16, h, st, C_ROOF);
      if (white && rnd() < 0.7) { bp(ch, [u[0] - 0.3, u[1] - 0.3, u[2] + 0.3, u[3] + 0.3], h, h + 0.25, C_WHITE); if (two) roofUnits(ch, u, h + 0.25, 1); } // flat-roofed villa
      else gable(ch, u, h, 1.9 + rnd() * 1.1, pick(ROOF_COL), (f[0] === 'z') === (rnd() < 0.7), st.col, dim(st.col, 0.5));
      const hf = faceOf(u, f), dm = (hf[3] + hf[4]) / 2 + (rnd() - 0.5) * 2;
      panel(ch, hf, dm - 0.5, dm + 0.5, 0.2, 2.2, C_WOOD, W0); panel(ch, hf, dm - 0.18, dm + 0.18, 2.4, 2.7, C_LAMP, glowW(C_LAMP), 0.12);
      if (rnd() < 0.5) { const p = pt(hf, dm, 0.5); ch.box(p[0] - 1.3, p[1] - 0.5, p[0] + 1.3, p[1] + 0.5, 0.16, 0.42, C_STONE, W0, C_STONE); }
      rect(u[0], u[1], u[2], u[3]); mm.push({ k: 'bld', x0: u[0], z0: u[1], x1: u[2], z1: u[3] });
      if (drive) { const dr = fr(f, a0 + 0.6, a0 + 3.6, 0, -sb - hd); bp(ch, dr, 0.16, 0.22, C_LOT); if (rnd() < 0.6) { const p = pt(f, a0 + 2.1, -sb - 2.6); parked(ch, p[0], p[1], f[0] === 'x', rnd() < 0.5); } }
      if (dep - sb - hd > 5 && rnd() < 0.6) { const p = pt(f, a0 + 2 + rnd() * (a1 - a0 - 4), -sb - hd - 2.5); tree(p[0], p[1]); }
    }
  };
  // apartment block with balconies on the street side
  const apart = (ch, r, faces, d) => {
    const st = mkStyle(d, 0.3 + rnd() * 0.3), fl = 4 + Math.floor(rnd() * 6), h = 0.5 + fl * 3.3; st.su = 0.85; st.sv = 3.5 / 3.3;
    bx(ch, r, 0.16, h, st, C_ROOF);
    const f = faces[0], m0 = f[3] + (f[4] - f[3]) * 0.1, m1 = f[4] - (f[4] - f[3]) * 0.1, bc = rnd() < 0.5 ? C_WHITE : C_UNIT2, half = rnd() < 0.5;
    for (let k = 1; k < Math.min(fl, 8); k++) {
      const y = 0.4 + k * 3.3;
      for (const [b0, b1] of half ? [[m0, (m0 + m1) / 2 - 1], [(m0 + m1) / 2 + 1, m1]] : [[m0, m1]]) { bp(ch, fr(f, b0, b1, 0, 1.15), y, y + 0.16, bc); bp(ch, fr(f, b0, b1, 1.07, 1.15), y + 0.16, y + 1.05, bc, W0, bc, false); }
    }
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    ch.box(cx - 2, cz - 1.5, cx + 2, cz + 1.5, h, h + 2.6, C_UNIT, W0, C_UNIT); if (rnd() < 0.5) prism(ch, r[0] + 2.5, r[1] + 2.5, 1.3, 10, h + 0.6, h + 2.6, C_UNIT2);
    if (rnd() < 0.3) roofRim(ch, r, h, pick(NEON));
    for (const g of faces) if (rnd() < 0.45) shopfront(ch, g, rnd() < 0.5 ? POOL.shop : POOL.cafe, 3.0, 0.6);
    solid(r);
  };
  // hotel: a slab behind a forecourt, with a lit canopy over the door and a glowing crown
  const hotel = (ch, r, faces, d) => {
    const f0 = faces[0], R2 = r.slice(), fc = depthOf(r, f0) > 20 ? 5 : 0; if (fc) cut(R2, f0, fc);
    const ff = faceOf(R2, f0), h = d === 'shore' ? 16 + rnd() * 20 : 30 + rnd() * 38, st = mkStyle(d, 0.45 + rnd() * 0.2, pick([TINTS.warm, TINTS.soft])); st.su = 1.25; st.sv = 1.1;
    if (d === 'shore' && rnd() < 0.5) st.col = C_PALE;
    bx(ch, R2, 0.16, h, st, C_ROOF);
    const nc = pick([TINTS.warm, lin('#ffd27a'), lin('#5fb8ff'), lin('#ff5fa8')]); roofRim(ch, R2, h, nc);
    for (const [x0, z0, x1, z1] of [R2]) neonEdges(ch, x0, z0, x1, z1, h - 3, h, nc);
    const mid = (ff[3] + ff[4]) / 2, cw = Math.min(5, (ff[4] - ff[3]) / 2 - 1), cd = fc ? 4.4 : 2.2, cr = fr(ff, mid - cw, mid + cw, 0, cd);
    bp(ch, cr, 3.7, 4.2, C_UNIT2, W0, C_UNIT2); ch.quad([cr[0], 3.68, cr[1]], [cr[2], 3.68, cr[1]], [cr[2], 3.68, cr[3]], [cr[0], 3.68, cr[3]], SHOPGLOW, Z4, dim(SHOPGLOW, 0.3), [0, -1, 0]);
    if (fc) for (const a of [mid - cw + 0.3, mid + cw - 0.3]) { const p = pt(ff, a, cd - 0.3); ch.box(p[0] - 0.2, p[1] - 0.2, p[0] + 0.2, p[1] + 0.2, 0.16, 3.7, C_UNIT2, W0, C_UNIT2, 0, 0, false); circ(p[0], p[1], 0.35); }
    panel(ch, ff, mid - cw, mid + cw, 0.4, 3.4, SHOPGLOW, dim(SHOPGLOW, 0.4)); pools.push(pt(ff, mid, cd / 2).concat([3.7, 0]));
    signOn([ff[0], ff[1] + ff[2] * cd, ff[2], 0, 0], mid, Math.min(3.6, cw), 4.3, 6.1, SI(rnd() < 0.8 ? 'HOTEL' : 'MOTEL'), 0.05);
    if (h > 34 && rnd() < 0.5) { const along = f0[0] === 'z', cx = (R2[0] + R2[2]) / 2, cz = (R2[1] + R2[3]) / 2, half = 5; signs.push({ x: cx, z: cz, tx: along ? f0[2] : 0, tz: along ? 0 : -f0[2], half, y0: h + 1.5, y1: h + 6.5, panel: 6 }); for (const o of [-3.5, 3.5]) ch.box(cx + (along ? o : 0) - 0.15, cz + (along ? 0 : o) - 0.15, cx + (along ? o : 0) + 0.15, cz + (along ? 0 : o) + 0.15, h, h + 1.5, C_POLE, W0, C_POLE, 0, 0, false); }
    if (fc && d === 'shore') for (const a of [ff[3] + 2, ff[4] - 2]) { const p = pt(ff, a, 2.6); palm(p[0], p[1]); }
    for (const g of faces.slice(1)) if (rnd() < 0.5) shopfront(ch, faceOf(R2, g), POOL.eat, 3.2, 0.5);
    solid(R2);
  };
  // fuel station: a lit canopy over two pump islands, a shop at the back and a price sign by the road
  const gas = (ch, r, faces) => {
    const f = faces[0], dep = depthOf(r, f), a0 = f[3], a1 = f[4], mid = (a0 + a1) / 2, nc = pick(NEON), ax = f[0] === 'z';
    bp(ch, r, 0.16, 0.2, C_LOT);
    const kd = Math.min(6, dep * 0.28), kr = fr(f, a0 + 1, a1 - 1, -dep + kd + 0.5, -dep + 0.5), kf = faceOf(kr, f);
    bp(ch, kr, 0.16, 3.8, C_WHITE, W0, C_ROOF); panel(ch, kf, kf[3] + 0.6, kf[4] - 0.6, 0.5, 3.0, SHOPGLOW, dim(SHOPGLOW, 0.4)); roofRim(ch, kr, 3.8, nc);
    signOn(kf, mid, Math.min(3, (a1 - a0) / 2 - 1.5), 3.9, 5.3, SI(pick(['MARKET', 'COFFEE', 'TIRES', 'CAR WASH']))); solid(kr);
    const cw = Math.min(8, (a1 - a0) / 2 - 2), c0 = -1.5, c1 = -Math.min(dep - kd - 3, 10.5), cr = fr(f, mid - cw, mid + cw, c0, c1);
    bp(ch, cr, 5.0, 5.7, C_WHITE, W0, C_WHITE); neonEdges(ch, cr[0], cr[1], cr[2], cr[3], 5.69, 5.7, nc);
    ch.quad([cr[0], 4.98, cr[1]], [cr[2], 4.98, cr[1]], [cr[2], 4.98, cr[3]], [cr[0], 4.98, cr[3]], C_WHITE, Z4, dim(lin('#eaf2ff'), 0.32), [0, -1, 0]);
    pools.push([(cr[0] + cr[2]) / 2, (cr[1] + cr[3]) / 2, 5, 0], pt(f, mid - cw / 2, (c0 + c1) / 2).concat([5, 0]), pt(f, mid + cw / 2, (c0 + c1) / 2).concat([5, 0]));
    for (const a of [mid - cw + 0.6, mid + cw - 0.6]) for (const o of [c0 - 0.6, c1 + 0.6]) { const p = pt(f, a, o); ch.box(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18, 0.16, 5, C_UNIT2, W0, C_UNIT2, 0, 0, false); circ(p[0], p[1], 0.3); }
    for (const a of [mid - cw * 0.45, mid + cw * 0.45]) { const pr = fr(f, a - 1.5, a + 1.5, (c0 + c1) / 2 + 0.35, (c0 + c1) / 2 - 0.35); bp(ch, pr, 0.16, 0.34, C_UNIT); for (const s of [-0.8, 0.8]) { const q = pt(f, a + s, (c0 + c1) / 2); ch.box(q[0] - 0.28, q[1] - 0.28, q[0] + 0.28, q[1] + 0.28, 0.34, 1.75, RED0, dim(RED0, 0.06), C_WHITE); ch.box(q[0] - 0.2, q[1] - 0.2, q[0] + 0.2, q[1] + 0.2, 1.75, 1.95, C_LAMP, glowW(C_LAMP), C_LAMP); } rect(pr[0], pr[1], pr[2], pr[3]); }
    const tp = pt(f, a0 + 1.2, -0.8); ch.box(tp[0] - 0.2, tp[1] - 0.2, tp[0] + 0.2, tp[1] + 0.2, 0.16, 5.2, C_UNIT2, W0, C_UNIT2, 0, 0, false); circ(tp[0], tp[1], 0.35);
    signs.push({ x: tp[0], z: tp[1], tx: ax ? f[2] : 0, tz: ax ? 0 : -f[2], half: 1.8, y0: 5.2, y1: 6.5, shop: SI('FUEL') });
  };
  // multi-storey car park: open decks with the lights left on
  const garage = (ch, r, faces) => {
    const n = 3 + Math.floor(rnd() * 4), col = lin(pick(['#4a4c55', '#5a5850', '#3e4450'])), ins = [r[0] + 0.5, r[1] + 0.5, r[2] - 0.5, r[3] - 0.5], gl = pick([TINTS.soft, TINTS.cool, TINTS.white]);
    for (let k = 0; k < n; k++) { const y = 0.16 + k * 3.1; bp(ch, ins, y, y + 2.2, C_DARK, dim(gl, 0.07), C_DARK, false); bp(ch, r, y + 2.2, y + 3.1 + (k === n - 1 ? 0.3 : 0), col, W0, C_LOT); }
    const h = 0.16 + n * 3.1 + 0.3, f = faces[0], mid = (f[3] + f[4]) / 2;
    panel(ch, f, mid - 3, mid + 3, 0.2, 2.3, C_DARK, dim(gl, 0.3), 0.08); signOn(f, mid, 2.8, 2.5, 3.9, SI('PARKING'));
    ch.box(r[0] + 1, r[1] + 1, r[0] + 5, r[1] + 5, h, h + 2.8, col, W0, col); globe(ch, r[2] - 2, r[3] - 2, h + 3); pools.pop();
    solid(r);
  };
  // cinema: a marquee blazing over the doors, posters either side, a neon blade on the corner
  const cinema = (ch, r, faces, d) => {
    const f = faces[0], h = 10 + rnd() * 5, col = lin(pick(['#3a1830', '#1c1c34', '#40201c', '#18303a'])), nc = pick(NEON), mid = (f[3] + f[4]) / 2, hw = Math.min(6.5, (f[4] - f[3]) / 2 - 0.6);
    bp(ch, r, 0.16, h, col, glowW(col, 0.02), C_ROOF); roofRim(ch, r, h, nc);
    const mr = fr(f, mid - hw, mid + hw, 0, 2.6), mf = [f[0], f[1] + f[2] * 2.6, f[2], mid - hw, mid + hw];
    bp(ch, mr, 4.0, 5.6, C_DARK); ch.quad([mr[0], 3.98, mr[1]], [mr[2], 3.98, mr[1]], [mr[2], 3.98, mr[3]], [mr[0], 3.98, mr[3]], C_LAMP, Z4, dim(C_LAMP, 0.4), [0, -1, 0]);
    panel(ch, mf, mid - hw, mid + hw, 4.0, 4.14, nc, glowW(nc)); panel(ch, mf, mid - hw, mid + hw, 5.46, 5.6, nc, glowW(nc));
    signOn(mf, mid, Math.min(3, hw - 0.4), 4.2, 5.4, SI(rnd() < 0.7 ? 'CINEMA' : 'THEATER'), 0.05); pools.push(pt(f, mid, 1.6).concat([4, 0]));
    panel(ch, f, mid - hw * 0.5, mid + hw * 0.5, 0.4, 3.3, SHOPGLOW, dim(SHOPGLOW, 0.42));
    for (const s of [-1, 1]) { const c = pick(NEON), a = mid + s * (hw * 0.5 + 1.6); if (Math.abs(a - mid) + 1 < (f[4] - f[3]) / 2) panel(ch, f, a - 0.9, a + 0.9, 0.9, 3.3, c, dim(c, 0.3)); }
    const bl = pick(NEON); panel(ch, f, f[3] + 0.4, f[3] + 1.6, 6, h + 3, bl, glowW(bl), 0.4);
    for (const g of faces.slice(1)) if (rnd() < 0.5) shopfront(ch, g, POOL.night, 3.2, 0.3);
    void d; solid(r);
  };
  // columned hall (museum, gallery, library, bank): steps, a colonnade lit from behind, a pediment
  const hall = (ch, r, f, name, big) => {
    const R2 = r.slice(), pd = big ? 4.2 : 3; cut(R2, f, pd + (big ? 3.6 : 2.4));
    const ff = faceOf(R2, f), H = big ? 15 : 9.5 + rnd() * 2.5, base = big ? 1.8 : 1.1, a0 = ff[3], a1 = ff[4], mid = (a0 + a1) / 2, pw = Math.min((a1 - a0) / 2 - (big ? 6 : 0.6), big ? 17 : 9);
    const st = { col: C_STONE, tint: TINTS.warm, lit: 0.55, uo: 0.1, vo: 0, su: 0.6, sv: 0.42 };
    bp(ch, R2, 0.16, base, C_STONE); bx(ch, [R2[0] + 0.5, R2[1] + 0.5, R2[2] - 0.5, R2[3] - 0.5], base, H, st, C_ROOF);
    const steps = big ? 4 : 3; for (let k = 0; k < steps; k++) bp(ch, fr(ff, mid - pw - 0.8, mid + pw + 0.8, 0, pd + (steps - k) * 0.8), 0.16 + (base - 0.16) * k / steps, 0.16 + (base - 0.16) * (k + 1) / steps, C_STONE);
    const pr = fr(ff, mid - pw, mid + pw, 0, pd), nc = Math.max(4, Math.round(pw * 2 / 3.4));
    for (let k = 0; k < nc; k++) { const p = pt(ff, mid - pw + 0.7 + (pw * 2 - 1.4) * k / (nc - 1), pd - 0.75); prism(ch, p[0], p[1], big ? 0.62 : 0.45, 8, base, H - 1.7, C_WHITE, dim(C_WHITE, 0.02)); }
    bp(ch, pr, H - 1.7, H, C_STONE);
    const rr = [Math.min(R2[0], pr[0]), Math.min(R2[1], pr[1]), Math.max(R2[2], pr[2]), Math.max(R2[3], pr[3])];
    gable(ch, f[0] === 'z' ? [pr[0], rr[1], pr[2], rr[3]] : [rr[0], pr[1], rr[2], pr[3]], H, big ? 4.2 : 2.6, lin('#5a5850'), f[0] === 'x', C_STONE, dim(C_STONE, 0.06));
    panel(ch, ff, mid - pw + 0.4, mid + pw - 0.4, base + 0.2, H - 1.9, SHOPGLOW, dim(SHOPGLOW, 0.3)); // light behind the columns
    panel(ch, ff, mid - 1.4, mid + 1.4, base, base + 4.2, C_WOOD, dim(SHOPGLOW, 0.5), 0.1);
    for (const s of [-1, 1]) { const c = pick(NEON), a = mid + s * pw * 0.55; panel(ch, ff, a - 0.9, a + 0.9, base + 2.2, H - 2.4, c, dim(c, 0.35), 0.12); }
    signOn([ff[0], ff[1] + ff[2] * pd, ff[2], 0, 0], mid, big ? 6.5 : 3.2, H - 1.55, H - 0.15, SI(name), 0.05);
    for (const s of [-1, 1]) { const p = pt(ff, mid + s * (pw + 2), pd + 1.2); globe(ch, p[0], p[1], 3.6); }
    solid(R2); rect(pr[0], pr[1], pr[2], pr[3]);
  };
  // warehouse with a pitched or saw-tooth roof and loading doors
  const ware = (ch, r, faces, d) => {
    const st = mkStyle(d, 0.07, TINTS.white), h = 8 + rnd() * 4.5, alongX = r[2] - r[0] >= r[3] - r[1]; st.su = 0.6;
    bx(ch, r, 0.16, h, st, C_ROOF);
    if (rnd() < 0.5) gable(ch, r, h, 2 + rnd() * 1.5, lin('#3a3d44'), alongX, st.col, dim(st.col, 0.4));
    else { // saw-tooth: sloped panels with north-light glazing left on
      const n = Math.max(2, Math.round((alongX ? r[2] - r[0] : r[3] - r[1]) / 9)), gl = dim(TINTS.cool, 0.35), rc = lin('#3a3d44');
      for (let k = 0; k < n; k++) {
        const a = (alongX ? r[0] : r[1]) + (alongX ? r[2] - r[0] : r[3] - r[1]) * k / n, b2 = (alongX ? r[0] : r[1]) + (alongX ? r[2] - r[0] : r[3] - r[1]) * (k + 1) / n;
        if (alongX) { ch.quad([a, h, r[1]], [a, h, r[3]], [b2, h + 2.4, r[3]], [b2, h + 2.4, r[1]], rc, Z4, W0, [-1, 1, 0]); ch.quad([b2, h, r[1]], [b2, h, r[3]], [b2, h + 2.4, r[3]], [b2, h + 2.4, r[1]], TINTS.cool, Z4, gl, [1, 0, 0]); }
        else { ch.quad([r[0], h, a], [r[2], h, a], [r[2], h + 2.4, b2], [r[0], h + 2.4, b2], rc, Z4, W0, [0, 1, -1]); ch.quad([r[0], h, b2], [r[2], h, b2], [r[2], h + 2.4, b2], [r[0], h + 2.4, b2], TINTS.cool, Z4, gl, [0, 0, 1]); }
      }
    }
    for (const f of faces) for (let a = f[3] + 4; a + 4.4 < f[4] - 2; a += 9 + rnd() * 6) { panel(ch, f, a, a + 4.4, 0.2, 4.8, C_UNIT, W0, 0.08); panel(ch, f, a + 1.9, a + 2.5, 5.2, 5.5, C_LAMP, glowW(C_LAMP), 0.2); pools.push(pt(f, a + 2.2, 2.5).concat([5, 0])); }
    solid(r);
  };
  // tank farm
  const tanks = (ch, r) => {
    bp(ch, r, 0.16, 0.2, C_LOT);
    const w = r[2] - r[0], l = r[3] - r[1], rr = Math.min(7.5, Math.min(w, l) / 2 - 1.5, Math.max(w, l) / 4 - 1), nx = Math.max(1, Math.floor(w / (rr * 2 + 3))), nz = Math.max(1, Math.floor(l / (rr * 2 + 3)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = r[0] + w * (i + 0.5) / nx, z = r[1] + l * (j + 0.5) / nz, h = 7 + rnd() * 8, c = rnd() < 0.6 ? C_WHITE : lin(pick(['#8a8a80', '#6a7a88', '#8a5a40']));
      prism(ch, x, z, rr, 14, 0.2, h, c, dim(c, 0.03), c, rr); prism(ch, x, z, rr, 14, h, h + 1.1, c, W0, c, 0.4); prism(ch, x, z, rr + 0.05, 14, h - 1.2, h - 0.8, pick(CONT));
      ch.box(x - 0.2, z - 0.2, x + 0.2, z + 0.2, h + 1.1, h + 1.6, RED0, glowW(RED0), RED0); circ(x, z, rr + 0.1); mm.push({ k: 'bld', x0: x - rr, z0: z - rr, x1: x + rr, z1: z + rr });
    }
  };
  // small square: fountain, benches, lamp globes, trees
  const plaza = (ch, r) => {
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, w = Math.min(r[2] - r[0], r[3] - r[1]);
    bp(ch, r, 0.16, 0.22, lin('#34343c')); fountain(ch, cx, cz, Math.min(4.5, w / 2 - 3));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = cx + sx * (r[2] - r[0]) * 0.38, z = cz + sz * (r[3] - r[1]) * 0.38; if (rnd() < 0.6) tree(x, z); else globe(ch, x, z); }
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const x = cx + dx * (w / 2 - 1.2), z = cz + dz * (w / 2 - 1.2), bw = dz ? 1.1 : 0.3, bl = dz ? 0.3 : 1.1; ch.box(x - bw, z - bl, x + bw, z + bl, 0.22, 0.62, C_WOOD, W0, C_WOOD); rect(x - bw, z - bl, x + bw, z + bl); }
  };
  // park: lawn, crossing paths, trees, lamp globes, sometimes a pond or a bandstand
  const pavilion = (ch, x, z, r) => { const c = pick(AWN); prism(ch, x, z, r, 8, 0.16, 0.6, C_STONE, W0, C_STONE, r); for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, px = x + (r - 0.4) * Math.cos(a), pz = z + (r - 0.4) * Math.sin(a); ch.box(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, 0.6, 3.6, C_WHITE, W0, C_WHITE, 0, 0, false); } prism(ch, x, z, r + 0.6, 8, 3.6, 5.6, c, dim(c, 0.12), c, 0.2); prism(ch, x, z, r + 0.62, 8, 3.45, 3.62, C_LAMP, glowW(C_LAMP), C_LAMP, r + 0.62); pools.push([x, z, 4, 0]); circ(x, z, r); };
  const park = (ch, r, big) => {
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, pw = big ? 3 : 2, feats = [];
    const path = (x0, z0, x1, z1) => ch.quad([x0, 0.2, z0], [x1, 0.2, z0], [x1, 0.2, z1], [x0, 0.2, z1], C_PATH, Z4, W0, [0, 1, 0]);
    path(r[0], cz - pw, r[2], cz + pw); path(cx - pw, r[1], cx + pw, r[3]);
    const v = rnd();
    if (big || v < 0.35) { fountain(ch, cx, cz, big ? 6 : 3.4); path(cx - (big ? 12 : 7), cz - (big ? 12 : 7), cx + (big ? 12 : 7), cz + (big ? 12 : 7)); feats.push([cx, cz, big ? 14 : 8]); }
    if (big || (v > 0.3 && v < 0.6)) { const px = cx + (r[2] - r[0]) * 0.25, pz = cz + (r[3] - r[1]) * 0.26, pr = Math.min(r[2] - r[0], r[3] - r[1]) * (big ? 0.15 : 0.17); prism(ch, px, pz, pr, 18, 0.1, 0.19, C_STONE, W0, C_WATER, pr, dim(lin('#2a78c0'), 0.3)); circ(px, pz, pr - 0.6); feats.push([px, pz, pr + 2]); }
    if (big || v > 0.7) { const px = cx - (r[2] - r[0]) * 0.25, pz = cz + (r[3] - r[1]) * 0.26; pavilion(ch, px, pz, big ? 5 : 3.2); feats.push([px, pz, 8]); }
    for (let a = r[0] + 9; a < r[2] - 6; a += 18) for (const z of [cz - pw - 1, cz + pw + 1]) if (Math.abs(a - cx) > (big ? 15 : 9) && !(big && big(a, z))) globe(ch, a, z);
    for (let a = r[1] + 9; a < r[3] - 6; a += 18) for (const x of [cx - pw - 1, cx + pw + 1]) if (Math.abs(a - cz) > (big ? 15 : 9) && !(big && big(x, a))) globe(ch, x, a);
    for (let x = r[0] + 5; x < r[2] - 3; x += 11) for (let z = r[1] + 5; z < r[3] - 3; z += 11) {
      const tx = x + (rnd() - 0.5) * 6, tz = z + (rnd() - 0.5) * 6;
      if (rnd() < 0.3 || Math.abs(tx - cx) < pw + 2.5 || Math.abs(tz - cz) < pw + 2.5 || feats.some(([fx, fz, fr2]) => Math.hypot(tx - fx, tz - fz) < fr2) || (big && big(tx, tz))) continue;
      if (rnd() < 0.2) palm(tx, tz); else tree(tx, tz);
    }
  };
  const pickKind = (d) => {
    const u = rnd();
    if (d === 'downtown') return u < 0.5 ? 'tower' : u < 0.6 ? 'hotel' : u < 0.7 ? 'eat' : u < 0.77 ? 'cafe' : u < 0.83 ? 'garage' : u < 0.88 ? 'cinema' : u < 0.92 ? 'hall' : u < 0.96 ? 'plaza' : 'apart';
    if (d === 'west') return u < 0.32 ? 'shops' : u < 0.47 ? 'eat' : u < 0.6 ? 'cafe' : u < 0.77 ? 'apart' : u < 0.82 ? 'gas' : u < 0.87 ? 'cinema' : u < 0.91 ? 'hall' : u < 0.95 ? 'plaza' : 'tower';
    if (d === 'north') return u < 0.54 ? 'houses' : u < 0.71 ? 'apart' : u < 0.8 ? 'cafe' : u < 0.86 ? 'eat' : u < 0.92 ? 'shops' : u < 0.96 ? 'gas' : 'hall';
    if (d === 'shore') return u < 0.19 ? 'hotel' : u < 0.42 ? 'eat' : u < 0.6 ? 'cafe' : u < 0.77 ? 'houses' : u < 0.88 ? 'apart' : u < 0.95 ? 'shops' : 'plaza';
    return u < 0.46 ? 'ware' : u < 0.62 ? 'tanks' : u < 0.74 ? 'tower' : u < 0.83 ? 'eat' : u < 0.91 ? 'gas' : 'garage';
  };
  const count = {};
  const buildLot = (ch, r, faces, d) => {
    const w = Math.min(r[2] - r[0], r[3] - r[1]), l = Math.max(r[2] - r[0], r[3] - r[1]), fd = depthOf(r, faces[0]), fl = faces[0][4] - faces[0][3];
    let k = pickKind(d);
    if (k === 'gas' && (fl < 20 || fd < 17)) k = d === 'harbor' ? 'ware' : 'shops';
    if (k === 'hall' && (fl < 15 || fd < 14 || fl > 40)) k = 'apart';
    if (k === 'cinema' && (fl < 14 || fd < 10)) k = 'shops';
    if ((k === 'eat' || k === 'cafe') && (w < 8.5 || l > 42)) k = d === 'downtown' ? 'tower' : 'shops';
    if (k === 'hotel' && w < 12) k = 'apart';
    if (k === 'tanks' && w < 16) k = 'ware';
    if (k === 'garage' && w < 14) k = 'tower';
    if (k === 'plaza' && (w < 14 || l > 40)) k = 'tower';
    if (k === 'houses' && fd < 10) k = 'shops';
    count[k] = (count[k] || 0) + 1;
    if (k === 'tower') tower(ch, r, faces, d, d === 'downtown' ? 26 + Math.pow(rnd(), 1.6) * 120 : d === 'harbor' ? 9 + rnd() * 9 : d === 'shore' ? 8 + rnd() * 12 : 10 + rnd() * 24);
    else if (k === 'eat') eatery(ch, r, faces, d, false); else if (k === 'cafe') eatery(ch, r, faces, d, true);
    else if (k === 'shops') shops(ch, r, faces, d); else if (k === 'houses') houses(ch, r, faces, d); else if (k === 'apart') apart(ch, r, faces, d);
    else if (k === 'hotel') hotel(ch, r, faces, d); else if (k === 'gas') gas(ch, r, faces); else if (k === 'garage') garage(ch, r, faces);
    else if (k === 'cinema') cinema(ch, r, faces, d); else if (k === 'hall') hall(ch, r, faces[0], pick(POOL.hall), false);
    else if (k === 'ware') ware(ch, r, faces, d); else if (k === 'tanks') tanks(ch, r); else plaza(ch, r);
  };

  // the grid's cells; where a street segment was left out (GAPS) the cells on either side run together
  const aveX = [-400, 0, 400], aveZ = [-400, 0, 300];
  const halfX = (x) => (aveX.includes(x) ? 8 : 5.5), halfZ = (z) => (z === 640 ? 10 : aveZ.includes(z) ? 8 : 5.5);
  const gapAt = (axis, v, lo, hi) => (GAPS[axis][v] || []).some(([a, b]) => a <= lo && b >= hi);
  const inSpecial = (x, z) => SPECIALS.find((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
  for (let i = 0; i < XL.length - 1; i++) for (let j = 0; j < ZB.length - 1; j++) {
    const X0 = XL[i], X1 = XL[i + 1], Z0 = ZB[j], Z1 = ZB[j + 1];
    if (inSpecial((X0 + X1) / 2, (Z0 + Z1) / 2)) continue;
    const open = { w: gapAt('x', X0, Z0, Z1), e: gapAt('x', X1, Z0, Z1), n: gapAt('z', Z0, X0, X1), s: gapAt('z', Z1, X0, X1) };
    const b = { x0: X0 + (open.w ? 0 : halfX(X0)), x1: X1 - (open.e ? 0 : halfX(X1)), z0: Z0 + (open.n ? 0 : halfZ(Z0)), z1: Z1 - (open.s ? 0 : halfZ(Z1)), open };
    b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
    const d = districtOf(b.cx, b.cz), isPark = d !== 'downtown' && d !== 'harbor' && rnd() < 0.09;
    const ch = chunkOf(b.cx, b.cz).city;
    ch.box(b.x0, b.z0, b.x1, b.z1, 0, 0.16, C_SLAB, W0, isPark ? C_GRASS : SLAB_TOP[d], 0, 0, true);
    mm.push({ k: isPark ? 'park' : 'block', x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 });
    const ix0 = b.x0 + (open.w ? 2.5 : 5), iz0 = b.z0 + (open.n ? 2.5 : 5), ix1 = b.x1 - (open.e ? 2.5 : 5), iz1 = b.z1 - (open.s ? 2.5 : 5);
    if (isPark) { park(ch, [ix0, iz0, ix1, iz1], null); continue; }
    const target = { downtown: 34, west: 21, north: 24, shore: 20, harbor: 52 }[d] * (0.85 + rnd() * 0.45);
    const nx = Math.max(1, Math.round((ix1 - ix0) / target)), nz = Math.max(1, Math.round((iz1 - iz0) / target));
    const lw = (ix1 - ix0) / nx, lz = (iz1 - iz0) / nz;
    const yard = d === 'harbor' && rnd() < 0.4;
    for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
      const faces = [];
      const lx0 = ix0 + a * lw, lz0 = iz0 + c * lz, m = d === 'downtown' ? 1 + rnd() * 3 : 1.2 + rnd() * 2.2;
      const r = [lx0 + m, lz0 + m, lx0 + lw - m * (0.6 + rnd()), lz0 + lz - m * (0.6 + rnd())];
      if (c === 0 && !open.n) faces.push(['z', r[1], -1, r[0], r[2]]); if (c === nz - 1 && !open.s) faces.push(['z', r[3], 1, r[0], r[2]]);
      if (a === 0 && !open.w) faces.push(['x', r[0], -1, r[1], r[3]]); if (a === nx - 1 && !open.e) faces.push(['x', r[2], 1, r[1], r[3]]);
      // buildings only on lots that face a street; the hidden middle of big blocks is a yard with parked cars
      if (!faces.length) { if (r[2] - r[0] > 12 && r[3] - r[1] > 12 && rnd() < 0.5) carPark(ch, r, 0.3); continue; }
      if (r[2] - r[0] < 6 || r[3] - r[1] < 6) continue;
      if (nearSky(r[0], r[1], r[2], r[3], 16)) { carPark(ch, r, 0.35); continue; }
      if (yard) { // stacked shipping containers in rows with aisles
        for (let x = r[0]; x + 12.2 <= r[2]; x += 13.4) for (let z = r[1]; z + 2.44 <= r[3]; z += 2.6) {
          if (Math.floor((z - r[1]) / 2.6) % 4 === 3) continue;
          const hgt = 1 + Math.floor(rnd() * 4);
          for (let h = 0; h < hgt; h++) ch.box(x, z, x + 12.2, z + 2.44, h * 2.6, h * 2.6 + 2.58, pick(CONT), W0, pick(CONT));
          rect(x, z, x + 12.2, z + 2.44);
        }
        continue;
      }
      faces.sort(() => rnd() - 0.5);
      buildLot(ch, r, faces, d);
    }
  }

  // --- landmarks that take a whole superblock ---
  for (const s of SPECIALS) {
    const x0 = s.x0 + halfX(s.x0), x1 = s.x1 - halfX(s.x1), z0 = s.z0 + halfZ(s.z0), z1 = s.z1 - halfZ(s.z1), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ch = chunkOf(cx, cz).city;
    if (s.k === 'park') { // Central Park with the Neon Bay Museum on its north side
      ch.box(x0, z0, x1, z1, 0, 0.16, C_SLAB, W0, C_GRASS, 0, 0, true); mm.push({ k: 'park', x0, z0, x1, z1 });
      const mr = [cx - 34, z0 + 9, cx + 34, z0 + 9 + 36];
      bp(ch, [mr[0] - 4, mr[1] - 3, mr[2] + 4, mr[3] + 14], 0.16, 0.22, lin('#34343c'));
      hall(ch, mr, ['z', mr[3], 1, mr[0], mr[2]], 'MUSEUM', true);
      park(ch, [x0 + 5, z0 + 5, x1 - 5, z1 - 5], (x, z) => x > mr[0] - 8 && x < mr[2] + 8 && z < mr[3] + 16);
    } else if (s.k === 'fair') { // the Boardwalk funfair: big wheel, carousel, food stalls, a car park
      ch.box(x0, z0, x1, z1, 0, 0.16, C_SLAB, W0, lin('#3b352e'), 0, 0, true); mm.push({ k: 'block', x0, z0, x1, z1 });
      const wx = cx + 28, wz = cz - 8, R = 22, HY = 26, pink = NEON[0], cyan = NEON[1], N = 28;
      bp(ch, [wx - 9, wz - 3.2, wx + 9, wz + 3.2], 0.16, 1.1, C_UNIT, W0, C_UNIT2); solid([wx - 9, wz - 3.2, wx + 9, wz + 3.2]);
      for (const dz of [-1.5, 1.5]) {
        const z = wz + dz;
        for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, b2 = (k + 1) / N * Math.PI * 2, P = (ang, rr) => [wx + Math.cos(ang) * rr, HY + Math.sin(ang) * rr, z]; ch.quad(P(a, R - 0.35), P(b2, R - 0.35), P(b2, R + 0.35), P(a, R + 0.35), pink, Z4, glowW(pink), null); ch.quad(P(a, R * 0.55 - 0.15), P(b2, R * 0.55 - 0.15), P(b2, R * 0.55 + 0.15), P(a, R * 0.55 + 0.15), cyan, Z4, glowW(cyan), null); }
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); ch.quad([wx - sn * 0.12, HY + c * 0.12, z], [wx + sn * 0.12, HY - c * 0.12, z], [wx + c * R + sn * 0.12, HY + sn * R - c * 0.12, z], [wx + c * R - sn * 0.12, HY + sn * R + c * 0.12, z], cyan, Z4, dim(cyan, 0.45), null); }
        for (const sx of [-1, 1]) ch.quad([wx + sx * 8.6 - 0.45, 1.1, z + dz * 0.8], [wx + sx * 8.6 + 0.45, 1.1, z + dz * 0.8], [wx + 0.45, HY, z + dz * 0.5], [wx - 0.45, HY, z + dz * 0.5], C_WHITE, Z4, dim(C_WHITE, 0.05), null);
      }
      bp(ch, [wx - 0.9, wz - 2.2, wx + 0.9, wz + 2.2], HY - 0.9, HY + 0.9, C_WHITE, dim(pink, 0.4), C_WHITE);
      for (let k = 0; k < 14; k++) { const a = (k + 0.5) / 14 * Math.PI * 2, x = wx + Math.cos(a) * R, y = HY + Math.sin(a) * R, c = pick(AWN); ch.box(x - 1.1, wz - 1.1, x + 1.1, wz + 1.1, y - 2.7, y - 0.5, c, dim(c, 0.3), c); }
      // carousel
      { const x = cx - 26, z = cz - 14, c = pick(AWN); prism(ch, x, z, 6, 12, 0.16, 0.7, C_STONE, W0, C_WOOD, 6); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, px = x + 5.2 * Math.cos(a), pz = z + 5.2 * Math.sin(a); ch.box(px - 0.08, pz - 0.08, px + 0.08, pz + 0.08, 0.7, 4, C_LAMP, dim(C_LAMP, 0.4), C_LAMP, 0, 0, false); ch.box(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35, 1.2, 2.1, pick(AWN), W0, C_WHITE); } prism(ch, x, z, 6.8, 12, 4, 7, c, dim(c, 0.2), c, 0.3); prism(ch, x, z, 6.82, 12, 3.75, 4.02, C_LAMP, glowW(C_LAMP), C_LAMP, 6.82); prism(ch, x, z, 1, 8, 0.7, 4, C_WHITE, dim(pink, 0.3)); pools.push([x, z, 4, 0]); circ(x, z, 6.2); mm.push({ k: 'bld', x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6 }); }
      // a street of food stalls facing each other
      const names = ['ICE CREAM', 'DONUTS', 'KEBAB', 'SAMSA', 'COFFEE', 'PLOV HOUSE', 'BURGERS', 'TACOS', 'TEA HOUSE', 'BBQ'];
      for (let k = 0; k < 10; k++) { const sx = x0 + 14 + (k >> 1) * 13, sg = k % 2 ? 1 : -1, zc = cz + 30 + sg * 7.5, r = [sx - 2.6, zc - 1.8, sx + 2.6, zc + 1.8], f = ['z', sg > 0 ? r[1] : r[3], -sg, r[0], r[2]], c = pick(EAT_COL), aw = pick(AWN); bp(ch, r, 0.16, 3.1, c, dim(c, 0.03), C_ROOF); panel(ch, f, r[0] + 0.3, r[2] - 0.3, 1.1, 2.5, SHOPGLOW, dim(SHOPGLOW, 0.45)); awning(ch, f, r[0], r[2], 3.1, 1.5, aw); signOn(f, sx, 2.3, 3.2, 4.3, SI(names[k])); solid(r); if (k % 2 === 0 && k < 8) table(ch, sx + 6.5, cz + 30, aw); }
      bulbs(ch, x0 + 10, cz + 30, x0 + 76, cz + 30, 5.2); for (const x of [x0 + 10, x0 + 76]) { ch.box(x - 0.08, cz + 29.92, x + 0.08, cz + 30.08, 0.16, 5.2, C_POLE, W0, C_POLE, 0, 0, false); circ(x, cz + 30, 0.25); }
      bp(ch, [x0 + 96, cz + 12, x1 - 8, z1 - 8], 0.16, 0.2, C_LOT); carPark(ch, [x0 + 96, cz + 12, x1 - 8, z1 - 8], 0.45);
      for (let x = x0 + 8; x < x1 - 4; x += 16) for (const z of [z0 + 5, z1 - 5]) if (Math.abs(x - wx) > 12 || z > cz) palm(x, z);
      for (const [x, z] of [[cx - 5, cz - 12], [cx - 5, cz + 12], [x0 + 12, cz - 30], [cx + 50, cz + 4]]) globe(ch, x, z, 4);
    } else { // Northgate Mall and its car park
      ch.box(x0, z0, x1, z1, 0, 0.16, C_SLAB, W0, C_LOT, 0, 0, true); mm.push({ k: 'block', x0, z0, x1, z1 });
      const r = [x0 + 8, z0 + 7, x1 - 8, z0 + 7 + 46], f = ['z', r[3], 1, r[0], r[2]], st = mkStyle('downtown', 0.05, TINTS.white), mid = (r[0] + r[2]) / 2, H = 12.5;
      st.col = lin('#3a3f52'); bx(ch, r, 0.16, H, st, C_ROOF); roofRim(ch, r, H, NEON[6]); roofUnits(ch, r, H, 6);
      panel(ch, f, r[0] + 6, r[2] - 6, 0.5, 8.2, lin('#dfeaff'), dim(lin('#dfeaff'), 0.24));
      const cr = fr(f, mid - 12, mid + 12, 0, 5); bp(ch, cr, 5.2, 5.9, C_WHITE, W0, C_WHITE); ch.quad([cr[0], 5.18, cr[1]], [cr[2], 5.18, cr[1]], [cr[2], 5.18, cr[3]], [cr[0], 5.18, cr[3]], C_WHITE, Z4, dim(SHOPGLOW, 0.32), [0, -1, 0]);
      for (const a of [mid - 11.4, mid - 4, mid + 4, mid + 11.4]) { const p = pt(f, a, 4.6); ch.box(p[0] - 0.22, p[1] - 0.22, p[0] + 0.22, p[1] + 0.22, 0.16, 5.2, C_WHITE, W0, C_WHITE, 0, 0, false); circ(p[0], p[1], 0.35); }
      signOn([f[0], f[1] + 5, f[2], 0, 0], mid, 7, 6.1, 9.1, SI('MALL'), 0.05);
      ['SUPERMARKET', 'CINEMA', 'FASHION', 'ELECTRONICS', 'BOOKS', 'GYM', 'PHARMACY', 'BOWLING'].forEach((n, k) => { const a = r[0] + 14 + k * ((r[2] - r[0] - 28) / 7); if (Math.abs(a - mid) > 15) signOn(f, a, 3.4, 8.6, 10.4, SI(n)); });
      for (const g of [['x', r[0], -1, r[1], r[3]], ['x', r[2], 1, r[1], r[3]], ['z', r[1], -1, r[0], r[2]]]) { const c = pick(NEON); panel(ch, g, g[3] + 3, g[4] - 3, 9.6, 10.1, c, glowW(c)); }
      solid(r);
      const lot = [x0 + 8, r[3] + 12, x1 - 8, z1 - 6]; carPark(ch, lot, 0.5);
      for (let x = lot[0] + 20; x < lot[2] - 10; x += 44) for (let z = lot[1] + 5.6; z < lot[3] - 4; z += 23) lamp(x, z, 1, 0, 9, 2.4);
      for (let x = x0 + 6; x < x1 - 4; x += 15) tree(x, z1 - 3);
    }
  }
  world.kinds = count;

  mark();
  // --- harbor pier with gantry cranes, beach palms ---
  const C_PIER = lin('#2a2a30'), C_CRANE = lin('#8a3a1c'), RED = lin('#ff2030');
  chunkOf(630, 715).city.box(460, 650, 800, 780, -0.4, 0.16, C_PIER, W0, C_PIER);
  mm.push({ k: 'block', x0: 460, z0: 650, x1: 800, z1: 780 });
  for (const cx of [520, 630, 740]) {
    const ch = chunkOf(cx, 760).city;
    for (const [lx, lz] of [[-8, 740], [8, 740], [-8, 770], [8, 770]]) { ch.box(cx + lx - 0.6, lz - 0.6, cx + lx + 0.6, lz + 0.6, 0, 34, C_CRANE, W0, C_CRANE); circ(cx + lx, lz, 0.9); }
    ch.box(cx - 9, 738, cx + 9, 772, 34, 37, C_CRANE, W0, C_CRANE);
    ch.box(cx - 1.5, 700, cx + 1.5, 830, 36, 38, C_CRANE, W0, C_CRANE);
    ch.box(cx - 0.5, 829, cx + 0.5, 830, 38, 39, RED, glowW(RED), RED);
    ch.box(cx - 0.5, 700, cx + 0.5, 701, 38, 39, RED, glowW(RED), RED);
  }
  for (let x = 470; x < 790; x += 19) for (let z = 712; z < 735; z += 2.7) if (rnd() < 0.35) { const h = 1 + Math.floor(rnd() * 3); for (let k = 0; k < h; k++) chunkOf(x, z).city.box(x, z, x + 12.2, z + 2.44, 0.16 + k * 2.6, 0.16 + k * 2.6 + 2.58, pick(CONT), W0, pick(CONT)); rect(x, z, x + 12.2, z + 2.44); }
  for (let x = -880; x < 900; x += 22 + rnd() * 10) if (x < 450 || x > 810) palm(x + rnd() * 6, 662 + rnd() * 28);

  // --- billboards facing the ring highway, trees in the green belt and beyond ---
  const ring = roads.find((r) => r.ring);
  for (let s = 60; s < ring.len; s += 170) {
    const p = rPoint(ring, s); if (p.z > 600 || inTunnel(p.x, p.z, 20)) continue;
    const nx = p.tz, nz = -p.tx; // outward
    const bx = p.x + nx * 18, bz = p.z + nz * 18, ang = Math.atan2(p.tz, p.tx), nc = pick(NEON);
    const ch = chunkOf(bx, bz).city;
    for (const o of [-5, 5]) { ch.box(bx + p.tx * o - 0.25, bz + p.tz * o - 0.25, bx + p.tx * o + 0.25, bz + p.tz * o + 0.25, 0, 8, C_POLE, W0, C_POLE, 0, 0, false); circ(bx + p.tx * o, bz + p.tz * o, 0.4); }
    ch.obox(bx, bz, ang, 7.5, 0.3, 8, 13, C_POLE, W0);
    signs.push({ x: bx - nx * 0.35, z: bz - nz * 0.35, tx: p.tx, tz: p.tz, half: 7.2, y0: 8.2, y1: 12.8, panel: pick([0, 1, 3, 4, 5, 6, 7]) });
    void nc;
  }
  for (let i = 0; i < 520; i++) {
    const x = (rnd() - 0.5) * 1960, z = -980 + rnd() * 1620;
    const inGrid = x > -806 && x < 806 && z > -806 && z < 650;
    if (inGrid || nearRoad(x, z, 6) || inTunnel(x, z, 2) || (Math.abs(z + 900) < 40 && Math.abs(x) < 640)) continue;
    tree(x, z);
  }

  // --- pillars under the viaduct and the bridge; bridge towers with lit stay cables ---
  const C_PIL = lin('#26262e'), C_TOWER = lin('#3a3c48'), C_CABLE = lin('#cfe6ff');
  for (const r of roads) if (r.hAt) for (let s = 16; s < r.len - 8; s += 32) {
    const h = r.hAt(s); if (h < 3) continue;
    const p = rPoint(r, s), twin = !!r.isBridge;
    for (const lat of twin ? [-5, 5] : [0]) {
      const x = p.x - p.tz * lat, z = p.z + p.tx * lat, pr = twin ? 1.3 : 1.7;
      if (!twin && nearRoad(x, z, 1.5, r)) continue; // never plant a pillar in a street below
      chunkOf(x, z).city.box(x - pr, z - pr, x + pr, z + pr, -1, h - 1.2, C_PIL, W0, C_PIL, 0, 0, false);
      if (z < 705) circ(x, z, pr + 0.2);
    }
  }
  // suspension bridge: two towers, lit main cables sagging between them, vertical hangers
  const TOPY = (tz) => bridgeH(tz) + 40, CX = 9.3;
  for (const tz of [800, 955]) for (const sx of [-1, 1]) {
    const x = -200 + sx * CX, ch = chunkOf(x, tz).city, top = TOPY(tz);
    ch.box(x - 1.1, tz - 1.6, x + 1.1, tz + 1.6, -1, top, C_TOWER, W0, C_TOWER);
    ch.box(x - 0.4, tz - 0.4, x + 0.4, tz + 0.4, top, top + 0.8, RED, glowW(RED), RED);
    if (sx < 0) for (const yy of [top - 1, bridgeH(tz) + 19]) ch.box(-200 - CX - 1.1, tz - 1.1, -200 + CX + 1.1, tz + 1.1, yy - 2.2, yy, C_TOWER, W0, C_TOWER);
  }
  const SUP = [[690, bridgeH(690) + 1.5], [800, TOPY(800)], [955, TOPY(955)], [1070, bridgeH(1070) + 1.5]];
  const cableY = (z) => {
    for (let i = 1; i < SUP.length; i++) if (z <= SUP[i][0]) {
      const [za, ya] = SUP[i - 1], [zb, yb] = SUP[i], u = (z - za) / (zb - za), sag = i === 2 ? 30 : 7;
      return ya + (yb - ya) * u - sag * 4 * u * (1 - u);
    }
    return SUP[SUP.length - 1][1];
  };
  const CW = [C_CABLE[0] * 0.55, C_CABLE[1] * 0.55, C_CABLE[2] * 0.55, 1], CHG = [C_CABLE[0] * 0.25, C_CABLE[1] * 0.25, C_CABLE[2] * 0.25, 1];
  for (const sx of [-1, 1]) {
    const x = -200 + sx * CX;
    for (let z = 690; z < 1070; z += 5) { const y0 = cableY(z), y1 = cableY(z + 5), ch = chunkOf(x, z + 2.5).city; ch.quad([x, y0 - 0.16, z], [x, y1 - 0.16, z + 5], [x, y1 + 0.16, z + 5], [x, y0 + 0.16, z], C_CABLE, Z4, CW, [sx, 0, 0]); }
    for (let z = 700; z < 1066; z += 10) { if (Math.abs(z - 800) < 3 || Math.abs(z - 955) < 3) continue; const ch = chunkOf(x, z).city, yb = bridgeH(z) + 0.6, yt = cableY(z); if (yt - yb < 1) continue; ch.quad([x, yb, z - 0.06], [x, yb, z + 0.06], [x, yt, z + 0.06], [x, yt, z - 0.06], C_CABLE, Z4, CHG, [sx, 0, 0]); }
  }
  // marina east of the pier: wooden docks with moored boats; a few boats off the pier and the beach
  {
    const C_DOCK = lin('#4a3a2e'), BH = lin('#e8e8ee'), BS = [lin('#1f4a7a'), lin('#7a1f2b'), lin('#2a6a5a'), lin('#d8d0c0')], hull = new THREE.Shape([[-4, -1.3], [2.4, -1.3], [4.4, 0], [2.4, 1.3], [-4, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)));
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 1.1, bevelEnabled: false }); hg.rotateX(-Math.PI / 2);
    const cg = new THREE.BoxGeometry(2.6, 1, 1.8); cg.translate(-0.8, 1.6, 0);
    const mg = new THREE.BoxGeometry(0.12, 7, 0.12); mg.translate(0.4, 4.6, 0);
    const boat = (x, z, ry, sail) => { const c = pick(BS); place(hg, x, z, ry, 1, c, -0.55); place(cg, x, z, ry, 1, BH, -0.55); if (sail) place(mg, x, z, ry, 1, BH, -0.55); };
    for (const dx of [830, 872, 914]) {
      const ch = chunkOf(dx, 740).city; ch.box(dx - 1.4, 705, dx + 1.4, 790, -0.6, 0.3, C_DOCK, W0, C_DOCK);
      for (let z = 716; z < 785; z += 13) for (const s of [-1, 1]) if (rnd() < 0.75) boat(dx + s * 4.4, z + rnd() * 3, Math.PI / 2 + (rnd() - 0.5) * 0.1, rnd() < 0.4);
    }
    for (let x = 480; x < 790; x += 48) boat(x + rnd() * 10, 800 + rnd() * 8, rnd() * 0.3, false);
    for (let i = 0; i < 6; i++) boat(-760 + i * 90 + rnd() * 30, 740 + rnd() * 50, rnd() * Math.PI * 2, true);
  }
  mm.push({ k: 'deck', x0: -208, z0: 650, x1: -192, z1: 1092 });

  // --- tunnel: the ring's west side runs under a long grassy berm ---
  {
    const T = TUNNEL, C_TW = lin('#2c2b30'), C_BERM = lin('#0f1a12'), SOD = lin('#ffb060'), C_PORT = lin('#3a3a44');
    for (let z = T.z0; z < T.z1; z += 20) {
      const z1 = Math.min(T.z1, z + 20), c = chunkOf(T.x, z + 10).city;
      for (const sg of [-1, 1]) {
        const xi = T.x + sg * T.half;
        c.quad([xi, 0, z], [xi, 0, z1], [xi, T.roof, z1], [xi, T.roof, z], C_TW, Z4, W0, [-sg, 0, 0]);
        c.quad([xi, T.roof + 1, z], [xi, T.roof + 1, z1], [T.x + sg * 42, 0, z1], [T.x + sg * 42, 0, z], C_BERM, Z4, W0, [sg, 1, 0]);
        const xl = xi - sg * 0.05;
        c.quad([xl, T.roof - 0.6, z], [xl, T.roof - 0.6, z1], [xl, T.roof - 0.35, z1], [xl, T.roof - 0.35, z], SOD, Z4, [SOD[0], SOD[1], SOD[2], 1], [-sg, 0, 0]);
      }
      c.quad([T.x - T.half, T.roof, z], [T.x + T.half, T.roof, z], [T.x + T.half, T.roof, z1], [T.x - T.half, T.roof, z1], C_TW, Z4, W0, [0, -1, 0]);
      c.quad([T.x - T.half, T.roof + 1, z], [T.x + T.half, T.roof + 1, z], [T.x + T.half, T.roof + 1, z1], [T.x - T.half, T.roof + 1, z1], C_BERM, Z4, W0, [0, 1, 0]);
    }
    for (const [z, sg] of [[T.z0, -1], [T.z1, 1]]) {
      const c = chunkOf(T.x, z).city;
      c.quad([T.x - T.half - 1, T.roof, z], [T.x + T.half + 1, T.roof, z], [T.x + T.half + 1, T.roof + 1.4, z], [T.x - T.half - 1, T.roof + 1.4, z], C_PORT, Z4, W0, [0, 0, sg]);
      for (const sx of [-1, 1]) c.quad([T.x + sx * T.half, 0, z], [T.x + sx * T.half, T.roof + 1, z], [T.x + sx * 42, 0, z], [T.x + sx * 42, 0, z], C_BERM, Z4, W0, [0, 0, sg]);
    }
    for (let z = T.z0 + 8; z < T.z1; z += 16) pools.push([T.x - 4, z, 6, 0], [T.x + 4, z + 8, 6, 0]);
    rect(T.x - 44, T.z0, T.x - T.half - 0.4, T.z1); rect(T.x + T.half + 0.4, T.z0, T.x + 44, T.z1);
    for (let i = 0; i < 18; i++) { const dx = 14 + rnd() * 24, sg = rnd() < 0.5 ? -1 : 1; tree(T.x + sg * dx, T.z0 + 10 + rnd() * (T.z1 - T.z0 - 20), 8 * (42 - dx) / (42 - T.half)); }
    mm.push({ k: 'tunnel', x0: T.x - 12, z0: T.z0, x1: T.x + 12, z1: T.z1 });
  }

  // --- the island: loop road, drift arena with floodlights, palms and a lighthouse ---
  const ISLE = { x0: -470, z0: 1075, x1: 70, z1: 1300 }, ARENA = [-380, 1132, -20, 1228];
  {
    const c = chunkOf(-200, 1180), A = ARENA;
    c.road.quad([A[0], 0.05, A[1]], [A[2], 0.05, A[1]], [A[2], 0.05, A[3]], [A[0], 0.05, A[3]], W0, [[0, rowV(3, 0.05)], [22, rowV(3, 0.05)], [22, rowV(3, 0.95)], [0, rowV(3, 0.95)]], W0, [0, 1, 0]);
    const CONE = lin('#ff7a1a');
    for (let x = A[0] + 6; x < A[2]; x += 12) for (const z of [A[1] + 3, A[3] - 3]) chunkOf(x, z).city.box(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, 0.7, CONE, [CONE[0], CONE[1], CONE[2], 1], CONE);
    for (const [x, z] of [[A[0], A[1]], [A[2], A[1]], [A[0], A[3]], [A[2], A[3]]]) {
      const ch = chunkOf(x, z).city; ch.box(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, 16, C_POLE, W0, C_POLE, 0, 0, false);
      ch.box(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 16, 16.6, C_LAMP, glowW(C_LAMP), C_LAMP); circ(x, z, 0.4);
      for (let k = 0; k < 3; k++) pools.push([x + (x < -200 ? 9 : -9) * (k + 0.6), z + (z < 1180 ? 6 : -6) * (k + 0.6), 16, 0]);
    }
    const LH = [45, 1282], chL = chunkOf(LH[0], LH[1]).city, LW = lin('#c8c8cc'), LR = lin('#a01c24'), LL = lin('#ffe9b0');
    for (let k = 0; k < 6; k++) { const r0 = 3.2 - k * 0.3, y0 = k * 4.5; chL.box(LH[0] - r0, LH[1] - r0, LH[0] + r0, LH[1] + r0, y0, y0 + 4.5, k % 2 ? LR : LW, W0, k % 2 ? LR : LW); }
    chL.box(LH[0] - 1.6, LH[1] - 1.6, LH[0] + 1.6, LH[1] + 1.6, 27, 29.5, LL, glowW(LL), lin('#2a2a30'));
    rect(LH[0] - 3.4, LH[1] - 3.4, LH[0] + 3.4, LH[1] + 3.4);
    for (let i = 0; i < 90; i++) {
      const x = ISLE.x0 + 8 + rnd() * (ISLE.x1 - ISLE.x0 - 16), z = ISLE.z0 + 8 + rnd() * (ISLE.z1 - ISLE.z0 - 16);
      if ((x > A[0] - 4 && x < A[2] + 4 && z > A[1] - 4 && z < A[3] + 4) || nearRoad(x, z, 3) || Math.hypot(x - LH[0], z - LH[1]) < 8) continue;
      palm(x, z);
    }
    mm.push({ k: 'isle', x0: ISLE.x0, z0: ISLE.z0, x1: ISLE.x1, z1: ISLE.z1 }, { k: 'arena', x0: A[0], z0: A[1], x1: A[2], z1: A[3] });
  }

  // --- the Raven RS garage sign on Westside's x = -100 street ---
  {
    const gx = -91, gz = 250, ch = chunkOf(gx, gz).city;
    ch.box(gx - 0.25, gz - 0.25, gx + 0.25, gz + 0.25, 0, 7, C_POLE, W0, C_POLE, 0, 0, false); circ(gx, gz, 0.4);
    signs.push({ x: gx, z: gz, tx: 0, tz: 1, half: 4, y0: 7, y1: 11, panel: 2 });
  }

  // --- collision: buildings are in; add the sea (with the pier and the island cut out) and the edge of the world ---
  rect(-1030, 705, -470, 1330); rect(-470, 705, 70, 1075); rect(-470, 1300, 70, 1330); rect(70, 705, 460, 1330); rect(460, 785, 800, 1330); rect(800, 705, 1030, 1330);
  rect(-1030, -1030, -985, 1330); rect(985, -1030, 1030, 1330); rect(-1030, -1030, 1030, -985);

  mark();
  // --- meshes ---
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const cityMat = cityMaterial(windowData());
  const roadMat = new THREE.MeshStandardMaterial({ map: roadAtlas(), roughness: 0.78, metalness: 0.0, envMapIntensity: 0.8 });
  roadMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = diffuseColor.rgb * 0.8 + 0.13;'); }; // the atlas is painted very dark; lift it so the street reads against the kerbs
  const cmeshes = [];
  for (const c of chunks.values()) {
    const g = new THREE.Group(); g.userData.cx = c.x; g.userData.cz = c.z;
    const baseMesh = c.city.v ? c.city.mesh(cityMat) : null; if (baseMesh) g.add(baseMesh);
    g.userData.tiers = c.city.tiers.map((t) => { if (!t.v) return null; const f = t.mesh(cityMat); g.add(f); return f; });
    c.meshes = [baseMesh, ...g.userData.tiers]; // same order as the ranges recorded by knockable()
    if (c.road.v) g.add(c.road.mesh(roadMat, false));
    group.add(g); cmeshes.push(g);
  }
  mark();
  // pools of lamp light on the road: one additive mesh for the whole map
  const pb = new GeoBuf();
  for (const [x, z, , y0 = 0] of pools) { const h = 5.5, y = y0 + 0.08; pb.quad([x - h, y, z - h], [x + h, y, z - h], [x + h, y, z + h], [x - h, y, z + h], W0, [[0, 0], [1, 0], [1, 1], [0, 1]], W0, [0, 1, 0]); }
  const poolMesh = pb.mesh(new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,190,120,0.12)', 'rgba(255,170,90,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), false);
  poolMesh.renderOrder = 2; group.add(poolMesh);
  // land, beach, sea
  const land = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2700), new THREE.MeshStandardMaterial({ color: '#101117', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }));
  land.rotation.x = -Math.PI / 2; land.position.set(0, 0, 705 - 1350); group.add(land);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(2000, 55), new THREE.MeshStandardMaterial({ color: '#4a3b36', roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.02, 677.5); group.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1800), new THREE.MeshStandardMaterial({ color: '#081428', roughness: 0.06, metalness: 0.65, envMapIntensity: 1.05 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.35, 705 + 900); group.add(sea);
  const isleG = new THREE.Mesh(new THREE.PlaneGeometry(ISLE.x1 - ISLE.x0, ISLE.z1 - ISLE.z0), new THREE.MeshStandardMaterial({ color: '#111a13', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }));
  isleG.rotation.x = -Math.PI / 2; isleG.position.set((ISLE.x0 + ISLE.x1) / 2, 0, (ISLE.z0 + ISLE.z1) / 2); group.add(isleG);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(ISLE.x1 - ISLE.x0 + 30, ISLE.z1 - ISLE.z0 + 30), beach.material);
  sand.rotation.x = -Math.PI / 2; sand.position.set((ISLE.x0 + ISLE.x1) / 2, -0.1, (ISLE.z0 + ISLE.z1) / 2); group.add(sand);
  // text billboards: one atlas, three meshes by how the sign is lit (neon tubes, backlit boxes, painted boards)
  const sbufs = { neon: new GeoBuf(), box: new GeoBuf(), paint: new GeoBuf() };
  for (const g of signs) {
    const sbuf = sbufs[g.shop !== undefined ? SIGN_KIND[g.shop] : BILLBOARDS[g.panel][2]];
    let u0, u1, v0, v1;
    if (g.shop !== undefined) { const c = g.shop % 4, r = g.shop >> 2; u0 = c * 0.25 + 0.002; u1 = u0 + 0.246; v0 = (1024 + r * 64 + 1) / 2048; v1 = v0 + 62 / 2048; }
    else { const c = g.panel % 2, r = g.panel >> 1; u0 = c * 0.5 + 0.004; u1 = u0 + 0.492; v0 = (r * 256 + 2) / 2048; v1 = v0 + 252 / 2048; }
    const a = [g.x - g.tx * g.half, g.y0, g.z - g.tz * g.half], b = [g.x + g.tx * g.half, g.y0, g.z + g.tz * g.half];
    sbuf.quad(a, b, [b[0], g.y1, b[2]], [a[0], g.y1, a[2]], W0, [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], W0, null);
  }
  const sAt = signAtlas();
  const sMat = {
    neon: new THREE.MeshBasicMaterial({ map: sAt, color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide }),
    box: new THREE.MeshBasicMaterial({ map: sAt, color: new THREE.Color(1.05, 1.05, 1.05), side: THREE.DoubleSide }),
    paint: new THREE.MeshStandardMaterial({ map: sAt, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
  };
  for (const k of Object.keys(sbufs)) if (sbufs[k].v) group.add(sbufs[k].mesh(sMat[k], false));
  // traffic-light heads change colour, so they are one instanced mesh
  const sigMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), Math.max(1, sigHeads.length));
  sigHeads.forEach((h, i) => { tm4.makeTranslation(h.x, 5.05, h.z); sigMesh.setMatrixAt(i, tm4); sigMesh.setColorAt(i, new THREE.Color(1, 0, 0)); });
  sigMesh.instanceMatrix.needsUpdate = true; sigMesh.computeBoundingSphere(); group.add(sigMesh);
  // the lighthouse sweeps two beams over the sea
  const beamPivot = new THREE.Group(); beamPivot.position.set(45, 28.2, 1282); group.add(beamPivot);
  const bg = new THREE.ConeGeometry(10, 150, 18, 1, true); bg.translate(0, -75, 0); bg.rotateZ(Math.PI / 2);
  const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a0').multiplyScalar(0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const r of [0, Math.PI]) { const m = new THREE.Mesh(bg, bm); m.rotation.y = r; beamPivot.add(m); }
  // sky, moon and hills ride with the camera
  const far = new THREE.Group(); group.add(far);
  const skyT = skyTexture([[0, '#16234f'], [0.22, '#2f4686'], [0.36, '#6f6aa6'], [0.44, '#c98a92'], [0.485, '#ffb37a'], [0.5, '#ffd09a'], [0.507, '#8a7078'], [1, '#4a4048']]);
  const SUN = new THREE.Vector3(-0.78, 0.2, 0.42).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(820, 32, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -2; far.add(sky);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(3), fog: false, depthWrite: false }));
  moon.position.copy(SUN).multiplyScalar(770); moon.lookAt(0, 0, 0); moon.renderOrder = -1; far.add(moon);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,176,110,0.75)', 'rgba(255,140,90,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.copy(SUN).multiplyScalar(765); halo.lookAt(0, 0, 0); halo.renderOrder = -1; far.add(halo);
  {
    // a ring of low-poly mountains (low over the sea to the south), dotted with hillside lights
    const pos = [], R0 = 735, N = 200, ridge = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2, south = Math.max(0, Math.sin(a)), k = 1 - Math.min(1, south * 1.25);
      ridge.push(k * (55 + 75 * Math.abs(Math.sin(a * 3.1 + 1.3)) + 45 * Math.abs(Math.sin(a * 7.7 + 0.4)) + 18 * rnd()));
    }
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, rt = R0 - 60;
      const b0 = [Math.cos(a0) * R0, -20, Math.sin(a0) * R0], b1 = [Math.cos(a1) * R0, -20, Math.sin(a1) * R0];
      const t0 = [Math.cos(a0) * rt, ridge[i], Math.sin(a0) * rt], t1 = [Math.cos(a1) * rt, ridge[i + 1], Math.sin(a1) * rt];
      pos.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1);
    }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.computeVertexNormals();
    const mtn = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: '#5a5a80', emissive: '#2a2438', roughness: 1, flatShading: true, fog: false, side: THREE.DoubleSide }));
    mtn.renderOrder = -1; mtn.frustumCulled = false; far.add(mtn);
    const lp = [];
    for (let n = 0; n < 900; n++) {
      const i = Math.floor(rnd() * N), f = rnd(), a = (i + f) / N * Math.PI * 2, top = ridge[i] + (ridge[i + 1] - ridge[i]) * f; if (top < 30) continue;
      const v = 0.05 + rnd() * 0.55, r = R0 - 60 * v - 3;
      lp.push(Math.cos(a) * r, -20 + (top + 20) * v, Math.sin(a) * r);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color('#ffc98a').multiplyScalar(1.6), size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
    lights.frustumCulled = false; lights.renderOrder = 0; far.add(lights);
    // stars
    const sp = [];
    for (let n = 0; n < 1600; n++) { const a = rnd() * Math.PI * 2, e = 0.12 + Math.pow(rnd(), 0.7) * 1.4, r = 790; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.12, depthWrite: false }));
    stars.frustumCulled = false; stars.renderOrder = -1; far.add(stars);
    // low-poly clouds catching the moonlight
    const cl = [];
    for (let k = 0; k < 11; k++) {
      const a = rnd() * Math.PI * 2, r = 420 + rnd() * 260, cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 170 + rnd() * 110;
      for (let j = 0, n = 3 + Math.floor(rnd() * 4); j < n; j++) { const b = new THREE.IcosahedronGeometry(1, 0); b.scale(16 + rnd() * 22, 7 + rnd() * 7, 12 + rnd() * 16); b.translate(cx + (j - n / 2) * 18 + rnd() * 8, cy + rnd() * 6, cz + rnd() * 14); cl.push(b.toNonIndexed()); }
    }
    const clouds = new THREE.Mesh(mergeGeometries(cl), new THREE.MeshStandardMaterial({ color: '#e0a090', emissive: '#6a3c48', roughness: 1, flatShading: true, fog: false }));
    clouds.frustumCulled = false; far.add(clouds);
  }
  // night light: a bluish sky fill bright enough to show the facade colours, a cool moon
  group.add(new THREE.HemisphereLight('#a8bcf0', '#7c685c', 1.5));
  const moonL = new THREE.DirectionalLight('#ffb27c', 3.2); moonL.position.copy(SUN).multiplyScalar(600); group.add(moonL);
  // reflections: dark sky with warm street lamps and neon around the horizon
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide })));
  { const sb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(9) })); sb.position.copy(SUN).multiplyScalar(8.6); es.add(sb); for (let i = 0; i < 26; i++) rnd(); }
  const env = pmrem.fromScene(es, 0.03).texture;
  mark();

  Object.assign(world, { built: true, roads, nodes, edges, group, far, env, cmeshes, hash, HC, mm, props, fog: new THREE.Fog('#c79c96', 70, 620), bg: new THREE.Color('#c79c96'), roadMat, cityMat, sigHeads, sigMesh, beamPivot, ARENA });
  drawWorldMap(); mark();
  world.timings = TT.slice(1).map((t, i) => Math.round(t - TT[i]));
}
