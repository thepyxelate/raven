/* ---- event state ---- */
const ev = { active: null, phase: '', t: 0, cps: null, pts: null, next: 0, lap: 1, laps: 1, time: 0, racers: [], finished: [], score: 0, lastCp: null, gates: [], prompt: null };
function bestKey(id) { return 'raven-rs-ev-' + id; }
function placeAtCheckpoint(cp) {
  const sn = snapToRoad(cp.x, cp.z, Math.atan2(cp.tz, cp.tx)), p = lanePose(sn.e, sn.dir, laneOff(sn.e.type, 0), sn.s);
  Object.assign(roam, { x: p.x, z: p.z, h: Math.atan2(p.tz, p.tx), vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, gear: 1, steer: 0 });
  attachAt(sn.e, sn.s); roam.camH = roam.h; deckUpdate();
}
function startRaceEvent(def, steps, rivals, mySlot = 0) {
  const loop = def.type === 'circuit', pts = routePolyline(steps);
  Object.assign(ev, { active: def, phase: 'count', t: 3.6, steps, pts, cps: checkpointsFrom(pts), next: 0, lap: 1, laps: def.laps || 1, time: 0, racers: rivals, finished: [], lastCp: null });
  roam.gps = null; roam.wp = null; roam.gpsR = null;
  // starting grid on the first edge of the route
  const st = steps[0], e = st.e, two = LANES_DIR[e.type] === 2, base = st.dir > 0 ? e.lo + 6 : e.hi - 6;
  const span = e.hi - e.lo - 12, slots = two ? [[16, 0], [16, 1], [6, 0], [6, 1]] : [[22, 0], [14, 0], [6, 0], [-2, 0]];
  const sAt = (o) => base + st.dir * clamp(o, 0, span);
  const p0 = lanePose(e, st.dir, laneOff(e.type, slots[mySlot][1]), sAt(slots[mySlot][0]));
  Object.assign(roam, { x: p0.x, z: p0.z, h: Math.atan2(p0.tz, p0.tx), vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, gear: 1, steer: 0, nos: 1 });
  attachAt(e, sAt(slots[mySlot][0])); roam.camH = roam.h; deckUpdate();
  ev.mp = null;
  rivals.forEach((c, i) => {
    const [o, lane] = slots[i + 1 + mySlot] || slots[slots.length - 1];
    Object.assign(c, { racing: true, route: steps, loop, ri: 0, raceMult: 1.32, cp: 0, lap: 1, done: false, hitT: 0, ghostT: 0 });
    placeOnEdge(c, e, st.dir, sAt(o), lane, 0); c.v = 0;
    const np = net.players.get(c.id); if (np) np.buf = [];
  });
  markers.forEach((m) => { m.group.visible = false; });
  $('roEvent').hidden = false; $('roResult').hidden = true;
}
function startDrift(def) {
  Object.assign(ev, { active: def, phase: 'count', t: 3.6, steps: null, pts: null, cps: null, racers: [], score: 0, time: 0 });
  markers.forEach((m) => { m.group.visible = false; });
  $('roEvent').hidden = false; $('roResult').hidden = true;
}
function challengeBot(c) {
  const p = net.players.get(c.id), sn = snapToRoad(roam.x, roam.z, roam.h);
  if (!sn) return;
  // a finish line 700-1300 m away, on the far side of town
  const from = endNodeOf({ e: sn.e, dir: sn.dir });
  const far = world.nodes.filter((n) => { const d = Math.hypot(n.x - roam.x, n.z - roam.z); return d > 700 && d < 1300 && n.z < 1000; });
  const to = far[Math.floor(Math.random() * far.length)]; if (!to) return;
  const rest = routeBetween(from, to); if (!rest) return;
  botSay(c.id, ['You’re on. First to the finish.', 'Let’s see what that build can do.', 'Loser buys the coffee.'][Math.floor(Math.random() * 3)]);
  startRaceEvent({ id: '1v1', type: 'sprint', name: '1v1 vs ' + p.name, color: p.color }, [{ e: sn.e, dir: sn.dir }, ...rest], [c]);
}
function interact() {
  if (mp.inv) { mpAccept(); return; }
  if (ev.active) return;
  const pr = ev.prompt; if (!pr) return;
  if (pr.marker && pr.marker.def.type === 'hospital') { if (!amb.call) ambShift(!amb.on); return; }
  if (amb.call) { showPop('Finish the emergency call first', 'info'); return; }
  if (pr.player) { mp.pick = pr.player.id; return; }
  if (pr.bot) { challengeBot(pr.bot); return; }
  const def = pr.marker.def;
  if (def.type === 'sprint' || def.type === 'circuit') {
    const rivals = veh.filter((c) => c.bot).sort(() => Math.random() - 0.5).slice(0, 3);
    startRaceEvent(def, pr.marker.steps, rivals);
  } else if (def.type === 'drift') startDrift(def);
  else if (def.type === 'garage') { roam.spawn = { x: pr.marker.x, z: pr.marker.z, h: pr.marker.h }; exitRoam(); say('Tune your car, then Free roam brings you back to this garage.'); }
  else if (def.type === 'drag') {
    const back = { x: pr.marker.x, z: pr.marker.z, h: pr.marker.h };
    exitRoam();
    if (raceMode === 'challenge' && !challenge) raceMode = 'quick';
    startRace(); race.fromRoam = back;
  }
}
function endEvent(silent) {
  if (!ev.active) return;
  if (ev.mp) { if (!ev.mp.meDone) mpSend(ev.mp.id, { k: 'quit', n: ev.mp.n }); ev.mp = null; mp.race = null; }
  for (const c of ev.racers) { c.racing = false; c.route = null; c.loop = false; c.raceMult = 1; if (c.e) c.vBase = roadSpeed(c.e.type, true) * c.mult; }
  ev.active = null; ev.phase = ''; ev.cps = null; ev.pts = null; ev.racers = [];
  ev.gates.forEach((g) => { g.visible = false; });
  markers.forEach((m) => { m.group.visible = true; });
  $('roEvent').hidden = true; $('roCount').textContent = '';
  if (silent) $('roResult').hidden = true;
}
function closeResult() { ev.phase = ''; $('roResult').hidden = true; endEvent(true); }
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return (m ? m + ':' + (s < 10 ? '0' : '') : '') + s.toFixed(2); };
function showResult(title, sub, rows) {
  const r = $('roResult'); r.replaceChildren();
  r.append(el('h2', '', title), el('p', 'sub', sub));
  const dl = el('dl'); for (const [k, v] of rows) dl.append(el('dt', '', k), el('dd', '', v)); r.append(dl);
  const b = el('button', 'btn primary'); b.type = 'button'; b.append(el('span', '', 'Continue (Enter)')); b.onclick = closeResult; r.append(b);
  r.hidden = false; ev.phase = 'done';
}
function progressOf(cpIdx, lap, x, z) {
  const n = ev.cps.length, cp = ev.cps[Math.min(cpIdx, n - 1)];
  return (lap - 1) * n + cpIdx - (cpIdx < n ? Math.hypot(cp.x - x, cp.z - z) / 3000 : 0);
}
function eventFrame(dt) {
  if (!ev.active) { ev.gates.forEach((g) => { g.visible = false; }); return; }
  const R = roam, def = ev.active;
  if (ev.phase === 'count') {
    ev.t -= dt; const n = Math.ceil(ev.t - 0.6);
    $('roCount').textContent = ev.t > 0.6 ? String(n) : 'GO!';
    if (ev.t <= 0.6 && ev.phase === 'count') { ev.phase = 'run'; setTimeout(() => { if ($('roCount').textContent === 'GO!') $('roCount').textContent = ''; }, 700); }
    if (ev.phase === 'count') { renderEventHud(); return; }
  }
  if (ev.phase !== 'run') { renderEventHud(); return; }
  ev.time += dt;
  if (def.type === 'drift') {
    ev.t = Math.max(0, def.time - ev.time);
    if (ev.t <= 0) {
      bankDrift(); const best = +store.get(bestKey(def.id), '0') || 0, score = Math.round(ev.score);
      if (score > best) store.set(bestKey(def.id), String(score));
      showResult(score > best && best ? 'NEW BEST!' : 'TIME!', def.name, [['Score', score.toLocaleString()], ['Best', Math.max(score, best).toLocaleString()]]);
    }
    renderEventHud(); return;
  }
  // checkpoints: the player
  const cps = ev.cps, N = cps.length;
  const cp = cps[ev.next];
  if (cp && Math.hypot(cp.x - R.x, cp.z - R.z) < 15 && Math.abs(cp.y - R.y) < 4) {
    ev.lastCp = cp; ev.next++;
    if (ev.next >= N) { if (ev.lap < ev.laps) { ev.lap++; ev.next = 0; showPop('LAP ' + ev.lap + ' / ' + ev.laps, 'info'); } else finishPlayer(); }
  }
  // rivals: same gates; rubber band so the race stays close
  const me = progressOf(ev.next, ev.lap, R.x, R.z);
  for (const c of ev.racers) {
    if (c.done) continue;
    const k = ev.cps[c.cp]; if (k && Math.hypot(k.x - c.x, k.z - c.z) < 18) { c.cp++; if (c.cp >= N) { if (c.lap < ev.laps) { c.lap++; c.cp = 0; } else { c.done = true; ev.finished.push({ name: net.players.get(c.id).name, t: ev.time }); c.racing = false; c.route = null; c.raceMult = 1; } } }
    const pr = progressOf(c.cp, c.lap, c.x, c.z), lead = pr - me;
    c.raceMult = lead > 1.5 ? 1.12 : lead < -1.5 ? 1.5 : 1.32;
    if (c.e && c.mode === 'edge') c.vBase = roadSpeed(c.e.type, true) * c.mult * c.raceMult;
  }
  // online rival: follow its interpolated car through the same gates (only for the HUD; its finish time comes by message)
  if (ev.mp && !ev.mp.done) {
    const op = net.players.get(ev.mp.id);
    if (!op) { ev.mp.done = true; ev.mp.left = true; showPop(ev.mp.name + ' left the race', 'info'); }
    else if (op.x !== undefined) { const k = cps[ev.mp.cp]; if (k && Math.hypot(k.x - op.x, k.z - op.z) < 18) ev.mp.cp = Math.min(N, ev.mp.cp + 1); }
  }
  // gates
  ev.gates.forEach((g, i) => {
    const k = cps[ev.next + i] || (ev.lap < ev.laps ? cps[ev.next + i - N] : null);
    g.visible = !!k && ev.phase === 'run'; if (!k) return;
    g.position.set(k.x, k.y, k.z); g.rotation.y = Math.atan2(k.tx, k.tz);
  });
  renderEventHud();
}
function finishPlayer() {
  const def = ev.active, place = 1 + ev.finished.length, n = ev.racers.length + 1 + (ev.mp ? 1 : 0), key = bestKey(def.id);
  if (ev.mp) { ev.mp.meDone = true; mpSend(ev.mp.id, { k: 'fin', n: ev.mp.n, t: +ev.time.toFixed(3) }); }
  const best = +store.get(key, '0') || 0, t = ev.time;
  if (def.id !== '1v1' && (!best || t < best)) store.set(key, t.toFixed(3));
  const ord = ['1ST', '2ND', '3RD', '4TH'][place - 1];
  const rows = [['Time', fmtT(t)]];
  if (def.id !== '1v1') rows.push(['Best', fmtT(best && best < t ? best : t)]);
  ev.finished.forEach((f, i) => rows.push([(i + 1) + '. ' + f.name, fmtT(f.t)]));
  if (ev.mp && !ev.mp.done) rows.push([ev.mp.name, 'still racing…']);
  showResult(place === 1 ? 'YOU WIN · ' + ord : ord + ' OF ' + n, def.name, rows);
  ev.lastResult = [place === 1 ? 'YOU WIN · ' + ord : ord + ' OF ' + n, def.name, rows.filter((r) => r[1] !== 'still racing…')];
  if (place === 1) addStyle(1000, 'RACE WIN');
  for (const c of ev.racers) { c.racing = false; c.route = null; c.raceMult = 1; }
  ev.gates.forEach((g) => { g.visible = false; });
}
function renderEventHud() {
  const def = ev.active, box = $('roEvent'); if (!def) return;
  let parts;
  if (def.type === 'drift') parts = [def.name.toUpperCase(), 'SCORE ' + Math.round(ev.score).toLocaleString(), 'TIME ' + (ev.phase === 'count' ? def.time : Math.ceil(ev.t))];
  else {
    const R = roam, me = progressOf(ev.next, ev.lap, R.x, R.z);
    let pos = 1 + ev.racers.filter((c) => c.done || progressOf(c.cp, c.lap, c.x, c.z) > me).length;
    const op = ev.mp && net.players.get(ev.mp.id);
    if (ev.mp && !ev.mp.left && (ev.mp.finT !== undefined || (op && op.x !== undefined && progressOf(ev.mp.cp, 1, op.x, op.z) > me))) pos++;
    parts = [def.name.toUpperCase(), 'POS ' + pos + '/' + (ev.racers.length + 1 + (ev.mp ? 1 : 0))];
    if (ev.laps > 1) parts.push('LAP ' + ev.lap + '/' + ev.laps);
    parts.push('CP ' + Math.min(ev.next, ev.cps.length) + '/' + ev.cps.length, fmtT(ev.time));
  }
  const txt = parts.join('   ·   '); if (box.textContent !== txt) box.textContent = txt;
}
// HUD: prompts near markers and drivers, the GPS arrow, marker labels
function markerHud(dt) {
  const R = roam, sp = Math.abs(R.vf);
  let pr = null;
  if (!ev.active) {
    for (const m of markers) {
      const d = Math.hypot(m.x - R.x, m.z - R.z);
      placeTag(m.tag, m.x, m.y + 6, m.z, 320);
      if (d < 8 && Math.abs(m.y - R.y) < 3 && sp < 9) pr = { marker: m, text: m.def.type === 'hospital' ? (amb.on ? (amb.call ? (amb.call.phase === 'back' ? 'Patient on board: stop at the entrance' : 'On a call: the GPS leads to the patient') : 'End ambulance shift · ' + livesTxt()) : 'Start ambulance shift: answer emergency calls') : TYPE_LABEL[m.def.type] + ': ' + m.def.name + (m.def.type === 'sprint' || m.def.type === 'circuit' ? ' · 3 rivals' : '') };
    }
    if (!pr && sp < 14) for (const p of net.players.values()) if (p.remote && p.rig && p.rig.visible && p.x !== undefined && Math.hypot(p.x - R.x, p.z - R.z) < 16 && Math.abs((p.y || 0) - R.y) < 3) { pr = { player: p, text: 'Challenge ' + p.name + ' · drag or street race' }; break; }
    if (!pr && sp < 14) for (const c of veh) if (c.bot && !c.racing && Math.hypot(c.x - R.x, c.z - R.z) < 16 && Math.abs((c.y || 0) - R.y) < 3) { pr = { bot: c, text: 'Challenge ' + net.players.get(c.id).name + ' to a 1v1 sprint' }; break; }
  } else for (const m of markers) m.tag.el.style.display = 'none';
  // online challenges override the normal prompt
  if (mp.inv && roamT > mp.inv.until) mpDecline(true);
  if (mp.out && roamT > mp.out.until) { showPop('No answer from ' + mp.out.name, 'info'); mp.out = null; }
  if (mp.pick) { const op = net.players.get(mp.pick); if (!op || op.x === undefined || Math.hypot(op.x - R.x, op.z - R.z) > 30 || ev.active) mp.pick = null; }
  let raw = null;
  if (mp.inv) pr = { text: 'Accept ' + mp.inv.name + '’s ' + MP_LABEL[mp.inv.m] + '  ·  X decline' };
  else if (mp.pick) { pr = null; raw = 'pick'; }
  else if (mp.out) { pr = null; raw = 'Waiting for ' + mp.out.name + ' to accept your ' + MP_LABEL[mp.out.m] + '…'; }
  ev.prompt = pr;
  const pe = $('roPrompt');
  if (raw === 'pick') {
    if (pe.dataset.mode !== 'pick') {
      pe.dataset.mode = 'pick'; pe.replaceChildren(); pe.style.pointerEvents = 'auto';
      const b = (label, fn) => { const x = el('button', 'btn'); x.type = 'button'; x.textContent = label; x.style.marginLeft = '10px'; x.onclick = fn; return x; };
      pe.append(document.createTextNode('Race ' + (net.players.get(mp.pick) || {}).name + ':'), b('1 · Drag', () => mpInvite('drag')), b('2 · Street race', () => mpInvite('street')), b('X · Cancel', () => { mp.pick = null; }));
    }
    pe.hidden = false;
  } else {
    if (pe.dataset.mode) { pe.dataset.mode = ''; pe.style.pointerEvents = ''; }
    const t = raw || (pr ? 'E  ·  ' + pr.text : '');
    if (t) { if (pe.textContent !== t) pe.textContent = t; pe.hidden = false; } else pe.hidden = true;
  }
  // arrow toward the next checkpoint or along the GPS route
  let tgt = null, dist = 0;
  if (ev.active && ev.cps && ev.cps[ev.next]) { tgt = ev.cps[ev.next]; dist = Math.hypot(tgt.x - R.x, tgt.z - R.z); }
  let label = null;
  const km = (m) => (m > 999 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');
  if (!(ev.active && ev.cps) && roam.gps && roam.wp) {
    const r = gpsTrack(dt);
    if (!r) { roam.gps = null; roam.wp = null; roam.gpsR = null; showPop('ARRIVED', 'info'); }
    else {
      tgt = r.tgt; dist = r.left;
      label = r.uturn ? 'TURN AROUND · ' + km(dist) : r.turn && r.turn.d < 250 ? (r.turn.right ? '↱ ' : '↰ ') + (r.turn.sharp ? 'SHARP ' : '') + (r.turn.right ? 'RIGHT' : 'LEFT') + ' ' + Math.round(r.turn.d / 10) * 10 + ' m · ' + km(dist) : km(dist);
    }
  }
  const ar = $('roArrow');
  if (tgt) { const a = Math.atan2(tgt.z - R.z, tgt.x - R.x) - R.h; ar.hidden = false; ar.firstChild.style.transform = `rotate(${(a * 180 / Math.PI + 90).toFixed(1)}deg)`; const t = label || km(dist); if ($('roDist').textContent !== t) $('roDist').textContent = t; }
  else ar.hidden = true;
}
