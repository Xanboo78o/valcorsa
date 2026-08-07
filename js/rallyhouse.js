// VALCORSA — Home of Racing: the ORIGINAL SOUNDTRACK.
// Rally house composed in-house for the game (synthesized album, 2026-08-07):
// classic-house DNA (m9 stabs, offbeat hats, sidechain pump, swing) at racing
// tempo. Each track scores a corner of the country.
// main.js delegates startMusic/stopMusic/setMusicFinalLap here.
(function () {
  const RACE = [
    { f: 'music/houndsborough-gp.mp3',   t: 'Houndsborough GP' },
    { f: 'music/perro-saltarin.mp3',     t: 'Perro Saltarín' },
    { f: 'music/san-volante-nights.mp3', t: 'San Volante Nights' },
    { f: 'music/heiligen-coast.mp3',     t: 'Heiligen Coast' },
    { f: 'music/granada-sprint.mp3',     t: 'Granada Sprint' },
    { f: 'music/bahia-lluvia.mp3',       t: 'Bahía Lluvia' },
  ];
  const MENU = { f: 'music/home-of-racing.mp3', t: 'Home of Racing' };

  const el = new Audio();
  el.preload = 'auto';
  let wired = false, order = [], oi = 0, mode = null, pending = null, audioRef = null;

  function shuffle() {
    order = RACE.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    oi = 0;
  }
  shuffle();

  function wire() { // route through WebAudio master so the 'm' mute key applies
    if (wired || !audioRef || !audioRef.ctx || !audioRef.master) return;
    try {
      audioRef.ctx.createMediaElementSource(el).connect(audioRef.master);
      wired = true;
    } catch (e) { wired = true; }
  }

  function play(track, vol, loop) {
    // My Music mode (Settings > Soundtrack): the radio stays silent so the
    // player's own apps (Spotify etc.) keep playing. Checked live — no reload.
    if ((localStorage.getItem('vc_msrc') || 'ost') === 'own') return;
    wire();
    el.loop = loop;
    el._baseVol = vol;
    el.volume = Math.min(1, vol * (window.MUSICVOL ?? 1));   // Settings music slider (roar.js)
    try { el.preservesPitch = false; el.mozPreservesPitch = false; } catch (e) {}
    if (!el.src.endsWith(track.f)) el.src = track.f;
    el.playbackRate = 1;
    const p = el.play();
    if (p) p.then(() => {
      if (window.toast && mode === 'race') toast('♪ ' + track.t + ' — Valcorsa OST');
      const np = document.getElementById('npTrack');
      if (np) np.textContent = track.t + ' — Valcorsa OST';
    }).catch(() => { pending = { track, vol, loop }; }); // autoplay-blocked: retry on gesture
  }

  addEventListener('pointerdown', () => {
    if (pending) { const p = pending; pending = null; play(p.track, p.vol, p.loop); }
  }, true);

  el.addEventListener('ended', () => {
    if (mode === 'race' || mode === 'town') {
      oi = (oi + 1) % order.length;
      if (oi === 0) shuffle();
      play(RACE[order[oi]], mode === 'town' ? 0.5 : 0.75, false);
    }
  });

  window.RALLYHOUSE = {
    start(def, audio) {
      audioRef = audio || audioRef;
      const id = def && def.id;
      if (id === 'menu') { mode = 'menu'; play(MENU, 0.4, true); return; }
      if (id === 'town') { mode = 'town'; play(RACE[order[oi]], 0.5, false); return; }
      mode = 'race';
      oi = (oi + 1) % order.length;      // fresh track every race
      if (oi === 0) shuffle();
      play(RACE[order[oi]], 0.75, false);
    },
    stop() { mode = null; pending = null; el.pause(); },
    finalLap(on) { el.playbackRate = on ? 1.10 : 1; }, // faster AND pitched up — kart rules
    _el: el, // debug/testing handle
  };
})();
