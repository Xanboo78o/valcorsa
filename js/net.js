// VALCORSA LIVE — the spine of Domain Expansion. Rooms are Supabase Realtime
// channels; a room is a race your friends are actually in. The host owns the
// COM locals and the clock; everyone streams their kart at NET.HZ with
// dead-reckoning on the receiving end. Campaign race days, duels, and the
// nightly open all ride this one layer.
'use strict';

window.NET = (() => {
  const HZ = 12;                      // outbound position rate
  const $ = id => document.getElementById(id);
  let sb = null, chan = null, room = null;
  let isHost = false, myId = null, sendT = 0;
  const peers = new Map();            // id -> { name, kit, car, buf:[snap,snap], lastSeen }
  let phase = 'idle';                 // idle | lobby | racing
  let onLobby = null;                 // UI callback

  function client() {
    if (sb) return sb;
    if (!window.supabase || !window.APEX_CONFIG) return null;
    sb = window.supabase.createClient(APEX_CONFIG.supabaseUrl, APEX_CONFIG.supabaseKey, {
      realtime: { params: { eventsPerSecond: 40 } },
    });
    return sb;
  }
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || {});
  const myName = () => acct().name || 'RACER';
  const CODE_ABC = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const makeCode = () => Array.from({ length: 4 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');

  // ---------------------------------------------------------------- join/leave
  function join(code, cb) {
    const c = client();
    if (!c) { toast('no connection — LIVE needs the internet'); return false; }
    leave();
    room = code.toUpperCase();
    myId = (acct().code || '') + '-' + myName();
    onLobby = cb || null;
    chan = c.channel('race:' + room, { config: { presence: { key: myId }, broadcast: { self: false } } });
    chan.on('presence', { event: 'sync' }, syncPresence);
    chan.on('broadcast', { event: 'pos' }, ({ payload }) => onPos(payload));
    chan.on('broadcast', { event: 'start' }, ({ payload }) => onStart(payload));
    chan.on('broadcast', { event: 'finish' }, ({ payload }) => onFinish(payload));
    chan.on('broadcast', { event: 'results' }, ({ payload }) => onResults(payload));
    chan.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        chan.track({ name: myName(), kit: currentKit(), joined: myJoined });
        if (phase === 'idle') phase = 'lobby';
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && room) {
        // throttled tabs drop the heartbeat — quietly rejoin the same room, same seat
        const r = room, cb = onLobby;
        setTimeout(() => { if (room === r && chan && chan.state !== 'joined') rejoin(r, cb); }, 2000);
      }
    });
    if (!sendBackup) sendBackup = setInterval(() => sendNow(), 500);   // survives rAF throttling
    return true;
  }
  let myJoined = Date.now(), sendBackup = null;
  function rejoin(code, cb) {
    const keep = new Map(peers);                        // keep the puppets across the reconnect
    const keepPhase = phase;
    try { chan.unsubscribe(); } catch (e) {}
    chan = null;
    join(code, cb);
    if (keepPhase === 'racing') { phase = 'racing'; for (const [id, p] of keep) peers.set(id, p); }
  }
  function leave() {
    if (sendBackup) { clearInterval(sendBackup); sendBackup = null; }
    if (chan) { try { chan.unsubscribe(); } catch (e) {} }
    for (const p of peers.values()) if (p.car) despawnPeer(p);
    peers.clear();
    chan = null; room = null; phase = 'idle'; isHost = false;
  }

  function currentKit() {
    try { return { paint: KIT.paint, chassis: KIT.chassis, wheels: KIT.wheels }; }
    catch (e) { return { paint: 0, chassis: 'gt', wheels: 0 }; }
  }

  function roster() {
    if (!chan) return [];
    const st = chan.presenceState();
    return Object.entries(st).map(([id, metas]) => ({ id, ...metas[0] }))
      .sort((a, b) => a.joined - b.joined);
  }
  function syncPresence() {
    const list = roster();
    if (list.some(r => r.id === myId))
      isHost = list[0].id === myId;                     // oldest joiner hosts
    if (phase !== 'racing') {
      // lobby: presence is truth — drop peers who left
      for (const [id, p] of peers) if (!list.some(r => r.id === id)) { if (p.car) despawnPeer(p); peers.delete(id); }
    }
    // mid-race the grid is LOCKED: a phone going background must not delete a kart —
    // the puppet just freezes until their positions flow again
    for (const r of list) if (r.id !== myId && !peers.has(r.id))
      peers.set(r.id, { name: r.name, kit: r.kit, car: null, buf: [], lastSeen: performance.now() });
    // host mid-race: replay the start ticket so late joiners enter (behind the safety cars)
    if (isHost && phase === 'racing' && startMsg && chan)
      chan.send({ type: 'broadcast', event: 'start', payload: { ...startMsg, replay: true } });
    if (onLobby) onLobby({ room, list, isHost, phase });
  }

  // ---------------------------------------------------------------- race start
  let startMsg = null;                // the live race's start ticket — replayed for late joiners
  function hostStart(def, mode) {
    if (!isHost || !chan) return;
    const msg = { track: def.id, mode: mode || 'race', at: Date.now() + 4000, seats: roster().map(r => r.id) };
    startMsg = msg;
    chan.send({ type: 'broadcast', event: 'start', payload: msg });
    onStart(msg);   // self:false — run it locally too
  }
  function onStart(msg) {
    if (phase === 'racing' && msg.replay) return;       // already in — the replay isn't for us
    const def = TRACKS.find(t => t.id === msg.track);
    if (!def) return;
    phase = 'racing';
    startMsg = msg;
    finishes.length = 0;
    if (window.closeLive) closeLive();
    const sl = $('schedLobby');                         // the stuck "waiting on the grid" fix:
    if (sl) sl.style.display = 'none';                  // the lobby ALWAYS clears when a race starts
    startGame(def, msg.mode);
    // joined after lights out? no waiting screen — you enter behind the safety cars
    if (msg.replay && window.SAFETY) SAFETY.enter();
    // players take the front grid slots: repaint AI cars into live puppets
    const seats = msg.seats.filter(id => id !== myId);
    let ai = cars.filter(c => !c.isPlayer);
    // host keeps simming the leftover locals; guests freeze them (host's feed drives them)
    for (let i = 0; i < seats.length && i < ai.length; i++) claimPuppet(peers.get(seats[i]), ai[i]);
    if (!isHost) for (const c of cars) if (!c.isPlayer && !c.netPuppet) { c.netGhostCom = true; }
  }
  function claimPuppet(peer, car) {
    if (!peer || !car) return;
    car.netPuppet = true;
    car.name = peer.name;
    if (car.tagSpr) { car.mesh.remove(car.tagSpr); car.tagSpr = null; }
    if (window.attachNameTag) attachNameTag(car);   // the plate over their head is THEIR name
    peer.car = car; peer.buf = [];
  }
  function despawnPeer(p) { if (p.car) { p.car.netPuppet = false; p.car = null; } }

  // ---------------------------------------------------------------- position stream
  let lastSend = 0;
  function sendNow() {
    if (phase !== 'racing' || !chan || typeof player === 'undefined' || !player) return;
    const now = performance.now();
    if (now - lastSend < 1000 / HZ - 5) return;
    lastSend = now;
    const p = player;
    chan.send({ type: 'broadcast', event: 'pos', payload: {
      id: myId, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +(p.y || 0).toFixed(2),
      h: +p.heading.toFixed(3), vx: +p.velX.toFixed(2), vz: +p.velZ.toFixed(2), lap: p.lap } });
    // the host also feeds the COM locals to everyone
    if (isHost) {
      const bots = cars.filter(c => !c.isPlayer && !c.netPuppet).slice(0, 8).map(c => ({
        n: c.name, x: +c.x.toFixed(2), z: +c.z.toFixed(2), h: +c.heading.toFixed(3),
        vx: +c.velX.toFixed(2), vz: +c.velZ.toFixed(2), lap: c.lap }));
      chan.send({ type: 'broadcast', event: 'pos', payload: { id: '__bots', bots } });
    }
  }
  function netTick(dt) {
    if (phase !== 'racing' || !chan) return;
    sendNow();
    // interpolate the puppets: short buffer + dead reckoning
    const now = performance.now();
    for (const p of peers.values()) {
      if (!p.car || !p.buf.length) continue;
      const s = p.buf[p.buf.length - 1], age = (now - s.rt) / 1000;
      const c = p.car;
      const tx = s.x + s.vx * age, tz = s.z + s.vz * age;   // reckon forward
      const k = Math.min(1, 10 * (1 / 60));                  // firm pull, no snapping
      c.x += (tx - c.x) * k; c.z += (tz - c.z) * k;
      let dh = s.h - c.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      c.heading += dh * k;
      c.velX = s.vx; c.velZ = s.vz; c.lap = s.lap;
    }
  }
  function onPos(payload) {
    if (payload.id === '__bots') { if (!isHost) applyBots(payload.bots); return; }
    const p = peers.get(payload.id);
    if (!p) return;
    payload.rt = performance.now();
    p.buf.push(payload);
    if (p.buf.length > 3) p.buf.shift();
    p.lastSeen = payload.rt;
  }
  function applyBots(bots) {
    for (const b of bots) {
      const c = cars.find(x => !x.isPlayer && !x.netPuppet && x.name === b.n);
      if (!c) continue;
      const k = 0.3;
      c.x += (b.x - c.x) * k; c.z += (b.z - c.z) * k;
      c.heading = b.h; c.velX = b.vx; c.velZ = b.vz; c.lap = b.lap;
    }
  }

  // ---------------------------------------------------------------- finishes
  const finishes = [];
  function reportFinish(time, laps) {
    if (phase !== 'racing' || !chan) return;
    chan.send({ type: 'broadcast', event: 'finish', payload: { id: myId, name: myName(), time, laps } });
    onFinish({ id: myId, name: myName(), time, laps });
  }
  function onFinish(f) {
    if (!finishes.some(x => x.id === f.id)) finishes.push(f);
    if (isHost && finishes.length >= roster().length) {
      const results = [...finishes].sort((a, b) => a.time - b.time);
      chan.send({ type: 'broadcast', event: 'results', payload: { results } });
      onResults({ results });
    }
  }
  function onResults(payload) {
    phase = 'lobby';   // league scoring happens in endRace (full-field position, incl. the locals)
  }

  return { join, leave, makeCode, hostStart, netTick, reportFinish, roster,
    get isHost() { return isHost; }, get phase() { return phase; }, get room() { return room; },
    get peerCount() { return peers.size; }, _peers: peers };
})();

