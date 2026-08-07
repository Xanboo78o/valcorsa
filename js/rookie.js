// VALCORSA — THE ROOKIE PROGRAM (Adam's FTUE spec, 2026-08-07).
// A new racer's first 90 seconds: gamertag account (unique names, tuff random
// suggestions) → welcome bubble → QUICK RACE is the only door → driving-school
// bubbles before the first countdown → hilariously slow locals → then the
// country unlocks one door at a time: GARAGE → SHOP → SETTINGS → TEAMS → SEASON.
// Existing accounts are grandfathered (they built this place).
'use strict';

window.ROOKIE = (() => {
  const $ = id => document.getElementById(id);
  const cfg = window.APEX_CONFIG || {};
  const REST = (cfg.supabaseUrl || '') + '/rest/v1';
  const HEAD = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey };
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || null);

  // ---- stage machine: 0 welcome/race · 1 garage · 2 shop · 3 settings · 4 teams · 5 season · done
  const stage = () => localStorage.getItem('vc_rookie') ?? 'done';
  const setStage = s => { localStorage.setItem('vc_rookie', s); applyGates(); };
  if (acct() && localStorage.getItem('vc_rookie') == null) localStorage.setItem('vc_rookie', 'done');

  // ---- tuff name generator ----
  const ADJ = ['Amazing', 'Blazing', 'Crunchy', 'Drifting', 'Electric', 'Feral', 'Golden', 'Howling',
    'Iron', 'Jagged', 'Krazed', 'Loud', 'Mighty', 'Nitro', 'Orbital', 'Petrol', 'Quick', 'Rowdy',
    'Sideways', 'Turbo', 'Unhinged', 'Vivid', 'Wild', 'Zooming', 'Midnight', 'Rusty', 'Chrome', 'Grim'];
  const ANI = ['Armadillo', 'Badger', 'Coyote', 'Dingo', 'Eel', 'Falcon', 'Gecko', 'Hyena', 'Iguana',
    'Jackal', 'Koala', 'Llama', 'Moose', 'Newt', 'Otter', 'Panther', 'Quokka', 'Raccoon', 'Sloth',
    'Toucan', 'Urchin', 'Viper', 'Wombat', 'Yak', 'Zebra', 'Hound', 'Bison', 'Mantis'];
  const TUFF = ['Cruzero', 'Vantorque', 'Slipstreamo', 'Redlino', 'Apexio', 'Torqura', 'Nitrosa',
    'Velocro', 'Drifthound', 'Revoro', 'Kartello', 'Ghostline', 'Overdrivo', 'Santovia', 'Blurro',
    'Maxximo', 'Fumo', 'Rallygo', 'Corsairo', 'Vantablack', 'Piston', 'Camshaft', 'Redline', 'Slick'];
  function suggestName() {
    return Math.random() < 0.55
      ? ADJ[Math.floor(Math.random() * ADJ.length)] + ANI[Math.floor(Math.random() * ANI.length)]
      : TUFF[Math.floor(Math.random() * TUFF.length)] + (Math.random() < 0.4 ? Math.floor(Math.random() * 90 + 10) : '');
  }

  // ---- the name registry: claim-or-taken in one POST (ignore-duplicates returns []) ----
  async function claimName(name, code) {
    try {
      const r = await fetch(REST + '/racers?on_conflict=name_lc', {
        method: 'POST',
        headers: { ...HEAD, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ name_lc: name.toLowerCase(), name, code: code || '' }),
      });
      if (!r.ok) return 'offline';
      const rows = await r.json();
      return rows.length ? 'claimed' : 'taken';
    } catch (e) { return 'offline'; }   // no wifi = no gatekeeping
  }
  // grandfathered players: quietly register the name they already carry
  const a0 = acct();
  if (a0 && a0.username) claimName(a0.username, a0.code);

  // ---- account screen upgrade: helper copy + prefilled tuff suggestion + reroll ----
  function dressAccountScreen() {
    const box = document.querySelector('#accountScreen .acctBox');
    const input = $('usernameInput');
    if (!box || !input || $('rkAcctNote')) return;
    const note = document.createElement('p');
    note.id = 'rkAcctNote';
    note.className = 'acctNote';
    note.innerHTML = 'Pick a racing name — you can change it later. <b>Don’t use your real name.</b> Think xbox gamertag. Taken names are taken.';
    box.insertBefore(note, input);
    const row = document.createElement('div');
    row.id = 'rkSuggestRow';
    row.innerHTML = '<span>suggestion:</span><button id="rkSuggest" type="button"></button><button id="rkReroll" type="button" title="another">↻</button>';
    box.insertBefore(row, input.nextSibling);
    const sBtn = $('rkSuggest');
    const roll = () => { sBtn.textContent = suggestName(); };
    roll();
    sBtn.onclick = () => { input.value = sBtn.textContent; input.focus(); };
    $('rkReroll').onclick = roll;
    if (!input.value) input.value = sBtn.textContent;   // one tap from a tuff name

    // wrap submit: enforce unique names, then start the rookie program
    const orig = () => window.submitAccount && window.submitAccount._rkOrig;
    const arm = () => {
      if (!window.submitAccount || window.submitAccount._rkWrapped) return;
      const prev = window.submitAccount;
      const wrapped = async () => {
        const name = (input.value || '').trim().slice(0, 16);
        if (!name) { prev(); return; }
        const res = await claimName(name);
        if (res === 'taken') {
          input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400);
          note.innerHTML = '<b style="color:#ff8c1a">' + name + ' is taken.</b> Try another — or take the suggestion.';
          roll();
          return;
        }
        localStorage.setItem('vc_rookie', '0');         // fresh racer: the program begins
        prev();
        applyGates();
        setTimeout(welcome, 600);
      };
      wrapped._rkWrapped = true;
      window.submitAccount = wrapped;
    };
    arm();
    setInterval(arm, 500);   // pair.js re-defines submitAccount inside startAccountFlow
  }

  // ---- the bubble (one at a time, storm-styled, slanted: it's ALIVE) ----
  let bubbleEl = null;
  function bubble(html, opts = {}) {
    dismissBubble();
    bubbleEl = document.createElement('div');
    bubbleEl.id = 'rkBubble';
    bubbleEl.innerHTML = '<div class="rkInner">' + html +
      (opts.buttons ? '<div class="rkBtns">' + opts.buttons.map((b, i) => `<button data-rk="${i}">${b.label}</button>`).join('') + '</div>'
                    : '<span class="rkTap">tap</span>') + '</div>';
    document.body.appendChild(bubbleEl);
    if (opts.buttons) {
      bubbleEl.querySelectorAll('[data-rk]').forEach(btn =>
        btn.onclick = e => { e.stopPropagation(); const b = opts.buttons[+btn.dataset.rk]; dismissBubble(); if (b.then) b.then(); });
    } else {
      bubbleEl.onclick = () => { dismissBubble(); if (opts.then) opts.then(); };
    }
    return bubbleEl;
  }
  function dismissBubble() { if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; } }

  // ---- gates: what a rookie can see, per stage ----
  const TABS_BY_STAGE = { 0: ['home'], 1: ['home', 'garage'], 2: ['home', 'garage', 'shop'],
    3: ['home', 'garage', 'shop', 'settings'], 4: ['home', 'garage', 'shop', 'settings', 'teams'],
    5: ['home', 'garage', 'shop', 'settings', 'teams', 'season'] };
  function applyGates() {
    const s = stage();
    const rookie = s !== 'done';
    document.body.classList.toggle('rookie', rookie);
    const allowed = TABS_BY_STAGE[s] || null;
    document.querySelectorAll('#tabBar button').forEach(b => {
      b.style.display = (!allowed || allowed.includes(b.dataset.tab)) ? '' : 'none';
    });
    // home clutter: the daily card + nav row + injected buttons wait until graduation
    ['schedCard', 'diffRow'].forEach(id => { const el = $(id); if (el) el.style.display = rookie ? 'none' : ''; });
    const qr = $('quickRace');
    if (qr) qr.classList.toggle('rkGlow', s === '0');
  }
  function unlockTab(tab, say) {
    applyGates();
    const b = document.querySelector(`#tabBar button[data-tab="${tab}"]`);
    if (b) { b.classList.add('rkNew'); const clear = () => { b.classList.remove('rkNew'); b.removeEventListener('click', clear); }; b.addEventListener('click', clear); }
    if (say) bubble(say.html, say.opts);
  }

  // ---- stage 0: welcome + the first race ----
  function welcome() {
    if (stage() !== '0') return;
    const menuUp = $('menu') && $('menu').style.display !== 'none';
    if (!menuUp) { setTimeout(welcome, 800); return; }
    bubble('<b>Welcome to Valcorsa — the home of racing.</b><br>You’re here. I’ve outfitted you with a solid kart, don’t worry for now.<br>Hit the button that says <b class="rkOrange">QUICK RACE</b>.');
  }

  // driving school: freeze the countdown, teach, release
  let taught = false, steerR = false, steerL = false;
  function tutorial() {
    taught = true;
    const touch = matchMedia('(pointer: coarse)').matches;
    const hint = $('hint'); if (hint) hint.style.display = 'none';
    document.body.classList.add('rkSchool');   // tick() re-shows #countdown every frame — CSS wins
    let hold = true;
    const freeze = () => { if (!hold) return; try { countdownT = 3.55; } catch (e) {} requestAnimationFrame(freeze); };
    freeze();
    const steps = [
      { html: touch
          ? '<b>This is your steering.</b><br>Hold the <b>RIGHT</b> side of the screen — go right. Hold the <b>LEFT</b> — go left. Try both.'
          : '<b>This is your steering.</b><br>Press the right arrow (or D) — go right. Press the left (or A) — go left. Try both.',
        wait: () => steerR && steerL },
      { html: touch
          ? '<b>This is your speed.</b><br>Your kart accelerates on its own — you handle the corners. The number bottom-center is how fast you’re going.'
          : '<b>This is your speed.</b><br>Hold W (or the up arrow) for gas. The number bottom-center is how fast you’re going.' },
      { html: '<b>This is your brake and drift.</b><br><b>Tip:</b> quickly tap the brakes before turns to control your speed and get a better line. Hold <b>DRIFT</b> in a turn to slide it like a rally pro.' },
      { html: '<b>See the crates on the road?</b> Toys inside. Drive through one and an <b>ITEM</b> button appears — use it on a local.' },
      { html: '<b>That’s everything.</b> These locals are… not fast. Beat them.<br><b class="rkOrange">LIGHTS OUT.</b>' },
    ];
    let i = 0;
    const show = () => {
      if (i >= steps.length) {
        hold = false;
        document.body.classList.remove('rkSchool');
        return;
      }
      const st = steps[i];
      bubble(st.html, { then: () => { i++; show(); } });
      if (st.wait) {
        const poll = setInterval(() => {
          const t = (window.TOUCH && Math.abs(TOUCH.steer) > 0.4) ? Math.sign(TOUCH.steer) : 0;
          if (t > 0) steerR = true; if (t < 0) steerL = true;
          if (st.wait()) { clearInterval(poll); if (bubbleEl) { i++; show(); } }
        }, 100);
        addEventListener('keydown', function k(e) {
          if (e.key === 'ArrowRight' || e.key === 'd') steerR = true;
          if (e.key === 'ArrowLeft' || e.key === 'a') steerL = true;
          if (steerR && steerL) removeEventListener('keydown', k);
        });
      }
    };
    show();
  }

  // hilariously slow locals (and no El Santo on someone's first day)
  function nerfGrid() {
    try {
      for (const c of cars) {
        if (c.isPlayer) continue;
        if (c.name === 'El Santo') c.name = 'Tio Lento';
        c.skill = 0.55 + Math.random() * 0.06;
        c.topLo = 92; c.topHi = 112;
        c.engineMul = (c.engineMul || 1) * 0.55;
        c.atk = 0; c.def = 0;
        if (c.tagSpr) { try { c.mesh.remove(c.tagSpr); } catch (e) {} attachNameTag(c); }
      }
    } catch (e) {}
  }

  // ---- the unlock chain (each door opens as the previous closes) ----
  function watchModal(id, onOpen, onClose) {
    const arm = () => {
      const el = $(id);
      if (!el || el._rkWatched) return;
      el._rkWatched = true;
      let was = el.style.display !== 'none' && el.style.display !== '';
      new MutationObserver(() => {
        const is = el.style.display !== 'none' && el.style.display !== '';
        if (is && !was && onOpen) onOpen();
        if (!is && was && onClose) onClose();
        was = is;
      }).observe(el, { attributes: true, attributeFilter: ['style'] });
    };
    arm();
    new MutationObserver(arm).observe(document.body, { childList: true });
  }

  function wireChain() {
    watchModal('garageModal',
      () => { if (stage() === '1') bubble('<b>The GARAGE.</b> Scroll the wheel to pick your chassis — every one drives different (check the spec sheet). Paint it, number it, name it. <b>SAVE</b> when it’s yours.'); },
      () => { if (stage() === '1') { setStage('2'); setTimeout(() =>
        unlockTab('shop', { html: '<b>New door: the PARTS SHOP.</b> Race winnings (₡) buy engines, tires, wings — and PartsPacks if you like surprises.', opts: { buttons: [
          { label: 'MORE DETAIL', then: () => bubble('<b>The long version:</b> every part is real — its stats feed the physics. Aisles by system, brands have personalities (Basil Werk is a gamble). Chassis need <b>3 cards</b> from ChanesChassis packs. The workbench parts marked 🔧 assemble into whole engines in the Engineer Garage — that door opens when you’ve raced enough to need it.') },
          { label: 'GOT IT', then: null }] } }), 400); } });
    watchModal('shopModal', null,
      () => { if (stage() === '2') { setStage('3'); setTimeout(() =>
        unlockTab('settings', { html: '<b>SETTINGS.</b> Steering style, sound sliders, race alerts for your phone. Peek in, set it up how you like.' }), 400); } });
    watchModal('settingsModal', null,
      () => { if (stage() === '3') { setStage('4'); setTimeout(() =>
        unlockTab('teams', { html: '<b>New door: TEAMS.</b> Start one with your friends or join with a code — your points bank together in the constructors standings. Racing alone is fine. Racing as a squad is a WAR.' }), 400); } });
    watchModal('teamsModal', null,
      () => { if (stage() === '4') { setStage('5'); setTimeout(() =>
        unlockTab('season', { html: '<b>Last door: THE SEASON.</b> Valcorsa races every day — every scheduled grid banks points to the league table. This is the whole country’s scoreboard. Go look at it.' }), 400); } });
    watchModal('seasonScreen', null,
      () => { if (stage() === '5') { setStage('done');
        setTimeout(() => bubble('<b>That’s Valcorsa.</b> The daily card is on your home screen now — tonight, <b class="rkOrange">THE OPEN</b>, 20 karts, 8:30. Be there.<br><span class="rkDim">— welcome to the home of racing</span>'), 400); } });
  }

  // ---- endRace hook: finishing the rookie race opens the garage ----
  function wireFinish() {
    const prev = window.endRace;
    if (!prev || prev._rk) return;
    const wrapped = function (...args) {
      const r = prev.apply(this, args);
      if (stage() === '0' && player && player.isPlayer) {
        setStage('1');
        const wait = setInterval(() => {
          if ($('menu') && $('menu').style.display !== 'none') {
            clearInterval(wait);
            unlockTab('garage', { html: '<b>THAT’S RACING.</b> Told you the locals were slow.<br>I’ve opened your <b>GARAGE</b> — tap the wrench and make that kart YOURS.' });
          }
        }, 500);
      }
      return r;
    };
    wrapped._rk = true;
    window.endRace = wrapped;
  }

  // ---- main loop: catch the rookie race starting ----
  setInterval(() => {
    if (stage() !== '0' || taught) return;
    if (typeof state !== 'undefined' && state === 'countdown' && typeof cars !== 'undefined' && cars.length > 1) {
      dismissBubble();
      nerfGrid();
      tutorial();
    }
  }, 300);

  dressAccountScreen();
  wireChain();
  wireFinish();
  applyGates();
  if (stage() === '0' && acct()) setTimeout(welcome, 1200);   // mid-funnel reload

  return { stage, suggestName, applyGates };
})();
