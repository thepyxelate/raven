/* ---- race flow ---- */
const race = { active: false, phase: 'idle', t: 0, me: null, ai: null, prof: null, ghost: null, opp: '', gasKey: false, gasPad: false, launchQ: '', prevLoc: 'garage', endT: 0, smokeT: 0, lanes: LANES2, cars: [], rec: [], recT: 0, slow: 0, kick: 0, camZ: 0, stageT: 0, treeDelay: 1, greenT: 0, aiLaunchAt: 0, track: 'strip', gripMul: 1, mode: 'quick', ladderIdx: -1 };
function startRace() {
  if (raceMode === 'challenge' && !challenge) { say('Paste a challenge code and press Load first.', true); return; }
  if (raceMode !== 'mp') race.mpOpp = null;
  const track = raceMode === 'challenge' ? challenge.k : raceTrack;
  if (!race.active) race.prevLoc = loc;
  setLocation(track);
  const env = ENVS[track];
  const lanes = traffic ? LANES3 : LANES2;
  Object.assign(race, { active: true, phase: 'burnout', t: 0, gasKey: false, gasPad: false, launchQ: '', endT: 0, lanes, rec: [], recT: 0, slow: 0, kick: 0, track, gripMul: track === 'rain' ? 0.86 : 1, mode: raceMode, ladderIdx: -1, ghost: null, ai: null, opp: '', nosShown: '' });
  race.me = newRacer(physicsFor(cfg, 1)); race.me.lane = 0; race.me.z = lanes[0];
  if (raceMode === 'ladder' || raceMode === 'quick') {
    let look, perf, factor, d, color;
    if (raceMode === 'ladder') { const r = LADDER[ladderPick]; race.ladderIdx = ladderPick; look = { ...RIVAL_BASE, ...r.look }; perf = r.perf; factor = r.boost || 1; d = DIFFS.find((x) => x[0] === r.skill); color = r.color; race.opp = r.name; }
    else { d = DIFFS.find((x) => x[0] === raceDiff); look = { ...RIVAL_BASE, model: cfg.model }; perf = {}; factor = d[2]; color = '#e7e8ee'; race.opp = 'Rival'; }
    ensureRival(look); rivalPaint.color.set(color);
    race.ai = newRacer(physicsFor(clean({ ...cfg, ...look, ...(raceMode === 'ladder' ? { finalDrive: 4.1, ecu: 'balanced', nitroTune: 'balanced' } : {}), ...perf }), factor));
    race.ai.lane = lanes.length - 1; race.ai.z = lanes[lanes.length - 1];
    race.prof = { launch: d[3], shift: d[4], next: d[4], jitter: d[5], nos: d[6], rt: d[7], look: d[8] };
    rivalRig.visible = true; rivalBlob.visible = true;
  } else if (raceMode === 'mp') {
    const o = race.mpOpp;
    ensureRival(o.look); rivalPaint.color.set(o.color);
    rivalRig.visible = true; rivalBlob.visible = true; race.opp = o.name;
  } else {
    if (rivalRig) rivalRig.visible = false; rivalBlob.visible = false;
    race.ghost = raceMode === 'test' ? loadGhost(track) : { t: challenge.t, s: challenge.s, look: challenge.l, name: challenge.n };
    race.opp = race.ghost ? race.ghost.name : '';
    if (race.ghost) { buildGhost(race.ghost.look); ghostRig.visible = true; }
  }
  if (ghostRig && !race.ghost) ghostRig.visible = false;
  // traffic: same speed in every lane, never the same lane twice in a row
  race.cars = [];
  if (traffic) {
    ensureTraffic(); showTraffic(true);
    let x = 80, last = -1;
    while (race.cars.length < TRAFFIC_N && x < 420) {
      const choices = [0, 1, 2].filter((l) => l !== last), lane = choices[Math.floor(Math.random() * choices.length)];
      race.cars.push({ x, lane, v: 12 }); last = lane; x += 28 + Math.random() * 14;
    }
    placeTraffic();
  } else showTraffic(false);
  race.camZ = race.me.z + 5.2;
  controls.enabled = false; setSpin(false); tween = null;
  if (env.far) env.far.rotation.y = Math.PI;
  $('stage').classList.add('racing'); $('race').hidden = false; $('result').hidden = true; $('result').replaceChildren();
  $('rMode').textContent = ((MODES.find((m) => m[0] === raceMode) || [0, 'Online 1v1'])[1] + (race.opp ? ' · vs ' + race.opp : '')).toUpperCase();
  $('bLeft').hidden = $('bRight').hidden = $('laneHint').hidden = !traffic;
  Array.from($('tree').children).forEach((i) => { i.className = i.classList.contains('g') ? 'g' : ''; });
  callout('BURNOUT: HOLD GAS TO HEAT THE TYRES · E TO STAGE', 'ok', 0);
  renderNos(race.me);
  audioStart();
  invalidate();
}
function stageCars() {
  race.phase = 'stage'; race.stageT = race.t; race.treeDelay = 0.7 + Math.random() * 0.9;
  const o = race.mode === 'mp' ? race.mpOpp : null;
  if (o) { // online: the tree waits until both cars are staged, then the host picks the delay for both
    race.treeDelay = 1e9; o.meStaged = true; mpSend(o.id, { k: 'stg', n: o.n });
    callout('STAGED · WAITING FOR ' + o.name.toUpperCase(), 'ok', 0); mpTryGo(); return;
  }
  callout('STAGED · LAUNCH WITH E ON GREEN', 'ok', 0);
}
function exitRace() {
  race.active = false; race.phase = 'idle';
  audioStop();
  $('stage').classList.remove('racing'); $('race').hidden = true;
  if (rivalRig) rivalRig.visible = false; if (ghostRig) ghostRig.visible = false; rivalBlob.visible = false; showTraffic(false);
  smoke.forEach((s) => { s.visible = false; }); flames.forEach((f) => { f.visible = false; });
  for (const e of Object.values(ENVS)) { if (e.far) e.far.rotation.y = 0; if (e.sunBase) { e.sun.position.copy(e.sunBase); e.sun.target.position.set(0, 0, 0); e.sun.target.updateMatrixWorld(); } }
  carRig.position.set(0, 0, 0); carRig.rotation.set(0, 0, 0);
  carRig.userData.wheels.forEach((w) => { w.rotation.z = 0; });
  placeCarFx(0, 0);
  setLocation(race.prevLoc);
  controls.enabled = true; controls.target.set(0, 0.55, 0); setView(42, 9, 10.8); resize(); controls.update();
  renderer.shadowMap.needsUpdate = true; render(); renderStats(); invalidate();
  if (race.mpOpp) { if (!race.mpOpp.sentFin) mpSend(race.mpOpp.id, { k: 'quit', n: race.mpOpp.n }); race.mpOpp = null; mp.race = null; }
  if (race.fromRoam) { const sp = race.fromRoam; race.fromRoam = null; startRoam(sp); }
}
function pressLaunch() {
  const me = race.me;
  if (race.phase === 'burnout') { stageCars(); return; }
  if (race.phase === 'stage' && race.treeDelay > 1e8) return; // online: still waiting for the other car, the tree is not running
  if (race.phase === 'stage') { me.dq = true; me.v = 0; callout('RED LIGHT', 'bad'); finishRace(); return; }
  if (race.phase === 'run' && !me.launched) {
    const q = launch(me); race.launchQ = q[0].charAt(0) + q[0].slice(1).toLowerCase();
    callout(q[0] + ' · RT ' + me.rt.toFixed(3), q[1], 1500); return;
  }
  doShift(1);
}
function doShift(dir) {
  if (race.phase !== 'run' || !race.me.launched) return;
  const q = shiftGear(race.me, dir);
  if (q) { callout(q[0], q[1]); if (dir > 0) flutter(true); }
}
function doNos() {
  const me = race.me;
  if (race.phase !== 'run' || !me.launched || me.blown || me.done || me.crashed) return;
  if (!me.ph.bottles) { callout('NO NITRO FITTED', 'bad'); return; }
  if (me.bottles > 0 && me.nosT <= 0) { me.bottles--; me.nosT = me.ph.nosDur; callout('NITRO!', ''); renderNos(me); }
}
function doLane(d) {
  if (!traffic || race.phase !== 'run' || !race.me.launched) return;
  changeLane(race.me, d);
}
function finishRace() {
  if (race.phase === 'result') return;
  race.phase = 'result';
  const me = race.me, ai = race.ai, g = race.ghost;
  const finished = me.done && !me.dq && !me.crashed;
  if (race.mode === 'mp' && race.mpOpp && !race.mpOpp.sentFin) { race.mpOpp.sentFin = true; mpSend(race.mpOpp.id, { k: 'fin', n: race.mpOpp.n, t: finished ? +me.time.toFixed(3) : -1 }); }
  const tname = TRACKS.find((t) => t[0] === race.track)[1];
  const pb = +store.get('pb-' + race.track, '0') || 0;
  const newPb = finished && (!pb || me.time < pb);
  if (newPb) {
    store.set('pb-' + race.track, String(me.time));
    const look = {}; for (const k of LOOK_KEYS) look[k] = cfg[k];
    store.set('ghost-' + race.track, JSON.stringify({ t: +me.time.toFixed(3), s: race.rec, look }));
  }
  let title, win = false;
  if (me.dq) title = 'RED LIGHT';
  else if (me.crashed) title = 'CRASHED';
  else if (me.blown && !me.done) title = 'ENGINE BLOWN';
  else if (race.mode === 'mp') { const o = race.mpOpp; win = finished && (o.time == null || me.time <= o.time); title = win ? 'YOU WIN' : 'YOU LOSE'; }
  else if (ai) { win = finished && (!ai.done || me.time <= ai.time); title = win ? 'YOU WIN' : 'YOU LOSE'; }
  else if (race.mode === 'challenge') { win = finished && me.time < g.t; title = win ? 'CHALLENGE BEATEN' : 'CHALLENGE LOST'; }
  else title = newPb ? 'NEW PERSONAL BEST' : 'TEST RUN';
  let ladderMsg = '';
  if (race.mode === 'ladder' && win && race.ladderIdx === ladderNext && ladderNext < LADDER.length) {
    ladderNext++; store.set('ladder', String(ladderNext));
    ladderMsg = ladderNext >= LADDER.length ? 'Ladder complete. You own the streets.' : LADDER[race.ladderIdx].name + ' beaten. Next up: ' + LADDER[ladderNext].name + '.';
    ladderPick = Math.min(ladderNext, LADDER.length - 1);
  }
  const r = $('result'); r.replaceChildren();
  r.append(el('h2', null, title));
  r.append(el('p', 'sub', tname + ' · 1/4 mile' + (traffic ? ' · traffic' : '') + (race.opp ? ' · vs ' + race.opp : '') + (newPb ? ' · New personal best' : '')));
  if (ladderMsg) r.append(el('p', 'ladder-msg', ladderMsg));
  const dl = el('dl');
  const row = (k, v) => dl.append(el('dt', null, k), el('dd', null, v));
  row('Reaction time', me.launched ? me.rt.toFixed(3) + ' s' : '—');
  row('Elapsed time (ET)', finished ? (me.time - me.rt).toFixed(3) + ' s' : 'Did not finish');
  row('Race time incl. reaction', finished ? me.time.toFixed(3) + ' s' : '—');
  if (ai) row(race.opp + ' race time', ai.done ? ai.time.toFixed(3) + ' s' : 'Did not finish');
  if (g) row(g.name + ' race time', g.t.toFixed(3) + ' s');
  const mo = race.mode === 'mp' ? race.mpOpp : null;
  if (mo) row(mo.name + ' race time', !mo.done ? 'Still racing…' : mo.time != null ? mo.time.toFixed(3) + ' s' : mo.left ? 'Left the race' : mo.done ? 'Did not finish' : 'No result');
  const ot = mo ? mo.time : ai ? (ai.done ? ai.time : null) : g ? g.t : null;
  if (finished && ot) row('Margin', (me.time <= ot ? '−' : '+') + Math.abs(ot - me.time).toFixed(3) + ' s');
  row('Trap speed', finished ? Math.round(me.trap) + ' km/h' : '—');
  row('60 ft', me.t60 ? (me.t60 - me.rt).toFixed(3) + ' s' : '—');
  row('Launch', race.launchQ || '—');
  row('Tyre temp at launch', Math.round(me.tireAtLaunch) + ' °C' + (me.tireAtLaunch >= 70 && me.tireAtLaunch <= 95 ? ' (ideal)' : ''));
  row('Perfect shifts', me.perfect + ' of ' + me.shifts);
  row('Personal best', newPb ? me.time.toFixed(3) + ' s' : pb ? pb.toFixed(3) + ' s' : '—');
  r.append(dl);
  const rowB = el('div', 'row');
  if (!mo) rowB.append(skewBtn('Race again (R)', 'primary', startRace));
  if (race.mode === 'ladder' && win && ladderNext < LADDER.length && ladderPick !== race.ladderIdx) rowB.append(skewBtn('Next rival (N)', 'primary', () => { startRace(); }));
  let code = '';
  if (finished) {
    code = encodeChallenge(me);
    rowB.append(skewBtn('Copy challenge code (C)', '', () => copyChallenge(code)));
  }
  rowB.append(skewBtn(mo || race.fromRoam ? 'Back to the city (Esc)' : 'Back to garage (Esc)', '', exitRace));
  r.append(rowB);
  const cbox = el('input'); cbox.type = 'text'; cbox.id = 'chalOut'; cbox.readOnly = true; cbox.hidden = true; cbox.setAttribute('aria-label', 'Challenge code'); cbox.value = code;
  r.append(cbox);
  race.code = code;
  r.hidden = false;
}
function copyChallenge(code) {
  const box = $('chalOut'); box.hidden = false; box.value = code;
  const fb = () => { box.select(); callout('CODE SELECTED · CTRL+C TO COPY', 'ok', 1800); };
  try { navigator.clipboard.writeText(code).then(() => callout('CHALLENGE CODE COPIED', '', 1500), fb); } catch (e) { fb(); }
}

