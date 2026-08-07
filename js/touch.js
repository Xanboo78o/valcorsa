/* Valcorsa — on-device touch driving, "Karting" scheme (research-backed defaults):
   AUTO-ACCELERATE (throttle is never a job), two tap-and-hold steer zones in the
   bottom-left quadrant with the crest-wheel as living decoration, one big hold-DRIFT
   on the right thumb, a small demoted BRAKE. Presets: karting (default) / tilt / pedals.
   Exposes window.TOUCH = { steer, thr, brk, hb } merged by main.js.
   Also owns the hard landscape lock (body.rot90 CSS rotation + Android fullscreen lock). */
'use strict';

window.TOUCH = { steer: 0, thr: 0, brk: 0, hb: 0 };

(() => {
  const isCoarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const forced = new URLSearchParams(location.search).get('touch') === '1';
  if (!isCoarse && !forced) return;

  // ---- HARD landscape lock, layer 1: CSS-rotate the whole page when portrait ----
  const applyRot = () => {
    const portrait = matchMedia('(orientation: portrait)').matches;
    window.ROT90 = portrait;
    document.body.classList.toggle('rot90', portrait);
    dispatchEvent(new Event('resize'));            // engine re-measures, swapped
  };
  matchMedia('(orientation: portrait)').addEventListener('change', () => setTimeout(applyRot, 60));
  applyRot();

  // ---- control surface ----
  const WHEEL_SVG = `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform="rotate(10 52 52)" fill="none" stroke="#f4ecdd" stroke-linecap="round">
        <path stroke-width="4.6" d="M52 15.6 C 71.5 15.2, 88.6 31.4, 88.2 51.2 C 87.8 71.8, 71.9 87.6, 52.4 88.3 C 32.2 89.0, 15.8 72.4, 15.4 52.4 C 15.0 32.6, 31.8 16.2, 51.2 15.7 C 53.4 15.65, 55.8 16.1, 57.6 16.9"/>
        <g stroke-width="5">
          <path d="M52.3 21.5 L51.8 42.6"/><path d="M22.8 42.4 L42.9 48.9"/>
          <path d="M33.6 76.9 L46.3 60.3"/><path d="M70.9 77.5 L58.2 60.6"/>
          <path d="M81.5 42.0 L61.4 48.6"/>
        </g>
        <circle cx="52" cy="52" r="9.4" stroke-width="3.4"/>
        <circle cx="52.9" cy="52.9" r="6.2" fill="#c73a2c" stroke="none"/>
      </g>
    </svg>`;
  const ui = document.createElement('div');
  ui.id = 'touchUI';
  ui.innerHTML = `
    <div id="tSteer">
      <div id="tZoneL" class="tZone"><span>&#8249;</span></div>
      <div id="tZoneR" class="tZone"><span>&#8250;</span></div>
      <div id="tWheelWrap"><div id="tWheel">${WHEEL_SVG}</div></div>
    </div>
    <div id="tRight">
      <div id="tItem" class="tBtn tSmall" style="display:none">ITEM</div>
      <div id="tDrift" class="tBtn">DRIFT</div>
      <div id="tBrakeSm" class="tBtn tSmall">BRAKE</div>
    </div>
    <div id="tPedals">
      <div class="tCol">
        <div id="tItemP" class="tPedal" style="display:none">ITEM</div>
        <div id="tHandbrake" class="tPedal">DRIFT</div>
        <div id="tBrake" class="tPedal">BRAKE</div>
      </div>
      <div id="tGas" class="tPedal">GAS</div>
    </div>
    <div id="tMini">
      <button id="tCam" title="Camera"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M9.4 4L7.6 6H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6L14.6 4H9.4zM12 17.6a4.6 4.6 0 100-9.2 4.6 4.6 0 000 9.2z"/></svg></button>
      <button id="tReset" title="Reset car">↺</button>
      <button id="tPause" title="Pause"><svg viewBox="0 0 24 24"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.6z"/></svg></button>
    </div>`;
  document.body.appendChild(ui);
  const $t = id => document.getElementById(id);
  const buzz = () => navigator.vibrate && navigator.vibrate(12);

  // ---- Android lock, layer 2: first touch grabs fullscreen + OS orientation lock ----
  const grabLandscape = () => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    if (!el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  };
  ui.addEventListener('pointerdown', grabLandscape, { capture: true });

  // ---- controls: TWO independent axes — how you steer, and how you throttle ----
  const legacy = localStorage.getItem('vc_ctrl');   // migrate the old single-preset save
  let steerMode = localStorage.getItem('vc_steer')
    || (legacy === 'halves' ? 'halves' : (legacy === 'tilt' || legacy === 'lean') ? 'tilt' : 'zones');
  let accelMode = localStorage.getItem('vc_accel')
    || (legacy === 'lean' ? 'lean' : legacy === 'pedals' ? 'pedals' : 'auto');
  const needsTilt = () => steerMode === 'tilt' || accelMode === 'lean';
  const applySel = () => {
    ui.dataset.steer = steerMode; ui.dataset.accel = accelMode;
    document.querySelectorAll('#steerRow button').forEach(b => b.classList.toggle('sel', b.dataset.steer === steerMode));
    document.querySelectorAll('#accelRow button').forEach(b => b.classList.toggle('sel', b.dataset.accel === accelMode));
  };
  const resetTilt = () => { tiltZero = null; tiltSide = 0; leanZero = null; };
  const setSteer = m => {
    steerMode = m; localStorage.setItem('vc_steer', m); resetTilt(); applySel();
    if (typeof toast === 'function') toast('Steering: ' + m[0].toUpperCase() + m.slice(1));
    if (needsTilt()) askTilt();                // the settings tap IS the iOS permission gesture
  };
  const setAccel = m => {
    accelMode = m; localStorage.setItem('vc_accel', m); resetTilt(); applySel();
    if (typeof toast === 'function') toast('Throttle: ' + m[0].toUpperCase() + m.slice(1));
    if (needsTilt()) askTilt();
  };
  // iOS motion data needs an explicit permission call from a user gesture — this was the
  // "tilt does nothing" bug: the old ask only fired on in-game buttons, never on picking Tilt
  let tiltSeen = false;
  const askTilt = () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission)
      DeviceOrientationEvent.requestPermission().catch(() => {});
    setTimeout(() => {
      if (!tiltSeen && typeof toast === 'function') toast('No tilt data — allow Motion access & retap');
    }, 1800);
  };
  document.querySelectorAll('#steerRow button').forEach(b =>
    b.addEventListener('click', () => setSteer(b.dataset.steer)));
  document.querySelectorAll('#accelRow button').forEach(b =>
    b.addEventListener('click', () => setAccel(b.dataset.accel)));
  applySel();

  // ---- shared hold helper: pointer-captured, multi-touch safe, buzz on press ----
  const holdable = (el, on, off) => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('held'); buzz(); on();
    });
    const end = () => { el.classList.remove('held'); off(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };

  // ---- steering: tap-and-hold zones (karting) ----
  let steerL = false, steerR = false;
  holdable($t('tZoneL'), () => steerL = true, () => steerL = false);
  holdable($t('tZoneR'), () => steerR = true, () => steerR = false);

  // ---- right thumb: drift + demoted brake ----
  let brakeHeld = false;
  holdable($t('tDrift'), () => TOUCH.hb = 1, () => TOUCH.hb = 0);
  holdable($t('tBrakeSm'), () => brakeHeld = true, () => brakeHeld = false);

  // ---- pedals preset: the classic strips ----
  let pGas = 0, pBrk = 0;
  holdable($t('tGas'), () => pGas = 1, () => pGas = 0);
  holdable($t('tBrake'), () => pBrk = 1, () => pBrk = 0);
  holdable($t('tHandbrake'), () => TOUCH.hb = 1, () => TOUCH.hb = 0);

  // ---- tilt presets: calibrate on select, device-frame beta/gamma -> screen frame ----
  // tiltSide disambiguates WHICH WAY the phone is held in the CSS-rotated landscape (the
  // browser still thinks portrait, so beta's sign flips with the grip side; gravity's
  // direction at calibration tells us which). Wrong-side grip = inverted steering = the
  // other half of "tilt does nothing".
  let tiltZero = null, tiltSteer = 0, tiltSide = 0, leanVal = 0, leanZero = null;
  const steerAxis = ev => {
    if (window.ROT90) return -ev.beta * (tiltSide || 1);
    const o = (screen.orientation && screen.orientation.angle) ?? (window.orientation || 0);
    if (o === 90) return ev.beta;
    if (o === -90 || o === 270) return -ev.beta;
    return ev.gamma;
  };
  const pitchAxis = ev => {                    // lean preset: tip toward flat = accelerate
    if (window.ROT90) return ev.gamma * (tiltSide || 1);
    const o = (screen.orientation && screen.orientation.angle) ?? (window.orientation || 0);
    if (o === 90) return -ev.gamma;
    if (o === -90 || o === 270) return ev.gamma;
    return ev.beta;
  };
  window.addEventListener('deviceorientation', ev => {
    if (!needsTilt() || ev.beta == null) return;
    if (!tiltSeen) { tiltSeen = true; if (typeof toast === 'function') toast('Tilt active'); }
    if (window.ROT90 && !tiltSide) tiltSide = (ev.gamma || 0) >= 0 ? 1 : -1;
    const a = steerAxis(ev);
    if (tiltZero === null) tiltZero = a;
    tiltSteer = Math.max(-1, Math.min(1, -(a - tiltZero) / 26));
    const p = pitchAxis(ev);
    if (leanZero === null) leanZero = p;
    leanVal = (leanZero - p) / 22;             // + = tipped forward (toward laying flat)
  });
  // fallback: any in-game touch also (re)asks, in case the settings tap was denied
  ui.addEventListener('pointerdown', () => {
    if (needsTilt() && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission)
      DeviceOrientationEvent.requestPermission().catch(() => {});
  }, { once: false });

  // ---- mini buttons: synthetic keys ----
  const tapKey = (key, code) => {
    for (const type of ['keydown', 'keyup'])
      window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
  };
  $t('tCam').addEventListener('click', () => tapKey('c', 'KeyC'));
  $t('tReset').addEventListener('click', () => tapKey('r', 'KeyR'));
  $t('tPause').addEventListener('click', () => tapKey('Escape', 'Escape'));
  // ITEM buttons appear only while carrying (zero chrome when the rack is empty)
  for (const id of ['tItem', 'tItemP'])
    $t(id).addEventListener('pointerdown', e => { e.preventDefault(); buzz(); tapKey('e', 'KeyE'); });

  // ---- per-frame: publish inputs, animate the wheel, follow game state ----
  const wheel = $t('tWheel');
  let shown = false, wheelRot = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    const st = (typeof state !== 'undefined') ? state : 'menu';
    const driving = st === 'race' || st === 'tt' || st === 'countdown' || st === 'freeroam';
    const carrying = driving && typeof player !== 'undefined' && player && player.item;
    $t('tItem').style.display = carrying ? '' : 'none';
    $t('tItemP').style.display = carrying ? '' : 'none';

    let steer = 0;
    if (steerMode === 'tilt') steer = tiltSteer;
    else steer = (steerL ? 1 : 0) + (steerR ? -1 : 0);   // zones OR halves (same flags)
    TOUCH.steer = steer;

    if (accelMode === 'pedals') { TOUCH.thr = pGas; TOUCH.brk = pBrk; }
    else if (accelMode === 'lean') {              // pitch is the pedal: tip flat = gas, pull up = brake
      TOUCH.thr = (driving && !brakeHeld) ? Math.max(0, Math.min(1, leanVal)) : 0;
      TOUCH.brk = brakeHeld ? 1 : Math.max(0, Math.min(1, -leanVal - 0.25));
    }
    else {                                        // auto: always on the gas, BRAKE button to slow
      TOUCH.thr = (driving && !brakeHeld) ? 1 : 0;
      TOUCH.brk = brakeHeld ? 1 : 0;
    }

    // the wheel is decoration now: it leans ~34deg toward the held side
    wheelRot += ((-steer * 34) - wheelRot) * 0.22;
    wheel.style.transform = `rotate(${wheelRot}deg)`;

    if (driving !== shown) { shown = driving; ui.style.display = driving ? 'block' : 'none'; }
  };
  ui.style.display = 'none';
  requestAnimationFrame(tick);
})();