// ---------------------------------------------------------------- LIVE lobby UI
(function () {
  const $ = id => document.getElementById(id);
  function renderLobby(info) {
    const lob = $('liveLobby'), join = $('liveJoinRow');
    if (!lob) return;
    join.style.display = 'none';
    lob.style.display = '';
    $('liveCodeBig').textContent = info.room;
    $('liveRoster').innerHTML = info.list.map((r, i) =>
      `<span class="liveChip${r.id === info.list[0].id ? ' host' : ''}">${r.name}${i === 0 ? ' ★' : ''}</span>`).join('');
    $('liveHostRow').style.display = info.isHost ? '' : 'none';
    $('liveWait').style.display = info.isHost ? 'none' : '';
  }
  window.openLive = () => {
    const m = $('liveModal');
    m.style.display = 'flex';
    $('liveLobby').style.display = 'none';
    $('liveJoinRow').style.display = '';
    const sel = $('liveTrack');
    if (sel && !sel.options.length)
      for (const t of TRACKS) sel.add(new Option(t.name + ' · ' + t.mode, t.id));
  };
  window.closeLive = () => { $('liveModal').style.display = 'none'; };
  window.leaveLive = () => { NET.leave(); closeLive(); };
  addEventListener('DOMContentLoaded', wire);
  function wire() {
    if (!$('liveCreate')) return;
    $('liveCreate').onclick = () => NET.join(NET.makeCode(), renderLobby);
    $('liveJoinGo').onclick = () => {
      const code = ($('liveCodeIn').value || '').trim();
      if (code.length >= 4) NET.join(code, renderLobby);
    };
    $('liveGo').onclick = () => {
      const def = TRACKS.find(t => t.id === $('liveTrack').value);
      if (def) NET.hostStart(def, 'race');
    };
  }
  wire();   // boot injects after DOMContentLoaded — never hang on that event
})();
