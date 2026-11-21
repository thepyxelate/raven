/* ================= open world: Free Roam ================= */
// A 2 x 2 km night city generated from a fixed seed: a street grid (Downtown, Westside,
// North Hills, Harbor, Sunset Shore) inside a ring highway whose south side is the palm-lined
// coast boulevard. Everything static inside a 250 m chunk is merged into two meshes (city and
// road), so a visible chunk costs two draw calls. Windows, neon and street lamps are emissive
// vertex data in one shader, not real lights; only the player's headlights are lights.
const RW = { street: 11, avenue: 16, highway: 20 };
const LANES_DIR = { street: 1, avenue: 2, highway: 2 };
const laneOff = (type, k) => (type === 'street' ? 2.75 : type === 'avenue' ? 2.2 + 3.6 * k : 2.6 + 3.8 * k);
const CH = 250, NCH = 8;
const world = { built: false };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// elevated sections: the north side of the ring is a viaduct; the harbor bridge crosses to the island
const viaductH = (x) => 11 * smooth01((x + 620) / 160) * smooth01((620 - x) / 160);
const bridgeH = (z) => 12 * smooth01((z - 652) / 90) * smooth01((1092 - z) / 80) + 2.5 * Math.sin(clamp((z - 742) / 270, 0, 1) * Math.PI);
// the Neon Skyway: a curved elevated highway from the coast boulevard, over downtown, to the ring's east side
const SKY_CTRL = [[-560, 640], [-560, 560], [-520, 450], [-420, 340], [-260, 230], [-90, 140], [80, 40], [240, -60], [400, -150], [560, -200], [720, -215], [820, -205], [900, -200]];
function skywayPts() {
  const curve = new THREE.CatmullRomCurve3(SKY_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const pts = curve.getSpacedPoints(120).map((v) => [v.x, v.z]);
  pts[0] = SKY_CTRL[0].slice(); pts[pts.length - 1] = SKY_CTRL[SKY_CTRL.length - 1].slice();
  return pts;
}
const skyH = (s, L) => 15 * smooth01(s / 160) * smooth01((L - s) / 160) + 2.2 * Math.sin(clamp((s - 160) / (L - 320), 0, 1) * Math.PI * 3) * smooth01((s - 120) / 200) * smooth01((L - s - 120) / 200);
// nearest point on a road: arc length, signed offset to the right of the road's direction, distance
function projectRoad(r, x, z) {
  let best = Infinity, bs = 0, bl = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) continue;
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < best) { best = d2; const L = Math.sqrt(L2); bs = r.cum[i - 1] + t * L; bl = ((x - px) * -dz + (z - pz) * dx) / L; }
  }
  return { s: bs, lat: bl, d: Math.sqrt(best) };
}
let ELEVATED = []; // roads with a height profile
const TUNNEL = { x: -900, z0: -360, z1: -40, half: 10.6, roof: 7 };
const inTunnel = (x, z, pad = 0) => Math.abs(x - TUNNEL.x) < 50 + pad && z > TUNNEL.z0 - 5 - pad && z < TUNNEL.z1 + 5 + pad;
function roundRect(X0, Z0, X1, Z1, RR) {
  const pts = [];
  const arc = (cx, cz, a0) => { for (let i = 0; i <= 9; i++) { const a = (a0 + i * 10) * Math.PI / 180; pts.push([cx + RR * Math.cos(a), cz + RR * Math.sin(a)]); } };
  arc(X1 - RR, Z0 + RR, -90); arc(X1 - RR, Z1 - RR, 0); arc(X0 + RR, Z1 - RR, 90); arc(X0 + RR, Z0 + RR, 180);
  pts.push(pts[0].slice()); return pts;
}
// how far a road stops short of a crossing: half the width of the widest other road there
const clrAt = (n, r) => { let c = 0; for (const o of n.roads) if (o !== r) c = Math.max(c, o.w / 2); return c; };

