/* ---- dyno (same physics, perfect driver) ---- */
function simRun(c, nos) {
  const me = newRacer(physicsFor(c, 1)), p = me.ph;
  me.noFinish = true; me.tire = 80;
  for (let t = 0; t < 1.5; t += H) stepRacer(me, me.rpm < p.redline * 0.6, H, 'stage', 1);
  launch(me); me.time = 0; me.rt = 0;
  let t100 = 0, et = 0, trap = 0, vmax = 0;
  for (let i = 0; i < 240 * 60 && me.x < 3000 && !me.blown; i++) {
    if (me.shiftT <= 0 && me.clutchT <= 0 && me.gear < 6 && me.rpm / p.redline >= 0.93) shiftGear(me, 1);
    if (nos && me.bottles > 0 && me.nosT <= 0 && me.gear >= 3) { me.bottles--; me.nosT = p.nosDur; }
    stepRacer(me, !(me.gear === 6 && me.rpm > p.redline * 0.985), H, 'run', 1);
    if (!t100 && me.v >= 27.78) t100 = me.time;
    if (!et && me.x >= RACE_LEN) { et = me.time; trap = me.v * 3.6; if (nos) break; }
    vmax = Math.max(vmax, me.v);
  }
  return { t100: t100 || 99, et: et || 99, trap, vmax: vmax * 3.6 };
}
const dynoCache = new Map();
function dyno(c) {
  const key = ['model', 'engine', 'turbo', 'nitro', 'gearbox', 'tires', 'finalDrive', 'ecu', 'nitroTune', 'spoiler', 'width', 'hood', 'skirt', 'fbumper', 'roof'].map((k) => c[k]).join('|');
  if (dynoCache.has(key)) return dynoCache.get(key);
  const ph = physicsFor(c, 1);
  let peakHp = 0, peakHpR = 0, peakNm = 0, peakNmR = 0;
  for (let r = 1000; r <= ph.redline; r += 50) {
    const T = ph.tpk * ph.curve(r / ph.redline), hp = T * r * Math.PI / 30 / 745.7;
    if (hp > peakHp) { peakHp = hp; peakHpR = r; } if (T > peakNm) { peakNm = T; peakNmR = r; }
  }
  const a = simRun(c, false), b = c.nitro ? simRun(c, true) : a;
  const res = { peakHp, peakHpR, peakNm, peakNmR, t100: a.t100, et: a.et, trap: a.trap, vmax: a.vmax, etN: b.et };
  dynoCache.set(key, res);
  return res;
}
function renderDyno(p, head, left) {
  const ph = physicsFor(cfg, 1), d = dyno(cfg);
  left.append(el('div', 'p-name', Math.round(d.peakHp) + ' HP · ' + Math.round(d.peakNm) + ' NM'));
  head.append(el('div', 'p-desc', 'Simulated pulls: warm tyres, perfect launch, shifts at 93% of the redline.'));
  const box = el('div', 'dyno');
  const cv = el('canvas'); cv.width = 1000; cv.height = 300; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Power and torque curves against engine speed');
  const dl = el('dl', 'dyno-grid');
  const row = (k, v) => dl.append(el('dt', null, k), el('dd', null, v));
  row('Peak power', Math.round(d.peakHp) + ' hp @ ' + d.peakHpR + ' rpm');
  row('Peak torque', Math.round(d.peakNm) + ' Nm @ ' + d.peakNmR + ' rpm');
  row('0–100 km/h', d.t100.toFixed(2) + ' s');
  row('1/4 mile', d.et.toFixed(2) + ' s @ ' + Math.round(d.trap) + ' km/h');
  row('1/4 mile + nitro', cfg.nitro ? d.etN.toFixed(2) + ' s' : 'No nitro fitted');
  row('Top speed', Math.round(d.vmax) + ' km/h');
  row('Redline · final drive', ph.redline + ' rpm · ' + ph.final.toFixed(2));
  box.append(cv, dl); p.append(box);
  const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, L = 64, Rr = 64, T = 18, B = 40;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6d6';
  const r0 = 1000, r1 = ph.redline, xs = (r) => L + (r - r0) / (r1 - r0) * (W - L - Rr);
  const maxHp = Math.ceil(d.peakHp * 1.15 / 50) * 50, maxNm = Math.ceil(d.peakNm * 1.15 / 50) * 50;
  const yHp = (v) => Hh - B - v / maxHp * (Hh - T - B), yNm = (v) => Hh - B - v / maxNm * (Hh - T - B);
  g.clearRect(0, 0, W, Hh);
  g.font = '600 15px Inter, sans-serif'; g.textBaseline = 'middle';
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1;
  for (let r = 1000; r <= r1; r += 1000) { g.beginPath(); g.moveTo(xs(r), T); g.lineTo(xs(r), Hh - B); g.stroke(); g.fillStyle = 'rgba(236,238,245,0.6)'; g.textAlign = 'center'; g.fillText(String(r / 1000) + 'k', xs(r), Hh - B + 20); }
  for (let i = 0; i <= 4; i++) {
    const y = T + i * (Hh - T - B) / 4; g.beginPath(); g.moveTo(L, y); g.lineTo(W - Rr, y); g.stroke();
    g.textAlign = 'right'; g.fillStyle = accent; g.fillText(String(Math.round(maxHp * (1 - i / 4))), L - 10, y);
    g.textAlign = 'left'; g.fillStyle = 'rgba(236,238,245,0.75)'; g.fillText(String(Math.round(maxNm * (1 - i / 4))), W - Rr + 10, y);
  }
  g.textAlign = 'center'; g.fillStyle = 'rgba(236,238,245,0.6)'; g.fillText('RPM', W / 2, Hh - 10);
  const line = (fn, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); for (let r = r0; r <= r1; r += 50) { const y = fn(r); r === r0 ? g.moveTo(xs(r), y) : g.lineTo(xs(r), y); } g.stroke(); };
  line((r) => yNm(ph.tpk * ph.curve(r / ph.redline)), 'rgba(236,238,245,0.85)', 3);
  line((r) => yHp(ph.tpk * ph.curve(r / ph.redline) * r * Math.PI / 30 / 745.7), accent, 4);
  g.fillStyle = 'rgba(59,255,138,0.12)'; g.fillRect(xs(ph.redline * 0.9), T, xs(ph.redline * 0.975) - xs(ph.redline * 0.9), Hh - T - B);
  g.textAlign = 'left'; g.font = 'italic 700 16px "Chakra Petch", sans-serif';
  g.fillStyle = accent; g.fillText('POWER (HP)', L + 8, T + 12);
  g.fillStyle = 'rgba(236,238,245,0.85)'; g.fillText('TORQUE (NM)', L + 130, T + 12);
  g.fillStyle = '#3bff8a'; g.fillText('SHIFT WINDOW', xs(ph.redline * 0.9) - 130, T + 12);
}

