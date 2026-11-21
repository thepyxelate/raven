import { signFonts } from '../world/signs.js';
/* ---- enter / leave ---- */
async function startRoam(spawn) {
  if (race.active || roam.active) return;
  const ok = (q) => q && Number.isFinite(q.x) && Number.isFinite(q.z) && Number.isFinite(q.h);
  const sp = ok(spawn) ? spawn : ok(roam.spawn) ? roam.spawn : { x: 2.2, z: 180, h: -Math.PI / 2 };
  const nameIn = $('roamName'); if (nameIn) { myName = nameIn.value.trim().slice(0, 16) || 'Driver'; try { localStorage.setItem('raven-rs-name', myName); } catch (e) { /* storage unavailable */ } }
  $('loading').textContent = 'LOADING NEON BAY'; $('loading').hidden = false;
  await new Promise((r) => setTimeout(r, 40));
  if (!world.built) await signFonts();
  if (!world.built) { buildWorld(); makeBots(); const TC = ['#4a4f57', '#9aa3ad', '#e9e9ec', '#1f5fd6', '#7a1f2b', '#2e3b2a', '#c9a227', '#121316', '#5a3a7a', '#3a6a8a', '#8a6a4a', '#2a2d33'];
    for (let i = 0; i < ROAM_TRAFFIC; i++) veh.push({ id: 't' + i, bot: false, tt: i % 3, mult: 0.85 + Math.random() * 0.3, x: 0, z: 0, y: 0, tx: 1, tz: 0, v: 0, hitT: 0, col: new THREE.Color(TC[i % TC.length]) });
    buildMarkers(); }
  const R = roam;
  R.saved = { lightsOn: cfg.lightsOn, near: camera.near, far: camera.far, beams: beams.map((b) => [b.distance, b.angle, b.intensity]) };
  cfg.lightsOn = true; updateMaterials();
  beams.forEach((b) => { b.distance = 55; b.angle = 0.42; b.intensity = 60; b.visible = true; });
  for (const e of Object.values(ENVS)) e.group.visible = false;
  world.group.visible = true;
  scene.environment = world.env; scene.background = world.bg; scene.fog = world.fog; renderer.toneMappingExposure = 0.95;
  camera.near = 0.5; camera.far = 900; camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--accent', '#ff5fa8'); document.documentElement.style.setProperty('--accent-ink', '#1d0010');
  Object.assign(R, { active: true, x: sp.x, z: sp.z, h: sp.h, vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, steer: 0, gear: 1, rpm: 950, shiftT: 0, thr: 0, nos: 1, drift: false, yr: 0, spin: 0, rearSlip: 0, slipA: 0, liftT: 0, acc: 0, lat: 0, keys: {}, camH: sp.h, shake: 0, chat: false, deck: null, y: 0, slopeF: 0, photo: false, mapOpen: false });
  deckUpdate();
  let rainOn = false; try { rainOn = localStorage.getItem('raven-rs-rain') === '1'; } catch (e) { /* storage unavailable */ }
  setRoamRain(rainOn);
  R.ph = physicsFor(cfg, 1);
  R.eng = { ph: R.ph, rpm: 950, thr: 0, shiftT: 0, launched: true, blown: false, nosT: 0 };
  carRig.rotation.set(0, 0, 0); carRig.rotation.order = 'YXZ';
  carRig.userData.wheels.forEach((w) => { w.userData.ry0 = w.rotation.y; });
  const rigT = ensureRoamTraffic(); for (const T of rigT) for (const k of ['body', 'dark', 'tail', 'head']) if (!T[k].parent) world.group.add(T[k]);
  if (!rigT.glow.parent) world.group.add(rigT.glow);
  for (const c of veh) spawnVeh(c, R.x, R.z, c.bot ? 60 : 40, c.bot ? 320 : 380);
  for (const p of net.players.values()) { p.buf = []; if (!p.rig) { p.rig = makeLiteRig(p.look, p.color); world.group.add(p.rig); } }
  controls.enabled = false; setSpin(false); tween = null;
  $('stage').classList.add('roaming'); $('roam').hidden = false;
  tagFor('me'); roam.meTag.nm.textContent = myName;
  for (const p of net.players.values()) tagFor(p.id);
  if (window.ravenConnectNow) window.ravenConnectNow(); // start Firebase now if the idle-time connect hasn't run yet
  net.enter();
  roamFrame(0);
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* compile on first draw instead */ }
  $('loading').hidden = true;
  audioStart();
  showChat(net.players.keys().next().value, 'Welcome to the city, ' + myName + '! Press Enter to chat.');
}
function exitRoam(keepNet) {
  const R = roam; if (!R.active) return;
  if (LOD.prs !== 1) { LOD.prs = 1; renderer.setPixelRatio(LOD.basePR); resize(); }
  speedFx.enabled = false; if (!keepNet) net.exit();
  if (amb.on) ambShift(false, true);
  endEvent(true); if (R.photo) setPhoto(false); if (R.mapOpen) setMap(false);
  R.active = false; if (R.chat) closeChat(false);
  audioStop();
  $('stage').classList.remove('roaming'); $('roam').hidden = true;
  world.group.visible = false;
  cfg.lightsOn = R.saved.lightsOn; updateMaterials();
  beams.forEach((b, i) => { [b.distance, b.angle, b.intensity] = R.saved.beams[i]; b.visible = cfg.lightsOn; });
  camera.near = R.saved.near; camera.far = R.saved.far; camera.updateProjectionMatrix();
  carRig.position.set(0, 0, 0); carRig.rotation.set(0, 0, 0); carRig.rotation.order = 'XYZ';
  carRig.userData.wheels.forEach((w) => { w.rotation.z = 0; if (w.userData.ry0 !== undefined) w.rotation.y = w.userData.ry0; });
  shadowBlob.rotation.z = 0; glow.rotation.z = 0; placeCarFx(0, 0);
  smoke.forEach((s) => { s.visible = false; }); flames.forEach((f) => { f.visible = false; f.rotation.set(0, 0, Math.PI / 2); });
  setLocation(loc);
  controls.enabled = true; controls.target.set(0, 0.55, 0); setView(42, 9, 10.8); resize(); controls.update();
  renderer.shadowMap.needsUpdate = true; render(); renderStats(); invalidate();
}

