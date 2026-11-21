/* ---- garage ---- */
const M = {
  wall: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.92, metalness: 0, envMapIntensity: 0.25, side: THREE.BackSide }),
  metal: new THREE.MeshStandardMaterial({ color: '#1a1c26', roughness: 0.55, metalness: 0.6 }),
  shelf: new THREE.MeshStandardMaterial({ color: '#23263a', roughness: 0.6, metalness: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#0e0f12', roughness: 0.9, flatShading: true }),
  neonPink: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3da8').multiplyScalar(2.2) }),
  neonCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6d6').multiplyScalar(1.9) }),
  neonBlue: new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a7dff').multiplyScalar(1.9) }),
  tubeWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe8ff').multiplyScalar(1.6) })
};
const garage = new THREE.Group(); scene.add(garage);
const room = new THREE.Mesh(new THREE.BoxGeometry(18, 6.5, 18), M.wall); room.position.y = 3.25; garage.add(room);
const box = (w, h, d, mat, x, y, z, parent = garage) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };

// wet floor: mirror underneath, dark translucent concrete with puddles on top
const mirror = new Reflector(new THREE.PlaneGeometry(18, 18), { textureWidth: 1024, textureHeight: 1024, color: 0x8a8a96, multisample: 2 });
mirror.rotation.x = -Math.PI / 2; mirror.position.y = 0.002; garage.add(mirror);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 0.6, metalness: 0, envMapIntensity: 0.12, transparent: true, alphaMap: puddleAlpha() }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.004; floor.receiveShadow = true; garage.add(floor);

// back wall: banner + cyan tube + tool chest + shelf
const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
banner.position.set(0.8, 3.7, -8.95); garage.add(banner);
box(4.2, 0.05, 0.05, M.neonCyan, 0.8, 2.55, -8.9);
box(2.2, 1.15, 0.6, M.metal, 4.6, 0.58, -8.6);
for (let i = 0; i < 4; i++) box(2.0, 0.02, 0.02, M.shelf, 4.6, 0.25 + i * 0.26, -8.29);
box(0.18, 0.4, 0.18, M.shelf, 4.0, 1.35, -8.6); box(0.3, 0.22, 0.2, M.shelf, 4.5, 1.26, -8.6); box(0.12, 0.5, 0.12, M.neonBlue, 5.1, 1.4, -8.7);
// pink vertical neon in the corner
box(0.06, 4.8, 0.06, M.neonPink, 7.1, 2.6, -8.9);
// tire rack on the right wall
for (const y of [0.35, 1.45, 2.55]) box(0.6, 0.05, 3.2, M.shelf, 8.6, y, -5.6);
box(0.05, 3, 0.05, M.shelf, 8.3, 1.5, -7.2); box(0.05, 3, 0.05, M.shelf, 8.3, 1.5, -4.0);
for (const [y, z] of [[0.72, -6.6], [0.72, -5.6], [1.82, -6.6], [1.82, -4.6], [2.92, -6.1]]) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.12, 8, 18), M.rubber); t.position.set(8.6, y, z); t.rotation.y = Math.PI / 2; garage.add(t);
}
box(0.05, 0.05, 4, M.neonCyan, 8.95, 4.4, -2.5);
// roll-up door on the left wall + work light
const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.4), new THREE.MeshStandardMaterial({ map: slatTexture(), roughness: 0.6, metalness: 0.5 }));
door.position.set(-8.95, 2.2, -2.2); door.rotation.y = Math.PI / 2; garage.add(door);
box(0.1, 0.25, 5.4, M.shelf, -8.9, 4.5, -2.2);
box(0.06, 0.06, 3.4, M.tubeWhite, -8.85, 4.85, -2.2);
// front wall strip so a full orbit still reads as a garage
box(6, 0.05, 0.05, M.neonPink, 0, 4.2, 8.95);
box(0.05, 0.05, 4, M.neonBlue, -8.95, 0.6, 4.5);

const mirrorHide = garage.children.filter((o) => o.isMesh && o !== mirror && o !== banner && ![M.neonPink, M.neonCyan, M.neonBlue, M.tubeWhite].includes(o.material));
const mirrorDraw = mirror.onBeforeRender;
mirror.onBeforeRender = function (...a) { mirrorHide.forEach((o) => { o.visible = false; }); mirrorDraw.apply(this, a); mirrorHide.forEach((o) => { o.visible = true; }); };

/* ---- lights ---- */
garage.add(new THREE.HemisphereLight('#5560a8', '#0a0a12', 0.8));
const key = new THREE.SpotLight('#f1f3ff', 48, 0, 0.6, 0.8, 2);
key.position.set(0.6, 6.2, 1.8); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
garage.add(key, key.target);
const pinkL = new THREE.PointLight('#ff3da8', 26, 16, 1.6); pinkL.position.set(6.6, 2.6, -7.8); garage.add(pinkL);
const cyanL = new THREE.PointLight('#2ee6d6', 26, 14, 1.6); cyanL.position.set(0.8, 2.4, -8.0); garage.add(cyanL);
const doorL = new THREE.PointLight('#c9d6ff', 26, 16, 1.6); doorL.position.set(-8.2, 4.6, -2.2); garage.add(doorL);
const rimL = new THREE.PointLight('#7a5cff', 18, 14, 1.6); rimL.position.set(-3, 3, 6); garage.add(rimL);

// contact shadow + underglow (live in the car rig)
const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.9), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.006; shadowBlob.renderOrder = 2; scene.add(shadowBlob);
const glowMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.4), glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.008; glow.renderOrder = 3; scene.add(glow);
const glowL = new THREE.PointLight('#9b5cff', 6, 4, 1.4); glowL.position.set(0, 0.12, 0); scene.add(glowL);
const beams = [1, -1].map((s) => { const l = new THREE.SpotLight('#ffffff', 0, 12, 0.5, 0.7, 1.6); l.position.set(2.2, 0.62, s * 0.55); l.target.position.set(7, 0, s * 1.2); scene.add(l, l.target); return l; });