/* ---- geometry buffer with per-vertex colour and emissive data ---- */
// Level of detail by size: every chunk sorts its geometry into tiers by object size. Tier 0 holds objects under
// TIER[0] metres (tables, planters, bollards), tier 1 those under TIER[1] (parked cars, trees, awnings, roof plant);
// everything bigger, and anything that glows (a far lamp is still a visible dot), stays in the base mesh.
// A tier is drawn only while its objects would cover more than a few pixels (see lodUpdate).
const TIER = [2.2, 6];
class GeoBuf {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.w = []; this.i = []; this.v = 0; this.tiers = null; }
  bin(size, win) { return !this.tiers || win[3] >= 0.99 ? null : size < TIER[0] ? this.tiers[0] : size < TIER[1] ? this.tiers[1] : null; }
  vert(x, y, z, nx, ny, nz, col, u, v, win) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); this.u.push(u, v);
    this.w.push(win[0], win[1], win[2], win[3]); return this.v++;
  }
  // a..d are corners [x, y, z]; the winding is fixed to face `nrm`
  quad(a, b, c, d, col, uv, win, nrm) {
    if (this.tiers) { const t = this.bin(Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]), Math.abs(b[0] - d[0]), Math.abs(b[1] - d[1]), Math.abs(b[2] - d[2])), win); if (t) return t.quad(a, b, c, d, col, uv, win, nrm); }
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let flip = false;
    if (nrm && nx * nrm[0] + ny * nrm[1] + nz * nrm[2] < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
    const q = [a, b, c, d].map((p, k) => this.vert(p[0], p[1], p[2], nx, ny, nz, col, uv[k][0], uv[k][1], win));
    if (flip) this.i.push(q[0], q[2], q[1], q[0], q[3], q[2]); else this.i.push(q[0], q[1], q[2], q[0], q[2], q[3]);
  }
  // append a three.js geometry transformed by a 4x4 matrix
  geo(g, m, col, win) {
    if (this.tiers) { if (!g.boundingSphere) g.computeBoundingSphere(); const me = m.elements, t = this.bin(g.boundingSphere.radius * 2 * Math.hypot(me[0], me[1], me[2]), win); if (t) return t.geo(g, m, col, win); }
    const P = g.attributes.position, N = g.attributes.normal, e = m.elements, base = this.v;
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), y = P.getY(k), z = P.getZ(k), nx = N.getX(k), ny = N.getY(k), nz = N.getZ(k);
      const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      let ax = e[0] * nx + e[4] * ny + e[8] * nz, ay = e[1] * nx + e[5] * ny + e[9] * nz, az = e[2] * nx + e[6] * ny + e[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
      this.vert(X, Y, Z, ax, ay, az, col, 0, 0, win);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k));
    else for (let k = 0; k < P.count; k++) this.i.push(base + k);
  }
  // axis-aligned box; sides carry window UVs (3 m per window, 3.5 m per floor)
  box(x0, z0, x1, z1, y0, y1, col, win, roof = col, uo = 0, vo = 0, top = true, su = 1, sv = 1) {
    if (this.tiers) { const t = this.bin(Math.max(x1 - x0, z1 - z0, y1 - y0), win); if (t) return t.box(x0, z0, x1, z1, y0, y1, col, win, roof, uo, vo, top, su, sv); }
    const W0 = [0, 0, 0, 0], fu = (a) => a / 48 * su + uo, fv = (y) => (y - y0) / 56 * sv + vo;
    const side = (ax, az, bx, bz, n) => { const L = Math.hypot(bx - ax, bz - az); this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col, [[fu(0), fv(y0)], [fu(L), fv(y0)], [fu(L), fv(y1)], [fu(0), fv(y1)]], win, n); };
    side(x0, z0, x1, z0, [0, 0, -1]); side(x1, z1, x0, z1, [0, 0, 1]); side(x0, z1, x0, z0, [-1, 0, 0]); side(x1, z0, x1, z1, [1, 0, 0]);
    if (top) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], roof, [[0, 0], [0, 0], [0, 0], [0, 0]], W0, [0, 1, 0]);
  }
  // box rotated about y (lamp arms, billboards, crane parts)
  obox(cx, cz, ang, hl, hw, y0, y1, col, win) {
    if (this.tiers) { const t = this.bin(Math.max(hl * 2, hw * 2, y1 - y0), win); if (t) return t.obox(cx, cz, ang, hl, hw, y0, y1, col, win); }
    const c = Math.cos(ang), s = Math.sin(ang), P = (a, b) => [cx + c * a - s * b, cz + s * a + c * b];
    const k = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)], Z = [[0, 0], [0, 0], [0, 0], [0, 0]];
    for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4], mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz; this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], col, Z, win, [mx, 0, mz]); }
    this.quad([k[0][0], y1, k[0][1]], [k[1][0], y1, k[1][1]], [k[2][0], y1, k[2][1]], [k[3][0], y1, k[3][1]], col, Z, win, [0, 1, 0]);
  }
  mesh(mat, withColor = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (withColor) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('win', new THREE.BufferAttribute(Uint8Array.from(this.w, (x) => Math.round(clamp(x, 0, 1) * 255)), 4, true));
    }
    g.setIndex(new THREE.BufferAttribute(this.v > 65535 ? Uint32Array.from(this.i) : Uint16Array.from(this.i), 1));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
