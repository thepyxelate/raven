/* ================= drag race ================= */
// Model: torque curve x gear x final drive -> wheel force, capped by tyre grip (wheelspin above it),
// tyre temperature from the burnout scales grip, clutch-slip launch from the rpm held at the green light,
// reaction time from the launch press, timed shifts with no drive while shifting, rev limiter that cuts power
// and heats the engine, tuned nitrous as a torque multiplier, aero + rolling drag.
const G = 9.81, H = 1 / 240;
const TRACKS = [['strip', 'Sunset Strip'], ['coast', 'Palm Coast'], ['rain', 'Neon Rain']];
// id, label, hp factor (quick race), launch rpm, shift point, shift jitter, nitro gear, reaction range, traffic look-ahead (s)
const DIFFS = [
  ['easy', 'Easy', 0.86, 0.42, 0.84, 0.1, 4, [0.32, 0.48], 0.8],
  ['normal', 'Normal', 0.98, 0.56, 0.9, 0.06, 3, [0.2, 0.3], 1.1],
  ['hard', 'Hard', 1.07, 0.6, 0.94, 0.025, 3, [0.12, 0.19], 1.4]
];
const MODES = [['ladder', 'Street ladder'], ['quick', 'Quick race'], ['test', 'Test run'], ['challenge', 'Challenge']];
const RIVAL_BASE = { fbumper: 'sport', rbumper: 'sport', skirt: 'sport', spoiler: 'gt', wingColor: 'carbon', hood: 'carbon', rimStyle: 'mesh', susp: 'sport', width: 'stock', sticker: '', vinyl: 'none', roof: 'none', mirrors: 'stock', fenderVents: false };
const LADDER = [
  { name: 'Mako', note: 'Weekend racer. Short-shifts and never touches nitro.', skill: 'easy', color: '#2ec4e6', look: { model: 'ember', fbumper: 'street', rbumper: 'stock', spoiler: 'lip', rimStyle: 'classic', hood: 'stock' }, perf: { engine: 0, turbo: 'none', nitro: 0, gearbox: 'stock', tires: 'street' }, boost: 0.973 },
  { name: 'Ruby', note: 'Drift kid on her first drag night.', skill: 'easy', color: '#d42a3c', look: { model: 'raven', fbumper: 'aggr', spoiler: 'tri', width: 'over', rimStyle: 'deep', hood: 'vents' }, perf: { engine: 1, turbo: 'none', nitro: 1, gearbox: 'stock', tires: 'street' } },
  { name: 'Static', note: 'Clean launches, lazy shifts.', skill: 'normal', color: '#9aa3ad', look: { model: 'blackjaw', spoiler: 'duck', rimStyle: 'y' }, perf: { engine: 1, turbo: 'small', nitro: 1, gearbox: 'sport', tires: 'sport' }, boost: 1.046 },
  { name: 'Neon Kai', note: 'Lights the nitro early in third.', skill: 'normal', color: '#ff3da8', look: { model: 'ember', fbumper: 'aggr', rbumper: 'diff', hood: 'vents' }, perf: { engine: 2, turbo: 'small', nitro: 1, gearbox: 'sport', tires: 'sport' }, boost: 0.91 },
  { name: 'Viper', note: 'Fast hands. Rarely misses a shift.', skill: 'hard', color: '#1e9e5a', look: { model: 'vanta', rbumper: 'diff', spoiler: 'swan', rimStyle: 'six', hood: 'louvers' }, perf: { engine: 2, turbo: 'big', nitro: 1, gearbox: 'race', tires: 'sport' }, boost: 0.893 },
  { name: 'Halo', note: 'Widebody show car with real pace.', skill: 'hard', color: '#f2f2f2', look: { model: 'blackjaw', fbumper: 'aggr', rbumper: 'diff', width: 'wide', rimStyle: 'deep' }, perf: { engine: 3, turbo: 'small', nitro: 2, gearbox: 'race', tires: 'slick' }, boost: 1.112 },
  { name: 'Ghostline', note: 'Gone before the tree finishes dropping.', skill: 'hard', color: '#121316', look: { model: 'vanta', fbumper: 'track', rbumper: 'track', width: 'wide', spoiler: 'swan', rimStyle: 'aero', roof: 'vortex' }, perf: { engine: 3, turbo: 'big', nitro: 1, gearbox: 'race', tires: 'slick' }, boost: 0.898 },
  { name: 'Midnight', note: 'Owns the Strip. Beat him to finish the ladder.', skill: 'hard', color: '#4b1fa8', look: { model: 'raven', fbumper: 'track', rbumper: 'track', width: 'over', spoiler: 'tri', rimStyle: 'six', hood: 'vents', roof: 'louvers' }, perf: { engine: 3, turbo: 'big', nitro: 2, gearbox: 'race', tires: 'slick', ecu: 'high' }, boost: 1.05 }
];
const LOOK_KEYS = ['model', 'width', 'susp', 'fbumper', 'rbumper', 'skirt', 'hood', 'spoiler', 'exhaust', 'rimStyle', 'rimSize', 'brakes', 'roof', 'mirrors', 'fenderVents'];
const LANES2 = [1.9, -1.9], LANES3 = [3.4, 0, -3.4], TRAFFIC_N = 12;
const store = {
  get(k, d) { try { const v = localStorage.getItem('raven-rs-' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('raven-rs-' + k, v); } catch (e) { /* storage unavailable */ } }
};
let raceTrack = store.get('track', 'strip'), raceDiff = store.get('diff', 'normal'), raceMode = store.get('mode', 'ladder'), traffic = store.get('traffic', 'off') === 'on';
if (!TRACKS.some((t) => t[0] === raceTrack)) raceTrack = 'strip';
if (!DIFFS.some((d) => d[0] === raceDiff)) raceDiff = 'normal';
if (!MODES.some((m) => m[0] === raceMode)) raceMode = 'ladder';
let ladderNext = Math.max(0, Math.min(LADDER.length, parseInt(store.get('ladder', '0'), 10) || 0));
let ladderPick = Math.min(ladderNext, LADDER.length - 1);
let challenge = null;
const rivalPaint = new THREE.MeshPhysicalMaterial({ color: '#e7e8ee', metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
const ghostMat = new THREE.MeshBasicMaterial({ color: '#7fd7ff', transparent: true, opacity: 0.26, depthWrite: false });
