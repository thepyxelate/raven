/* ---- chat: Enter to type, bubbles over the car that said it ---- */
let myName = 'Driver';
try { myName = (localStorage.getItem('raven-rs-name') || cfg.sticker || 'Driver').slice(0, 16) || 'Driver'; } catch (e) { /* storage unavailable */ }
function tagFor(id) {
  const p = id === 'me' ? roam.meTag : net.players.get(id);
  if (id === 'me') {
    if (!roam.meTag) { roam.meTag = { el: null, msg: '', msgT: 0 }; }
    return ensureTagEl(roam.meTag, myName);
  }
  return ensureTagEl(p, p.name);
}
function ensureTagEl(p, name) {
  if (!p.el) {
    p.el = el('div', 'tag'); const bb = el('span', 'bb'), nm = el('span', 'nm', name);
    p.el.append(bb, nm); $('roTags').append(p.el); p.bb = bb; p.nm = nm;
  }
  return p;
}
function showChat(id, text) {
  text = String(text).replace(/\s+/g, ' ').trim().slice(0, 80); if (!text) return;
  const t = tagFor(id), name = id === 'me' ? myName : net.players.get(id).name;
  t.msg = text; t.msgT = 5 + text.length * 0.06; t.bb.textContent = text; t.el.classList.add('says');
  const line = el('p'); const b = el('b', '', name + ': '); if (id !== 'me') b.style.color = net.players.get(id).color; line.append(b, document.createTextNode(text));
  const log = $('chatLog'); log.append(line); while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => line.classList.add('old'), 14000);
}
// cheat codes typed in chat: handled locally, never sent to other players
const CHEATS = { '/nitro': () => { roam.infNos = !roam.infNos; return 'Infinite nitro ' + (roam.infNos ? 'ON' : 'OFF'); } };
function chatCheat(text) {
  const fn = CHEATS[text.trim().toLowerCase()]; if (!fn) return false;
  const line = el('p'); line.append(el('b', '', 'Mod: '), document.createTextNode(fn()));
  const log = $('chatLog'); log.append(line); while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => line.classList.add('old'), 6000);
  return true;
}
function openChat() { roam.chat = true; const i = $('chatIn'); i.hidden = false; i.value = ''; $('chat').classList.add('open'); i.focus(); for (const k in roam.keys) roam.keys[k] = false; }
function closeChat(send) {
  const i = $('chatIn');
  if (send && i.value.trim() && !chatCheat(i.value)) net.sendChat(i.value);
  roam.chat = false; i.blur(); i.hidden = true; $('chat').classList.remove('open');
}
