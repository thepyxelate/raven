/* ================= menu UI ================= */
const SECTIONS = [['roam', 'Free roam'], ['race', 'Drag race'], ['car', 'Car'], ['kits', 'Body kits'], ['body', 'Body'], ['aero', 'Aero'], ['paint', 'Paint'], ['vinyl', 'Vinyl'], ['wheels', 'Wheels'], ['lights', 'Lights'], ['perf', 'Performance'], ['dyno', 'Dyno'], ['loc', 'Location'], ['import', 'My car (.glb)'], ['save', 'Save & share']];
const VISUAL_ONLY = ['bov', 'color', 'color2', 'finish', 'vinyl', 'vinylColor', 'sticker', 'stickerColor', 'rimColor', 'caliper', 'tint', 'neon', 'headlight', 'lightsOn', 'engine', 'turbo', 'nitro', 'gearbox', 'tires', 'finalDrive', 'ecu', 'nitroTune'];
let toastTimer = 0;
function say(text, bad = false) {
  const m = $('msg'); m.textContent = text; m.classList.toggle('bad', bad);
  clearTimeout(toastTimer); if (text) toastTimer = setTimeout(() => { m.textContent = ''; }, 3800);
}
const groupsOf = (sec) => {
  if (sec === 'roam') return [{ type: 'roam', title: 'Free roam' }];
  if (sec === 'race') return [{ type: 'race', title: 'Drag race' }];
  if (sec === 'dyno') return [{ type: 'dyno', title: 'Dyno' }];
  if (sec === 'loc') return [{ type: 'loc', title: 'Location' }];
  if (sec === 'save') return [{ type: 'save', title: 'Save & share' }];
  if (sec === 'import') return [{ type: 'import', title: 'My car (.glb)' }];
  if (sec === 'car') return [{ type: 'models', key: 'model', title: 'Car' }];
  if (sec === 'kits') return [{ type: 'kits', title: 'Body kits' }];
  return groupsFor(sec).map((g) => (g.type === 'sticker' ? { ...g, title: 'Decal text' } : g));
};
const optsOf = (g) => {
  if (g.type === 'models') return MODEL_LIST.map(([val, label, desc]) => ({ val, label, desc }));
  if (g.type === 'kits') return KITS.map(([label, desc, parts], i) => ({ val: i, label, desc, parts }));
  if (g.type === 'loc') return LOCS.map(([val, label, desc]) => ({ val, label, desc }));
  if (g.type === 'pills' || g.type === 'swatch') return g.opts.map(([val, label]) => ({ val, label, hex: g.type === 'swatch' ? val : null }));
  return [];
};
const kitIndexOf = (c) => KITS.findIndex(([, , parts]) => Object.entries(parts).every(([k, v]) => c[k] === v));
const indexIn = (g, c, l) => {
  if (g.type === 'kits') return kitIndexOf(c);
  if (g.type === 'loc') return LOCS.findIndex((x) => x[0] === l);
  if (g.key) return optsOf(g).findIndex((o) => o.val === c[g.key]);
  return -1;
};
const curIndex = (g) => indexIn(g, cfg, loc);
const valueLabel = (g) => {
  if (g.type === 'sticker') return cfg.sticker || 'None';
  if (g.type === 'save') return '';
  if (g.type === 'import') return customCar && cfg.custom ? customCar.name : 'Off';
  if (g.type === 'roam') return 'Neon Bay';
  if (g.type === 'race') return MODES.find((m) => m[0] === raceMode)[1];
  if (g.type === 'dyno') return dyno(cfg).et.toFixed(2) + ' s';
  const i = curIndex(g);
  return i < 0 ? (g.type === 'kits' ? 'Custom' : '') : optsOf(g)[i].label;
};
const nav = { level: 0, s: 0, g: 0, o: 0, orig: null };
const curGroups = () => groupsOf(SECTIONS[nav.s][0]);
const curGroup = () => curGroups()[nav.g];

function refresh(keys) { updateMaterials(); if (keys.some((k) => !VISUAL_ONLY.includes(k))) rebuildCar(); renderStats(); }
function applyOption(g, i) {
  const o = optsOf(g)[i]; if (!o) return;
  if (g.type === 'kits') { Object.assign(cfg, o.parts); refresh(Object.keys(o.parts)); }
  else if (g.type === 'loc') setLocation(o.val);
  else { cfg[g.key] = o.val; refresh([g.key]); }
}
const snapshot = (g) => (g.type === 'loc' ? loc : { ...cfg });
function restore(g, snap) { if (g.type === 'loc') setLocation(snap); else { cfg = snap; refresh(Object.keys(cfg)); } }

