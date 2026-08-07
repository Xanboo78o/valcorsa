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

  // ================= THE CALL (radio strategy, bullet time) =================
  const CALLS = [
    { q: 'Rain in ~2 laps. Your slicks are cooked. The rival crew just boxed.', c: ['BOX NOW', 'STAY OUT', 'BOX IN 3'], a: 0, why: 'Wets on BEFORE the rain — beat the rush.' },
    { q: 'P2. The leader brakes earlier into the hairpin every lap.', c: ['DIVE INSIDE', 'WAIT ANOTHER LAP', 'GO AROUND OUTSIDE'], a: 0, why: 'Fading brakes = open door. Send it.' },
    { q: 'Your racer: "kart pulls right and there\'s a thunky sound."', c: ['PIT — TIRE CHECK', 'PUSH THROUGH', 'IT\'S PROBABLY FUEL'], a: 0, why: 'Pull + thunk is a flat. Every time.' },
    { q: 'Last lap, you\'re P1. Rival glued to your slipstream on the long straight.', c: ['COVER THE INSIDE', 'DRIFT WIDE', 'BRAKE EARLY'], a: 0, why: 'Make them go the long way round.' },
    { q: 'El Santo has entered the race. Your rookie asks what to do.', c: ['RACE YOUR OWN RACE', 'CHASE HIM', 'PARK IT'], a: 0, why: 'Nobody chases El Santo and comes back the same.' },
    { q: 'Fuel: 2 laps in the tank, 3 laps to the flag. Rival has the same problem.', c: ['LIFT AND COAST', 'FULL SEND', 'BOX FOR SPLASH'], a: 0, why: 'Save it. He blinks first.' },
    { q: 'Smashkart. Crate row ahead. You\'re holding The Saw already.', c: ['SKIP THE CRATES', 'GRAB A CRATE', 'SLOW FOR THE ROW'], a: 0, why: 'Never reroll a good item.' },
    { q: 'Night race, hard league — your headlights took damage two corners ago.', c: ['FOLLOW A RIVAL\'S GLOW', 'SLOW RIGHT DOWN', 'PIT FOR LIGHTS'], a: 0, why: 'Borrowed light is free light.' },
    { q: 'Teammate P2, you P3. The crew needs constructor points. Two laps left.', c: ['HOLD STATION', 'FIGHT YOUR TEAMMATE', 'DEMAND A SWAP'], a: 0, why: 'Points over pride. The wall remembers.' },
    { q: 'Cầu Nổi. The pontoon\'s swaying, boards are wet, kart feels floaty.', c: ['SMOOTH HANDS, EASY THROTTLE', 'HANDBRAKE IT', 'SEND IT FLAT'], a: 0, why: 'Wet wood punishes spikes. Be water.' },
  ];
  function call(st) {
    st.innerHTML = `<h3>THE CALL</h3><p class="fgSub">Six situations. BULLET TIME gives you four seconds each. The crew is listening.</p>
      <div id="clBox"></div><button id="clGo">PUT ON THE HEADSET</button>`;
    const box = $('clBox');
    let deck = [], i = 0, score = 0, raf = 0, deadline = 0;
    cleanup = () => cancelAnimationFrame(raf);
    function ask() {
      if (i >= deck.length) {
        const isBest = best('vc_fun_calls', score, false);
        box.innerHTML = `<p class="clDone">${score} pts. ${isBest ? 'PERSONAL BEST — the tower salutes.' : score >= 500 ? 'Cold blood. Real pit-wall material.' : 'Static on the line. Run it back.'}</p>`;
        $('clGo').style.display = '';
        return;
      }
      const s = deck[i];
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      box.innerHTML = `<p class="clQ">${s.q}</p>
        <div class="clBar"><i></i></div>
        <div class="clOpts">${order.map(o => `<button data-o="${o}">${s.c[o]}</button>`).join('')}</div>
        <p class="clWhy"></p>`;
      const bar = box.querySelector('.clBar i');
      deadline = performance.now() + 4000;
      const tickBar = () => {
        const left = deadline - performance.now();
        bar.style.width = Math.max(0, left / 40) + '%';
        if (left <= 0) return verdict(-1);
        raf = requestAnimationFrame(tickBar);
      };
      raf = requestAnimationFrame(tickBar);
      box.querySelectorAll('[data-o]').forEach(b => b.onclick = () => verdict(+b.dataset.o));
      function verdict(pick) {
        cancelAnimationFrame(raf);
        const right = pick === s.a;
        const bonus = right ? Math.round(Math.max(0, deadline - performance.now()) / 40) : 0;
        if (right) score += 100 + bonus;
        box.querySelectorAll('[data-o]').forEach(b => {
          if (+b.dataset.o === s.a) b.classList.add('right');
          else if (+b.dataset.o === pick) b.classList.add('wrong');
          b.disabled = true;
        });
        box.querySelector('.clWhy').textContent = (pick === -1 ? 'Silence on the radio is also a call. A bad one. ' : '') + s.why + (right ? '  +' + (100 + bonus) : '');
        i++;
        setTimeout(ask, 1600);
      }
    }
    $('clGo').onclick = () => {
      $('clGo').style.display = 'none';
      deck = [...CALLS].sort(() => Math.random() - 0.5).slice(0, 6);
      i = 0; score = 0;
      ask();
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
