/* Post-processing (Toon 2.0): MSAA composer -> INK (outlines + stepped haze from the
   scene depth buffer) -> bloom -> menu DoF -> speed blur -> tonemap -> grade.
   Plus DYNAMIC RESOLUTION (render scale flexes to hold frame rate).
   Rebuilt whenever a new scene is created. */
'use strict';

const POSTFX = {
  composer: null, bloomPass: null, bokehPass: null, blurPass: null, renderPass: null,
  inkPass: null, gradePass: null,
  motionBlur: +(localStorage.getItem('apex_motionBlur') ?? 0.5),   // 0..1 user slider
  quality: localStorage.getItem('apex_quality') || 'high',        // low | med | high | ultra
  // dynamic resolution
  renderScale: 1, dynAcc: 0, dynN: 0, dynCooldown: 0,
  arrayCam: null,                                                  // multi-screen rig camera
};

// ---- multi-screen (1/2/3 monitors): true extra FOV via yawed per-screen cameras ----
// The side screens are SIDE WINDOWS: each gets its own camera yawed so world lines stay
// continuous across the physical 3D-printed pillar between monitors (the TARDIS trick).
const SCREENS = Object.assign(
  { count: 1, bezelDeg: 2, angleMode: 'auto', sideAngleDeg: 52, swapSide: false, frame: false },
  JSON.parse(localStorage.getItem('apex_screens') || '{}'));
function saveScreens() {
  localStorage.setItem('apex_screens', JSON.stringify(SCREENS));
  document.body.dataset.screens = SCREENS.count;
}
// per-view horizontal FOV (degrees) given the main camera's vertical fov + view aspect
function viewHFov(viewAspect) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * viewAspect));
}
// (re)build the ArrayCamera to match screen count + drawing buffer size
function rebuildArrayCam() {
  if (SCREENS.count <= 1) { POSTFX.arrayCam = null; return; }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const n = SCREENS.count, w = Math.floor(size.x / n), h = size.y;
  const cams = [];
  for (let i = 0; i < n; i++) {
    const c = new THREE.PerspectiveCamera(camera.fov, w / h, camera.near, camera.far);
    c.viewport = new THREE.Vector4(i * w, 0, w, h);
    cams.push(c);
  }
  POSTFX.arrayCam = new THREE.ArrayCamera(cams);
}
// sync per-frame: sub-cameras follow the main camera with yaw offsets
const _yawQ = new THREE.Quaternion(), _upY = new THREE.Vector3(0, 1, 0);
function syncArrayCam() {
  const ac = POSTFX.arrayCam;
  if (!ac) return;
  const n = SCREENS.count;
  const hf = viewHFov(ac.cameras[0].aspect);
  const auto = hf + SCREENS.bezelDeg;                       // continuity angle
  const yawStep = SCREENS.angleMode === 'auto' ? auto : SCREENS.sideAngleDeg + SCREENS.bezelDeg;
  // screen order left->right; 2-screen = center + one side
  const offsets = n === 3 ? [yawStep, 0, -yawStep]
    : (SCREENS.swapSide ? [yawStep, 0] : [0, -yawStep]);
  for (let i = 0; i < n; i++) {
    const c = ac.cameras[i];
    c.position.copy(camera.position);
    _yawQ.setFromAxisAngle(_upY, THREE.MathUtils.degToRad(offsets[i]));
    c.quaternion.copy(camera.quaternion).premultiply(_yawQ);
    if (c.fov !== camera.fov) { c.fov = camera.fov; c.updateProjectionMatrix(); }
  }
  ac.position.copy(camera.position);
  ac.quaternion.copy(camera.quaternion);
}

