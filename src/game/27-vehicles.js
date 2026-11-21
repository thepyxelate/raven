/* ---- vehicles that drive the lane graph: traffic and bots ---- */
const veh = [];
const roadSpeed = (type, bot) => (bot ? { street: 17, avenue: 25, highway: 34 } : { street: 11, avenue: 14, highway: 22 })[type];
function pickNext(c, node) {
  if (c.route) { const i = c.ri + 1; if (i < c.route.length) return { ...c.route[i], ri: i }; if (c.loop) return { ...c.route[0], ri: 0 }; }
  const from = c.e, opts = node.edges.filter((e) => e !== from);
  if (!opts.length) return { e: from, dir: -c.dir };
  const tin = lanePose(from, c.dir, 0, c.dir > 0 ? from.hi : from.lo);
  let tot = 0;
  const ws = opts.map((e) => {
    const dir = e.a === node ? 1 : -1, t = lanePose(e, dir, 0, dir > 0 ? e.lo : e.hi), dot = t.tx * tin.tx + t.tz * tin.tz;
    let w = dot > 0.9 ? 3 : 1; if (c.bot && e.type !== 'street') w *= 2.5; tot += w; return { e, dir, w };
  });
  let r = Math.random() * tot; for (const o of ws) { r -= o.w; if (r <= 0) return o; }
  return ws[0];
}
function placeOnEdge(c, e, dir, s, lane, ri) {
  Object.assign(c, { e, dir, s, lane: Math.min(lane, LANES_DIR[e.type] - 1), mode: 'edge' });
  if (ri !== undefined) c.ri = ri; else if (c.route && !c.route.some((st) => st.e === e)) c.route = null;
  c.off = laneOff(e.type, c.lane); c.nx = pickNext(c, dir > 0 ? e.b : e.a); c.vBase = roadSpeed(e.type, c.bot) * c.mult * (c.racing ? c.raceMult : 1);
  poseVeh(c);
}
function poseVeh(c) {
  if (c.mode === 'edge') {
    const p = lanePose(c.e, c.dir, c.off, c.s), hA = c.e.road.hAt; c.x = p.x; c.z = p.z; c.tx = p.tx; c.tz = p.tz;
    c.y = hA ? hA(c.s) : 0; c.slope = hA ? (hA(c.s + 1) - hA(c.s - 1)) / 2 * c.dir : 0; return;
  }
  c.y = 0; c.slope = 0;
  const b = c.bz, u = clamp(b.u, 0, 1), k = 1 - u;
  c.x = k * k * b.p0[0] + 2 * k * u * b.p1[0] + u * u * b.p2[0]; c.z = k * k * b.p0[1] + 2 * k * u * b.p1[1] + u * u * b.p2[1];
  let dx = 2 * k * (b.p1[0] - b.p0[0]) + 2 * u * (b.p2[0] - b.p1[0]), dz = 2 * k * (b.p1[1] - b.p0[1]) + 2 * u * (b.p2[1] - b.p1[1]);
  const l = Math.hypot(dx, dz) || 1; c.tx = dx / l; c.tz = dz / l;
}
function beginTurn(c) {
  const nx = c.nx, lane = Math.min(c.lane, LANES_DIR[nx.e.type] - 1), s2 = nx.dir > 0 ? nx.e.lo : nx.e.hi;
  const P2 = lanePose(nx.e, nx.dir, laneOff(nx.e.type, lane), s2);
  const p0 = [c.x, c.z], p2 = [P2.x, P2.z];
  // control point: where the two lane lines meet (straight on: halfway)
  const den = c.tx * P2.tz - c.tz * P2.tx;
  let p1 = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
  if (Math.abs(den) > 0.2) { const qx = p2[0] - p0[0], qz = p2[1] - p0[1], a = (qx * P2.tz - qz * P2.tx) / den; if (a > 0 && a < 60) p1 = [p0[0] + c.tx * a, p0[1] + c.tz * a]; }
  let len = 0, px = p0[0], pz = p0[1];
  for (let i = 1; i <= 8; i++) { const u = i / 8, k = 1 - u, x = k * k * p0[0] + 2 * k * u * p1[0] + u * u * p2[0], z = k * k * p0[1] + 2 * k * u * p1[1] + u * u * p2[1]; len += Math.hypot(x - px, z - pz); px = x; pz = z; }
  c.mode = 'turn'; c.bz = { p0, p1, p2, len: Math.max(1, len), u: 0, sharp: Math.abs(den) > 0.5, next: nx, lane };
}
function spawnVeh(c, cx, cz, rmin, rmax) {
  const E = world.edges;
  for (let tries = 0; tries < 60; tries++) {
    const e = E[Math.floor(Math.random() * E.length)]; if (e.hi - e.lo < 20) continue;
    const s = e.lo + 4 + Math.random() * (e.hi - e.lo - 8), p = rPoint(e.road, s), d = Math.hypot(p.x - cx, p.z - cz);
    if (d < rmin || d > rmax) continue;
    if (veh.some((o) => o !== c && Math.hypot(o.x - p.x, o.z - p.z) < 14)) continue;
    placeOnEdge(c, e, Math.random() < 0.5 ? 1 : -1, s, Math.floor(Math.random() * 2)); c.v = c.vBase * 0.8; c.hitT = 0; c.stuckT = 0;
    return true;
  }
  return false;
}
function stepVeh(c, dt) {
  if (!c.e) return;
  if (c.hitT > 0) { c.hitT -= dt; c.v = Math.max(0, c.v - 20 * dt); poseVeh(c); return; }
  // look ahead for anything in our lane: other cars and the player
  let gap = 99;
  const rx = -c.tz, rz = c.tx;
  const test = (x, z, y) => { const dx = x - c.x, dz = z - c.z, d = dx * c.tx + dz * c.tz; if (d > 0 && d < 34 && Math.abs(dx * rx + dz * rz) < 2.1 && Math.abs((y || 0) - (c.y || 0)) < 3) gap = Math.min(gap, d); };
  for (const o of veh) if (o !== c && Math.abs(o.x - c.x) < 36 && Math.abs(o.z - c.z) < 36) test(o.x, o.z, o.y);
  if (roam.active) test(roam.x, roam.z, roam.y);
  if (gap < 30 && c.bot && c.mode === 'edge' && LANES_DIR[c.e.type] === 2) { // bots overtake on two-lane sides
    const other = 1 - c.lane, dOff = laneOff(c.e.type, other) - c.off;
    const busy = veh.some((o) => { if (o === c) return false; const dx = o.x - c.x, dz = o.z - c.z, d = dx * c.tx + dz * c.tz, l = dx * rx + dz * rz; return d > -10 && d < 40 && Math.abs(l - dOff) < 2.2; });
    if (!busy) { c.lane = other; gap = 99; }
  }
  let want = c.vBase;
  if (c.mode === 'edge') {
    const rem = c.dir > 0 ? c.e.hi - c.s : c.s - c.e.lo, node = c.dir > 0 ? c.e.b : c.e.a;
    if (rem < 30 && c.nx && c.nx.e !== c.e) want = Math.min(want, (c.racing ? 13 : 9) + rem * 0.6);
    // traffic stops for red and amber; bots run the lights like street racers do
    if (!c.bot && node.sig && rem > 5 && rem < 34 && sigState(node, c.e.road.axis) !== 'g') want = Math.min(want, Math.max(0, (rem - 6) * 0.75));
  }
  else if (c.bz.sharp) want = Math.min(want, c.bot ? 12 : 8);
  if (c.ghostT > 0) c.ghostT -= dt; else want = Math.min(want, Math.max(0, (gap - 8) * 1.1));
  c.stuckT = c.v < 0.5 && gap < 12 ? (c.stuckT || 0) + dt : 0;
  if (c.stuckT > 25) { c.stuckT = 0; c.ghostT = 2; } // long enough to sit through a red light
  c.v += clamp(want - c.v, -9 * dt, (c.bot ? 6 : 3) * dt);
  if (c.mode === 'edge') {
    c.s += c.v * dt * c.dir;
    c.off += (laneOff(c.e.type, c.lane) - c.off) * Math.min(1, dt * 2.2);
    if ((c.dir > 0 && c.s >= c.e.hi) || (c.dir < 0 && c.s <= c.e.lo)) { poseVeh(c); beginTurn(c); }
  } else {
    c.bz.u += c.v * dt / c.bz.len;
    if (c.bz.u >= 1) { const n = c.bz.next, l = c.bz.lane; placeOnEdge(c, n.e, n.dir, n.dir > 0 ? n.e.lo : n.e.hi, l, n.ri); return; }
  }
  poseVeh(c);
}