/* ---- per-frame ---- */
const mmCtx = () => $('minimap').getContext('2d');
let roamT = 0;
function roamFrame(dtRaw) {
  const R = roam, dt = Math.min(dtRaw, 0.05);
  if (R.photo) { speedFx.enabled = false; controls.update(); world.far.position.set(camera.position.x, 0, camera.position.z); return; }
  if (R.mapOpen) return;
  roamT += dt;
  const frozen = ev.active && ev.phase === 'count';
  const n = Math.max(1, Math.ceil(dt / (1 / 180)));
  for (let i = 0; i < n; i++) { stepPlayer(dt / n); deckUpdate(); if (!(R.deck && R.y > 0.6)) collideStatic(); }
  if (frozen) { R.vx = 0; R.vz = 0; R.vf = 0; R.vl = 0; R.yr = 0; }
  // traffic and bots
  for (const c of veh) {
    if (frozen && c.racing) { c.v = 0; poseVeh(c); continue; }
    stepVeh(c, dt);
    const d = Math.hypot(c.x - R.x, c.z - R.z);
    if (!c.e || (!c.bot && d > 480)) spawnVeh(c, R.x, R.z, c.bot ? 150 : 180, c.bot ? 360 : 420);
    if (c.bot && !c.racing && d > 750) spawnVeh(c, R.x, R.z, 150, 360);
  }
  collideVehicles(); if (!(R.deck && R.y > 0.6)) collideStatic();
  updateSignals(); fallenFrame(dt); eventFrame(dt); ambFrame(dt); styleUpdate(dt);
  if (R.rain && world.rainMesh) updateRain(world.rainMesh, dt);
  world.beamPivot.rotation.y += dt * 0.7;
  // bots publish snapshots at 10 Hz, like players on the network would
  const now = performance.now() / 1000;
  for (const c of veh) if (c.bot) { c.sendT -= dt; if (c.sendT <= 0) { c.sendT = 0.1; net.ingest(c.id, { t: now, x: c.x, z: c.z, y: c.y || 0, h: Math.atan2(c.tz, c.tx), v: c.v }); } }
  net.publishState({ x: R.x, z: R.z, y: R.y, h: R.h, v: R.vf });
  botChatT -= dt; if (botChatT <= 0) { botChatT = 25 + Math.random() * 35; const ids = [...net.players.keys()]; botSay(ids[Math.floor(Math.random() * ids.length)], BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]); }
  // other players: draw 150 ms in the past and interpolate between snapshots
  const rt = now - 0.15;
  for (const p of net.players.values()) {
    const b = p.buf; if (!b.length || !p.rig) continue;
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const s1 = b[i], s0 = b[Math.max(0, i - 1)], k = s1.t > s0.t ? clamp((rt - s0.t) / (s1.t - s0.t), 0, 1) : 1;
    let dh = s1.h - s0.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    p.x = s0.x + (s1.x - s0.x) * k; p.z = s0.z + (s1.z - s0.z) * k; p.h = s0.h + dh * k; p.y = (s0.y || 0) + ((s1.y || 0) - (s0.y || 0)) * k;
    p.rig.position.set(p.x, p.y, p.z); p.rig.rotation.y = -p.h;
    p.rig.visible = s1.y > -100 && Math.hypot(p.x - R.x, p.z - R.z) < 320; // y < -100: that driver is on the drag strip
  }
  // place the player's car
  const fx = Math.cos(R.h), fz = Math.sin(R.h);
  carRig.position.set(R.x, R.y, R.z); carRig.rotation.y = -R.h;
  carRig.rotation.z += (clamp(R.acc / G * 0.03, -0.012, 0.03) + Math.atan(R.slopeF || 0) - carRig.rotation.z) * Math.min(1, dt * 8);
  carRig.rotation.x += (clamp(-R.lat / G * 0.025, -0.03, 0.03) - carRig.rotation.x) * Math.min(1, dt * 5);
  carRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * R.wheelA; if (w.position.x > 0) w.rotation.y = w.userData.ry0 - R.steer; });
  shadowBlob.position.set(R.x, R.y + 0.07, R.z); shadowBlob.rotation.z = -R.h;
  glow.position.set(R.x, R.y + 0.08, R.z); glow.rotation.z = -R.h; glowL.position.set(R.x, R.y + 0.3, R.z);
  beams.forEach((l, i) => { const s = i ? -1 : 1, rx = -fz, rz = fx; const nf = rigDims().front - 0.05; l.position.set(R.x + fx * nf + rx * s * 0.55, R.y + 0.62, R.z + fz * nf + rz * s * 0.55); l.target.position.set(R.x + fx * 16 + rx * s * 1.2, R.y + 16 * (R.slopeF || 0), R.z + fz * 16 + rz * s * 1.2); l.target.updateMatrixWorld(); });
  // tyre smoke while sliding, nitro flames
  R.smokeT -= dt;
  if (R.smokeT <= 0) {
    R.smokeT = 0.04;
    const slide = (R.drift && Math.abs(R.vl) > 1.5) || R.spin > 0.25 || (R.gear === 1 && R.thr > 0.8 && R.vf < 6 && R.vf > 0.3);
    if (slide) for (const s of [1, -1]) { const xr = rigDims().xr; puff(R.x + fx * xr - fz * s * 0.85, R.z + fz * xr + fx * s * 0.85); smoke[(smokeI - 1) % smoke.length].position.y += R.y; }
  }
  for (const s of smoke) if (s.visible) { s.userData.life -= dt * 1.1; s.scale.setScalar(0.6 + (1 - s.userData.life) * 2.4); s.position.y += dt * 0.5; s.material.opacity = Math.max(0, s.userData.life) * 0.5; if (s.userData.life <= 0) s.visible = false; }
  const FD = rigDims(), ey = FD.exY, fb = FD.rear - 0.3, fw = FD.exZ;
  flames.forEach((f, i) => {
    f.visible = R.nosOn;
    if (f.visible) { const s = i ? -1 : 1; f.position.set(R.x + fx * fb - fz * s * fw, ey + R.y, R.z + fz * fb + fx * s * fw); f.rotation.set(0, -R.h, Math.PI / 2); f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
  });
  // traffic instances (three body styles), pitched on ramps
  const tr = roamTrafficRig, cnt = [0, 0, 0];
  for (const c of veh) if (!c.bot) {
    if (Math.abs(c.x - R.x) > 420 || Math.abs(c.z - R.z) > 420 || !c.e) continue;
    const T = tr[c.tt], i = cnt[c.tt]++;
    tq.setFromEuler(teul.set(0, -Math.atan2(c.tz, c.tx), Math.atan(c.slope || 0), 'YXZ')); tm4.compose(tv3.set(c.x, c.y || 0, c.z), tq, ts3);
    for (const k of ['body', 'dark', 'tail', 'head']) T[k].setMatrixAt(i, tm4);
    T.body.setColorAt(i, c.col);
    tr.glow.setMatrixAt(cnt[0] + cnt[1] + cnt[2] - 1, tm4);
  }
  tr.glow.count = cnt[0] + cnt[1] + cnt[2]; tr.glow.instanceMatrix.needsUpdate = true;
  tr.forEach((T, j) => { for (const k of ['body', 'dark', 'tail', 'head']) { T[k].count = cnt[j]; T[k].instanceMatrix.needsUpdate = true; } T.body.instanceColor.needsUpdate = true; });
  // chase camera: trails the car's heading with a little lag so drifts swing it round
  let dh = R.h - R.camH; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  R.camH += dh * Math.min(1, dt * (Math.abs(R.vf) < 2 ? 2 : 4.5));
  const cfx = Math.cos(R.camH), cfz = Math.sin(R.camH), back = R.camMode ? 9.5 : 6.3, up = R.camMode ? 3.6 : 2.25;
  R.shake = Math.max(0, R.shake - dt * 2.5);
  const spN = clamp((Math.abs(R.vf) - 22) / 78, 0, 1), rush = spN * spN * (3 - 2 * spN) + (R.nosOn ? 0.35 : 0);
  const sh = R.shake * 0.25 + rush * 0.035;
  speedFx.enabled = !R.photo && rush > 0.01; speedFx.uniforms.amt.value = Math.min(0.16, rush * 0.11); speedFx.uniforms.vig.value = Math.min(0.55, rush * 0.42);
  R.camY = R.camY === undefined ? R.y : R.camY + (R.y - R.camY) * Math.min(1, dt * 6);
  camera.position.set(R.x - cfx * back + (Math.random() - 0.5) * sh, R.camY + up + (Math.random() - 0.5) * sh, R.z - cfz * back + (Math.random() - 0.5) * sh);
  camera.lookAt(R.x + cfx * 3, R.y + 1.0, R.z + cfz * 3);
  const fov = (camera.aspect < 1.1 ? 70 : 60) + Math.min(22, Math.abs(R.vf) * 0.24) + (R.nosOn ? 7 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  world.far.position.set(camera.position.x, 0, camera.position.z);
  // show only chunks near the camera (the rest are in the fog anyway)
  lodUpdate(dt);
  // sound
  const spd = Math.hypot(R.vx, R.vz);
  Object.assign(R.eng, { rpm: R.rpm, thr: R.thr, shiftT: R.shiftT, nosT: R.nosOn ? 1 : 0, v: spd, slide: spd < 3 ? (R.spin > 0.2 ? 0.6 : 0) : Math.max(R.spin * 0.8, R.keys.hb ? 0.75 : 0, clamp((R.rearSlip - 0.13) / 0.25, 0, 1)) });
  audioUpdate(R.eng, dt);
  roamHud(dt);
}
const projV = new THREE.Vector3();
function placeTag(t, x, y, z, maxD) {
  projV.set(x, y, z); const d = camera.position.distanceTo(projV); projV.project(camera);
  const on = projV.z < 1 && d < maxD && Math.abs(projV.x) < 1.1 && Math.abs(projV.y) < 1.1;
  t.el.style.display = on ? '' : 'none'; if (!on) return;
  const w = stage.clientWidth, h = stage.clientHeight, sc = clamp(1.25 - d / 140, 0.65, 1.1);
  t.el.style.transform = `translate(${((projV.x + 1) / 2 * w).toFixed(1)}px, ${((1 - projV.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(2)})`;
}
function roamHud(dt) {
  const R = roam;
  $('roKmh').textContent = Math.round(Math.abs(R.vf) * 3.6);
  $('roGear').textContent = R.vf < -0.5 && R.keys.down ? 'R' : String(R.gear);
  $('roNos').style.width = (cfg.nitro > 0 || R.infNos ? R.nos * 100 : 0).toFixed(1) + '%';
  $('roNosRow').classList.toggle('off', !(cfg.nitro > 0 || R.infNos)); $('roNosRow').classList.toggle('live', R.nosOn);
  R.areaT -= dt; if (R.areaT <= 0) { R.areaT = 0.5; const a = R.deck && R.deck.sky ? 'NEON SKYWAY' : areaName(R.x, R.z); if ($('roArea').textContent !== a) $('roArea').textContent = a; }
  // name tags and chat bubbles
  const me = tagFor('me'); me.msgT -= dt; if (me.msgT <= 0 && me.el.classList.contains('says')) me.el.classList.remove('says');
  placeTag(me, R.x, R.y + 2.1, R.z, 200); me.el.classList.add('self');
  for (const p of net.players.values()) {
    if (!p.el || p.x === undefined) continue;
    p.msgT -= dt; if (p.msgT <= 0 && p.el.classList.contains('says')) p.el.classList.remove('says');
    placeTag(p, p.x, (p.y || 0) + 2.1, p.z, p.el.classList.contains('says') ? 220 : 130);
  }
  markerHud(dt);
  drawMinimap();
}
function drawMinimap() {
  const cv = $('minimap'), g = mmCtx(), W = cv.width, R = roam, s = world.mapS;
  const k = clamp(1.7 - Math.abs(R.vf) * 0.012, 1.15, 1.7), rot = -Math.PI / 2 - R.h;
  g.clearRect(0, 0, W, W); g.save();
  g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 4, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#0d0f17'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(rot); g.scale(k, k); g.translate(-(R.x + 1000) * s, -(R.z + 1000) * s);
  g.drawImage(world.map, 0, 0);
  const route = ev.active && ev.pts ? ev.pts : roam.gpsR ? [[R.x, R.z, 0], ...roam.gpsR.pts.slice(roam.gpsR.idx)] : roam.gps;
  if (route) { g.strokeStyle = ev.active ? '#ffb547' : '#ff5fa8'; g.lineWidth = 7 / k; g.lineJoin = 'round'; g.beginPath(); route.forEach(([x, z], i) => { const a = (x + 1000) * s, b = (z + 1000) * s; if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }
  if (!ev.active) for (const m of markers) { g.fillStyle = m.def.color; g.beginPath(); g.arc((m.x + 1000) * s, (m.z + 1000) * s, 7 / k, 0, Math.PI * 2); g.fill(); }
  if (ev.active && ev.cps && ev.cps[ev.next]) { const c = ev.cps[ev.next]; g.strokeStyle = '#ffffff'; g.lineWidth = 3 / k; g.beginPath(); g.arc((c.x + 1000) * s, (c.z + 1000) * s, 9 / k, 0, Math.PI * 2); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of net.players.values()) {
    if (p.x === undefined) continue;
    const dx = (p.x - R.x) * s * k, dz = (p.z - R.z) * s * k, c = Math.cos(rot), sn = Math.sin(rot);
    const x = W / 2 + dx * c - dz * sn, y = W / 2 + dx * sn + dz * c;
    if (Math.hypot(x - W / 2, y - W / 2) > W / 2 - 10) continue;
    g.fillStyle = p.color; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  g.restore();
  // the player arrow, always pointing up
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(W / 2, W / 2 - 14); g.lineTo(W / 2 + 9, W / 2 + 10); g.lineTo(W / 2, W / 2 + 5); g.lineTo(W / 2 - 9, W / 2 + 10); g.closePath(); g.fill();
  // north marker on the rim
  const na = rot - Math.PI / 2, nr = W / 2 - 18;
  g.fillStyle = '#ff5fa8'; g.font = '700 22px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', W / 2 + Math.cos(na) * nr, W / 2 + Math.sin(na) * nr);
}

/* ---- input ---- */
window.addEventListener('keydown', (e) => {
  if (!roam.active) return;
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  const k = e.key;
  if (roam.chat) {
    if (k === 'Enter') { closeChat(true); e.preventDefault(); }
    else if (k === 'Escape') { closeChat(false); e.preventDefault(); }
    e.stopImmediatePropagation(); return;
  }
  if (roam.mapOpen) { if (k === 'm' || k === 'M' || k === 'Escape') setMap(false); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (roam.photo) { if (k === 'p' || k === 'P' || k === 'Escape') setPhoto(false); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (mp.pick && (k === '1' || k === '2' || k === 'x' || k === 'X' || k === 'Escape')) { if (k === '1') mpInvite('drag'); else if (k === '2') mpInvite('street'); else mp.pick = null; e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (mp.inv && (k === 'x' || k === 'X')) { mpDecline(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ev.phase === 'done' && (k === 'Enter' || k === 'e' || k === 'E')) { closeResult(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (RKEYS[k]) { roam.keys[RKEYS[k]] = true; e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (e.repeat) return;
  if (k === 'Enter') openChat();
  else if (k === 'e' || k === 'E') interact();
  else if (k === 'm' || k === 'M') setMap(true);
  else if (k === 't' || k === 'T') setRoamRain(!roam.rain);
  else if (k === 'p' || k === 'P') setPhoto(true);
  else if (k === 'c' || k === 'C') roam.camMode = 1 - roam.camMode;
  else if (k === 'h' || k === 'H') cycleHandling();
  else if (k === 'r' || k === 'R') { if (ev.active && ev.lastCp) placeAtCheckpoint(ev.lastCp); else resetToRoad(); }
  else if (k === 'Escape') exitRoam();
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
window.addEventListener('keyup', (e) => { if (roam.active && RKEYS[e.key]) { roam.keys[RKEYS[e.key]] = false; if (e.key === 'Shift') roam.keys.nos = false; e.preventDefault(); } }, true);
window.addEventListener('blur', () => { for (const k in roam.keys) roam.keys[k] = false; });
$('roQuit').onclick = exitRoam;
$('chatIn').addEventListener('blur', () => { if (roam.chat) closeChat(false); });