function enterSection() { nav.level = 1; nav.g = 0; nav.orig = null; if (curGroups().length === 1) enterGroup(); }
function enterGroup() {
  const g = curGroup(); nav.level = 2; nav.orig = null;
  nav.o = Math.max(0, curIndex(g));
}
function back() { nav.level = nav.level === 2 && curGroups().length > 1 ? 1 : 0; }
function commit() { const g = curGroup(); if (nav.orig !== null && optsOf(g)[nav.o]) say(optsOf(g)[nav.o].label + (g.type === 'loc' || g.type === 'models' ? ' selected.' : ' fitted.')); nav.orig = null; back(); }
function cancel() { if (nav.orig !== null) restore(curGroup(), nav.orig); nav.orig = null; back(); }
function step(d) {
  const g = curGroup(), n = optsOf(g).length; if (!n) return;
  if (nav.orig === null) nav.orig = snapshot(g);
  nav.o = (nav.o + d + n) % n; applyOption(g, nav.o);
}
function moveGroup(d) { const n = curGroups().length; if (n < 2) return; nav.orig = null; nav.g = (nav.g + d + n) % n; enterGroup(); }

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const menuItem = (label, val) => {
  const b = el('button', 'item'); b.type = 'button';
  b.append(el('span', null, label)); if (val != null && val !== '') b.append(el('span', 'val', val));
  return b;
};
const skewBtn = (label, cls, fn) => { const b = el('button', 'btn' + (cls ? ' ' + cls : '')); b.type = 'button'; b.append(el('span', null, label)); b.onclick = fn; return b; };

