/* VALCORSA — ROAR: the sound + feel engine (the 25-question overhaul).
   Real recorded samples where we have them (sfx/ — Kenney CC0 impacts/UI,
   OpenGameArt racing engine loops [qubodup, public domain], tire squeal
   [looneybits, CC-BY], crowd [Gregor Quendel, CC-BY], Ford GT V8 bank
   [freesound_community via Pixabay, sliced into steady-RPM loops]);
   synthesis fills the rest.
   Owns: per-marque engine voices, exhaust drama (pops/backfires/turbo),
   surface beds + bump thumps from real terrain acceleration, wind + slipstream,
   skids, collision audio (wraps DMG.impact), damage layers, spatial bot engines
   with doppler, El Santo's Storm theme + horn taunts, grid ceremony, crowd/nature
   ambience, venue acoustics, cockpit mix, haptics, camera feel, UI sounds,
   and the Engine/Music/Effects volume sliders.
   main.js delegates: initAudio -> ROAR.init(audio); updateAudio -> ROAR.update(dt). */
'use strict';
(function () {
  const R = { ready: false };
  window.ROAR = R;

  let A = null, ctx = null;                    // main.js audio object + context
  let engBus, fxBus, ambBus, sendConv, convMix; // buses
  const S = {};                                // decoded sample buffers by name
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const now = () => ctx.currentTime;

  // ---- volume sliders (Engine / Music / Effects) + haptics toggle ----
  const VOL = {
    eng: +(localStorage.getItem('vc_vol_eng') ?? 100) / 100,
    mus: +(localStorage.getItem('vc_vol_mus') ?? 100) / 100,
    fx:  +(localStorage.getItem('vc_vol_fx')  ?? 100) / 100,
  };
  let haptics = (localStorage.getItem('vc_haptics') ?? 'on') === 'on';
  window.MUSICVOL = VOL.mus;
  function applyVolumes() {
    if (engBus) engBus.gain.value = 1.55 * VOL.eng;    // the engine OWNS the mix
    if (fxBus)  fxBus.gain.value  = VOL.fx;
    if (ambBus) ambBus.gain.value = VOL.fx;
    window.MUSICVOL = VOL.mus;
    if (A && A.musicGain) A.musicGain.gain.value = 0.34 * VOL.mus;
    if (window.RALLYHOUSE && RALLYHOUSE._el) {
      const el = RALLYHOUSE._el;
      el.volume = clamp((el._baseVol ?? 0.75) * VOL.mus, 0, 1);
    }
  }
  function wireSettings() {
    const map = { volEng: 'eng', volMus: 'mus', volFx: 'fx' };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = Math.round(VOL[key] * 100);
      el.addEventListener('input', () => {
        VOL[key] = el.value / 100;
        localStorage.setItem('vc_vol_' + key, el.value);
        applyVolumes();
      });
    }
    document.querySelectorAll('#hapticsRow button').forEach(b => {
      b.classList.toggle('sel', (b.dataset.h === 'on') === haptics);
      b.addEventListener('click', () => {
        haptics = b.dataset.h === 'on';
        localStorage.setItem('vc_haptics', haptics ? 'on' : 'off');
        document.querySelectorAll('#hapticsRow button').forEach(x =>
          x.classList.toggle('sel', (x.dataset.h === 'on') === haptics));
      });
    });
  }
  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', wireSettings) : wireSettings();

  // ---- sample loading ----
  const MANIFEST = {
    eng0: 'sfx/eng0.wav', eng1: 'sfx/eng1.wav', eng2: 'sfx/eng2.wav',
    eng3: 'sfx/eng3.wav', eng4: 'sfx/eng4.wav', eng5: 'sfx/eng5.wav',
    gtidle: 'sfx/gtidle.wav', gtlow: 'sfx/gtlow.wav', gtmid: 'sfx/gtmid.wav', gtpull: 'sfx/gtpull.wav',
    squeal: 'sfx/squeal.wav',
    crash0: 'sfx/crash0.mp3', crash1: 'sfx/crash1.mp3', crash2: 'sfx/crash2.mp3',
    thump0: 'sfx/thump0.mp3', thump1: 'sfx/thump1.mp3',
    scrape0: 'sfx/scrape0.mp3', scrape1: 'sfx/scrape1.mp3',
    click0: 'sfx/click0.mp3', click1: 'sfx/click1.mp3', click2: 'sfx/click2.mp3',
    crowd: 'sfx/crowd.mp3', cheer: 'sfx/cheer.mp3',
  };
  function loadSamples() {
    let core = 0;
    for (const [name, url] of Object.entries(MANIFEST))
      fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
        .then(buf => {
          S[name] = buf;
          if ((name.startsWith('eng') || name.startsWith('gt') || name === 'squeal') && ++core >= 4 && !R.ready) start();
        }).catch(() => {});
    setTimeout(() => { if (!R.ready && ctx) start(); }, 4000);  // never block on a bad fetch
  }

  // ---- tiny helpers ----
  function noiseBuf() {
    if (S._noise) return S._noise;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (S._noise = b);
  }
  // one-shot sample player: vol, rate, pan, optional bandpass color
  function shot(name, { vol = 0.2, rate = 1, pan = 0, dur = 0, out = fxBus, lp = 0 } = {}) {
    const buf = S[name];
    if (!buf || !ctx) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = vol;
    let head = src;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; head.connect(f); head = f; }
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    head.connect(g);
    if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(out); } else g.connect(out);
    src.start(0, 0, dur || undefined);
    src.stop(now() + (dur || buf.duration / rate) + 0.05);
  }
  // synth exhaust pop: noise burst + low thump — reads as a real backfire
  function pop(vol = 0.2, freq = 200, pan = 0) {
    if (!ctx) return;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, now());
    g.gain.exponentialRampToValueAtTime(0.001, now() + rnd(0.05, 0.11));
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, now());
    o.frequency.exponentialRampToValueAtTime(38, now() + 0.09);
    const og = ctx.createGain(); og.gain.setValueAtTime(vol * 0.8, now());
    og.gain.exponentialRampToValueAtTime(0.001, now() + 0.1);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    n.connect(bp); bp.connect(g); o.connect(og);
    const dst = p || fxBus; if (p) { p.pan.value = pan; p.connect(fxBus); }
    g.connect(dst); og.connect(dst);
    n.start(); o.start();
    n.stop(now() + 0.15); o.stop(now() + 0.15);
  }
  function bedLoop(buf, filterType, freq, q) {          // looping bed through a filter, gain 0
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 0.8;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g);
    src.start();
    return { src, f, g };
  }
  const setT = (param, v, tc) => param.setTargetAtTime(v, now(), tc);

  // ================= per-marque engine voices =================
  // "depends on the engine ya got" — each chassis is a different machine.
  // fMul shifts the whole rev range per marque; s = the bot-pool single loop.
  const VOICES = {
    muscle: { s: 'eng0', lo: 0.52, hi: 1.45, fMul: 0.90, sub: 0.55, bright: 850,  turbo: 1 },  // Houndsborough V8
    truck:  { s: 'eng1', lo: 0.46, hi: 1.30, fMul: 0.68, sub: 0.70, bright: 650,  turbo: 1 },
    gt:     { s: 'eng2', lo: 0.58, hi: 1.70, fMul: 1.00, sub: 0.45, bright: 1200, turbo: 1 },
    rally:  { s: 'eng3', lo: 0.60, hi: 1.85, fMul: 1.12, sub: 0.40, bright: 1500, turbo: 1.4 }, // big snail
    formula:{ s: 'eng5', lo: 0.72, hi: 2.35, fMul: 1.60, sub: 0.24, bright: 2600, turbo: 0 },   // the scream
    kart:   { s: 'eng4', lo: 0.82, hi: 2.10, fMul: 1.80, sub: 0.18, bright: 2100, turbo: 0 },   // 2-stroke buzz
    bike:   { s: 'eng5', lo: 0.88, hi: 2.50, fMul: 2.00, sub: 0.14, bright: 2400, turbo: 0 },
    monoposto: { s: 'eng5', lo: 0.75, hi: 2.60, fMul: 1.72, sub: 0.22, bright: 2800, turbo: 0 },   // the pinnacle scream
    endurance: { s: 'eng3', lo: 0.56, hi: 1.90, fMul: 1.05, sub: 0.50, bright: 1400, turbo: 1.6 }, // October turbo drone
    barrel:    { s: 'eng4', lo: 0.80, hi: 2.00, fMul: 1.70, sub: 0.20, bright: 1900, turbo: 0 },   // clatter in a cask
    longframe: { s: 'eng0', lo: 0.48, hi: 1.50, fMul: 0.80, sub: 0.80, bright: 800,  turbo: 1 },   // TWO of them
    sofa:      { s: 'eng1', lo: 0.44, hi: 1.20, fMul: 0.58, sub: 0.60, bright: 500,  turbo: 0 },   // upholstered putt-putt
  };
  // The GT bank: one real V8 (Adam's Ford GT reference) sliced into steady-RPM
  // loops — the sim-racer way (Assetto/iRacing: crossfade recorded loops by rpm,
  // each pitched only slightly, plus a full-load layer blended in by throttle).
  const BANK = [
    { s: 'gtidle', f0: 66.9 },     // lumpy idle
    { s: 'gtlow',  f0: 141.8 },    // light-load hold
    { s: 'gtmid',  f0: 213.0 },    // high hold (rate-stretched up to redline)
  ];
  const PULL_F0 = 123.9;           // the full-throttle roar pull
  const LEGACY = { f1: 'formula', rally: 'rally', kart: 'kart', bike: 'bike', monster: 'truck' };
  function chassisOf(car) {
    if (!car) return 'gt';
    const v = car.vehicle;
    if (v && typeof v === 'object' && v.chassis) return v.chassis;
    if (car.kit && car.kit.chassis) return car.kit.chassis;
    return LEGACY[v] || (typeof v === 'string' ? v : 'gt');
  }

  // player engine: RPM-crossfade bank + full-load pull + sub osc + saturation + lowpass
  const PE = { built: false, chassis: '' };
  function buildPlayerEngine(chassis) {
    if (PE.built) {
      try { PE.bands.forEach(b => b.src.stop()); PE.pullSrc.stop(); PE.subO.stop(); } catch (e) {}
    }
    const V = VOICES[chassis] || VOICES.gt;
    const anyBuf = () => Object.values(S).find(b => b && b.duration);
    const drive = ctx.createWaveShaper();
    const n2 = 512, curve = new Float32Array(n2);
    for (let i = 0; i < n2; i++) { const x = (i / (n2 - 1)) * 2 - 1; curve[i] = Math.tanh(2.6 * x) / Math.tanh(2.6); }
    drive.curve = curve; drive.oversample = '2x';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = V.bright; lp.Q.value = 0.9;
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 160; shelf.gain.value = 0;
    const g = ctx.createGain(); g.gain.value = 0;
    drive.connect(lp); lp.connect(shelf); shelf.connect(g);
    // Haas widener: dry copy pushed left, a ~14ms-delayed copy pushed right — the engine
    // wraps AROUND you instead of sitting in the middle ("stereo like crazy")
    if (ctx.createStereoPanner) {
      const pL = ctx.createStereoPanner(); pL.pan.value = -0.6;
      const pR = ctx.createStereoPanner(); pR.pan.value = 0.6;
      const dR = ctx.createDelay(0.05); dR.delayTime.value = 0.014;
      g.connect(pL); pL.connect(engBus);
      g.connect(dR); dR.connect(pR); pR.connect(engBus);
    } else g.connect(engBus);
    const mkLoop = (buf) => {
      const src = ctx.createBufferSource(); src.buffer = buf || anyBuf(); src.loop = true;
      const gg = ctx.createGain(); gg.gain.value = 0;
      src.connect(gg); gg.connect(drive); src.start();
      return { src, g: gg };
    };
    const bands = BANK.map(b => Object.assign({ f0: b.f0 }, mkLoop(S[b.s])));
    const pull = mkLoop(S.gtpull);
    const subO = ctx.createOscillator(); subO.type = 'sawtooth'; subO.frequency.value = 40;
    const subG = ctx.createGain(); subG.gain.value = 0;
    subO.connect(subG); subG.connect(drive);
    subO.start();
    Object.assign(PE, { built: true, chassis, V, drive, lp, shelf, g, bands,
      hasBank: !!(S.gtidle && S.gtlow && S.gtmid && S.gtpull),
      pullSrc: pull.src, pullG: pull.g, subO, subG });
  }
  let spool = 0, lastThr = 0, popT = 0, idlePh = 0, heatT = 0, tickT = 0, tickNext = 0;
  function updatePlayerEngine(dt, active, speed, thr, cockpit) {
    const ch = chassisOf(player);
    const bankUp = !!(S.gtidle && S.gtlow && S.gtmid && S.gtpull);
    if (!PE.built || PE.chassis !== ch || (bankUp && !PE.hasBank)) buildPlayerEngine(ch);  // samples can decode late
    const V = PE.V;
    let rpm = player.rpm || clamp(0.06 + speed / 130, 0.06, 1);
    if (state === 'countdown') rpm = Math.max(rpm, thr * 0.6);      // grid rev-up: blip it
    if (player.boostT > 0) rpm = 1;
    // idle lope: uneven grumble at rest
    idlePh += dt * rnd(3.6, 5.2);
    const lope = rpm < 0.14 && speed < 4 ? 1 + Math.sin(idlePh) * 0.14 + rnd(-0.02, 0.02) : 1;
    // target firing frequency: log sweep idle->redline in bank space; fMul revs the marque
    const F0 = 58 * Math.pow(6.5, rpm) * lope;      // 61 Hz idle .. 377 Hz redline
    const F = F0 * (V.fMul || 1);                   // what the ear hears
    // full-load pull: the roar comes in with your right foot, band mix ducks to make room
    const load = thr * (0.45 + rpm * 0.55) * (player.boostT > 0 ? 1.15 : 1);
    const pullTaper = F0 > 280 ? 0.45 : 1;          // top end: the stretched mid carries the scream
    setT(PE.pullSrc.playbackRate, clamp(F / PULL_F0, 0.5, 3.0), 0.03);
    setT(PE.pullG.gain, load * pullTaper * 0.95, 0.05);
    // bank crossfade: tent weights in log-frequency, equal-power shaped
    const lf = Math.log(F0), bandMix = (1 - load * 0.35) * 0.85;
    for (let i = 0; i < PE.bands.length; i++) {
      const b = PE.bands[i];
      setT(b.src.playbackRate, clamp(F / b.f0, 0.4, 2.6), 0.03);
      const me = Math.log(b.f0);
      let w;
      if (lf <= me) {
        const lo2 = i === 0 ? -1 : Math.log(PE.bands[i - 1].f0);
        w = i === 0 ? 1 : clamp((lf - lo2) / (me - lo2), 0, 1);
      } else {
        const hi2 = i === PE.bands.length - 1 ? -1 : Math.log(PE.bands[i + 1].f0);
        w = i === PE.bands.length - 1 ? 1 : 1 - clamp((lf - me) / (hi2 - me), 0, 1);
      }
      b.g.gain.value = Math.sin(w * Math.PI / 2) * bandMix;
    }
    setT(PE.subO.frequency, clamp(F * 0.5, 30, 140), 0.04);
    PE.subG.gain.value = V.sub * (0.25 + rpm * 0.5);
    setT(PE.lp.frequency, V.bright * (0.45 + rpm * 0.9 + thr * 0.35), 0.05);
    const base = active ? (0.34 + Math.min(speed / 260, 0.14)) * (0.70 + thr * 0.40) * lope : 0;
    setT(PE.g.gain, base * (cockpit ? 1.35 : 1), 0.06);
    PE.shelf.gain.value = cockpit ? 7 : 0;                          // engine in your chest
    // turbo: spool silently with sustained throttle, PSSSH on lift. (The constant
    // whistle tone is GONE — Adam: "sounds like I have tinnitus". Never add a
    // steady pure-tone oscillator to the drive mix again.)
    if (V.turbo) {
      spool = clamp(spool + (thr > 0.5 ? dt / 1.3 : -dt / 0.45) * V.turbo, 0, 1);
      if (spool > 0.45 && thr < 0.1 && lastThr >= 0.1) {            // blow-off
        const n = ctx.createBufferSource(); n.buffer = noiseBuf(); n.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
        hp.frequency.setValueAtTime(2600, now());
        hp.frequency.exponentialRampToValueAtTime(900, now() + 0.3);
        const gg = ctx.createGain(); gg.gain.setValueAtTime(0.10 * spool, now());
        gg.gain.exponentialRampToValueAtTime(0.001, now() + 0.32);
        n.connect(hp); hp.connect(gg); gg.connect(fxBus);
        n.start(); n.stop(now() + 0.35);
        spool = 0.12;
      }
    }
    // off-throttle crackle: lift at revs -> pop-pop-crackle
    if (thr < 0.1 && lastThr >= 0.6 && rpm > 0.4) popT = rnd(0.25, 0.5);
    if (popT > 0) {
      popT -= dt;
      if (Math.random() < dt * 11) pop(rnd(0.05, 0.13) * (0.4 + rpm), rnd(150, 380));
    }
    // damage misfire: the coughs get real bangs
    const d = player.dmg;
    if (d && d.engine < 0.85 && Math.random() < dt * (1 - d.engine) * 2.2) pop(0.12, 130);
    // hot-metal tick after hard running
    if (speed > 35) heatT = Math.min(8, heatT + dt);
    if (speed < 2) {
      if (heatT > 1.5 && tickT <= 0) tickT = heatT;
      if (tickT > 0) {
        tickT -= dt; tickNext -= dt;
        if (tickNext <= 0) { tickNext = rnd(0.5, 1.4); shot('click1', { vol: 0.04 * (tickT / 8), rate: 0.55, lp: 1800 }); }
      }
    } else if (speed > 12) { tickT = 0; heatT = Math.max(0, heatT - dt * 0.4); }
    lastThr = thr;
  }

  // ================= ground, wind, skids, bumps =================
  let beds = null, prevY = 0, prevVy = 0, rough = 0, bumpCd = 0, camDip = 0;
  let crashRattleT = 0, chirpArm = false, landPulse = 0;
  function buildBeds() {
    beds = {
      road:   bedLoop(noiseBuf(), 'lowpass', 240, 0.7),
      gravel: bedLoop(noiseBuf(), 'bandpass', 850, 0.8),
      grass:  bedLoop(noiseBuf(), 'lowpass', 480, 0.7),
      wind:   bedLoop(noiseBuf(), 'highpass', 1150, 0.7),
      squeal: null, wobble: null,
    };
    for (const k of ['road', 'gravel', 'grass']) beds[k].g.connect(fxBus);
    beds.wind.g.connect(fxBus);
    if (S.squeal) {
      const src = ctx.createBufferSource(); src.buffer = S.squeal; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(g);
      if (pan) { g.connect(pan); pan.connect(fxBus); } else g.connect(fxBus);
      src.start();
      beds.squeal = { src, g, pan };
    }
    // flat-tire wobble: flap noise gated by a wheel-rate LFO
    const flap = ctx.createBufferSource(); flap.buffer = noiseBuf(); flap.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 1.1;
    const gate = ctx.createGain(); gate.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 8;
    const depth = ctx.createGain(); depth.gain.value = 0;
    lfo.connect(depth); depth.connect(gate.gain);
    flap.connect(bp); bp.connect(gate); gate.connect(fxBus);
    flap.start(); lfo.start();
    beds.wobble = { gate, lfo, depth };
  }
  function updateGround(dt, active, speed, thr) {
    if (!beds) buildBeds();
    const surf = player.surf, SS = typeof SURFACES !== 'undefined' ? SURFACES : null;
    const on = player.onRoad;
    const isDirt = SS && (surf === SS.dirt || surf === SS.sand);
    const isGrass = SS && surf === SS.grass;
    const sN = clamp(speed / 110, 0, 1);
    setT(beds.road.g.gain,   active && on && !isDirt ? sN * 0.055 : 0, 0.09);
    const slideBoost = isDirt ? clamp(player.slip / 45, 0, 0.5) : 0;   // dirt slides roar gravel
    setT(beds.gravel.g.gain, active && isDirt ? sN * 0.13 + slideBoost * 0.1 : 0, 0.07);
    setT(beds.grass.g.gain,  active && (isGrass || (!on && !isDirt)) ? sN * 0.09 : 0, 0.09);
    if (active && isDirt && Math.random() < dt * speed * 0.5)          // stones on the bodywork
      shot('scrape1', { vol: rnd(0.008, 0.03), rate: rnd(1.6, 2.6), pan: rnd(-0.8, 0.8), lp: 2400 });
    // wind: minimal, engine stays king; slipstream tuck drops it
    let wind = Math.pow(speed / 128, 2) * 0.042;
    let tucked = false;
    if (typeof cars !== 'undefined') {
      const fX = Math.sin(player.heading), fZ = Math.cos(player.heading);
      for (const c of cars) {
        if (c === player || c.finished) continue;
        const dx = c.x - player.x, dz = c.z - player.z, dist = Math.hypot(dx, dz);
        if (dist < 20 && dx * fX + dz * fZ > dist * 0.9) { tucked = true; break; }
      }
    }
    setT(beds.wind.g.gain, active ? wind * (tucked ? 0.35 : 1) : 0, 0.12);
    setT(beds.wind.f.frequency, tucked ? 700 : 1150, 0.15);
    // skids: asphalt screech + grip-catch chirp
    if (beds.squeal) {
      const sk = active && on && !isDirt && player.slip > 6 ? clamp((player.slip - 6) / 32, 0, 1) * 0.15 : 0;
      setT(beds.squeal.g.gain, sk, 0.05);
      setT(beds.squeal.src.playbackRate, 0.85 + player.slip / 90, 0.08);
      if (beds.squeal.pan) {                 // the screech comes from where the rear is sliding
        let sl = Math.atan2(player.velX, player.velZ) - player.heading;
        while (sl > Math.PI) sl -= 2 * Math.PI; while (sl < -Math.PI) sl += 2 * Math.PI;
        setT(beds.squeal.pan.pan, clamp(sl * 1.6, -0.85, 0.85), 0.07);
      }
    }
    if (player.slip > 11) chirpArm = true;
    else if (chirpArm && player.slip < 4) {
      chirpArm = false;
      if (S.squeal) shot('squeal', { vol: 0.09, rate: 1.5, dur: 0.16 });
    }
    // bumps: differentiate the car's real vertical motion
    const vy = (player.y - prevY) / dt, ay = (vy - prevVy) / dt;
    prevY = player.y; prevVy = vy;
    rough += (Math.min(Math.abs(ay), 260) - rough) * Math.min(1, dt * 6);
    bumpCd -= dt;
    if (active && speed > 8 && Math.abs(ay) > 60 && bumpCd <= 0) {
      bumpCd = 0.14;
      const hard = Math.abs(ay) > 170;                               // landing off a jump
      const amt = clamp(Math.abs(ay) / 420, 0.08, hard ? 0.5 : 0.3);
      shot(Math.random() < 0.5 ? 'thump0' : 'thump1', { vol: amt, rate: hard ? rnd(0.7, 0.85) : rnd(0.9, 1.2), lp: hard ? 900 : 1600 });
      const rattle = crashRattleT > 0 ? 0.7 : 0;
      const dmg = player.dmg ? player.dmg.wear * 0.4 + (1 - player.dmg.engine) * 0.6 : 0;
      if (rattle + dmg > 0.1)
        shot('scrape0', { vol: amt * (rattle + dmg) * 0.7, rate: rnd(1.3, 1.9), lp: 2800 });
      if (hard) { camDip = Math.max(camDip, 0.45); landPulse = 1; }
    }
    crashRattleT = Math.max(0, crashRattleT - dt);
    // flat-tire wobble whir
    if (beds.wobble) {
      const flat = player.dmg && player.dmg.flat && speed > 4;
      beds.wobble.lfo.frequency.value = clamp(speed / 3.4, 4, 26);
      beds.wobble.gate.gain.value = flat ? 0.05 : 0;
      beds.wobble.depth.gain.value = flat ? 0.05 : 0;
    }
  }

  // ================= spatial bot engines (4 nearest, real doppler) =================
  const POOL = [];
  let poolT = 0;
  function mkVoice() {
    const src = ctx.createBufferSource();
    src.buffer = S.eng2 || Object.values(S).find(b => b && b.duration);
    src.loop = true; src.playbackRate.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse';
    pan.refDistance = 20; pan.maxDistance = 400; pan.rolloffFactor = 0.9;
    src.connect(g); g.connect(pan); pan.connect(fxBus);
    src.start();
    return { src, g, pan, car: null, buf: '' };
  }
  function aPos(n, x, y, z) { if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z; } else if (n.setPosition) n.setPosition(x, y, z); }
  function updateBots(dt, active) {
    if (typeof cars === 'undefined' || !cars) return;
    while (POOL.length < 4) POOL.push(mkVoice());
    poolT -= dt;
    if (poolT <= 0) {                                   // re-pick nearest every 0.4s (sticky)
      poolT = 0.4;
      const near = cars.filter(c => !c.isPlayer && !c.traffic)
        .map(c => ({ c, d: Math.hypot(c.x - player.x, c.z - player.z) }))
        .filter(o => o.d < 140).sort((a, b) => a.d - b.d).slice(0, 4).map(o => o.c);
      for (const v of POOL) if (v.car && !near.includes(v.car)) v.car = null;
      for (const c of near) if (!POOL.some(v => v.car === c)) {
        const free = POOL.find(v => !v.car); if (free) free.car = c;
      }
    }
    for (const v of POOL) {
      if (!v.car || !active) { setT(v.g.gain, 0, 0.15); continue; }
      const c = v.car, V = VOICES[chassisOf(c)] || VOICES.gt;
      const santoV8 = c.name === 'El Santo' && S.gtpull;   // the champ gets the real roar
      const want = santoV8 ? 'gtpull' : V.s;
      if (v.buf !== want && S[want]) { try { v.src.buffer !== S[want] && (v.src.buffer = S[want]); v.buf = want; } catch (e) {} }
      const spd = Math.hypot(c.velX, c.velZ);
      const rpm = c.rpm || clamp(0.06 + spd / 130, 0.06, 1);
      const dx = c.x - camera.position.x, dz = c.z - camera.position.z, dist = Math.hypot(dx, dz) || 1;
      const vrel = ((c.velX - player.velX) * dx + (c.velZ - player.velZ) * dz) / dist;
      const dopp = clamp(200 / (200 + vrel), 0.55, 1.85);
      const santo = c.name === 'El Santo';
      setT(v.src.playbackRate, (V.lo + rpm * (V.hi - V.lo)) * dopp * (santo ? 1.18 : 1), 0.06);
      setT(v.g.gain, (0.22 + spd / 260) * (santo ? 1.9 : 1), 0.12);
      aPos(v.pan, c.x, c.y + 1, c.z);
    }
  }

  // ================= collisions (wrap the damage system) =================
  let hapticHold = 0;
  function hookImpacts() {
    if (!window.DMG || DMG._roared) return;
    const orig = DMG.impact;
    DMG.impact = (car, v) => {
      orig(car, v);
      try { onImpact(car, v); } catch (e) {}
    };
    const origShake = DMG.shakeCamera;
    DMG.shakeCamera = (cam) => { origShake(cam); try { shakeExtra(cam); } catch (e) {} };
    DMG._roared = true;
  }
  function onImpact(car, v) {
    if (!ctx || !R.ready) return;
    const dash = v * 3.6 * (typeof SPEED_DISPLAY_SCALE !== 'undefined' ? SPEED_DISPLAY_SCALE : 0.45);
    const mine = car.isPlayer;
    const dist = mine ? 0 : Math.hypot(car.x - player.x, car.z - player.z);
    if (!mine && dist > 70) return;
    const fade = mine ? 1 : clamp(1 - dist / 80, 0.1, 0.8);
    const fX = Math.sin(player.heading), fZ = Math.cos(player.heading);
    const panv = mine ? 0 : clamp(((car.x - player.x) * fZ - (car.z - player.z) * fX) / 22, -1, 1);
    if (dash < 25) shot(Math.random() < 0.5 ? 'thump0' : 'thump1', { vol: 0.14 * fade, rate: rnd(0.95, 1.15), pan: panv });
    else if (dash < 90) shot(Math.random() < 0.5 ? 'scrape0' : 'scrape1', { vol: 0.22 * fade, rate: rnd(0.85, 1.1), pan: panv });
    else {
      shot('crash' + Math.floor(Math.random() * 3), { vol: 0.42 * fade, rate: rnd(0.8, 1.0), pan: panv });
      shot('thump0', { vol: 0.3 * fade, rate: 0.6, lp: 500, pan: panv });
      if (mine) { crashRattleT = 4; hapticHold = 0.7; }
    }
  }

  // ================= camera feel + haptics =================
  let lastDt = 1 / 60;
  function shakeExtra(cam) {                            // terrain jitter + landing dip
    const off = player && !player.onRoad;
    const amp = clamp(rough / 1500, 0, 0.1) + (off ? clamp(Math.hypot(player.velX, player.velZ) / 800, 0, 0.09) : 0);
    if (amp > 0.004) {
      cam.position.x += (Math.random() - 0.5) * amp * 2;
      cam.position.y += (Math.random() - 0.5) * amp * 1.5;
      cam.position.z += (Math.random() - 0.5) * amp * 2;
    }
    if (camDip > 0.01) { cam.position.y -= camDip * 0.4; camDip *= Math.pow(0.002, lastDt); }
  }
  let vibNext = 0;
  function updateHaptics(dt, active, speed, thr) {
    hapticHold = Math.max(0, hapticHold - dt);
    if (!haptics || !navigator.vibrate) return;
    if (!matchMedia('(pointer: coarse)').matches) return;
    if (hapticHold > 0) return;                          // DMG owns the crash buzz
    const d = player.dmg;
    if (d && (d.flat || d.shattered)) return;            // DMG owns those pulses too
    vibNext -= dt;
    if (vibNext > 0) return;
    vibNext = 0.13;
    if (landPulse) { landPulse = 0; navigator.vibrate(70); return; }
    if (!active) return;
    const rpm = player.rpm || clamp(speed / 130, 0, 1);
    let ms = 0;
    if (speed < 4) ms = 2 + Math.max(0, Math.sin(idlePh)) * 3;             // idle lope
    else if (!player.onRoad || (player.surf && typeof SURFACES !== 'undefined' && (player.surf === SURFACES.dirt || player.surf === SURFACES.sand)))
      ms = 16 + Math.min(22, speed / 4);                                    // off-road: SUPER strong
    else ms = 2.5 + rpm * 4 + thr * 4 + clamp(rough / 90, 0, 6);
    if (ms >= 2) navigator.vibrate(Math.round(ms));
  }

  // ================= ambience, ceremony, moments =================
  let amb = null, prevState = '', cheerCd = 0, finaleArmed = true;
  function buildAmb() {
    amb = {};
    if (S.crowd && !(typeof track !== 'undefined' && track && track.def && track.def.silent)) {   // Hiljaisuus: no crowd at all
      const src = ctx.createBufferSource(); src.buffer = S.crowd; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse';
      pan.refDistance = 55; pan.maxDistance = 900; pan.rolloffFactor = 1;
      src.connect(g); g.connect(pan); pan.connect(ambBus);
      src.start();
      amb.crowd = { src, g, pan };
    }
    const nat = bedLoop(noiseBuf(), 'lowpass', 300, 0.6);
    nat.g.connect(ambBus);
    amb.nature = nat;
  }
  function updateAmbience(dt, active, speed) {
    if (!amb) buildAmb();
    const inRace = state === 'race' || state === 'countdown';
    if (amb.crowd && typeof track !== 'undefined' && track && track.samples) {
      const s0 = track.samples[0];
      aPos(amb.crowd.pan, s0.x, (s0.y || 0) + 2, s0.z);
      let g = inRace && mode === 'race' ? 0.18 : 0;                  // there if you listen
      if (state === 'countdown') g *= 2.2;                           // builds to the start
      // photo finish: last lap, close rival, near the line -> the crowd loses it
      if (state === 'race' && player.lap >= (track.def.laps || 3) - 1) {
        const toLine = (track.N - player.idx) * (track.ds || 1.5);
        let close = false;
        for (const c of cars) {
          if (c.isPlayer || c.finished) continue;
          if (Math.abs((c.lap * track.N + c.distAcc) - (player.lap * track.N + player.distAcc)) < 9) { close = true; break; }
        }
        if (toLine < 220 && close) {
          g *= 3.4;
          if (finaleArmed) { finaleArmed = false; shot('cheer', { vol: 0.22, out: ambBus }); }
        }
      }
      setT(amb.crowd.g.gain, g, 0.4);
    }
    const env = typeof track !== 'undefined' && track && track.def ? track.def.env : '';
    const natOn = active && speed < 16 && ['countryside', 'forest', 'meadow'].includes(env);
    setT(amb.nature.g.gain, natOn ? 0.015 : 0, 0.8);
  }
  let cheered = false;
  function stateMoments() {
    // live results: the player finishes while state stays 'race' — cheer at the line
    if (state === 'race' && player && player.finished && !cheered) {
      cheered = true;
      const pos = (typeof cars !== 'undefined' ? cars.filter(c => c !== player && c.finished && c.finishTime < player.finishTime).length : 0) + 1;
      if (pos <= 3) shot('cheer', { vol: 0.3, out: ambBus });
      else shot('crowd', { vol: 0.12, dur: 3, out: ambBus });
    }
    if (state === 'menu' || state === 'countdown') cheered = false;
    if (state === prevState) return;
    const from = prevState; prevState = state;
    if (state === 'countdown') {                        // engines fire up, one by one
      finaleArmed = true;
      for (let i = 0; i < 6; i++) {
        const t = i * rnd(0.12, 0.24);
        setTimeout(() => {
          if (!ctx) return;
          const names = ['eng0', 'eng1', 'eng2', 'eng3', 'eng4', 'eng5', 'gtpull', 'gtlow'];
          const b = S[names[Math.floor(rnd(0, names.length - 0.01))]]; if (!b) return;
          const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
          src.playbackRate.setValueAtTime(0.42, now());
          src.playbackRate.exponentialRampToValueAtTime(rnd(0.7, 0.95), now() + 0.5);
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now());
          g.gain.exponentialRampToValueAtTime(rnd(0.04, 0.08), now() + 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, now() + rnd(1.1, 1.7));
          const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
          src.connect(g);
          if (p) { p.pan.value = rnd(-0.8, 0.8); g.connect(p); p.connect(fxBus); } else g.connect(fxBus);
          src.start(); src.stop(now() + 2);
        }, t * 1000);
      }
    }
    if (from === 'race' && (state === 'results' || state === 'finished') && !cheered) {
      cheered = true;                                    // (normally already fired at the line)
      let pos = 1;
      try {
        const order = [...cars].sort((a, b) => (b.lap * track.N + b.distAcc) - (a.lap * track.N + a.distAcc));
        pos = order.indexOf(player) + 1;
      } catch (e) {}
      if (pos <= 3) shot('cheer', { vol: 0.3, out: ambBus });
      else shot('crowd', { vol: 0.12, dur: 3, out: ambBus });
    }
  }

  // ================= venue acoustics =================
  let convEnv = '';
  function updateAcoustics() {
    const env = typeof track !== 'undefined' && track && track.def ? track.def.env : '';
    if (env === convEnv || !sendConv) return;
    convEnv = env;
    const spec = env === 'desert' ? { sec: 1.7, dec: 3.0, mix: 0.13 }     // canyon slapback
      : env === 'city' ? { sec: 0.5, dec: 2.2, mix: 0.10 }                // street echo
        : null;                                                           // open country: dry
    if (!spec) { convMix.gain.value = 0; return; }
    const len = Math.floor(ctx.sampleRate * spec.sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let chn = 0; chn < 2; chn++) {
      const d = b.getChannelData(chn);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, spec.dec);
    }
    sendConv.buffer = b;
    convMix.gain.value = spec.mix;
  }

  // ================= El Santo: the Storm theme =================
  // Dark, minimal, electronic. It idles in the distance and CLOSES IN — the pulse
  // swells and quickens as he nears; the last lap adds a dissonant high wire.
  const ST = { on: false, car: null, nodes: null, step: 0, nextT: 0, hornCd: 0, wasAhead: null };
  window.startVerstappenTheme = function (car) {
    if (!ctx || !car) { ST.car = car; ST.on = !!car; return; }
    stopStorm();
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse';
    pan.refDistance = 30; pan.maxDistance = 2600; pan.rolloffFactor = 1;
    pan.connect(A.master);
    const subO = ctx.createOscillator(); subO.type = 'sine';
    const subG = ctx.createGain(); subG.gain.value = 0.0001;
    const bass = ctx.createOscillator(); bass.type = 'sawtooth';
    const bLP = ctx.createBiquadFilter(); bLP.type = 'lowpass'; bLP.frequency.value = 240; bLP.Q.value = 6;
    const bG = ctx.createGain(); bG.gain.value = 0.0001;
    const stab = ctx.createOscillator(); stab.type = 'triangle';
    const sG = ctx.createGain(); sG.gain.value = 0.0001;
    const wire = ctx.createOscillator(); wire.type = 'sawtooth';
    const wire2 = ctx.createOscillator(); wire2.type = 'sawtooth'; wire2.detune.value = 14;
    const wG = ctx.createGain(); wG.gain.value = 0.0001;
    const wHP = ctx.createBiquadFilter(); wHP.type = 'highpass'; wHP.frequency.value = 1800;
    subO.connect(subG); subG.connect(pan);
    bass.connect(bLP); bLP.connect(bG); bG.connect(pan);
    stab.connect(sG); sG.connect(pan);
    wire.connect(wHP); wire2.connect(wHP); wHP.connect(wG); wG.connect(pan);
    [subO, bass, stab, wire, wire2].forEach(o => o.start());
    ST.on = true; ST.car = car; ST.step = 0; ST.nextT = now() + 0.05;
    ST.nodes = { pan, subO, subG, bass, bLP, bG, stab, sG, wire, wire2, wG };
  };
  function stopStorm() {
    if (!ST.nodes) return;
    try { [ST.nodes.subO, ST.nodes.bass, ST.nodes.stab, ST.nodes.wire, ST.nodes.wire2].forEach(o => { try { o.stop(); } catch (e) {} }); } catch (e) {}
    ST.nodes = null; ST.on = false; ST.car = null;
  }
  window.stopVerstappenTheme = stopStorm;
  window.updateVerstappenTheme = function () { /* ROAR drives the storm from update() */ };
  function updateStorm() {
    if (!ST.on || !ST.nodes || !ST.car || !player) return;
    const n = ST.nodes, c = ST.car;
    aPos(n.pan, c.x, c.y + 1.2, c.z);
    const dx = c.x - camera.position.x, dz = c.z - camera.position.z, dist = Math.hypot(dx, dz) || 1;
    const vrel = ((c.velX - player.velX) * dx + (c.velZ - player.velZ) * dz) / dist;
    const dopp = clamp(200 / (200 + vrel), 0.55, 1.8);
    const nearF = clamp(1 - dist / 300, 0, 1);                     // 0 far .. 1 breathing on you
    const lastLap = state === 'race' && track && track.def && player.lap >= (track.def.laps || 3) - 1;
    const spb = 60 / (46 + nearF * 22);                            // the pulse quickens as he closes
    if (ST.nextT < now() - 0.5) ST.nextT = now();
    while (ST.nextT < now() + 0.1) {
      const t = ST.nextT, s = ST.step;
      const root = (s % 4 === 2) ? 46.25 : 41.2;                   // E1 with a tritone lean — menace
      n.subO.frequency.setValueAtTime(root * dopp, t);
      n.bass.frequency.setValueAtTime(root * 2 * dopp, t);
      n.subG.gain.cancelScheduledValues(t);
      n.subG.gain.setValueAtTime(0.30 * (0.35 + nearF * 0.65), t);
      n.subG.gain.exponentialRampToValueAtTime(0.02, t + spb * 0.92);
      n.bG.gain.cancelScheduledValues(t);
      n.bG.gain.setValueAtTime(0.10 * (0.25 + nearF * 0.75), t);
      n.bG.gain.exponentialRampToValueAtTime(0.008, t + spb * 0.6);
      if (s % 8 === 6) {                                           // sparse icy stab, minor second
        n.stab.frequency.setValueAtTime((s % 16 === 14 ? 622.25 : 659.25) * dopp, t);
        n.sG.gain.cancelScheduledValues(t);
        n.sG.gain.setValueAtTime(0.05 + nearF * 0.06, t);
        n.sG.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.4);
      }
      ST.step++; ST.nextT += spb;
    }
    n.wire.frequency.value = 1244.5 * dopp;                        // last-lap high wire
    n.wire2.frequency.value = 1318.5 * dopp;
    setT(n.wG.gain, lastLap ? 0.015 + nearF * 0.03 : 0.0001, 0.5);
    // horn taunt: he just took the spot off you
    ST.hornCd -= lastDt;
    try {
      const mine = player.lap * track.N + player.distAcc, his = c.lap * track.N + c.distAcc;
      const ahead = his > mine;
      if (ST.wasAhead === false && ahead && ST.hornCd <= 0 && dist < 120) {
        ST.hornCd = 7;
        for (const f of [466, 622]) {
          const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.4; bp.Q.value = 1.6;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.09, now());
          g.gain.setValueAtTime(0.09, now() + 0.28);
          g.gain.exponentialRampToValueAtTime(0.001, now() + 0.5);
          o.connect(bp); bp.connect(g); g.connect(n.pan);
          o.start(); o.stop(now() + 0.55);
        }
      }
      ST.wasAhead = ahead;
    } catch (e) {}
  }

  // ================= UI sounds =================
  function hookUI() {
    document.addEventListener('click', e => {
      if (!ctx || !R.ready) return;
      const b = e.target.closest && e.target.closest('button, .navBtn');
      if (!b) return;
      shot('click' + Math.floor(Math.random() * 3), { vol: 0.10, rate: rnd(0.92, 1.08) });
      if (b.closest('#trackGrid')) {                    // race-card reveal sting
        [523.25, 659.25, 784].forEach((f, i) => setTimeout(() => {
          if (!ctx) return;
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.06, now());
          g.gain.exponentialRampToValueAtTime(0.001, now() + 0.22);
          o.connect(g); g.connect(fxBus); o.start(); o.stop(now() + 0.25);
        }, i * 70));
      }
    }, true);
  }

  // ================= boot =================
  function start() {
    R.ready = true;
    applyVolumes();
    if (ST.on && ST.car && !ST.nodes) window.startVerstappenTheme(ST.car);  // arrived before ctx
  }
  R.init = function (audio) {
    if (ctx || !audio || !audio.ctx) return;
    A = audio; ctx = audio.ctx;
    engBus = ctx.createGain(); fxBus = ctx.createGain(); ambBus = ctx.createGain();
    sendConv = ctx.createConvolver(); convMix = ctx.createGain(); convMix.gain.value = 0;
    // a compressor keeps the hot engine mix loud-but-clean instead of clipping;
    // makeup gain after it = phone-speaker LOUD ("let me really feel im there")
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 16; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    const makeup = ctx.createGain(); makeup.gain.value = 1.4;
    comp.connect(makeup); makeup.connect(A.master);
    engBus.connect(comp); fxBus.connect(comp); ambBus.connect(comp);
    engBus.connect(sendConv); fxBus.connect(sendConv);
    sendConv.connect(convMix); convMix.connect(comp);
    // first-open ramp: never blast ears on load
    if (!(typeof muted !== 'undefined' && muted) && A.master.gain.value > 0) {
      const target = A.master.gain.value;
      A.master.gain.setValueAtTime(0.0001, now());
      A.master.gain.exponentialRampToValueAtTime(target, now() + 1.2);
    }
    hookImpacts(); hookUI();
    loadSamples();
    R._engBus = engBus; R._PE = PE;                  // debug taps (headless verification)
  };
  R.update = function (dt) {
    if (!ctx || !player) return;
    lastDt = dt;
    hookImpacts();                                       // in case DMG loaded late
    const active = state === 'race' || state === 'tt' || state === 'countdown' || state === 'freeroam';
    const speed = Math.hypot(player.velX, player.velZ);
    const thr = Math.max(keys['w'] ? 1 : 0, typeof throttlePedal !== 'undefined' ? throttlePedal : 0,
      window.TOUCH ? TOUCH.thr : 0);
    const cockpit = typeof camMode !== 'undefined' && camMode === 1;
    // listener follows the camera (bot panners + crowd + storm all hang off this)
    if (ctx.listener) {
      const L = ctx.listener;
      if (L.positionX) { L.positionX.value = camera.position.x; L.positionY.value = camera.position.y; L.positionZ.value = camera.position.z; }
      else if (L.setPosition) L.setPosition(camera.position.x, camera.position.y, camera.position.z);
      try {
        const fwd = camera.getWorldDirection(_v3);
        if (L.forwardX) { L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
        else if (L.setOrientation) L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
      } catch (e) {}
    }
    updatePlayerEngine(dt, active, speed, thr, cockpit);
    updateGround(dt, active, speed, thr);
    updateBots(dt, active);
    updateAmbience(dt, active, speed);
    updateAcoustics();
    updateStorm();
    stateMoments();
    updateHaptics(dt, active, speed, thr);
    // world muffle in cockpit: fx duck a touch so the engine owns your chest
    setT(fxBus.gain, VOL.fx * (cockpit ? 0.8 : 1), 0.2);
    // legacy synth engine stays silent while ROAR runs
    if (A.engGain) A.engGain.gain.value = 0;
    if (A.inGain) A.inGain.gain.value = 0;
    if (A.nGain) A.nGain.gain.value = 0;
  };
})();
