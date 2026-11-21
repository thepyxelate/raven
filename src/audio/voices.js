// Engine voices: one sound profile per car, plus the two synthesis helpers that turn a profile into Web Audio parts.
// Pure data and functions, no game state.

// One engine cycle (two revs) is the fundamental, at rpm / 120 Hz. An engine with N cylinders fires N times
// per cycle, so harmonic N and its multiples carry the note; the half and quarter orders between them are
// the rasp and burble of uneven pipes. Each car has its own voice, and each voice has two spectra (on and
// off the throttle) that are crossfaded and pushed through fixed exhaust and intake resonances, so the
// timbre changes with revs and load instead of one tone sliding up and down.
// Every voice plays the same recorded engine, so the character comes from what is layered and filtered on top:
//   pf      playback speed of the recording          rec   [lo, hi] part of the recording's rpm range to use
//   cyl     firing pulses per engine cycle (I4 4, I5 5, I6 6, V8 8, V10 10; a two-rotor rotary fires like an I4)
//   half    level of the orders halfway between firings (V8 burble, I5 warble), quarter: the ones between those
//   syn     level of the synthesized layer (a PeriodicWave built from the orders above) under the recording
//   det     second synth oscillator at cyc * det: slow beating between the two (warble, V10 shimmer)
//   bright  0..1: how slowly the firing harmonics fall off (1 = rotary buzz)
//   clip    drive of the synth layer's waveshaper     rough  idle pitch wander     lope  idle throb (fades with revs)
//   form    exhaust resonances [Hz, Q, level] (peaking filters on the whole engine)    hi  intake resonance [Hz, Q]
//   vt      [revs share, dB]: a bright step above that share of the redline (VTEC)
//   tw      turbo whistle [Hz at no boost, Hz added at full boost, level]
//   pop     lift-off crackle [chance per frame, Hz, level, pops per burst]
export const ENGINE_VOICE = {
  // fictional cars, voiced after the engines they stand in for
  raven: { pf: 1.16, cyl: 4, half: 0.06, quarter: 0, syn: 0.3, det: 1.004, bright: 0.2, clip: 2.6, rough: 0.07, lope: 0.08, eq: [['peaking', 900, 1, 2]], form: [[250, 2, 0.8], [1000, 3, 0.6], [2800, 4, 0.4]], hi: [1500, 2.2], tw: [1800, 4200, 1], pop: [0.08, 900, 1, 1] },
  ember: { pf: 1.3, cyl: 4, half: 0, quarter: 0, syn: 0.18, det: 1.003, bright: 0.3, clip: 2.2, rough: 0.05, lope: 0.04, eq: [['highpass', 85, 0.7, 0]], form: [[350, 2, 0.7], [1400, 4, 0.7], [3500, 5, 0.5]], hi: [1900, 2.4], vt: [0.66, 6], tw: [2400, 4600, 0.8], pop: [0.03, 1300, 0.6, 1] },
  blackjaw: { pf: 0.86, rec: [761, 5600], cyl: 8, half: 0.85, quarter: 0.45, syn: 0.34, det: 1.008, bright: 0.1, clip: 3.0, rough: 0.14, lope: 0.45, eq: [['lowshelf', 130, 0.7, 4]], form: [[90, 1.5, 1.2], [400, 2, 0.9], [1200, 3, 0.4]], hi: [1100, 2.0], tw: [1200, 3000, 1], pop: [0.06, 450, 1.1, 2] },
  vanta: { pf: 1.24, rec: [1500, 7150], cyl: 10, half: 0.15, quarter: 0, syn: 0.3, det: 1.0035, bright: 0.4, clip: 2.2, rough: 0.04, lope: 0.04, eq: [['lowshelf', 110, 0.7, -3]], form: [[300, 2, 0.6], [1500, 4, 0.8], [4000, 5, 0.7]], hi: [2100, 3.0], tw: [2600, 5000, 0.8], pop: [0.03, 1500, 1.4, 1] },
  // the imported cars, voiced after their real engines
  supra: { pf: 1.0, cyl: 6, half: 0.05, quarter: 0, syn: 0.32, det: 1.002, bright: 0.25, clip: 2.0, rough: 0.04, lope: 0.05, eq: [['highshelf', 3000, 0.7, -4]], form: [[180, 2, 0.9], [650, 3, 1.1], [1800, 4, 0.4]], hi: [1400, 2.0], tw: [2200, 6000, 1.6], pop: [0.07, 800, 1, 1] },
  rx7: { pf: 1.32, rec: [1200, 7150], cyl: 4, half: 0.35, quarter: 0.2, syn: 0.36, det: 1.006, bright: 1, clip: 5.0, rough: 0.3, lope: 0.2, eq: [['highpass', 120, 0.7, 0]], form: [[300, 2, 0.8], [1100, 4, 0.9], [3000, 5, 0.7]], hi: [2400, 2.6], tw: [2600, 4000, 0.7], pop: [0.16, 1000, 1.1, 2] },
  m4: { pf: 0.92, rec: [761, 6400], cyl: 6, half: 0.08, quarter: 0, syn: 0.4, det: 1.003, bright: 0.6, clip: 3.8, rough: 0.05, lope: 0.04, eq: [['lowshelf', 160, 0.7, 2]], form: [[140, 2, 1.1], [1200, 4, 1.1], [3200, 6, 1.2]], hi: [1700, 2.4], tw: [3800, 3000, 0.5], pop: [0.22, 1100, 1.2, 3] },
  audi90: { pf: 1.12, cyl: 5, half: 0.55, quarter: 0.1, syn: 0.36, det: 1.012, bright: 0.3, clip: 3.6, rough: 0.18, lope: 0.12, eq: [], form: [[220, 2, 0.9], [900, 3, 0.8], [2600, 4, 0.6]], hi: [1300, 2.0], tw: [1300, 2600, 1.4], pop: [0.3, 600, 1.6, 2] }
};
// the synth layer's spectrum: harmonics of the engine cycle (rpm / 120 Hz). Firing harmonics (multiples of cyl)
// carry the note, the half and quarter orders between them add burble and warble, everything else a little grit.
export function engineWave(ctx, V) {
  const N = Math.min(48, V.cyl * 3 + 2), re = new Float32Array(N + 1), im = new Float32Array(N + 1), c = V.cyl;
  for (let k = 1; k <= N; k++) {
    const r = k % c, ord = k / c;
    let a;
    if (r === 0) a = 1 / Math.pow(ord, 1.2 - V.bright * 0.8);
    else if (Math.abs(r - c / 2) <= 0.5) a = V.half * 0.8 / (ord + 0.5);
    else if (Math.abs(r - c / 4) <= 0.5 || Math.abs(r - 3 * c / 4) <= 0.5) a = V.quarter * 0.6 / (ord + 0.5);
    else a = (0.04 + V.bright * 0.25) / (ord + 1);
    im[k] = a;
  }
  return ctx.createPeriodicWave(re, im);
}
// a tanh waveshaper curve: k is the drive (higher = more grit)
export function softClip(n = 1024, k = 2.4) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
