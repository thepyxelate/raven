/* ================= renderer / scene ================= */
const $ = (id) => document.getElementById(id);
const canvas = document.getElementById('c'), stage = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('loading').textContent = 'This browser could not start 3D graphics (WebGL).';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
let dirty = true;
const invalidate = () => { dirty = true; };

const scene = new THREE.Scene();
scene.background = new THREE.Color('#06060b');
scene.fog = new THREE.Fog('#06060b', 14, 26);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 320);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 14;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.5;
controls.autoRotateSpeed = 0.9;
const setView = (az, el, d) => {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  camera.position.set(Math.sin(a) * Math.cos(e) * d, 0.55 + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d);
  camera.lookAt(controls.target);
};
setView(42, 9, 10.8);
