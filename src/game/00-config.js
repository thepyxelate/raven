import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ================= config ================= */
// id, name, one-line character for the Car menu
const MODEL_LIST = [
  ['raven', 'Raven RS', 'Balanced street coupe. The all-rounder this garage was built around.'],
  ['ember', 'Ember R', 'Light hot hatch: short, tall and eager. Revs high, turns in sharp, small engine.'],
  ['blackjaw', 'Blackjaw', 'Heavy muscle fastback. Long hood, wide haunches and a wall of low-end torque.'],
  ['vanta', 'Vanta GT', 'Mid-engine wedge supercar. Low, light and slippery, with the highest top speed.'],
  ['supra', 'Toyota Supra', 'Tuned Japanese GT. Handles like the Raven RS.'],
  ['rx7', 'Mazda RX-7', 'Light rotary coupe on a wide body kit. Drives like the Ember R.'],
  ['m4', 'BMW M4 Widebody', 'Heavy widebody bruiser. Drives like the Blackjaw.'],
  ['audi90', 'Audi 90 GTO', 'Boxy race car from the IMSA era. Drives like the Vanta GT.']
];
// Cars that come from a .glb in public/cars. Power and handling come from `base`; each has its own engine voice (ENGINE_VOICE).
// `wheels` matches the materials that spin; parts shared by both sides are split into four corners on load.
const GLB_CARS = {
  supra: { file: 'cars/supra.glb', base: 'raven', length: 4.55, wheels: /^(wheel|Brake_Disc)$/ },
  rx7: { file: 'cars/rx7.glb', base: 'ember', length: 4.4, wheels: /^(Tyres|Rims|Rims_2|Material\.001|Disk|Disk_2)$/ },
  m4: { file: 'cars/m4.glb', base: 'blackjaw', length: 4.85, wheels: /^(sidetyre|main|disk\.001|metalblack|Material\.001)$/ },
  audi90: { file: 'cars/audi90.glb', base: 'vanta', length: 4.6, wheels: /^(GENERIC_TREAD_SLICK|GENERIC_TIRE_GOODYEAR|AUDI_90_WHEEL)\b/ }
};
const baseOf = (id) => (GLB_CARS[id] ? GLB_CARS[id].base : id);
const DEFAULTS = {
  color: '#d42a3c', color2: '#2a6cff', finish: 'gloss', width: 'stock', susp: 'stock', fbumper: 'stock', rbumper: 'stock',
  skirt: 'stock', hood: 'stock', spoiler: 'none', wingColor: 'carbon', exhaust: 'dual', vinyl: 'none', vinylColor: '#f2f2f2',
  sticker: 'RAVEN', stickerColor: '#f2f2f2', rimStyle: 'classic', rimSize: 18, rimColor: '#c9ced6', caliper: '#e0262f',
  brakes: 'stock', tint: 'light', neon: 'off', headlight: 'white', taillight: 'red', lightsOn: false,
  roof: 'none', mirrors: 'stock', fenderVents: false, finalDrive: 4.1, ecu: 'balanced', nitroTune: 'balanced',
  engine: 0, turbo: 'none', nitro: 0, gearbox: 'stock', tires: 'street', model: 'raven', custom: false, bov: 'soft'
};
const SHOWCASE = {
  color: '#6d2fd6', color2: '#2a6cff', finish: 'chameleon', width: 'wide', susp: 'stance', fbumper: 'aggr', rbumper: 'diff',
  skirt: 'carbon', hood: 'vents', spoiler: 'gt', wingColor: 'body', vinyl: 'slash', vinylColor: '#d9dce6', sticker: '',
  rimStyle: 'six', rimSize: 18, rimColor: '#3a3d45', caliper: '#e0262f', brakes: 'ceramic', neon: '#9b5cff', lightsOn: true,
  headlight: 'xenon', tint: 'dark', taillight: 'red', roof: 'none', mirrors: 'aero', fenderVents: true, engine: 3, turbo: 'big', nitro: 1, gearbox: 'race', tires: 'slick', exhaust: 'dual'
};
const STORE_KEY = 'raven-rs-3d-v1';
const clean = (o) => {
  const out = { ...DEFAULTS };
  if (o && typeof o === 'object') for (const k of Object.keys(DEFAULTS)) if (o[k] !== undefined && typeof o[k] === typeof DEFAULTS[k]) out[k] = o[k];
  out.sticker = String(out.sticker).slice(0, 14);
  if (!MODEL_LIST.some((m) => m[0] === out.model)) out.model = 'raven';
  return out;
};
const readStore = () => { try { const r = localStorage.getItem(STORE_KEY); return r ? clean(JSON.parse(r)) : null; } catch (e) { return null; } };
let cfg = readStore() || clean({ ...DEFAULTS, ...SHOWCASE });

