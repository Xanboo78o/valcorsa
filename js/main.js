/* Valcorsa — home of racing. 3D racing engine (forked from Apex Racer). PBR + real-time day/night/weather. */
'use strict';

// ---------------------------------------------------------------- constants
const CAR_COLORS = [0xe23b2e, 0x2f6fe0, 0xf0a821, 0x28b45a, 0xe6e8ee, 0x9b30e0, 0x14b8c4, 0xe85d9c,
  0xff7a1a, 0x1fd18b, 0x6c7ae0, 0xd4d21a, 0xb03a2e, 0x3ad0e6];
const HELMET_COLORS = [0xffffff, 0xffd23e, 0x111318, 0xe23b2e, 0x2f6fe0, 0x28b45a, 0x9b30e0, 0xf0a821,
  0xff7a1a, 0x1fd18b, 0xe6e8ee, 0x14b8c4, 0xe85d9c, 0x6c7ae0];
// Valcorsan locals — every town fills its own grid. (Anglo north, Spanish south, Viet + German threads.)
const AI_NAMES = ['Dmitri', 'Marisol', 'Bao', 'Heike', 'Old Tomas', 'Knox', 'Phuong',
  'Santi', 'Greta', 'Callum', 'Luz', 'Viktor', 'Anh'];
const N_SAMPLES = 1400;
const SUBSTEPS = 3;
const SPEED_DISPLAY_SCALE = 0.45;   // the car really moves fast; show a friendlier number (~200 top)

// Terrain + banking tuning
const BANK_GAIN = 18;               // curvature -> cross-slope; higher = more banked corners
const BANK_MAX = 0.2;               // max cross-slope (tan of bank angle) ~11 degrees
const CORRIDOR = 90;                // metres of flat blend from track edge into the hills
// Hard mode: same displayed number, but the world rushes at you and the fog is tight.
let hardMode = localStorage.getItem('apex_hard') === '1';
let paceMul = 1, fogMul = 1;        // set per-race from hardMode
// Customization / control settings
let brakeMode = localStorage.getItem('apex_brakeMode') || 'mouse';          // mouse | phoneL | phoneR
// WebHID pedals (gas + brake), each a dedicated device read directly. We treat ONGOING report
// activity as "the pedal is being pushed" — a foot pressing a pedal jitters the mouse, so reports
// stream while pushed and STOP when the foot lifts; the pedal releases HID_TIMEOUT ms after the
// last report. This is the "check if still being pushed, else let off" behaviour.
const HID_TIMEOUT = 200;
let hidGasDev = null, hidBrakeDev = null, hidGasLast = -1e9, hidBrakeLast = -1e9;
let phoneBrake = false;                       // brake button on the phone controller
const COAST_BRAKE = 0.22;                      // gentle engine-braking when off the gas ("slow a little")

// camera modes
const CAM_CHASE = 0, CAM_COCKPIT = 1, CAM_FAR = 2;
const CAM_NAMES = ['Chase', 'Cockpit', 'Cinematic'];

const PHYS = {
  wheelbase: 3.1,
  engineAccel: 46,      // u/s^2 — genuinely fast; the HUD number is scaled for readout
  brakeAccel: 70,
  reverseAccel: 15,
  reverseMax: 22,
  drag: 0.0031,         // real top ~440 km/h of world speed; shown as ~200 via SPEED_DISPLAY_SCALE
  rolling: 0.7,
  aLatMax: 64,          // high grip -> planted, forgiving (arcade F1)
  steerOver: 1.08,      // little slack past grip -> predictable, few spins
  downforce: 0.16,      // grip gain per (u/s), sticks at speed
  handbrakeGrip: 0.38,  // rear grip while handbraking: loose enough to swing, enough to CARVE the arc
  hbYaw: 2.2,           // extra yaw authority while handbraking, rad/s at full steer + speed
  slideCap: 0.66,       // ~38°: tires saturate — the nose physically cannot rotate past the travel
                        // direction by more than this while drifting (was unbounded: nose spun 180°
                        // past the velocity and the car "accelerated backward")
  driftBleed: 0.04,     // sliding is nearly free — drift's edge is the rotation + line, not a boost
  scrub: 0.35,          // turning costs speed: fraction of killed sideways motion lost forward too
  cornerUse: 0.6,       // fraction of max grip the AI plans corners at -> real braking zones
  stability: 6.0,       // self-straightening when you're not steering
};

// revs (v10.1): the gear system is GONE — rpm is a smooth 0..1 with speed, feeding the
// engine audio. No shifting, no powerband, no limiter. Karts just go.
function gearStep(car, speed) {
  car.gear = 1;
  car.rpm = THREE.MathUtils.clamp(0.06 + (speed / 126) * 0.94, 0.06, 1);
  car.limiter = false; car.lugging = false;
}

const SURFACES = {
  asphalt: { grip: 1.0, accelMul: 1.0, dragMul: 1.0 },
  dirt:    { grip: 0.66, accelMul: 0.9, dragMul: 1.05 },
  wet:     { grip: 0.76, accelMul: 0.97, dragMul: 1.0 },   // river-sprayed slick asphalt
  grass:   { grip: 0.4, accelMul: 0.42, dragMul: 2.8 },
  sand:    { grip: 0.34, accelMul: 0.36, dragMul: 3.6 },
};

const ENVS = {
  meadow: { ground: 0x62ab3e, ground2: 0x4d8a30, sky: 0x9fd2ff, top: 0x2f74cf, horizon: 0xcfe8ff, fog: 1700, scatter: 'trees', dense: 1.0 },
  forest: { ground: 0x4f9a3d, ground2: 0x3c7c2c, sky: 0x9fd2ff, top: 0x2c6ec6, horizon: 0xcbe6ff, fog: 1500, scatter: 'trees', dense: 1.4 },
  desert: { ground: 0xd6ad6a, ground2: 0xc09452, sky: 0xf3dcab, top: 0x6f9fd6, horizon: 0xf6e6bf, fog: 1500, scatter: 'rocks', dense: 0.6 },
  city:   { ground: 0x6a707a, ground2: 0x585e68, sky: 0xc2cee0, top: 0x6a7a94, horizon: 0xd4dde8, fog: 1300, scatter: 'buildings', dense: 0.5 },
  // rural New Hampshire: patchwork fields, forest, scattered farms, a river. Composite scatter.
  countryside: { ground: 0x6fae43, ground2: 0x548a31, sky: 0x9fd2ff, top: 0x2f74cf, horizon: 0xcfe8ff, fog: 2100, scatter: 'countryside', dense: 1.15 },
  oval:   { ground: 0x62ab3e, ground2: 0x4d8a30, sky: 0x9fd2ff, top: 0x2f74cf, horizon: 0xcfe8ff, fog: 2000, scatter: 'stands', dense: 0.7 },
};

// ---------------------------------------------------------------- globals
let renderer, scene, camera, dirLight;
let track = null;
let cars = [];
let player = null;
let state = 'menu';
let mode = 'race';
let countdownT = 0, raceTime = 0, pausedFrom = null;
let camMode = CAM_CHASE;
let muted = false;
let steerInvert = localStorage.getItem('apex_steerInvert') === '1';
let mouseThrottle = false, mouseBrake = false;   // click-and-hold pedals (held state)
let throttlePedal = 0, brakePedal = 0;           // analog pedal travel — eases in/out, not on/off
// gyroSteer + phoneConnected live in pair.js (phone controller)
const keys = {};
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
const _n = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4();
let toastT = 0;

// ---------------------------------------------------------------- material helpers
// Toon 2.0: one shared 3-step gradient ramp; every world material is MeshToonMaterial.
// The factory WHITELISTS options — PBR opts (roughness/metalness/normalMap/env...) that
// older call sites still pass are silently dropped, so no call-site edits were needed.
// (material core — toonMat/paintMat/glassMat/addOutlines — lives in palette.js now)

const rand01 = () => Math.random();
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- terrain field
// Smooth low-frequency "rolling hills" field, amplitude scaled per track (def.hills).
function ambientHills(x, z, amp) {
  if (!amp) return 0;
  return (Math.sin(x * 0.0016 + 0.3) * Math.cos(z * 0.0014 - 0.8) * 62 +
          Math.sin(x * 0.0044 - 1.1) * Math.cos(z * 0.0040 + 0.5) * 22 +
          Math.sin(x * 0.0115 + 2.0) * Math.sin(z * 0.0102 - 0.3) * 3) * amp;
}
// World surface height. Closed circuits: the stamped heightfield IS the ground (road
// corridor burned in, banking as berms). Open world: the city heightmap. One truth each.
function terrainHeight(x, z) {
  if (!track) return 0;
  if (track.open && track.heightAt) return track.heightAt(x, z);   // open world elevation
  if (track.fieldAt) return track.fieldAt(x, z);                   // circuit stamped field
  return 0;
}

// ---------------------------------------------------------------- boot
// Viewport size, ROT90-aware: when touch.js force-rotates the page to landscape
// (body.rot90, portrait phones), the game renders at swapped dimensions.
function vpW() { return window.ROT90 ? innerHeight : innerWidth; }
function vpH() { return window.ROT90 ? innerWidth : innerHeight; }

function boot() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(vpW(), vpH());
  renderer.setPixelRatio(Math.min(devicePixelRatio, qcfg().pr));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;   // flat fills are authored in display terms
  renderer.toneMappingExposure = 1.0;
  document.getElementById('game').appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(70, vpW() / vpH(), 0.3, qcfg().far);

  addEventListener('resize', () => {
    camera.aspect = vpW() / vpH();
    camera.updateProjectionMatrix();
    renderer.setSize(vpW(), vpH());
    resizePostFX();
  });
  addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space') keys[' '] = true;
    onKey(e.key.toLowerCase());
    initAudio();
  });
  addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === 'Space') keys[' '] = false;
  });
  // click / press-and-hold = throttle (left button = gas, right button = brake).
  addEventListener('pointerdown', e => {
    const firstGesture = !audio.ctx;
    initAudio();                                              // any gesture unlocks WebAudio
    if (firstGesture && state === 'menu') {
      startMusic({ id: 'menu' });  // menu soundtrack from the first tap
      const np = document.getElementById('nowPlaying');
      if (np) np.style.display = 'flex';
    }
    if (e.target.closest && e.target.closest('button, a, input, select, textarea')) return;  // UI: don't rev
    if (e.button === 0) mouseThrottle = true;
    else if (e.button === 2) mouseBrake = true;
  });
  addEventListener('pointerup', e => {
    if (e.button === 0 || !(e.buttons & 1)) mouseThrottle = false;
    if (e.button === 2 || !(e.buttons & 2)) mouseBrake = false;
  });
  addEventListener('pointercancel', () => { mouseThrottle = mouseBrake = false; });
  // clear held state on focus loss (mouse + keyboard) so nothing sticks on
  const clearHeld = () => { mouseThrottle = mouseBrake = false; for (const k in keys) keys[k] = false; };
  addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeld(); });
  addEventListener('contextmenu', e => { if (state === 'race' || state === 'tt') e.preventDefault(); });
  updateInvertBtn();
  document.body.dataset.screens = SCREENS.count;
  initPedals();                                 // reconnect previously-paired WebHID gas/brake pedals
  startAccountFlow(() => buildMenu());
  requestAnimationFrame(loop);
}

function onKey(k) {
  if (k === 'p') { togglePerfHud(); return; }
  if (k === 'escape') {
    if (state === 'race' || state === 'tt' || state === 'countdown' || state === 'freeroam') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (mode === 'stage' && k === 'r' && (state === 'race' || state === 'results')) {
    startGame(track.def, 'stage');                   // rally rules: R restarts the whole run
    return;
  }
  if (state !== 'race' && state !== 'tt') return;
  if (k === 'r') resetCar(player);
  if (k === 'c') { camMode = (camMode + 1) % 3; toast('Camera: ' + CAM_NAMES[camMode]); }
  if (k === 'm') { muted = !muted; if (audio.master) audio.master.gain.value = muted ? 0 : 0.5; toast(muted ? 'Muted' : 'Sound on'); }
}

// Steering input: keyboard (A/D) plus the paired phone wheel (gyroSteer, -1..1).
function playerSteer() {
  let s = ((keys['a'] || keys['arrowleft']) ? 1 : 0) + ((keys['d'] || keys['arrowright']) ? -1 : 0);
  if (phoneConnected) s += gyroSteer;
  if (window.TOUCH) s += TOUCH.steer;               // on-device wheel / tilt (touch.js)
  s = THREE.MathUtils.clamp(s, -1, 1);
  return steerInvert ? -s : s;
}

// ---------------------------------------------------------------- menu / ui
const $ = id => document.getElementById(id);

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.style.opacity = '1';
  toastT = 1.2;
}

// One-tap play: straight into Smashkart (the main mode) with a full grid.
window.startQuick = () => startGame(TRACKS.find(t => t.mode === 'SMASHKART') || TRACKS[0], 'race');

function buildMenu() {
  const grid = $('trackGrid');
  grid.innerHTML = '';
  for (const def of TRACKS) {
    const card = document.createElement('div');
    card.className = 'card';
    const cv = document.createElement('canvas');
    cv.width = 180; cv.height = 110;
    drawTrackThumb(cv, def);
    let bestLine, btns;
    if (def.stage) {
      const sb = stageBest(def.id);
      bestLine = sb ? 'Stage record: ' + fmtTime(sb.time) : 'No stage record yet';
      btns = '<button data-mode="stage">Run Stage</button>';
    } else {
      const best = localStorage.getItem('apex_best_' + def.id);
      bestLine = best ? 'Best lap: ' + fmtTime(+best) : 'No best lap yet';
      btns = '<button data-mode="race">Race</button><button data-mode="tt">Time Trial</button>';
    }
    card.appendChild(cv);
    card.insertAdjacentHTML('beforeend',
      `${def.mode ? `<div class="cardMode m-${def.mode.toLowerCase()}">${def.mode}</div>` : ''}
       <div class="cardName">${def.name}</div>
       <div class="cardDesc">${def.desc}</div>
       <div class="cardBest">${bestLine}</div>
       <div class="cardBtns">${btns}</div>`);
    card.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => startGame(def, b.dataset.mode)));
    grid.appendChild(card);
  }
  $('menu').style.display = 'flex';
  $('acctChip').style.display = 'flex';
  updateHardBtn();
  if (typeof updateAccountChip === 'function') updateAccountChip();
}

function updateHardBtn() {
  const b = $('hardBtn');
  if (!b) return;
  b.textContent = 'Difficulty: ' + (hardMode ? 'Hard' : 'Normal');
  b.classList.toggle('hard', hardMode);
}
window.toggleHard = () => {
  hardMode = !hardMode;
  localStorage.setItem('apex_hard', hardMode ? '1' : '0');
  updateHardBtn();
  toast(hardMode ? 'Hard mode — it comes at you fast' : 'Normal mode');
};

// ---------------------------------------------------------------- settings modal
function buildSettings() {
  // ---- garage: chassis / paint / wheels / decals (carfactory.js KIT) ----
  const cg = $('chassisGrid');
  if (cg) {
    cg.innerHTML = '';
    for (const cId of CHASSIS) {
      const b = document.createElement('button');
      b.className = 'vehBtn' + (cId === KIT.chassis ? ' sel' : '');
      b.textContent = CHASSIS_LABELS[cId];
      b.onclick = () => { KIT.chassis = cId; saveKit(); buildSettings(); refreshKitPreview(); };
      cg.appendChild(b);
    }
    const pr = $('paintRow');
    pr.innerHTML = '';
    PAINTS.forEach((hex, i) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (i === KIT.paint ? ' sel' : '');
      b.style.background = '#' + hex.toString(16).padStart(6, '0');
      b.onclick = () => { KIT.paint = i; saveKit(); buildSettings(); refreshKitPreview(); };
      pr.appendChild(b);
    });
    const wr = $('wheelRow');
    wr.innerHTML = '';
    for (const w of WHEEL_STYLES) {
      const b = document.createElement('button');
      b.className = w === KIT.wheels ? 'sel' : '';
      b.textContent = WHEEL_LABELS[w];
      b.onclick = () => { KIT.wheels = w; saveKit(); buildSettings(); refreshKitPreview(); };
      wr.appendChild(b);
    }
    const dr = $('decalRow');
    dr.innerHTML = '';
    for (const d of DECALS) {
      const b = document.createElement('button');
      b.className = d === KIT.decal ? 'sel' : '';
      b.textContent = DECAL_LABELS[d];
      b.onclick = () => { KIT.decal = d; saveKit(); buildSettings(); refreshKitPreview(); };
      dr.appendChild(b);
    }
  }
  // brake mode
  document.querySelectorAll('#brakeRow button').forEach(b => {
    b.classList.toggle('sel', b.dataset.brake === brakeMode);
    b.onclick = () => {
      brakeMode = b.dataset.brake; localStorage.setItem('apex_brakeMode', brakeMode);
      document.querySelectorAll('#brakeRow button').forEach(x => x.classList.toggle('sel', x === b));
      if (typeof sendBrakeConfig === 'function') sendBrakeConfig();   // tell the phone
    };
  });
  const noHid = !('hid' in navigator);
  const gs = $('gasStatus'), bs = $('brakeStatus');
  if (gs) gs.textContent = hidGasDev ? '✓ gas pedal paired' : (noHid ? 'needs Chrome/Edge' : '');
  if (bs) bs.textContent = hidBrakeDev ? '✓ brake pedal paired' : (noHid ? 'needs Chrome/Edge' : '');

  // graphics quality
  document.querySelectorAll('#qualityRow button').forEach(b => {
    b.classList.toggle('sel', b.dataset.q === POSTFX.quality);
    b.onclick = () => { setQuality(b.dataset.q); buildSettings(); toast('Quality: ' + b.textContent); };
  });
  // motion blur strength
  const bl = $('blurSlider');
  if (bl) {
    bl.value = Math.round(POSTFX.motionBlur * 100);
    $('blurVal').textContent = bl.value + '%';
    bl.oninput = () => {
      POSTFX.motionBlur = bl.value / 100;
      localStorage.setItem('apex_motionBlur', POSTFX.motionBlur);
      $('blurVal').textContent = bl.value + '%';
    };
  }
  // multi-screen rig controls
  document.querySelectorAll('#screenRow button').forEach(b => {
    b.classList.toggle('sel', +b.dataset.scr === SCREENS.count);
    b.onclick = () => { setScreens({ count: +b.dataset.scr }); buildSettings(); toast('Screens: ' + b.dataset.scr); };
  });
  const bz = $('bezelSlider');
  if (bz) {
    bz.value = SCREENS.bezelDeg;
    $('bezelVal').textContent = SCREENS.bezelDeg + '\u00b0';
    bz.oninput = () => { setScreens({ bezelDeg: +bz.value }); $('bezelVal').textContent = bz.value + '\u00b0'; };
  }
  const sw = $('swapSideBtn');
  if (sw) { sw.classList.toggle('sel', SCREENS.swapSide); sw.onclick = () => { setScreens({ swapSide: !SCREENS.swapSide }); buildSettings(); }; }
  const fb = $('frameBtn');
  if (fb) { fb.classList.toggle('sel', SCREENS.frame); fb.onclick = () => { setScreens({ frame: !SCREENS.frame }); buildSettings(); }; }
  wireWeatherRows('wModeRow', 'wManualRow');
}

// Time-of-day picker (pause menu): presets steer daynight.js's clock offset.
function wireTODRow(id) {
  const row = $(id);
  if (!row) return;
  const cur = localStorage.getItem('vc_tod') || 'real';
  row.querySelectorAll('button').forEach(b => {
    b.classList.toggle('sel', b.dataset.tod === cur);
    b.onclick = () => { dnSetTOD(b.dataset.tod); wireTODRow(id); toast('Time: ' + b.textContent.trim()); };
  });
}

// Weather pickers (Settings + Pause share the same markup contract).
function wireWeatherRows(modeId, manId) {
  const modeRow = $(modeId), manRow = $(manId);
  if (!modeRow) return;
  modeRow.querySelectorAll('button').forEach(b => {
    b.classList.toggle('sel', b.dataset.wmode === WEATHER.mode);
    b.onclick = () => { wSetMode(b.dataset.wmode); wireWeatherRows(modeId, manId); toast('Weather: ' + b.textContent.trim()); };
  });
  if (manRow) {
    manRow.style.display = WEATHER.mode === 'manual' ? 'flex' : 'none';
    manRow.querySelectorAll('button').forEach(b => {
      b.classList.toggle('sel', b.dataset.wman === WEATHER.manual);
      b.onclick = () => { wSetMode('manual', b.dataset.wman); wireWeatherRows(modeId, manId); };
    });
  }
}
// ---------------------------------------------------------------- garage live preview
// A private turntable renderer inside the settings modal: the CURRENT kit rotating under
// studio lighting, updating instantly as chassis/paint/wheels/decals change.
const PREV = { r: null, scene: null, cam: null, spin: null, mesh: null, on: false, last: 0 };
function initKitPreview() {
  if (PREV.r) return;
  const cv = $('kitPreview');
  if (!cv) return;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.85;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x14181f);
  // studio environment (this renderer needs its own PMREM)
  { const pm = new THREE.PMREMGenerator(r);
    const W = 64, Hh = 32, d = new Float32Array(W * Hh * 4);
    for (let y2 = 0; y2 < Hh; y2++) for (let x2 = 0; x2 < W; x2++) {
      const sy = Math.sin(((1 - (y2 + 0.5) / Hh) - 0.5) * Math.PI);
      let l = sy > 0 ? 0.42 + sy * 0.6 : 0.14 + 0.16 * (1 + sy);
      if (x2 > 8 && x2 < 20 && y2 < 7) l = 3.0;                    // softbox key
      if (x2 > 40 && x2 < 50 && y2 < 9) l = 1.4;                   // fill
      const i2 = (y2 * W + x2) * 4; d[i2] = l; d[i2 + 1] = l; d[i2 + 2] = l * 1.06; d[i2 + 3] = 1;
    }
    const t = new THREE.DataTexture(d, W, Hh, THREE.RGBAFormat, THREE.FloatType);
    t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
    sc.environment = pm.fromEquirectangular(t).texture;
  }
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(4, 6, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sc.add(sun, new THREE.HemisphereLight(0xcfe0f2, 0x22262e, 0.5));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 44),
    new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.35, metalness: 0.4, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 48),
    new THREE.MeshBasicMaterial({ color: 0x2e6bff, transparent: true, opacity: 0.5 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; sc.add(ring);
  const spin = new THREE.Group(); sc.add(spin);
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 60);
  cam.position.set(0, 2.4, 8.8); cam.lookAt(0, 0.8, 0);
  Object.assign(PREV, { r, scene: sc, cam, spin });
}
function refreshKitPreview() {
  initKitPreview();
  if (!PREV.r) return;
  const cv = $('kitPreview');
  const w = cv.clientWidth || 380;
  PREV.r.setSize(w, Math.round(w * 0.56), false);
  PREV.cam.aspect = w / (w * 0.56); PREV.cam.updateProjectionMatrix();
  if (PREV.mesh) PREV.spin.remove(PREV.mesh);
  PREV.mesh = buildKitMesh(KIT, HELMET_COLORS[0], 7);
  PREV.mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
  PREV.spin.add(PREV.mesh);
}
function kitPreviewLoop(ts) {
  if (!PREV.on) return;
  requestAnimationFrame(kitPreviewLoop);
  const dt = Math.min((ts - PREV.last) / 1000 || 0.016, 0.05);
  PREV.last = ts;
  PREV.spin.rotation.y += dt * 0.55;
  PREV.r.render(PREV.scene, PREV.cam);
}
window.openSettings = () => {
  $('settingsModal').style.display = 'flex';
  buildSettings();
};
window.closeSettings = () => { $('settingsModal').style.display = 'none'; };
// The Garage — first-class screen (Enginos showroom). Same KIT wiring, its own modal.
window.openGarage = () => {
  $('garageModal').style.display = 'flex';
  buildSettings();
  refreshKitPreview();
  if (window.ECON && ECON.garageUI) ECON.garageUI();   // doors → livery → builder
  if (!PREV.on && PREV.r) { PREV.on = true; PREV.last = 0; requestAnimationFrame(kitPreviewLoop); }
};
window.closeGarage = () => { $('garageModal').style.display = 'none'; PREV.on = false; };

