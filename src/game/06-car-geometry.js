/* ================= car geometry ================= */
const lerpPts = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
};
const TOP = [[-2.25, 0.5], [-2.17, 0.66], [-1.95, 0.72], [-1.45, 0.72], [0.8, 0.68], [1.55, 0.6], [2.1, 0.5], [2.25, 0.36]];
const BOT = [[-2.25, 0.24], [-2.15, 0.07], [-1.95, 0.02], [1.95, 0.02], [2.15, 0.06], [2.25, 0.12]];
const ROOF = [[-1.48, 0.73], [-0.8, 1.13], [0.0, 1.1], [0.82, 0.69]];
const R = 0.33, XF = 1.4, XR = -1.36;

class Buckets {
  constructor() { this.b = {}; }
  vert(k, p, uv) {
    const q = (n) => Math.round(n * 1e4) || 0;
    const pk = q(p[0]) + ',' + q(p[1]) + ',' + q(p[2]), key = pk + '|' + q(uv[0]) + ',' + q(uv[1]);
    let i = k.map.get(key);
    if (i === undefined) { i = k.pk.length; k.p.push(p[0], p[1], p[2]); k.u.push(uv[0], uv[1]); k.pk.push(pk); k.map.set(key, i); }
    return i;
  }
  tri(name, a, b, c, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
    const k = this.b[name] || (this.b[name] = { p: [], u: [], i: [], pk: [], map: new Map() });
    k.i.push(this.vert(k, a, ua), this.vert(k, b, ub), this.vert(k, c, uc));
  }
  quad(name, a, b, c, d, ua, ub, uc, ud) { this.tri(name, a, b, c, ua, ub, uc); this.tri(name, a, c, d, ua, uc, ud); }
  meshes(mats) {
    const out = [];
    for (const [name, k] of Object.entries(this.b)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(k.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(k.u, 2));
      g.setIndex(k.i);
      g.computeVertexNormals();
      // smooth across UV seams: vertices at the same spot share one normal
      const n = g.attributes.normal, same = new Map();
      k.pk.forEach((key, i) => { if (!same.has(key)) same.set(key, []); same.get(key).push(i); });
      for (const ids of same.values()) if (ids.length > 1) {
        let x = 0, y = 0, z = 0; for (const i of ids) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
        const l = Math.hypot(x, y, z) || 1; for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
      }
      // degenerate slivers leave zero normals, which turn into NaN in the shader
      for (let i = 0; i < n.count; i++) if (Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) < 1e-6) n.setXYZ(i, 0, 1, 0);
      const m = new THREE.Mesh(g, mats[name]); m.castShadow = true; m.receiveShadow = true; out.push(m);
    }
    return out;
  }
}

/* ---- car models ----
   Four bodies from one lofter. Each model gives its side profile (TOP body line, BOT sill line,
   ROOF greenhouse), wheel positions, plan taper and where its parts sit. Bumpers and wings are
   authored once in Raven RS coordinates and mapped onto each model's nose and tail; the Raven
   keeps its original numbers exactly. */
