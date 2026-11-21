/* ---- race picker in the menu ---- */
function renderRacePicker(p, head, left) {
  left.append(el('div', 'p-name', MODES.find((m) => m[0] === raceMode)[1]));
  const descs = {
    ladder: 'Beat eight street racers in order. Each one brings a faster car, so keep upgrading.',
    quick: 'One race against a rival built like your car, at the difficulty you pick.',
    test: 'Solo run against the ghost of your best time on this track.',
    challenge: 'Race the ghost from a friend’s challenge code.'
  };
  head.append(el('div', 'p-desc', descs[raceMode]));
  const fm = el('div', 'form');
  MODES.forEach(([id, label]) => fm.append(skewBtn(label, raceMode === id ? 'primary' : '', () => { raceMode = id; store.set('mode', id); render(); })));
  const ft = el('div', 'form');
  if (raceMode !== 'challenge') TRACKS.forEach(([id, label]) => ft.append(skewBtn(label, raceTrack === id ? 'primary' : '', () => { raceTrack = id; store.set('track', id); render(); })));
  ft.append(skewBtn('Traffic: ' + (traffic ? 'On' : 'Off'), traffic ? 'primary' : '', () => { traffic = !traffic; store.set('traffic', traffic ? 'on' : 'off'); render(); }));
  p.append(fm, ft);
  const fx = el('div', 'form');
  let info = '';
  if (raceMode === 'ladder') {
    LADDER.forEach((rv, i) => {
      const st = i < ladderNext ? 'beaten' : i === ladderNext ? 'next' : 'locked';
      const b = skewBtn((i + 1) + '. ' + rv.name + (st === 'beaten' ? ' · beaten' : st === 'next' ? ' · next' : ''), ladderPick === i ? 'primary' : '', () => { ladderPick = i; render(); });
      if (st === 'locked') { b.disabled = true; b.classList.add('locked'); }
      fx.append(b);
    });
    const rv = LADDER[ladderPick];
    info = ladderNext >= LADDER.length && ladderPick === LADDER.length - 1 ? 'Ladder complete. Rematch anyone you like.' : rv.name + ' · ' + modelName(rv.look.model) + ': ' + rv.note;
  } else if (raceMode === 'quick') {
    DIFFS.forEach(([id, label]) => fx.append(skewBtn('Rival: ' + label, raceDiff === id ? 'primary' : '', () => { raceDiff = id; store.set('diff', id); render(); })));
  } else if (raceMode === 'test') {
    const gh = loadGhost(raceTrack);
    info = gh ? 'Ghost: your best of ' + gh.t.toFixed(3) + ' s.' : 'No ghost yet. Finish a run on this track to record one.';
  } else {
    const inp = el('input'); inp.type = 'text'; inp.id = 'chalIn'; inp.placeholder = 'Paste a challenge code'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', 'Challenge code');
    fx.append(inp, skewBtn('Load', '', () => { try { challenge = decodeChallenge(inp.value); say('Challenge loaded: ' + challenge.n + ', ' + challenge.t.toFixed(3) + ' s.'); render(); } catch (e) { say('That challenge code is not valid.', true); } }));
    info = challenge ? challenge.n + ' ran ' + challenge.t.toFixed(3) + ' s on ' + TRACKS.find((t) => t[0] === challenge.k)[1] + '.' : 'Finish any race, press Copy challenge code, and send it to a friend.';
  }
  if (fx.childNodes.length) p.append(fx);
  const pb = +store.get('pb-' + (raceMode === 'challenge' && challenge ? challenge.k : raceTrack), '0') || 0;
  const fs = el('div', 'form');
  fs.append(skewBtn('Start race (Enter)', 'primary', startRace), el('span', 'p-desc', (info ? info + ' ' : '') + (pb ? 'Your best here: ' + pb.toFixed(3) + ' s.' : '')));
  p.append(fs);
}

/* ---- race input ---- */
const GAS_KEYS = ['w', 'W', 'ArrowUp'], UP_KEYS = ['e', 'E'], DOWN_KEYS = ['q', 'Q'], NOS_KEYS = [' ', 'n', 'N'];
window.addEventListener('keydown', (e) => {
  if (!race.active) return;
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  const t = e.target;
  if (t && t.tagName === 'INPUT') return;
  const k = e.key;
  if (race.phase === 'result') {
    if (k === 'r' || k === 'R' || k === 'Enter') startRace();
    else if ((k === 'n' || k === 'N') && race.mode === 'ladder' && ladderPick !== race.ladderIdx) startRace();
    else if ((k === 'c' || k === 'C') && race.code) copyChallenge(race.code);
    else if (k === 'Escape') exitRace();
    else if (GAS_KEYS.includes(k)) race.gasKey = true;
    else return;
  } else if (GAS_KEYS.includes(k)) race.gasKey = true;
  else if (e.repeat) { /* ignore held keys */ }
  else if (UP_KEYS.includes(k)) pressLaunch();
  else if (DOWN_KEYS.includes(k)) doShift(-1);
  else if (NOS_KEYS.includes(k)) doNos();
  else if (k === 'ArrowLeft') doLane(1);
  else if (k === 'ArrowRight') doLane(-1);
  else if (k === 'Escape') exitRace();
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
window.addEventListener('keyup', (e) => { if (race.active && GAS_KEYS.includes(e.key)) { race.gasKey = false; e.preventDefault(); } }, true);
window.addEventListener('blur', () => { race.gasKey = false; race.gasPad = false; });
const gasBtn = $('bGas');
gasBtn.addEventListener('pointerdown', (e) => { race.gasPad = true; try { gasBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) gasBtn.addEventListener(ev, () => { race.gasPad = false; });
$('bUp').addEventListener('pointerdown', (e) => { e.preventDefault(); pressLaunch(); });
$('bDown').addEventListener('pointerdown', (e) => { e.preventDefault(); doShift(-1); });
$('bNos').addEventListener('pointerdown', (e) => { e.preventDefault(); doNos(); });
$('bLeft').addEventListener('pointerdown', (e) => { e.preventDefault(); doLane(1); });
$('bRight').addEventListener('pointerdown', (e) => { e.preventDefault(); doLane(-1); });
$('bQuit').onclick = exitRace;
const soundBtn = $('sound');
const paintSound = () => { soundBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off'; soundBtn.setAttribute('aria-pressed', String(soundOn)); };
soundBtn.onclick = () => { soundOn = !soundOn; store.set('sound', soundOn ? 'on' : 'off'); if (soundOn && race.active) audioStart(); else audioStop(); paintSound(); };
paintSound();
