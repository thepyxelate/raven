/* ---- ambulance job: speed used to save lives ----
   Start a shift at the hospital marker. Calls come in at random times; the GPS leads to the patient, you stop to pick
   them up, then bring them back to the hospital. The patient's condition drops with time, and every hit, hard brake
   or violent turn hurts them too, so the job is fast but smooth. Each call ends with a real first-aid lesson. */
const AMB_CALLS = [
  ['Chest pain', 'Heart attack signs: pain or pressure in the chest that can spread to an arm, the jaw or the back, with sweating or shortness of breath. Call 103 at once and keep the person seated, calm and still.'],
  ['Someone collapsed', 'If a person does not respond and is not breathing normally, call 103 and start CPR: push hard and fast in the centre of the chest, 100 to 120 times a minute, until help arrives.'],
  ['Choking at a cafe', 'An adult who is choking and cannot speak: give up to 5 firm back blows between the shoulder blades, then up to 5 abdominal thrusts. Repeat, and call 103 if it does not clear.'],
  ['Stroke signs', 'Think FAST: Face drooping, Arm weakness, Speech slurred, Time to call 103. Note the time the signs started: doctors need it.'],
  ['Kitchen burn', 'Cool a burn under cool running water for 20 minutes. No ice, butter or toothpaste. Cover it loosely with cling film or a clean plastic bag.'],
  ['Elderly woman fell', 'After a fall, do not pull the person up quickly. Ask where it hurts, check for bleeding, keep them warm and call 103 if they are hurt or cannot get up.'],
  ['Road accident', 'At a crash: put your hazard lights and a warning triangle out, call 103 and 102, and do not move an injured person unless there is a danger such as fire.'],
  ['Heavy bleeding', 'Press firmly on the wound with a clean cloth and keep pressing without lifting it to look. Call 103. If blood soaks through, add another cloth on top.'],
  ['Breathing trouble', 'Help the person sit upright, loosen tight clothing, and help them use their own inhaler if they have one. Call 103 if breathing does not get easier.'],
  ['Child with high fever', 'A very high fever with a stiff neck, a rash that does not fade when pressed, or unusual drowsiness needs urgent help: call 103.']
];
const amb = { on: false, call: null, nextT: 0, saved: +store.get('amb-saved', '0') || 0, bar: null, pin: null, siren: null, sirenT: 0, hud: false };
const livesTxt = () => amb.saved + (amb.saved === 1 ? ' life' : ' lives') + ' saved';
const ambHospital = () => markers.find((m) => m.def.type === 'hospital');
function ambShift(on, quiet) {
  if (on === amb.on) return;
  amb.on = on;
  if (on) {
    amb.nextT = 6 + Math.random() * 10;
    // a light bar on the roof of whatever car you drive
    const pos = carRig.position.clone(), rot = carRig.rotation.clone();
    carRig.position.set(0, 0, 0); carRig.rotation.set(0, 0, 0); carRig.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(carRig); carRig.position.copy(pos); carRig.rotation.copy(rot);
    const bar = new THREE.Group(), bx = new THREE.BoxGeometry(0.22, 0.12, 0.42);
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.04, 0.05) }), blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.04, 0.1, 0.5) });
    const r = new THREE.Mesh(bx, red), b = new THREE.Mesh(bx, blue); r.position.z = 0.24; b.position.z = -0.24;
    bar.add(r, b); bar.position.set((bb.min.x + bb.max.x) / 2 - 0.1, bb.max.y + 0.04, 0); carRig.add(bar);
    amb.bar = { g: bar, red, blue };
    if (!amb.pin) { // the patient's location: a red column like the event markers
      const geo = new THREE.CylinderGeometry(2.6, 2.6, 30, 24, 1, true); geo.translate(0, 15, 0);
      amb.pin = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: columnTex(), color: new THREE.Color('#ff3040').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    }
    world.group.add(amb.pin); amb.pin.visible = false;
    if (!quiet) showPop('SHIFT STARTED · WAIT FOR A CALL', 'info');
  } else {
    if (amb.call) ambClose();
    if (amb.bar) { carRig.remove(amb.bar.g); amb.bar.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); amb.bar = null; }
    if (amb.pin) amb.pin.visible = false;
    sirenOff();
    if (amb.hud && !ev.active) $('roEvent').hidden = true; amb.hud = false;
    if (!quiet) showPop('SHIFT ENDED · ' + livesTxt().toUpperCase(), 'info');
  }
}
function sirenOn() {
  if (amb.siren || !audio) return;
  try { const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(); o.type = 'triangle'; o.frequency.value = 700; g.gain.value = 0.035; o.connect(g); g.connect(audio.fx); o.start(); amb.siren = { o, g }; } catch (e) { /* audio is optional */ }
}
function sirenOff() { if (!amb.siren) return; try { amb.siren.o.stop(); amb.siren.g.disconnect(); } catch (e) { /* already stopped */ } amb.siren = null; }
function ambNewCall() {
  const R = roam;
  const ok = world.nodes.filter((n) => { const d = Math.hypot(n.x - R.x, n.z - R.z); return d > 350 && d < 1100 && n.z < 620 && ![...n.roads].some((r) => r.type === 'highway' || r.hAt || r.isBridge || r.sky); });
  const n = ok[Math.floor(Math.random() * ok.length)]; if (!n) { amb.nextT = 5; return; }
  const [name, tip] = AMB_CALLS[Math.floor(Math.random() * AMB_CALLS.length)], dist = Math.hypot(n.x - R.x, n.z - R.z) * 1.3;
  amb.call = { name, tip, x: n.x, z: n.z, phase: 'go', cond: 100, t: 0, resp: 0, loadT: 0, hitT: 0 };
  ambLeg(amb.call, dist, 2); // waiting patients get worse slowly
  amb.pin.position.set(n.x, 0, n.z); amb.pin.visible = true;
  setWaypoint(n.x, n.z, true); sirenOn();
  showPop('EMERGENCY CALL · ' + name.toUpperCase(), 'bad');
}
// a hit hurts the patient: harder hits hurt more
function ambBump(sev) {
  const c = amb.call; if (!c || c.phase !== 'back' || roamT - c.hitT < 0.6) return; // one crash counts once
  c.hitT = roamT;
  c.cond = Math.max(0, c.cond - Math.min(12, 2 + sev * 0.5));
  showPop('CAREFUL · PATIENT HURT', 'bad');
}
// give a leg of the trip a time budget: about 3 times the time at a calm 43 km/h, plus 75 s; the condition runs out with it
function ambLeg(c, dist, slow = 1) { c.legT = 0; c.budget = (dist / 12) * 3 + 75; c.rate = 100 / (c.budget * slow); }
function ambClose() { amb.call = null; roam.gps = null; roam.wp = null; roam.gpsR = null; if (amb.pin) amb.pin.visible = false; sirenOff(); amb.nextT = 20 + Math.random() * 40; }
function ambFinish(ok) {
  const c = amb.call, rows = [['Patient', c.name], ['Response time', fmtT(c.resp)], ['Trip to hospital', fmtT(c.t - c.resp)], ['Condition', Math.round(c.cond) + ' %']];
  if (ok) { amb.saved++; store.set('amb-saved', String(amb.saved)); }
  rows.push(['Lives saved', String(amb.saved)], ['First aid', c.tip]);
  showResult(ok ? 'PATIENT SAVED' : 'TOO LATE', ok ? 'You got them there in time. Fast, but smooth: that is the job.' : 'Every second and every bump mattered. Next call, drive fast but smooth.', rows);
  ambClose();
}
function ambFrame(dt) {
  if (!amb.on) return;
  const R = roam, c = amb.call, sp = Math.hypot(R.vx, R.vz);
  // lights and two-tone siren while answering a call
  amb.sirenT += dt;
  const ph = Math.floor(amb.sirenT * 3) % 2;
  if (amb.bar) { amb.bar.red.color.setRGB(c && ph ? 3 : 0.5, c && ph ? 0.2 : 0.04, 0.05); amb.bar.blue.color.setRGB(0.04, 0.1, c && !ph ? 3 : 0.5); }
  if (amb.siren && audio) amb.siren.o.frequency.setTargetAtTime(Math.floor(amb.sirenT / 0.6) % 2 ? 960 : 700, audio.ctx.currentTime, 0.02);
  if (amb.pin && amb.pin.visible) amb.pin.material.opacity = 0.7 + Math.sin(roamT * 6) * 0.3;
  if (!c) {
    if (!ev.active && ev.phase !== 'done') { amb.nextT -= dt; if (amb.nextT <= 0) ambNewCall(); }
  } else {
    c.t += dt;
    const back = c.phase === 'back', hosp = ambHospital(), tx = back ? hosp.x : c.x, tz = back ? hosp.z : c.z, d = Math.hypot(tx - R.x, tz - R.z);
    // the patient gets worse while waiting and while riding; rough driving makes it faster
    c.legT += dt; c.cond -= dt * c.rate;
    // only truly rough driving hurts the patient: sliding or a violent swerve (normal braking is fine)
    if (back && ((R.drift && R.slipA > 0.2) || Math.abs(R.lat) > G * 1.15)) c.cond -= dt * 4;
    if (c.phase === 'go' && d < 14 && sp < 3) { c.phase = 'load'; c.loadT = 2.5; c.resp = c.t; showPop('LOADING PATIENT…', 'info'); }
    else if (c.phase === 'load') {
      if (sp > 4) { c.phase = 'go'; showPop('STOP TO LOAD THE PATIENT', 'bad'); }
      else if ((c.loadT -= dt) <= 0) { c.phase = 'back'; ambLeg(c, Math.hypot(hosp.x - R.x, hosp.z - R.z) * 1.3); amb.pin.visible = false; setWaypoint(hosp.x, hosp.z, true); showPop('PATIENT ON BOARD · TO THE HOSPITAL', 'info'); }
    } else if (back && d < 16 && sp < 3) { ambFinish(true); return; }
    if (c.cond <= 0) { c.cond = 0; ambFinish(false); return; }
  }
  // HUD line, shared with events (events take it over while they run)
  if (ev.active) return;
  const box = $('roEvent');
  const cc = amb.call, txt = !cc ? 'AMBULANCE ON DUTY   ·   WAITING FOR A CALL   ·   ' + livesTxt().toUpperCase()
    : ['AMBULANCE · ' + cc.name.toUpperCase(), cc.phase === 'back' ? 'TO HOSPITAL' : cc.phase === 'load' ? 'LOADING' : 'TO PATIENT', Math.round(Math.hypot((cc.phase === 'back' ? ambHospital().x : cc.x) - R.x, (cc.phase === 'back' ? ambHospital().z : cc.z) - R.z)) + ' m', 'CONDITION ' + Math.round(cc.cond) + '%', 'TIME LEFT ' + fmtT(Math.max(0, cc.cond / cc.rate))].join('   ·   ');
  if (box.textContent !== txt) box.textContent = txt;
  box.hidden = false; amb.hud = true;
}