const CAR_MODELS = {
  raven: {
    L: 2.25, R: 0.33, XF: 1.4, XR: -1.36, W: 0.9, clrAdj: 0, TOP, BOT, ROOF,
    planF: [1.55, 0.7, 0.2], planR: [1.55, 0.7, 0.2], tumble: [0.42, 0.22], haunch: 0, cabTaper: 0.3,
    cab: [0.82, -1.48], wind: 0.0, rearGlass: [-1.49, -0.79], side: [-1.32, 0.6], pillars: [[-0.41, -0.29]],
    hoodZones: [[0.8, 2.12]], hoodShift: 0, hoodSlope: [0.8, 1.55], hz: 1, us: 1, vs: 1,
    fys: 1, zf: 1, zr: 1, exY: 0.11, plateY: 0.33,
    mir: { x: 0.6, hx: 0.55, y: 0.75, dy: 0 }, doors: [0.84, -0.33], seamY: 0.38, seamH: 0.5, handle: [0.5, 0.56],
    ventX: 0.98, ventY: 0.4, wiper: 0.74, wiperZ: 0.24, antenna: [-1.0, -0.35],
    inX: -0.35, inLen: 1.7, inW: 1.1, inY: 0.66, seatX: -0.5, seatY: 0.84, headX: -0.55, headY: 1.03, seatZ: 0.31,
    skirt: [2.0, 0.02, [-0.8, 0.84]], wz: 1, wy: 1, deck: null, roofSp: [-0.9, -0.82], roofMid: -0.25, roofRearX: -0.72, louver: [-0.83, 0.6, 0.25], rz: 1,
    base: { hp: 180, weight: 1250, vmax: 0, handling: 0, redline: 7600, bias: 0, cda: 0, grip: 1 },
    lights(A, s) {
      const { add, bx, clr, c } = A, nose = Math.atan2(0.14, -0.15);
      // headlights: housing, lens, LED brow
      add(bx(0.2, 0.025, 0.34), CM.housing, 2.172, clr + 0.437, s * 0.56, 0, 0, nose);
      add(bx(0.13, 0.03, 0.12), CM.head, 2.168, clr + 0.44, s * 0.48, 0, 0, nose);
      add(bx(0.11, 0.03, 0.1), CM.head, 2.175, clr + 0.432, s * 0.64, 0, 0, nose);
      add(bx(0.02, 0.03, 0.3), CM.head, 2.12, clr + 0.495, s * 0.56, 0, 0, nose);
      // taillights
      if (c.taillight === 'led') add(bx(0.03, 0.035, 0.62), CM.tail, -2.255, clr + 0.44, s * 0.36);
      else { add(bx(0.03, 0.1, 0.36), CM.tail, -2.255, clr + 0.42, s * 0.5); add(bx(0.034, 0.03, 0.3), CM.housing, -2.256, clr + 0.42, s * 0.5); }
    }
  },
  ember: {
    L: 1.975, R: 0.31, XF: 1.25, XR: -1.28, W: 0.86, clrAdj: 0,
    TOP: [[-1.975, 0.44], [-1.95, 0.7], [-1.9, 0.79], [-1.5, 0.8], [0.85, 0.75], [1.35, 0.67], [1.8, 0.56], [1.92, 0.48], [1.975, 0.38]],
    BOT: [[-1.975, 0.26], [-1.88, 0.08], [-1.68, 0.02], [1.65, 0.02], [1.88, 0.07], [1.975, 0.14]],
    ROOF: [[-1.9, 0.79], [-1.8, 1.2], [-1.62, 1.3], [-0.3, 1.33], [0.15, 1.31], [0.85, 0.76]],
    planF: [1.45, 0.53, 0.13], planR: [1.6, 0.375, 0.08], tumble: [0.5, 0.18], haunch: 0.02, cabTaper: 0.26,
    cab: [0.85, -1.9], wind: 0.17, rearGlass: [-1.905, -1.75], side: [-1.55, 0.62], pillars: [[-0.66, -0.56]],
    hoodZones: [[0.88, 1.9]], hoodShift: -0.1, hoodSlope: [0.85, 1.6], hz: 0.95, us: 1.139, vs: 0.92,
    fys: 1, zf: 1.04, zr: 1.1, exY: 0.12, plateY: 0.36,
    mir: { x: 0.72, hx: 0.68, y: 0.95, dy: 0.07 }, doors: [0.82, -0.6], seamY: 0.42, seamH: 0.56, handle: [-0.42, 0.63],
    ventX: 0.83, ventY: 0.44, wiper: 0.78, wiperZ: 0.22, antenna: [-1.35, -0.3],
    inX: -0.45, inLen: 1.75, inW: 1.05, inY: 0.74, seatX: -0.55, seatY: 0.92, headX: -0.6, headY: 1.12, seatZ: 0.3,
    skirt: [1.76, -0.015, [-0.72, 0.7]], wz: 0.96, wy: 0.5, wp: 0.75, deck: [-1.75, -1.78, 0.8], roofSp: [-1.7, -1.62], roofMid: -0.6, roofRearX: -1.35, louver: [-1.02, 0.5, 0.06], rz: 0.95,
    base: { hp: 158, weight: 1030, vmax: -12, handling: 8, redline: 8000, bias: -0.04, cda: 0.05, grip: 1.02 },
    lights(A, s) {
      const { add, bx, cyl, clr, c } = A, face = Math.atan2(-0.1, 0.055);
      // slim lamps on the steep nose corners, round high beams on the front face
      add(bx(0.12, 0.03, 0.4), CM.housing, 1.953, clr + 0.432, s * 0.53, 0, 0, face);
      add(bx(0.1, 0.034, 0.3), CM.head, 1.955, clr + 0.433, s * 0.55, 0, 0, face);
      add(cyl(0.042, 0.03, 14), CM.head, 1.982, clr + 0.33, s * 0.55, 0, 0, Math.PI / 2);
      // tall taillights up the hatch corners
      const lean = -0.21;
      if (c.taillight === 'led') { add(bx(0.03, 0.03, 0.6), CM.tail, -1.94, clr + 0.73, s * 0.4, 0, 0, lean); add(bx(0.03, 0.2, 0.05), CM.tail, -1.952, clr + 0.6, s * 0.7, 0, 0, lean); }
      else { add(bx(0.034, 0.27, 0.12), CM.housing, -1.952, clr + 0.6, s * 0.69, 0, 0, lean); add(bx(0.03, 0.23, 0.08), CM.tail, -1.957, clr + 0.6, s * 0.69, 0, 0, lean); }
    },
    stockFront(A) {
      const { add, bx, clr } = A, x = 1.977;
      add(bx(0.03, 0.09, 0.82), CM.dark, x, clr + 0.27, 0);
      for (let i = -3; i <= 3; i++) add(bx(0.035, 0.09, 0.012), CM.housing, x + 0.002, clr + 0.27, i * 0.11);
      add(bx(0.03, 0.06, 1.02), CM.dark, x, clr + 0.18, 0);
    },
    extras(A) {
      const { add, bx, clr, c, M, roofY, hw, rel, cyA, Ra } = A;
      // roof lip over the hatch, with a high brake light
      if (!['roof', 'lip', 'duck'].includes(c.spoiler)) { add(bx(0.2, 0.03, 1.18), CM.plain, -1.71, roofY(-1.71) + 0.022, 0, 0, 0, -0.16); add(bx(0.03, 0.02, 0.32), CM.tail, -1.8, roofY(-1.8) + 0.012, 0, 0, 0, -0.16); }
      // boxy plastic arch flares on the stock body
      if (c.width === 'stock') for (const xw of [M.XF, M.XR]) for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
        const a0 = Math.PI * k / 7, a1 = Math.PI * (k + 1) / 7, am = (a0 + a1) / 2, r2 = Ra + 0.025;
        const px = xw + Math.cos(am) * r2, py = cyA + Math.sin(am) * r2;
        if (py < clr - 0.02) continue;
        add(bx(2 * r2 * Math.sin((a1 - a0) / 2) + 0.01, 0.05, 0.05), CM.dark, px, py, s * (hw(px, rel(py), 1) + 0.012), 0, 0, am + Math.PI / 2);
      }
    }
  },
  blackjaw: {
    L: 2.425, R: 0.345, XF: 1.55, XR: -1.42, W: 0.95, clrAdj: 0.01,
    TOP: [[-2.425, 0.52], [-2.38, 0.68], [-2.22, 0.76], [-1.6, 0.77], [0.35, 0.74], [1.3, 0.71], [2.2, 0.66], [2.36, 0.6], [2.425, 0.46]],
    BOT: [[-2.425, 0.28], [-2.33, 0.08], [-2.1, 0.02], [2.12, 0.02], [2.36, 0.08], [2.425, 0.18]],
    ROOF: [[-2.08, 0.77], [-1.6, 0.9], [-1.0, 1.12], [-0.68, 1.18], [-0.32, 1.17], [0.35, 0.75]],
    planF: [1.95, 0.475, 0.12], planR: [1.95, 0.475, 0.1], tumble: [0.5, 0.26], haunch: 0.055, cabTaper: 0.32,
    cab: [0.35, -2.08], wind: -0.3, rearGlass: [-1.72, -0.98], side: [-1.58, 0.22], pillars: [[-0.9, -0.78]],
    hoodZones: [[0.4, 2.36]], hoodShift: -0.12, hoodSlope: [0.35, 1.3], hz: 1.05, us: 0.928, vs: 0.96,
    fys: 1.1, zf: 1.16, zr: 1.19, exY: 0.14, plateY: 0.36,
    mir: { x: 0.2, hx: 0.15, y: 0.77, dy: 0.05 }, doors: [0.3, -0.85], seamY: 0.4, seamH: 0.52, handle: [-0.68, 0.6],
    ventX: 1.13, ventY: 0.42, wiper: 0.27, wiperZ: 0.26, antenna: [-1.05, -0.36],
    inX: -0.55, inLen: 1.75, inW: 1.15, inY: 0.66, seatX: -0.72, seatY: 0.84, headX: -0.77, headY: 1.03, seatZ: 0.33,
    skirt: [2.16, 0.065, [-0.85, 0.95]], wz: 1.05, wy: 1, deck: null, roofSp: [-0.9, -0.82], roofMid: -0.6, roofRearX: -0.78, louver: [-1.02, 0.62, 0.36], rz: 1.05,
    base: { hp: 225, weight: 1600, vmax: 4, handling: -8, redline: 6800, bias: 0.1, cda: 0.03, grip: 0.98 },
    lights(A, s) {
      const { add, bx, cyl, clr, c } = A;
      // twin round projectors under a slanted LED brow, set into the tall flat nose
      add(bx(0.03, 0.11, 0.44), CM.housing, 2.428, clr + 0.4, s * 0.6);
      add(bx(0.03, 0.026, 0.4), CM.head, 2.432, clr + 0.47, s * 0.6, s * 0.14, 0, 0);
      add(cyl(0.04, 0.03, 14), CM.head, 2.44, clr + 0.395, s * 0.49, 0, 0, Math.PI / 2);
      add(cyl(0.04, 0.03, 14), CM.head, 2.44, clr + 0.395, s * 0.71, 0, 0, Math.PI / 2);
      // three slanted bars per side: the claw
      add(bx(0.034, 0.13, 0.48), CM.housing, -2.43, clr + 0.45, s * 0.56);
      if (c.taillight === 'led') add(bx(0.03, 0.03, 0.44), CM.tail, -2.434, clr + 0.46, s * 0.56);
      else for (let k = 0; k < 3; k++) add(bx(0.03, 0.028, 0.16), CM.tail, -2.434, clr + 0.44 + k * 0.006, s * (0.42 + k * 0.13), s * 0.5, 0, 0);
    },
    stockFront(A) {
      const { add, bx, clr } = A, x = 2.427;
      add(bx(0.03, 0.17, 0.66), CM.dark, x, clr + 0.33, 0);
      for (let i = -2; i <= 2; i++) add(bx(0.035, 0.17, 0.016), CM.housing, x + 0.003, clr + 0.33, i * 0.12);
      add(bx(0.03, 0.05, 1.3), CM.dark, x, clr + 0.21, 0);
    },
    extras(A) {
      const { add, bx, cyl, c, yt, onSide } = A;
      const sl = Math.atan2(0.66 - 0.74, 2.2 - 0.35);
      if (c.hood === 'stock') { add(bx(1.5, 0.04, 0.5), CM.plain, 1.25, yt(1.25) + 0.02, 0, 0, 0, sl); add(bx(1.3, 0.03, 0.32), CM.plain, 1.2, yt(1.2) + 0.045, 0, 0, 0, sl); }
      for (const s of [1, -1]) add(cyl(0.022, 0.012, 12), CM.chrome, 2.08, yt(2.08) + 0.018, s * 0.55); // hood pins
      onSide(0.26, 0.06, 0.012, CM.well, -0.97, 0.62, 0.003, 0.1); // a scoop slot ahead of each rear haunch
    }
  },
  vanta: {
    L: 2.25, R: 0.33, XF: 1.38, XR: -1.42, W: 0.98, clrAdj: -0.04,
    TOP: [[-2.25, 0.46], [-2.2, 0.62], [-2.02, 0.7], [-1.1, 0.72], [-0.95, 0.7], [0.65, 0.63], [1.4, 0.64], [1.8, 0.5], [2.15, 0.3], [2.25, 0.2]],
    BOT: [[-2.25, 0.2], [-2.15, 0.06], [-1.95, 0.0], [1.95, 0.0], [2.18, 0.04], [2.25, 0.08]],
    ROOF: [[-1.08, 0.72], [-0.7, 0.93], [-0.4, 0.99], [-0.1, 0.97], [0.65, 0.64]],
    planF: [1.05, 1.2, 0.33], planR: [1.85, 0.4, 0.07], tumble: [0.32, 0.3], haunch: 0.04, cabTaper: 0.42,
    cab: [0.65, -1.08], wind: -0.12, rearGlass: [-1.0, -0.74], side: [-0.76, 0.5], pillars: [],
    hoodZones: [[0.75, 2.15], [-2.02, -1.12]], hoodShift: -2.82, hoodSlope: [-2.0, -1.2], hz: 0.95, us: 1, vs: 1.15,
    fys: 0.6, zf: 0.91, zr: 1.27, exY: 0.15, plateY: 0.36,
    mir: { x: 0.47, hx: 0.42, y: 0.63, dy: -0.12 }, doors: [0.6, -0.62], seamY: 0.34, seamH: 0.44, handle: [-0.48, 0.5],
    ventX: 0.96, ventY: 0.32, wiper: 0.58, wiperZ: 0.16, antenna: null,
    inX: -0.22, inLen: 1.4, inW: 1.05, inY: 0.48, seatX: -0.42, seatY: 0.66, headX: -0.47, headY: 0.84, seatZ: 0.3,
    decalX: 0.35, skirt: [2.0, -0.02, [-0.75, 0.7]], wz: 1.12, wy: 1, deck: null, roofSp: [-0.66, -0.58], roofMid: -0.42, roofRearX: -0.62, louver: [-0.76, 0.26, 0.55], rz: 0.85,
    base: { hp: 190, weight: 1180, vmax: 20, handling: 10, redline: 8300, bias: 0, cda: -0.1, grip: 1.06 },
    lights(A, s) {
      const { add, bx, clr, c } = A, ns = Math.atan2(0.3 - 0.5, 2.15 - 1.8);
      // two thin LED slits cut into the sloped nose
      add(bx(0.32, 0.012, 0.18), CM.housing, 1.96, clr + 0.418, s * 0.58, 0, s * 0.22, ns);
      add(bx(0.27, 0.02, 0.05), CM.head, 1.96, clr + 0.424, s * 0.62, 0, s * 0.22, ns);
      add(bx(0.16, 0.02, 0.04), CM.head, 2.0, clr + 0.4, s * 0.5, 0, s * 0.22, ns);
      // dashed taillights across the tail
      add(bx(0.034, 0.05, 0.56), CM.housing, -2.256, clr + 0.4, s * 0.62);
      if (c.taillight === 'led') add(bx(0.03, 0.028, 0.5), CM.tail, -2.258, clr + 0.4, s * 0.62);
      else for (let k = 0; k < 4; k++) add(bx(0.03, 0.03, 0.08), CM.tail, -2.258, clr + 0.4, s * (0.42 + k * 0.13));
    },
    stockFront(A) {
      const { add, bx, clr } = A, x = 2.252;
      for (const s of [1, -1]) add(bx(0.03, 0.06, 0.34), CM.dark, x, clr + 0.13, s * 0.4);
      add(bx(0.03, 0.04, 0.4), CM.dark, x, clr + 0.12, 0);
    },
    extras(A) {
      const { add, bx, clr, c, yt, onSide } = A;
      // intakes between the doors and the rear wheels, slatted, with a strake running back over the haunch
      onSide(0.36, 0.22, 0.012, CM.well, -0.83, 0.37, 0.003, -0.12);
      for (const y of [0.31, 0.37, 0.43]) onSide(0.33, 0.012, 0.016, CM.housing, -0.83 - (y - 0.37) * 0.12, y, 0.006);
      onSide(0.56, 0.03, 0.04, c.skirt === 'stock' ? CM.plain : CM.carbon, -0.9, 0.52, 0.012, -0.06);
      if (c.hood !== 'louvers' && c.hood !== 'vents') for (let k = 0; k < 6; k++) { const x = -1.3 - k * 0.11; add(bx(0.05, 0.012, 0.86), CM.well, x, yt(x) + 0.03, 0); }
      add(bx(0.03, 0.1, 1.28), CM.dark, -2.253, clr + 0.25, 0);
      for (let i = -5; i <= 5; i++) add(bx(0.034, 0.1, 0.01), CM.housing, -2.255, clr + 0.25, i * 0.11);
    }
  }
};
const modelOf = (c) => CAR_MODELS[baseOf(c.model)] || CAR_MODELS.raven;
const modelName = (id) => (MODEL_LIST.find((m) => m[0] === id) || MODEL_LIST[0])[1];

