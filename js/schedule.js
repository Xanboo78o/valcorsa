// VALCORSA — the racing calendar. Valcorsa schedules the races (really us, but yk).
// The schedule is DETERMINISTIC MATH from the date: every phone computes the same
// card, no backend. Joining a scheduled race = joining its auto-derived NET room —
// whoever shows up is the grid. Manual codes remain for Challenge races only.
'use strict';

window.SCHED = (() => {
  const $ = id => document.getElementById(id);
  const h = s => { let x = 9; for (const c of s) x = (x * 33 + c.charCodeAt(0)) >>> 0; return x; };
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

  // race slots, local time — the daily card. Modes rotate by date-hash so the
  // reveal is a group-chat moment (canon: daily mode not known in advance… yet).
  const SLOTS = [
    { hh: 16, mm: 0,  label: 'AFTERNOON GP' },
    { hh: 19, mm: 0,  label: 'EVENING RACE' },
    { hh: 20, mm: 30, label: 'THE OPEN', open: true },   // the nightly 20-kart pile-in
  ];

  function todays(d = new Date()) {
    // rendezvous hashing: every track scores against the (day, slot) and the top
    // score wins. Adding new venues no longer reshuffles the whole calendar —
    // an existing pick only changes if the NEW track itself outscores it.
    const key = dayKey(d), pool = TRACKS.filter(t => !t.stage);
    const picked = [];
    return SLOTS.map((s, i) => {
      const def = pool
        .filter(t => !picked.includes(t.id))         // no venue twice in one day
        .map(t => ({ t, sc: h(key + ':' + i + ':' + t.id) }))
        .sort((a, b) => b.sc - a.sc)[0].t;
      picked.push(def.id);
      const at = new Date(d); at.setHours(s.hh, s.mm, 0, 0);
      return { slot: i, label: s.label, open: !!s.open, def, at,
               room: 'VD' + (h(key + ':' + i + ':' + def.id) % 10000).toString().padStart(4, '0') };
    });
  }

  function nextRace() {
    const now = Date.now();
    for (const r of todays()) if (r.at.getTime() + 3 * 60000 > now) return r;   // joinable up to T+3min
    const t = new Date(); t.setDate(t.getDate() + 1);
    return { ...todays(t)[0], tomorrow: true };
  }

  const fmt = at => at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function fmtIn(ms) {
    if (ms <= 0) return 'GRID IS OPEN';
    const m = Math.floor(ms / 60000), s2 = Math.floor(ms % 60000 / 1000);
    return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm ' + String(s2).padStart(2, '0') + 's';
  }

  // ---------------------------------------------------------------- the home card
  let cardT = null, entered = null;
  function renderCard() {
    const el = $('schedCard');
    if (!el) return;
    const r = nextRace();
    const dt = r.at.getTime() - Date.now();
    el.innerHTML = `
      <span class="schedTag">${r.tomorrow ? 'TOMORROW IN VALCORSA' : 'TODAY IN VALCORSA'}</span>
      <b class="schedName">${r.label}${r.open ? ' · 20 KARTS' : ''}</b>
      <span class="schedTrack">${r.def.name} · ${r.def.mode}</span>
      <span class="schedWhen ${dt <= 0 ? 'now' : ''}">${fmt(r.at)} — ${fmtIn(dt)}</span>
      ${!r.tomorrow && dt < 15 * 60000 ? `<button id="schedGo">${dt <= 0 ? 'GET ON THE GRID' : 'WAIT ON THE GRID'}</button>` : ''}`;
    const go = $('schedGo');
    if (go) go.onclick = () => enterScheduled(r);
  }
  function enterScheduled(r) {
    entered = r;
    NET.join(r.room, info => {
      renderLobbyLite(info, r);
      // the host fires the start ON TIME — nobody presses anything
      if (info.isHost && NET.phase === 'lobby') armAutoStart(r);
    });
    openSchedLobby(r);
  }
  let armT = null;
  function armAutoStart(r) {
    clearTimeout(armT);
    const dt = r.at.getTime() - Date.now();
    armT = setTimeout(() => {
      if (NET.isHost && NET.phase === 'lobby' && entered === r) NET.hostStart(r.def, 'race');
    }, Math.max(1500, dt));
  }
  function openSchedLobby(r) {
    const m = $('schedLobby');
    m.style.display = 'flex';
    $('schedLobbyName').textContent = r.label + ' — ' + r.def.name;
    tickLobby(r);
  }
  function tickLobby(r) {
    const w = $('schedLobbyWhen');
    if (!w || $('schedLobby').style.display === 'none') return;
    if (window.NET && NET.phase === 'racing') { $('schedLobby').style.display = 'none'; return; }   // never stick over a live race
    const dt = r.at.getTime() - Date.now();
    w.textContent = dt <= 0 ? 'lights out any second…' : 'lights out in ' + fmtIn(dt);
    setTimeout(() => tickLobby(r), 500);
  }
  function renderLobbyLite(info, r) {
    const el = $('schedLobbyRoster');
    if (el) el.innerHTML = info.list.map(x => `<span class="liveChip">${x.name}</span>`).join('') +
      (info.list.length < 2 ? '<span class="liveChip com">+ the locals</span>' : '');
  }
  window.leaveSched = () => { $('schedLobby').style.display = 'none'; entered = null; clearTimeout(armT); NET.leave(); };

  function boot() {
    if (!$('schedCard')) return;
    renderCard();
    cardT = setInterval(renderCard, 1000);
  }
  boot();

  return { todays, nextRace, enter: enterScheduled };
})();