/* ---- AI ---- */
function aiThink(c, prof, phase) {
  const p = c.ph;
  if (phase === 'burnout') return race.t < 2.2;
  if (phase !== 'run' || !c.launched) return c.rpm < p.redline * prof.launch;
  if (c.shiftT <= 0 && c.clutchT <= 0 && c.gear < 6 && c.rpm / p.redline >= prof.next) { shiftGear(c, 1); prof.next = Math.min(0.97, prof.shift + (Math.random() - 0.5) * prof.jitter); }
  if (c.bottles > 0 && c.nosT <= 0 && c.gear >= prof.nos && c.shiftT <= 0) { c.bottles--; c.nosT = p.nosDur; }
  return true;
}
function changeLane(c, d) {
  const lanes = race.lanes, nl = c.lane + d;
  if (c.laneT > 0 || nl < 0 || nl >= lanes.length || c.crashed || c.done) return false;
  const other = c === race.me ? race.ai : race.me;
  if (other && other.lane === nl && Math.abs(other.x - c.x) < 5.4) return false;
  c.zFrom = c.z; c.lane = nl; c.laneT = 0.3; return true;
}
const halfOf = (c) => noseOf(c === race.me ? carRig : rivalRig) - 0.05;
const blockedLane = (lane, x0, x1) => race.cars.some((t) => t.lane === lane && t.x + 2.2 > x0 && t.x - 2.2 < x1);
function aiAvoid(c) {
  if (!race.cars.length || c.laneT > 0 || !c.launched || c.crashed) return;
  const look = 10 + c.v * race.prof.look, cx = c.x - halfOf(c);
  if (!blockedLane(c.lane, cx, c.x + look)) return;
  const opts = [c.lane - 1, c.lane + 1].filter((l) => l >= 0 && l < race.lanes.length).sort(() => Math.random() - 0.5);
  for (const l of opts) if (!blockedLane(l, cx - 6, c.x + look)) { changeLane(c, l - c.lane); return; }
}
