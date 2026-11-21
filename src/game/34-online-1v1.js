/* ---- online 1v1: challenge another real driver (E), drag strip or street race ----
   Messages ride the room chat as MP_TAG + JSON, addressed with `to` (each transport exposes its own id), so no new
   database paths are needed. inv -> acc | dec | busy, then stg/go (drag tree), fin (finish time), quit. */
const MP_TAG = '\u0007mp', MP_LABEL = { drag: 'drag race', street: 'street race' };
const mp = { pick: null, inv: null, out: null, race: null };
const myNetId = () => (net.transport && net.transport.id) || '';
function mpSend(to, msg) { if (net.transport && net.inRoom) net.transport.chat(MP_TAG + JSON.stringify({ ...msg, to })); }
function mpInvite(m) {
  const p = net.players.get(mp.pick); mp.pick = null; if (!p) return;
  const n = Math.random().toString(36).slice(2, 7), data = {};
  if (m === 'street') {
    const sn = snapToRoad(roam.x, roam.z, roam.h); if (!sn) { showPop('Get on a road first', 'info'); return; }
    const from = endNodeOf({ e: sn.e, dir: sn.dir });
    const far = world.nodes.filter((q) => { const d = Math.hypot(q.x - roam.x, q.z - roam.z); return d > 700 && d < 1300 && q.z < 1000; });
    const to = far[Math.floor(Math.random() * far.length)]; if (!to || !routeBetween(from, to)) { showPop('No route from here, try another street', 'info'); return; }
    Object.assign(data, { e: world.edges.indexOf(sn.e), d: sn.dir, f: world.nodes.indexOf(to) });
  }
  mp.out = { to: p.id, name: p.name, m, n, data, until: roamT + 20 };
  mpSend(p.id, { k: 'inv', m, n, ...data });
}
function mpAccept() {
  const inv = mp.inv; mp.inv = null;
  if (!net.players.get(inv.from)) return;
  mpSend(inv.from, { k: 'acc', n: inv.n });
  mpBegin(inv.from, inv.m, inv.n, inv.data, 'guest');
}
function mpDecline(quiet) { const inv = mp.inv; mp.inv = null; if (inv) mpSend(inv.from, { k: 'dec', n: inv.n }); if (!quiet) showPop('Challenge declined', 'info'); }
function mpBegin(id, m, n, data, role) {
  const p = net.players.get(id); if (!p) return;
  mp.race = { id, m, n, role };
  if (m === 'street') {
    const e = world.edges[data.e], to = world.nodes[data.f]; if (!e || !to) return;
    const rest = routeBetween(endNodeOf({ e, dir: data.d }), to); if (!rest) return;
    startRaceEvent({ id: '1v1', type: 'sprint', name: '1v1 vs ' + p.name, color: p.color }, [{ e, dir: data.d }, ...rest], [], role === 'host' ? 0 : 1);
    ev.mp = { id, n, name: p.name, cp: 0, done: false };
    return;
  }
  // drag: leave the city but stay in the room, race on the strip, come back here afterwards
  const back = { x: roam.x, z: roam.z, h: roam.h };
  exitRoam(true);
  race.mpOpp = { id, n, role, name: p.name, color: p.color, look: p.look, x: 0, staged: false, meStaged: false, go: false, done: false, time: null };
  const keepMode = raceMode, keepTraffic = traffic;
  raceMode = 'mp'; traffic = false;
  startRace();
  raceMode = keepMode; traffic = keepTraffic;
  race.fromRoam = back;
}
function mpTryGo() {
  const o = race.mpOpp; if (!o || o.role !== 'host' || o.go || !o.meStaged || !o.staged) return;
  o.go = true; const d = 0.7 + Math.random() * 0.9;
  mpSend(o.id, { k: 'go', n: o.n, d });
  race.stageT = race.t; race.treeDelay = d; callout('STAGED · LAUNCH WITH E ON GREEN', 'ok', 0);
}
function mpIn(from, json) {
  let m; try { m = JSON.parse(json); } catch (e) { return; }
  if (!m || m.to !== myNetId()) return;
  const p = net.players.get(from), name = p ? p.name : 'Driver';
  if (m.k === 'inv') {
    if (!roam.active || race.active || ev.active || mp.inv || mp.out || !MP_LABEL[m.m]) { mpSend(from, { k: 'busy', n: m.n }); return; }
    mp.inv = { from, name, m: m.m, n: m.n, data: { e: m.e, d: m.d, f: m.f }, until: roamT + 20 };
    showPop(name + ' wants a ' + MP_LABEL[m.m] + '!', 'info');
    return;
  }
  if (m.k === 'acc' && mp.out && mp.out.n === m.n && mp.out.to === from) { const o = mp.out; mp.out = null; mpBegin(from, o.m, o.n, o.data, 'host'); return; }
  if ((m.k === 'dec' || m.k === 'busy') && mp.out && mp.out.n === m.n) { showPop(name + (m.k === 'busy' ? ' is busy' : ' declined'), 'info'); mp.out = null; return; }
  if (m.k === 'inv' || !mp.race || mp.race.n !== m.n) { if (mp.inv && mp.inv.n === m.n && m.k === 'quit') mp.inv = null; return; }
  // messages for the race in progress
  const o = race.mpOpp && race.mpOpp.n === m.n ? race.mpOpp : null;
  if (o) {
    if (m.k === 'stg') { o.staged = true; mpTryGo(); }
    else if (m.k === 'go' && o.role === 'guest' && !o.go && race.phase === 'stage') { o.go = true; race.stageT = race.t; race.treeDelay = +m.d || 1; callout('STAGED · LAUNCH WITH E ON GREEN', 'ok', 0); }
    else if (m.k === 'fin') {
      o.done = true; o.time = +m.t >= 0 ? +m.t : null;
      if (race.phase === 'result') { // result already on screen (we jumped the light or crashed): fill in the rival's line
        for (const dt of $('result').querySelectorAll('dt')) if (dt.textContent === o.name + ' race time') dt.nextSibling.textContent = o.time != null ? o.time.toFixed(3) + ' s' : 'Did not finish';
      }
    }
    else if (m.k === 'quit') { o.done = true; o.left = true; o.time = null; if (!race.endT) callout(name.toUpperCase() + ' LEFT THE RACE', 'bad', 1500); }
    return;
  }
  const em = ev.mp && ev.mp.n === m.n ? ev.mp : null;
  if (em) {
    if (m.k === 'fin' && !em.done) {
      em.done = true; em.finT = +m.t; ev.finished.push({ name: em.name, t: +m.t });
      if (ev.phase === 'done' && ev.lastResult) { const [t, sub, rows] = ev.lastResult; rows.push([em.name, fmtT(+m.t)]); showResult(t, sub, rows); }
      else showPop(em.name + ' finished!', 'info');
    } else if (m.k === 'quit' && !em.done) { em.done = true; em.left = true; showPop(em.name + ' left the race', 'info'); }
  }
}