// ---------------------------------------------------------------- WebHID pedals (gas + brake)
function hidSig(d) { return `${d.vendorId}:${d.productId}:${d.productName || ''}`; }
async function connectHid(dev, which) {
  try {
    if (!dev.opened) await dev.open();
    if (which === 'gas') hidGasDev = dev; else hidBrakeDev = dev;
    // IMPORTANT: mice stream reports continuously even when idle, so we can't treat "a report
    // arrived" as "being pushed" (that never stops -> infinite throttle). Instead look at the
    // report CONTENT: a button held (byte0 low bits) OR real movement (any later byte nonzero).
    // Idle/zero reports do NOT count, so lifting off makes the content go quiet -> pedal releases.
    dev.oninputreport = (e) => {
      const d = e.data;
      let active = (d.byteLength ? d.getUint8(0) : 0) & 0x07;   // left|right|middle button held
      for (let i = 1; !active && i < d.byteLength; i++) if (d.getUint8(i) !== 0) active = 1;  // any movement/scroll
      if (active) { const t = performance.now(); if (which === 'gas') hidGasLast = t; else hidBrakeLast = t; }
      // live monitor (only while Settings is open) so we can see the raw report
      const mon = document.getElementById('pedalMon');
      if (mon && $('settingsModal').style.display === 'flex') {
        const bytes = []; for (let i = 0; i < Math.min(d.byteLength, 6); i++) bytes.push(d.getUint8(i).toString(16).padStart(2, '0'));
        mon._n = (mon._n || 0) + 1;
        mon.textContent = `${which}: rid=${e.reportId} bytes=[${bytes.join(' ')}] active=${active ? 1 : 0} reports=${mon._n}`;
      }
    };
    return true;
  } catch (e) { return false; }
}
async function pairHid(which) {
  if (!('hid' in navigator)) { toast('WebHID needs Chrome or Edge'); return; }
  try {
    const devs = await navigator.hid.requestDevice({ filters: [] });
    if (!devs || !devs.length) return;
    const ok = await connectHid(devs[0], which);
    if (ok) {
      localStorage.setItem(which === 'gas' ? 'apex_hidGas' : 'apex_hidBrake', hidSig(devs[0]));
      toast((which === 'gas' ? 'Gas' : 'Brake') + ' pedal paired ✓');
    } else toast('Could not read that device');
    buildSettings();
  } catch (e) { toast('Pairing cancelled'); }
}
window.pairPedal = () => pairHid('gas');
window.pairBrake = () => pairHid('brake');
async function initPedals() {
  if (!('hid' in navigator)) return;
  try {
    const devs = await navigator.hid.getDevices();
    if (!devs || !devs.length) return;
    const gasSig = localStorage.getItem('apex_hidGas');
    const brakeSig = localStorage.getItem('apex_hidBrake');
    const used = new Set();
    // match remembered device signatures; two identical mice just take first-available
    for (const d of devs) {
      if (gasSig && !hidGasDev && hidSig(d) === gasSig && !used.has(d)) { await connectHid(d, 'gas'); used.add(d); }
      else if (brakeSig && !hidBrakeDev && hidSig(d) === brakeSig && !used.has(d)) { await connectHid(d, 'brake'); used.add(d); }
    }
  } catch (e) {}
}

function drawTrackThumb(cv, def, color = '#e8e4da') {
  const ctx = cv.getContext('2d');
  const pts = def.points;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
  }
  const pad = 12;
  const s = Math.min((cv.width - pad * 2) / (maxX - minX), (cv.height - pad * 2) / (maxZ - minZ));
  const ox = (cv.width - (maxX - minX) * s) / 2 - minX * s;
  const oz = (cv.height - (maxZ - minZ) * s) / 2 - minZ * s;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const closed = !def.stage;
  const P = i => pts[closed ? (i + pts.length) % pts.length : Math.min(i, pts.length - 1)];
  ctx.moveTo(P(0)[0] * s + ox, P(0)[1] * s + oz);
  const segs = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = P(i), b = P(i + 1);
    const mx = (a[0] + b[0]) / 2 * s + ox, mz = (a[1] + b[1]) / 2 * s + oz;
    ctx.quadraticCurveTo(a[0] * s + ox, a[1] * s + oz, mx, mz);
  }
  if (closed) ctx.closePath();
  else ctx.lineTo(P(pts.length - 1)[0] * s + ox, P(pts.length - 1)[1] * s + oz);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(P(0)[0] * s + ox, P(0)[1] * s + oz, 3.4, 0, 7);
  ctx.fill();
  return { s, ox, oz };
}

function fmtTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.---';
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, t = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(t).padStart(3, '0')}`;
}

function pauseGame() {
  pausedFrom = state; state = 'paused'; MUSIC.playing = false;
  $('pause').style.display = 'flex';
  wireWeatherRows('pauseWMode', 'pauseWManual');
  wireTODRow('pauseTOD');
}
function resumeGame() {
  state = pausedFrom; $('pause').style.display = 'none'; clock.getDelta();
  if (audio.ctx && MUSIC.song && (state === 'race' || state === 'tt' || state === 'countdown' || state === 'freeroam')) { MUSIC.playing = true; MUSIC.nextT = audio.ctx.currentTime + 0.1; }
}

// ---------------------------------------------------------------- procedural PBR textures
// Sobel a grayscale height canvas into a tangent-space normal map.
function canvasTex(cv, { srgb = false, wrapX = THREE.RepeatWrapping, wrapY = THREE.RepeatWrapping } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = wrapX; t.wrapT = wrapY;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// (photo-texture pipeline deleted — Toon 2.0 paints everything)

// Toon 2.0 road: flat palette asphalt with markings drawn IN-SHADER from the strip UVs
// (u = 0..1 across the road, v = metres/16 along it). Crisp at any distance, zero textures.
const ROAD_FRAG = `
{
  float uw = vUv.x;
  float aa = fwidth(uw) * 1.5 + 1e-4;
  vec3 rc = roadCol;
  float vband = step(0.5, fract(sin(floor(vUv.y * 2.0) + 3.7) * 437.585));   // subtle patch bands
  rc *= mix(1.0, 0.955, vband);
  float wear = smoothstep(0.14, 0.20, uw) * (1.0 - smoothstep(0.30, 0.36, uw))
             + smoothstep(0.64, 0.70, uw) * (1.0 - smoothstep(0.80, 0.86, uw));
  rc *= mix(1.0, 0.90, wear);                                                // tyre-worn lanes
  float lm = 0.0;
  #ifdef ROAD_CIRCUIT
    lm += 1.0 - smoothstep(0.009, 0.009 + aa, abs(uw - 0.035));
    lm += 1.0 - smoothstep(0.009, 0.009 + aa, abs(uw - 0.965));
  #endif
  #ifdef ROAD_PUBLIC
    lm += 1.0 - smoothstep(0.007, 0.007 + aa, abs(uw - 0.04));
    lm += 1.0 - smoothstep(0.007, 0.007 + aa, abs(uw - 0.96));
    float dashOn = step(fract(vUv.y * 16.0 / 12.0), 0.25);                   // 3m paint / 9m gap
    float cm = (1.0 - smoothstep(0.008, 0.008 + aa, abs(uw - 0.5))) * dashOn;
    rc = mix(rc, centerCol, cm);
  #endif
  rc = mix(rc, markCol, clamp(lm, 0.0, 1.0));
  rc *= 1.0 - wetK * 0.30;
  diffuseColor.rgb = rc;
}`;
const DIRT_ROAD_COL = new THREE.Color(0x8f7450);
function toonRoadMat(kind) {
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp(), side: THREE.DoubleSide });
  mat.defines = { USE_UV: '' };
  if (kind === 'circuit') mat.defines.ROAD_CIRCUIT = '';
  if (kind === 'public') mat.defines.ROAD_PUBLIC = '';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.roadCol = { value: kind === 'dirt' ? DIRT_ROAD_COL : PAL.road };
    shader.uniforms.markCol = { value: PAL.marking };
    shader.uniforms.centerCol = { value: new THREE.Color(0xcea63a) };
    shader.uniforms.wetK = { value: 0 };
    mat.userData.shader = shader;                       // weather drives wetK (phase 6)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 roadCol;\nuniform vec3 markCol;\nuniform vec3 centerCol;\nuniform float wetK;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + ROAD_FRAG);
  };
  return mat;
}

// value-noise painter shared by the texture generators
function paintNoise(x, w, h, base, grainCols, n, sizeMin, sizeMax) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    x.fillStyle = grainCols[Math.floor(Math.random() * grainCols.length)];
    const s = sizeMin + Math.random() * (sizeMax - sizeMin);
    x.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
// ---------------------------------------------------------------- track build
function disposeScene() {
  if (!scene) return;
  scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !o.userData.isOutline) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose && m.dispose());
  });
}

function buildTrack(def) {
  disposeScene();
  scene = new THREE.Scene();
  const env = ENVS[def.env];
  scene.background = PAL.skyHorizon.clone();   // dnUpdate keeps it synced
  dnInit(scene, { fog: env.fog });          // real-clock sun, sky, moon/stars, env lighting, fog
  wInitScene(scene);                        // rain particles + fresh wet-material registry

  // centerline samples — 'centripetal' (not uniform 'catmullrom') so unevenly-spaced
  // control points (long straight -> tight corner) can't overshoot into loops/cusps.
  const isStage = !!def.stage;                     // rally stage: open point-to-point curve
  const curvePts = def.points.map(p => new THREE.Vector3(p[0], p[2] || 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(curvePts, !isStage, 'centripetal');
  const raw = curve.getSpacedPoints(N_SAMPLES);
  if (!isStage) raw.pop();
  const N = raw.length;
  // index wrap: closed loops wrap around; open stages clamp at the start/finish beams
  const IW = isStage ? (i) => Math.max(0, Math.min(N - 1, i)) : (i) => ((i % N) + N) % N;
  const samples = [], tangents = [], rights = [];
  for (let i = 0; i < N; i++) {
    const j = (isStage && i === N - 1) ? N - 2 : i;     // last stage tangent reuses the previous pair
    const p = raw[j], q = raw[isStage ? j + 1 : (i + 1) % N];
    const t = tmpV.copy(q).sub(p); t.y = 0; t.normalize();
    samples.push(raw[i].clone());
    tangents.push(t.clone());
    rights.push(new THREE.Vector3(t.z, 0, -t.x));
  }
  const ds = curve.getLength() / N;

  // elevation: sample the land along the centerline, then GRADE it like a real road —
  // heavy low-pass so the tarmac rolls over the big hills but never inherits their
  // wiggles. Where road and land disagree, the corridor stamp cuts/fills and the berms
  // show the earthworks. (Control-point y — bridges, jumps — is preserved and added to.)
  {
    const amb = new Float32Array(N);
    for (let i = 0; i < N; i++) amb[i] = ambientHills(samples[i].x, samples[i].z, def.hills || 0);
    const W = Math.max(2, Math.round(120 / ds));            // ~120 m half-window, 3 passes
    const tmp2 = new Float32Array(N);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) {
        let s = 0, n = 0;
        for (let j = -W; j <= W; j++) {
          const k = isStage ? Math.min(N - 1, Math.max(0, i + j)) : IW(i + j);
          s += amb[k]; n++;
        }
        tmp2[i] = s / n;
      }
      amb.set(tmp2);
    }
    for (let i = 0; i < N; i++) samples[i].y += amb[i];
  }

  // signed curvature (turn direction) + magnitude
  const kSigned = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = tangents[IW(i - 4)], b = tangents[IW(i + 4)];
    const cross = a.z * b.x - a.x * b.z;            // (a × b).y
    const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    kSigned[i] = Math.sign(cross) * ang / (8 * ds);
  }
  const kappa = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = -6; j <= 6; j++) s += Math.abs(kSigned[IW(i + j)]);
    kappa[i] = s / 13;
  }

  // banking: corners tilt inward (cross-slope), smoothed so it eases in and out
  const bank = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = -18; j <= 18; j++) s += kSigned[IW(i + j)];
    bank[i] = THREE.MathUtils.clamp(-(s / 37) * BANK_GAIN, -BANK_MAX, BANK_MAX);
  }
  // ---- track painted INTO the terrain: stamp the road corridor into a heightfield ----
  // (the city's burn approach, generalized). The field is the single ground truth: the
  // terrain mesh, the road ribbon, physics and props all read it, so seams are impossible.
  let fMinX = 1e9, fMaxX = -1e9, fMinZ = 1e9, fMaxZ = -1e9;
  for (const p of samples) {
    fMinX = Math.min(fMinX, p.x); fMaxX = Math.max(fMaxX, p.x);
    fMinZ = Math.min(fMinZ, p.z); fMaxZ = Math.max(fMaxZ, p.z);
  }
  const FPAD = 250;
  const fx0 = fMinX - FPAD, fz0 = fMinZ - FPAD;
  const fSpan = Math.max(fMaxX - fMinX, fMaxZ - fMinZ) + FPAD * 2;
  const fTex = THREE.MathUtils.clamp(fSpan / 1024, 1.5, 4.5);          // metres per texel
  const fCols = Math.ceil((fMaxX - fMinX + FPAD * 2) / fTex) + 1;
  const fRows = Math.ceil((fMaxZ - fMinZ + FPAD * 2) / fTex) + 1;
  const fData = new Float32Array(fCols * fRows);
  const fW = new Float32Array(fCols * fRows);                          // stamp weight (max-blend)
  const fD = new Float32Array(fCols * fRows);                          // claiming sample's distance
  const fIdx = new Int32Array(fCols * fRows);                          // claiming sample's index
  const halfWd = def.width / 2;
  const flatR = halfWd + 4, fallR = halfWd + 60;                       // flat core -> berm falloff
  let seaApply = null, seaInfo = null;
  // The whole field build is a function because it must run TWICE: the spine's
  // field-agreement correction (below) MOVES the road after the first stamp, and a
  // field stamped from the old spine leaves the ribbon floating over — or buried
  // inside — the terrain (real bug: road hovering with nothing under it, hills
  // poking through the tarmac). Re-stamping from the corrected spine restores the weld.
  const buildField = () => {
  seaApply = null; seaInfo = null;
  fW.fill(0); fD.fill(1e9); fIdx.fill(-1000000);
  for (let r = 0; r < fRows; r++)
    for (let c = 0; c < fCols; c++)
      fData[r * fCols + c] = ambientHills(fx0 + c * fTex, fz0 + r * fTex, def.hills || 0);
  for (let i = 0; i < N; i++) {
    const sp = samples[i], rt2 = rights[i], bk = bank[i];
    const c0 = Math.max(0, Math.floor((sp.x - fallR - fx0) / fTex));
    const c1 = Math.min(fCols - 1, Math.ceil((sp.x + fallR - fx0) / fTex));
    const r0 = Math.max(0, Math.floor((sp.z - fallR - fz0) / fTex));
    const r1 = Math.min(fRows - 1, Math.ceil((sp.z + fallR - fz0) / fTex));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const wx = fx0 + c * fTex, wz = fz0 + r * fTex;
        const ox = wx - sp.x, oz = wz - sp.z;
        const d = Math.hypot(ox, oz);
        if (d > fallR) continue;
        const lat = ox * rt2.x + oz * rt2.z;                          // signed lateral offset
        // banking stamped in as corridor cross-slope, held constant past the core (berm read)
        const yTarget = sp.y + THREE.MathUtils.clamp(lat, -(halfWd + 8), halfWd + 8) * bk;
        const t = d <= flatR ? 1 : 1 - THREE.MathUtils.smoothstep(d, flatR, fallR);
        const k = r * fCols + c;
        // weight-max blend, with the UNDERPASS RULE: where two track sections overlap
        // (figure-8 crossings), the LOWER one owns the ground — the higher one bridges it.
        // "Overlap" means CORE over CORE (d <= flatR both times) — a section's berm
        // falloff reaches ~30m past its edge with t≈0.9, and letting THAT claim ownership
        // bulldozed the ground out from under any nearby parallel road (5m floating edges).
        // Within the SAME stretch of road (hairpins overlapping their own corridor),
        // the CLOSEST sample owns the dirt — matching the physics, which rides the
        // nearest sample. First-claim-wins left hairpin exits floating 2.4m in the air.
        const prevI = fIdx[k];
        const di = prevI < -900000 ? 1e9 : Math.min(Math.abs(i - prevI), N - Math.abs(i - prevI));
        const near = di < 70;
        const claimed = fW[k] >= 0.999;
        if (claimed && d <= flatR && !near) {
          // core-over-core from a DIFFERENT stretch: true crossing — the lower road owns
          // the ground, the higher one bridges it
          if (yTarget < fData[k] - 2) { fData[k] = yTarget; fD[k] = d; fIdx[k] = i; }
        } else if (near ? d < fD[k] : t > fW[k]) {
          fData[k] = fData[k] * (1 - t) + yTarget * t;
          fW[k] = Math.max(fW[k], t);
          fD[k] = d; fIdx[k] = i;
        }
      }
  }
  // ---- seaside tracks (def.sea): carve the ocean into the same field the roads are
  // stamped into. The carve is scaled by (1 - road stamp weight) so the racing surface
  // and its berms can never be eaten; the beach is simply where the carved ground crosses
  // the waterline. An optional island bump pokes back up for the lighthouse.
  if (def.sea) {
    const dl = Math.hypot(def.sea.dir[0], def.sea.dir[1]);
    const sdx = def.sea.dir[0] / dl, sdz = def.sea.dir[1] / dl;
    const dotOf = (x, z) => x * sdx + z * sdz;
    let loY = 1e9;                                       // water level from the lowest seaside sample
    for (const p of samples) if (dotOf(p.x, p.z) > def.sea.shore - 260) loY = Math.min(loY, p.y);
    if (loY === 1e9) loY = 0;
    const WL = loY - 3.2, FLOOR = WL - 5.5;
    const wob = (x, z) => Math.sin(x * 0.0131 + z * 0.0072) * 15 + Math.sin(x * 0.0042 - z * 0.0093) * 27;
    const seaK = (x, z) => THREE.MathUtils.smoothstep(dotOf(x, z) + wob(x, z), def.sea.shore, def.sea.shore + 150);
    const isl = def.sea.island;
    seaApply = (x, z, y, protect = 0) => {
      const k = seaK(x, z) * (1 - protect);
      if (k <= 0) return y;
      let ny = y * (1 - k) + FLOOR * k;
      if (isl) {
        const d = Math.hypot(x - isl[0], z - isl[1]);
        if (d < 52) ny = Math.max(ny, FLOOR + (WL + 6.5 - FLOOR) * (0.5 + 0.5 * Math.cos((d / 52) * Math.PI)));
      }
      return ny;
    };
    for (let r = 0; r < fRows; r++)
      for (let c = 0; c < fCols; c++) {
        const k = r * fCols + c;
        fData[k] = seaApply(fx0 + c * fTex, fz0 + r * fTex, fData[k], fW[k]);
      }
    seaInfo = { level: WL, floor: FLOOR, dirX: sdx, dirZ: sdz, shore: def.sea.shore, k: seaK, dotOf, island: isl };
  }
  };                                                                   // end buildField
  buildField();
  const fieldAt = (x, z) => {
    const gx = (x - fx0) / fTex, gz = (z - fz0) / fTex;
    if (gx < 0 || gz < 0 || gx > fCols - 1 || gz > fRows - 1) {
      const amb = ambientHills(x, z, def.hills || 0);
      return seaApply ? seaApply(x, z, amb) : amb;       // the ocean continues to the horizon
    }
    const c = Math.min(fCols - 2, Math.floor(gx)), r = Math.min(fRows - 2, Math.floor(gz));
    const tx = gx - c, tz = gz - r;
    const a = fData[r * fCols + c], b = fData[r * fCols + c + 1];
    const c2 = fData[(r + 1) * fCols + c], d2 = fData[(r + 1) * fCols + c + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c2 * (1 - tx) + d2 * tx) * tz;
  };
  // re-read the centerline FROM the field so ribbon, physics, tunnel and gantries all
  // agree with the stamped ground exactly — EXCEPT where the field diverges because a
  // lower section owns the ground there (figure-8 crossings): those samples are a bridge
  // and keep their own elevation.
  {
    // agree with the field where it's close, keep own height on bridges — but the
    // correction must be SMOOTH along the spine: hard thresholds and overlap-boundary
    // texel noise were popping single samples by a metre (invisible curbs at 120 mph)
    const corr = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const fy = fieldAt(samples[i].x, samples[i].z);
      const d = fy - samples[i].y, ad = Math.abs(d);
      corr[i] = ad < 0.75 ? d : ad < 2.5 ? d * (1 - (ad - 0.75) / 1.75) : 0;
    }
    const tmp3 = new Float32Array(N);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        let s = 0, n = 0;
        for (let j = -8; j <= 8; j++) {
          const k = isStage ? Math.min(N - 1, Math.max(0, i + j)) : IW(i + j);
          s += corr[k]; n++;
        }
        tmp3[i] = s / n;
      }
      corr.set(tmp3);
    }
    for (let i = 0; i < N; i++) samples[i].y += corr[i];
    buildField();     // re-stamp: the ground must match the road the cars actually ride
  }

  // longitudinal grade (for pitching the car nose up/down over crests and dips)
  const grade = new Float32Array(N);
  for (let i = 0; i < N; i++)
    grade[i] = (samples[IW(i + 3)].y - samples[IW(i - 3)].y) / (6 * ds);

  // spatial hash of the centerline: nearest distance + road height at any (x,z)
  const cellSize = 44, hash = new Map();
  for (let i = 0; i < N; i++) {
    const p = samples[i];
    const k = Math.floor(p.x / cellSize) + ',' + Math.floor(p.z / cellSize);
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k).push(i);
  }
  const nearestInfo = (x, z) => {
    let bestD = 1e9, bestI = 0;
    const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const arr = hash.get((cx + i) + ',' + (cz + j));
        if (arr) for (const s of arr) {
          const p = samples[s], d = Math.hypot(p.x - x, p.z - z);
          if (d < bestD) { bestD = d; bestI = s; }
        }
      }
    if (bestD > 1e8) {   // far cell miss: fall back to a coarse full scan
      for (let s = 0; s < N; s += 5) {
        const p = samples[s], d = Math.hypot(p.x - x, p.z - z);
        if (d < bestD) { bestD = d; bestI = s; }
      }
    }
    return { d: bestD, y: samples[bestI].y, i: bestI };
  };

  const halfW = def.width / 2;

  // racing line: hug the inside of corners, smoothed into entry/exit
  const kRef = 0.012, maxOff = halfW * 0.72;
  const rawOff = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // smooth signed curvature locally for a stable direction
    let s = 0;
    for (let j = -6; j <= 6; j++) s += kSigned[IW(i + j)];
    const ks = s / 13;
    rawOff[i] = THREE.MathUtils.clamp(ks / kRef, -1, 1) * maxOff;
  }
  const raceOffset = new Float32Array(N);
  const W = 45;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = -W; j <= W; j++) s += rawOff[IW(i + j)];
    raceOffset[i] = s / (2 * W + 1);
  }

  // AI speed profile along the racing line — uses the SAME limits the player's car has,
  // so the field can actually keep up. Straight-line cap = the player's terminal velocity;
  // corner speed accounts for downforce grip (solved by iteration).
  const surf = SURFACES[def.surface];
  const vTerminal = Math.sqrt(PHYS.engineAccel * paceMul * surf.accelMul / (PHYS.drag * surf.dragMul));
  const vmax = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const k = Math.max(kappa[i], 1e-4);
    let v = Math.sqrt(PHYS.aLatMax * PHYS.cornerUse * surf.grip / k);
    for (let it = 0; it < 2; it++) {
      const g = surf.grip * (1 + PHYS.downforce * Math.min(v / 40, 1.4));
      v = Math.sqrt(PHYS.aLatMax * PHYS.cornerUse * g / k);
    }
    vmax[i] = Math.min(vTerminal * 1.1, v);   // headroom so the fast tier's cap (up to ~200) can bind, not this
  }
  for (let pass = 0; pass < 3; pass++)
    for (let i = (isStage ? N - 2 : 2 * N - 1); i >= 0; i--) {
      const j = isStage ? i : i % N, k = isStage ? i + 1 : (i + 1) % N;
      vmax[j] = Math.min(vmax[j], Math.sqrt(vmax[k] * vmax[k] + 2 * 42 * surf.grip * ds));
    }

  track = { def, samples, tangents, rights, kappa, kSigned, bank, grade, raceOffset, vmax, N, ds, halfW,
            nearestInfo,
            stage: isStage,
            splitIdx: isStage ? [1, 2, 3].map(f => Math.round(N * f / 4)) : null,
            fieldAt, roadLift: 0.04, sea: seaInfo,
            distToTrack: (x, z) => nearestInfo(x, z).d,
            lapLen: curve.getLength(),
            outerLimit: def.walls ? halfW + 1.1 : (def.env === 'oval' ? halfW + 2.4 : halfW + 30) };

  buildRoadMeshes(def, env);
  buildEnvironment(def, env);
  buildMinimap(def);
  if (window.ITEMS) ITEMS.onRaceBuilt();    // Smashkart supply crates (items.js)
  if (window.DMG) DMG.reset();              // fresh sheet metal every race (damage.js)
  rebuildPostFX();                          // composer wraps the new scene
}

function stripGeometry(offA, offB, yOff, colorFn, uv) {
  const { samples, rights, bank, N, ds } = track;
  const pos = [], idx = [], col = [], uvs = [];
  const vScale = ds / 16;   // one texture tile ~16m along the road
  const M = track.stage ? N - 1 : N;   // open stages don't wrap the final quad back to the start
  const lift = track.roadLift || 0;
  for (let i = 0; i <= M; i++) {
    const j = i % N;
    const p = samples[j], r = rights[j], b = bank[j];
    // WELD to the stamped field: max(analytic, field) means no poke-through anywhere
    const xA = p.x + r.x * offA, zA = p.z + r.z * offA;
    const xB = p.x + r.x * offB, zB = p.z + r.z * offB;
    const yA = Math.max(p.y + offA * b, track.fieldAt ? track.fieldAt(xA, zA) : -1e9) + lift + yOff;
    const yB = Math.max(p.y + offB * b, track.fieldAt ? track.fieldAt(xB, zB) : -1e9) + lift + yOff;
    pos.push(xA, yA, zA, xB, yB, zB);
    if (colorFn) { const c = colorFn(j); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    if (uv) uvs.push(0, i * vScale, 1, i * vScale);
    if (i < M) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildRoadMeshes(def, env) {
  const { halfW, kappa, N, samples, tangents, rights, bank } = track;
  const isDirt = def.surface === 'dirt';

  const roadMat = toonRoadMat(isDirt ? 'dirt' : 'circuit');
  const road = new THREE.Mesh(stripGeometry(-halfW, halfW, 0.0, null, true), roadMat);
  road.receiveShadow = true;
  scene.add(road);
  wRegisterRoad(roadMat);                                    // gets dark + reflective in rain

  // dirt shoulder band — roads never touch pristine grass (the illustrated transition)
  const vergeMat = toonMat(isDirt ? 0x6b5138 : 0x8a765a, { side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(stripGeometry(-halfW - 2.2, -halfW, -0.015, null, false), vergeMat));
  scene.add(new THREE.Mesh(stripGeometry(halfW, halfW + 2.2, -0.015, null, false), vergeMat));

  // kerbs on curvy sections
  const red = new THREE.Color(0xd0342c), white = new THREE.Color(0xece8e0);
  const kerbTh = isDirt ? 999 : 0.004;
  const kerbCol = j => (Math.floor(j / 4) % 2 ? red : white);
  const kerbMat = toonMat(0xffffff, { vertexColors: true });
  const NE = track.stage ? N - 1 : N;   // stages: no wrap past the finish
  let i = 0;
  while (i < NE) {
    if (kappa[i] > kerbTh) {
      let j = i;
      while (j < NE && kappa[j % N] > kerbTh * 0.6) j++;
      if (j - i > 8) {
        for (const side of [-1, 1]) {
          const pos = [], idx = [], col = [];
          for (let k = i; k <= j; k++) {
            const m = k % N;
            const p = samples[m], r = rights[m], b = bank[m];
            const o1 = side * halfW, o2 = side * (halfW + 1.6);
            const lift = track.roadLift || 0;
            const x1 = p.x + r.x * o1, z1 = p.z + r.z * o1;
            const x2 = p.x + r.x * o2, z2 = p.z + r.z * o2;
            pos.push(x1, Math.max(p.y + o1 * b, track.fieldAt(x1, z1)) + lift + 0.06, z1,
                     x2, Math.max(p.y + o2 * b, track.fieldAt(x2, z2)) + lift + 0.03, z2);
            const c = kerbCol(k);
            col.push(c.r, c.g, c.b, c.r, c.g, c.b);
            if (k < j) { const a = (k - i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
          g.setIndex(idx);
          g.computeVertexNormals();
          scene.add(new THREE.Mesh(g, kerbMat));
        }
      }
      i = j + 1;
    } else i++;
  }

  // start / finish checkered
  const p0 = samples[0], r0 = rights[0], t0 = tangents[0];
  const cell = (halfW * 2) / 10;
  const bMat = new THREE.MeshBasicMaterial({ color: 0x14171c });
  const wMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  for (let row = 0; row < 2; row++)
    for (let c = 0; c < 10; c++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), (row + c) % 2 ? bMat : wMat);
      q.rotation.x = -Math.PI / 2;
      const lat = -halfW + cell * (c + 0.5);
      q.position.set(p0.x + r0.x * lat + t0.x * cell * row, p0.y + 0.11,
                     p0.z + r0.z * lat + t0.z * cell * row);
      scene.add(q);
    }

  // gantry + start lights
  const gMat = toonMat(0x2b2e33);
  const gantry = new THREE.Group();
  for (const side of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), gMat);
    pil.position.set(r0.x * side * (halfW + 2), 4, r0.z * side * (halfW + 2));
    pil.castShadow = true;
    gantry.add(pil);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry((halfW + 2) * 2 + 1, 1.2, 1), gMat);
  beam.position.y = 7.6;
  beam.rotation.y = Math.atan2(r0.x, r0.z) + Math.PI / 2;
  gantry.add(beam);
  track.startLights = [];
  for (let li = 0; li < 3; li++) {
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
    const lat = (li - 1) * 2.2;
    lamp.position.set(r0.x * lat, 6.6, r0.z * lat);
    gantry.add(lamp);
    track.startLights.push(lampMat);
  }
  gantry.position.set(p0.x, p0.y, p0.z);
  addOutlines(gantry, 1.03);
  scene.add(gantry);

  // walls
  if (def.walls || def.env === 'oval') {
    const wallMat = toonMat(0xd2d7df);
    const off = def.walls ? halfW + 1.3 : halfW + 2.6;
    const mk = (o) => {
      const pos = [], idx = [];
      const MW = track.stage ? N - 1 : N;
      for (let k = 0; k <= MW; k++) {
        const m = k % N, p = samples[m], r = rights[m];
        const wx = p.x + r.x * o, wz = p.z + r.z * o;
        const yb = Math.max(p.y + o * bank[m], track.fieldAt(wx, wz)) + (track.roadLift || 0);
        pos.push(wx, yb, wz,
                 wx, yb + 1.1, wz);
        if (k < MW) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const wm = new THREE.Mesh(g, wallMat);
      wm.receiveShadow = true;
      scene.add(wm);
    };
    mk(off);
    if (def.walls) mk(-off);
  }

  if (def.id === 'suzuka') {
    const pm = toonMat(0x8d939c);
    for (const [px, pz] of [[-27, 13], [27, -13]]) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 6.6, 8), pm);
      pil.position.set(px, 3.3, pz);
      pil.castShadow = true;
      scene.add(pil);
    }
  }

  // mixed-surface zones: drape the zone's surface texture over the base road
  if (def.surfaceZones) {
    for (const [f0, f1] of def.surfaceZones) {
      const i0 = Math.round(f0 * N), i1 = Math.round(f1 * N);
      const zMat = toonRoadMat('dirt');
      const pos = [], idx = [], uvs = [];
      const vScale = track.ds / 16;
      for (let k = i0; k <= i1; k++) {
        const m = k % N, p = samples[m], r = rights[m], b = bank[m];
        const lift = (track.roadLift || 0) + 0.02;
        const xa = p.x - r.x * halfW, za = p.z - r.z * halfW;
        const xb = p.x + r.x * halfW, zb = p.z + r.z * halfW;
        pos.push(xa, Math.max(p.y - halfW * b, track.fieldAt(xa, za)) + lift, za,
                 xb, Math.max(p.y + halfW * b, track.fieldAt(xb, zb)) + lift, zb);
        uvs.push(0, k * vScale, 1, k * vScale);
        if (k < i1) { const a = (k - i0) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const zm = new THREE.Mesh(g, zMat);
      zm.receiveShadow = true;
      scene.add(zm);
    }
  }

  // tunnel: arched shell over a fraction range of the lap (Monte Carlo)
  if (def.tunnel) {
    const i0 = Math.round(def.tunnel[0] * N), i1 = Math.round(def.tunnel[1] * N);
    const A = 9, R = halfW + 2.4, H = 6.4;          // arc segments, half-span, apex height
    const pos = [], idx = [], step = 2, rows = [];
    for (let k = i0; k <= i1; k += step) rows.push(k % N);
    rows.forEach((m, ri) => {
      const p = samples[m], r = rights[m];
      for (let a = 0; a <= A; a++) {
        const ang = Math.PI * (a / A);              // half-ellipse: +R across to -R
        const lx = Math.cos(ang) * R, ly = Math.sin(ang) * H;
        pos.push(p.x + r.x * lx, p.y + ly, p.z + r.z * lx);
      }
      if (ri > 0) {
        const b0 = (ri - 1) * (A + 1), b1 = ri * (A + 1);
        for (let a = 0; a < A; a++)
          idx.push(b0 + a, b1 + a, b0 + a + 1, b1 + a, b1 + a + 1, b0 + a + 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const shell = new THREE.Mesh(g, toonMat(0x8d8678, { side: THREE.DoubleSide }));
    shell.castShadow = true;
    shell.receiveShadow = true;
    scene.add(shell);
    // sodium strip lights down the tunnel ceiling
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 2.6), lampMat, Math.ceil(rows.length / 3) + 1);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 0, 1);
    let li = 0;
    for (let ri = 0; ri < rows.length; ri += 3) {
      const m = rows[ri], p = samples[m];
      Q.setFromUnitVectors(UP, tangents[m]);
      M4.compose(new THREE.Vector3(p.x, p.y + H - 0.35, p.z), Q, S1);
      lamps.setMatrixAt(li++, M4);
    }
    lamps.count = li;
    lamps.instanceMatrix.needsUpdate = true;
    lamps.computeBoundingSphere();
    scene.add(lamps);
  }

  // rally-stage finish: checkered strip + arch at the last sample
  if (track.stage) {
    const fi = N - 2;
    const pe = samples[fi], re = rights[fi], te = tangents[fi];
    for (let row = 0; row < 2; row++)
      for (let c = 0; c < 10; c++) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), (row + c) % 2 ? bMat : wMat);
        q.rotation.x = -Math.PI / 2;
        const lat = -halfW + cell * (c + 0.5);
        q.position.set(pe.x + re.x * lat + te.x * cell * row, pe.y + 0.11,
                       pe.z + re.z * lat + te.z * cell * row);
        scene.add(q);
      }
    const fin = new THREE.Group();
    for (const side of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), gMat);
      pil.position.set(re.x * side * (halfW + 2), 4, re.z * side * (halfW + 2));
      pil.castShadow = true;
      fin.add(pil);
    }
    const fbeam = new THREE.Mesh(new THREE.BoxGeometry((halfW + 2) * 2 + 1, 1.2, 1), gMat);
    fbeam.position.y = 7.6;
    fbeam.rotation.y = Math.atan2(re.x, re.z) + Math.PI / 2;
    fin.add(fbeam);
    fin.position.set(pe.x, pe.y, pe.z);
    addOutlines(fin, 1.03);
    scene.add(fin);
  }
}

// Sky is fully owned by daynight.js (dnInit / dnUpdate); this stub keeps old call sites safe.
function addSky(env) {}

// Low-poly rolling terrain: a displaced grid, faceted, with grass-tone variation.
// One terrain grid patch: samples terrainHeight (= the stamped field), quantized painted
// vertex colors from the palette's 3-step ground ramp.
const SAND_RAMP = [new THREE.Color(0xecd9a4), new THREE.Color(0xe0cb8f),   // dry sand 2-tone
                   new THREE.Color(0xf6f1de),                              // foam line
                   new THREE.Color(0xb9a87d)];                             // wet seabed
const TP_DIRT = new THREE.Color(0x9a7448), TP_CLIFF = new THREE.Color(0x77604c);
const TP_TMP = new THREE.Color();
function terrainPatch(x0, x1, z0, z1, step, ramp, yDrop = 0) {
  const cols = Math.max(2, Math.round((x1 - x0) / step));
  const rows = Math.max(2, Math.round((z1 - z0) / step));
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, cols, rows);
  geo.rotateX(-Math.PI / 2);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const pos = geo.attributes.position;
  const col = [];
  const sea = track.sea;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + cx, wz = pos.getZ(i) + cz;
    const y = terrainHeight(wx, wz);
    pos.setY(i, y - yDrop);
    const n = 0.5 + 0.5 * Math.sin(wx * 0.021 + 1.3) * Math.cos(wz * 0.017 - 0.6)
            + 0.25 * Math.sin(wx * 0.11) * Math.sin(wz * 0.09)
            + THREE.MathUtils.clamp(y * 0.006, -0.2, 0.35);           // higher ground = lighter
    // seaside: paint the beach — dry sand above the waterline, a foam line at it,
    // wet seabed below (shows through the shallows)
    if (sea && y < sea.level + 2.4 && sea.k(wx, wz) > 0.02) {
      const c = y > sea.level + 0.3 ? SAND_RAMP[n > 0.55 ? 0 : 1]
        : y > sea.level - 0.4 ? SAND_RAMP[2]
        : SAND_RAMP[3];
      col.push(c.r, c.g, c.b);
      continue;
    }
    // Mario-Kart ground read: stepped elevation bands make big patches, steep ground
    // shows earth (berm cuts/fills paint themselves as earthworks, hillsides stay grass)
    const e = 4;
    const slope = Math.hypot(terrainHeight(wx + e, wz) - y, terrainHeight(wx, wz + e) - y) / e;
    const c = TP_TMP.copy(ramp[Math.min(2, Math.max(0, Math.floor(n * 2.2)))]);
    const band = ((Math.floor((y + 400) / 12) % 3) + 3) % 3;
    c.multiplyScalar(band === 0 ? 0.92 : band === 1 ? 1 : 1.1);
    if (slope > 0.55) c.copy(TP_CLIFF);
    else if (slope > 0.28) c.lerp(TP_DIRT, Math.min(1, (slope - 0.28) / 0.27) * 0.85);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, terrainPatch._mat || (terrainPatch._mat = toonMat(0xffffff, { vertexColors: true })));
  m.position.set(cx, 0, cz);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
// Chunked terrain: fine 6x6 chunks over the stamped field (so berms and the road corridor
// read exactly), coarse skirt strips out to the horizon pad. Chunks = culling works.
function buildTerrain(def, env, minX, maxX, minZ, maxZ) {
  terrainPatch._mat = null;                                           // fresh mat per scene
  const ramp = (PALETTES[def.env] || PALETTES.meadow).day.ground;
  const pad = 900;
  const ix0 = minX - 250, ix1 = maxX + 250, iz0 = minZ - 250, iz1 = maxZ + 250;
  const meshes = [];
  const CH = 6, fineStep = THREE.MathUtils.clamp(Math.max(ix1 - ix0, iz1 - iz0) / 380, 2.5, 7);
  for (let a = 0; a < CH; a++)
    for (let b = 0; b < CH; b++)
      meshes.push(terrainPatch(
        ix0 + (a / CH) * (ix1 - ix0), ix0 + ((a + 1) / CH) * (ix1 - ix0),
        iz0 + (b / CH) * (iz1 - iz0), iz0 + ((b + 1) / CH) * (iz1 - iz0),
        fineStep, ramp));
  // outer horizon ring: 4 coarse strips around the field (no overlap with the fine region)
  const ox0 = minX - pad, ox1 = maxX + pad, oz0 = minZ - pad, oz1 = maxZ + pad;
  meshes.push(terrainPatch(ox0, ox1, oz0, iz0, 24, ramp, 0.4));
  meshes.push(terrainPatch(ox0, ox1, iz1, oz1, 24, ramp, 0.4));
  meshes.push(terrainPatch(ox0, ix0, iz0, iz1, 24, ramp, 0.4));
  meshes.push(terrainPatch(ix1, ox1, iz0, iz1, 24, ramp, 0.4));
  meshes.forEach(m => wRegisterGround(m));            // whitens under real winter snow
  return meshes[0];
}

// ---------------------------------------------------------------- foliage v4
// Trees with REAL BRANCH STRUCTURE: tapered trunk -> primary limbs -> secondary twigs
// (bark-textured), with leaf-card clusters growing FROM the branch tips. Conifers get
// whorled drooping boughs down a tapered spar. Chunked instancing (wood + leaves = 2 draws
// per chunk-variant) keeps culling intact. Plus instanced grass tufts for ground cover.
let TREE_VARIANTS = null, FOL_MATS = null, TRUNK_MAT = null, TUFT_MAT = null, TUFT_GEO = null;
const _WHITE = new THREE.Color(0xffffff);
function _vhash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
// Toon 2.0 foliage textures — comic ink: flat 2-tone fills, every blob/bough/blade
// wears a drawn dark outline (the Wheel World / Hinterberg signature).
function leafClusterTex(kind) {
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  const INK = '#20301f';
  x.lineJoin = x.lineCap = 'round';
  if (kind === 'broad') {
    // scalloped cloud foliage: overlapping outlined blobs + a flat highlight lobe
    for (let cl = 0; cl < 5; cl++) {
      const cx = 52 + Math.random() * (S - 104), cy = 52 + Math.random() * (S - 104);
      const cr = 38 + Math.random() * 28;
      x.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.28 + Math.random() * 0.5;
        const lx = cx + Math.cos(a) * cr * 0.62, ly = cy + Math.sin(a) * cr * 0.62;
        const r2 = cr * (0.4 + Math.random() * 0.18);
        x.fillStyle = '#5da24c';
        x.strokeStyle = INK;
        x.beginPath(); x.arc(lx, ly, r2, 0, 6.28); x.fill(); x.stroke();
      }
      x.fillStyle = '#5da24c';                             // solid core over inner strokes
      x.beginPath(); x.arc(cx, cy, cr * 0.62, 0, 6.28); x.fill();
      x.fillStyle = '#8ecf6a';                             // flat sun-side highlight
      x.beginPath(); x.arc(cx - cr * 0.24, cy - cr * 0.3, cr * 0.46, 0, 6.28); x.fill();
    }
  } else if (kind === 'conif') {
    // drooping outlined boughs, 2-tone by row
    const rows = 6;
    for (let r2 = 0; r2 < rows; r2++) {
      const y0 = 16 + (r2 / rows) * (S - 58) + Math.random() * 8;
      const w0 = S * (0.26 + (r2 / rows) * 0.36);
      const cx = S / 2 + (Math.random() - 0.5) * 18;
      const drop = 30 + Math.random() * 8;
      x.fillStyle = r2 % 2 ? '#4a9457' : '#5fae66';
      x.strokeStyle = INK;
      x.lineWidth = 4.5;
      x.beginPath();
      x.moveTo(cx, y0);
      x.quadraticCurveTo(cx - w0 * 0.55, y0 + 6, cx - w0, y0 + drop);
      x.quadraticCurveTo(cx - w0 * 0.4, y0 + 22, cx, y0 + 15);
      x.quadraticCurveTo(cx + w0 * 0.4, y0 + 22, cx + w0, y0 + drop);
      x.quadraticCurveTo(cx + w0 * 0.55, y0 + 6, cx, y0);
      x.fill(); x.stroke();
    }
  } else {   // 'tuft' — grass blades, each with its own ink outline
    for (let b = 0; b < 30; b++) {
      const bx = 30 + Math.random() * (S - 60);
      const midX = bx + (Math.random() - 0.5) * 22;
      const tipX = bx + (Math.random() - 0.5) * 56, tipY = S * (0.10 + Math.random() * 0.28);
      const blade = (wl, col) => {
        x.strokeStyle = col; x.lineWidth = wl;
        x.beginPath(); x.moveTo(bx, S);
        x.quadraticCurveTo(midX, S * 0.55, tipX, tipY);
        x.stroke();
      };
      blade(6.5, INK);                                     // outline under...
      blade(3, Math.random() < 0.5 ? '#79b653' : '#92c962');   // ...flat bright blade
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// tapered limb between two points (bark-shared material; open-ended = cheap)
function _limb(parts, p0, p1, r0, r1) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz) || 0.01;
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx / len, dy / len, dz / len));
  g.applyQuaternion(q);
  g.translate(p0[0], p0[1], p0[2]);
  parts.push(g);
  return p1;
}
// crossed leaf cards at a point, tinted per-vertex
function _cards(parts, cx, cy, cz, w, h, tintH, tintL, seed, n = 2) {
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(seed * 2.1 + k * (Math.PI / n) + _vhash(seed, k, 3) * 0.7);
    g.rotateX((_vhash(seed, k, 7) - 0.5) * 0.35);
    g.translate(cx, cy, cz);
    // gentle tint over the already-colored comic texture (near-white so it can't muddy it)
    c.setHSL(tintH, 0.32 + _vhash(seed, k, 11) * 0.2, tintL).lerp(_WHITE, 0.55);
    const m = g.attributes.position.count, cols = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    parts.push(g);
  }
}
function makeBroadleafGeo(seed) {
  const wood = [], fol = [];
  const hue = 0.22 + _vhash(seed, 1, 7) * 0.1;
  const H = 2.6 + _vhash(seed, 0, 2) * 1.3;                 // trunk height
  const leanX = (_vhash(seed, 4, 1) - 0.5) * 0.5, leanZ = (_vhash(seed, 4, 9) - 0.5) * 0.5;
  // trunk: two kinked segments
  const mid = [leanX * 0.5, H * 0.55, leanZ * 0.5];
  _limb(wood, [0, 0, 0], mid, 0.24 + _vhash(seed, 8, 8) * 0.06, 0.16);
  const top = [leanX, H, leanZ];
  _limb(wood, mid, top, 0.16, 0.1);
  const tips = [];
  // primary limbs from the upper trunk
  const nP = 3 + (seed % 2);
  for (let i = 0; i < nP; i++) {
    const az = (i / nP) * Math.PI * 2 + _vhash(seed, i, 5) * 0.9;
    const elev = 0.55 + _vhash(seed, i, 13) * 0.5;          // rad from vertical-ish
    const t0 = 0.55 + _vhash(seed, i, 17) * 0.4;            // attach height along trunk
    const a0 = [leanX * t0, H * t0, leanZ * t0];
    const L = 1.7 + _vhash(seed, i, 19) * 1.2;
    const a1 = [a0[0] + Math.cos(az) * Math.sin(elev) * L, a0[1] + Math.cos(elev) * L, a0[2] + Math.sin(az) * Math.sin(elev) * L];
    _limb(wood, a0, a1, 0.09, 0.045);
    tips.push(a1);
    // secondary twigs
    for (let j2 = 0; j2 < 2; j2++) {
      const az2 = az + (_vhash(seed, i, 23 + j2) - 0.5) * 1.6;
      const L2 = 0.9 + _vhash(seed, i, 29 + j2) * 0.7;
      const b0 = [a0[0] + (a1[0] - a0[0]) * 0.7, a0[1] + (a1[1] - a0[1]) * 0.7, a0[2] + (a1[2] - a0[2]) * 0.7];
      const b1 = [b0[0] + Math.cos(az2) * 0.8 * L2, b0[1] + 0.55 * L2, b0[2] + Math.sin(az2) * 0.8 * L2];
      _limb(wood, b0, b1, 0.04, 0.018);
      tips.push(b1);
    }
  }
  tips.push([leanX, H + 0.5, leanZ]);                        // crown top
  // leaves grow FROM the tips
  tips.forEach((t2, i) => {
    const sz = 2.2 + _vhash(seed, i, 31) * 1.1;   // chunky comic canopies
    _cards(fol, t2[0], t2[1] + sz * 0.25, t2[2], sz * 1.25, sz,
      hue + (_vhash(seed, i, 37) - 0.5) * 0.045,
      0.42 + (t2[1] / (H + 1)) * 0.14 + _vhash(seed, i, 41) * 0.08, seed + i);
  });
  const BGU = window.FX.BufferGeometryUtils;
  return { wood: BGU.mergeGeometries(wood.map(g => g.index ? g.toNonIndexed() : g)),
           fol: BGU.mergeGeometries(fol.map(g => g.index ? g.toNonIndexed() : g)), kind: 'broad' };
}
function makeConiferGeo(seed) {
  const wood = [], fol = [];
  const hue = 0.3 + _vhash(seed, 3, 1) * 0.06;
  const H = 6.2 + _vhash(seed, 0, 6) * 1.8;
  _limb(wood, [0, 0, 0], [0, H, 0], 0.24, 0.05);            // the spar
  const whorls = 5;
  for (let l = 0; l < whorls; l++) {
    const t = l / (whorls - 1);
    const y = 1.5 + t * (H - 2.2);
    const spread = (1 - t * 0.72) * 1.5;
    const nB = 4;
    for (let b = 0; b < nB; b++) {
      const az = (b / nB) * Math.PI * 2 + _vhash(seed, l, b) * 1.2;
      const e0 = [0, y, 0];
      const e1 = [Math.cos(az) * spread, y - spread * 0.24, Math.sin(az) * spread];   // droop
      _limb(wood, e0, e1, 0.05 * (1 - t * 0.5), 0.02);
      const w = (3.3 - t * 1.6) * (0.9 + _vhash(seed, l, b + 7) * 0.3);
      _cards(fol, e1[0], e1[1] + 0.1, e1[2], w, w * 0.8,
        hue + (_vhash(seed, l, b + 11) - 0.5) * 0.03,
        0.4 + t * 0.06 + _vhash(seed, l, b + 13) * 0.07, seed * 3 + l * 7 + b);
    }
  }
  _cards(fol, 0, H + 0.35, 0, 1.1, 1.3, hue, 0.44, seed * 5, 2);   // tip
  const BGU = window.FX.BufferGeometryUtils;
  return { wood: BGU.mergeGeometries(wood.map(g => g.index ? g.toNonIndexed() : g)),
           fol: BGU.mergeGeometries(fol.map(g => g.index ? g.toNonIndexed() : g)), kind: 'conif' };
}
function treeVariants() {
  if (!TREE_VARIANTS) {
    TREE_VARIANTS = [makeConiferGeo(11), makeBroadleafGeo(23), makeConiferGeo(37), makeBroadleafGeo(41),
                     makeConiferGeo(53), makeBroadleafGeo(67), makeConiferGeo(71), makeBroadleafGeo(83)];
    FOL_MATS = {
      broad: toonMat(0xffffff, { map: leafClusterTex('broad'), vertexColors: true,
        alphaTest: 0.45, side: THREE.DoubleSide }),
      conif: toonMat(0xffffff, { map: leafClusterTex('conif'), vertexColors: true,
        alphaTest: 0.4, side: THREE.DoubleSide }),
    };
    TRUNK_MAT = toonMat(0x5d4531);            // flat comic bark
    TUFT_MAT = toonMat(0xffffff, { map: leafClusterTex('tuft'), vertexColors: true,
      alphaTest: 0.35, side: THREE.DoubleSide });
    const tp = [];
    _cards(tp, 0, 0.26, 0, 0.9, 0.55, 0.26, 0.4, 1, 3);
    TUFT_GEO = window.FX.BufferGeometryUtils.mergeGeometries(tp.map(g => g.toNonIndexed()));
  }
  return TREE_VARIANTS;
}
// Plant chunked instanced trees. spots: [[x, z, scale?]...]. Wood + foliage per chunk-variant,
// both with real bounding spheres so they cull in color AND shadow passes.
function plantTrees(spots, cell = 340) {
  const variants = treeVariants();
  const buckets = new Map();
  if (track && track.sea)                       // seaside: no trees growing out of the ocean
    spots = spots.filter(s => terrainHeight(s[0], s[1]) > track.sea.level + 0.6);
  spots.forEach((s) => {
    const vi = Math.floor(_vhash(s[0], s[1], 31) * variants.length) % variants.length;
    const k = Math.floor(s[0] / cell) + ',' + Math.floor(s[1] / cell) + ':' + vi;
    (buckets.get(k) || buckets.set(k, []).get(k)).push(s);
  });
  const m4 = new THREE.Matrix4(), sv = new THREE.Vector3();
  for (const [k, arr] of buckets) {
    const v = variants[+k.split(':')[1]];
    const fol = new THREE.InstancedMesh(v.fol, FOL_MATS[v.kind], arr.length);
    const trk = new THREE.InstancedMesh(v.wood, TRUNK_MAT, arr.length);
    arr.forEach((s, j) => {
      const sc = (s[2] || 1) * (0.8 + _vhash(s[0], s[1], 5) * 0.9);
      m4.makeRotationY(_vhash(s[0], s[1], 9) * 6.28)
        .scale(sv.set(sc, sc * (0.92 + _vhash(s[1], s[0], 3) * 0.25), sc))
        .setPosition(s[0], terrainHeight(s[0], s[1]) - 0.05, s[1]);
      fol.setMatrixAt(j, m4);
      trk.setMatrixAt(j, m4);
    });
    fol.castShadow = trk.castShadow = true;
    fol.computeBoundingSphere(); trk.computeBoundingSphere();
    scene.add(fol, trk);
  }
}
// Grass tufts: cheap crossed-card ground cover, chunk-instanced (no shadows — they'd swamp the map).
function plantTufts(spots, cell = 220) {
  treeVariants();                                            // ensures TUFT_* exist
  const buckets = new Map();
  if (track && track.sea)                       // no grass tufts under the sea either
    spots = spots.filter(s => terrainHeight(s[0], s[1]) > track.sea.level + 0.3);
  spots.forEach((s) => {
    const k = Math.floor(s[0] / cell) + ',' + Math.floor(s[1] / cell);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(s);
  });
  const m4 = new THREE.Matrix4(), sv = new THREE.Vector3();
  for (const arr of buckets.values()) {
    const inst = new THREE.InstancedMesh(TUFT_GEO, TUFT_MAT, arr.length);
    arr.forEach((s, j) => {
      const sc = 0.7 + _vhash(s[0], s[1], 5) * 0.9;
      m4.makeRotationY(_vhash(s[0], s[1], 9) * 6.28)
        .scale(sv.set(sc, sc, sc))
        .setPosition(s[0], terrainHeight(s[0], s[1]) - 0.02, s[1]);
      inst.setMatrixAt(j, m4);
    });
    inst.computeBoundingSphere();
    scene.add(inst);
  }
}

// Dense, clustered forest + a far treeline "wall" (circuits).
function buildForest(env, scatterPos) {
  const dense = env.dense || 1;
  const spots = [];
  const nClusters = Math.round(70 * dense);
  for (let c = 0; c < nClusters; c++) {
    const cp = scatterPos(track.halfW + 8);
    if (!cp) continue;
    const n = 4 + Math.floor(rand01() * 9);
    for (let k = 0; k < n; k++) {
      const ang = rand01() * 6.28, rr = rand(2, 22);
      const x = cp[0] + Math.cos(ang) * rr, z = cp[1] + Math.sin(ang) * rr;
      if (track.distToTrack(x, z) < track.halfW + 6) continue;
      spots.push([x, z, rand(0.9, 2.0)]);
    }
  }
  // far perimeter treeline (the horizon facade)
  let cx = 0, cz = 0;
  for (const p of track.samples) { cx += p.x; cz += p.z; }
  cx /= track.samples.length; cz /= track.samples.length;
  let rad = 0;
  for (const p of track.samples) rad = Math.max(rad, Math.hypot(p.x - cx, p.z - cz));
  const ringN = Math.round(170 * dense);
  for (let i = 0; i < ringN; i++) {
    const a = rand01() * 6.28, rr = rad + rand(120, 620);
    spots.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, rand(1.5, 2.9)]);
  }
  plantTrees(spots);
}

// ---- countryside scenery: patchwork fields, farm buildings, and a river ----
// A terrain-draped grid quad (samples terrainHeight per vertex so it hugs hills, not floats).
function drapedPatch(cx, cz, w, d, yaw, color, yLift) {
  const seg = 5, ca = Math.cos(yaw), sa = Math.sin(yaw);
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) for (let k = 0; k <= seg; k++) {
    const lx = (i / seg - 0.5) * w, lz = (k / seg - 0.5) * d;
    const x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
    pos.push(x, terrainHeight(x, z) + yLift, z);
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k, b = a + 1, c = a + seg + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, toonMat(color, { side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
}
function buildFields(scatterPos) {
  const crops = [0xcdb45a, 0xd8c56a, 0x8a6a44, 0x9c7a4e, 0x7ea63e, 0x5f8a34, 0xa8b357]; // wheat, tilled, crops
  // scale field count to the track's footprint so a big map doesn't look bare
  let nx = 1e9, xx = -1e9, nz = 1e9, xz = -1e9;
  for (const s of track.samples) { nx = Math.min(nx, s.x); xx = Math.max(xx, s.x); nz = Math.min(nz, s.z); xz = Math.max(xz, s.z); }
  const n = Math.max(30, Math.min(90, Math.round((xx - nx) * (xz - nz) / 60000)));
  for (let i = 0; i < n; i++) {
    const p = scatterPos(track.halfW + 55);
    if (!p) continue;
    drapedPatch(p[0], p[1], rand(140, 340), rand(140, 340), rand(0, 6.28), crops[i % crops.length], 0.05 + Math.random() * 0.06);
  }
}
function buildFarms(scatterPos) {
  const bodyPal = [0x9c2b25, 0xb8352c, 0xe8e2d4, 0xd8cdb8, 0x7a6a54, 0xcabca4]; // barn red, farmhouse white, wood
  const roofPal = [0x3a3f47, 0x55402f, 0x6a7078, 0x4a4038];
  const box = new THREE.BoxGeometry(1, 1, 1);
  let nx = 1e9, xx = -1e9, nz = 1e9, xz = -1e9;
  for (const s of track.samples) { nx = Math.min(nx, s.x); xx = Math.max(xx, s.x); nz = Math.min(nz, s.z); xz = Math.max(xz, s.z); }
  const nFarms = Math.max(30, Math.min(70, Math.round((xx - nx) * (xz - nz) / 90000)));
  for (let i = 0; i < nFarms; i++) {
    const p = scatterPos(track.halfW + 20);
    if (!p) continue;
    const w = rand(11, 24), d = rand(11, 30), h = rand(6, 12);
    const gy = terrainHeight(p[0], p[1]), yaw = Math.floor(rand(0, 4)) * Math.PI / 2 + rand(-0.25, 0.25);
    const grp = new THREE.Group();
    const body = new THREE.Mesh(box, toonMat(bodyPal[i % bodyPal.length]));
    body.scale.set(w, h, d); body.position.y = h / 2; body.castShadow = true;
    grp.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.7, 4), toonMat(roofPal[i % roofPal.length]));
    roof.rotation.y = Math.PI / 4; roof.position.y = h + h * 0.35; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.castShadow = true;
    grp.add(roof);
    if (i % 4 === 0) {   // a silo next to some barns
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, h * 1.3, 10), toonMat(0xbfc4c9));
      silo.position.set(w * 0.5 + 4, h * 0.65, d * 0.2); silo.castShadow = true; grp.add(silo);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 6, 0, 6.28, 0, 1.57), toonMat(0x9aa0a6));
      dome.position.set(w * 0.5 + 4, h * 1.3, d * 0.2); grp.add(dome);
    }
    grp.position.set(p[0], gy, p[1]); grp.rotation.y = yaw;
    scene.add(grp);
  }
}
// The river: a terrain-draped blue ribbon following a smoothed curve (not a closed loop).
function buildRiver(pts) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const M = pts.length * 12, HW = 17;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= M; i++) {
    const t = i / M, c = curve.getPoint(t), tan = curve.getTangent(t);
    const nx = -tan.z, nz = tan.x, L = Math.hypot(nx, nz) || 1;
    const wob = HW * (0.85 + 0.15 * Math.sin(t * 40));        // gently varying width
    for (const s of [-1, 1]) {
      const x = c.x + (nx / L) * s * wob, z = c.z + (nz / L) * s * wob;
      pos.push(x, terrainHeight(x, z) + 0.04, z);             // sits just on the ground surface
      uv.push(s < 0 ? 0 : 1, t);
    }
  }
  for (let i = 0; i < M; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, toonMat(0x3f86c9, { side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
}

// (apronStrip deleted — the stamped heightfield makes the land meet the road by construction)

function buildEnvironment(def, env) {
  const distToTrack = track.distToTrack;

  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of track.samples) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  addSky(env);
  buildTerrain(def, env, minX, maxX, minZ, maxZ);

  const margin = 340;
  const rand = (a, b) => a + Math.random() * (b - a);
  const scatterPos = (minDist) => {
    for (let tries = 0; tries < 30; tries++) {
      const x = rand(minX - margin, maxX + margin), z = rand(minZ - margin, maxZ + margin);
      if (distToTrack(x, z) <= minDist) continue;
      if (track.sea && terrainHeight(x, z) < track.sea.level + 0.6) continue;   // no trees in the ocean
      return [x, z];
    }
    return null;
  };
  const outlineInstanced = () => {};        // outlines retired with the cel look

  if (env.scatter === 'trees') {
    buildForest(env, scatterPos, outlineInstanced);
  } else if (env.scatter === 'countryside') {
    // composite rural scene: patchwork fields, forest, scattered farms, and the river
    buildFields(scatterPos);
    buildForest(env, scatterPos, outlineInstanced);
    buildFarms(scatterPos);
    if (def.river) buildRiver(def.river);
  } else if (env.scatter === 'rocks') {
    const geoRock = new THREE.DodecahedronGeometry(2.4, 0);
    const mRock = toonMat(0xb08a52);
    const geoShrub = new THREE.IcosahedronGeometry(1.3, 0);
    const mShrub = toonMat(0x6a7538);
    for (const [geo, mat, n, minD, ol] of [[geoRock, mRock, 80, track.halfW + 9, true], [geoShrub, mShrub, 130, track.halfW + 7, false]]) {
      const inst = new THREE.InstancedMesh(geo, mat, n);
      const m4 = new THREE.Matrix4();
      let placed = 0;
      for (let i = 0; i < n; i++) {
        const p = scatterPos(minD);
        if (!p) continue;
        const s = rand(0.5, 1.9);
        m4.makeRotationY(rand(0, 6.28)).scale(new THREE.Vector3(s, s * rand(0.6, 1), s)).setPosition(p[0], terrainHeight(p[0], p[1]) + s * 0.8, p[1]);
        inst.setMatrixAt(placed++, m4);
      }
      inst.count = placed;
      inst.castShadow = true;
      scene.add(inst);
      if (ol) outlineInstanced(inst, 1.05);
    }
  } else if (env.scatter === 'buildings') {
    const palette = [0x9aa2ad, 0xc0b199, 0x8b95a5, 0xb0a08c, 0x7e8894, 0xcabca4];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 120; i++) {
      const p = scatterPos(track.halfW + 15);
      if (!p) continue;
      const h = rand(9, 46), w = rand(10, 26), d = rand(10, 26);
      const m = new THREE.Mesh(geo, toonMat(palette[i % palette.length]));
      m.scale.set(w, h, d);
      m.position.set(p[0], terrainHeight(p[0], p[1]) + h / 2, p[1]);
      m.rotation.y = Math.floor(rand(0, 4)) * Math.PI / 2;
      m.castShadow = true;
      scene.add(m);
    }
  } else if (env.scatter === 'stands') {
    const mat = toonMat(0x7f8894);
    const roofM = toonMat(0xd6dae0);
    for (const side of [1, -1]) {
      const stand = new THREE.Group();
      for (let tier = 0; tier < 3; tier++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(600, 3, 8), mat);
        b.position.set(0, 1.5 + tier * 3, tier * 7);
        b.castShadow = true;
        stand.add(b);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(600, 0.6, 26), roofM);
      roof.position.set(0, 12, 7);
      stand.add(roof);
      stand.position.set(0, terrainHeight(0, side * 270), side * (240 + 30));
      if (side < 0) stand.rotation.y = Math.PI;
      scene.add(stand);
    }
  }

  if (env.scatter !== 'stands' && !def.dress) {   // dressed tracks build real grandstands
    const p0 = track.samples[0], r0 = track.rights[0], t0 = track.tangents[0];
    const mat = toonMat(0x7f8894);
    const stand = new THREE.Group();
    for (let tier = 0; tier < 3; tier++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(70, 2.4, 6), mat);
      b.position.set(0, 1.2 + tier * 2.4, tier * 5.4);
      b.castShadow = true;
      stand.add(b);
    }
    const off = track.halfW + (track.def.walls ? 6 : 16);
    stand.position.set(p0.x + r0.x * off, p0.y, p0.z + r0.z * off);
    stand.rotation.y = Math.atan2(t0.x, t0.z) + Math.PI;
    scene.add(stand);
  }

  if (typeof dressTrack === 'function') dressTrack(def, env);   // Mario Kart pass (js/dress.js)
}

// ---------------------------------------------------------------- cars
// Bodies come from carfactory.js (lofted curved panels + modular garage kits).
const VEHICLES = ['f1', 'kart', 'rally', 'bike', 'monster'];   // legacy ids, mapped to chassis
const LEGACY_CHASSIS = { f1: 'formula', rally: 'rally', kart: 'kart', bike: 'bike', monster: 'truck' };
function nearestPaint(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  let best = 0, bd = 1e9;
  PAINTS.forEach((p, i) => {
    const pr = (p >> 16) & 255, pg = (p >> 8) & 255, pb = p & 255;
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function buildCarMesh(color, helmet, vehicle = 'f1') {
  // vehicle: a garage kit object (player) or a legacy id string (AI/back-compat)
  let kit;
  if (vehicle && typeof vehicle === 'object') kit = vehicle;
  else kit = { chassis: LEGACY_CHASSIS[vehicle] || 'gt', paint: nearestPaint(color),
               wheels: WHEEL_STYLES[Math.floor(Math.random() * WHEEL_STYLES.length)],
               decal: DECALS[Math.floor(Math.random() * DECALS.length)] };
  return buildKitMesh(kit, helmet, 1 + Math.floor(Math.random() * 98));
}

// Real light for the player's car at night: one wide headlight spot + a soft red brake glow.
function attachHeadlights(car) {
  const spot = new THREE.SpotLight(0xfff2d2, 0, 190, 0.72, 0.5, 1.4);
  spot.castShadow = false;
  const tgt = new THREE.Object3D();
  // scene-level, NOT a child of the car mesh: cockpit view hides the mesh, and a light
  // inside a hidden object goes dark with it — that was "no headlights in FPS at night"
  scene.add(spot, tgt); spot.target = tgt;
  car.headSpot = spot; car.headTgt = tgt;
}

// floating name tag over every local's car — cream plate, ink edge, livery-color dot,
// drawn in the poster type. A Sprite billboards for free and dies with the car mesh.
function attachNameTag(car) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  const name = (car.name || '').toUpperCase();
  if (!name) return;
  const dotR = 15, padX = 30, gap = 16;
  let fs = 58;
  ctx.font = `${fs}px "Alfa Slab One", Georgia, serif`;
  let tw = ctx.measureText(name).width;
  const maxTw = 512 - padX * 2 - dotR * 2 - gap - 14;
  if (tw > maxTw) { fs = Math.floor(fs * maxTw / tw); ctx.font = `${fs}px "Alfa Slab One", Georgia, serif`; tw = ctx.measureText(name).width; }
  const plateW = tw + padX * 2 + dotR * 2 + gap, plateH = 96;
  const x0 = (512 - plateW) / 2, y0 = (128 - plateH) / 2;
  ctx.fillStyle = 'rgba(244,236,221,.93)';
  ctx.strokeStyle = '#2b2119'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(x0, y0, plateW, plateH, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#' + car.color.toString(16).padStart(6, '0');
  ctx.beginPath(); ctx.arc(x0 + padX + dotR, 64, dotR, 0, 7); ctx.fill();
  ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#2b2119'; ctx.textBaseline = 'middle';
  ctx.fillText(name, x0 + padX + dotR * 2 + gap, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // depthWrite off: the InkPass edge-detects depth and would draw a box around the quad
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.position.set(0, 3.1, 0);
  spr.scale.set(3.6, 0.9, 1);
  car.mesh.add(spr);
  car.tagSpr = spr;
}

function makeCar(color, isPlayer, name, helmet, vehicle = 'f1') {
  return {
    mesh: buildCarMesh(color, helmet, vehicle),
    vehicle,
    color, name, isPlayer,
    x: 0, z: 0, y: 0, heading: 0, roll: 0, pitch: 0,
    velX: 0, velZ: 0, steer: 0,
    idx: 0, distAcc: 0, lap: 0, lapStart: 0,
    lastLap: null, bestLap: null,
    finished: false, finishTime: null,
    laneVar: 0, skill: 1, slip: 0, onRoad: true,
    lineBias: 0,                                // personal line offset (fraction of half-width)
    // per-bot line "wobble": slow weave + faster shimmy + steering imperfection, so bots
    // wander around their line and fight the car like real drivers instead of railing it.
    wAmp: 0, wW1: 0, wW2: 0, wP1: 0, wP2: 0, wJit: 0, wJW: 0, wJP: 0, steerSm: 0,
    engineMul: 1,                               // per-car engine scale (fast bots get a little more)
    // per-bot fluctuating top-speed limiter (shown-speed band); vCap is the live world-m/s cap
    vCap: 0, topLo: 0, topHi: 0, topBias: 0, topW: 0, topPhase: 0,
    // driving character: handbrake-drift appetite, slide-catching skill, braking-point lapses
    driftAt: 0, csSkill: 0, lapseRate: 0, hbUntil: 0, hbCd: 0, lapseUntil: 0, lapseCd: 0,
    driftT: 0, boostT: 0,                       // drift charge -> release mini-boost
    gear: 1, rpm: 0,                            // automatic gearbox state (gearStep)
  };
}

function nearestSample(x, z, hint, windowSize) {
  const { samples, N } = track;
  let best = -1, bestD = 1e18;
  const scan = (i) => {
    const p = samples[(i + N) % N];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = (i + N) % N; }
  };
  if (windowSize >= N / 2) for (let i = 0; i < N; i++) scan(i);
  else for (let i = hint - windowSize; i <= hint + windowSize; i++) scan(i);
  return best;
}

function placeCarAt(car, sampleIdx, lateral) {
  const { samples, tangents, rights, N } = track;
  const i = (sampleIdx + N) % N;
  const p = samples[i], t = tangents[i], r = rights[i];
  car.x = p.x + r.x * lateral;
  car.z = p.z + r.z * lateral;
  car.y = p.y;
  car.heading = Math.atan2(t.x, t.z);
  car.velX = car.velZ = 0;
  car.steer = 0;
  car.idx = i;
  car.distAcc = 0;
}

function resetCar(car) {
  const i = nearestSample(car.x, car.z, car.idx, 200);
  const before = car.distAcc;
  placeCarAt(car, i, 0);
  car.idx = i;
  car.distAcc = before;
}

// ---------------------------------------------------------------- physics
function laneSideLat(car) {   // signed lateral offset from the centerline (+ = left of travel)
  const p = track.samples[car.idx], n = track.samples[(car.idx + 1) % track.N];
  const tx = n.x - p.x, tz = n.z - p.z, tl = Math.hypot(tx, tz) || 1;
  return (tx * (car.z - p.z) - tz * (car.x - p.x)) / tl;
}

function surfaceAt(car) {
  const { def } = track;
  if (track.open) {                                  // open world: nearest road of any street
    const info = track.nearestInfo(car.x, car.z);
    car.onRoad = info.d <= track.width[info.i] + 0.8;
    return car.onRoad ? SURFACES.asphalt : SURFACES.grass;
  }
  const p = track.samples[car.idx];
  const d = Math.hypot(car.x - p.x, car.z - p.z);
  car.onRoad = d <= track.halfW + 0.7;
  if (car.onRoad) {
    if (def.laneZones) {                             // forked sections: surface differs per LANE,
      const f = car.idx / track.N;                   // and the pairs can ROTATE lap to lap (Puentes)
      for (const z of def.laneZones) if (f >= z[0] && f <= z[1]) {
        const pair = def.laneRotate
          ? def.laneRotate[Math.max(0, car.lap) % def.laneRotate.length]
          : [z[2], z[3]];
        return SURFACES[pair[laneSideLat(car) > 0 ? 0 : 1]] || SURFACES[def.surface];
      }
    }
    if (def.surfaceZones) {                          // mixed-surface tracks: grip changes mid-lap
      const f = car.idx / track.N;
      for (const z of def.surfaceZones) if (f >= z[0] && f <= z[1]) return SURFACES[z[2]];
    }
    return SURFACES[def.surface];
  }
  return def.surface === 'dirt' || def.env === 'desert' ? SURFACES.sand : SURFACES.grass;
}

function stepCar(car, input, dt) {
  const surf = surfaceAt(car);
  car.surf = surf;                                 // roar.js keys ground audio off this
  const speed = Math.hypot(car.velX, car.velZ);
  gearStep(car, speed);
  car._brake = input.brake;                        // remembered for the brake lights
  const PM = car.isPlayer && window.ECON && ECON.mods ? ECON.mods() : null;   // garage parts

  // grip rises a little with speed (downforce); rain takes a mild cut (weather.js)
  const gripBase = surf.grip * WEATHER.gripMul * (PM ? PM.grip : 1) * (1 + PHYS.downforce * Math.min(speed / 40, 1.4));
  const aLat = PHYS.aLatMax * gripBase * (input.handbrake ? PHYS.handbrakeGrip : 1);

  const fwdX0 = Math.sin(car.heading), fwdZ0 = Math.cos(car.heading);
  let vf = car.velX * fwdX0 + car.velZ * fwdZ0;

  // steering: speed-sensitive, grip-limited with slack for slides
  const maxSteer = Math.min(0.6, PHYS.aLatMax * PHYS.wheelbase / Math.max(vf * vf, 1)) * PHYS.steerOver;
  const targetSteer = THREE.MathUtils.clamp(input.steer, -1, 1) * maxSteer;
  const steerRate = 5.8 * Math.max(maxSteer, 0.16);
  car.steer += THREE.MathUtils.clamp(targetSteer - car.steer, -steerRate * dt, steerRate * dt);

  let yaw = vf / PHYS.wheelbase * Math.tan(car.steer);
  // handbrake + steer = active rear swing: raw steer input (not the smoothed wheel) so it snaps
  if (input.handbrake && speed > 3)
    yaw += PHYS.hbYaw * THREE.MathUtils.clamp(input.steer, -1, 1) * Math.min(speed / 16, 1);
  const vDir0 = speed > 6 ? Math.atan2(car.velX, car.velZ) : car.heading;   // travel direction pre-yaw
  car.heading += yaw * dt;
  // slide governor (drift only): tires saturate ~38° — the nose snaps out and HOLDS there,
  // a rally angle you can sit on, instead of pirouetting past the velocity vector.
  if (input.handbrake && speed > 6) {
    let sg = vDir0 - car.heading;
    while (sg > Math.PI) sg -= 2 * Math.PI;
    while (sg < -Math.PI) sg += 2 * Math.PI;
    if (sg > PHYS.slideCap) car.heading = vDir0 - PHYS.slideCap;
    else if (sg < -PHYS.slideCap) car.heading = vDir0 + PHYS.slideCap;
  }

  const fX = Math.sin(car.heading), fZ = Math.cos(car.heading);
  const rX = fZ, rZ = -fX;
  vf = car.velX * fX + car.velZ * fZ;
  let vl = car.velX * rX + car.velZ * rZ;

  // longitudinal
  let aLong = 0;
  if (input.throttle > 0) {
    aLong += PHYS.engineAccel * (car.engineMul || 1) * (PM ? PM.accel : 1) * paceMul * input.throttle * surf.accelMul;
  }
  if (input.brake > 0) {
    if (vf > 1.5) aLong -= PHYS.brakeAccel * (PM ? PM.brake : 1) * input.brake * Math.min(surf.grip * 1.4, 1);
    // hold the brake below walking pace and the kart backs up — reverse for everyone
    // (Domain Expansion: no more being pinned on a wall)
    else if (vf > -PHYS.reverseMax) aLong -= PHYS.reverseAccel * input.brake;
  }
  // NO boost mechanic (removed by decree 2026-08-07). Drift's advantage is honest:
  // the slide is nearly free (low bleed) and the handbrake rotation buys the faster
  // line through hairpins. No arcade snap on exit.
  aLong -= PHYS.drag * surf.dragMul * (PM ? PM.drag : 1) * vf * Math.abs(vf);
  aLong -= PHYS.rolling * Math.sign(vf) * Math.min(Math.abs(vf), 1);
  vf += aLong * dt;

  // lateral grip
  const latReduce = Math.min(Math.abs(vl), aLat * dt);
  vl -= Math.sign(vl) * latReduce;
  // tire scrub: the grip spent killing sideways motion drags the car back too — turning hard
  // costs speed.
  vf -= Math.sign(vf) * Math.min(Math.abs(vf), latReduce * PHYS.scrub * (input.handbrake ? 0.45 : 1));  // sliding tires scrub less — gripping pays full corner tax, drifting doesn't
  // sliding rubber burns speed: the bigger the slide, the harder the bleed (the drift debuff —
  // you drift for the line and the clip, not for free pace)
  if (input.handbrake)
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), Math.abs(vl) * PHYS.driftBleed * dt);
  // stability assist: bleed off slide when you're not actively steering (catches spins)
  if (!input.handbrake) {
    const straighten = PHYS.stability * (1 - Math.min(Math.abs(input.steer), 1)) * dt;
    vl -= Math.sign(vl) * Math.min(Math.abs(vl), straighten);
  }
  car.slip = Math.abs(vl);

  car.velX = fX * vf + rX * vl;
  car.velZ = fZ * vf + rZ * vl;
  if (speed < 0.4 && input.throttle === 0 && input.brake === 0) { car.velX = 0; car.velZ = 0; }

  car.x += car.velX * dt;
  car.z += car.velZ * dt;

  // lap-progress odometer + centerline containment — CLOSED tracks only
  if (!track.open) {
    const newIdx = nearestSample(car.x, car.z, car.idx, 26);
    let didx = newIdx - car.idx;
    const { N } = track;
    if (didx > N / 2) didx -= N;
    if (didx < -N / 2) didx += N;
    car.idx = newIdx;
    car.distAcc += didx;
  }

  // ride the real ground. On a closed-circuit road use the ANALYTIC surface at car.idx —
  // idx tracks lap progression, so figure-8 bridges resolve to the right section (the 2D
  // field can't know which crossing you're on). Off-road / open world: the terrain field.
  let surfY;
  if (!track.open && track.samples) {
    const { N } = track;
    const sp = track.samples[car.idx], r = track.rights[car.idx];
    const lat = (car.x - sp.x) * r.x + (car.z - sp.z) * r.z;
    // interpolate along the centerline — car.idx alone is a STAIRCASE (one height per
    // sample), which on any grade turns into a 20cm step every few metres = the bumps.
    const tg = track.tangents[car.idx];
    const lon = (car.x - sp.x) * tg.x + (car.z - sp.z) * tg.z;
    let j = car.idx + (lon >= 0 ? 1 : -1);
    j = track.stage ? Math.min(N - 1, Math.max(0, j)) : (j + N) % N;
    const sq = track.samples[j];
    const seg = Math.hypot(sq.x - sp.x, sq.z - sp.z) || 1;
    const f = Math.min(1, Math.abs(lon) / seg);
    const y0 = sp.y * (1 - f) + sq.y * f;
    const bk = track.bank[car.idx] * (1 - f) + track.bank[j] * f;
    const latB = THREE.MathUtils.clamp(lat, -(track.halfW + 8), track.halfW + 8); // match the stamp
    const analytic = y0 + latB * bk + (track.roadLift || 0);
    // crossfade to the terrain field across the road edge — a hard source-swap there
    // is a height discontinuity, i.e. a thud every time anyone clips a berm
    const aLat = Math.abs(lat), e0 = track.halfW - 2, e1 = track.halfW + 6;
    if (aLat <= e0) surfY = analytic;
    else {
      const w = THREE.MathUtils.smoothstep(aLat, e0, e1);
      surfY = analytic * (1 - w) + terrainHeight(car.x, car.z) * w;
    }
  } else {
    surfY = terrainHeight(car.x, car.z);
    if (car.onRoad) surfY += track.roadLift || 0;
  }
  if (car.air) {                                   // the Jack: ballistic glide down the track
    car.air.vy -= 14 * dt;                         // floatier than real gravity, by decree
    car.y += car.air.vy * dt;
    if (car.air.vy < 0 && car.y <= surfY) { car.y = surfY; car.air = null; }
  } else {
    car.y += (surfY - car.y) * Math.min(1, dt * 12);
  }
  if (car.spun > 0) { car.spun -= dt; car.heading += dt * 9; }   // spin-out pirouette

  if (!track.open) {
    const sp = track.samples[car.idx];
    const d = Math.hypot(car.x - sp.x, car.z - sp.z);
    if (d > track.outerLimit) {
      const nx = (car.x - sp.x) / d, nz = (car.z - sp.z) / d;
      car.x = sp.x + nx * track.outerLimit;
      car.z = sp.z + nz * track.outerLimit;
      const vOut = car.velX * nx + car.velZ * nz;
      if (vOut > 0) {
        if (window.DMG) DMG.impact(car, vOut);       // walls hurt now
        car.velX -= vOut * nx * 1.35;
        car.velZ -= vOut * nz * 1.35;
        car.velX *= 0.9; car.velZ *= 0.9;
      }
    }
    // forked sections (Puentes Coliseo): a divider island splits the road — pick a
    // side and stay on it. Grazing the divider is a wall hit like any other.
    if (track.def.laneZones) {
      const f = car.idx / track.N;
      for (const z of track.def.laneZones) if (f >= z[0] && f <= z[1]) {
        const lat = laneSideLat(car), DIV = 2.4;
        if (Math.abs(lat) < DIV) {
          const p2 = track.samples[car.idx], n2 = track.samples[(car.idx + 1) % track.N];
          const tx = (n2.x - p2.x), tz = (n2.z - p2.z), tl = Math.hypot(tx, tz) || 1;
          const px = tz / tl, pz = -tx / tl;             // +lat direction
          const target = lat >= 0 ? DIV : -DIV;
          car.x += px * (target - lat); car.z += pz * (target - lat);
          const vLat = car.velX * px + car.velZ * pz;
          if (Math.sign(vLat) !== Math.sign(target)) {   // moving into the island
            if (window.DMG) DMG.impact(car, Math.abs(vLat) * 0.7);
            car.velX -= vLat * px * 1.2; car.velZ -= vLat * pz * 1.2;
          }
        }
        break;
      }
    }
  } else if (typeof worldCollide === 'function') {
    worldCollide(car);                            // open world: push out of buildings
  }
}

function aiInputs(car) {
  const { samples, rights, raceOffset, vmax, N } = track;
  const speed = Math.hypot(car.velX, car.velZ);

  // steering look-ahead point on the racing line
  const steerLook = Math.round(THREE.MathUtils.clamp(7 + speed * 0.4, 8, 42));
  const si = (car.idx + steerLook) % N;
  // personal cruising line: each bot sits a bit off the ideal line (staggered), then laneVar
  // adds dynamic overtaking movement on top. Clamp so the sum always stays on the road.
  const biasOff = car.lineBias * track.halfW * 0.42;
  // line wobble: slow weave + faster shimmy (in metres). Bots wander around their line
  // rather than railing it, so the field looks alive.
  const wob = (Math.sin(raceTime * car.wW1 + car.wP1) + 0.5 * Math.sin(raceTime * car.wW2 + car.wP2))
              * car.wAmp * track.halfW * 0.66;
  const off = THREE.MathUtils.clamp(raceOffset[si] + biasOff + car.laneVar + wob, -track.halfW * 0.85, track.halfW * 0.85);
  const tx = samples[si].x + rights[si].x * off;
  const tz = samples[si].z + rights[si].z * off;
  let err = Math.atan2(tx - car.x, tz - car.z) - car.heading;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  // steering imperfection: a small hand-jitter, plus a touch of reaction lag / slight
  // over-correction (steerSm chases the target and can overshoot) => a realistic wobble.
  const jitter = Math.sin(raceTime * car.wJW + car.wJP) * car.wJit;
  const rawSteer = THREE.MathUtils.clamp(err * 2.6 + jitter, -1, 1);
  car.steerSm += (rawSteer - car.steerSm) * 0.35;   // lag + overshoot -> natural weave
  let steer = THREE.MathUtils.clamp(car.steerSm, -1, 1);

  // slide angle: how far the actual direction of travel is off the nose
  let slide = 0;
  if (speed > 6) {
    slide = Math.atan2(car.velX, car.velZ) - car.heading;
    while (slide > Math.PI) slide -= 2 * Math.PI;
    while (slide < -Math.PI) slide += 2 * Math.PI;
  }
  // countersteer: good drivers catch a slide by steering into the direction of travel; poor
  // drivers barely react — they spin or sail off, and it reads as a genuine mistake.
  if (Math.abs(slide) > 0.10 && car.csSkill)
    steer = THREE.MathUtils.clamp(steer + slide * 2.4 * car.csSkill, -1, 1);

  // speed: the vmax profile already bakes in braking zones (backward pass), so just follow
  // it a hair ahead — don't crawl to the corner speed 90m early.
  const look = Math.round(THREE.MathUtils.clamp(2 + speed * 0.08, 2, 8));
  let vTarget = vmax[(car.idx + 2) % N];
  for (let l = 3; l <= look; l++) vTarget = Math.min(vTarget, vmax[(car.idx + l) % N]);
  vTarget *= car.skill;
  // corner confidence: >1 => they don't brake enough for the corner and run wide (dumb bots hit
  // walls); ~1 => they respect the braking profile (aces brake properly). Only bites in corners,
  // because on straights the top-speed cap below clamps it anyway.
  vTarget *= (car.cornerConf || 1);
  if (car.vCap) vTarget = Math.min(vTarget, car.vCap);   // personal top-speed limiter (straights)

  // ---- racecraft: defending + attacking maneuvers (elite bots race YOU, not just the track)
  if (car.defSkill || car.atkSkill) {
    const mfX = Math.sin(car.heading), mfZ = Math.cos(car.heading);
    // DEFEND: someone close behind and closing -> cover their side. One move per straight.
    if (car.defSkill && raceTime > car.defCd && car.moveT <= 0) {
      for (const o of cars) {
        if (o === car || o.finished || o.traffic) continue;
        const dx = o.x - car.x, dz = o.z - car.z, dist = Math.hypot(dx, dz);
        if (dist > 16 || dist < 0.01) continue;
        if (dx * mfX + dz * mfZ >= -0.2 * dist) continue;               // behind me only
        if ((o.velX * mfX + o.velZ * mfZ) - speed < 1) continue;        // and actually closing
        car.defCd = raceTime + 4 + Math.random() * 3;
        if (Math.random() > car.defSkill) break;                        // didn't check the mirrors
        const side = dx * mfZ - dz * mfX;
        car.moveDir = side > 0 ? 1 : -1;                                // slide toward their side
        car.moveT = 0.45 + car.defSkill * 0.45;
        break;
      }
    }
    // ATTACK: someone close ahead -> dive for the inside when a corner looms; elite feint on straights
    if (car.atkSkill && raceTime > car.atkCd && car.moveT <= 0) {
      const tH = track.tangents[car.idx], tA = track.tangents[(car.idx + 22) % N];
      const turn = tH.x * tA.z - tH.z * tA.x;                           // which way the road bends
      for (const o of cars) {
        if (o === car || o.finished || o.traffic) continue;
        const dx = o.x - car.x, dz = o.z - car.z, dist = Math.hypot(dx, dz);
        if (dist > 14 || dist < 0.01) continue;
        if (dx * mfX + dz * mfZ <= 0.3 * dist) continue;                // ahead of me only
        if (speed - (o.velX * mfX + o.velZ * mfZ) < 1.2) continue;      // and I'm faster
        if (Math.abs(turn) > 0.10) {                                    // corner coming: DIVE inside
          car.moveDir = turn > 0 ? 1 : -1;
          car.moveT = 0.8;
          car.atkCharge = 0.55 * car.atkSkill;                          // brake later, commit
          car.atkCd = raceTime + 5 + Math.random() * 4;
        } else if (car.atkSkill > 0.75 && Math.random() < 0.5) {        // feint-and-switch
          car.feintT = 0.34;
          car.moveDir = Math.random() < 0.5 ? 1 : -1;
          car.atkCd = raceTime + 3 + Math.random() * 2;
        }
        break;
      }
    }
    const hw = track.halfW * 0.82;
    if (car.moveT > 0) {
      car.moveT -= 0.016;
      car.laneVar = THREE.MathUtils.clamp(car.laneVar + car.moveDir * 24 * 0.016, -hw, hw);
    }
    if (car.feintT > 0) {                                               // jab one way, go the other
      car.feintT -= 0.016;
      car.laneVar = THREE.MathUtils.clamp(car.laneVar + car.moveDir * (car.feintT > 0.17 ? 30 : -36) * 0.016, -hw, hw);
    }
    if (car.atkCharge > 0) { car.atkCharge -= 0.016; vTarget *= 1.10; } // the late-brake lunge window
  }

  let throttle = 0, brake = 0;
  if (speed < vTarget - 1) throttle = 1;
  else if (speed > vTarget + 1.5) brake = THREE.MathUtils.clamp((speed - vTarget) / 8, 0.2, 1);
  else throttle = 0.4;
  // ease off if pointing badly wrong
  if (Math.abs(err) > 0.5) throttle = Math.min(throttle, 0.5);

  // handbrake drifting: stylish bots spot a genuinely tight corner ahead (apex speed far below
  // current pace), yank the handbrake at turn-in, and throw the nose at the line target. On
  // release the countersteer above has to catch the slide — aces do, dumb bots spin or sail wide.
  let handbrake = 0;
  if (!car.finished && car.driftAt && speed > 24 && raceTime > car.hbCd && Math.abs(err) > 0.12) {
    let apexV = 1e9;
    for (let l = 4; l <= 34; l += 3) apexV = Math.min(apexV, vmax[(car.idx + l) % N]);
    if (apexV < speed * 0.66 && Math.random() < car.driftAt * 0.14) {
      car.hbUntil = raceTime + 0.3 + 0.5 * car.driftAt;
      car.hbCd = raceTime + 2.5;                            // one yank per corner
    }
  }
  if (raceTime < car.hbUntil) {
    if (Math.abs(err) < 0.10) car.hbUntil = 0;              // rotated enough -> release, catch it
    else { handbrake = 1; steer = THREE.MathUtils.clamp(err * 4, -1, 1); throttle = 0.6; brake = 0; }
  }

  // brain-fade: occasionally miss the braking point entirely, sail in hot, panic-brake too late
  // (the wide/off-track moments that look like honest mistakes, because they are)
  if (!car.finished && car.lapseRate && speed > vTarget + 8 && raceTime > car.lapseCd
      && Math.random() < car.lapseRate) {
    car.lapseUntil = raceTime + 0.45 + Math.random() * 0.75;
    car.lapseCd = raceTime + 7 + Math.random() * 9;         // one blunder at a time
  }
  if (raceTime < car.lapseUntil) { throttle = Math.max(throttle, 0.75); brake = 0; }

  // overtaking: catch a slower car, pull to the open side, and COMMIT to the pass once alongside.
  // Only lift when we're stuck directly behind with no room; if we've got a lane, keep racing.
  const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
  let lift = 0;
  for (const other of cars) {
    if (other === car || other.finished) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 17 || dist < 0.01) continue;
    if (dx * fwdX + dz * fwdZ <= 0.15 * dist) continue;     // only cars ahead of us
    const otherV = other.velX * fwdX + other.velZ * fwdZ;
    const closing = speed - otherV;
    if (closing <= 0.5) continue;                           // not catching -> leave room (no gridlock)
    const side = dx * fwdZ - dz * fwdX;                     // where the other car sits, laterally
    const lateral = Math.abs(side);
    // steer out toward the side away from them; harder the closer we are
    const urgency = THREE.MathUtils.clamp((17 - dist) / 17, 0, 1);
    car.laneVar += (side > 0 ? -1 : 1) * (10 + 12 * urgency) * 0.016;
    car.laneVar = THREE.MathUtils.clamp(car.laneVar, -track.halfW * 0.82, track.halfW * 0.82);
    if (lateral < 3.2) {                                    // still lined up right behind them
      if (dist < 5.5 && closing > 1.5) lift = Math.max(lift, 0.8);   // about to rear-end -> brake
      else if (dist < 9) lift = Math.max(lift, 0.35);               // ease a touch while working around
    }
    // lateral >= 3.2 => we have a lane alongside: no lift, drive past
  }
  if (lift > 0) { throttle = Math.min(throttle, 1 - lift); brake = Math.max(brake, lift * 0.5); }
  car.laneVar *= 0.92;   // relax back toward the personal line when the coast is clear
  return { steer, throttle, brake, handbrake };
}

function collideCars(dt) {
  const R = 2.1;
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < R * 2) {
        const nx = dx / d, nz = dz / d;
        const push = (R * 2 - d) / 2;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        const rv = (b.velX - a.velX) * nx + (b.velZ - a.velZ) * nz;
        if (rv < 0) {
          const imp = rv * 0.55;
          a.velX += nx * imp; a.velZ += nz * imp;
          b.velX -= nx * imp; b.velZ -= nz * imp;
          if (window.DMG) { DMG.impact(a, -rv * 0.6); DMG.impact(b, -rv * 0.6); }
        }
      }
    }
}

// ---------------------------------------------------------------- game flow
function startGame(def, m) {
  mode = def.stage ? 'stage' : m;    // point-to-point defs only run as stages
  paceMul = hardMode ? 1.2 : 1;      // world rushes at you faster in hard mode
  fogMul = hardMode ? 0.62 : 1;      // ...and it emerges from the fog later
  $('menu').style.display = 'none';
  $('acctChip').style.display = 'none';
  $('results').style.display = 'none';
  buildTrack(def);
  // venue-forced night (The Show): dark sky, but the floods make it day-bright on track
  if (typeof DN !== 'undefined') DN.venueNight = !!def.night;
  if (def.night) {
    // Hard league races the TRUE night: the floods go down, headlights matter
    const floods = new THREE.AmbientLight(0xdde9ff, hardMode ? 0.3 : 1.7);
    floods.name = 'venueFloods';
    scene.add(floods);
  }
  // fork divider island: a glowing barrier down the middle of every laneZone
  if (def.laneZones) for (const z of def.laneZones) {
    const i0 = Math.floor(z[0] * track.N), i1 = Math.floor(z[1] * track.N);
    for (let i = i0; i < i1; i += 4) {
      const s0 = track.samples[i];
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 5.6),
        new THREE.MeshStandardMaterial({ color: 0x18305e, emissive: 0x2e6bff, emissiveIntensity: 0.7 }));
      const s1 = track.samples[(i + 1) % track.N];
      b.position.set(s0.x, (s0.y || 0) + 0.75, s0.z);
      b.rotation.y = Math.atan2(s1.x - s0.x, s1.z - s0.z);
      scene.add(b);
    }
  }

  cars = [];
  const nAI = mode === 'race' ? 11 : 0;              // 11 AI + you = 12 drivers
  // AI personalities. cap = top-speed band (shown km/h); corner = how much they OVER-drive corner
  // speed (>1 = don't brake enough -> run wide into walls); wob/jit = line/steer sloppiness.
  // drift = handbrake appetite in hairpins; cs = countersteer/slide-catching skill;
  // lapse = per-frame chance (in a braking zone) of missing the braking point entirely
  // Pace tiers are WIDE on purpose: the field must string out lap by lap — aces gap the
  // midfield, the slow tier is genuinely lappable by a good player, dumb is quick-but-crashy.
  const PERSONAS = {
    // elite: PLAYER-pace racecraft — two of them every grid. They win with maneuvers
    // (def/atk below), not raw pace: beat them by driving better, not by outrunning them.
    elite: { capLo: 203, capHi: 209, skill: 1.07, engine: 1.10, corner: 1.00, wob: 0.06, jit: 0.02,  drift: 0.85, cs: 0.95, lapse: 0.0003, def: 0.95, atk: 0.9 },
    ace:   { capLo: 196, capHi: 204, skill: 1.04, engine: 1.06, corner: 1.00, wob: 0.09, jit: 0.028, drift: 0.70, cs: 0.85, lapse: 0.0008, def: 0.6, atk: 0.55 },
    mid:   { capLo: 168, capHi: 181, skill: 0.93, engine: 0.96, corner: 1.04, wob: 0.17, jit: 0.05,  drift: 0.35, cs: 0.50, lapse: 0.003,  def: 0.3, atk: 0.25 },
    slow:  { capLo: 138, capHi: 152, skill: 0.85, engine: 0.82, corner: 0.94, wob: 0.16, jit: 0.05,  drift: 0,    cs: 0.35, lapse: 0.0015, def: 0.15, atk: 0 },
    dumb:  { capLo: 165, capHi: 188, skill: 0.80, engine: 0.99, corner: 1.16, wob: 0.34, jit: 0.11,  drift: 0.60, cs: 0.10, lapse: 0.011,  def: 0.5, atk: 0.7 },  // wild blocks, dive-bombs
    versta:{ capLo: 226, capHi: 234, skill: 1.12, engine: 1.48, corner: 0.98, wob: 0.04, jit: 0.02,  drift: 1.0,  cs: 1.0,  lapse: 0,      def: 1, atk: 1 },
  };
  // roster of 11: two elites at your pace, an ace, mids, slows, and the dumb tier
  let roster = ['elite', 'elite', 'ace', 'mid', 'mid', 'slow', 'slow', 'dumb', 'dumb', 'dumb', 'dumb'];
  for (let k = roster.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [roster[k], roster[j]] = [roster[j], roster[k]]; }
  const verstappen = Math.random() < 0.2;            // ~1 in 5 races: El Santo himself shows up
  if (verstappen) roster[0] = 'versta';
  let verstaCar = null;
  for (let i = 0; i < nAI; i++) {
    const key = roster[i], P = PERSONAS[key], isV = key === 'versta';
    const name = isV ? 'El Santo' : AI_NAMES[i % AI_NAMES.length];
    const color = isV ? 0xff7a1a : CAR_COLORS[(i + 1) % CAR_COLORS.length];
    const helmet = isV ? 0x14274a : HELMET_COLORS[(i + 1) % HELMET_COLORS.length];
    const veh = isV ? 'f1' : VEHICLES[Math.floor(Math.random() * VEHICLES.length)];
    const c = makeCar(color, false, name, helmet, veh);
    c.persona = key;
    // form jitter: two bots of the same tier are never equals — this alone splits them by
    // seconds over a race, and with the tier gaps it strings the whole field out
    const form = 0.965 + Math.random() * 0.07;
    c.skill = P.skill * form * (hardMode ? 1.02 : 1);
    c.topLo = P.capLo * form; c.topHi = P.capHi * form; c.topBias = 0;
    c.engineMul = P.engine * (0.96 + Math.random() * 0.08);
    c.cornerConf = P.corner + (key === 'dumb' ? Math.random() * 0.18 : 0);  // dumb varies: some wilder
    c.driftAt = P.drift; c.csSkill = P.cs * (0.85 + Math.random() * 0.3); c.lapseRate = P.lapse;
    c.defSkill = P.def || 0; c.atkSkill = P.atk || 0;   // racecraft: blocking + attacking maneuvers
    c.defCd = 0; c.atkCd = 0; c.moveT = 0; c.moveDir = 0; c.feintT = 0; c.atkCharge = 0;
    c.topW = 0.22 + Math.random() * 0.16;             // slow top-speed breathing, out of phase
    c.topPhase = Math.random() * Math.PI * 2;
    c.lineBias = THREE.MathUtils.clamp((nAI > 1 ? -0.7 + i * (1.4 / (nAI - 1)) : 0) + (Math.random() - 0.5) * 0.25, -0.8, 0.8);
    c.wAmp = P.wob + Math.random() * 0.06;            // line wander (dumb = wide, ace = tidy)
    c.wW1 = 0.32 + Math.random() * 0.55;  c.wP1 = Math.random() * Math.PI * 2;   // slow arcs, corner to corner
    c.wW2 = 1.7 + Math.random() * 1.4;   c.wP2 = Math.random() * Math.PI * 2;
    c.wJit = P.jit + Math.random() * 0.03;            // steering imperfection
    c.wJW = 3.0 + Math.random() * 2.5;   c.wJP = Math.random() * Math.PI * 2;
    if (isV) verstaCar = c;
    attachNameTag(c);
    cars.push(c);
  }
  if (verstappen && nAI > 0) toast('⚠ El Santo has entered the race');
  player = makeCar(PAINTS[KIT.paint % PAINTS.length], true, 'You', HELMET_COLORS[0], KIT);
  attachHeadlights(player);
  cars.push(player);

  cars.sort((a, b) => (b.skill || 0) - (a.skill || 0));
  cars.forEach((c, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    if (mode === 'stage') placeCarAt(c, 3, 0);       // stage: solo at the start beam
    else placeCarAt(c, track.N - 10 - row * 10, (col ? 1 : -1) * track.halfW * 0.5);
    scene.add(c.mesh);
  });

  raceTime = 0;
  liveResults = false; liveResDone = -1;
  cars.forEach(c => { c.lap = 0; c.lapStart = 0; c.finished = false; c.finishTime = null; c.lastLap = null; c.bestLap = null; });

  if (mode === 'race' || mode === 'stage') { state = 'countdown'; countdownT = 3.6; }
  else { state = 'tt'; player.lapStart = 0; player.lap = -1; }
  if (mode === 'stage') { player.splitT = [null, null, null]; player.splitHit = [false, false, false]; }

  $('hud').style.display = 'block';
  $('minimap').style.display = 'block';
  if (mode === 'stage') {
    const sb = stageBest(def.id);
    $('bestLap').textContent = 'Best ' + fmtTime(sb ? sb.time : null);
    $('lastLap').textContent = 'Splits at ¼ · ½ · ¾';
  } else {
    const best = localStorage.getItem('apex_best_' + def.id);
    $('bestLap').textContent = 'Best ' + fmtTime(best ? +best : null);
  }
  $('trackLabel').textContent = def.name;
  updateHUD();
  if (typeof sendTrackToPhone === 'function') sendTrackToPhone();   // new track outline -> phone minimap
  initAudio(); startMusic(def);                                     // per-track music (speeds up on last lap)
  if (verstaCar) startVerstappenTheme(verstaCar);                   // his theme radiates from his car
  clock.getDelta();
}

// ---------------------------------------------------------------- open world (Crescent Bay)
function startFreeRoam() {
  if (!window.CITY || typeof buildWorld !== 'function') { toast('World data not loaded'); return; }
  $('menu').style.display = 'none';
  $('acctChip').style.display = 'none';
  $('results').style.display = 'none';
  state = 'menu';                                  // safe while the world builds (loop early-returns)
  const ld = $('countdown'); ld.style.display = 'block'; ld.style.fontSize = '30px'; ld.textContent = 'Building Crescent Bay…';
  setTimeout(() => { buildFreeRoam(); ld.style.display = 'none'; ld.style.fontSize = ''; ld.textContent = ''; }, 60);
}
function buildFreeRoam() {
  mode = 'freeroam';
  paceMul = 1; fogMul = 1;
  buildWorld();                                    // sets global `track` (open:true) + scene
  cars = [];
  player = makeCar(PAINTS[KIT.paint % PAINTS.length], true, 'You', HELMET_COLORS[0], KIT);
  attachHeadlights(player);
  cars.push(player);
  scene.add(player.mesh);
  // spawn on the road, facing along the nearest street
  const sp = track.spawn;
  player.x = sp.x; player.z = sp.z; player.y = terrainHeight(sp.x, sp.z);
  const info = track.nearestInfo(sp.x, sp.z), r = track.rights[info.i];
  player.heading = Math.atan2(-r.z, r.x);                  // align with the road tangent
  player.velX = player.velZ = 0; player.idx = 0; player.distAcc = 0;
  player.lap = 0; player.finished = false;
  if (typeof spawnTraffic === 'function') spawnTraffic(24);   // the city drives itself around
  raceTime = 0;
  state = 'freeroam';
  $('hud').style.display = 'block';
  $('minimap').style.display = 'none';               // no lap minimap in the open world
  $('trackLabel').textContent = 'Crescent Bay';
  $('position').textContent = 'Free Roam';
  $('lapCount').textContent = 'Explore';
  camMode = CAM_CHASE;
  rebuildPostFX();
  updateHUD();
  if (typeof sendWorldToPhone === 'function') sendWorldToPhone();   // phone shows the whole-town map
  initAudio(); startMusic({ id: 'town' });
  clock.getDelta();
}

// Live results: finishing does NOT freeze the world. The race keeps running behind the
// board, every later finisher slots in as they cross, and DNF is reserved for wrecks.
let liveResults = false, liveResCap = 0, liveResDone = -1;
function raceStandings() {
  return [...cars].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishTime - b.finishTime;
    const aOut = a.dnf ? 1 : 0, bOut = b.dnf ? 1 : 0;
    if (aOut !== bOut) return aOut - bOut;              // still racing ranks above wrecked
    return (b.lap * track.N + b.distAcc) - (a.lap * track.N + a.distAcc);
  });
}
function renderResults() {
  const standings = raceStandings();
  let html = '<div class="resInner"><h2>Race Result</h2><table>';
  standings.forEach((c, i) => {
    let t;
    if (c.finished) t = fmtTime(c.finishTime * 1000);
    else if (c.dnf) t = 'DNF (' + (c.lap + 1) + ' laps)';
    else t = 'lap ' + Math.min(c.lap + 1, track.def.laps) + '/' + track.def.laps + '…';
    const best = c.bestLap ? fmtTime(c.bestLap) : '-';
    html += `<tr class="${c.isPlayer ? 'me' : ''}">
      <td>${i + 1}</td><td><span class="dot" style="background:#${c.color.toString(16).padStart(6, '0')}"></span>${c.name}</td>
      <td>${t}</td><td>${best}</td></tr>`;
  });
  html += '</table>';
  if (player._won != null && window.ECON)
    html += `<p class="payout">Winnings +₡${player._won} · Balance ₡${ECON.money()}</p>`;
  html += '<button onclick="backToMenu()">Back to Menu</button></div>';
  const box = $('results');
  const st = box.scrollTop;                             // live re-render keeps your scroll spot
  box.innerHTML = html;
  box.scrollTop = st;
}
function endRace() {                                    // the player's race is over -> open the live board
  if (window.NET && NET.phase === 'racing')
    NET.reportFinish(player.finishTime || raceTime, player.lap);
  // scheduled (VD####) rooms are LEAGUE races: your full-field finish banks points
  if (window.LEAGUE && window.NET && NET.room)
    LEAGUE.onSoloFinish(NET.room, raceStandings().findIndex(c => c.isPlayer) + 1);
  stopVerstappenTheme();
  setMusicFinalLap(false);
  if (window.ECON && player._won == null) {             // position among finishers is locked at the line
    const pi = raceStandings().findIndex(c => c.isPlayer);
    player._won = ECON.racePayout(pi, player.lap, !!player.finished);
  }
  liveResults = true;
  liveResCap = raceTime + 90;                           // stuck-bot safety valve
  liveResDone = -1;
  $('results').style.display = 'flex';
  updateLiveResults();
}
function updateLiveResults() {
  if (!liveResults) return;
  const done = cars.filter(c => c.finished || c.dnf).length;
  if (done !== liveResDone) { liveResDone = done; renderResults(); }
  if (cars.every(c => c.finished || c.dnf) || raceTime > liveResCap) {
    // stragglers close out in running order — no DNF, DNF is for crashes only
    for (const c of raceStandings()) if (!c.finished && !c.dnf) { c.finished = true; c.finishTime = raceTime; }
    liveResults = false;
    state = 'results';
    stopMusic();
    renderResults();
  }
}

function backToMenu() {
  state = 'menu';
  liveResults = false;
  const np = document.getElementById('nowPlaying');
  if (np) np.style.display = 'flex';
  stopVerstappenTheme();
  startMusic({ id: 'menu' });                       // chill lofi while browsing (no-op before first initAudio)
  $('results').style.display = 'none';
  $('pause').style.display = 'none';
  $('hud').style.display = 'none';
  $('fpOverlay').classList.remove('on');
  buildMenu();
}
window.backToMenu = backToMenu;
window.restartRace = () => { $('pause').style.display = 'none'; startGame(track.def, mode); };

function updateInvertBtn() {
  const b = $('invertBtn');
  if (b) b.textContent = 'Steering: ' + (steerInvert ? 'Inverted' : 'Normal');
}
window.toggleInvert = () => {
  steerInvert = !steerInvert;
  localStorage.setItem('apex_steerInvert', steerInvert ? '1' : '0');
  updateInvertBtn();
  toast('Steering: ' + (steerInvert ? 'Inverted' : 'Normal'));
};

// ---------------------------------------------------------------- rally stage timing
function stageBest(id) {
  try { return JSON.parse(localStorage.getItem('apex_stage_' + id)); } catch (e) { return null; }
}
function stageProgress(car) {
  if (state !== 'race' || car.finished) return;
  const now = raceTime * 1000;
  const best = stageBest(track.def.id);
  for (let s = 0; s < 3; s++) {
    if (!car.splitHit[s] && car.idx >= track.splitIdx[s]) {
      car.splitHit[s] = true;
      car.splitT[s] = now;
      let msg = 'Split ' + (s + 1) + ': ' + fmtTime(now);
      if (best && best.splits && best.splits[s] != null) {
        const d = now - best.splits[s];
        msg += '  (' + (d >= 0 ? '+' : '−') + fmtTime(Math.abs(d)) + ')';
      }
      toast(msg);
      $('lastLap').textContent = msg;
    }
  }
  if (car.idx >= track.N - 3) endStage(car);
}
function endStage(car) {
  car.finished = true;
  const time = raceTime * 1000;
  state = 'results';
  stopMusic();
  const best = stageBest(track.def.id);       // read the old record BEFORE overwriting it
  const isRecord = !best || time < best.time;
  if (isRecord) localStorage.setItem('apex_stage_' + track.def.id, JSON.stringify({ time, splits: car.splitT }));
  let html = '<h2>Stage Complete</h2><table>';
  const rows = [['Split 1', car.splitT[0]], ['Split 2', car.splitT[1]], ['Split 3', car.splitT[2]], ['Finish', time]];
  rows.forEach(([label, t], i) => {
    const ref = i < 3 ? (best && best.splits ? best.splits[i] : null) : (best ? best.time : null);
    const d = (t != null && ref != null) ? t - ref : null;
    html += `<tr class="me"><td>${label}</td><td>${fmtTime(t)}</td><td>${d == null ? '-' : (d >= 0 ? '+' : '−') + fmtTime(Math.abs(d))}</td></tr>`;
  });
  html += '</table>';
  if (isRecord) html += '<p style="color:#ffd23e">★ New stage record</p>';
  html += '<button onclick="restartRace()">Run Again (R)</button><button onclick="backToMenu()">Back to Menu</button>';
  $('results').innerHTML = html;
  $('results').style.display = 'flex';
}

function onLapComplete(car) {
  const now = raceTime * 1000;
  if (car.lap >= 0) {
    const lapMs = now - car.lapStart;
    car.lastLap = lapMs;
    if (!car.bestLap || lapMs < car.bestLap) car.bestLap = lapMs;
    if (car.isPlayer) {
      const key = 'apex_best_' + track.def.id;
      const stored = localStorage.getItem(key);
      if (!stored || lapMs < +stored) {
        localStorage.setItem(key, Math.round(lapMs));
        $('bestLap').textContent = 'Best ' + fmtTime(lapMs) + ' ★';
        toast('New best lap!');
      }
      $('lastLap').textContent = 'Last ' + fmtTime(lapMs);
    }
  }
  car.lapStart = now;
  car.lap++;
  // player just started the final lap -> ramp the music up
  if (car.isPlayer && mode === 'race' && car.lap === track.def.laps - 1) setMusicFinalLap(true);
  if (mode === 'race' && car.lap >= track.def.laps && !car.finished) {
    car.finished = true;
    car.finishTime = raceTime;
    if (car.isPlayer) endRace();
  }
}

// ---------------------------------------------------------------- audio
const audio = {};
// tanh-ish saturation curve — adds the combustion grit/exhaust rasp that makes a
// synth engine read as a real one instead of a buzz. Built once.
function makeDriveCurve(amount) {
  const n = 1024, curve = new Float32Array(n), k = amount;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
  return curve;
}
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }  // iOS/PWA re-suspends

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // ---- engine: a stack of harmonically-related oscillators feeding a drive/saturation
    // stage, a resonant lowpass whose cutoff opens with rpm+load, then a firing-rate
    // tremolo (the lumpy growl). Detune between the two saws gives an engine's rough beat.
    const engMix = ctx.createGain(); engMix.gain.value = 1;
    const sub   = ctx.createOscillator(); sub.type   = 'sawtooth';           // low block rumble (0.5x)
    const eng   = ctx.createOscillator(); eng.type   = 'sawtooth';           // fundamental firing
    const eng2  = ctx.createOscillator(); eng2.type  = 'sawtooth'; eng2.detune.value = 11; // beat/rough
    const harm  = ctx.createOscillator(); harm.type  = 'square';             // 2x metallic body
    const harm3 = ctx.createOscillator(); harm3.type = 'sawtooth';           // 3x exhaust wail
    const gSub = ctx.createGain();  gSub.gain.value  = 0.55;
    const gEng = ctx.createGain();  gEng.gain.value  = 0.6;
    const gEng2= ctx.createGain();  gEng2.gain.value = 0.5;
    const gHarm= ctx.createGain();  gHarm.gain.value = 0.16;
    const gH3  = ctx.createGain();  gH3.gain.value   = 0.05;                 // rises with throttle
    sub.connect(gSub);  eng.connect(gEng); eng2.connect(gEng2); harm.connect(gHarm); harm3.connect(gH3);
    gSub.connect(engMix); gEng.connect(engMix); gEng2.connect(engMix); gHarm.connect(engMix); gH3.connect(engMix);

    const shaper = ctx.createWaveShaper(); shaper.curve = makeDriveCurve(2.2); shaper.oversample = '2x';
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 1.1;
    const trem = ctx.createGain(); trem.gain.value = 1;          // firing-pulse growl multiplies here
    const engGain = ctx.createGain(); engGain.gain.value = 0;
    engMix.connect(shaper); shaper.connect(filt); filt.connect(trem); trem.connect(engGain); engGain.connect(master);

    // firing-rate LFO -> tremolo depth. Real engines are "lumpy" at idle, smooth at high rpm.
    const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 30;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.18;
    lfo.connect(lfoDepth); lfoDepth.connect(trem.gain);

    [sub, eng, eng2, harm, harm3, lfo].forEach(o => o.start());

    // ---- broadband noise: intake roar (rises with load) + reused for tyre skid
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    // intake
    const inFilt = ctx.createBiquadFilter(); inFilt.type = 'bandpass'; inFilt.frequency.value = 480; inFilt.Q.value = 0.7;
    const inGain = ctx.createGain(); inGain.gain.value = 0;
    noise.connect(inFilt); inFilt.connect(inGain); inGain.connect(master);
    // tyre skid
    const nFilt = ctx.createBiquadFilter(); nFilt.type = 'bandpass'; nFilt.frequency.value = 900; nFilt.Q.value = 0.9;
    const nGain = ctx.createGain(); nGain.gain.value = 0;
    noise.connect(nFilt); nFilt.connect(nGain); nGain.connect(master);
    noise.start();

    // separate bus for the procedural music so it mixes under the engine
    const musicGain = ctx.createGain(); musicGain.gain.value = 0.34;
    musicGain.connect(master);

    Object.assign(audio, { ctx, master, musicGain, sub, eng, eng2, harm, harm3, gH3, gHarm, filt, trem, lfo, lfoDepth, engGain, inGain, inFilt, nGain });
    if (window.ROAR) ROAR.init(audio);                 // the sound engine takes over (roar.js)
  } catch (e) { /* no audio */ }
}

// ---------------------------------------------------------------- procedural music
// Per-track chiptune loops built from oscillators; tempo ramps up on the final lap.
// Procedural genre engine ("Apex FM"). Each track gets a SONG — style/key/tempo/
// progression/seed — and the styles share real synth voices (supersaw, pad, sub bass)
// routed through a sidechain-ducked bus with convolver reverb and a tempo-synced echo.
// Form is a 16-bar loop: groove (8) / lift+lead (4) / break (2) / build (2).
const MUSIC = { playing: false, step: 0, bpm: 120, baseBpm: 120, nextT: 0, song: null, timer: null, lift: false, bus: null, motif: null };
const SCALES = {
  minor:  [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  major:  [0, 2, 4, 5, 7, 9, 11], mixo:   [0, 2, 4, 5, 7, 9, 10],
  penta:  [0, 3, 5, 7, 10],       pentaM: [0, 2, 4, 7, 9],
};
// Kart-racer genre set. duck: subtle kick pump (near 1 = none); swing: shuffle bounce
const MSTYLE = {
  circuit: { duck: 0.85, swing: 0.24 },   // bouncy major swing — brass stabs, oom-pah bass
  beach:   { duck: 0.90, swing: 0.28 },   // calypso — marimba comping, syncopated bass
  jungle:  { duck: 0.90, swing: 0.18 },   // bongo groove, pentatonic
  castle:  { duck: 0.72, swing: 0    },   // the boss track — driving minor, organ
  rainbow: { duck: 0.90, swing: 0.12 },   // dreamy bells + arps, halftime
  village: { duck: 0.90, swing: 0.30 },   // cozy strums, rim clicks
  jazz:    { duck: 0.95, swing: 0.42 },   // menu-lounge swing, walking bass
};
// prog: 8 bars of scale-degree chords; seed rolls the two lead phrases
const SONGS = {
  indy:        { style: 'circuit', root: 48, scale: 'major',  bpm: 140, prog: [0, 3, 4, 0, 0, 3, 4, 4], seed: 3 },
  monza:       { style: 'circuit', root: 50, scale: 'major',  bpm: 148, prog: [0, 4, 5, 3, 0, 4, 5, 4], seed: 11 },
  monaco:      { style: 'jazz',    root: 46, scale: 'major',  bpm: 126, prog: [1, 4, 0, 5, 1, 4, 0, 4], seed: 7 },
  silverstone: { style: 'circuit', root: 47, scale: 'major',  bpm: 138, prog: [0, 5, 3, 4, 0, 5, 3, 4], seed: 5 },
  suzuka:      { style: 'rainbow', root: 45, scale: 'pentaM', bpm: 128, prog: [0, 3, 1, 4, 0, 3, 1, 4], seed: 9 },
  homestead:   { style: 'village', root: 46, scale: 'mixo',   bpm: 108, prog: [0, 6, 3, 0, 0, 6, 4, 0], seed: 2 },
  coast:       { style: 'beach',   root: 48, scale: 'major',  bpm: 118, prog: [0, 3, 4, 0, 0, 3, 1, 4], seed: 8 },
  tech:        { style: 'castle',  root: 41, scale: 'minor',  bpm: 150, prog: [0, 3, 5, 4, 0, 3, 5, 6], seed: 13 },
  alpine:      { style: 'village', root: 43, scale: 'major',  bpm: 120, prog: [0, 4, 5, 0, 0, 4, 3, 4], seed: 4 },
  baja:        { style: 'jungle',  root: 45, scale: 'penta',  bpm: 136, prog: [0, 3, 4, 0, 0, 3, 4, 3], seed: 6 },
  montecarlo:  { style: 'jazz',    root: 44, scale: 'major',  bpm: 130, prog: [1, 4, 0, 3, 1, 4, 0, 4], seed: 21 },
  forestrally: { style: 'jungle',  root: 43, scale: 'penta',  bpm: 144, prog: [0, 3, 4, 3, 0, 3, 4, 4], seed: 17 },
  canyonmix:   { style: 'circuit', root: 43, scale: 'mixo',   bpm: 128, prog: [0, 6, 3, 0, 0, 6, 3, 4], seed: 12 },
  pinestage:   { style: 'castle',  root: 40, scale: 'minor',  bpm: 152, prog: [0, 1, 5, 6, 0, 1, 5, 6], seed: 19 },
  speedway:    { style: 'circuit', root: 45, scale: 'major',  bpm: 150, prog: [0, 3, 0, 4, 0, 3, 0, 4], seed: 23 },
  baygp:       { style: 'beach',   root: 45, scale: 'major',  bpm: 124, prog: [0, 5, 3, 4, 0, 5, 3, 4], seed: 14 },
  town:        { style: 'village', root: 48, scale: 'major',  bpm: 104, prog: [1, 4, 0, 5, 1, 4, 0, 3], seed: 1 },
  menu:        { style: 'jazz',    root: 46, scale: 'major',  bpm: 96,  prog: [3, 4, 0, 5, 3, 4, 0, 5], seed: 10 },
  _default:    { style: 'circuit', root: 45, scale: 'major',  bpm: 132, prog: [0, 3, 4, 0, 0, 3, 4, 4], seed: 42 },
};
function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function musicBus() {
  if (MUSIC.bus) return MUSIC.bus;
  const ctx = audio.ctx, out = audio.musicGain;
  const duck = ctx.createGain(); duck.connect(out);                    // pitched voices pump against the kick
  const dry = ctx.createGain(); dry.connect(out);                      // drums stay solid
  const verb = ctx.createConvolver(); verb.buffer = _reverbIR(ctx, 2.1, 2.9);
  const verbG = ctx.createGain(); verbG.gain.value = 0.3; verb.connect(verbG); verbG.connect(out);
  const dSend = ctx.createGain(); dSend.gain.value = 0.08; dry.connect(dSend); dSend.connect(verb);
  const echo = ctx.createDelay(1.5);
  const echoFb = ctx.createGain(); echoFb.gain.value = 0.35; echo.connect(echoFb); echoFb.connect(echo);
  const echoG = ctx.createGain(); echoG.gain.value = 0.45; echo.connect(echoG); echoG.connect(duck);
  const eSend = ctx.createGain(); eSend.gain.value = 0.25; echo.connect(eSend); eSend.connect(verb);
  const dist = ctx.createWaveShaper(); dist.curve = makeDriveCurve(3.4); dist.oversample = '2x';
  const distG = ctx.createGain(); distG.gain.value = 0.5; dist.connect(distG); distG.connect(duck);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const hissSrc = ctx.createBufferSource(); hissSrc.buffer = noise; hissSrc.loop = true; hissSrc.playbackRate.value = 0.3;
  const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3800; hf.Q.value = 0.4;
  const hiss = ctx.createGain(); hiss.gain.value = 0;                  // tape hiss, lofi only
  hissSrc.connect(hf); hf.connect(hiss); hiss.connect(out); hissSrc.start();
  MUSIC.bus = { duck, dry, verb, echo, dist, hiss, noise };
  return MUSIC.bus;
}
function mOsc(type, freq, det) {
  const o = audio.ctx.createOscillator();
  o.type = type; o.frequency.value = freq; if (det) o.detune.value = det;
  return o;
}
// stacked thirds up the scale from a degree — diatonic chords in any of the SCALES
function chordTones(scaleName, deg, n) {
  const sc = SCALES[scaleName], L = sc.length, res = [];
  for (let k = 0; k < n; k++) { const i = deg + 2 * k; res.push(sc[i % L] + 12 * Math.floor(i / L)); }
  return res;
}
// deterministic per-song 2-bar phrase: mostly stepwise 8ths (kart tunes sing constantly),
// chord tones on downbeats, the odd playful leap, a breath at phrase ends, resolves home
function makeMotif(seed) {
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const m = []; let deg = 4;                       // start mid-register
  for (let i = 0; i < 16; i++) {
    if (rnd() < 0.18 && i % 4 === 3) { m.push(-1); continue; }
    deg += rnd() < 0.15 ? (rnd() < 0.5 ? 3 : -3) : Math.round((rnd() - 0.5) * 2.2);
    deg = Math.max(0, Math.min(9, deg));
    m.push(i % 4 === 0 ? deg & ~1 : deg);
  }
  m[15] = 0;
  return m;
}
// ---- voices ----------------------------------------------------------------
function vPad(t, midis, dur) {                                 // slow washy chord bed
  const ctx = audio.ctx, b = musicBus();
  const g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.045, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.04);
  g.connect(lp); lp.connect(b.duck);
  const s = ctx.createGain(); s.gain.value = 0.6; lp.connect(s); s.connect(b.verb);
  for (const m of midis) for (const d of [-7, 7]) {
    const o = mOsc('sawtooth', midiHz(m), d); o.connect(g); o.start(t); o.stop(t + dur * 1.05 + 0.05);
  }
}
function vSub(t, midi, dur, vel) {                             // sine sub + tri body
  const ctx = audio.ctx, b = musicBus(), f = midiHz(midi);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.5;
  const o = mOsc('sine', f), o2 = mOsc('triangle', f);
  o.connect(g); o2.connect(g2); g2.connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.008);
  g.gain.setValueAtTime(vel, t + Math.max(0.01, dur - 0.05));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  g.connect(b.duck);
  o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
}
function vBass(t, midi, dur, vel, drive) {                     // filtered saw bass (drive = through the shaper)
  const ctx = audio.ctx, b = musicBus(), f = midiHz(midi);
  const g = ctx.createGain(), gs = ctx.createGain(); gs.gain.value = 0.6;
  const o = mOsc('sawtooth', f), o2 = mOsc('square', f, -1200);
  o.connect(g); o2.connect(gs); gs.connect(g);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 6, t);
  lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  g.connect(lp); lp.connect(drive ? b.dist : b.duck);
  o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
}
function vKeys(t, midi, dur, vel) {                            // mellow EP for the lofi styles
  const ctx = audio.ctx, b = musicBus(), f = midiHz(midi);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.3;
  const o = mOsc('triangle', f), o2 = mOsc('sine', f * 2.005);
  o.connect(g); o2.connect(g2); g2.connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  g.connect(lp); lp.connect(b.duck);
  const s = ctx.createGain(); s.gain.value = 0.4; lp.connect(s); s.connect(b.verb);
  o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
}
function strumKeys(t, midis, dur, vel) { midis.forEach((m, i) => vKeys(t + i * 0.03, m, dur, vel)); }
function vMarimba(t, midi, dur, vel) {                         // bright wooden pluck: sine + 4th-partial blip
  const ctx = audio.ctx, b = musicBus(), f = midiHz(midi);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.35;
  const o = mOsc('sine', f), o2 = mOsc('sine', f * 4.02);
  o.connect(g); o2.connect(g2); g2.connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(dur, 0.5));
  g.connect(b.duck);
  const s = ctx.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(b.verb);
  o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + 0.08);
}
function vBrass(t, midi, dur, vel) {                           // scooped saw stab — the kart fanfare voice
  const ctx = audio.ctx, b = musicBus(), f = midiHz(midi);
  const g = ctx.createGain();
  for (const d of [-7, 7]) {
    const o = mOsc('sawtooth', f, d);
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.05);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
  lp.frequency.setValueAtTime(f * 2.2, t);
  lp.frequency.linearRampToValueAtTime(f * 4.5, t + 0.06);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel / 2, t + 0.02);
  g.gain.setValueAtTime(vel / 2, t + Math.max(0.02, dur - 0.06));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  g.connect(lp); lp.connect(b.duck);
  const s = ctx.createGain(); s.gain.value = 0.2; lp.connect(s); s.connect(b.verb);
}
function vBell(t, midi, dur, vel) {                            // glassy rainbow-road bell
  const ctx = audio.ctx, b = musicBus(), f = midiHz(midi);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.3;
  const o = mOsc('sine', f), o2 = mOsc('sine', f * 3.01);
  o.connect(g); o2.connect(g2); g2.connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  g.connect(b.duck);
  const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(b.echo);
  o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
}
function vOrgan(t, midis, dur, vel) {                          // castle organ — square + tri drawbars
  const ctx = audio.ctx, b = musicBus();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.02);
  g.gain.setValueAtTime(vel, t + Math.max(0.02, dur - 0.05));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  g.connect(lp); lp.connect(b.duck);
  const s = ctx.createGain(); s.gain.value = 0.3; lp.connect(s); s.connect(b.verb);
  for (const m of midis) {
    const f = midiHz(m);
    const o = mOsc('square', f), g2 = ctx.createGain(); g2.gain.value = 0.55; o.connect(g2); g2.connect(g);
    const o2 = mOsc('triangle', f * 2), g3 = ctx.createGain(); g3.gain.value = 0.45; o2.connect(g3); g3.connect(g);
    o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
  }
}
// ---- drums -----------------------------------------------------------------
function dNoise(t, dur, freq, vel, type) {
  const ctx = audio.ctx, b = musicBus();
  const s = ctx.createBufferSource(); s.buffer = b.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(b.dry);
  s.start(t); s.stop(t + dur + 0.02);
}
function dKick(t, vel) {
  const ctx = audio.ctx, b = musicBus();
  const o = mOsc('sine', 155);
  o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.95 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
  o.connect(g); g.connect(b.dry); o.start(t); o.stop(t + 0.2);
  dNoise(t, 0.018, 3200, 0.25 * vel);                                  // beater click
  const d = b.duck.gain, spb = 60 / MUSIC.bpm / 4;                     // sidechain pump
  d.cancelScheduledValues(t);
  d.setValueAtTime(MSTYLE[MUSIC.song.style].duck, t);
  d.linearRampToValueAtTime(1, t + spb * 3.2);
}
function dSnare(t, vel) {
  dNoise(t, 0.16, 1500, 0.5 * vel);
  const ctx = audio.ctx, b = musicBus();
  const o = mOsc('triangle', 187), g = ctx.createGain();
  g.gain.setValueAtTime(0.35 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g); g.connect(b.dry); o.start(t); o.stop(t + 0.1);
}
function dHat(t, open, vel) { dNoise(t, open ? 0.24 : 0.035, 7800, vel); }
function dWood(t, vel) {                                       // woodblock tick
  const ctx = audio.ctx, b = musicBus();
  const o = mOsc('sine', 1650), g = ctx.createGain();
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  o.connect(g); g.connect(b.dry); o.start(t); o.stop(t + 0.05);
}
function dBongo(t, hi, vel) {
  const ctx = audio.ctx, b = musicBus(), f0 = hi ? 540 : 370;
  const o = mOsc('sine', f0);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g); g.connect(b.dry); o.start(t); o.stop(t + 0.11);
}
function dShaker(t, vel) { dNoise(t, 0.045, 5200, vel, 'bandpass'); }
function dRim(t, vel) {                                        // side-stick click
  dNoise(t, 0.02, 3600, 0.2 * vel);
  const ctx = audio.ctx, b = musicBus();
  const o = mOsc('sine', 880), g = ctx.createGain();
  g.gain.setValueAtTime(0.4 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  o.connect(g); g.connect(b.dry); o.start(t); o.stop(t + 0.04);
}
// ---- sequencer -------------------------------------------------------------
function musicStep(s, t, spb) {
  const song = MUSIC.song, st = song.style, P = MSTYLE[st];
  const bar = (s >> 4) % 16, b16 = s % 16, q = b16 >> 2;
  let sec = bar < 8 ? 0 : bar < 12 ? 1 : bar < 14 ? 2 : 3;    // A-phrase / B-phrase / break / fill
  if (MUSIC.lift) sec = bar < 8 ? 0 : bar < 14 ? 1 : 3;       // final lap: no break, keep singing
  const root = song.root + (MUSIC.lift ? 1 : 0);              // final lap rides a semitone up
  const sc = SCALES[song.scale], L = sc.length;
  const deg = song.prog[bar % 8], degN = song.prog[(bar + 1) % 8];
  const cRoot = root + sc[deg % L] + 12 * Math.floor(deg / L);
  const nRoot = root + sc[degN % L] + 12 * Math.floor(degN / L);
  const tones = chordTones(song.scale, deg, 4).map(x => root + x);
  const tS = t + (b16 % 2 ? P.swing * spb : 0);               // shuffled offbeats
  const drums = sec !== 2 || st === 'jungle';                 // the jungle break keeps its bongos
  const fill = sec === 3 && b16 >= 8;
  // percussion
  if (st === 'circuit' || st === 'village') {
    if (drums && (b16 === 0 || b16 === 8)) dKick(t, st === 'circuit' ? 0.9 : 0.7);
    if (drums && (b16 === 4 || b16 === 12)) { if (st === 'circuit') dSnare(t, 0.7); else dRim(t, 0.8); }
    if (b16 % 2 === 1) dWood(tS, b16 % 4 === 3 ? 0.5 : 0.3);
    if (drums && b16 % 2 === 0) dHat(tS, false, 0.06);
  } else if (st === 'beach') {
    if (drums && (b16 === 0 || b16 === 8)) dKick(t, 0.8);
    if (drums && (b16 === 4 || b16 === 12)) dRim(t, 0.8);
    dShaker(tS, b16 % 4 === 0 ? 0.22 : 0.1);
    if (drums && (b16 === 3 || b16 === 11)) dBongo(tS, b16 === 3, 0.6);
  } else if (st === 'jungle') {
    if (sec !== 2 && (b16 === 0 || b16 === 8)) dKick(t, 0.95);
    if ([0, 3, 4, 7, 8, 11, 12, 15].indexOf(b16) >= 0) dBongo(tS, b16 % 8 < 4, 0.8);
    dShaker(tS, b16 % 2 ? 0.12 : 0.07);
    if (sec !== 2 && b16 === 12) dSnare(t, 0.5);
  } else if (st === 'castle') {
    if (drums && b16 % 4 === 0) dKick(t, 1);
    if (drums && (b16 === 4 || b16 === 12)) dSnare(t, 0.9);
    if (b16 % 2 === 1) dHat(tS, false, 0.11);
    if (sec >= 1 && b16 === 14) dHat(tS, true, 0.13);
  } else if (st === 'rainbow') {
    if (drums && b16 === 0) dKick(t, 0.7);
    if (drums && b16 === 8) dSnare(t, 0.5);                   // halftime backbeat
    if (b16 % 2 === 0) dHat(tS, false, 0.06);
    if (b16 === 14) dHat(tS, true, 0.1);
  } else if (st === 'jazz') {
    if (drums && (b16 === 0 || b16 === 8)) dKick(t, 0.45);
    if (b16 % 4 === 0) dHat(tS, false, 0.16);                 // ride quarters
    if (b16 % 8 === 6) dHat(t + P.swing * 2 * spb, false, 0.1);   // swung skip note
    if (drums && (b16 === 4 || b16 === 12)) dRim(t, 0.4);
  }
  if (fill) {                                                 // 1-bar tom-ish fill into the loop
    if (b16 % 2 === 0) dBongo(t, (b16 >> 1) % 2 === 0, 0.5 + (b16 - 8) * 0.05);
    dSnare(t, 0.18 + (b16 - 8) * 0.06);
  }
  // bass
  if (sec !== 2) {
    if (st === 'circuit' || st === 'village') {               // oom-pah: root / fifth quarters
      if (b16 % 4 === 0) vSub(t, (q % 2 === 0 ? cRoot : cRoot + 7) - 12, spb * 2.2, q % 2 === 0 ? 0.5 : 0.38);
      if (b16 === 14) vSub(tS, (nRoot > cRoot ? nRoot - 1 : nRoot + 1) - 12, spb * 1.6, 0.3);   // walk-in
    } else if (st === 'beach') {
      if ([0, 6, 8, 14].indexOf(b16) >= 0) vSub(t, cRoot - 12 + (b16 === 14 ? 7 : 0), spb * 3, 0.48);
    } else if (st === 'jungle') {
      if ([0, 3, 8, 11].indexOf(b16) >= 0) vSub(t, cRoot - 12, spb * 2.2, 0.5);
    } else if (st === 'castle') {
      if (b16 % 2 === 0) vBass(t, cRoot - 12, spb * 1.7, 0.45, true);
    } else if (st === 'rainbow') {
      if (b16 === 0 || b16 === 8) vSub(t, cRoot - 12, spb * 7, 0.42);
    } else if (st === 'jazz') {                               // walking quarters
      if (b16 % 4 === 0) vSub(t, [cRoot, tones[1], tones[2], nRoot + (nRoot > cRoot ? -1 : 1)][q] - 12, spb * 3.4, 0.42);
    }
  }
  // comping
  if (st === 'circuit' && drums && (b16 === 3 || b16 === 11)) tones.slice(0, 3).forEach(x => vBrass(tS, x, spb * 1.6, 0.1));
  if (st === 'beach' && b16 % 2 === 0 && sec !== 3) vMarimba(tS, tones[[0, 2, 1, 3, 2, 0, 1, 2][b16 >> 1]] + 12, spb * 1.8, 0.16);
  if (st === 'jungle' && sec !== 3 && (b16 === 2 || b16 === 10)) vMarimba(tS, tones[b16 === 2 ? 0 : 2] + 12, spb * 2, 0.15);
  if (st === 'castle' && b16 === 0) vOrgan(t, tones.slice(0, 3).map(x => x + 12), spb * 15, 0.05);
  if (st === 'rainbow' && sec !== 3) vKeys(tS, tones[b16 % 4] + 24, spb * 1.4, 0.07);
  if (st === 'village' && (b16 === 0 || b16 === 10)) strumKeys(tS, tones.slice(0, 3).map(x => x + 12), spb * 6, 0.12);
  if (st === 'jazz' && (b16 === 0 || b16 === 7 || (bar % 2 === 1 && b16 === 11))) tones.forEach((x, i) => vKeys(tS + i * 0.012, x + 12, spb * 3, 0.09));
  if (b16 === 0 && (sec === 2 || st === 'rainbow')) vPad(t, tones.map(x => x + 12), spb * 16);
  // melody — the tune is the star: it sings through A and B, each with its own phrase
  if (sec <= 1 && b16 % 2 === 0) {
    const m = (sec === 0 ? MUSIC.motif : MUSIC.motifB)[(s >> 1) % 16];
    if (m >= 0) {
      const d = deg + m;
      const note = root + 24 + sc[d % L] + 12 * Math.floor(d / L);
      if (st === 'castle') vOrgan(tS, [note], spb * 2, 0.14);
      else if (st === 'rainbow') vBell(tS, note, spb * 4, 0.16);
      else if (st === 'beach' || st === 'jungle') vMarimba(tS, note, spb * 2.4, 0.22);
      else if (st === 'jazz' || st === 'village') vKeys(tS, note, spb * 2.6, 0.14);
      else vBrass(tS, note, spb * 1.9, 0.16);                 // circuit fanfare lead
    }
  }
}
function musicTick() {
  if (!MUSIC.playing || !audio.ctx) return;
  const spb = 60 / MUSIC.bpm / 4;                 // seconds per 16th step
  const now = audio.ctx.currentTime;
  if (MUSIC.nextT < now - 0.25) MUSIC.nextT = now + 0.05;   // after a stall, don't burst-schedule
  while (MUSIC.nextT < now + 0.15) {
    musicStep(MUSIC.step, MUSIC.nextT, spb);
    MUSIC.step = (MUSIC.step + 1) % 256;                    // 16 bars of 16ths
    MUSIC.nextT += spb;
  }
}
function startMusic(def) {
  if (window.RALLYHOUSE) { stopMusic(); RALLYHOUSE.start(def, audio); return; }
  if (!audio.ctx) return;
  const song = SONGS[def.id] || SONGS._default;
  MUSIC.song = song; MUSIC.motif = makeMotif(song.seed); MUSIC.motifB = makeMotif(song.seed + 7); MUSIC.lift = false;
  MUSIC.baseBpm = MUSIC.bpm = song.bpm;
  MUSIC.step = 0; MUSIC.nextT = audio.ctx.currentTime + 0.1; MUSIC.playing = true;
  const b = musicBus();
  b.echo.delayTime.value = 45 / song.bpm;                   // dotted-8th echo, tempo-synced
  b.hiss.gain.value = song.style === 'village' ? 0.01 : 0;
  b.duck.gain.cancelScheduledValues(0); b.duck.gain.value = 1;
  if (audio.musicGain) audio.musicGain.gain.value = muted ? 0 : 0.34;
  if (!MUSIC.timer) MUSIC.timer = setInterval(musicTick, 40);
}
function stopMusic() {
  if (window.RALLYHOUSE) RALLYHOUSE.stop();
  MUSIC.playing = false; MUSIC.lift = false;
  if (MUSIC.timer) { clearInterval(MUSIC.timer); MUSIC.timer = null; }
  if (MUSIC.bus) MUSIC.bus.hiss.gain.value = 0;
}
function setMusicFinalLap(on) { if (window.RALLYHOUSE) RALLYHOUSE.finalLap(on); MUSIC.lift = on; MUSIC.bpm = Math.round(MUSIC.baseBpm * (on ? 1.10 : 1)); }   // kart rules: faster AND a semitone up

// ---------------------------------------------------------------- Verstappen's entrance theme
// Bass-heavy boss motif that RADIATES from his car (3D panner), with exaggerated Doppler as he
// blasts past + big reverb. Comedy is the point.
const _v3 = new THREE.Vector3();                           // scratch for camera direction
const VTHEME = { on: false, car: null, step: 0, nextT: 0, bassNote: 33, leadNote: 57, nodes: null };
const VT_ROOT = 33;                                        // low, menacing
const VT_BASS = [0, 0, 7, 0, 5, 5, 3, 5, 0, 0, 7, 0, 8, 8, 7, 5];       // 16-step ostinato (semitones)
const VT_LEAD = [12, -1, 15, -1, 14, -1, 12, 10, 12, -1, 19, 17, 15, 14, 12, -1]; // -1 = rest
function _audPos(n, x, y, z) { if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z; } else if (n.setPosition) { n.setPosition(x, y, z); } }
function _audOri(n, fx, fy, fz, ux, uy, uz) { if (n.forwardX) { n.forwardX.value = fx; n.forwardY.value = fy; n.forwardZ.value = fz; n.upX.value = ux; n.upY.value = uy; n.upZ.value = uz; } else if (n.setOrientation) { n.setOrientation(fx, fy, fz, ux, uy, uz); } }
function _reverbIR(ctx, sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
function startVerstappenTheme(car) {
  if (!audio.ctx || !car) return; const ctx = audio.ctx;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 28; panner.maxDistance = 2600; panner.rolloffFactor = 1.0;
  const mix = ctx.createGain(); mix.gain.value = 1.0;
  const boost = ctx.createBiquadFilter(); boost.type = 'lowshelf'; boost.frequency.value = 200; boost.gain.value = 15; mix.connect(boost);
  const dry = ctx.createGain(); dry.gain.value = 1.0; boost.connect(dry); dry.connect(panner);
  const conv = ctx.createConvolver(); conv.buffer = _reverbIR(ctx, 2.8, 2.4);
  const rs = ctx.createGain(); rs.gain.value = 0.55; boost.connect(rs); rs.connect(conv);
  const rg = ctx.createGain(); rg.gain.value = 0.7; conv.connect(rg); rg.connect(panner);
  panner.connect(audio.master);
  const subEnv = ctx.createGain(); subEnv.gain.value = 0.0001;                 // omni sub you FEEL, beat-gated
  const subProx = ctx.createGain(); subProx.gain.value = 0; subEnv.connect(subProx); subProx.connect(audio.master);
  const lead = ctx.createOscillator(); lead.type = 'sawtooth';
  const lead2 = ctx.createOscillator(); lead2.type = 'square'; lead2.detune.value = 9;
  const bass = ctx.createOscillator(); bass.type = 'sawtooth';
  const sub = ctx.createOscillator(); sub.type = 'sine';
  const leadG = ctx.createGain(); leadG.gain.value = 0.0001; lead.connect(leadG); lead2.connect(leadG); leadG.connect(mix);
  const bassG = ctx.createGain(); bassG.gain.value = 0.0001; bass.connect(bassG); bassG.connect(mix);
  sub.connect(subEnv);
  [lead, lead2, bass, sub].forEach(o => o.start());
  VTHEME.on = true; VTHEME.car = car; VTHEME.step = 0; VTHEME.nextT = ctx.currentTime + 0.05;
  VTHEME.nodes = { panner, mix, dry, conv, rs, rg, lead, lead2, bass, sub, leadG, bassG, subEnv, subProx };
}
function stopVerstappenTheme() {
  if (!VTHEME.on) return; VTHEME.on = false;
  try { const n = VTHEME.nodes; [n.lead, n.lead2, n.bass, n.sub].forEach(o => { try { o.stop(); } catch (e) {} }); } catch (e) {}
  VTHEME.nodes = null; VTHEME.car = null;
}
function updateVerstappenTheme() {
  if (!VTHEME.on || !audio.ctx || !player || !VTHEME.car) return;
  const ctx = audio.ctx, n = VTHEME.nodes, car = VTHEME.car;
  _audPos(ctx.listener, camera.position.x, camera.position.y, camera.position.z);
  const fwd = camera.getWorldDirection(_v3);
  _audOri(ctx.listener, fwd.x, fwd.y, fwd.z, 0, 1, 0);
  _audPos(n.panner, car.x, car.y + 1.2, car.z);
  // exaggerated Doppler from radial relative velocity (source vs listener along the sightline)
  const dx = car.x - camera.position.x, dz = car.z - camera.position.z, dist = Math.hypot(dx, dz) || 1;
  const vrel = ((car.velX - player.velX) * dx + (car.velZ - player.velZ) * dz) / dist;   // + = receding
  const C = 200; let dopp = C / (C + vrel); dopp = Math.max(0.5, Math.min(1.85, dopp));
  const spb = 60 / 126 / 4;
  if (VTHEME.nextT < ctx.currentTime - 0.5) VTHEME.nextT = ctx.currentTime;      // after a pause, don't burst
  while (VTHEME.nextT < ctx.currentTime + 0.1) {
    const t = VTHEME.nextT, s = VTHEME.step % 16;
    VTHEME.bassNote = VT_ROOT + VT_BASS[s];
    const ld = VT_LEAD[s]; if (ld >= 0) VTHEME.leadNote = VT_ROOT + 24 + ld;
    n.bassG.gain.cancelScheduledValues(t); n.bassG.gain.setValueAtTime(0.35, t); n.bassG.gain.exponentialRampToValueAtTime(0.08, t + spb * 1.6);
    if (s % 2 === 0) { n.subEnv.gain.cancelScheduledValues(t); n.subEnv.gain.setValueAtTime(1.0, t); n.subEnv.gain.exponentialRampToValueAtTime(0.02, t + spb * 2.2); }
    if (ld >= 0) { n.leadG.gain.cancelScheduledValues(t); n.leadG.gain.setValueAtTime(0.2, t); n.leadG.gain.exponentialRampToValueAtTime(0.02, t + spb * 1.8); }
    VTHEME.step++; VTHEME.nextT += spb;
  }
  n.bass.frequency.value = midiHz(VTHEME.bassNote) * dopp;
  n.sub.frequency.value = midiHz(VTHEME.bassNote - 12) * dopp;
  n.lead.frequency.value = midiHz(VTHEME.leadNote) * dopp;
  n.lead2.frequency.value = midiHz(VTHEME.leadNote) * dopp;
  n.subProx.gain.setTargetAtTime(0.55 * Math.max(0, 1 - dist / 220), ctx.currentTime, 0.05);
}
function updateAudio(dt) {
  if (!audio.ctx || !player) return;
  if (window.ROAR && ROAR.ready) { ROAR.update(dt); return; }   // roar.js owns the mix
  const active = state === 'race' || state === 'tt' || state === 'countdown';
  const speed = Math.hypot(player.velX, player.velZ);
  const thr = Math.max(keys['w'] ? 1 : 0, throttlePedal || 0);   // 0..1 load
  // revs rise smoothly with speed; throttle adds a little "pull"
  const rpm = player.rpm || 0;
  const f = 48 + rpm * rpm * 300 + thr * 16;
  const g = (o, v) => { if (o) o.frequency.setTargetAtTime(v, audio.ctx.currentTime, 0.03); };
  g(audio.sub,   f * 0.5);
  g(audio.eng,   f);
  g(audio.eng2,  f);
  g(audio.harm,  f * 2);
  g(audio.harm3, f * 3);
  audio.eng2.detune.value = 9 + rpm * 15;                        // beat widens with revs
  // firing pulses track rpm; the growl is deep at idle and fades out up top
  const firing = Math.max(24, f * 1.05);
  audio.lfo.frequency.setTargetAtTime(firing, audio.ctx.currentTime, 0.05);
  audio.lfoDepth.gain.value = Math.max(0.02, 0.22 - rpm * 0.19);
  // brightness opens with rpm AND throttle (load) — the on-throttle "snarl"
  audio.filt.frequency.setTargetAtTime(500 + rpm * 2300 + thr * 900, audio.ctx.currentTime, 0.04);
  audio.gH3.gain.setTargetAtTime(0.04 + thr * 0.14, audio.ctx.currentTime, 0.05);   // exhaust wail under power
  audio.engGain.gain.setTargetAtTime(active ? 0.16 + Math.min(speed / 260, 0.1) : 0, audio.ctx.currentTime, 0.05);
  // intake roar: louder with revs & throttle
  audio.inFilt.frequency.value = 380 + rpm * 720;
  audio.inGain.gain.setTargetAtTime(active ? Math.min(speed / 900, 0.05) + thr * 0.03 : 0, audio.ctx.currentTime, 0.06);
  // tyre scrub
  audio.nGain.gain.setTargetAtTime(active && player.slip > 5 && player.onRoad ? Math.min((player.slip - 5) / 40, 0.16) : 0, audio.ctx.currentTime, 0.03);
  updateVerstappenTheme();                          // spatial + doppler theme radiating from his car
}

// ---------------------------------------------------------------- minimap
let miniBase = null, miniScale = null;
function buildMinimap(def) {
  const cv = $('minimap');
  miniBase = document.createElement('canvas');
  miniBase.width = cv.width; miniBase.height = cv.height;
  miniScale = drawTrackThumb(miniBase, def, 'rgba(255,255,255,0.85)');
}
function drawMinimap() {
  const cv = $('minimap'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(miniBase, 0, 0);
  for (const c of cars) {
    ctx.fillStyle = c.isPlayer ? '#ffffff' : '#' + c.color.toString(16).padStart(6, '0');
    ctx.beginPath();
    ctx.arc(c.x * miniScale.s + miniScale.ox, c.z * miniScale.s + miniScale.oz, c.isPlayer ? 4 : 3, 0, 7);
    ctx.fill();
    if (c.isPlayer) { ctx.strokeStyle = '#222'; ctx.stroke(); }
  }
}

// ---------------------------------------------------------------- HUD
let _lbT = 0;
function updateLeaderboard(order) {
  const lb = $('leaderboard'); lb.style.display = 'flex';
  const now = performance.now();
  if (now - _lbT < 130) return;                    // ~8Hz rebuild is plenty
  _lbT = now;
  let html = '';
  for (let i = 0; i < order.length; i++) {
    const c = order[i], hex = '#' + c.color.toString(16).padStart(6, '0');
    html += `<div class="lbRow${c.isPlayer ? ' me' : ''}${c.finished ? ' done' : ''}">`
      + `<span class="pos">${i + 1}</span><span class="sw" style="background:${hex}"></span>`
      + `<span class="nm">${c.name}</span></div>`;
  }
  lb.innerHTML = html;
}
let _revEls = null;
function updateGearHud() {}   // v10.1: the gear system is gone — no digit, no shift lights
function updateHUD() {
  const speed = Math.round(Math.hypot(player.velX, player.velZ) * 3.6 * SPEED_DISPLAY_SCALE);
  $('speed').textContent = speed;
  updateGearHud();
  if (mode === 'freeroam') {
    $('position').textContent = player.onRoad ? 'Free Roam' : 'Off-road';
    $('lapCount').textContent = 'Crescent Bay';
    $('curLap').textContent = '';
    $('leaderboard').style.display = 'none';
    return;
  }
  if (mode === 'stage') {
    $('position').textContent = 'Rally Stage';
    const pct = Math.round((player.idx / track.N) * 100);
    $('lapCount').textContent = player.finished ? 'Finished' : pct + '% of stage';
    $('leaderboard').style.display = 'none';
    $('curLap').textContent = fmtTime(state === 'race' ? raceTime * 1000 : null);
    return;
  }
  if (mode === 'race') {
    const order = [...cars].sort((a, b) => (b.lap * track.N + b.distAcc) - (a.lap * track.N + a.distAcc));
    const pos = order.indexOf(player) + 1;
    $('position').textContent = 'P' + pos + ' / ' + cars.length;
    $('lapCount').textContent = 'Lap ' + Math.min(player.lap + 1, track.def.laps) + ' / ' + track.def.laps;
    updateLeaderboard(order);
  } else {
    $('position').textContent = 'Time Trial';
    $('lapCount').textContent = player.lap >= 1 ? 'Lap ' + (player.lap + 1) : 'Out lap';
    $('leaderboard').style.display = 'none';
  }
  $('curLap').textContent = fmtTime(player.lap >= 0 || mode === 'race' ? raceTime * 1000 - player.lapStart : null);
}

// ---------------------------------------------------------------- main loop
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.05);

  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = '0'; }
  if (state === 'menu' || state === 'paused' || !track) return;

  if (state === 'countdown') {
    countdownT -= dt;
    const el = $('countdown');
    if (countdownT > 2.4) { el.textContent = '3'; setLights(1); }
    else if (countdownT > 1.2) { el.textContent = '2'; setLights(2); }
    else if (countdownT > 0) { el.textContent = '1'; setLights(3); }
    else {
      el.textContent = 'GO!'; setLights(0, true);
      state = 'race'; raceTime = 0;
      cars.forEach(c => { c.lapStart = 0; });
      setTimeout(() => { el.textContent = ''; }, 900);
    }
    el.style.display = 'block';
    updateCarVisuals(dt);
    render(dt); updateAudio(dt);
    return;
  }

  if (state === 'race' || state === 'tt' || state === 'freeroam') {
    raceTime += dt;
    // per-bot fluctuating top-speed limiter: slowly breathe each bot's cap within its shown-speed
    // band. Fast tier squares the wave so it hangs near the low end (195) and only rarely nears 200.
    const shownToWorld = 1 / (3.6 * SPEED_DISPLAY_SCALE);
    for (const c of cars) {
      if (c.isPlayer || !c.topHi) continue;
      let n = 0.5 + 0.5 * Math.sin(raceTime * c.topW + c.topPhase);   // 0..1
      if (c.topBias) n *= n;                                          // skew toward the low end
      c.vCap = (c.topLo + (c.topHi - c.topLo) * n) * shownToWorld;
    }
    // analog click pedals: ease travel toward the held state (press ~0.13s, release ~0.09s)
    throttlePedal += ((mouseThrottle ? 1 : 0) - throttlePedal) * (1 - Math.exp(-dt / (mouseThrottle ? 0.13 : 0.09)));
    brakePedal    += ((mouseBrake    ? 1 : 0) - brakePedal)    * (1 - Math.exp(-dt / (mouseBrake    ? 0.13 : 0.09)));
    if (throttlePedal < 0.02 && !mouseThrottle) throttlePedal = 0;
    if (brakePedal < 0.02 && !mouseBrake) brakePedal = 0;
    const kThr = (keys['w'] || keys['arrowup']) ? 1 : 0;
    const kBrk = (keys['s'] || keys['arrowdown']) ? 1 : 0;
    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const car of cars) {
        let input;
        if (car.isPlayer && !car.finished) {            // finished player cruises on AI (results are up)
          const now = performance.now();
          const hidGas = (now - hidGasLast) < HID_TIMEOUT;      // pedal seen "pushed" recently
          const hidBrk = (now - hidBrakeLast) < HID_TIMEOUT;
          const thr = Math.max(kThr, throttlePedal, hidGas ? 1 : 0, window.TOUCH ? TOUCH.thr : 0);
          let brk = Math.max(kBrk, brakePedal, phoneBrake ? 1 : 0, hidBrk ? 1 : 0, window.TOUCH ? TOUCH.brk : 0);
          // off the gas (and not braking) => gentle engine-braking so lifting off slows you a little
          if (thr < 0.06 && brk < 0.06) brk = COAST_BRAKE;
          input = { throttle: thr, brake: brk, steer: playerSteer(),
                    handbrake: (keys[' '] || (window.TOUCH && TOUCH.hb)) ? 1 : 0 };
        } else if (car.traffic) {
          input = trafficInputs(car);              // open-world civilians pootling about
        } else if (car.finished) {
          input = aiInputs(car); input.throttle = Math.min(input.throttle, 0.4);
        } else {
          input = aiInputs(car);
        }
        if (window.DMG) input = DMG.modInput(car, input, sub);          // damage speaks through the controls
        if (car.air) input = { ...input, steer: input.steer * 0.25 };   // limited authority mid-glide
        if (car.spun > 0) input = { throttle: 0, brake: 0.35, steer: 0, handbrake: 0 };
        if (car.netPuppet || car.netGhostCom) {
          // a live friend (or the host's feed of a local) drives this kart — NET moves it,
          // we only keep its lap-progress bookkeeping honest for the leaderboard
          car.idx = nearestSample(car.x, car.z, car.idx, 40);
          car.distAcc = car.idx;
        } else {
          const before = car.distAcc;
          stepCar(car, input, sub);
          if (track.stage) { if (car.isPlayer) stageProgress(car); }   // open curve: no lap wrap
          else if (before < track.N && car.distAcc >= track.N) { car.distAcc -= track.N; onLapComplete(car); }
          else if (car.distAcc < -track.N * 0.5) { car.distAcc += track.N; car.lap--; }
        }
      }
      if (liveResults) updateLiveResults();
      collideCars(sub);
    }
    if (window.ITEMS) ITEMS.update(dt);
    if (window.DMG) DMG.update(dt);
    updateCarVisuals(dt);
    updateHUD();
    if (!track.open) drawMinimap();
    // phone haptics: heavy shake when you're off the track; a light rumble on the Dust Devil dirt
    if (typeof sendRumble === 'function') {
      const pv = Math.hypot(player.velX, player.velZ);
      let rumble = 0;
      if (!player.onRoad) rumble = Math.min(1, 0.7 + pv / 25);                          // off track: lots of shake
      else if (track.def.surface === 'dirt') rumble = 0.22 * Math.min(1, 0.5 + pv / 45); // baja dirt: slight
      sendRumble(rumble);
    }
    if (typeof sendTelemetry === 'function') sendTelemetry();   // speed + car dots -> phone HUD
  }

  render(dt); updateAudio(dt);
}

function updateCarVisuals(dt) {
  for (const car of cars) {
    car.mesh.position.set(car.x, car.y, car.z);

    // Orient the chassis to the ground surface under it: sample the terrain around the
    // car, build the surface normal, and sit the car on that plane (real hill-following).
    const L = 2.6;
    const gx = (terrainHeight(car.x + L, car.z) - terrainHeight(car.x - L, car.z)) / (2 * L);
    const gz = (terrainHeight(car.x, car.z + L) - terrainHeight(car.x, car.z - L)) / (2 * L);
    _n.set(-gx, 1, -gz).normalize();
    if (!car._up) car._up = _n.clone();
    else car._up.lerp(_n, Math.min(1, dt * 7)).normalize();     // smooth out jitter
    _f.set(Math.sin(car.heading), 0, Math.cos(car.heading));
    _f.addScaledVector(car._up, -_f.dot(car._up));              // project heading onto the surface
    if (_f.lengthSq() < 1e-6) _f.set(Math.sin(car.heading), 0, Math.cos(car.heading));
    _f.normalize();
    _r.crossVectors(car._up, _f).normalize();                  // local +X (right)
    _m.makeBasis(_r, car._up, _f);                             // columns: right, up, forward
    car.mesh.quaternion.setFromRotationMatrix(_m);

    const speed = Math.hypot(car.velX, car.velZ);
    for (const w of car.mesh.userData.wheels) {
      if (w.userData.front) w.rotation.y = car.steer * 2.4;
      w.children[0].rotation.x += speed * dt / 0.45;
    }

    // lights: headlights at night/in weather, brake lights on the pedal
    const on = dnLightsOn();
    const ud = car.mesh.userData;
    if (ud.headMats) for (const m of ud.headMats) m.emissiveIntensity = on ? 3.4 : 0;
    const braking = (car._brake || 0) > 0.3;
    if (ud.tailMats) for (const m of ud.tailMats)
      m.emissiveIntensity = (braking ? 4.5 : 0) + (on ? 0.9 : 0) + (WEATHER.rain > 0.3 ? 0.7 : 0);
    if (car.headSpot) {
      car.headSpot.intensity = on ? 500 : 0;
      const hfx = Math.sin(car.heading), hfz = Math.cos(car.heading);
      car.headSpot.position.set(car.x + hfx * 1.6, car.y + 1.0, car.z + hfz * 1.6);
      car.headTgt.position.set(car.x + hfx * 40, car.y + 0.4, car.z + hfz * 40);
    }
  }
}

function setLights(n, green) {
  track.startLights.forEach((m, i) => {
    if (green) m.color.setHex(0x22dd44);
    else m.color.setHex(i < n ? 0xee2222 : 0x330000);
  });
}

// ---- Perf HUD (toggle: P). renderer.info normally resets after EVERY internal render
// call, and the composer does one per pass — so while the HUD is on we take over
// resetting (autoReset off, one reset per frame) to see the WHOLE frame's calls/tris.
const PERF = { on: false, ms: 16.7, cpu: 0, worst: 0, worstT: 0, acc: 0 };
function togglePerfHud() {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
  PERF.on = !PERF.on;
  renderer.info.autoReset = !PERF.on;
  $('perfHud').style.display = PERF.on ? 'block' : 'none';
  PERF.worst = 0; PERF.acc = 1;                       // repaint immediately on toggle
  toast(PERF.on ? 'Perf HUD on' : 'Perf HUD off');
}
function perfHudUpdate(dt, cpuMs) {
  PERF.ms += (dt * 1000 - PERF.ms) * 0.08;            // smoothed frame interval
  PERF.cpu += (cpuMs - PERF.cpu) * 0.08;              // JS time spent submitting the frame
  PERF.worstT += dt;
  if (dt * 1000 > PERF.worst) PERF.worst = dt * 1000;
  if (PERF.worstT > 2) { PERF.worst = dt * 1000; PERF.worstT = 0; }
  PERF.acc += dt;
  if (PERF.acc < 0.25) return;                        // repaint the text ~4Hz
  PERF.acc = 0;
  const r = renderer.info.render, m = renderer.info.memory;
  const tris = r.triangles > 1e6 ? (r.triangles / 1e6).toFixed(2) + 'M' : Math.round(r.triangles / 1e3) + 'k';
  $('perfHud').textContent =
    `${(1000 / PERF.ms).toFixed(0)} fps  (${PERF.ms.toFixed(1)} ms, worst ${PERF.worst.toFixed(0)})\n` +
    `cpu submit  ${PERF.cpu.toFixed(1)} ms\n` +
    `draw calls  ${r.calls}\n` +
    `triangles   ${tris}\n` +
    `res scale   ${POSTFX.renderScale.toFixed(2)} @ ${POSTFX.quality}\n` +
    `geo ${m.geometries}  tex ${m.textures}  prog ${renderer.info.programs.length}`;
}

function render(dt) {
  if (window.NET) NET.netTick(dt);                 // live race position stream + puppet interp
  const speed = Math.hypot(player.velX, player.velZ);
  const fX = Math.sin(player.heading), fZ = Math.cos(player.heading);
  player.mesh.visible = camMode !== CAM_COCKPIT;

  const fp = $('fpOverlay');
  let targetFov = 70;
  if (camMode === CAM_COCKPIT) {
    camera.position.set(player.x - fX * 0.2, player.y + 1.15, player.z - fZ * 0.2);
    camera.lookAt(player.x + fX * 30, player.y + 0.95, player.z + fZ * 30);
    targetFov = 84 + Math.min(speed * 0.62, 46);   // fisheye speed tunnel — cranked in cockpit
    if (!fp.classList.contains('on')) fp.classList.add('on');   // windshield glass + pillars only
  } else {
    if (fp.classList.contains('on')) fp.classList.remove('on');
    const near = camMode === CAM_CHASE;
    // portrait phones see a tall sliver of world — pull the chase cam back and up so the
    // car sits small in frame and the road ahead fills the screen instead of the bumper.
    const tall = camera.aspect < 1 ? THREE.MathUtils.clamp(1 / camera.aspect * 0.72, 1, 1.9) : 1;
    const dist = ((near ? 6.4 : 12.5) + speed * (near ? 0.05 : 0.08)) * tall;
    const h = ((near ? 3.0 : 5.2) + speed * 0.016) * (1 + (tall - 1) * 0.7);
    tmpV.set(player.x - fX * dist, player.y + h, player.z - fZ * dist);
    const k = 1 - Math.exp(-(near ? 8 : 5) * dt);
    camera.position.lerp(tmpV, k);
    camera.position.y = Math.max(camera.position.y, player.y + (near ? 1.7 : 2.4));
    if (window.DMG) DMG.shakeCamera(camera);          // joggly screen when hurt
    camera.lookAt(player.x + fX * 7, player.y + 1.3, player.z + fZ * 7);
    targetFov = 70 + Math.min(speed * 0.15, 15);
  }
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();

  dynResUpdate(dt);                   // dynamic resolution: hold frame rate, flex pixels
  dnUpdate(dt);                       // sun/moon/sky/exposure track the real clock
  wUpdate(dt);                        // weather eases along + rain follows the camera
  if (typeof cityUpdate === 'function') cityUpdate(dt);   // windows/lamps/ferris/turbines/beacons
  if (typeof dressUpdate === 'function') dressUpdate(dt); // crowds/beam/blimp/gulls (js/dress.js)
  if (PERF.on) {
    renderer.info.reset();
    const t0 = performance.now();
    renderFrame(dt, speed);
    perfHudUpdate(dt, performance.now() - t0);
  } else renderFrame(dt, speed);      // composer: bloom + DoF (menus) + speed blur + ACES
}

boot();
