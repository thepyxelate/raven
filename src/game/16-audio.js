/* ---- engine sound: a synth voice per car, with turbo spool and flutter ---- */
let audio = null, soundOn = store.get('sound', 'on') !== 'off';
import { ENGINE_VOICE, engineWave, softClip } from '../audio/voices.js';
const voiceOf = (id) => ENGINE_VOICE[id] || ENGINE_VOICE[baseOf(id)] || ENGINE_VOICE.raven;
// Recorded engine: loops cut from a real acceleration ramp, a deceleration ramp and an idle take, one every 250-500 rpm.
// Each loop was straightened to a constant speed and holds a whole number of engine cycles (its true rpm measured from
// the waveform), so all loops can run in step: playback speed follows the revs, the two loops nearest the current
// revs are crossfaded, and the throttle fades between the "on" (accelerating) and "off" (coasting) layers.
// The PCM lives in engine.bin (a hashed asset, ~700 KB) and is fetched in the background at start-up, so it neither
// weighs down the JavaScript bundle nor blocks the page. A race that starts before it arrives plays the synth layer,
// and the recorded core is added to the running sound the moment the file lands (see audio.addCore).
import { ENG_META } from '../audio/engineMeta.js';
import ENGINE_BIN from '../audio/engine.bin?url';
const REC_IDLE = ENG_META.on[0][0], REC_TOP = 7150;
let ENG_F32 = null;
const engineLoad = fetch(ENGINE_BIN).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))).then((buf) => {
  const pcm = new Int16Array(buf);
  const lay = (L) => L.map(([rpm, nc, o, n]) => { const f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = pcm[o + i] / 32768; return { rpm, nc, f }; });
  ENG_F32 = { on: lay(ENG_META.on), off: lay(ENG_META.off) };
  if (audio && audio.addCore) audio.addCore(ENG_F32);
  return ENG_F32;
}).catch((e) => { console.warn('[audio] engine recording unavailable, synth only', e); });
const engineSamples = () => ENG_F32;
function audioStart(testCtx) {
  if (audio || (!soundOn && !testCtx)) return;
  try {
    const ctx = testCtx || new (window.AudioContext || window.webkitAudioContext)();
    const V = voiceOf(cfg.model);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.12;
    const out = ctx.createGain(); out.gain.value = 1.3; out.connect(comp); comp.connect(ctx.destination);
    const fx = ctx.createGain(); fx.gain.value = 1; fx.connect(ctx.destination); // turbo effects skip the engine compressor so they cut through
    if (!testCtx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    loadFlutter(ctx);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), ch = nb.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random()); return s; };
    const GN = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const BQ = (type, f, q, gain) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (gain !== undefined) b.gain.value = gain; return b; };
    const OSC = (wave, f) => { const o = ctx.createOscillator(); if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave); o.frequency.value = f; o.start(); return o; };
    // engine core: the recorded loops, started together so they stay in step
    const SM = engineSamples(), eng = GN(1), g = GN(0);
    const layer = (list, t0) => {
      const lg = GN(0); lg.connect(eng);
      return { lg, loops: list.map((l) => { const b = ctx.createBuffer(1, l.f.length, ENG_META.sr); b.getChannelData(0).set(l.f); const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; const gn = GN(0); src.connect(gn); gn.connect(lg); src.start(t0); return { rpm: l.rpm, src, gn }; }) };
    };
    // until the recording has arrived the layers are empty and only the synth layer plays
    const empty = () => ({ lg: GN(0), loops: [] });
    let lOn = SM ? layer(SM.on, ctx.currentTime + 0.03) : empty(), lOff = SM ? layer(SM.off, ctx.currentTime + 0.03) : empty();
    // synth layer under the recording: two detuned oscillators -> waveshaper -> lowpass that opens with revs
    const wave = engineWave(ctx, V), so1 = OSC(wave, 40), so2 = OSC(wave, 40), sIn = GN(0.55), s2g = GN(0.7);
    const shaper = ctx.createWaveShaper(); shaper.curve = softClip(1024, V.clip + (cfg.engine || 0) * 0.5); shaper.oversample = '2x';
    const slp = BQ('lowpass', 1500, 0.7), synG = GN(0);
    so1.connect(sIn); so2.connect(s2g); s2g.connect(sIn); sIn.connect(shaper); shaper.connect(slp); slp.connect(synG); synG.connect(eng);
    // the car's EQ, its exhaust resonances, then shelves for the exhaust type, a turbo's muffling and the VTEC step
    let tail = eng; for (const [type, f, q, gain] of V.eq) { const e = BQ(type, f, q, gain); tail.connect(e); tail = e; }
    for (const [f, q, lv] of V.form) { const e = BQ('peaking', f, q, lv * 5); tail.connect(e); tail = e; }
    const exLow = ({ single: -2, dual: 0, quad: 2.5, center: 1.5 })[cfg.exhaust] || 0, exHigh = ({ single: 2, dual: 0, quad: -1, center: 1 })[cfg.exhaust] || 0;
    const ls = BQ('lowshelf', 140, 0.7, exLow), hs = BQ('highshelf', 2800, 0.7, exHigh - (cfg.turbo !== 'none' ? 2 : 0));
    tail.connect(ls); ls.connect(hs);
    // idle lope: the engine's level throbs once per cycle, strongest at idle
    const lopeG = GN(1), lopeO = OSC('sine', 7), lopeD = GN(0); lopeO.connect(lopeD); lopeD.connect(lopeG.gain);
    hs.connect(lopeG); lopeG.connect(g); g.connect(out);
    // exhaust rasp and intake roar: noise pulsed at the firing frequency
    const firing = OSC('sine', 48);
    const rbp = BQ('bandpass', 900, 1.4), ram = GN(0.5), depth = GN(0.5), rg = GN(0);
    firing.connect(depth); depth.connect(ram.gain); noise().connect(rbp); rbp.connect(ram); ram.connect(rg); rg.connect(out);
    const ibp = BQ('bandpass', V.hi[0], V.hi[1] * 0.4), iam = GN(0.5), idepth = GN(0.5), ig = GN(0);
    firing.connect(idepth); idepth.connect(iam.gain); noise().connect(ibp); ibp.connect(iam); iam.connect(ig); ig.connect(out);
    // turbo: spool whistle plus a thin compressor hiss
    const wh = OSC('sine', 2000), whg = GN(0); wh.connect(whg); whg.connect(out);
    const thf = BQ('bandpass', 5200, 5), thg = GN(0); noise().connect(thf); thf.connect(thg); thg.connect(out);
    // nitro hiss
    const hf = BQ('highpass', 3200, 0.7), hg = GN(0); noise().connect(hf); hf.connect(hg); hg.connect(out);
    // the car moving through the air and over the road, tyres letting go, straight-cut gear whine
    const windF = BQ('lowpass', 500, 0.5), windG = GN(0); noise().connect(windF); windF.connect(windG); windG.connect(out);
    const roadF = BQ('bandpass', 120, 0.6), roadG = GN(0); noise().connect(roadF); roadF.connect(roadG); roadG.connect(out);
    const sq1 = BQ('bandpass', 1000, 16), sq2 = BQ('bandpass', 1500, 20), sq2g = GN(0.55), sqG = GN(0);
    const sqn = noise(); sqn.connect(sq1); sqn.connect(sq2); sq1.connect(sqG); sq2.connect(sq2g); sq2g.connect(sqG); sqG.connect(fx);
    const whine = OSC('triangle', 400), whineG = GN(0); whine.connect(whineG); whineG.connect(out);
    const addCore = (sm) => { if (!audio || audio.ctx !== ctx || audio.lOn.loops.length) return; const t0 = ctx.currentTime + 0.03; audio.lOn = layer(sm.on, t0); audio.lOff = layer(sm.off, t0); };
    audio = { ctx, out, fx, nb, V, lOn, lOff, addCore, g, so1, so2, slp, synG, hs, hsBase: exHigh - (cfg.turbo !== 'none' ? 2 : 0), lopeO, lopeD, firing, rbp, rg, ibp, ig, wh, whg, thf, thg, hg, windF, windG, roadG, sq1, sq2, sqG, whine, whineG, spool: 0, lim: 0, popT: 0, duckT: 0, flut: null, jit: 0, sq: 0, prevVol: 0 };
  } catch (e) { audio = null; }
}
// c: { ph, rpm, thr, shiftT, launched, blown, nosT } plus optional v (m/s) and slide (0..1, tyres letting go)
function audioUpdate(c, dt = 1 / 60) {
  if (!audio) return;
  const a = audio, t = a.ctx.currentTime, p = c.ph, V = a.V, u = Math.min(1.02, c.rpm / p.redline);
  const S = (prm, v, tc) => { if (Number.isFinite(v)) prm.setTargetAtTime(v, t, tc); };
  // no engine holds a perfectly steady speed: the pitch wanders a little, most at idle
  a.jit += ((Math.random() - 0.5) * 0.02 * (V.rough / 0.07) - a.jit) * Math.min(1, dt * 5);
  const cyc = Math.max(7, c.rpm / 120) * (1 + a.jit * Math.max(0.15, 1.1 - u * 1.4)), fire = cyc * V.cyl;
  // load: free revs barely build boost, an open throttle in gear does; a shift dumps it
  const vol = c.shiftT > 0 || c.blown ? 0 : c.thr, load = vol * (c.launched ? 1 : 0.3);
  S(a.firing.frequency, fire, 0.015);
  // synth layer and idle lope follow the cycle frequency; the synth gets louder on throttle
  S(a.so1.frequency, cyc, 0.015); S(a.so2.frequency, cyc * V.det, 0.015);
  S(a.slp.frequency, 900 + u * 4500 + vol * 800, 0.04);
  S(a.synG.gain, V.syn * (0.55 + 0.45 * vol), 0.03);
  S(a.lopeO.frequency, cyc, 0.02);
  S(a.lopeD.gain, V.lope * (cfg.ecu === 'low' ? 1.4 : 1) * Math.pow(Math.max(0, 1 - u * 1.6), 2) * 0.5, 0.05);
  S(a.hs.gain, a.hsBase + (V.vt && u > V.vt[0] ? V.vt[1] : 0), 0.06);
  // where the game's revs sit on the recorded car's range, then: speed for every loop, level for the two nearest
  const [rLo, rHi] = V.rec || [REC_IDLE, REC_TOP];
  const rr = rLo + clamp((c.rpm - p.idle) / (p.redline - p.idle), 0, 1.02) * (rHi - rLo), rj = rr * (1 + a.jit * Math.max(0.1, 0.8 - u));
  for (const [L, lv] of [[a.lOn, Math.sin(vol * Math.PI / 2)], [a.lOff, Math.cos(vol * Math.PI / 2)]]) {
    S(L.lg.gain, lv, 0.035);
    const n = L.loops.length; if (n < 2) continue; let i = 0; while (i < n - 2 && L.loops[i + 1].rpm <= rr) i++;
    const x = clamp((rr - L.loops[i].rpm) / (L.loops[i + 1].rpm - L.loops[i].rpm), 0, 1);
    for (let k = 0; k < n; k++) { const l = L.loops[k]; S(l.src.playbackRate, V.pf * rj / l.rpm, 0.015); S(l.gn.gain, k === i ? Math.cos(x * Math.PI / 2) : k === i + 1 ? Math.sin(x * Math.PI / 2) : 0, 0.02); }
  }
  S(a.rbp.frequency, Math.min(6000, fire * 3.2), 0.03); S(a.ibp.frequency, V.hi[0] * (0.45 + 0.75 * u), 0.05);
  // rev limiter: the ignition cuts in and out
  a.lim = c.rpm >= p.redline - 170 && c.thr > 0.5 ? (a.lim + 1) % 4 : 0;
  const cut = (a.lim >= 2 ? 0.35 : 1) * (t < a.duckT ? 0.4 : 1); // duck under the turbo flutter
  S(a.g.gain, c.blown ? 0 : (0.1 + vol * 0.17 + u * 0.09) * cut, 0.025);
  S(a.rg.gain, c.blown ? 0 : (0.002 + vol * 0.009 + (1 - vol) * u * 0.004) * cut * (cfg.exhaust === 'single' ? 0.8 : 1.1), 0.03);
  S(a.ig.gain, c.blown ? 0 : vol * (0.25 + 0.75 * u) * 0.009 * cut, 0.04);
  // turbo spool lags behind the throttle; a big turbo comes on later and harder
  const big = cfg.turbo === 'big', turbo = cfg.turbo !== 'none';
  const target = turbo ? load * Math.max(0, Math.min(1, (u - (big ? 0.42 : 0.3)) / 0.45)) : 0;
  if (c.launched && c.shiftT <= 0 && a.prevVol > 0.6 && c.thr < 0.3 && a.spool > 0.3) flutter(); // lifting off with boost up flutters too
  a.prevVol = vol;
  a.spool += (target - a.spool) * Math.min(1, dt * (target > a.spool ? (big ? 1.6 : 2.6) : 9));
  S(a.wh.frequency, V.tw[0] + a.spool * V.tw[1] * (big ? 0.8 : 1), 0.05);
  S(a.whg.gain, a.spool * (big ? 0.045 : 0.035) * V.tw[2], 0.05);
  S(a.thg.gain, a.spool * (big ? 0.05 : 0.035), 0.05);
  S(a.hg.gain, c.nosT > 0 ? 0.045 : 0, 0.05);
  if (a.flut && vol > 0.5 && t - a.flut.t0 > 0.55 && !a.flut.fading) { a.flut.fading = true; a.flut.g.gain.setTargetAtTime(0, t, 0.22); }
  // wind and road noise grow with speed; tyres howl when they slide
  const v = Math.abs(c.v || 0), sl = clamp(c.slide !== undefined ? c.slide : c.spin ? 0.7 : 0, 0, 1);
  S(a.windF.frequency, 420 + v * 16, 0.1); S(a.windG.gain, Math.min(0.06, v * v / 3600 * 0.06), 0.1);
  S(a.roadG.gain, Math.min(1, v / 35) * 0.03, 0.1);
  a.sq += (sl - a.sq) * Math.min(1, dt * (sl > a.sq ? 12 : 6));
  S(a.sq1.frequency, 860 + a.sq * 240 + Math.min(v, 40) * 4, 0.05); S(a.sq2.frequency, (860 + a.sq * 240 + Math.min(v, 40) * 4) * 1.52, 0.05);
  S(a.sqG.gain, a.sq * a.sq * 0.11, 0.03);
  S(a.whine.frequency, clamp(v * 42, 180, 4200), 0.04); S(a.whineG.gain, cfg.gearbox === 'race' ? Math.min(1, v / 18) * (0.3 + 0.7 * vol) * 0.006 : 0, 0.05);
  // lift-off crackle from the exhaust
  a.popT -= dt;
  const P = V.pop;
  if (c.launched && c.thr < 0.15 && c.shiftT <= 0 && u > 0.5 && a.popT <= 0 && Math.random() < P[0] * (cfg.ecu === 'high' ? 1.5 : 1)) {
    a.popT = 0.06 + (P[3] - 1) * 0.05;
    for (let i = 0; i < P[3]; i++) pop((0.06 + Math.random() * 0.05) * P[2], P[1] * (0.8 + Math.random() * 0.4), i * (0.03 + Math.random() * 0.03));
  }
}
function burst(at, dur, f, q, vol, fEnd, dest) {
  const { ctx, nb, out } = audio;
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = nb; bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f, at); if (fEnd) bp.frequency.exponentialRampToValueAtTime(fEnd, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
  src.connect(bp); bp.connect(g); g.connect(dest || out); src.start(at, Math.random() * 0.8); src.stop(at + dur + 0.02);
}
function pop(vol, f, delay = 0) {
  if (!audio) return;
  try { burst(audio.ctx.currentTime + delay, 0.045, f || 700 + Math.random() * 500, 0.8, vol); } catch (e) { /* audio is optional */ }
}
// "tsu-tu-tu-tu": boost dumps with a hiss, then the compressor surges and flutters out
// recorded turbo flutter ("stu-tu-tu"), decoded once and reused by every race
import FLUTTER_MP3 from '../audio/flutter.mp3?url';
let flutterBuf = null, flutterLoading = false;
function loadFlutter(ctx) {
  if (flutterBuf || flutterLoading) return;
  flutterLoading = true;
  fetch(FLUTTER_MP3).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((buf) => new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej)))
    .then((b) => { flutterBuf = b; })
    .catch((e) => { console.warn('[audio] flutter clip unavailable, using the synth flutter', e); }); // stays 'loading': no refetch every race
}
// fallback if the clip is not decoded yet: a train of low air chuffs at ~13 Hz that slows and fades
function flutterSynth(t, s, n = 18) {
  const { ctx, nb, fx } = audio;
  let at = t, gap = 0.062, vol = 0.55 * s;
  for (let i = 0; i < n; i++) {
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nb; lp.type = 'bandpass'; lp.frequency.value = 380 + Math.random() * 120; lp.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, at + gap * 0.9);
    src.connect(lp); lp.connect(g); g.connect(fx); src.start(at, Math.random() * 0.8); src.stop(at + gap);
    at += gap * (0.85 + Math.random() * 0.3); gap *= 1.02; vol *= 0.87;
  }
  burst(t, 0.12, 3200, 0.8, 0.35 * s, 1600, fx);
}
// Lifting off with boost up opens the blow-off valve: a short falling hiss whose length and level follow the boost.
// The recorded compressor flutter plays only if the driver picks it, only on a real lift (never on a gear change)
// and only with plenty of boost. Either way the sound is rate-limited so it never chatters.
function flutter(shift) {
  const mode = cfg.bov || 'soft';
  if (!audio || cfg.turbo === 'none' || mode === 'off') return;
  try {
    const { ctx, fx } = audio, t = ctx.currentTime, sp = audio.spool, big = cfg.turbo === 'big';
    if (sp < 0.25 || t < (audio.flutNext || 0)) return;
    audio.flutNext = t + (shift ? 0.9 : 1.8) + Math.random() * 1.2;
    const s = Math.min(1, 0.3 + sp * 0.8) * (big ? 1 : 0.75);
    if (audio.flut) { try { audio.flut.g.gain.setTargetAtTime(0, t, 0.03); audio.flut.src.stop(t + 0.15); } catch (e) { /* already ended */ } audio.flut = null; }
    if (mode === 'flutter' && !shift && sp > 0.55 && !flutterBuf) flutterSynth(t, s); // clip not decoded yet
    else if (mode === 'flutter' && !shift && sp > 0.55) {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = flutterBuf; src.playbackRate.value = (big ? 0.93 : 1.07) * (0.92 + Math.random() * 0.16);
      const dur = Math.min(flutterBuf.duration / src.playbackRate.value, 0.5 + sp * 0.7);
      g.gain.setValueAtTime(0.5 * s, t); g.gain.setTargetAtTime(0, t + dur * 0.65, dur * 0.18);
      src.connect(g); g.connect(fx); src.start(t); src.stop(t + dur + 0.3);
      audio.flut = { src, g, t0: t };
    } else {
      const dur = 0.16 + 0.22 * sp + Math.random() * 0.06;
      burst(t, dur, (big ? 2400 : 3400) * (0.9 + Math.random() * 0.2), 0.7, 0.085 * s, 700, fx);
      burst(t + 0.01, dur * 0.7, 6200, 0.9, 0.03 * s, 2600, fx);
    }
    audio.spool *= 0.25; audio.duckT = t + 0.12 + 0.12 * s;
  } catch (e) { /* audio is optional */ }
}
function audioStop() { if (!audio) return; const a = audio; audio = null; try { a.out.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05); a.fx.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05); setTimeout(() => { if (a.ctx.close) a.ctx.close(); }, 300); } catch (e) { /* already closed */ } }
