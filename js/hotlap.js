/* VALCORSA — HOT LAP: the microwave-minute mode.
   One flying lap on the track-of-the-day, rolling start, vs your own ghost.
   Self-contained: injects its own menu button + styles, reuses TT mode by
   polling shared globals (player/track/state/raceTime) — no main.js edits. */
'use strict';
(function () {
  const H = { active: false, phase: 'idle', rec: [], gdata: null, gmesh: null, gcur: 0, raf: 0 };
  window.HOTLAP = H;

  const DAY = () => new Date().toISOString().slice(0, 10);
  function dayHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h * 31 + s.charCodeAt(i), 0x9e3779b1) | 0; return Math.abs(h); }
  H.todaysTrack = function () {
    const pool = TRACKS.filter(t => t.id !== 'heiligenstage' && !t.stage);
    return pool[dayHash(DAY()) % pool.length];
  };
  const bestKey = () => 'vc_hot_best_' + H.todaysTrack().id;
  const ghostKey = () => 'vc_hot_ghost_' + H.todaysTrack().id;
  const dayKey = 'vc_hot_day';

  function fmtHL(ms) { return typeof fmtTime === 'function' ? fmtTime(ms) : (ms / 1000).toFixed(3) + 's'; }
  function todaysBest() {
    try { const d = JSON.parse(localStorage.getItem(dayKey)); return d && d.day === DAY() ? d.ms : null; } catch (e) { return null; }
  }
  function allTimeBest() {
    try { const d = JSON.parse(localStorage.getItem(bestKey())); return d ? d.ms : null; } catch (e) { return null; }
  }

  // ---- ghost kart: your all-time best line, driving translucent ----
  function buildGhost() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(ghostKey())); } catch (e) {}
    if (!data || !data.length) return;
    H.gdata = data; H.gcur = 0;
    const m = buildCarMesh(0xf4ecdd, 0xc9c2ad, player.vehicle);
    m.traverse(o => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) { mat.transparent = true; mat.opacity = 0.32; mat.depthWrite = false; }
      }
    });
    scene.add(m);
    H.gmesh = m;
  }
  function ghostAt(t) {
    const g = H.gdata;
    if (!g || !H.gmesh) return;
    while (H.gcur < g.length - 2 && g[H.gcur + 1][0] < t) H.gcur++;
    const a = g[H.gcur], b = g[Math.min(H.gcur + 1, g.length - 1)];
    const span = Math.max(0.001, b[0] - a[0]);
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    H.gmesh.position.x = a[1] + (b[1] - a[1]) * f;
    H.gmesh.position.z = a[2] + (b[2] - a[2]) * f;
    let dh = b[3] - a[3];
    while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    H.gmesh.rotation.y = a[3] + dh * f;
    // sit on the road
    try { H.gmesh.position.y = (typeof fieldAt === 'function' ? fieldAt(H.gmesh.position.x, H.gmesh.position.z) : player.y) + 0.02; }
    catch (e) { H.gmesh.position.y = player.y; }
  }
  function dropGhost() {
    if (H.gmesh) { try { scene.remove(H.gmesh); } catch (e) {} H.gmesh = null; }
    H.gdata = null; H.gcur = 0;
  }

  // ---- the run ----
  H.start = function () {
    const def = H.todaysTrack();
    startGame(def, 'tt');
    // rolling start: drop the player ~short of the line, already moving
    placeCarAt(player, track.N - 55, 0);
    player.distAcc = track.N - 55;      // lap counting is distAcc-based: start 55 samples shy of the line
    const sp = 34;
    player.velX = Math.sin(player.heading) * sp;
    player.velZ = Math.cos(player.heading) * sp;
    H.active = true; H.phase = 'rolling'; H.rec = [];
    buildGhost();
    const lbl = document.getElementById('trackLabel');
    if (lbl) lbl.textContent = '🔥 HOT LAP · ' + def.name;
    cancelAnimationFrame(H.raf);
    loop();
  };

  let frame = 0;
  function loop() {
    H.raf = requestAnimationFrame(loop);
    if (!H.active) return;
    if (state === 'menu' || state === 'results') { cleanup(); return; }
    if (state !== 'tt') return;
    if (H.phase === 'rolling' && player.lap >= 0) {          // crossed the line: flying lap begins
      H.phase = 'flying'; H.rec = []; H.gcur = 0; frame = 0;
    }
    if (H.phase === 'flying') {
      const t = raceTime * 1000 - player.lapStart;           // ms into the flying lap
      if ((frame++ & 3) === 0 && H.rec.length < 3000)        // ~15Hz at 60fps
        H.rec.push([t, +player.x.toFixed(2), +player.z.toFixed(2), +player.heading.toFixed(3)]);
      ghostAt(t);
      if (player.lap >= 1 && player.lastLap) finish(player.lastLap);
    }
  }

  function finish(ms) {
    H.phase = 'done'; H.active = false;
    cancelAnimationFrame(H.raf);
    const prevDay = todaysBest(), prevAll = allTimeBest();
    const newDay = prevDay == null || ms < prevDay;
    const newAll = prevAll == null || ms < prevAll;
    if (newDay) localStorage.setItem(dayKey, JSON.stringify({ day: DAY(), ms, id: H.todaysTrack().id }));
    if (newAll) {
      localStorage.setItem(bestKey(), JSON.stringify({ ms, day: DAY() }));
      H.rec.push([ms, +player.x.toFixed(2), +player.z.toFixed(2), +player.heading.toFixed(3)]);
      try { localStorage.setItem(ghostKey(), JSON.stringify(H.rec)); } catch (e) {}
    }
    dropGhost();
    state = 'results';
    try { stopMusic(); } catch (e) {}
    const box = document.getElementById('results');
    box.innerHTML = `<div class="resInner">
      <h2>🔥 Hot Lap</h2>
      <p class="hlTrack">${H.todaysTrack().name}</p>
      <p class="hlTime">${fmtHL(ms)}</p>
      ${newAll ? '<p class="hlStar">★ NEW ALL-TIME BEST — new ghost saved</p>'
        : `<p class="hlSub">today ${fmtHL(todaysBest())} · all-time ${fmtHL(allTimeBest())}</p>`}
      <button onclick="HOTLAP.start()">🔁 Run It Again</button>
      <button onclick="backToMenu()">Back to Menu</button>
    </div>`;
    box.style.display = 'flex';
  }

  function cleanup() {
    H.active = false; H.phase = 'idle';
    cancelAnimationFrame(H.raf);
    dropGhost();
  }

  // ---- menu button + styles (injected: zero index.html edits) ----
  const css = document.createElement('style');
  css.textContent = `
    #hotlapBtn b { color: #c99a2e; }
    .hlTrack { font-size: 15px; opacity: .8; margin: 2px 0 0; }
    .hlTime { font-size: 44px; font-weight: 900; font-variant-numeric: tabular-nums; margin: 4px 0; }
    .hlStar { color: #ffd23e; font-weight: 700; margin: 2px 0 10px; }
    .hlSub { opacity: .75; font-size: 14px; margin: 2px 0 10px; font-variant-numeric: tabular-nums; }`;
  document.head.appendChild(css);
  function inject() {
    const row = document.getElementById('diffRow');
    if (!row || document.getElementById('hotlapBtn')) return;
    const b = document.createElement('button');
    b.className = 'navBtn'; b.id = 'hotlapBtn';
    const best = allTimeBest();
    b.innerHTML = '⏱️ HOT LAP <b>' + (best ? fmtHL(best) : 'today: ' + H.todaysTrack().name.split('·')[0].trim()) + '</b>';
    b.onclick = () => H.start();
    row.insertBefore(b, row.firstChild);
  }
  inject();
})();
