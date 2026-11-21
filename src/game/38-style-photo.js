/* ---- style points: drift chains ---- */
const style = { total: 0, chain: 0, chainT: 0, calm: 0, mult: 1 };
function showPop(text, cls = '') {
  const p = el('p', 'pop ' + cls, text); $('roPops').append(p);
  setTimeout(() => p.remove(), 1600);
  while ($('roPops').children.length > 4) $('roPops').firstChild.remove();
}
function inArena() { const A = world.ARENA; return roam.x > A[0] && roam.x < A[2] && roam.z > A[1] && roam.z < A[3]; }
function addStyle(pts, label) {
  style.total += pts;
  if (ev.active && ev.active.type === 'drift' && ev.phase === 'run' && inArena()) ev.score += pts;
  showPop('+' + pts.toLocaleString() + ' ' + label);
  $('roStyle').textContent = 'STYLE ' + style.total.toLocaleString();
}
function bankDrift() {
  const pts = Math.round(style.chain * style.mult);
  if (pts > 60) addStyle(pts, 'DRIFT ×' + style.mult);
  style.chain = 0; style.chainT = 0; style.mult = 1; style.calm = 0;
}
function crashChain(sev = 5) {
  ambBump(sev);
  if (style.chain > 60) showPop('CRASHED · DRIFT LOST', 'bad');
  style.chain = 0; style.chainT = 0; style.mult = 1; style.calm = 0;
}
function styleUpdate(dt) {
  const R = roam, slide = R.drift && R.slipA > 0.13 ? Math.abs(R.vl) : 0, sp = Math.abs(R.vf);
  if (slide > 2.6 && sp > 7 && R.vf > 0) { style.chain += slide * sp * dt; style.chainT += dt; style.calm = 0; style.mult = Math.min(5, 1 + Math.floor(style.chainT / 1.5)); }
  else if (style.chain > 0) { style.calm += dt; if (style.calm > 0.6) bankDrift(); }
  const ch = $('roChain'), t = style.chain > 60 ? 'DRIFT ' + Math.round(style.chain).toLocaleString() + '  ×' + style.mult : '';
  if (ch.textContent !== t) ch.textContent = t;
  // no points for brushing past traffic at speed: the city rewards nothing reckless (speed belongs on the strip and in events)
}

/* ---- photo mode ---- */
const photoSaved = {};
function setPhoto(on) {
  roam.photo = on; $('stage').classList.toggle('photo', on);
  for (const k in roam.keys) roam.keys[k] = false;
  if (on) {
    Object.assign(photoSaved, { min: controls.minDistance, max: controls.maxDistance, minP: controls.minPolarAngle, maxP: controls.maxPolarAngle });
    Object.assign(controls, { minDistance: 3, maxDistance: 40, minPolarAngle: 0.1, maxPolarAngle: 1.62 });
    controls.target.set(roam.x, roam.y + 0.7, roam.z); controls.enabled = true; controls.update();
    $('phSave').hidden = !dlNs; getDownloads().then((ns) => { $('phSave').hidden = !ns; });
  } else {
    Object.assign(controls, { minDistance: photoSaved.min, maxDistance: photoSaved.max, minPolarAngle: photoSaved.minP, maxPolarAngle: photoSaved.maxP });
    controls.enabled = false;
  }
}
// photos go out through the viewer's download prompt; no prompt available, no Save button
let dlNs = null, dlTried = false;
async function getDownloads() {
  if (dlTried) return dlNs; dlTried = true;
  try { dlNs = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dlNs = null; }
  return dlNs;
}
function savePhoto() {
  if (!dlNs) return;
  composer.render();
  renderer.domElement.toBlob(async (blob) => {
    if (!blob) return;
    try { await dlNs.save({ filename: 'raven-rs-photo.png', data: blob }); showPop('PHOTO SAVED', 'info'); }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { showPop('ONE MOMENT…', 'info'); return; } $('phSave').hidden = true; }
  }, 'image/png');
}
$('phSave').onclick = savePhoto;
$('phExit').onclick = () => setPhoto(false);
$('roRain').onclick = () => { if (roam.active) setRoamRain(!roam.rain); };