// ---- InkPass: the illustrated look's line-work + depth, in one cheap pass ----
// Reads the beauty pass's own depth buffer (no second scene render). Draws palette-ink
// outlines where depth breaks (Roberts cross, depth-proportional threshold) and washes
// the distance in 3 stepped haze bands like paper cutouts. Runs right after RenderPass
// so the depth attachment is untouched by later ping-pong passes.
const INK_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.3 }, cameraFar: { value: 5200 },
    inkColor: { value: new THREE.Color(0x26324a) },
    inkPx: { value: 1.5 },
    viewN: { value: 1 },
    haze1: { value: new THREE.Color(0xcfe6f5) },
    haze2: { value: new THREE.Color(0xbcd8ee) },
    haze3: { value: new THREE.Color(0xa9c8e6) },
    hazeBase: { value: 320 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 resolution;
    uniform float cameraNear, cameraFar, inkPx, viewN, hazeBase;
    uniform vec3 inkColor, haze1, haze2, haze3;
    varying vec2 vUv;
    float linD(vec2 uv) {
      float ndc = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - ndc * (cameraFar - cameraNear));
    }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec2 px = inkPx / resolution;
      float d = linD(vUv);
      float dA = linD(vUv + vec2( px.x,  px.y));
      float dB = linD(vUv + vec2( px.x, -px.y));
      float dC = linD(vUv + vec2(-px.x,  px.y));
      float dD = linD(vUv + vec2(-px.x, -px.y));
      // second-order edge metric: zero on ANY plane (even at grazing angles), spikes at
      // true depth discontinuities — first-order Roberts cross scanlined the road
      float e = abs(dA + dD - 2.0 * d) + abs(dB + dC - 2.0 * d);
      float thr = 0.035 * d + 0.12;      // high enough that gentle road-crest creases stay clean
      float edge = smoothstep(thr, thr * 2.4, e);
      if (viewN > 1.5) {                                  // multi-screen: no false seam lines
        float fx = fract(vUv.x * viewN);
        float seam = 2.5 * viewN / resolution.x;
        if (fx < seam || fx > 1.0 - seam) edge = 0.0;
      }
      // stepped illustrated haze (sky itself stays clean)
      float skyK = 1.0 - smoothstep(cameraFar * 0.82, cameraFar * 0.93, d);
      float h1 = smoothstep(hazeBase * 0.9, hazeBase * 1.4, d) * 0.16 * skyK;
      float h2 = smoothstep(hazeBase * 2.1, hazeBase * 2.8, d) * 0.22 * skyK;
      float h3 = smoothstep(hazeBase * 4.2, hazeBase * 5.4, d) * 0.24 * skyK;
      col = mix(col, haze1, h1);
      col = mix(col, haze2, h2);
      col = mix(col, haze3, h3);
      edge *= 1.0 - (h1 + h2 + h3) * 1.35;                // lines dissolve into the haze
      col = mix(col, inkColor, clamp(edge, 0.0, 1.0) * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const SPEED_BLUR_SHADER = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main() {
      vec2 c = vec2(0.5, 0.42);                         // blur radiates from ahead of the car
      vec2 d = vUv - c;
      float falloff = smoothstep(0.05, 0.5, length(d)); // keep the middle crisp
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        sum += texture2D(tDiffuse, vUv - d * strength * falloff * t);
      }
      gl_FragColor = sum / 8.0;
    }`,
};

// Cinematic grade (runs AFTER tonemapping, in display space): lift/gain, saturation,
// teal-shadow/orange-highlight split tone, vignette. Day/dusk/night blend fed per-frame.
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    satur: { value: 1.08 },
    lift: { value: new THREE.Vector3(0, 0, 0) },        // shadow tint push
    gain: { value: new THREE.Vector3(1, 1, 1) },        // highlight tint
    contrast: { value: 1.05 },
    vig: { value: 0.32 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float satur, contrast, vig;
    uniform vec3 lift, gain;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, satur);                             // saturation
      c = (c - 0.5) * contrast + 0.5;                         // contrast pivot
      c += lift * (1.0 - l);                                  // tint shadows
      c *= mix(vec3(1.0), gain, smoothstep(0.35, 1.0, l));    // tint highlights
      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - vig * smoothstep(0.42, 0.85, d);             // vignette
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const QUALITY = {
  low:   { pr: 1.0,  samples: 0, shadow: 1024, bloom: false, ink: 1.0,  far: 2600 },
  med:   { pr: 1.0,  samples: 2, shadow: 2048, bloom: true,  ink: 1.25, far: 3600 },
  high:  { pr: 1.25, samples: 4, shadow: 2048, bloom: true,  ink: 1.5,  far: 5200 },
  ultra: { pr: 1.75, samples: 4, shadow: 4096, bloom: true,  ink: 2.0,  far: 7000 },
};
function qcfg() { return QUALITY[POSTFX.quality] || QUALITY.high; }

// Build (or rebuild) the composer for the current scene + camera.
function rebuildPostFX() {
  const q = qcfg();
  const { EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, BokehPass, OutputPass } = window.FX;
  if (POSTFX.composer) { POSTFX.composer.dispose && POSTFX.composer.dispose(); POSTFX.composer = null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.pr) * POSTFX.renderScale);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: q.samples, type: THREE.HalfFloatType });
  // the beauty pass's depth buffer, resolved to a texture the InkPass can read
  rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
  const composer = new EffectComposer(renderer, rt);
  // ping-pong parity varies per frame (speed blur toggles), so the scene may render into
  // EITHER buffer — share ONE depth texture across both so ink always reads live depth.
  if (composer.renderTarget2.depthTexture) composer.renderTarget2.depthTexture.dispose();
  composer.renderTarget2.depthTexture = rt.depthTexture;
  rebuildArrayCam();
  POSTFX.renderPass = new RenderPass(scene, POSTFX.arrayCam || camera);
  composer.addPass(POSTFX.renderPass);
  // ink FIRST: it must read the depth attachment before any ping-pong pass writes over it
  POSTFX.inkPass = new ShaderPass({ uniforms: THREE.UniformsUtils.clone(INK_SHADER.uniforms),
    vertexShader: INK_SHADER.vertexShader, fragmentShader: INK_SHADER.fragmentShader });
  POSTFX.inkPass.uniforms.tDepth.value = rt.depthTexture;
  if (typeof PAL !== 'undefined') {              // live palette references — lerp propagates
    POSTFX.inkPass.uniforms.inkColor.value = PAL.ink;
    POSTFX.inkPass.uniforms.haze1.value = PAL.haze[0];
    POSTFX.inkPass.uniforms.haze2.value = PAL.haze[1];
    POSTFX.inkPass.uniforms.haze3.value = PAL.haze[2];
  }
  composer.addPass(POSTFX.inkPass);
  if (q.bloom) {
    // threshold above the toon fills so only emissives (lamps, brake lights) bloom
    POSTFX.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.12, 0.35, 1.7);
    composer.addPass(POSTFX.bloomPass);
  } else POSTFX.bloomPass = null;
  POSTFX.bokehPass = new BokehPass(scene, camera, { focus: 11, aperture: 0.0016, maxblur: 0.012 });
  POSTFX.bokehPass.enabled = false;
  composer.addPass(POSTFX.bokehPass);
  POSTFX.blurPass = new ShaderPass({ uniforms: THREE.UniformsUtils.clone(SPEED_BLUR_SHADER.uniforms),
    vertexShader: SPEED_BLUR_SHADER.vertexShader, fragmentShader: SPEED_BLUR_SHADER.fragmentShader });
  POSTFX.blurPass.enabled = false;
  composer.addPass(POSTFX.blurPass);
  composer.addPass(new OutputPass());                 // tonemap + sRGB
  POSTFX.gradePass = new ShaderPass({ uniforms: THREE.UniformsUtils.clone(GRADE_SHADER.uniforms),
    vertexShader: GRADE_SHADER.vertexShader, fragmentShader: GRADE_SHADER.fragmentShader });
  composer.addPass(POSTFX.gradePass);                 // cinematic grade in display space
  POSTFX.composer = composer;
}

function resizePostFX() {
  if (POSTFX.composer) POSTFX.composer.setSize(vpW(), vpH());
  rebuildArrayCam();
  if (POSTFX.renderPass) POSTFX.renderPass.camera = POSTFX.arrayCam || camera;
}

// Dynamic resolution: hold frame rate by flexing render scale (Forza/GT do exactly this).
function dynResUpdate(dt) {
  if (state !== 'race' && state !== 'tt' && state !== 'freeroam' && state !== 'stage') return;
  POSTFX.dynAcc += dt; POSTFX.dynN++;
  POSTFX.dynCooldown -= dt;
  if (POSTFX.dynN < 45 || POSTFX.dynCooldown > 0) return;
  const avg = (POSTFX.dynAcc / POSTFX.dynN) * 1000;   // ms/frame
  POSTFX.dynAcc = 0; POSTFX.dynN = 0;
  let s = POSTFX.renderScale;
  if (avg > 17.5 && s > 0.55) s = Math.max(0.55, s - 0.1);
  else if (avg < 12.5 && s < 1.0) s = Math.min(1.0, s + 0.05);
  else return;
  POSTFX.renderScale = s;
  POSTFX.dynCooldown = 1.5;                            // let it settle before judging again
  const q = qcfg();
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.pr) * s);
  if (POSTFX.composer) POSTFX.composer.setSize(vpW(), vpH());
  rebuildArrayCam();
  if (POSTFX.renderPass) POSTFX.renderPass.camera = POSTFX.arrayCam || camera;
}

// Per-frame post uniforms: simplified grade (palettes carry the mood now) + ink/haze.
function gradeUpdate() {
  if (typeof DN === 'undefined') return;
  const night = DN.nightFactor, dusk = DN.duskFactor;
  if (POSTFX.gradePass) {
    const u = POSTFX.gradePass.uniforms;
    u.satur.value = 1.06 - night * 0.1;
    u.contrast.value = 1.03;
    u.lift.value.set(0, 0, 0);
    u.gain.value.set(1, 1, 1);
    u.vig.value = 0.26 + night * 0.1;
  }
  if (POSTFX.inkPass) {
    const u = POSTFX.inkPass.uniforms;
    const size = renderer.getDrawingBufferSize(_inkSize);
    u.resolution.value.set(size.x, size.y);
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.inkPx.value = qcfg().ink * Math.max(1, size.y / 1080);   // constant on-screen width
    u.viewN.value = SCREENS.count;
    const W = (typeof WEATHER !== 'undefined') ? WEATHER : { fogK: 1 };
    const fm = (typeof fogMul !== 'undefined') ? fogMul : 1;
    u.hazeBase.value = (DN.fogBase || 1700) * W.fogK * fm * 0.19;
  }
}
const _inkSize = new THREE.Vector2();

// Called every frame instead of renderer.render().
function renderFrame(dt, speed) {
  if (!POSTFX.composer) { renderer.render(scene, camera); return; }
  // menu / pause / results get cinematic depth of field; driving gets speed blur
  const menus = state === 'paused' || state === 'results';
  const multi = SCREENS.count > 1;
  if (multi) syncArrayCam();
  POSTFX.bokehPass.enabled = menus && !multi;
  const s = POSTFX.motionBlur * THREE.MathUtils.clamp((speed - 28) / 150, 0, 1) * 0.055;
  POSTFX.blurPass.enabled = !menus && !multi && s > 0.0025;
  if (POSTFX.blurPass.enabled) POSTFX.blurPass.uniforms.strength.value = s;
  gradeUpdate();
  POSTFX.composer.render(dt);
}

function setQuality(qName) {
  POSTFX.quality = qName;
  localStorage.setItem('apex_quality', qName);
  POSTFX.renderScale = 1;                              // reset the dynamic scale on preset change
  const q = qcfg();
  if (camera) { camera.far = Math.max(camera.far, q.far); camera.updateProjectionMatrix(); }
  if (dirLight) dirLight.shadow.mapSize.set(q.shadow, q.shadow);
  if (scene && camera) rebuildPostFX();
}

function setScreens(patch) {
  Object.assign(SCREENS, patch);
  saveScreens();
  if (scene && camera) rebuildPostFX();
  const fr = document.getElementById('pillarFrames');
  if (fr) fr.style.display = (SCREENS.count > 1 && SCREENS.frame) ? 'block' : 'none';
}