function render() {
  const m1 = $('m1'); m1.replaceChildren(); m1.classList.toggle('dim', nav.level > 0);
  SECTIONS.forEach(([, label], i) => {
    const b = menuItem(label);
    if (i === nav.s) { b.classList.add(nav.level === 0 ? 'cur' : 'trail'); b.setAttribute('aria-current', 'true'); }
    b.onclick = () => { if (nav.orig !== null) nav.orig = null; nav.s = i; enterSection(); render(); };
    m1.append(b);
  });
  const m2 = $('m2'); m2.replaceChildren(); m2.classList.toggle('dim', nav.level > 1);
  if (nav.level >= 1) curGroups().forEach((g, j) => {
    const b = menuItem(g.title, valueLabel(g));
    if (j === nav.g) { b.classList.add(nav.level === 1 ? 'cur' : 'trail'); b.setAttribute('aria-current', 'true'); }
    b.onclick = () => { nav.g = j; enterGroup(); render(); };
    m2.append(b);
  });
  for (const id of ['m1', 'm2']) { const c = document.querySelector('#' + id + ' .cur, #' + id + ' .trail'); if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  renderPicker();
}

function renderPicker() {
  const p = $('picker'); p.replaceChildren();
  if (nav.level === 0) { p.hidden = true; return; }
  p.hidden = false;
  const g = curGroup();
  p.classList.toggle('dimmed', nav.level < 2);
  const head = el('div', 'p-head'), left = el('div');
  left.append(el('span', 'p-title', g.title));
  head.append(left); p.append(head);

  if (g.type === 'sticker') {
    left.append(el('div', 'p-name', cfg.sticker || 'No decal'));
    const f = el('div', 'form');
    const inp = el('input'); inp.id = 'sticker'; inp.type = 'text'; inp.maxLength = 14; inp.placeholder = 'Type a name or tag'; inp.value = cfg.sticker; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Decal text');
    inp.oninput = () => { cfg.sticker = inp.value.toUpperCase().slice(0, 14); drawVinyl(); drawPlate(); invalidate(); left.lastChild.textContent = cfg.sticker || 'No decal'; };
    f.append(inp, skewBtn('Done', 'primary', () => { back(); render(); }));
    p.append(f);
    if (nav.level === 2) setTimeout(() => inp.focus(), 0);
    return;
  }
  if (g.type === 'import') { renderImportPicker(p, head, left); return; }
  if (g.type === 'roam') { renderRoamPicker(p, head, left); return; }
  if (g.type === 'race') { renderRacePicker(p, head, left); return; }
  if (g.type === 'dyno') { renderDyno(p, head, left); return; }
  if (g.type === 'save') {
    left.append(el('div', 'p-name', 'Keep your build'));
    head.append(el('div', 'p-desc', 'Saves stay in this browser. Share a build with its code.'));
    const f = el('div', 'form');
    const code = el('input'); code.id = 'code'; code.type = 'text'; code.placeholder = 'Get a code, or paste a friend’s code'; code.autocomplete = 'off'; code.spellcheck = false; code.setAttribute('aria-label', 'Build code');
    f.append(
      skewBtn('Save my car', 'primary', () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); say('Saved. Your car will be here next time.'); } catch (e) { code.value = encode(cfg); say('This browser blocks saving. Copy the code instead.', true); } }),
      skewBtn('Load saved', '', () => { const c = readStore(); if (c) loadCfg(c, 'Saved car loaded.'); else say('No saved car on this device yet.', true); }),
      skewBtn('Reset to stock', '', () => loadCfg({ ...DEFAULTS, model: cfg.model }, 'Reset to stock.')),
      skewBtn('Showcase build', '', () => loadCfg({ ...DEFAULTS, ...SHOWCASE, model: cfg.model }, 'Showcase build loaded.'))
    );
    const f2 = el('div', 'form');
    f2.append(code,
      skewBtn('Get code', '', () => { code.value = encode(cfg); say('Code ready.'); }),
      skewBtn('Copy', '', () => { const v = code.value || encode(cfg); code.value = v; const fb = () => { code.select(); say('Code selected. Press Ctrl+C to copy.'); }; try { navigator.clipboard.writeText(v).then(() => say('Code copied.'), fb); } catch (e) { fb(); } }),
      skewBtn('Load code', '', () => { try { loadCfg(decode(code.value), 'Car loaded from code.'); } catch (e) { say('That code is not valid. Check that you copied all of it.', true); } })
    );
    p.append(f, f2);
    return;
  }

  const opts = optsOf(g);
  const idx = nav.level === 2 ? nav.o : Math.max(0, curIndex(g));
  const fitted = nav.orig !== null ? indexIn(g, g.type === 'loc' ? cfg : nav.orig, g.type === 'loc' ? nav.orig : loc) : curIndex(g);
  const o = opts[idx];
  left.append(el('div', 'p-name', o ? o.label : ''));
  head.append(el('div', 'p-desc', nav.level < 2 ? 'Press Enter or click a part to browse' : (o && o.desc) || (idx + 1) + ' / ' + opts.length));
  const strip = el('div', 'strip');
  const prev = el('button', 'arrow', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous option');
  const next = el('button', 'arrow', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next option');
  prev.onclick = () => { if (nav.level < 2) enterGroup(); step(-1); render(); };
  next.onclick = () => { if (nav.level < 2) enterGroup(); step(1); render(); };
  const cards = el('div', 'cards'); cards.setAttribute('role', 'listbox'); cards.setAttribute('aria-label', g.title);
  let curCard = null;
  opts.forEach((op, i) => {
    const c = el('button', 'card' + (g.type === 'kits' || g.type === 'models' ? ' kit' : '')); c.type = 'button'; c.setAttribute('role', 'option');
    if (g.type === 'swatch') { const d = el('span', 'dot' + (op.val === 'off' ? ' off' : '')); if (op.val !== 'off') d.style.background = op.hex; c.append(d, el('span', null, op.label)); }
    else if (g.type === 'kits' || g.type === 'models') { c.append(el('span', null, op.label), el('small', null, op.desc)); }
    else c.append(el('span', null, op.label));
    if (i === fitted) c.classList.add('fit');
    if (i === idx && nav.level === 2) { c.classList.add('cur'); curCard = c; }
    c.setAttribute('aria-selected', String(i === idx));
    c.onclick = () => { nav.level = 2; nav.o = i; nav.orig = null; applyOption(g, i); say(op.label + (g.type === 'loc' || g.type === 'models' ? ' selected.' : ' fitted.')); render(); };
    cards.append(c);
  });
  strip.append(prev, cards, next); p.append(strip);
  if (curCard) requestAnimationFrame(() => { const r = curCard.offsetLeft - cards.clientWidth / 2 + curCard.clientWidth / 2; cards.scrollTo({ left: r, behavior: reduce ? 'auto' : 'smooth' }); });
}

function renderStats() {
  const st = stats(cfg), dy = dyno(cfg), cl = (v) => Math.max(3, Math.min(100, Math.round(v)));
  $('carName').textContent = modelName(cfg.model).toUpperCase();
  $('r-hp').textContent = st.hp; $('r-t').textContent = dy.t100.toFixed(1); $('r-v').textContent = Math.round(dy.vmax);
  const rows = [['Acceleration', cl((8 - dy.t100) / 5.5 * 100)], ['Top speed', cl((dy.vmax - 150) / 170 * 100)], st.bars[2], st.bars[3]];
  const bars = $('bars'); bars.replaceChildren();
  for (const [label, v] of rows) {
    const row = el('div', 'bar'), tr = el('i'), fl = el('b');
    fl.style.width = v + '%'; tr.append(fl);
    row.append(el('span', null, label), tr, el('em', null, String(v)));
    bars.append(row);
  }
}
const encode = (c) => btoa(unescape(encodeURIComponent(JSON.stringify({ ...c, custom: false }))));
const decode = (s) => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
const loadCfg = (c, msg) => { cfg = clean(c); if (!customCar) cfg.custom = false; updateMaterials(); rebuildCar(); renderStats(); render(); say(msg); };

window.addEventListener('keydown', (e) => {
  if ($('stage').classList.contains('racing') || $('stage').classList.contains('roaming')) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
    if (e.key === 'Enter' && t.id === 'roamName') { e.preventDefault(); t.blur(); startRoam(); return; }
    if (e.key === 'Escape' || (e.key === 'Enter' && t.id === 'sticker')) { t.blur(); back(); render(); e.preventDefault(); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key; let handled = true;
  const S = SECTIONS.length, G = curGroups().length;
  if (nav.level === 0) {
    if (k === 'ArrowDown') nav.s = (nav.s + 1) % S;
    else if (k === 'ArrowUp') nav.s = (nav.s - 1 + S) % S;
    else if (k === 'ArrowRight' || k === 'Enter') enterSection();
    else handled = false;
  } else if (nav.level === 1) {
    if (k === 'ArrowDown') nav.g = (nav.g + 1) % G;
    else if (k === 'ArrowUp') nav.g = (nav.g - 1 + G) % G;
    else if (k === 'ArrowRight' || k === 'Enter') enterGroup();
    else if (k === 'ArrowLeft' || k === 'Escape' || k === 'Backspace') back();
    else handled = false;
  } else {
    const g = curGroup();
    if (g.type === 'roam') { if (k === 'Enter') { e.preventDefault(); startRoam(); return; } if (k === 'Escape' || k === 'Backspace') back(); else handled = false; }
    else if (g.type === 'race') {
      if (k === 'Enter') { startRace(); return e.preventDefault(); }
      if (k === 'Escape' || k === 'Backspace') back();
      else if (k === 'ArrowRight' || k === 'ArrowLeft') { const i = TRACKS.findIndex((t) => t[0] === raceTrack), n = TRACKS.length; raceTrack = TRACKS[(i + (k === 'ArrowRight' ? 1 : -1) + n) % n][0]; store.set('track', raceTrack); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { const i = MODES.findIndex((m) => m[0] === raceMode), n = MODES.length; raceMode = MODES[(i + (k === 'ArrowDown' ? 1 : -1) + n) % n][0]; store.set('mode', raceMode); }
      else handled = false;
    }
    else if (g.type === 'dyno') { if (k === 'Escape' || k === 'Backspace') back(); else handled = false; }
    else if (g.type === 'save' || g.type === 'sticker' || g.type === 'import') { if (k === 'Escape' || k === 'Backspace') back(); else handled = false; }
    else if (k === 'ArrowRight') step(1);
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'Enter') commit();
    else if (k === 'Escape' || k === 'Backspace') cancel();
    else if (k === 'ArrowDown') moveGroup(1);
    else if (k === 'ArrowUp') moveGroup(-1);
    else handled = false;
  }
  if (handled) { e.preventDefault(); render(); }
});