/* ---- bots: the city's other drivers, until real players arrive ---- */
const BOT_LINES = [
  'Anyone up for a run on the ring highway?', 'Harbor is empty tonight. Perfect for drifting.', 'That turbo flutter is music.',
  'Who tuned the purple one? Clean build.', 'Traffic downtown is heavy, take the coast road.', 'Meet at the pier, bring your fastest car.',
  'Just put slicks on. Feels like cheating.', 'Neon looks unreal after the rain.', 'Somebody beat Midnight yet?', 'Lights on, music up, windows down.'
];
const BOT_REPLY = {
  race: ['You’re on. Highway, north side.', 'Race? Bring nitro, I won’t wait.', 'Name the street. I’ll be there.'],
  hi: ['Hey! Nice ride.', 'Yo! Welcome to the city.', 'Salom! Love the build.'],
  any: ['Haha, true.', 'Say that again at 200 km/h.', 'Copy that.', 'See you on the boulevard.', 'Respect.']
};
function makeBots() {
  const picks = [0, 3, 4, 5, 7];
  return picks.map((i, k) => {
    const L = LADDER[i];
    const p = { id: 'bot' + k, name: L.name, color: L.color, look: { ...RIVAL_BASE, ...L.look }, buf: [], rig: null, tag: null, msg: '', msgT: 0 };
    net.players.set(p.id, p);
    const c = { id: p.id, bot: true, mult: 0.9 + Math.random() * 0.25, x: 0, z: 0, y: 0, tx: 1, tz: 0, v: 0, sendT: 0, raceMult: 1 };
    veh.push(c); return c;
  });
}
let botChatT = 18;
function botSay(id, text) { const p = net.players.get(id); if (p) showChat(id, text); }
function botsHear(text) {
  const ids = [...net.players.keys()]; if (!ids.length || Math.random() > 0.7) return;
  const t = text.toLowerCase(), set = /race|poyga|drag|go\b|1v1/.test(t) ? BOT_REPLY.race : /^(hi|hey|hello|salom|yo)\b/.test(t) ? BOT_REPLY.hi : BOT_REPLY.any;
  const id = ids[Math.floor(Math.random() * ids.length)];
  setTimeout(() => { if (roam.active) botSay(id, set[Math.floor(Math.random() * set.length)]); }, 1200 + Math.random() * 2200);
}
