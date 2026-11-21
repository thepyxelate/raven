/* ---- player driving ---- */
const roam = { active: false, y: 0, deck: null, rain: false, gps: null, wp: null, spawn: null, photo: false, mapOpen: false, x: 2.2, z: 200, h: -Math.PI / 2, vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, steer: 0, gear: 1, rpm: 950, shiftT: 0, thr: 0, nos: 1, nosOn: false, drift: false, wheelA: 0, keys: {}, camMode: 0, camH: -Math.PI / 2, shake: 0, chat: false, ph: null, eng: null, smokeT: 0, areaT: 0, meTag: null, saved: null, acc: 0, lat: 0 };
const RKEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'hb', Shift: 'nos', n: 'nos', N: 'nos' };
// Tyre model: sideways force against slip angle. It builds fast, peaks near 9 degrees and then lets go a
// little, which is what makes a slide progressive instead of the car turning as if on rails.
const DRIFT_GRIP = 0.62, SPIN_DAMP = 3.5;
// Handling modes. Realistic is the original model. Balanced keeps the physics but gives more steering lock at speed,
// less artificial yaw damping and a lighter car to turn. Arcade also pulls the car's rotation toward where the wheels
// point and soaks up sideways sliding (except on the handbrake), so the car goes where you steer.
//   lock: steering lock = lock[0] + lock[1] / (1 + (speed / lock[2])^2)   damp: extra yaw damping per second
//   iz: turning inertia factor   follow: how much the wheels self-align with a slide [steering, not steering]
//   rate: steering speed [steering, centring]   assist: arcade yaw/slide assist strength   grip: lateral grip factor
const HANDLING = {
  realistic: { label: 'Realistic', lock: [0.045, 0.5, 11], damp: 0.9, iz: 1.15, follow: [0.5, 0.85], rate: [7, 9], assist: 0, grip: 1 },
  balanced: { label: 'Balanced', lock: [0.07, 0.48, 16], damp: 0.45, iz: 1.0, follow: [0.35, 0.7], rate: [9, 10], assist: 0, grip: 1.05 },
  arcade: { label: 'Arcade', lock: [0.09, 0.46, 20], damp: 0.3, iz: 0.9, follow: [0.2, 0.6], rate: [10, 11], assist: 1, grip: 1.15 }
};
let handling = HANDLING[store.get('handling', 'balanced')] ? store.get('handling', 'balanced') : 'balanced';
function setHandling(id, quiet) {
  handling = id; store.set('handling', id);
  if (!quiet && roam.active) showPop('HANDLING: ' + HANDLING[id].label.toUpperCase(), 'info');
}
const cycleHandling = () => { const ids = Object.keys(HANDLING); setHandling(ids[(ids.indexOf(handling) + 1) % ids.length]); };
const TYRE = (x) => Math.sin(1.35 * Math.atan(15 * x));
function stepPlayer(dt) {
  const R = roam, p = R.ph, k = R.keys, gas = !!k.up, brk = !!k.down, hb = !!k.hb, D = rigDims();
  const fx = Math.cos(R.h), fz = Math.sin(R.h), rx = -fz, rz = fx;
  let vf = R.vx * fx + R.vz * fz, vl = R.vx * rx + R.vz * rz, yr = R.yr || 0;
  const av = Math.abs(vf), sp = Math.hypot(vf, vl);
  const HM = HANDLING[handling] || HANDLING.balanced;
  const gm = R.rain ? 0.8 : 1, mu = p.grip / 0.74 * 1.1 * gm, m = p.mass, muL = mu * HM.grip;
  const a = D.xf, b = -D.xr, L = a + b, Iz = m * a * b * HM.iz;
  // steering: less lock at speed; the wheels also follow the direction of travel a little,
  // so a slide is caught by easing off the key rather than by perfect opposite lock
  const sIn = (k.right ? 1 : 0) - (k.left ? 1 : 0), sMax = HM.lock[0] + HM.lock[1] / (1 + (av / HM.lock[2]) * (av / HM.lock[2]));
  const beta = sp > 5 && vf > 1 ? Math.atan2(vl, vf) : 0;
  const tgt = clamp(sIn * sMax + clamp(beta, -0.5, 0.5) * (sIn ? HM.follow[0] : HM.follow[1]), -0.58, 0.58);
  R.steer += (tgt - R.steer) * Math.min(1, dt * (sIn ? HM.rate[0] : HM.rate[1]));
  // automatic gearbox: shifts up at the redline under power and early when cruising, kicks down when the
  // throttle opens, and drops gears under braking
  const fwd = gas && vf > -0.5, rev = brk && vf < 0.5 && !gas;
  R.liftT = fwd ? 0 : (R.liftT || 0) + dt;
  let ratio = p.gears[R.gear - 1] * p.final, wheelRpm = av / p.r * ratio * 30 / Math.PI;
  if (R.shiftT > 0) R.shiftT -= dt;
  else if (vf > 1) {
    const low = R.gear > 1 ? wheelRpm * p.gears[R.gear - 2] / p.gears[R.gear - 1] : Infinity;
    if (R.gear < 6 && (wheelRpm > p.redline * 0.93 || (!fwd && !brk && R.liftT > 0.9 && wheelRpm > p.redline * 0.58))) { R.gear++; R.shiftT = p.shiftTime; if (R.thr > 0.6) flutter(true); }
    else if (low < p.redline * (fwd ? 0.7 : brk ? 0.6 : 0.36)) { R.gear--; R.shiftT = p.shiftTime * 0.5; if (audio && !fwd) pop(0.05); }
    ratio = p.gears[R.gear - 1] * p.final; wheelRpm = av / p.r * ratio * 30 / Math.PI;
  } else if (R.gear > 1) R.gear = 1;
  R.thr += ((fwd || rev ? 1 : 0) - R.thr) * Math.min(1, dt * 10);
  // nitro: hold Shift; refills slowly, faster while drifting
  R.nosOn = !!k.nos && R.nos > 0.02 && (cfg.nitro > 0 || R.infNos) && fwd;
  if (R.infNos) R.nos = 1;
  else if (R.nosOn) R.nos = Math.max(0, R.nos - dt * 0.3); else R.nos = Math.min(1, R.nos + dt * (R.drift ? 0.1 : 0.03));
  // drive force at the rear wheels; past the tyres' limit they spin
  let Fd = 0, spin = 0;
  const capD = p.grip * 1.3 * m * G * gm;
  if (fwd && R.shiftT <= 0 && wheelRpm < p.redline * 1.01) { // the limiter holds the car at the redline in top gear
    let T = p.tpk * p.curve(Math.min(1, R.rpm / p.redline)) * R.thr;
    if (R.nosOn) T *= p.nosMult;
    Fd = T * ratio / p.r * 0.88;
    if (Fd > capD) { spin = Math.min(1, Fd / capD - 1); Fd = capD; }
  } else if (!rev && !fwd && av > 0.3 && R.shiftT <= 0) Fd = -(8 + 0.011 * R.rpm) * ratio / p.r * Math.sign(vf); // engine braking
  if (rev && vf > -11) Fd = -m * 4.2;
  R.spin = spin;
  const slipR = R.gear === 1 && vf < 7 ? p.idle + (p.redline * 0.55 - p.idle) * R.thr : 0;
  R.rpm += (Math.max(p.idle, wheelRpm * (1 + 0.2 * spin), slipR) - R.rpm) * Math.min(1, dt * 14);
  if (R.rpm > p.redline) R.rpm = p.redline - Math.random() * 150;
  // weight moves to the rear under power and to the front under brakes
  const dW = m * clamp(R.acc, -12, 9) * 0.42 / L * (R.acc < 0 ? 0.22 : 0.5);
  const Fzf = Math.max(0.2 * m * G, m * G * b / L - dW), Fzr = Math.max(0.2 * m * G, m * G * a / L + dW);
  // a drift is held by staying on the power and steering into the turn; ease off either and the rear grips again
  R.dg = (R.dg || 1) + ((R.drift && fwd && sIn * beta < 0 ? DRIFT_GRIP : 1) - (R.dg || 1)) * Math.min(1, dt * 5);
  // front tyres: slip angle between where the wheel points and where it is going
  const V0 = 3.5, cs = Math.cos(R.steer), sn = Math.sin(R.steer);
  const vyf = vl + a * yr, latF = vyf * cs - vf * sn, lonF = vf * cs + vyf * sn;
  const FyF = -muL * Fzf * TYRE(Math.atan2(latF, Math.max(Math.abs(lonF), V0)));
  // rear tyres: power uses up part of their grip (so a heavy foot swings the tail out);
  // the handbrake locks them, and a locked tyre just drags against the way it is sliding
  const vyr = vl - b * yr, rearSlip = Math.atan2(vyr, Math.max(av, V0));
  let FyR, FxR = 0;
  if (hb) { const vr = Math.max(Math.hypot(vf, vyr), V0), f = 0.72 * mu * Fzr; FyR = -f * vyr / vr; FxR = -f * vf / vr; }
  else { const use = Math.min(1, Math.abs(Fd) / capD); FyR = -muL * 1.07 * Fzr * TYRE(rearSlip) * Math.sqrt(1 - 0.62 * use * use) * (1 - 0.2 * spin) * R.dg; }
  const drag = ROAD_DRAG * p.cda * vf * Math.abs(vf) + (av > 0.2 ? 0.015 * m * G * Math.sign(vf) : 0);
  const ax = (Fd - drag - FyF * sn + FxR) / m - G * (R.slopeF || 0), ay = (FyF * cs + FyR) / m;
  // past about 35 degrees of slide the car resists spinning further, unless the handbrake is on
  yr += ((a * FyF * cs - b * FyR) / Iz - yr * (HM.damp + (hb ? 0 : SPIN_DAMP * smooth01((Math.abs(beta) - 0.45) / 0.45)))) * dt;
  vf += ax * dt; vl += ay * dt;
  // arcade assist: turn at the rate the steering asks for, and bleed off sideways sliding unless on the handbrake
  if (HM.assist && !hb && av > 2) {
    // the turn the steering asks for, but never more than the tyres can hold (lateral grip / speed)
    const yMax = muL * G * 1.05 / Math.max(av, 4), want = clamp(vf * Math.tan(R.steer) / L * 0.95, -yMax, yMax);
    yr += (want - yr) * Math.min(1, dt * 3.2 * HM.assist);
    if (!(R.drift && fwd && sIn * beta < 0)) vl -= vl * Math.min(1, dt * 4 * HM.assist);
  }
  let B = 0;
  // brakes heat up with hard stops from speed and cool while you drive; hot stock brakes lose bite
  const bk = (p.brakeK || 0.78) * (1 - (p.fade || 0) * smooth01(((R.bt || 0) - 0.55) / 0.45));
  if (brk && vf > 0.5) B = mu * G * 0.95 * bk; if (gas && vf < -0.5) B = mu * G * 0.95 * bk;
  R.bt = clamp((R.bt || 0) + (B && av > 3 ? B * av * dt / 1800 : 0) - dt * (0.025 + av * 0.0006), 0, 1);
  if (R.bt > 0.8 && p.fade > 0.1 && roamT - (R.btPop || -9) > 6) { R.btPop = roamT; showPop('BRAKES FADING · LET THEM COOL', 'bad'); }
  if (B) { const dv = B * dt; vf = Math.abs(vf) <= dv ? 0 : vf - Math.sign(vf) * dv; }
  if (!gas && !brk && Math.hypot(vf, vl) < 0.3 && Math.abs(R.slopeF || 0) < 0.02) { vf = 0; vl = 0; yr = 0; }
  R.vx = fx * vf + rx * vl; R.vz = fz * vf + rz * vl;
  R.h += yr * dt; R.yr = yr;
  R.x += R.vx * dt; R.z += R.vz * dt;
  R.rearSlip = Math.abs(rearSlip); R.slipA = Math.abs(beta);
  R.drift = sp > 6 && (hb || R.rearSlip > 0.2);
  R.acc += (ax - (B ? B * Math.sign(vf || 1) : 0) - R.acc) * Math.min(1, dt * 4); R.lat += (ay - R.lat) * Math.min(1, dt * 4);
  R.vf = vf; R.vl = vl; R.wheelA += (vf / p.r + spin * 14) * dt;
}
// push the car out of buildings, props, the sea and the edge of the world
const rigDims = () => (carRig && carRig.userData.dims) || { front: 2.25, rear: -2.25, xf: 1.4, xr: -1.36, r: 0.33, exY: 0.28, exZ: 0.55 };
// three collision circles along the body, sized to the current car
const bodyCircles = () => { const o = rigDims().front - 0.8; return [-o, 0, o]; };
function collideStatic() {
  const R = roam, fx = Math.cos(R.h), fz = Math.sin(R.h), HC = world.HC;
  let hit = 0;
  for (let it = 0; it < 2; it++) for (const o of bodyCircles()) {
    const cx = R.x + fx * o, cz = R.z + fz * o, r = 1.0;
    const list = world.hash.get(Math.floor(cx / HC) * 4096 + Math.floor(cz / HC)); if (!list) continue;
    for (const s of list) {
      let nx, nz, pen;
      if (s.prop) {
        if (s.prop.down) continue;
        const sp = Math.hypot(R.vx, R.vz);
        if (sp > 4 && Math.hypot(cx - s.x, cz - s.z) < r + s.r) { knockDown(s.prop, R.vx / sp, R.vz / sp, sp); ambBump(4); R.vx *= 0.88; R.vz *= 0.88; R.shake = Math.min(1, R.shake + 0.25); if (audio) pop(0.18); continue; }
      }
      if (s.t) { const dx = cx - s.x, dz = cz - s.z, d = Math.hypot(dx, dz); if (d >= r + s.r || d < 1e-6) continue; nx = dx / d; nz = dz / d; pen = r + s.r - d; }
      else {
        const px = clamp(cx, s.x0, s.x1), pz = clamp(cz, s.z0, s.z1), dx = cx - px, dz = cz - pz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
        else { const e = [[cx - s.x0, -1, 0], [s.x1 - cx, 1, 0], [cz - s.z0, 0, -1], [s.z1 - cz, 0, 1]].sort((a, b) => a[0] - b[0])[0]; nx = e[1]; nz = e[2]; pen = e[0] + r; }
      }
      R.x += nx * pen; R.z += nz * pen;
      const vn = R.vx * nx + R.vz * nz;
      if (vn < 0) { R.vx -= 1.3 * vn * nx; R.vz -= 1.3 * vn * nz; R.vx *= 0.96; R.vz *= 0.96; hit = Math.max(hit, -vn); }
    }
  }
  if (hit > 3) { R.yr *= 0.5; R.shake = Math.min(1, hit / 18); if (audio) pop(Math.min(0.5, hit / 40)); crashChain(hit); }
}
// Knocked-over props: the prop's vertices in its chunk mesh are collapsed to a point (hidden), and a copy of exactly
// those vertices tips over away from the car, lies on the ground, then sinks. The original comes back later, out of sight.
const fallen = [];
const _fq = new THREE.Quaternion(), _fa = new THREE.Vector3();
function knockDown(p, dx, dz, sp) {
  p.down = true; p.downT = roamT; p.saved = [];
  const g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
  for (const [k, v0, v1, i0, i1] of p.ranges) {
    const m = p.ch.meshes[k]; if (!m) continue;
    const src = m.geometry, ng = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(src.attributes)) {
      const n = a.itemSize, arr = a.array.slice(v0 * n, v1 * n);
      if (name === 'position') for (let j = 0; j < arr.length; j += 3) { arr[j] -= p.x; arr[j + 1] -= p.y; arr[j + 2] -= p.z; }
      ng.setAttribute(name, new THREE.BufferAttribute(arr, n, a.normalized));
    }
    const idx = src.index.array, ni = new Uint32Array(i1 - i0);
    for (let j = i0; j < i1; j++) ni[j - i0] = idx[j] - v0;
    ng.setIndex(new THREE.BufferAttribute(ni, 1)); ng.computeBoundingSphere();
    g.add(new THREE.Mesh(ng, m.material));
    const pos = src.attributes.position; p.saved.push([m, v0, pos.array.slice(v0 * 3, v1 * 3)]);
    for (let j = v0; j < v1; j++) pos.setXYZ(j, p.x, p.y - 30, p.z);
    if (pos.addUpdateRange) pos.addUpdateRange(v0 * 3, (v1 - v0) * 3);
    pos.needsUpdate = true;
  }
  if (p.sig !== undefined) { const M = new THREE.Matrix4().makeScale(0, 0, 0); world.sigMesh.setMatrixAt(p.sig, M); world.sigMesh.instanceMatrix.needsUpdate = true; }
  world.group.add(g);
  // tip about the horizontal axis at right angles to the hit, so the top falls the way the car was going
  fallen.push({ p, g, ax: dz, az: -dx, dx, dz, ang: 0, w: Math.min(2.2, 0.4 + sp * 0.06), slide: Math.min(4, sp * 0.12), t: 0 });
}
function restoreProp(p) {
  for (const [m, v0, arr] of p.saved) {
    const pos = m.geometry.attributes.position; pos.array.set(arr, v0 * 3);
    if (pos.addUpdateRange) pos.addUpdateRange(v0 * 3, arr.length);
    pos.needsUpdate = true;
  }
  if (p.sig !== undefined) { const h = world.sigHeads[p.sig]; world.sigMesh.setMatrixAt(p.sig, new THREE.Matrix4().makeTranslation(h.x, 5.05, h.z)); world.sigMesh.instanceMatrix.needsUpdate = true; }
  p.saved = null; p.down = false;
}
function fallenFrame(dt) {
  for (let i = fallen.length - 1; i >= 0; i--) {
    const f = fallen[i]; f.t += dt;
    if (f.ang < 1.42) { f.w += 3.2 * Math.sin(f.ang + 0.08) * dt; f.ang = Math.min(1.42, f.ang + f.w * dt); if (f.ang >= 1.42) f.w = 0; }
    if (f.slide > 0) { const d = f.slide * dt; f.g.position.x += f.dx * d; f.g.position.z += f.dz * d; f.slide = Math.max(0, f.slide - dt * 6); }
    _fa.set(f.ax, 0, f.az); f.g.quaternion.copy(_fq.setFromAxisAngle(_fa, f.ang));
    if (f.t > 14) f.g.position.y -= dt * 0.6; // sink into the ground
    if (f.t > 18) { world.group.remove(f.g); f.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); fallen.splice(i, 1); }
  }
  // put props back after a while, once the player is far enough not to see it happen
  if (!world.props) return;
  for (const p of world.props) if (p.down && p.saved && roamT - p.downT > 45 && Math.hypot(p.x - roam.x, p.z - roam.z) > 90 && !fallen.some((f) => f.p === p)) restoreProp(p);
}
// ramps, the viaduct, the bridge and the Skyway: ride the deck, bounce off its rails, can't drive into its sides
function deckUpdate() {
  const R = roam, fx = Math.cos(R.h), fz = Math.sin(R.h);
  const bounce = (nx, nz) => { // (nx, nz) points back to where the car is allowed to be
    const vn = R.vx * nx + R.vz * nz;
    if (vn < 0) { R.vx -= 1.3 * vn * nx; R.vz -= 1.3 * vn * nz; R.vx *= 0.97; R.vz *= 0.97; if (-vn > 4) { R.shake = Math.min(1, -vn / 18); if (audio) pop(Math.min(0.5, -vn / 40)); crashChain(-vn); } }
  };
  R.slopeF = 0;
  if (R.deck) {
    const r = R.deck, pr = projectRoad(r, R.x, R.z), h = r.hAt(pr.s);
    if (pr.d > r.w || h < 0.02) { R.deck = null; R.y = 0; return; }
    R.y = h;
    const t = rPoint(r, pr.s), nx = -t.tz, nz = t.tx, lim = r.w / 2 - 1.05;
    if (Math.abs(pr.lat) > lim) { const sg = Math.sign(pr.lat), push = Math.abs(pr.lat) - lim; R.x -= nx * sg * push; R.z -= nz * sg * push; bounce(-nx * sg, -nz * sg); }
    R.slopeF = (r.hAt(pr.s + 1) - r.hAt(pr.s - 1)) / 2 * (fx * t.tx + fz * t.tz);
    return;
  }
  R.y = 0;
  for (const r of ELEVATED) {
    const pr = projectRoad(r, R.x, R.z); if (pr.d > r.w / 2 + 1.5) continue;
    const h = r.hAt(pr.s), a = Math.abs(pr.lat);
    if (a < r.w / 2 - 0.4 && h < 0.5) { if (h > 0.02) { R.deck = r; R.y = h; } continue; }
    if (a < r.w / 2 + 0.9 && h >= 0.5 && h < 4.6) {
      const t = rPoint(r, pr.s), nx = -t.tz, nz = t.tx, sg = Math.sign(pr.lat) || 1, push = r.w / 2 + 0.9 - a;
      R.x += nx * sg * push; R.z += nz * sg * push; bounce(nx * sg, nz * sg);
    }
  }
}
function collideVehicles() {
  const R = roam, fx = Math.cos(R.h), fz = Math.sin(R.h);
  for (const c of veh) {
    if (!c.bot) continue; // street traffic is a ghost: you drive straight through it
    if (Math.abs(c.x - R.x) > 7 || Math.abs(c.z - R.z) > 7 || Math.abs((c.y || 0) - R.y) > 2) continue;
    for (const o of bodyCircles()) for (const q of [-1.2, 1.2]) {
      const px = R.x + fx * o, pz = R.z + fz * o, qx = c.x + c.tx * q, qz = c.z + c.tz * q;
      const dx = px - qx, dz = pz - qz, d = Math.hypot(dx, dz); if (d >= 2 || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d, pen = 2 - d;
      R.x += nx * pen; R.z += nz * pen;
      const rvx = R.vx - c.tx * c.v, rvz = R.vz - c.tz * c.v, vn = rvx * nx + rvz * nz;
      if (vn < 0) { R.vx -= 1.25 * vn * nx; R.vz -= 1.25 * vn * nz; if (-vn > 3) { R.shake = Math.min(1, -vn / 18); if (audio) pop(Math.min(0.5, -vn / 40)); crashChain(-vn); } }
      c.hitT = c.bot ? 0.6 : 2.2;
    }
  }
}
function attachAt(e, s) { const hA = e.road.hAt, h = hA ? hA(s) : 0; roam.deck = h > 0.02 ? e.road : null; roam.y = roam.deck ? h : 0; }
function resetToRoad() {
  let best = null, bd = Infinity;
  for (const e of world.edges) for (let s = e.lo + 6; s < e.hi - 6; s += 10) { const p = rPoint(e.road, s), d = Math.hypot(p.x - roam.x, p.z - roam.z) + (e.road.hAt ? e.road.hAt(s) * 3 : 0); if (d < bd) { bd = d; best = { e, s }; } }
  if (!best) return;
  const p = lanePose(best.e, 1, laneOff(best.e.type, 0), best.s);
  Object.assign(roam, { x: p.x, z: p.z, h: Math.atan2(p.tz, p.tx), vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, gear: 1, steer: 0 });
  attachAt(best.e, best.s); deckUpdate();
  roam.camH = roam.h;
}
function areaName(x, z) {
  if (z > 1070) return 'NEON ISLAND';
  if (Math.abs(x + 200) < 12 && z > 650) return 'HARBOR BRIDGE';
  if (inTunnel(x, z)) return 'WEST TUNNEL';
  if (Math.abs(z + 900) < 14 && Math.abs(x) < 620) return 'NORTH VIADUCT';
  if (x > 805 && x < 905 && z > -260 && z < -140) return 'SKYWAY RAMP';
  if (z > 645) return x > 455 && x < 805 ? 'HARBOR PIER' : 'PALM COAST BEACH';
  if (Math.abs(z - 640) < 12) return 'COAST BOULEVARD';
  if (Math.abs(x) > 820 || z < -820) return 'RING HIGHWAY';
  if (x > 400) return 'HARBOR DISTRICT';
  if (Math.abs(x) <= 400 && z > -400 && z < 300) return 'DOWNTOWN';
  if (z >= 300) return 'SUNSET SHORE';
  if (z < -400) return 'NORTH HILLS';
  return 'WESTSIDE';
}
