/* ---- other players: a lite, single-mesh-per-material car with an underglow ---- */
function makeLiteRig(look, color) {
  const c = clean({ ...DEFAULTS, ...look, lightsOn: true });
  if (GLB_CARS[c.model]) {
    const cc = glbCar(c.model);
    if (cc) { const rig = makeGlbRig(cc); rig.traverse((o) => { o.castShadow = false; o.receiveShadow = false; }); return rig; }
    loadGlbCar(c.model);
  }
  const { car, wheels } = buildCar(c);
  wheels.forEach((w) => car.add(w));
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  car.traverse((o) => { if (o.isMesh && (o.material === CM.paint || o.material === CM.plain)) o.material = paint; });
  const rig = new THREE.Group(); rig.add(mergeByMaterial(car)); rig.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3), new THREE.MeshBasicMaterial({ map: radialTex(), color: new THREE.Color(color).multiplyScalar(0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  gl.rotation.x = -Math.PI / 2; gl.position.y = 0.07; gl.renderOrder = 3; rig.add(gl);
  return rig;
}

/* ---- multiplayer ----
   Everything about other drivers goes through `net`. Bots publish snapshots as if they came over the network, and
   real drivers arrive the same way through a transport: an object with enter(info), exit(), send(state), chat(text)
   that calls net.join / net.state / net.leave / net.chatIn. Your own car is always simulated locally and never waits
   for the network; other cars are drawn 150 ms in the past, interpolated between snapshots (see roamFrame).
   Built in: a same-browser transport (two tabs see each other). The Firebase transport lives in src/net/. */
const net = {
  players: new Map(),            // id -> { id, name, color, look, buf: [{ t, x, z, h, v }], rig, tag, msg, msgT, remote }
  transport: null, sendT: 0, last: null, inRoom: false,
  ingest(id, snap) { const p = this.players.get(id); if (!p) return; p.buf.push(snap); if (p.buf.length > 24) p.buf.shift(); },
  myInfo() { const look = { ...cfg }; delete look.custom; return { name: myName, color: cfg.color, look }; },
  setTransport(t) { mp.pick = mp.inv = mp.out = null; /* offers were addressed to the old transport's id */ if (this.transport && this.inRoom) this.transport.exit(); for (const p of [...this.players.values()]) if (p.remote) this.leave(p.id); this.transport = t; if (t && this.inRoom) t.enter(this.myInfo()); },
  enter() { if (this.inRoom) return; this.inRoom = true; this.last = null; if (this.transport) this.transport.enter(this.myInfo()); },
  exit() { this.inRoom = false; if (this.transport) this.transport.exit(); for (const p of [...this.players.values()]) if (p.remote) this.leave(p.id); },
  // about 10 snapshots a second while moving, one a second while parked
  publishState(st) {
    if (!this.transport || !this.inRoom) return;
    const now = performance.now(), L = this.last, moved = !L || Math.hypot(st.x - L.x, st.z - L.z) > 0.05 || Math.abs(st.h - L.h) > 0.01;
    if (now - this.sendT < (moved ? 100 : 1000)) return;
    this.sendT = now; this.last = { x: st.x, z: st.z, h: st.h };
    this.transport.send([+st.x.toFixed(2), +st.z.toFixed(2), +(st.y || 0).toFixed(2), +st.h.toFixed(3), +st.v.toFixed(1)]);
  },
  sendChat(text) { showChat('me', text); if (this.transport && this.inRoom) this.transport.chat(String(text).slice(0, 120)); botsHear(text); },
  join(id, info) {
    if (!info || this.players.has(id)) return;
    const p = { id, name: String(info.name || 'Driver').slice(0, 16), color: /^#[0-9a-f]{6}$/i.test(info.color) ? info.color : '#e7e8ee', look: clean({ ...DEFAULTS, ...(info.look || {}), custom: false }), buf: [], rig: null, tag: null, msg: '', msgT: 0, remote: true };
    this.players.set(id, p);
    if (roam.active && world.built) { p.rig = makeLiteRig(p.look, p.color); p.rig.visible = false; world.group.add(p.rig); tagFor(id); say(p.name + ' joined the city.'); }
  },
  leave(id) { const p = this.players.get(id); if (!p || !p.remote) return; if (p.rig && p.rig.parent) p.rig.parent.remove(p.rig); if (p.el) p.el.remove(); this.players.delete(id); },
  state(id, a) { if (!Array.isArray(a) || a.length < 5 || !a.every(Number.isFinite)) return; this.ingest(id, { t: performance.now() / 1000, x: a[0], z: a[1], y: a[2], h: a[3], v: a[4] }); },
  chatIn(id, text) {
    if (typeof text === 'string' && text.startsWith(MP_TAG)) { mpIn(id, text.slice(MP_TAG.length)); return; }
    if (this.players.has(id) && roam.active) showChat(id, String(text).slice(0, 120));
  }
};
// same-browser transport: other tabs of this page on this computer (also the fallback when no server is configured)
function localTransport() {
  if (typeof BroadcastChannel === 'undefined') return null;
  const id = 'p' + Math.random().toString(36).slice(2, 10), ch = new BroadcastChannel('raven-rs-city'), seen = new Map();
  let info = null, timer = 0;
  ch.onmessage = (e) => {
    const m = e.data; if (!m || m.id === id || !info) return;
    if (m.k === 'who') { ch.postMessage({ k: 'hi', id, info }); return; }
    if (m.k === 'bye') { seen.delete(m.id); net.leave(m.id); return; }
    seen.set(m.id, performance.now());
    if (m.k === 'hi') net.join(m.id, m.info); else if (m.k === 'st') { if (!net.players.has(m.id)) ch.postMessage({ k: 'who', id }); else net.state(m.id, m.s); } else if (m.k === 'chat') net.chatIn(m.id, m.t);
  };
  window.addEventListener('pagehide', () => { if (info) ch.postMessage({ k: 'bye', id }); });
  return {
    id,
    enter(i) { info = i; ch.postMessage({ k: 'hi', id, info }); ch.postMessage({ k: 'who', id }); clearInterval(timer); timer = setInterval(() => { const now = performance.now(); for (const [k, t] of seen) if (now - t > 6000) { seen.delete(k); net.leave(k); } }, 2000); },
    exit() { if (info) ch.postMessage({ k: 'bye', id }); info = null; clearInterval(timer); seen.clear(); },
    send(s) { if (info) ch.postMessage({ k: 'st', id, s }); },
    chat(t) { if (info) ch.postMessage({ k: 'chat', id, t }); }
  };
}