const VINYL_COLS = [['#f2f2f2', 'White'], ['#121316', 'Black'], ['#d9dce6', 'Silver'], ['#2ee6d6', 'Neon cyan'], ['#ff3da8', 'Neon pink'], ['#ffb300', 'Yellow'], ['#e0262f', 'Red'], ['#2a6cff', 'Blue']];
const KITS = [
  ['Factory', 'Stock bumpers, no wing. Clean slate.', { fbumper: 'stock', rbumper: 'stock', skirt: 'stock', width: 'stock', hood: 'stock', spoiler: 'none', roof: 'none', mirrors: 'stock', fenderVents: false }],
  ['Street', 'Sport bumpers and skirts with a trunk lip.', { fbumper: 'sport', rbumper: 'sport', skirt: 'sport', width: 'stock', hood: 'stock', spoiler: 'lip', roof: 'none', mirrors: 'stock', fenderVents: false }],
  ['Sleeper', 'Smooth front lip, tucked rear and a ducktail.', { fbumper: 'street', rbumper: 'clean', skirt: 'stock', width: 'stock', hood: 'bulge', spoiler: 'duck', roof: 'none', mirrors: 'stock', fenderVents: false }],
  ['Drift Missile', 'Bolt-on overfenders, vented hood, twin-element wing.', { fbumper: 'aggr', rbumper: 'sport', skirt: 'carbon', width: 'over', hood: 'vents', spoiler: 'tri', roof: 'none', mirrors: 'aero', fenderVents: true }],
  ['Widebody Show', 'Riveted widebody, diffuser and a GT wing.', { fbumper: 'aggr', rbumper: 'diff', skirt: 'carbon', width: 'wide', hood: 'carbon', spoiler: 'gt', roof: 'louvers', mirrors: 'aero', fenderVents: true }],
  ['Time Attack', 'Huge splitter, louvers, swan-neck wing, roof fins.', { fbumper: 'track', rbumper: 'track', skirt: 'aero', width: 'wide', hood: 'louvers', spoiler: 'swan', roof: 'vortex', mirrors: 'aero', fenderVents: true }]
];
function groupsFor(t) {
  const P = (title, key, opts) => ({ type: 'pills', title, key, opts });
  const S = (title, key, opts) => ({ type: 'swatch', title, key, opts });
  if (t === 'kits') return [{ type: 'kits' }];
  if (t === 'body') return [
    P('Front bumper', 'fbumper', [['stock', 'Stock'], ['street', 'Street lip'], ['sport', 'Sport'], ['aggr', 'Aggressive'], ['track', 'Time attack']]),
    P('Rear bumper', 'rbumper', [['stock', 'Stock'], ['clean', 'Tucked'], ['sport', 'Sport'], ['diff', 'Diffuser'], ['track', 'Time attack']]),
    P('Side skirts', 'skirt', [['stock', 'Stock'], ['sport', 'Sport'], ['carbon', 'Carbon'], ['aero', 'Aero winglets']]),
    P('Fenders', 'width', [['stock', 'Stock'], ['wide', 'Riveted widebody'], ['over', 'Bolt-on overfenders']]),
    P('Fender vents', 'fenderVents', [[false, 'None'], [true, 'Vented']]),
    P('Exhaust', 'exhaust', [['single', 'Single'], ['dual', 'Dual'], ['quad', 'Quad'], ['center', 'Center exit']])
  ];
  if (t === 'aero') return [
    P('Spoiler', 'spoiler', [['none', 'None'], ['lip', 'Trunk lip'], ['duck', 'Ducktail'], ['roof', 'Roof spoiler'], ['gt', 'GT wing'], ['swan', 'Swan-neck'], ['tri', 'Twin-element']]),
    P('Wing finish', 'wingColor', [['carbon', 'Carbon'], ['body', 'Body color']]),
    P('Hood', 'hood', [['stock', 'Stock'], ['bulge', 'Power bulge'], ['scoop', 'Scoop'], ['vents', 'Vented carbon'], ['louvers', 'Louvered'], ['carbon', 'Carbon']]),
    P('Roof', 'roof', [['none', 'Clean'], ['scoop', 'Roof scoop'], ['vortex', 'Vortex fins'], ['louvers', 'Rear louvers']]),
    P('Mirrors', 'mirrors', [['stock', 'Stock'], ['aero', 'Aero']])
  ];
  if (t === 'paint') return [
    S('Body color', 'color', [['#d42a3c', 'Red'], ['#ff6a1a', 'Orange'], ['#f2c230', 'Yellow'], ['#9be22d', 'Lime'], ['#1e9e5a', 'Green'], ['#2ec4e6', 'Cyan'], ['#1f5fd6', 'Blue'], ['#6d2fd6', 'Purple'], ['#ff3da8', 'Pink'], ['#f2f2f2', 'White'], ['#9aa3ad', 'Silver'], ['#4a4f57', 'Graphite'], ['#121316', 'Black'], ['#c9a227', 'Gold']]),
    P('Finish', 'finish', [['gloss', 'Gloss'], ['metal', 'Metallic'], ['mat', 'Matte'], ['pearl', 'Pearl'], ['chameleon', 'Chameleon']]),
    S('Chameleon flip color', 'color2', [['#2a6cff', 'Blue'], ['#2ee6d6', 'Cyan'], ['#9b5cff', 'Violet'], ['#ff3da8', 'Pink'], ['#ffb300', 'Gold'], ['#3bd16f', 'Green']])
  ];
  if (t === 'vinyl') return [
    P('Pattern', 'vinyl', [['none', 'None'], ['slash', 'Raven slashes'], ['stripes', 'Racing stripes'], ['flames', 'Flames'], ['bolt', 'Lightning'], ['line', 'Side stripe'], ['twotone', 'Two-tone'], ['checker', 'Checkered']]),
    S('Pattern color', 'vinylColor', VINYL_COLS),
    { type: 'sticker' },
    S('Decal color', 'stickerColor', VINYL_COLS)
  ];
  if (t === 'wheels') return [
    P('Rim style', 'rimStyle', [['classic', 'Classic'], ['six', 'Six-spoke'], ['mesh', 'Mesh'], ['y', 'Y-spoke'], ['aero', 'Aero'], ['deep', 'Deep dish']]),
    P('Size', 'rimSize', [[17, '17"'], [18, '18"'], [19, '19"'], [20, '20"']]),
    S('Rim color', 'rimColor', [['#c9ced6', 'Silver'], ['#3a3d45', 'Gunmetal'], ['#16171b', 'Black'], ['#c9a227', 'Gold'], ['#8c5a2b', 'Bronze'], ['#ededed', 'White'], ['#c8202e', 'Red'], ['#2ec4e6', 'Cyan']]),
    S('Brake caliper', 'caliper', [['#e0262f', 'Red'], ['#ffcc00', 'Yellow'], ['#2a6cff', 'Blue'], ['#3bd16f', 'Green'], ['#ff3da8', 'Pink'], ['#1a1a1a', 'Black']])
  ];
  if (t === 'lights') return [
    S('Underglow', 'neon', [['off', 'Off'], ['#2ee6d6', 'Cyan'], ['#ff3da8', 'Pink'], ['#3d7bff', 'Blue'], ['#9b5cff', 'Violet'], ['#3bff8a', 'Green'], ['#ff3b3b', 'Red'], ['#ffffff', 'White']]),
    P('Headlights', 'lightsOn', [[false, 'Off'], [true, 'On']]),
    P('Headlight color', 'headlight', [['white', 'White'], ['xenon', 'Xenon'], ['amber', 'Amber']]),
    P('Taillights', 'taillight', [['red', 'Red'], ['smoke', 'Smoked'], ['led', 'LED bar']]),
    P('Window tint', 'tint', [['none', 'None'], ['light', 'Light'], ['dark', 'Dark'], ['limo', 'Limo']])
  ];
  return [
    P('Engine', 'engine', [[0, 'Stock'], [1, 'Stage 1'], [2, 'Stage 2'], [3, 'Stage 3'], [4, 'Stage 4']]),
    P('Turbo', 'turbo', [['none', 'None'], ['small', 'Small'], ['big', 'Big']]),
    P('Blow-off sound', 'bov', [['off', 'Off'], ['soft', 'Soft whoosh'], ['flutter', 'Flutter']]),
    P('Nitro', 'nitro', [[0, 'None'], [1, '1 bottle'], [2, '2 bottles']]),
    P('Gearbox', 'gearbox', [['stock', 'Stock'], ['sport', 'Sport'], ['race', 'Race']]),
    P('Suspension', 'susp', [['stock', 'Stock'], ['sport', 'Sport'], ['stance', 'Stance']]),
    P('Tires', 'tires', [['street', 'Street'], ['sport', 'Sport'], ['slick', 'Slick']]),
    P('Brakes', 'brakes', [['stock', 'Stock · fade when hot'], ['sport', 'Sport · stronger'], ['ceramic', 'Carbon-ceramic · no fade']]),
    P('Final drive', 'finalDrive', [[3.5, '3.50 · top speed'], [3.8, '3.80'], [4.1, '4.10 · balanced'], [4.4, '4.40'], [4.7, '4.70 · launch']]),
    P('ECU map', 'ecu', [['low', 'Low-end torque'], ['balanced', 'Balanced'], ['high', 'High-rpm power']]),
    P('Nitro tune', 'nitroTune', [['long', 'Long and soft'], ['balanced', 'Balanced'], ['power', 'Short and hard']])
  ];
}

