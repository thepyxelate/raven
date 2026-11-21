/* ---- physics ---- */
const ROAD_DRAG = 0.42, TOP_GEAR = 0.7;
function cdaOf(c) { return 0.62 + modelOf(c).base.cda + ({ none: 0, lip: 0.005, duck: 0.01, roof: 0.008, gt: 0.05, swan: 0.045, tri: 0.07 })[c.spoiler] + ({ stock: 0, wide: 0.03, over: 0.025 })[c.width]; }
// top speed on the open road, km/h: where engine power meets drag, or the redline in top gear, whichever comes first
function topSpeed(c, hp, weight) {
  const M = modelOf(c), P = hp * 745.7 * 0.88, a = ROAD_DRAG * cdaOf(c), b = 0.015 * (weight + 80) * 9.81;
  let v = 60; for (let i = 0; i < 30; i++) v = Math.cbrt(Math.max(0, P - b * v) / a);
  const vg = (M.base.redline + c.engine * 300) * Math.PI / 30 * M.R / (TOP_GEAR * (c.finalDrive || 4.1));
  return Math.min(v, vg) * 3.6;
}
function physicsFor(c, factor) {
  const s = stats(c), M = modelOf(c), B = M.base;
  const redline = B.redline + c.engine * 300;
  // a model's torque bias moves the curve: muscle torque comes early, small revvy engines peak late
  const pk = (({ low: 0.5, balanced: 0.62, high: 0.74 })[c.ecu] || 0.62) - B.bias * 0.5;
  const base = (({ low: 0.62, balanced: 0.55, high: 0.45 })[c.ecu] || 0.55) + B.bias;
  const fall = ({ low: 0.4, balanced: 0.3, high: 0.2 })[c.ecu] || 0.3;
  const curve = (u) => (u <= pk ? base + (1 - base) * Math.sin(Math.PI / 2 * Math.min(1, Math.max(0, (u - 0.1) / (pk - 0.1)))) : 1 - fall * Math.pow((u - pk) / (1 - pk), 2));
  let best = 0; for (let u = 0.2; u <= 1.0001; u += 0.01) best = Math.max(best, curve(u) * u * redline * Math.PI / 30);
  const nt = ({ long: [1.25, 3.6], balanced: [1.38, 2.6], power: [1.55, 1.8] })[c.nitroTune] || [1.38, 2.6];
  return {
    redline, idle: 950, curve, tpk: s.hp * factor * 745.7 / best, mass: s.weight + 80,
    gears: [3.55, 2.32, 1.7, 1.32, 1.0, 0.7], final: c.finalDrive || 4.1, r: M.R,
    shiftTime: ({ stock: 0.3, sport: 0.19, race: 0.11 })[c.gearbox],
    grip: ({ street: 1.0, sport: 1.12, slick: 1.32 })[c.tires] * 0.74 * B.grip,
    // brakes: share of the tyres' grip they can use, and how much they lose when hot
    brakeK: ({ stock: 0.78, sport: 0.9, ceramic: 1.0 })[c.brakes] || 0.78, fade: ({ stock: 0.45, sport: 0.25, ceramic: 0.05 })[c.brakes] ?? 0.45,
    cda: cdaOf(c),
    bottles: c.nitro, nosMult: nt[0], nosDur: nt[1]
  };
}
const tyreGrip = (t) => 1 + 0.1 * (t < 70 ? Math.max(0, (t - 20) / 50) : t <= 95 ? 1 : Math.max(-0.6, 1 - (t - 95) / 12));
const newRacer = (ph) => ({ ph, x: 0, v: 0, a: 0, rpm: ph.idle, gear: 1, thr: 0, shiftT: 0, clutchT: 0, launchRpm: 0, launchPen: 1, spin: false, spinT: 0, heat: 0, blown: false, nosT: 0, bottles: ph.bottles, boostT: 0, time: 0, t60: 0, done: false, trap: 0, shifts: 0, perfect: 0, wheelA: 0, tire: 22, tireAtLaunch: 22, launched: false, rt: 0, dq: false, crashed: false, lane: 0, z: 0, zFrom: 0, laneT: 0, noFinish: false });

