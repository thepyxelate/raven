/* ---- menu page ---- */
function renderRoamPicker(p, head, left) {
  left.append(el('div', 'p-name', 'Neon Bay'));
  head.append(el('div', 'p-desc', 'Drive Neon Bay, a 2 km city: downtown towers, the curved Neon Skyway, the harbor and marina, a suspension bridge to Neon Island, a tunnel and a ring highway. Race from the glowing markers; press Enter to chat.'));
  const f = el('div', 'form');
  const inp = el('input'); inp.type = 'text'; inp.id = 'roamName'; inp.maxLength = 16; inp.placeholder = 'Your driver name'; inp.value = myName; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Driver name');
  f.append(inp, skewBtn('Drive (Enter)', 'primary', () => startRoam()));
  // handling mode: three buttons, the chosen one highlighted
  const hm = el('div', 'form');
  hm.append(el('span', 'ro-hint', 'Handling:'));
  for (const [id, H] of Object.entries(HANDLING)) hm.append(skewBtn(H.label, id === handling ? 'primary' : '', () => { setHandling(id, true); render(); }));
  const h = el('div', 'form');
  h.append(el('span', 'ro-hint', 'W/↑ gas · S/↓ brake & reverse · A D/← → steer · Space handbrake · Shift nitro · E start event / challenge · M map & GPS · H handling · T rain · P photo · C camera · R back on road · Enter chat · Esc garage'));
  p.append(f, hm, h);
}

/* ================= boot ================= */
net.setTransport(localTransport());
window.ravenNet = net; // the hosted build swaps in the Firebase transport through this
updateMaterials();
rebuildCar();
loadCustomCar();
setLocation(loc);
render();
renderStats();
applyQuality();
banner.material.map = bannerTexture(); banner.material.needsUpdate = true;
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('italic 700 40px "Chakra Petch"'), document.fonts.load('700 40px "Chakra Petch"')]).then(() => {
    drawVinyl(); drawPlate(); banner.material.map = bannerTexture(); banner.material.needsUpdate = true; invalidate();
  }).catch(() => {});
}
let first = true, lastT = performance.now(), prevRendered = false;
renderer.setAnimationLoop((now) => {
  // eco quality: the city and races run at 30 fps (the physics takes the longer step in its sub-steps)
  if (qPref === 'eco' && (roam.active || (race.active && race.phase !== 'stage' && race.phase !== 'run')) && now - lastT < 1000 / 30 - 2) return; // never during the tree and the run: reaction times stay frame-exact
  // the full map covers the city with an almost opaque sheet: 10 fps behind it is plenty
  if (roam.active && roam.mapOpen && now - lastT < 100) return;
  const dtRaw = Math.min(0.25, (now - lastT) / 1000); lastT = now;
  const envNow = ENVS[loc];
  if (envNow) {
    if (envNow.far) envNow.far.position.x = camera.position.x;
    const ch = envNow.group.userData.chunks;
    if (ch) for (const m of ch) m.visible = Math.abs(m.userData.cx - camera.position.x) < 260;
    if (envNow.rain && !document.hidden) { updateRain(envNow.rain, dtRaw); dirty = true; }
  }
  if (roam.active) {
    roamFrame(dtRaw);
    if (document.hidden) { prevRendered = false; return; }
    composer.render();
    if (prevRendered && !roam.mapOpen) trackFps(dtRaw); // 10 fps behind the map is on purpose, not a slow machine
    prevRendered = true;
    return;
  }
  if (race.active) {
    raceFrame(dtRaw);
    if (document.hidden) { prevRendered = false; return; }
    composer.render();
    if (prevRendered) trackFps(dtRaw);
    prevRendered = true;
    return;
  }
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / 700), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const sp = new THREE.Spherical(tween.from.radius + (tween.to.radius - tween.from.radius) * e, tween.from.phi + (tween.to.phi - tween.from.phi) * e, tween.from.theta + (tween.to.theta - tween.from.theta) * e);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp));
    if (k >= 1) tween = null;
    dirty = true;
  }
  if (controls.update() || controls.autoRotate) dirty = true;
  if (!dirty || document.hidden) { prevRendered = false; return; }
  dirty = false;
  composer.render();
  if (prevRendered) trackFps(dtRaw);
  prevRendered = true;
  if (first) {
    first = false; $('loading').hidden = true;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    idle(() => warmup(), { timeout: 4000 });
  }
});