function buildCar(c) {
  const car = new THREE.Group();
  const M = modelOf(c), W = M.W, amp = c.width === 'wide' ? 0.11 : 0.03, XF = M.XF, XR = M.XR, RW = M.R;
  const clr = ({ stock: 0.17, sport: 0.12, stance: 0.06 })[c.susp] + M.clrAdj, clr0 = 0.17 + M.clrAdj;
  const Ra = RW + 0.05 + (c.width !== 'stock' ? 0.02 : 0);
  const cyA = RW + (clr - clr0);
  const plan = (x) => { const [p0, pl, pk] = x >= 0 ? M.planF : M.planR, a = Math.abs(x); return a < p0 ? 1 : 1 - pk * Math.pow((a - p0) / pl, 2); };
  const bulge = (x) => amp * (Math.exp(-Math.pow((x - XF) / 0.55, 2)) + Math.exp(-Math.pow((x - XR) / 0.55, 2))) + M.haunch * Math.exp(-Math.pow((x - XR) / 0.7, 2));
  const hw = (x, yRel, kb) => W * plan(x) + bulge(x) * kb - Math.max(0, yRel - M.tumble[0]) * M.tumble[1];
  const yt = (x) => lerpPts(M.TOP, x) + clr;
  const ybBase = (x) => lerpPts(M.BOT, x) + clr;
  const archTop = (x) => { let m = -1; for (const xw of [XF, XR]) { const d = x - xw; if (Math.abs(d) < Ra) m = Math.max(m, cyA + Math.sqrt(Ra * Ra - d * d)); } return m; };
  const yb = (x) => Math.max(ybBase(x), archTop(x));
  const rel = (y) => y - clr;
  const B = new Buckets();

  // ---- body loft ----
  const sec = (x) => {
    const t = yt(x), b = yb(x), h = t - b;
    const Y = [b, b, b + Math.min(0.06, h * 0.2), b + h * 0.38, b + h * 0.62, b + h * 0.84, t - 0.03, t - 0.004, t + 0.02, t + 0.028];
    const ws = hw(x, rel(Y[6]), 0.4);
    const Z = [0, hw(x, rel(b), 1) * 0.86, hw(x, rel(Y[2]), 1) * 0.985, hw(x, rel(Y[3]), 1), hw(x, rel(Y[4]), 0.9) * 0.998, hw(x, rel(Y[5]), 0.7) * 0.985, ws * 0.955, ws * 0.86, hw(x, rel(t), 0.2) * 0.5, 0];
    const wref = ws * 0.955 / 0.95;
    return Y.map((y, j) => ({ z: Z[j], y, v: j <= 5 ? Math.max(0, rel(y)) * 0.5 * M.vs : 0.72 + 0.28 * (1 - Math.min(1, Z[j] / wref)) }));
  };
  const xs = []; for (let x = -M.L; x <= M.L + 1e-4; x += 0.05) xs.push(+x.toFixed(3));
  const secs = xs.map(sec);
  // vinyl U: every body is stretched onto the same 4.6 m canvas, so patterns and decals fit each length
  const U = (h, x) => h * 0.5 + (x * M.us + 2.3) / 4.6 * 0.5;
  const inHood = (x0, x1) => M.hoodZones.some(([a, b]) => x0 >= a && x1 <= b);
  for (const s of [1, -1]) {
    const h = s > 0 ? 0 : 1;
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], A = secs[i], Bs = secs[i + 1];
      for (let j = 0; j < A.length - 1; j++) {
        const name = j === 0 ? 'dark' : (j >= 6 && inHood(x0, x1) ? 'hood' : 'paint');
        B.quad(name,
          [x0, A[j].y, s * A[j].z], [x1, Bs[j].y, s * Bs[j].z], [x1, Bs[j + 1].y, s * Bs[j + 1].z], [x0, A[j + 1].y, s * A[j + 1].z],
          [U(h, x0), A[j].v], [U(h, x1), Bs[j].v], [U(h, x1), Bs[j + 1].v], [U(h, x0), A[j + 1].v]);
      }
    }
  }
  for (const [x, S] of [[xs[0], secs[0]], [xs[xs.length - 1], secs[secs.length - 1]]]) { // end caps
    const cy = (S[0].y + S[S.length - 1].y) / 2, ring = S.map((p) => [x, p.y, p.z]).concat(S.slice().reverse().map((p) => [x, p.y, -p.z]));
    for (let k = 0; k < ring.length - 1; k++) B.tri('cap', [x, cy, 0], ring[k], ring[k + 1], [0.002, 0.5], [0.002, 0.5], [0.002, 0.5]);
  }
  // wheel wells
  for (const xw of [XF, XR]) {
    const zw = W + bulge(xw) - 0.02;
    for (let k = 0; k < 16; k++) {
      const a0 = Math.PI * k / 16, a1 = Math.PI * (k + 1) / 16;
      const p = (a, z) => [xw + Math.cos(a) * Ra, cyA + Math.sin(a) * Ra, z];
      B.quad('well', p(a0, zw), p(a1, zw), p(a1, -zw), p(a0, -zw));
    }
  }

  // ---- cabin loft ----
  const csec = (x) => {
    const yB = yt(x) - 0.004, yR = lerpPts(M.ROOF, x) + clr, hg = Math.max(0.001, yR - yB);
    const wb = hw(x, rel(yB), 0.2) - 0.07, wt = wb - hg * M.cabTaper, wr = (wt - 0.045) / 0.95;
    return [[wb, yB], [wt, yR - Math.min(0.07, hg * 0.35)], [wt - 0.045, yR - 0.012], [(wt - 0.07) * 0.55, yR + 0.008], [0, yR + 0.012]]
      .map(([z, y], j) => ({ z, y, hg, v: j <= 1 ? rel(y) * 0.5 * M.vs : 0.72 + 0.28 * (1 - Math.min(1, z / wr)) }));
  };
  const cx = []; for (let x = M.cab[0]; x >= M.cab[1] - 1e-4; x -= 0.05) cx.push(+x.toFixed(3));
  const cs = cx.map(csec);
  const sideGlass = (x0, x1, hg) => x1 > M.side[0] && x0 < M.side[1] && !M.pillars.some(([a, b]) => x0 < b && x1 > a) && hg > 0.12;
  for (const s of [1, -1]) {
    const h = s > 0 ? 0 : 1;
    for (let i = 0; i < cx.length - 1; i++) {
      const xa = cx[i], xb = cx[i + 1], A = cs[i], Bs = cs[i + 1];
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      for (let j = 0; j < A.length - 1; j++) {
        let name = 'paint';
        if (j === 0 && sideGlass(lo, hi, Math.min(A[0].hg, Bs[0].hg))) name = 'glass';
        if (j >= 2 && (lo >= M.wind || (lo >= M.rearGlass[0] && hi <= M.rearGlass[1]))) name = 'glass';
        B.quad(name,
          [xa, A[j].y, s * A[j].z], [xb, Bs[j].y, s * Bs[j].z], [xb, Bs[j + 1].y, s * Bs[j + 1].z], [xa, A[j + 1].y, s * A[j + 1].z],
          [U(h, xa), A[j].v], [U(h, xb), Bs[j].v], [U(h, xb), Bs[j + 1].v], [U(h, xa), A[j + 1].v]);
      }
    }
  }
  B.meshes({ paint: CM.paint, cap: CM.paint, hood: c.hood === 'carbon' || c.hood === 'vents' ? CM.carbon : CM.paint, dark: CM.dark, well: CM.well, glass: CM.glass }).forEach((m) => car.add(m));

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = car) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, len, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg);
  const roofY = (x) => lerpPts(M.ROOF, x) + clr;
  const inCab = (x) => x <= M.cab[0] && x >= M.cab[1];
  const mountY = (x) => Math.max(yt(x), inCab(x) ? roofY(x) : -1); // a hatch carries its wing on the roof edge
  const onSide = (w, h, t, mat, x, y, out, rz = 0) => { // a flat panel laid on both flanks, following the plan taper and tumblehome
    const slope = (hw(x - w / 2, y, 1) - hw(x + w / 2, y, 1)) / w, lean = (hw(x, y - h / 2, 1) - hw(x, y + h / 2, 1)) / h;
    for (const s of [1, -1]) add(bx(w, h, t), mat, x, clr + y, s * (hw(x, y, 1) + out), -s * Math.atan(lean), s * Math.atan(slope), rz);
  };
  const A = { add, bx, cyl, clr, c, M, yt, hw, rel, roofY, cyA, Ra, onSide };

  // interior silhouette behind the glass
  add(bx(M.inLen, 0.2, M.inW), CM.interior, M.inX, clr + M.inY, 0);
  for (const z of [M.seatZ, -M.seatZ]) { add(bx(0.1, 0.34, 0.4), CM.interior, M.seatX, clr + M.seatY, z, 0, 0, 0.16); add(bx(0.09, 0.1, 0.22), CM.interior, M.headX, clr + M.headY, z); }

  // ---- details ----
  const mo = M.mir.x - 0.6, md = M.mir.dy;
  for (const s of [1, -1]) {
    M.lights(A, s);
    // mirrors
    const mz = hw(M.mir.hx, M.mir.y, 0.2) + 0.02;
    if (c.mirrors === 'aero') { add(bx(0.1, 0.015, 0.14), CM.dark, 0.6 + mo, clr + 0.8 + md, s * (mz + 0.06)); add(bx(0.2, 0.055, 0.09), CM.plain, 0.6 + mo, clr + 0.85 + md, s * (mz + 0.15)); }
    else { add(bx(0.06, 0.03, 0.1), CM.dark, 0.6 + mo, clr + 0.79 + md, s * (mz + 0.03)); add(bx(0.14, 0.09, 0.16), CM.plain, 0.58 + mo, clr + 0.84 + md, s * (mz + 0.12)); }
    // fender vents behind the front wheel
    if (c.fenderVents) for (let k = 0; k < 3; k++) { const x = M.ventX - k * 0.045; add(bx(0.022, 0.15, 0.012), CM.well, x, clr + M.ventY, s * (hw(x, M.ventY, 1) + 0.004), 0, 0, -0.4); }
    // door seams + handle
    for (const x of M.doors) add(bx(0.012, M.seamH, 0.012), CM.dark, x, clr + M.seamY, s * (hw(x, M.seamY, 1) + 0.003));
    add(bx(0.13, 0.025, 0.02), CM.dark, M.handle[0], clr + M.handle[1], s * (hw(M.handle[0], M.handle[1], 1) + 0.006));
    // wipers
    add(bx(0.03, 0.012, 0.5), CM.dark, M.wiper, yt(M.wiper) + 0.02, s * M.wiperZ, 0, s * 0.15, 0);
  }
  if (M.antenna) add(cyl(0.006, 0.35, 6), CM.dark, M.antenna[0], lerpPts(M.ROOF, M.antenna[0]) + clr + 0.17, M.antenna[1], 0, 0, -0.35);
  add(bx(0.012, 0.11, 0.42), CM.plate, -M.L - 0.006, clr + M.plateY, 0);
  if (M.extras) M.extras(A);

  // front bumper: Raven coordinates mapped onto this model's nose
  const fx = (x) => x + (M.L - 2.25), fy = (y) => y * M.fys;
  const F = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(bx(w, h * M.fys, d * M.zf), mat, fx(x), clr + fy(y), z * M.zf, rx, ry, rz);
  const Fc = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(geo, mat, fx(x), clr + fy(y), z * M.zf, rx, ry, rz);
  if (c.fbumper === 'stock') { if (M.stockFront) M.stockFront(A); else { F(0.03, 0.1, 0.9, CM.dark, 2.252, 0.27, 0); F(0.03, 0.05, 0.6, CM.dark, 2.252, 0.17, 0); } }
  const fogs = (z, y) => { for (const s of [1, -1]) { Fc(cyl(0.048, 0.03, 14), CM.housing, 2.255, y, s * z, 0, 0, Math.PI / 2); Fc(cyl(0.034, 0.034, 14), CM.fog, 2.258, y, s * z, 0, 0, Math.PI / 2); } };
  if (c.fbumper === 'sport') {
    F(0.14, 0.09, 1.36, CM.plain, 2.19, 0.07, 0);
    F(0.26, 0.03, 1.5, CM.carbon, 2.2, 0.015, 0);
    F(0.03, 0.14, 0.62, CM.dark, 2.252, 0.24, 0);
    for (const s of [1, -1]) F(0.03, 0.1, 0.24, CM.dark, 2.262, 0.11, s * 0.52);
    fogs(0.52, 0.11);
  }
  if (c.fbumper === 'aggr') {
    F(0.2, 0.14, 1.42, CM.plain, 2.17, 0.05, 0);
    F(0.03, 0.22, 1.04, CM.dark, 2.262, 0.2, 0);
    for (let i = -2; i <= 2; i++) F(0.035, 0.22, 0.02, CM.housing, 2.266, 0.2, i * 0.2);
    F(0.46, 0.028, 1.72, CM.carbon, 2.2, -0.03, 0);
    for (const s of [1, -1]) { F(0.03, 0.12, 0.2, CM.dark, 2.27, 0.07, s * 0.6); F(0.18, 0.012, 0.12, CM.carbon, 2.22, 0.2, s * 0.74, 0, 0, -0.25); F(0.26, 0.012, 0.012, CM.dark, 2.12, 0.25, s * 0.35, 0, 0, 0.9); }
    fogs(0.6, 0.075);
  }
  if (c.fbumper === 'street') {
    F(0.12, 0.08, 1.38, CM.plain, 2.2, 0.07, 0);
    F(0.03, 0.12, 0.92, CM.dark, 2.252, 0.25, 0);
    for (let i = -4; i <= 4; i++) F(0.035, 0.12, 0.01, CM.housing, 2.256, 0.25, i * 0.1);
    F(0.24, 0.02, 1.46, CM.carbon, 2.22, 0.022, 0);
    for (const s of [1, -1]) F(0.16, 0.02, 0.3, CM.carbon, 2.2, 0.03, s * 0.62, 0, s * 0.35, 0);
  }
  if (c.fbumper === 'track') {
    F(0.24, 0.16, 1.46, CM.plain, 2.15, 0.05, 0);
    F(0.03, 0.24, 1.16, CM.dark, 2.274, 0.18, 0);
    for (let i = -3; i <= 3; i++) F(0.035, 0.24, 0.016, CM.carbon, 2.28, 0.18, i * 0.165);
    F(0.62, 0.03, 1.84, CM.carbon, 2.2, -0.04, 0);
    for (const s of [1, -1]) {
      Fc(cyl(0.008, 0.2, 6), CM.chrome, 2.36, 0.04, s * 0.42, 0, 0, -0.6);
      for (let k = 0; k < 2; k++) F(0.2, 0.012, 0.13, CM.carbon, 2.22 - k * 0.02, 0.14 + k * 0.09, s * 0.76, 0, 0, -0.28);
    }
    F(0.08, 0.03, 0.05, CM.hook, 2.32, 0.08, -0.38);
  }
  // rear bumper: Raven coordinates mapped onto this model's tail
  const rx = (x) => x - (M.L - 2.25);
  const Rr = (w, h, d, mat, x, y, z) => add(bx(w, h, d * M.zr), mat, rx(x), clr + y, z * M.zr);
  if (c.rbumper === 'stock') Rr(0.06, 0.05, 1.2, CM.dark, -2.2, 0.12, 0);
  if (c.rbumper === 'clean') { Rr(0.14, 0.17, 1.42, CM.plain, -2.18, 0.13, 0); Rr(0.16, 0.02, 1.3, CM.dark, -2.17, 0.04, 0); }
  if (['sport', 'diff', 'track'].includes(c.rbumper)) {
    const lvl = ({ sport: 0, diff: 1, track: 2 })[c.rbumper];
    const n = [4, 7, 9][lvl], w = [1.3, 1.5, 1.62][lvl], d = [0.26, 0.4, 0.55][lvl], fh = [0.08, 0.13, 0.18][lvl], y0 = [0.05, 0.03, 0.01][lvl];
    Rr(d, 0.045, w, CM.carbon, -2.1 - lvl * 0.03, y0, 0);
    for (let i = 0; i < n; i++) Rr(d - 0.02, fh, 0.012, CM.carbon, -2.11 - lvl * 0.03, y0 + fh / 2, -w / 2 + (i + 0.5) * w / n);
    if (lvl === 2) { Rr(0.03, 0.05, 0.12, CM.tail, -2.27, 0.22, 0); Rr(0.08, 0.03, 0.05, CM.hook, -2.29, 0.14, 0.36); }
  }
  const ex = ({ single: [0.55], dual: [-0.55, 0.55], quad: [-0.66, -0.48, 0.48, 0.66], center: [0] })[c.exhaust];
  const er = c.exhaust === 'center' ? 0.075 : 0.05;
  for (const z of ex) { add(cyl(er, 0.16, 16), CM.chrome, -M.L, clr + M.exY, z * M.zr, 0, 0, Math.PI / 2); add(cyl(er * 0.72, 0.162, 16), CM.well, -M.L, clr + M.exY, z * M.zr, 0, 0, Math.PI / 2); }

  // hood parts (on the Vanta GT they land on the engine cover)
  const hxm = (x) => x + M.hoodShift, hz = M.hz;
  const hoodSlope = Math.atan2(lerpPts(M.TOP, M.hoodSlope[1]) - lerpPts(M.TOP, M.hoodSlope[0]), M.hoodSlope[1] - M.hoodSlope[0]);
  if (c.hood === 'scoop') { add(bx(0.55, 0.08, 0.5 * hz), CM.plain, hxm(1.18), yt(hxm(1.18)) + 0.035, 0, 0, 0, hoodSlope); add(bx(0.02, 0.05, 0.42 * hz), CM.dark, hxm(1.455), yt(hxm(1.45)) + 0.045, 0); }
  if (c.hood === 'bulge') { add(bx(0.95, 0.05, 0.62 * hz), CM.plain, hxm(1.28), yt(hxm(1.28)) + 0.012, 0, 0, 0, hoodSlope); add(bx(0.7, 0.035, 0.42 * hz), CM.plain, hxm(1.22), yt(hxm(1.22)) + 0.045, 0, 0, 0, hoodSlope); }
  if (c.hood === 'louvers') for (const s of [1, -1]) for (let k = 0; k < 6; k++) { const x = hxm(1.05 + k * 0.11); add(bx(0.07, 0.02, 0.3 * hz), CM.well, x, yt(x) + 0.025, s * 0.36 * hz, 0, 0, hoodSlope + 0.35); }
  if (c.hood === 'vents') for (const s of [1, -1]) for (let k = 0; k < 4; k++) add(bx(0.05, 0.012, 0.24 * hz), CM.well, hxm(1.2 + k * 0.1), yt(hxm(1.2 + k * 0.1)) + 0.03, s * 0.42 * hz, 0, 0, hoodSlope);

  // skirts
  if (c.skirt !== 'stock') for (const s of [1, -1]) {
    const z = hw(0, 0.05, 1) + 0.0, [sl, sx, fins] = M.skirt;
    add(bx(sl, 0.1, 0.07), c.skirt === 'sport' ? CM.plain : CM.carbon, sx, clr + 0.04, s * z);
    if (c.skirt !== 'sport') add(bx(sl, 0.015, 0.12), CM.carbon, sx, clr - 0.01, s * (z + 0.02));
    if (c.skirt === 'aero') for (const x of fins) add(bx(0.16, 0.12, 0.012), CM.carbon, x, clr + 0.08, s * (z + 0.075));
  }
  // widebody rivets
  if (c.width === 'wide') for (const xw of [XF, XR]) for (const s of [1, -1]) for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.05 + k * 0.9 / 8), px = xw + Math.cos(a) * (Ra + 0.05), py = cyA + Math.sin(a) * (Ra + 0.05);
    if (py > yb(px) - 0.02 || py < clr) continue;
    add(new THREE.SphereGeometry(0.014, 6, 4), CM.chrome, px, py, s * (hw(px, rel(py), 1) + 0.004));
  }

  // overfenders: segmented bolt-on arches
  if (c.width === 'over') for (const xw of [XF, XR]) for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
    const a0 = Math.PI * k / 7, a1 = Math.PI * (k + 1) / 7, am = (a0 + a1) / 2, r2 = Ra + 0.045;
    const px = xw + Math.cos(am) * r2, py = cyA + Math.sin(am) * r2;
    if (py < clr - 0.02) continue;
    const z = hw(px, rel(py), 1) + 0.03;
    add(bx(2 * r2 * Math.sin((a1 - a0) / 2) + 0.012, 0.075, 0.11), CM.plain, px, py, s * z, 0, 0, am + Math.PI / 2);
    add(new THREE.SphereGeometry(0.014, 6, 4), CM.chrome, px + Math.cos(am) * 0.01, py + Math.sin(am) * 0.01, s * (z + 0.057));
  }

  // spoilers: Raven coordinates from the tail; a hatch mounts its wing on the roof edge on shorter stands
  const wing = c.wingColor === 'body' ? CM.plain : CM.carbon, wz = M.wz, wy = M.wy, wp = M.wp || 1;
  const foil = (chord, depth, th) => {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(chord * 0.44, th * 2.8, chord, th * 1.2); f.lineTo(chord, 0); f.quadraticCurveTo(chord * 0.5, th * 0.8, 0, -th); f.closePath();
    const g = new THREE.ExtrudeGeometry(f, { depth, bevelEnabled: false, curveSegments: 4 }); g.translate(-chord, 0, -depth / 2); return g;
  };
  const y0 = mountY(rx(-1.98));
  const lipX = M.deck ? M.deck[0] : rx(-2.08), duckX = M.deck ? M.deck[1] : rx(-2.03), dw = M.deck ? M.deck[2] : 1;
  if (c.spoiler === 'lip') add(bx(0.2, 0.035, 1.5 * wz * dw), CM.plain, lipX, mountY(lipX) + 0.02, 0, 0, 0, -0.18);
  if (c.spoiler === 'duck') add(bx(0.36, 0.08, 1.62 * wz * dw), CM.plain, duckX, mountY(duckX) + 0.04, 0, 0, 0, -0.22);
  if (c.spoiler === 'roof') add(bx(0.26, 0.03, 1.12 * M.rz), CM.plain, M.roofSp[0], roofY(M.roofSp[1]) + 0.0, 0, 0, 0, -0.12);
  if (c.spoiler === 'gt') {
    for (const s of [1, -1]) { add(bx(0.09, 0.36 * wy, 0.035), CM.dark, rx(-1.98), y0 + 0.18 * wy, s * 0.42 * wz, 0, 0, -0.12); add(bx(0.55 * wp, 0.26 * wp, 0.02), wing, rx(-2.1), y0 + 0.36 * wy, s * 0.92 * wz); }
    add(foil(0.5, 1.82 * wz, 0.025), wing, rx(-1.86), y0 + 0.38 * wy, 0, 0, 0, 0.08);
  }
  if (c.spoiler === 'swan') {
    for (const s of [1, -1]) {
      add(bx(0.05, 0.6 * wy, 0.03), CM.dark, rx(-1.93), y0 + 0.28 * wy, s * 0.4 * wz, 0, 0, -0.22);
      add(bx(0.2, 0.04, 0.03), CM.dark, rx(-2.04), y0 + 0.57 * wy, s * 0.4 * wz);
      add(bx(0.04, 0.08, 0.03), CM.dark, rx(-2.12), y0 + 0.53 * wy, s * 0.4 * wz);
      add(bx(0.6 * wp, 0.3 * wp, 0.02), wing, rx(-2.12), y0 + 0.46 * wy, s * 0.94 * wz);
    }
    add(foil(0.55, 1.86 * wz, 0.027), wing, rx(-1.86), y0 + 0.44 * wy, 0, 0, 0, 0.1);
  }
  if (c.spoiler === 'tri') {
    for (const s of [1, -1]) { add(bx(0.09, 0.4 * wy, 0.035), CM.dark, rx(-1.98), y0 + 0.2 * wy, s * 0.42 * wz, 0, 0, -0.12); add(bx(0.62 * wp, 0.36 * wp, 0.02), wing, rx(-2.13), y0 + 0.4 * wy, s * 0.91 * wz); }
    add(foil(0.5, 1.8 * wz, 0.024), wing, rx(-1.86), y0 + 0.36 * wy, 0, 0, 0, 0.05);
    add(foil(0.28, 1.8 * wz, 0.018), wing, rx(-2.28), y0 + 0.44 * wy, 0, 0, 0, 0.45);
  }
  // roof add-ons
  if (c.roof === 'scoop') { add(bx(0.5, 0.08, 0.34 * M.rz), CM.plain, M.roofMid, roofY(M.roofMid) + 0.05, 0); add(bx(0.02, 0.05, 0.28 * M.rz), CM.well, M.roofMid + 0.25, roofY(M.roofMid + 0.25) + 0.06, 0); }
  if (c.roof === 'vortex') for (let i = 0; i < 7; i++) { const z = (-0.45 + i * 0.15) * M.rz; add(bx(0.09, 0.05, 0.008), CM.dark, M.roofRearX, roofY(M.roofRearX) + 0.035, z, 0, z > 0 ? 0.25 : -0.25, 0); }
  if (c.roof === 'louvers') for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, x = M.louver[0] - t * M.louver[1]; add(bx(0.05, 0.012, (1.08 - t * 0.15) * M.rz), CM.dark, x, roofY(x) + 0.035, 0, 0, 0, M.louver[2]); }

  // wheels (kept separate so they can turn)
  const wheels = [];
  const zOut = (xw) => hw(xw, 0.3, 1) - (c.susp === 'stance' ? 0.005 : 0.04) + (c.width === 'over' ? 0.06 : 0);
  for (const xw of [XF, XR]) for (const s of [1, -1]) {
    const wg = buildWheel(c, xw > 0, RW);
    wg.position.set(xw, RW, s * (zOut(xw) - 0.12));
    if (s < 0) wg.rotation.y = Math.PI;
    wg.userData.side = s; wheels.push(wg);
  }
  return { car, clr, wheels, dims: { front: M.L, rear: -M.L, xf: XF, xr: XR, r: RW, exY: clr + M.exY, exZ: 0.55 * M.zr } };
}