function stepRacer(c, gas, dt, phase, gripMul) {
  const p = c.ph, ratio = p.gears[c.gear - 1] * p.final;
  if (c.blown || c.done || c.crashed || c.dq) gas = false;
  c.thr += ((gas ? 1 : 0) - c.thr) * Math.min(1, dt * 12);
  if (phase !== 'run' || !c.launched) { // held on the brake: free-revving
    const target = c.thr > 0.05 ? p.idle + (p.redline - p.idle) * c.thr * 1.03 : p.idle;
    c.rpm += (target - c.rpm) * Math.min(1, dt * 3.2);
    if (c.rpm > p.redline) c.rpm = p.redline - 200 * Math.random();
    c.heat = c.rpm > p.redline * 0.97 ? Math.min(100, c.heat + 16 * dt) : Math.max(0, c.heat - 10 * dt);
    if (c.heat >= 100) c.blown = true;
    if (phase === 'burnout' && c.thr > 0.3) { c.tire = Math.min(125, c.tire + 24 * dt * c.thr); c.spin = true; c.wheelA += 30 * dt * c.thr; }
    else { c.spin = false; c.tire = Math.max(20, c.tire - 1.2 * dt); }
    if (phase === 'run' && !c.dq) c.time += dt; // reaction clock runs from the green
    return;
  }
  const wheelRpm = c.v / p.r * ratio * 30 / Math.PI;
  let F = 0;
  if (c.shiftT > 0) {
    c.shiftT -= dt;
    c.rpm += (Math.max(p.idle, wheelRpm) - c.rpm) * Math.min(1, dt * 16);
  } else {
    if (c.clutchT > 0) { c.clutchT -= dt; const k = Math.max(0, c.clutchT / 0.55); c.rpm = Math.max(wheelRpm, wheelRpm + (c.launchRpm - wheelRpm) * k); }
    else c.rpm = Math.max(p.idle, wheelRpm * (c.spin ? 1.08 : 1));
    const limiter = c.rpm >= p.redline;
    if (limiter) c.rpm = p.redline - Math.random() * 160;
    let T = limiter || c.blown ? 0 : p.tpk * p.curve(c.rpm / p.redline) * c.thr;
    if (c.nosT > 0) T *= p.nosMult;
    if (c.boostT > 0) T *= 1.06;
    F = T * ratio / p.r * 0.88 * (c.clutchT > 0 ? c.launchPen : 1);
    const grip = p.grip * gripMul * tyreGrip(c.tire) * p.mass * G;
    if (c.spinT > 0 && c.thr > 0.5) { c.spin = true; F = Math.min(F, grip) * 0.62; }
    else if (F > grip * 1.04) { c.spin = true; F = Math.min(F, grip) * 0.84; } else c.spin = false;
    c.heat = limiter && c.thr > 0.5 ? c.heat + 30 * dt : Math.max(0, c.heat - 8 * dt);
    if (c.heat >= 100) c.blown = true;
  }
  c.tire = c.spin ? Math.min(125, c.tire + 8 * dt) : Math.max(20, c.tire - 0.8 * dt);
  c.spinT = Math.max(0, c.spinT - dt); c.nosT = Math.max(0, c.nosT - dt); c.boostT = Math.max(0, c.boostT - dt);
  const drag = 0.6 * p.cda * c.v * c.v + (c.v > 0.05 ? 0.015 * p.mass * G : 0) + (c.done || c.crashed ? 7000 : 0);
  const mEff = p.mass * (1 + 0.0016 * ratio * ratio);
  c.a = (F - drag) / mEff;
  c.v = Math.max(0, c.v + c.a * dt);
  c.x += c.v * dt;
  c.wheelA += (c.v / p.r + (c.spin ? 22 : 0)) * dt;
  if (!c.done && !c.crashed) {
    c.time += dt;
    if (!c.t60 && c.x >= 18.29) c.t60 = c.time;
    if (!c.noFinish && c.x >= RACE_LEN) { c.done = true; c.time -= (c.x - RACE_LEN) / Math.max(c.v, 1); c.trap = c.v * 3.6; }
  }
}
function launch(c) {
  const u = c.rpm / c.ph.redline;
  c.launched = true; c.rt = c.time; c.tireAtLaunch = c.tire;
  c.launchRpm = c.rpm; c.clutchT = 0.55;
  if (c.blown) return ['ENGINE BLOWN', 'bad'];
  if (u >= 0.5 && u <= 0.68) { c.launchPen = 1; return ['PERFECT LAUNCH', '']; }
  if (u >= 0.38 && u < 0.5) { c.launchPen = 0.88; return ['GOOD LAUNCH', 'ok']; }
  if (u > 0.68 && u <= 0.8) { c.launchPen = 1; c.spinT = 0.35; return ['GOOD LAUNCH', 'ok']; }
  if (u < 0.38) { c.launchPen = 0.6; return ['BOGGED DOWN', 'bad']; }
  c.spinT = 1.3; return ['WHEELSPIN', 'bad'];
}
function shiftGear(c, dir) {
  const p = c.ph;
  if (c.shiftT > 0 || c.blown || c.done || c.crashed) return null;
  if (dir > 0) {
    if (c.gear >= 6) return null;
    const u = c.rpm / p.redline; let q, cls = 'ok', t = p.shiftTime;
    if (u >= 0.9 && u < 0.975) { q = 'PERFECT SHIFT'; cls = ''; t *= 0.55; c.boostT = 1; c.perfect++; }
    else if (u >= 0.975) { q = 'LATE SHIFT'; cls = 'bad'; }
    else if (u >= 0.8) q = 'GOOD SHIFT';
    else { q = 'EARLY SHIFT'; cls = 'bad'; }
    c.gear++; c.shiftT = t; c.shifts++;
    return [q, cls];
  }
  if (c.gear <= 1) return null;
  const wr = c.v / p.r * p.gears[c.gear - 2] * p.final * 30 / Math.PI;
  c.gear--; c.shiftT = p.shiftTime;
  if (wr > p.redline * 1.03) { c.heat = Math.min(100, c.heat + 30); if (c.heat >= 100) c.blown = true; return ['OVER-REV!', 'bad']; }
  return ['DOWNSHIFT', 'ok'];
}
