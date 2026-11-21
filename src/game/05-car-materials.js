/* ================= car materials ================= */
const CM = {
  paint: new THREE.MeshPhysicalMaterial({ map: vinylTex, side: THREE.DoubleSide, envMapIntensity: 0.75 }),
  hood: null,
  plain: new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, envMapIntensity: 0.75 }),
  carbon: new THREE.MeshPhysicalMaterial({ color: '#2a2d34', map: carbonTexture(), roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#1b2430', roughness: 0.08, metalness: 0.1, clearcoat: 0.4, transparent: true, side: THREE.DoubleSide, envMapIntensity: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.75, metalness: 0.1, side: THREE.DoubleSide }),
  well: new THREE.MeshStandardMaterial({ color: '#050506', roughness: 1, side: THREE.DoubleSide }),
  interior: new THREE.MeshStandardMaterial({ color: '#0d0d12', roughness: 0.9, flatShading: true }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d6dae2', roughness: 0.15, metalness: 1, flatShading: true }),
  tire: new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.88 }),
  rim: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.85, flatShading: true, side: THREE.DoubleSide }),
  rimDark: new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
  disc: new THREE.MeshStandardMaterial({ color: '#6b6f78', roughness: 0.45, metalness: 0.9, flatShading: true }),
  caliper: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3, flatShading: true }),
  plate: new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }),
  head: new THREE.MeshStandardMaterial({ color: '#0d0f14', emissive: '#ffffff', flatShading: true }),
  tail: new THREE.MeshStandardMaterial({ color: '#2a0508', emissive: '#ff2b3a', flatShading: true }),
  fog: new THREE.MeshStandardMaterial({ color: '#0d0f14', emissive: '#f4f8ff', flatShading: true }),
  housing: new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.3, metalness: 0.6, flatShading: true }),
  hook: new THREE.MeshStandardMaterial({ color: '#e0262f', roughness: 0.4, metalness: 0.3, flatShading: true })
};
CM.hood = CM.paint;
function updateMaterials() {
  const p = CM.paint, f = cfg.finish;
  const set = (o) => Object.assign(p, { metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0, iridescence: 0, ...o });
  if (f === 'gloss') set({});
  if (f === 'metal') set({ metalness: 0.85, roughness: 0.34, clearcoatRoughness: 0.08 });
  if (f === 'mat') set({ metalness: 0.1, roughness: 0.82, clearcoat: 0 });
  if (f === 'pearl') set({ metalness: 0.25, roughness: 0.3, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffffff') });
  if (f === 'chameleon') set({ metalness: 0.62, roughness: 0.3, iridescence: 0.9, iridescenceIOR: 1.9, iridescenceThicknessRange: [250, 820], sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(cfg.color2) });
  p.needsUpdate = true;
  for (const k of ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'iridescence', 'iridescenceIOR']) CM.plain[k] = p[k];
  CM.plain.sheenColor.copy(p.sheenColor); CM.plain.iridescenceThicknessRange = p.iridescenceThicknessRange.slice(); CM.plain.color.set(cfg.color); CM.plain.needsUpdate = true;
  CM.glass.opacity = ({ none: 0.42, light: 0.62, dark: 0.82, limo: 0.95 })[cfg.tint];
  CM.rim.color.set(cfg.rimColor);
  if (customCar) applyCustomPaint();
  CM.caliper.color.set(cfg.caliper);
  const hc = ({ white: '#eef3ff', xenon: '#9cc8ff', amber: '#ffc44d' })[cfg.headlight];
  CM.head.emissive.set(hc); CM.head.emissiveIntensity = cfg.lightsOn ? 2.4 : 0.35;
  CM.fog.emissiveIntensity = cfg.lightsOn ? 2 : 0.25;
  const tc = ({ red: '#ff2b3a', smoke: '#b3121f', led: '#ff3355' })[cfg.taillight];
  CM.tail.emissive.set(tc); CM.tail.color.set(cfg.taillight === 'smoke' ? '#120204' : '#2a0508'); CM.tail.emissiveIntensity = cfg.lightsOn ? (cfg.taillight === 'smoke' ? 1.6 : 2.4) : 0.6;
  beams.forEach((b) => { b.color.set(hc); b.intensity = 9; b.visible = cfg.lightsOn; });
  const on = cfg.neon !== 'off';
  glow.visible = on; glowL.visible = on;
  if (on) { glowMat.color.set(cfg.neon).multiplyScalar(0.8); glowL.color.set(cfg.neon); }
  drawVinyl(); drawPlate(); invalidate();
}