function crashCheck(c) {
  if (!race.cars.length || c.crashed || !c.launched || c.done) return false;
  const cx = c.x - halfOf(c);
  for (const t of race.cars) if (Math.abs(c.z - LANES3[t.lane]) < 1.75 && Math.abs(cx - t.x) < 4.25) { c.crashed = true; c.v *= 0.2; for (let i = 0; i < 8; i++) puff(cx + 1.5, c.z); return true; }
  return false;
}
function updateLane(c, dt) {
  if (c.laneT > 0) { c.laneT -= dt; const k = 1 - Math.max(0, c.laneT) / 0.3, e = k * k * (3 - 2 * k); c.z = c.zFrom + (race.lanes[c.lane] - c.zFrom) * e; }
  else c.z = race.lanes[c.lane];
}
function raceFrame(dtRaw) {
  const me = race.me, ai = race.ai;
  const dt = dtRaw;
  race.t += dt;
  if (race.phase === 'burnout' && race.t > 9) stageCars();
  if (race.phase === 'stage') {
    const tt = race.t - race.stageT - race.treeDelay, lights = $('tree').children;
    for (let i = 0; i < 3; i++) lights[i].classList.toggle('on', tt >= i * 0.5);
    if (tt >= 1.5) {
      lights[3].classList.add('on');
      race.phase = 'run'; race.greenT = race.t;
      if (ai) race.aiLaunchAt = race.t + race.prof.rt[0] + Math.random() * (race.prof.rt[1] - race.prof.rt[0]);
      callout('GO!', '', 0);
    }
  }
  const gas = race.gasKey || race.gasPad;
  const ph = race.phase === 'result' ? 'run' : race.phase;
  const n = Math.max(1, Math.min(120, Math.ceil(dt / H))), h = dt / n;
  for (let i = 0; i < n; i++) {
    const wasBlown = me.blown;
    stepRacer(me, gas, h, ph, race.gripMul);
    if (me.blown && !wasBlown) callout('ENGINE BLOWN', 'bad');
    if (ai) {
      if (race.phase === 'run' && !ai.launched && race.t >= race.aiLaunchAt) launch(ai);
      stepRacer(ai, aiThink(ai, race.prof, ph), h, ph, race.gripMul);
    }
    if (race.phase === 'run' || race.phase === 'result') {
      for (const t of race.cars) t.x += t.v * h;
      if (crashCheck(me)) { callout('CRASHED', 'bad', 0); }
      if (ai) { aiAvoid(ai); crashCheck(ai); }
      if (ai && traffic && me.lane === ai.lane) { // can't drive through each other
        const [back, front] = me.x < ai.x ? [me, ai] : [ai, me];
        if (front.x - back.x < 4.8) { back.v = Math.min(back.v, front.v); back.x = Math.min(back.x, front.x - 4.8); }
      }
    }
    updateLane(me, h); if (ai) updateLane(ai, h);
  }
  // record a ghost of this run at 30 Hz from the green light
  if (race.phase === 'run') while (race.recT <= me.time && race.rec.length < 2400) { race.rec.push(+me.x.toFixed(2)); race.recT += 1 / 30; }
  const mo = race.mode === 'mp' ? race.mpOpp : null;
  if (race.phase === 'run') {
    const meOut = me.done || me.dq || me.crashed || (me.blown && me.v < 0.5);
    const aiOut = mo ? mo.done : !ai || ai.done || ai.crashed || (ai.blown && ai.v < 0.5);
    if (meOut && !race.endT) {
      race.endT = race.t;
      if (mo && !mo.sentFin) { mo.sentFin = true; mpSend(mo.id, { k: 'fin', n: mo.n, t: me.done && !me.dq && !me.crashed ? +me.time.toFixed(3) : -1 }); }
    }
    if (race.endT && (aiOut || race.t - race.endT > (mo ? 15 : 5)) && race.t - race.endT > (ai || mo ? 0 : 1.2)) finishRace();
  }
  if (mo) {
    // my run goes out on the live channel with y = -500, so city clients know not to draw it; the rival's comes back the same way
    net.publishState({ x: me.x, z: 0, y: -500, h: 0, v: me.v });
    const op = net.players.get(mo.id), b = op && op.buf[op.buf.length - 1];
    if (!op && !mo.done) { mo.done = true; mo.left = true; mo.time = null; }
    if (b && b.y < -100) mo.x = b.x + b.v * clamp(performance.now() / 1000 - b.t, 0, 0.3);
    const lz = race.lanes[race.lanes.length - 1], r = rivalRig.userData.dims ? rivalRig.userData.dims.r : 0.33;
    rivalRig.position.set((mo.x || 0) - noseOf(rivalRig), 0, lz);
    rivalRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * (mo.x || 0) / r; });
    rivalBlob.position.set(rivalRig.position.x, 0.006, lz);
  }
  // place cars
  carRig.position.set(me.x - noseOf(carRig), 0, me.z);
  carRig.rotation.z += (Math.max(-0.01, Math.min(0.028, me.a / G * 0.03)) - carRig.rotation.z) * Math.min(1, dt * 2.5);
  carRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * me.wheelA; });
  if (ai) {
    rivalRig.position.set(ai.x - noseOf(rivalRig), 0, ai.z); rivalRig.rotation.z += (Math.max(-0.01, Math.min(0.028, ai.a / G * 0.03)) - rivalRig.rotation.z) * Math.min(1, dt * 2.5);
    rivalRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * ai.wheelA; });
    rivalBlob.position.set(rivalRig.position.x, 0.006, ai.z);
  }
  let gx = null;
  if (race.ghost && ghostRig) {
    const gt = race.phase === 'run' || race.phase === 'result' ? race.t - race.greenT : 0;
    gx = ghostX(race.ghost, gt);
    ghostRig.position.set(gx - noseOf(ghostRig), 0, race.lanes[race.lanes.length - 1]);
    ghostRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * gx / (ghostRig.userData.dims ? ghostRig.userData.dims.r : 0.33); });
  }
  placeCarFx(carRig.position.x, me.z);
  if (race.cars.length) placeTraffic();
  // smoke + nitro flames
  race.smokeT -= dt;
  if (race.smokeT <= 0) {
    race.smokeT = 0.035;
    if (me.spin && me.v < 40) { puff(carRig.position.x + carRig.userData.dims.xr, me.z + 0.85); puff(carRig.position.x + carRig.userData.dims.xr, me.z - 0.85); }
    if (ai && ai.spin && ai.v < 40) puff(rivalRig.position.x + rivalRig.userData.dims.xr, ai.z + (Math.random() < 0.5 ? 0.85 : -0.85));
  }
  for (const s of smoke) if (s.visible) { s.userData.life -= dt * 1.1; s.scale.setScalar(0.6 + (1 - s.userData.life) * 2.4); s.position.y += dt * 0.5; s.material.opacity = Math.max(0, s.userData.life) * 0.55; if (s.userData.life <= 0) s.visible = false; }
  flames.forEach((f, i) => {
    f.visible = me.nosT > 0;
    if (f.visible) { { const d = carRig.userData.dims; f.position.set(carRig.position.x + d.rear - 0.35, d.exY, me.z + (i ? -d.exZ : d.exZ)); } f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
  });
  // sun shadow follows the player
  const env = ENVS[loc];
  if (env.sunDir) { env.sun.position.set(carRig.position.x + env.sunDir.x * 30, 7, me.z + env.sunDir.z * 30); env.sun.target.position.set(carRig.position.x, 0, me.z); env.sun.target.updateMatrixWorld(); }
  renderer.shadowMap.needsUpdate = true;
  // fixed 3/4 chase camera
  race.camZ += (me.z + 5.2 - race.camZ) * Math.min(1, dtRaw * 5);
  const px = carRig.position.x, started = race.phase === 'run' || race.phase === 'result';
  const shake = me.rpm > me.ph.redline * 0.97 && started ? (Math.random() - 0.5) * 0.03 : 0;
  camera.position.set(px - 6.6, 2.15 + shake, race.camZ);
  camera.lookAt(px + 3.2, 0.7, me.z - 1.2);
  const fov = (camera.aspect < 1.1 ? 48 : 38) + Math.min(16, me.v * 0.2);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // HUD
  const staged = !me.launched;
  drawTach(me, staged); drawLeds(me, staged);
  $('heat').style.width = me.heat.toFixed(1) + '%';
  $('tire').style.width = Math.min(100, Math.max(0, (me.tire - 20) / 1.05)).toFixed(1) + '%';
  $('tireTxt').textContent = Math.round(me.tire) + ' °C';
  $('rTime').textContent = (started ? me.time : 0).toFixed(3);
  let sub = 'SECONDS';
  if (race.ghost && started && me.x > 1) { const gt = ghostTimeAt(race.ghost, me.x); if (gt !== null) { const dlt = me.time - gt; sub = 'Δ ' + (dlt >= 0 ? '+' : '−') + Math.abs(dlt).toFixed(2) + ' VS ' + race.ghost.name.toUpperCase(); } }
  $('rSub').textContent = sub;
  $('pBar').style.width = Math.min(100, me.x / RACE_LEN * 100) + '%';
  const ox = ai ? ai.x : gx;
  $('rBar').style.width = (ox === null ? 0 : Math.min(100, ox / RACE_LEN * 100)) + '%';
  $('rLabel').textContent = ai ? race.opp.toUpperCase() : race.ghost ? 'GHOST' : '—';
  const nk = me.bottles + ':' + (me.nosT > 0);
  if (race.nosShown !== nk) { race.nosShown = nk; renderNos(me); }
  $('bGas').classList.toggle('held', gas);
  audioUpdate(me, dtRaw);
}
