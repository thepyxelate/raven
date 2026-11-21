/* ---- minimap image, drawn once ---- */
function drawWorldMap() {
  const N = 1024, s = N / 2000, H = Math.round(2340 * s), c = mkCanvas(N, H), g = c.getContext('2d');
  const P = (x, z) => [(x + 1000) * s, (z + 1000) * s];
  g.fillStyle = '#0d0f17'; g.fillRect(0, 0, N, H);
  g.fillStyle = '#0c2440'; g.fillRect(0, (705 + 1000) * s, N, H);
  g.fillStyle = '#3a2f2c'; g.fillRect(0, (650 + 1000) * s, N, 55 * s);
  for (const it of world.mm) if (it.k !== 'road' && it.k !== 'deck') {
    g.fillStyle = ({ park: '#123020', bld: '#262a3a', isle: '#16261a', arena: '#2a2a33', tunnel: '#1b3322' })[it.k] || '#171a24';
    const [x0, z0] = P(it.x0, it.z0); g.fillRect(x0, z0, (it.x1 - it.x0) * s, (it.z1 - it.z0) * s);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const roadsMM = world.mm.filter((it) => it.k === 'road');
  for (const pass of [0, 1]) for (const it of roadsMM) {
    if (!!it.sky !== !!pass) continue;
    const path = () => { g.beginPath(); it.pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); };
    if (it.sky) { g.strokeStyle = '#05060a'; g.lineWidth = it.w * s * 1.9; path(); g.stroke(); }
    g.strokeStyle = it.sky ? '#d46ad8' : it.type === 'highway' ? '#8e86c9' : it.type === 'avenue' ? '#7d8196' : '#5b5f72';
    g.lineWidth = it.w * s * 1.1; path(); g.stroke();
  }
  world.map = c; world.mapS = s; world.mapH = H;
}

/* ---- traffic cars: three extruded body styles, instanced ---- */
const ROAM_TRAFFIC = 36;
const TRAFFIC_TYPES = [
  { W: 1.8, wr: 0.33, wx: 1.38, low: [[-2.25, 0.3], [2.2, 0.3], [2.25, 0.55], [2.15, 0.78], [1.0, 0.9], [-2.0, 0.86], [-2.25, 0.72]], cab: [[-1.25, 0.86], [1.0, 0.9], [0.45, 1.36], [-0.75, 1.33]], roof: [-0.72, 0.43, 1.33], lx: [2.2, -2.22], ly: 0.66 },
  { W: 1.76, wr: 0.32, wx: 1.25, low: [[-1.98, 0.3], [1.95, 0.3], [2.0, 0.55], [1.9, 0.76], [0.95, 0.9], [-2.0, 0.84]], cab: [[-1.97, 0.84], [0.95, 0.9], [0.3, 1.42], [-1.86, 1.38]], roof: [-1.8, 0.28, 1.38], lx: [1.97, -1.98], ly: 0.66 },
  { W: 1.95, wr: 0.36, wx: 1.55, low: [[-2.4, 0.34], [2.35, 0.34], [2.4, 0.6], [2.35, 0.92], [1.5, 1.05], [-2.42, 1.0]], cab: [[-2.4, 1.0], [1.5, 1.05], [0.9, 1.82], [-2.3, 1.8]], roof: [-2.24, 0.88, 1.78], lx: [2.38, -2.4], ly: 0.78 }
];
let roamTrafficRig = null;
function ensureRoamTraffic() {
  if (roamTrafficRig) return roamTrafficRig;
  const ext = (pts, depth) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1, curveSegments: 1 }); g.translate(0, 0, -depth / 2); return g; };
  const mats = {
    body: new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.45, envMapIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.2, metalness: 0.5, envMapIntensity: 1.3 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(2.6) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b3a').multiplyScalar(2.2) })
  };
  const hlg = new THREE.PlaneGeometry(9, 4.6); hlg.rotateX(-Math.PI / 2); hlg.translate(7.4, 0.1, 0);
  const headGlow = new THREE.InstancedMesh(hlg, new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,236,200,0.5)', 'rgba(255,220,170,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), ROAM_TRAFFIC);
  headGlow.frustumCulled = false; headGlow.count = 0; headGlow.renderOrder = 2;
  roamTrafficRig = TRAFFIC_TYPES.map((T) => {
    const body = [ext(T.low, T.W - 0.1)], dark = [ext(T.cab, T.W - 0.24)], head = [], tail = [];
    const rf = new THREE.BoxGeometry(T.roof[1] - T.roof[0], 0.07, T.W - 0.32); rf.translate((T.roof[0] + T.roof[1]) / 2, T.roof[2] + 0.03, 0); body.push(rf);
    for (const x of [T.wx, -T.wx]) for (const z of [T.W / 2 - 0.12, -(T.W / 2 - 0.12)]) { const cy = new THREE.CylinderGeometry(T.wr, T.wr, 0.24, 12); cy.rotateX(Math.PI / 2); cy.translate(x, T.wr, z); dark.push(cy); }
    for (const z of [T.W / 2 - 0.32, -(T.W / 2 - 0.32)]) { const h = new THREE.BoxGeometry(0.06, 0.12, 0.34); h.translate(T.lx[0], T.ly, z); head.push(h); const t = new THREE.BoxGeometry(0.06, 0.13, 0.38); t.translate(T.lx[1], T.ly + 0.08, z); tail.push(t); }
    const mk = (list, mat) => { const im = new THREE.InstancedMesh(mergeGeometries(plainAttrs(list)), mat, ROAM_TRAFFIC); im.frustumCulled = false; im.count = 0; return im; };
    const out = { body: mk(body, mats.body), dark: mk(dark, mats.dark), head: mk(head, mats.head), tail: mk(tail, mats.tail) };
    for (let i = 0; i < ROAM_TRAFFIC; i++) out.body.setColorAt(i, new THREE.Color('#888888'));
    return out;
  });
  roamTrafficRig.glow = headGlow;
  return roamTrafficRig;
}
const teul = new THREE.Euler();