function buildWheel(c, front, R = 0.33) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; g.add(m); return m; };
  const zc = (geo) => { geo.rotateX(Math.PI / 2); return geo; };
  const rr = R * ({ 17: 0.62, 18: 0.68, 19: 0.74, 20: 0.8 })[c.rimSize];
  // tire with rounded sidewalls (lathe), axis along z
  const prof = [[rr + 0.012, -0.12], [R - 0.035, -0.12], [R - 0.008, -0.1], [R, -0.06], [R, 0.06], [R - 0.008, 0.1], [R - 0.035, 0.12], [rr + 0.012, 0.12]].map(([r, a]) => new THREE.Vector2(r, a));
  add(zc(new THREE.LatheGeometry(prof, 30)), CM.tire, 0, 0, 0);
  const lip = c.rimStyle === 'deep' ? 0.22 : 0.06;
  add(zc(new THREE.CylinderGeometry(rr, rr, 0.22, 28, 1, true)), CM.rim, 0, 0, 0);
  add(new THREE.CircleGeometry(rr * 0.98, 28), CM.rimDark, 0, 0, -0.05);
  add(new THREE.RingGeometry(rr * (1 - lip), rr * 1.01, 28), c.rimStyle === 'deep' ? CM.chrome : CM.rim, 0, 0, 0.111);
  // brake
  const big = c.brakes === 'ceramic' ? 0.9 : (c.brakes === 'sport' ? 0.82 : 0.7), br = rr * (1 - lip) * big * 0.95;
  add(zc(new THREE.CylinderGeometry(br, br, 0.025, 26)), CM.disc, 0, 0, 0.0);
  const ca = front ? 2.2 : 0.95;
  add(new THREE.BoxGeometry(0.075, br * 0.8, 0.07), CM.caliper, Math.cos(ca) * br * 0.82, Math.sin(ca) * br * 0.82, 0.02, ca);
  // spokes
  const zf = 0.09, st = c.rimStyle;
  const spoke = (ang, len0, len1, w, mat = CM.rim, z = zf, t = 0.035) => {
    const L = len1 - len0, m = add(new THREE.BoxGeometry(L, w, t), mat, Math.cos(ang) * (len0 + L / 2), Math.sin(ang) * (len0 + L / 2), z, ang); return m;
  };
  const rot = 0.3;
  if (st === 'classic') for (let i = 0; i < 5; i++) spoke(rot + i * Math.PI * 2 / 5, rr * 0.12, rr * 0.96, rr * 0.2);
  if (st === 'six') for (let i = 0; i < 6; i++) { spoke(rot + i * Math.PI / 3, rr * 0.12, rr * 0.96, rr * 0.22); spoke(rot + i * Math.PI / 3, rr * 0.3, rr * 0.9, rr * 0.04, CM.rimDark, zf + 0.019, 0.004); }
  if (st === 'mesh') {
    for (let i = 0; i < 10; i++) spoke(rot + i * Math.PI / 5, rr * 0.14, rr * 0.96, rr * 0.06, CM.rim, zf, 0.025);
    for (let i = 0; i < 10; i++) spoke(rot + i * Math.PI / 5 + 0.31, rr * 0.4, rr * 0.95, rr * 0.035, CM.rim, zf - 0.01, 0.02);
    add(new THREE.TorusGeometry(rr * 0.55, 0.008, 6, 30), CM.rim, 0, 0, zf);
  }
  if (st === 'y') for (let i = 0; i < 5; i++) { const a0 = rot + i * Math.PI * 2 / 5; spoke(a0, rr * 0.12, rr * 0.55, rr * 0.17); spoke(a0 + 0.17, rr * 0.5, rr * 0.96, rr * 0.09); spoke(a0 - 0.17, rr * 0.5, rr * 0.96, rr * 0.09); }
  if (st === 'aero') {
    add(zc(new THREE.CylinderGeometry(rr * 0.95, rr * 0.95, 0.03, 28)), CM.rim, 0, 0, zf);
    for (let i = 0; i < 6; i++) { const a0 = rot + i * Math.PI / 3; add(zc(new THREE.CylinderGeometry(rr * 0.15, rr * 0.15, 0.034, 12)), CM.rimDark, Math.cos(a0) * rr * 0.6, Math.sin(a0) * rr * 0.6, zf + 0.002); }
  }
  if (st === 'deep') for (let i = 0; i < 6; i++) spoke(rot + i * Math.PI / 3, rr * 0.12, rr * 0.8, rr * 0.18, CM.rim, 0.04);
  add(zc(new THREE.CylinderGeometry(rr * 0.17, rr * 0.19, 0.04, 14)), CM.rim, 0, 0, zf + 0.01);
  for (let i = 0; i < 5; i++) { const a0 = 0.6 + i * Math.PI * 2 / 5; add(zc(new THREE.CylinderGeometry(rr * 0.035, rr * 0.035, 0.03, 6)), CM.chrome, Math.cos(a0) * rr * 0.26, Math.sin(a0) * rr * 0.26, zf + 0.02); }
  add(zc(new THREE.CylinderGeometry(rr * 0.08, rr * 0.08, 0.044, 10)), CM.chrome, 0, 0, zf + 0.012);
  return g;
}

let carRig = null;
