/* ---- HUD ---- */
const tach = $('tach'), tg = tach.getContext('2d');
function drawTach(c, staged) {
  const p = c.ph, cx = 230, cy = 236, R = 206, maxR = Math.ceil((p.redline + 900) / 1000) * 1000;
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, ang = (r) => a0 + sweep * Math.min(1, Math.max(0, r / maxR));
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6d6';
  tg.clearRect(0, 0, 460, 460);
  tg.fillStyle = 'rgba(8,8,16,0.84)'; tg.beginPath(); tg.arc(cx, cy, R + 12, 0, Math.PI * 2); tg.fill();
  const band = (r0, r1, col) => { tg.strokeStyle = col; tg.lineWidth = 16; tg.beginPath(); tg.arc(cx, cy, R - 12, ang(r0), ang(r1)); tg.stroke(); };
  band(0, maxR, 'rgba(255,255,255,0.1)');
  if (staged) band(p.redline * 0.5, p.redline * 0.68, '#3bff8a'); else band(p.redline * 0.9, p.redline * 0.975, '#3bff8a');
  band(p.redline, maxR, '#ff4060');
  tg.textAlign = 'center'; tg.textBaseline = 'middle';
  for (let k = 0; k <= maxR; k += 500) {
    const a = ang(k), big = k % 1000 === 0, r1 = R - 30, r2 = R - (big ? 54 : 42);
    tg.strokeStyle = big ? '#eceef5' : 'rgba(236,238,245,0.45)'; tg.lineWidth = big ? 4 : 2;
    tg.beginPath(); tg.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); tg.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); tg.stroke();
    if (big) { tg.fillStyle = k >= p.redline ? '#ff6b7d' : '#eceef5'; tg.font = 'italic 700 26px "Chakra Petch", sans-serif'; tg.fillText(String(k / 1000), cx + Math.cos(a) * (R - 80), cy + Math.sin(a) * (R - 80)); }
  }
  tg.fillStyle = 'rgba(236,238,245,0.55)'; tg.font = '600 15px Inter, sans-serif'; tg.fillText('RPM ×1000', cx, cy - 64);
  tg.fillStyle = c.shiftT > 0 ? 'rgba(236,238,245,0.35)' : '#ffffff'; tg.font = 'italic 700 96px "Chakra Petch", sans-serif'; tg.fillText(c.launched ? String(c.gear) : 'N', cx, cy + 72);
  tg.fillStyle = '#eceef5'; tg.font = 'italic 700 34px "Chakra Petch", sans-serif'; tg.fillText(Math.round(c.v * 3.6) + ' KM/H', cx, cy + 150);
  const a = ang(c.rpm);
  tg.strokeStyle = accent; tg.lineWidth = 7; tg.lineCap = 'round';
  tg.beginPath(); tg.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18); tg.lineTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); tg.stroke();
  tg.fillStyle = '#1a1b24'; tg.beginPath(); tg.arc(cx, cy, 18, 0, Math.PI * 2); tg.fill();
}
const leds = Array.from($('leds').children);
function drawLeds(c, staged) {
  const u = c.rpm / c.ph.redline, lo = staged ? 0.5 : 0.9, hi = staged ? 0.68 : 0.975;
  $('leds').classList.toggle('shift', u >= lo && u < hi);
  const th = staged ? [0.2, 0.28, 0.36, 0.42, 0.46, 0.48, 0.5] : [0.6, 0.66, 0.72, 0.78, 0.83, 0.87, 0.9];
  leds.forEach((l, i) => { l.className = u >= th[i] ? (i < 3 ? 'on1' : i < 5 ? 'on2' : 'on3') : ''; });
}
let calloutTimer = 0;
function callout(text, cls = '', ms = 1100) {
  const c = $('callout'); c.textContent = text; c.className = 'callout ' + cls + (text.length > 26 ? ' long' : '');
  clearTimeout(calloutTimer); if (ms) calloutTimer = setTimeout(() => { c.textContent = ''; }, ms);
}
function renderNos(c) {
  const box = $('nos'); box.replaceChildren();
  const total = c.ph.bottles;
  if (!total) { box.append(el('span', 'none', 'None fitted')); return; }
  for (let i = 0; i < total; i++) { const b = el('i'); if (i >= c.bottles) b.className = c.nosT > 0 && i === c.bottles ? 'live' : 'used'; box.append(b); }
}
