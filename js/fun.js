// VALCORSA — THE DEPARTMENT OF FUN. Role minigames (Adam's spec):
//   RACER    → LIGHTS OUT: F1 start-light reaction, jump starts punished
//   RADIO    → THE CALL: pit-wall strategy under BULLET TIME
//   ENGINEER → TORQUE TO SPEC: lock the needle in the green, don't strip it
//   MANAGER  → nothing. Their life is stressful enough.
'use strict';

(function () {
  const $ = id => document.getElementById(id);
  const best = (k, v, lower) => {   // save personal bests (lower=true for times)
    const cur = localStorage.getItem(k);
    if (cur == null || (lower ? v < +cur : v > +cur)) { localStorage.setItem(k, v); return true; }
    return false;
  };

  // ---- the cards on the FUN page ----
  function inject() {
    const fun = $('funMenu');
    if (!fun || $('funGames')) return;
    const note = fun.querySelector('.funNote');
    if (note) note.textContent = 'The VCRA Department of Fun is OPEN. Train your hat.';
    const grid = document.createElement('div');
    grid.id = 'funGames';
    grid.innerHTML = `
      <div class="fgCard" data-g="lights"><b>LIGHTS OUT</b><span>RACER TRAINING</span>
        <p>Five reds. They go out — you GO. Jump it and you're flagged.</p><em id="fgBestL"></em></div>
      <div class="fgCard" data-g="call"><b>THE CALL</b><span>RADIO & PIT TRAINING</span>
        <p>The pit wall in BULLET TIME. Right call, right now.</p><em id="fgBestC"></em></div>
      <div class="fgCard" data-g="torque"><b>TORQUE TO SPEC</b><span>ENGINEER TRAINING</span>
        <p>Lock the needle in the green. Strip a bolt, lose the gasket.</p><em id="fgBestT"></em></div>
      <div class="fgCard mgr" data-g="mgr"><b>MANAGER'S MINIGAME</b><span>MANAGER</span>
        <p>There isn't one. Your life is stressful enough.</p><em>press only if it's been a day</em></div>`;
    const shelf = fun.querySelector('.setNote');
    fun.insertBefore(grid, shelf || null);
    grid.querySelectorAll('.fgCard').forEach(c => c.onclick = () => open(c.dataset.g));
    paintBests();
  }
  function paintBests() {
    const L = localStorage.getItem('vc_fun_lights'), C = localStorage.getItem('vc_fun_calls'), T = localStorage.getItem('vc_fun_torque');
    if ($('fgBestL')) $('fgBestL').textContent = L ? 'best avg: ' + L + 'ms' : 'no time set';
    if ($('fgBestC')) $('fgBestC').textContent = C ? 'best: ' + C + ' pts' : 'no calls made';
    if ($('fgBestT')) $('fgBestT').textContent = T ? 'best: ' + T + ' bolts' : 'no bolts torqued';
  }

  // ---- the overlay ----
  let ov = null, cleanup = null;
  function open(g) {
    close();
    ov = document.createElement('div');
    ov.id = 'funGame';
    ov.innerHTML = '<button id="fgClose">✕</button><div id="fgStage"></div>';
    document.body.appendChild(ov);
    $('fgClose').onclick = close;
    ({ lights, call, torque, mgr })[g]($('fgStage'));
  }
  function close() {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    if (ov) { ov.remove(); ov = null; }
    paintBests();
  }

  // ================= LIGHTS OUT (racer reaction) =================
  function lights(st) {
    st.innerHTML = `<h3>LIGHTS OUT</h3>
      <div id="loPods">${'<i></i>'.repeat(5)}</div>
      <p id="loMsg">Tap anywhere when the lights go OUT. Five rounds.</p>
      <div id="loTimes"></div>
      <button id="loGo">TO THE GRID</button>`;
    const pods = [...st.querySelectorAll('#loPods i')];
    const msg = $('loMsg'), timesEl = $('loTimes');
    let round = 0, times = [], t0 = 0, phase = 'idle', timers = [];
    const clearT = () => { timers.forEach(clearTimeout); timers = []; };
    cleanup = clearT;
    function arm() {
      phase = 'arming'; t0 = 0;
      pods.forEach(p => p.className = '');
      msg.textContent = 'Round ' + (round + 1) + ' of 5 — eyes up.';
      pods.forEach((p, i) => timers.push(setTimeout(() => p.className = 'on', 500 + i * 650)));
      timers.push(setTimeout(() => {
        phase = 'hold';
        timers.push(setTimeout(() => {
          pods.forEach(p => p.className = '');
          t0 = performance.now();
          phase = 'go';
        }, 400 + Math.random() * 1300));
      }, 500 + 5 * 650));
    }
    function tap() {
      if (phase === 'go') {
        const ms = Math.round(performance.now() - t0);
        times.push(ms);
        timesEl.innerHTML = times.map(t => `<b class="${t < 220 ? 'hot' : ''}">${t}ms</b>`).join('');
        round++;
        if (round >= 5) {
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          const isBest = best('vc_fun_lights', avg, true);
          msg.innerHTML = `Average: <b>${avg}ms</b>. ${isBest ? 'PERSONAL BEST — the grid noticed.' : avg < 230 ? 'Racer reflexes.' : 'Sunday driver. Again.'}`;
          phase = 'idle'; round = 0; times = [];
          $('loGo').style.display = '';
        } else arm();
      } else if (phase === 'arming' || phase === 'hold') {
        clearT();
        pods.forEach(p => p.className = 'jump');
        msg.textContent = 'JUMP START — that\'s a flag. Round doesn\'t count.';
        phase = 'idle';
        timers.push(setTimeout(arm, 1200));
      }
    }
    ov.addEventListener('pointerdown', e => { if (e.target.id !== 'fgClose' && e.target.id !== 'loGo') tap(); });
    $('loGo').onclick = () => { $('loGo').style.display = 'none'; round = 0; times = []; timesEl.innerHTML = ''; arm(); };
  }

  // ================= THE CALL v2 (Adam's spec: the radio operator's VIEW) =================
  // A live race map — your driver BIG, the pitlane, the field. A situation breaks,
  // time slows TO A STOP (bullet time), you make the call, time snaps back and the
  // AFTERMATH plays out on the map. Points = correctness + how fast you called it.
  const SCEN = [
    { q: 'Rain flag is UP. Your driver’s slicks are cooked. SHOULD YOU PIT?',
      c: ['BOX BOX BOX', 'STAY OUT', 'ONE MORE LAP'], a: 0, why: 'Wets on BEFORE the rain. Two rivals just found the wall.',
      good: (S, me) => { S.at(0.2, () => S.pit(me)); S.at(2.2, () => S.crash(S.k[2])); S.at(2.9, () => S.crash(S.k[4])); },
      bad:  (S, me) => { S.at(1.4, () => S.crash(me)); } },
    { q: 'YOUR DRIVER CRASHES — rolled off at the corner, kart’s on its side. "The wheels still spin," he says.',
      c: ['FLIP IT AND SEND', 'CALL THE TOW', 'END THE RACE'], a: 0, why: 'It’s Valcorsa. If the wheels spin, you race.',
      pre:  (S, me) => S.crash(me),
      good: (S, me) => { S.at(0.4, () => S.revive(me, 1.08)); },
      bad:  (S, me) => { /* the tow: he sits there while the country laps him */ } },
    { q: 'Fuel for 2 laps. THREE laps to the flag. The rival crew has the same problem.',
      c: ['LIFT AND COAST', 'FULL SEND', 'BOX FOR A SPLASH'], a: 0, why: 'Save it. He blinked first — and then he stopped.',
      good: (S, me) => { S.slow(me, 0.88); S.slow(S.k[1], 0.86); S.at(2.4, () => S.stop(S.k[1])); },
      bad:  (S, me) => { S.slow(S.k[1], 0.88); S.at(2.2, () => S.stop(me)); } },
    { q: 'EL SANTO is 0.8s behind your driver. Two laps left. The theme music is audible.',
      c: ['LET HIM BY — TAKE THE TOW', 'DEFEND EVERY CORNER', 'PANIC'], a: 0, why: 'Nobody out-defends El Santo. His slipstream is free speed.',
      santo: true,
      good: (S, me) => { S.boost(S.santo, 1.3); S.at(0.8, () => S.boost(me, 1.18)); },
      bad:  (S, me) => { S.boost(S.santo, 1.32); S.at(1.2, () => S.slow(me, 0.86)); } },
    { q: 'UNDERCUT WINDOW: the leader hasn’t boxed yet. Pit now and you jump him on the exit.',
      c: ['BOX NOW', 'STAY OUT', 'MIRROR HIM'], a: 0, why: 'The undercut is a knife. You just used it.',
      good: (S, me) => { S.at(0.2, () => S.pit(me)); S.at(2.6, () => { S.pit(S.k[1]); S.slow(S.k[1], 0.9); }); },
      bad:  (S, me) => { S.at(1.2, () => { S.pit(S.k[1]); S.boost(S.k[1], 1.12); }); } },
    { q: 'Contact! Bumper’s hanging off your kart, grinding sparks every corner.',
      c: ['PIT — TEAR IT OFF', 'PUSH THROUGH', 'SHAKE IT LOOSE'], a: 0, why: 'Eight seconds in the lane beats forty on the track.',
      good: (S, me) => { S.at(0.2, () => S.pit(me, 0.6)); },
      bad:  (S, me) => { S.slow(me, 0.93); S.at(1.6, () => S.slow(me, 0.82)); } },
    { q: 'Your teammate is FLYING, right behind your driver. The crew needs the constructors sweep.',
      c: ['LET HIM THROUGH', 'HOLD POSITION', 'TELL THEM TO RACE'], a: 0, why: 'The swap cost nothing. Both karts gained. The wall remembers.',
      mate: true,
      good: (S, me) => { S.boost(S.mate, 1.22); S.at(1.0, () => { S.boost(me, 1.1); }); },
      bad:  (S, me) => { S.slow(S.mate, 0.97); S.at(1.5, () => S.boost(S.k[3], 1.25)); } },
  ];
  function call(st) {
    st.innerHTML = `<h3>THE CALL</h3><p class="fgSub">The pit wall, live. When it breaks, time stops for YOU. Make the call, watch the aftermath.</p>
      <canvas id="clMap" width="560" height="270"></canvas>
      <div id="clHud"><p class="clQ"></p><div class="clOpts"></div><p class="clWhy"></p></div>
      <button id="clGo">PUT ON THE HEADSET</button>`;
    const cv = $('clMap'), cx = cv.getContext('2d');
    const qEl = st.querySelector('.clQ'), optsEl = st.querySelector('.clOpts'), whyEl = st.querySelector('.clWhy');
    const W = cv.width, H = cv.height, CX = W / 2, CY = H / 2 - 6, RX = W * 0.4, RY = H * 0.34;
    const myName = (JSON.parse(localStorage.getItem('apex_account') || '{}').username || 'YOU').slice(0, 10);
    const PIT_IN = 0.08, PIT_OUT = 0.42, TAU = Math.PI * 2;
    let raf = 0, timers = [], deck = [], idx = 0, score = 0, phase = 'idle', ts = 1, tsTarget = 1, frozeAt = 0;
    const clearT = () => { timers.forEach(clearTimeout); timers = []; };
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    cleanup = () => { cancelAnimationFrame(raf); clearT(); };

    // ---- the sim ----
    let S = null;
    function makeSim(sc) {
      const k = [];
      const N = 8;
      for (let i = 0; i < N; i++) {
        k.push({ t: (0.55 + i * 0.055) % 1, spd: 0.052 - i * 0.0007, lat: 0, latT: 0, mul: 1,
                 r: 5, col: ['#e8e8f0', '#c73a2c', '#2e9d63', '#8931d6', '#0fb8c4', '#f2a900', '#d6336c', '#6a7788'][i], spin: 0, dead: false, pitPlan: null });
      }
      const me = k[2];                                   // P3-ish: room to gain, room to lose
      me.r = 9; me.col = '#ff8c1a'; me.me = true; me.spd = 0.0515;
      const sim = {
        k, me, fx: [], tl: [],
        at(sec, fn) { this.tl.push({ at: sec, fn, done: false }); },
        pit(kart, laneMul) { kart.pitPlan = { laneMul: laneMul || 0.42 }; },
        crash(kart) { kart.dead = true; kart.latT = -22; },
        revive(kart, m) { kart.dead = false; kart.latT = 0; kart.mul = m || 1; kart.spin = 0; },
        stop(kart) { kart.stopped = true; kart.latT = -14; },
        slow(kart, m) { kart.mul = m; },
        boost(kart, m) { kart.mul = m; },
        clock: 0,
      };
      if (sc.santo) { const sk = k[3]; sk.col = '#ff7a1a'; sk.santo = true; sk.t = (me.t - 0.03 + 1) % 1; sk.spd = me.spd * 0.99; sim.santo = sk; }
      if (sc.mate) { const mk = k[4]; mk.col = '#ffd23e'; mk.mate = true; mk.t = (me.t - 0.025 + 1) % 1; mk.spd = me.spd * 1.0; sim.mate = mk; }
      if (sc.pre) sc.pre(sim, me);
      return sim;
    }
    const pos = (t, lat) => {
      const a = t * TAU;
      return [CX + (RX - lat) * Math.cos(a), CY + (RY - lat) * Math.sin(a)];
    };
    function stepSim(dt) {
      S.clock += dt;
      for (const e of S.tl) if (!e.done && S.clock >= e.at) { e.done = true; e.fn(); }
      for (const kart of S.k) {
        if (kart.dead) { kart.spin += dt * 6; }
        let v = (kart.dead || kart.stopped) ? 0 : kart.spd * kart.mul;
        // pit routing: dive at PIT_IN, crawl the inner lane, rejoin at PIT_OUT
        if (kart.pitPlan) {
          const inLane = kart.t > PIT_IN && kart.t < PIT_OUT;
          if (inLane) { kart.latT = 26; v *= kart.pitPlan.laneMul; }
          if (kart.t >= PIT_OUT) { kart.pitPlan = null; kart.latT = 0; }
        }
        kart.t = (kart.t + v * dt) % 1;
        kart.lat += (kart.latT - kart.lat) * Math.min(1, dt * 5);
      }
    }
    function draw() {
      cx.clearRect(0, 0, W, H);
      // track ribbon
      cx.lineWidth = 26; cx.strokeStyle = '#1a2340';
      cx.beginPath(); cx.ellipse(CX, CY, RX, RY, 0, 0, TAU); cx.stroke();
      cx.lineWidth = 1.5; cx.strokeStyle = 'rgba(143,168,232,.35)'; cx.setLineDash([6, 8]);
      cx.beginPath(); cx.ellipse(CX, CY, RX, RY, 0, 0, TAU); cx.stroke(); cx.setLineDash([]);
      // pit lane (inner, along the bottom-right arc)
      cx.lineWidth = 8; cx.strokeStyle = 'rgba(46,107,255,.4)';
      cx.beginPath(); cx.ellipse(CX, CY, RX - 26, RY - 26, 0, PIT_IN * TAU, PIT_OUT * TAU); cx.stroke();
      cx.fillStyle = '#8fa8e8'; cx.font = '700 9px Poppins, sans-serif'; cx.textAlign = 'center';
      const [plx, ply] = pos(0.25, 34); cx.fillText('PIT', plx, ply);
      // start/finish
      const [sx1, sy1] = pos(0, -14), [sx2, sy2] = pos(0, 14);
      cx.strokeStyle = '#eef3ff'; cx.lineWidth = 3; cx.setLineDash([4, 3]);
      cx.beginPath(); cx.moveTo(sx1, sy1); cx.lineTo(sx2, sy2); cx.stroke(); cx.setLineDash([]);
      // karts (sorted so mine draws on top)
      for (const kart of [...S.k].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0))) {
        const [x, y] = pos(kart.t, kart.lat);
        cx.save(); cx.translate(x, y);
        if (kart.dead) cx.rotate(kart.spin);
        cx.fillStyle = kart.col;
        cx.beginPath(); cx.arc(0, 0, kart.r, 0, TAU); cx.fill();
        if (kart.me) { cx.lineWidth = 2.5; cx.strokeStyle = '#fff'; cx.stroke(); }
        if (kart.dead) { cx.fillStyle = '#ff3b30'; cx.fillRect(-kart.r, -1.5, kart.r * 2, 3); }
        cx.restore();
        if (kart.me) { cx.fillStyle = '#ff8c1a'; cx.font = '800 10px Poppins, sans-serif'; cx.fillText(myName, x, y - 14); }
        if (kart.santo) { cx.fillStyle = '#ff7a1a'; cx.font = '800 8px Poppins, sans-serif'; cx.fillText('EL SANTO', x, y - 11); }
        if (kart.mate) { cx.fillStyle = '#ffd23e'; cx.font = '800 8px Poppins, sans-serif'; cx.fillText('TEAMMATE', x, y - 11); }
      }
      // bullet time wash
      if (ts < 0.9) {
        cx.fillStyle = `rgba(20,40,110,${(0.9 - ts) * 0.4})`; cx.fillRect(0, 0, W, H);
        cx.fillStyle = `rgba(238,243,255,${0.5 + Math.sin(performance.now() / 180) * 0.3})`;
        cx.font = '900 15px "Archivo Black", sans-serif';
        cx.save(); cx.translate(W - 74, 22); cx.transform(1, 0, -0.14, 1, 0, 0); cx.fillText('BULLET TIME', 0, 0); cx.restore();
      }
    }
    let lastT = 0;
    function loop(t) {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
      ts += (tsTarget - ts) * Math.min(1, dt * (tsTarget < ts ? 1.8 : 3.5));   // slow eases in, resume SNAPS
      if (S) { stepSim(dt * ts); draw(); }
      raf = requestAnimationFrame(loop);
    }

    // ---- round flow: breathe → freeze → call → aftermath → verdict ----
    function round() {
      if (idx >= deck.length) {
        const isBest = best('vc_fun_calls', score, false);
        qEl.innerHTML = `<b>${score} pts.</b> ${isBest ? 'PERSONAL BEST — the tower salutes.' : score >= 700 ? 'Cold blood. Real pit-wall material.' : 'Static on the line. Run it back.'}`;
        optsEl.innerHTML = ''; whyEl.textContent = '';
        $('clGo').style.display = '';
        return;
      }
      const sc = deck[idx];
      S = makeSim(sc);
      ts = 1; tsTarget = 1; phase = 'breathe';
      qEl.textContent = 'The race is green…'; optsEl.innerHTML = ''; whyEl.textContent = '';
      later(1600, () => {
        phase = 'frozen'; tsTarget = 0.02; frozeAt = performance.now();
        qEl.textContent = sc.q;
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        optsEl.innerHTML = order.map(o => `<button data-o="${o}">${sc.c[o]}</button>`).join('');
        optsEl.querySelectorAll('[data-o]').forEach(b => b.onclick = () => decide(+b.dataset.o));
        later(7000, () => { if (phase === 'frozen') decide(-1); });   // dead air = a call too
      });
      function decide(pick) {
        if (phase !== 'frozen') return;
        phase = 'aftermath';
        const sec = (performance.now() - frozeAt) / 1000;
        const right = pick === sc.a;
        optsEl.querySelectorAll('[data-o]').forEach(b => {
          if (+b.dataset.o === sc.a) b.classList.add('right');
          else if (+b.dataset.o === pick) b.classList.add('wrong');
          b.disabled = true;
        });
        tsTarget = 1.8;                                    // time snaps back — watch the map
        S.clock = 0; S.tl = [];
        (right ? sc.good : sc.bad)(S, S.me);
        qEl.textContent = right ? 'GOOD CALL — watch it play out…' : 'The wall goes quiet…';
        later(3800, () => {
          const bonus = right ? Math.max(0, 120 - Math.round(sec * 20)) : 0;
          if (right) score += 100 + bonus;
          whyEl.textContent = (pick === -1 ? 'Silence on the radio is also a call. A bad one. ' : '') + sc.why +
            (right ? `  +${100 + bonus} (call took ${sec.toFixed(1)}s)` : `  (call took ${sec.toFixed(1)}s)`);
          idx++;
          later(2100, round);
        });
      }
    }
    $('clGo').onclick = () => {
      $('clGo').style.display = 'none';
      deck = [...SCEN].sort(() => Math.random() - 0.5).slice(0, 5);
      idx = 0; score = 0;
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
      round();
    };
  }

  // ================= TORQUE TO SPEC (engineer workout) =================
  function torque(st) {
    st.innerHTML = `<h3>TORQUE TO SPEC</h3><p class="fgSub">Head gasket, eight bolts. Tap to lock the needle in the green. Over-torque = STRIPPED.</p>
      <div id="tqGauge"><div id="tqGreen"></div><div id="tqNeedle"></div></div>
      <p id="tqMsg">The zone shrinks every bolt.</p><div id="tqBolts">${'<i></i>'.repeat(8)}</div>
      <button id="tqGo">PICK UP THE WRENCH</button>`;
    const needle = $('tqNeedle'), green = $('tqGreen'), msg = $('tqMsg');
    const boltEls = [...st.querySelectorAll('#tqBolts i')];
    let bolt = 0, playing = false, raf = 0, ph = 0, last = 0;
    cleanup = () => cancelAnimationFrame(raf);
    let gLo = 0, gHi = 0, speed = 0;
    function setZone() {
      const w = Math.max(8, 22 - bolt * 2);              // % width, shrinks per bolt
      gLo = 55 + Math.random() * (38 - w);               // green lives in the upper half — torque UP to spec
      gHi = gLo + w;
      speed = 1.1 + bolt * 0.22;
      green.style.left = gLo + '%'; green.style.width = (gHi - gLo) + '%';
    }
    function loop(t) {
      if (!playing) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      ph += dt * speed;
      const x = (Math.sin(ph) * 0.5 + 0.5) * 100;        // 0..100 sweep
      needle.style.left = x + '%';
      needle._x = x;
      raf = requestAnimationFrame(loop);
    }
    function tap() {
      if (!playing) return;
      const x = needle._x || 0;
      if (x >= gLo && x <= gHi) {
        boltEls[bolt].className = 'done';
        bolt++;
        if (navigator.vibrate) navigator.vibrate(14);
        if (bolt >= 8) {
          playing = false;
          const isBest = best('vc_fun_torque', 8, false);
          msg.innerHTML = '<b>GASKET SEALED.</b> Eight for eight. ' + (isBest ? 'The bench remembers.' : 'Ship it.');
          $('tqGo').style.display = '';
        } else { msg.textContent = 'TORQUED. Next bolt.'; setZone(); }
      } else if (x > gHi) {
        playing = false;
        boltEls[bolt].className = 'strip';
        best('vc_fun_torque', bolt, false);
        msg.innerHTML = '<b>STRIPPED.</b> ' + bolt + ' bolt' + (bolt === 1 ? '' : 's') + ' in. New gasket, start over.';
        $('tqGo').style.display = '';
      } else {
        msg.textContent = 'Loose. Come back up to it.';   // under-torque: no penalty, keep sweeping
      }
    }
    ov.addEventListener('pointerdown', e => { if (e.target.id !== 'fgClose' && e.target.id !== 'tqGo') tap(); });
    $('tqGo').onclick = () => {
      $('tqGo').style.display = 'none';
      bolt = 0; boltEls.forEach(b => b.className = '');
      setZone(); playing = true; last = performance.now();
      msg.textContent = 'Bolt 1. Easy hands.';
      raf = requestAnimationFrame(loop);
    };
  }

  // ================= MANAGER (nothing — on purpose) =================
  function mgr(st) {
    st.innerHTML = `<h3>MANAGER'S MINIGAME</h3>
      <div id="mgBreath"></div>
      <p id="mgMsg">There isn't one. You run the lineup, the wallet, the group chat, and the blame.<br>Here is one quiet minute instead.</p>
      <button id="mgGo">TAKE A BREATH</button>`;
    let timers = [];
    cleanup = () => timers.forEach(clearTimeout);
    $('mgGo').onclick = () => {
      $('mgGo').style.display = 'none';
      const c = $('mgBreath'), m = $('mgMsg');
      c.classList.add('breathing');
      const script = [[0, 'in…'], [4000, 'out…'], [8000, 'in…'], [12000, 'out…'], [16000, 'in…'], [20000, 'out…'],
        [24000, 'That\'s it. That\'s the minigame.'], [26500, 'Back to work, gaffer.']];
      for (const [t, txt] of script) timers.push(setTimeout(() => { m.textContent = txt; }, t));
      timers.push(setTimeout(() => { c.classList.remove('breathing'); $('mgGo').style.display = ''; }, 27500));
    };
  }

  // the radio dot on the homepage finally syncs (mirrors the injected button's dot)
  setInterval(() => {
    const d = $('homeRadioDot');
    if (d) d.style.display = document.getElementById('radioDot') ? 'inline-block' : 'none';
  }, 3000);

  inject();
  new MutationObserver(inject).observe(document.body, { childList: true });
})();