function stats(c) {
  const B = modelOf(c).base;
  const hp = B.hp + [0, 40, 90, 160, 300][c.engine] + ({ none: 0, small: 50, big: 110 })[c.turbo];
  const weight = B.weight + ({ stock: 0, wide: 25, over: 15 })[c.width] + ({ none: 0, lip: 2, duck: 4, roof: 3, gt: 12, swan: 11, tri: 15 })[c.spoiler] - (c.hood === 'carbon' || c.hood === 'vents' ? 12 : 0)
    + ({ stock: 0, sport: 6, carbon: 2, aero: 4 })[c.skirt] + ({ stock: 0, street: 2, sport: 4, aggr: 6, track: 9 })[c.fbumper] + ({ none: 0, scoop: 3, vortex: 1, louvers: 4 })[c.roof] + (c.turbo !== 'none' ? 15 : 0);
  const gear = ({ stock: 0, sport: 1, race: 2 })[c.gearbox], tire = ({ street: 0, sport: 1, slick: 2 })[c.tires];
  const t100 = 1.6 + 5.2 * Math.pow((weight / hp) / 6.944, 0.75) - [0, 0.15, 0.3][gear] - [0, 0.15, 0.35][tire] - [0, 0.3, 0.55][c.nitro];
  const vmax = topSpeed(c, hp, weight);
  const handling = Math.min(100, 40 + B.handling + ({ stock: 0, sport: 20, stance: 12 })[c.susp] + [0, 12, 22][tire] + ({ none: 0, lip: 2, duck: 5, roof: 3, gt: 12, swan: 14, tri: 15 })[c.spoiler] + ({ stock: 0, wide: 6, over: 5 })[c.width]
    + ({ stock: 0, street: 1, sport: 2, aggr: 3, track: 6 })[c.fbumper] + (c.rbumper === 'track' || c.rbumper === 'diff' ? 2 : 0) + (c.roof === 'vortex' ? 2 : 0) + ({ 17: 0, 18: 2, 19: 4, 20: 5 })[c.rimSize]);
  const braking = Math.min(100, 40 + ({ stock: 0, sport: 25, ceramic: 45 })[c.brakes] + [0, 8, 15][tire]);
  const cl = (v) => Math.max(3, Math.min(100, Math.round(v)));
  return { hp, weight, t100, vmax: Math.round(vmax), bars: [['Acceleration', cl((8 - t100) / 5.2 * 100)], ['Top speed', cl((vmax - 200) / 170 * 100)], ['Handling', handling], ['Braking', braking]] };
}
