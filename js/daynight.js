/* Day/night system: game time = the player's REAL clock. Computes the true solar position for
   NH latitude, drives the physical Sky shader, sun/moon/stars, PBR environment lighting (PMREM),
   exposure and fog. dnInit(scene) on every scene build; dnUpdate(dt) every frame. */
'use strict';

const DN = {
  lat: 43.2, lon: -71.5,               // NH — sun + weather match the world outside the rig
  sunDir: new THREE.Vector3(0, 1, 0),
  elev: 0.5, az: 0,
  nightFactor: 0,                      // 0 = full day, 1 = full night
  duskFactor: 0,                       // peaks at sunrise/sunset (for the golden look)
  sky: null, sun: null, hemi: null, moonLight: null, moonMesh: null, stars: null,
  pmrem: null, envRT: null, lastEnvElev: 99, lastEnvCloud: -1, lastEnvT: 0,
  fogBase: 2400,                       // per-scene fog distance (set by dnInit opts)
  timeOffsetH: +(localStorage.getItem('apex_timeOffset') || 0),   // debug/testing: shift the clock
};

// Time-of-day picker: presets aim timeOffsetH so solar time lands on the chosen hour.
// 'real' = the player's actual clock (offset 0). Recomputed at load so presets stay true.
const TOD_HOURS = { dawn: 5.8, noon: 13, sunset: 19.6, night: 0.5 };
function dnSetTOD(mode) {
  localStorage.setItem('vc_tod', mode);
  if (mode === 'real' || !TOD_HOURS[mode]) DN.timeOffsetH = 0;
  else {
    const d = new Date();
    const cur = d.getUTCHours() + d.getUTCMinutes() / 60 + DN.lon / 15;
    let off = TOD_HOURS[mode] - cur;
    while (off < -12) off += 24;
    while (off > 12) off -= 24;
    DN.timeOffsetH = off;
  }
  localStorage.setItem('apex_timeOffset', DN.timeOffsetH);
}
if ((localStorage.getItem('vc_tod') || 'real') !== 'real') dnSetTOD(localStorage.getItem('vc_tod'));

function sunPosition(date) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 864e5;
  const decl = -23.44 * rad * Math.cos(2 * Math.PI / 365 * (day + 10));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTime = hours + DN.lon / 15 + DN.timeOffsetH;
  const ha = (solarTime - 12) * 15 * rad;                    // hour angle
  const latR = DN.lat * rad;
  const elev = Math.asin(Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(decl) * Math.cos(latR) - Math.sin(latR) * Math.cos(ha));
  return { elev, az };
}

// Build sky + lights into a freshly-created scene. Returns nothing; sets main.js globals.
function dnInit(scene, opts = {}) {
  DN.fogBase = opts.fog || 2400;

  // Toon 2.0 sky: a painted gradient dome driven by the palette (the physical Sky shader
  // is retired — flat fills want authored colors, not atmospheric scattering)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topC: { value: PAL.skyTop }, horC: { value: PAL.skyHorizon },
      sunC: { value: PAL.sunColor }, sunDir: { value: DN.sunDir },
      duskGlow: { value: 0 }, flatK: { value: 0 }, flatC: { value: PAL.fog },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 topC, horC, sunC, flatC, sunDir;
      uniform float duskGlow, flatK;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float t = pow(clamp(dir.y, 0.0, 1.0), 0.58);
        vec3 c = mix(horC, topC, t);
        vec3 sd = normalize(sunDir);
        float g = pow(max(dot(dir, sd), 0.0), 6.0);
        c += sunC * g * duskGlow * 0.55;                       // dusk glow lobe
        float disc = smoothstep(0.9994, 0.9997, dot(dir, sd)); // flat painted sun disc
        c = mix(c, sunC * 1.15, disc * step(0.0, sd.y));
        c = mix(c, flatC, flatK);                              // overcast flattens the dome
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 12), skyMat);
  sky.frustumCulled = false;
  DN.sky = sky;
  scene.add(sky);
  // env lighting comes from a small procedural equirect (NOT a PMREM capture of the Sky
  // shader — its sun disc overflows half-float to Inf and the mip chain NaN-poisons ALL
  // PBR materials, which renders the entire world black. Hard-won knowledge.)
  if (!DN.envData) { DN.envW = 64; DN.envH = 32; DN.envData = new Float32Array(DN.envW * DN.envH * 4); }

  // sun light (the one true shadow caster; assigned to main.js's global dirLight)
  dirLight = new THREE.DirectionalLight(0xffffff, 3.2);
  dirLight.castShadow = true;
  const q = (typeof qcfg === 'function') ? qcfg() : { shadow: 2048 };
  dirLight.shadow.mapSize.set(q.shadow, q.shadow);
  dirLight.shadow.bias = -0.0004;
  dirLight.shadow.normalBias = 1.3;                  // toon banding turns acne into stripes — bias high
  const ext = q.shadow >= 4096 ? 260 : 175;          // ultra buys a wider shadow reach
  const sc = dirLight.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 20; sc.far = 1000;
  scene.add(dirLight, dirLight.target);
  DN.sun = dirLight;

  DN.hemi = new THREE.HemisphereLight(0xbdd7f2, 0x4a5442, 0.55);
  scene.add(DN.hemi);

  // moon: soft cool fill at night + a visible disc
  DN.moonLight = new THREE.DirectionalLight(0xa8bce0, 0);
  scene.add(DN.moonLight, DN.moonLight.target);
  DN.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8edf5, fog: false, depthWrite: false }));
  DN.moonMesh.frustumCulled = false;
  scene.add(DN.moonMesh);

  // stars: a dome of points around the camera, faded in by nightFactor
  { const n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 0.98 + 0.02), r = 1900;
      pos[i * 3] = Math.cos(e) * Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.cos(e) * Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    DN.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    DN.stars.frustumCulled = false;
    scene.add(DN.stars);
  }

  scene.fog = new THREE.Fog(0xcfe0f0, DN.fogBase * 0.5, DN.fogBase * 1.9);
  if (!DN.pmrem) DN.pmrem = new THREE.PMREMGenerator(renderer);
  DN.lastEnvElev = 99; DN.lastEnvCloud = -1;   // force env rebuild for the new scene
  dnUpdate(0, true);
}

// Regenerate the PBR environment map from the sky (throttled; expensive-ish).
function dnRefreshEnv() {
  const cloud = (typeof WEATHER !== 'undefined') ? WEATHER.cloud : 0.2;
  const now = performance.now();
  if (Math.abs(DN.elev - DN.lastEnvElev) < 0.006 && Math.abs(cloud - DN.lastEnvCloud) < 0.04) return;
  if (now - DN.lastEnvT < 2500) return;
  DN.lastEnvT = now; DN.lastEnvElev = DN.elev; DN.lastEnvCloud = cloud;
  const old = DN.envRT, oldTex = DN.envTexEq;
  // paint a small equirect from the PALETTE: sky gradient + ground bounce + a CAPPED sun
  // blob (kept modest — this only exists so the glossy cars reflect a matching world)
  const dayS = THREE.MathUtils.smoothstep(DN.elev, -0.10, 0.16);
  const warm = THREE.MathUtils.clamp(1 - Math.abs(DN.elev - 0.05) / 0.22, 0, 1) * dayS;
  const clearK = 1 - cloud * 0.6;
  const zen = [PAL.skyTop.r, PAL.skyTop.g, PAL.skyTop.b];
  const hor = [PAL.skyHorizon.r, PAL.skyHorizon.g, PAL.skyHorizon.b];
  const gnd = [PAL.ground[1].r * 0.5, PAL.ground[1].g * 0.5, PAL.ground[1].b * 0.5];
  const night = 1 - dayS;
  const W = DN.envW, Hh = DN.envH, d = DN.envData;
  for (let y = 0; y < Hh; y++) {
    const v = 1 - (y + 0.5) / Hh;                       // 1 top -> 0 bottom
    const theta = (v - 0.5) * Math.PI;                  // elevation of this row
    const sy = Math.sin(theta);
    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
      const cx2 = Math.cos(theta) * Math.sin(phi), cz2 = Math.cos(theta) * Math.cos(phi);
      let r, g, b;
      if (sy > 0) {
        const t = Math.pow(sy, 0.55);
        r = hor[0] * (1 - t) + zen[0] * t; g = hor[1] * (1 - t) + zen[1] * t; b = hor[2] * (1 - t) + zen[2] * t;
      } else {
        const t = Math.min(1, -sy * 3);
        r = hor[0] * (1 - t) + gnd[0] * t; g = hor[1] * (1 - t) + gnd[1] * t; b = hor[2] * (1 - t) + gnd[2] * t;
      }
      // capped sun blob (bright enough for reflections, finite by construction)
      const dot2 = cx2 * DN.sunDir.x + sy * DN.sunDir.y + cz2 * DN.sunDir.z;
      const sun = Math.exp((dot2 - 1) * 34) * 8 * dayS * clearK;
      r += sun * PAL.sunColor.r; g += sun * PAL.sunColor.g; b += sun * PAL.sunColor.b;
      const i = (y * W + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 1;   // palette is already time-of-day

    }
  }
  const tex = new THREE.DataTexture(d, W, Hh, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  DN.envRT = DN.pmrem.fromEquirectangular(tex);
  DN.envTexEq = tex;
  scene.environment = DN.envRT.texture;
  if (old) old.dispose();
  if (oldTex) oldTex.dispose();
}

function dnUpdate(dt, force) {
  if (!DN.sky || !scene) return;
  const { elev, az } = sunPosition(new Date());
  DN.elev = elev; DN.az = az;
  // world axes: x = east, z = south (north is -z)
  const ce = Math.cos(elev);
  DN.sunDir.set(Math.sin(az) * ce, Math.sin(elev), -Math.cos(az) * ce);

  const W = (typeof WEATHER !== 'undefined') ? WEATHER : { cloud: 0.2, rain: 0, fogK: 1, wet: 0 };
  const dayS = THREE.MathUtils.smoothstep(elev, -0.10, 0.16);          // 0 night -> 1 day
  DN.nightFactor = 1 - dayS;
  DN.duskFactor = THREE.MathUtils.clamp(1 - Math.abs(elev - 0.05) / 0.22, 0, 1) * dayS;
  const clearK = 1 - W.cloud * 0.75;

  // painted dome: dusk glow + overcast flattening
  const u = DN.sky.material.uniforms;
  u.duskGlow.value = DN.duskFactor;
  u.flatK.value = THREE.MathUtils.smoothstep(W.cloud, 0.45, 0.8);

  // Toon 2.0: the palette owns light colors and intensities — blend it first, read from it.
  const envKey = (typeof track !== 'undefined' && track && track.def) ? track.def.env : 'meadow';
  const wDusk = DN.duskFactor, wDay = dayS * (1 - wDusk), wNight = DN.nightFactor * (1 - wDusk);
  if (typeof paletteBlend === 'function') paletteBlend(envKey, wDay, wDusk, wNight);

  DN.sun.intensity = PAL.sunI * clearK;
  const warm = DN.duskFactor;
  DN.sun.color.copy(PAL.sunColor);
  const anchor = player ? player : { x: 0, z: 0 };
  DN.sun.position.set(anchor.x + DN.sunDir.x * 420, Math.max(60, DN.sunDir.y * 420), anchor.z + DN.sunDir.z * 420);
  DN.sun.target.position.set(anchor.x, 0, anchor.z);

  // hemisphere fill from the palette
  DN.hemi.intensity = PAL.hemiI * (1 - W.cloud * 0.3);
  DN.hemi.color.copy(PAL.hemiSky);
  DN.hemi.groundColor.copy(PAL.hemiGround);

  // sky dome + stars ride along with the camera (they're sized inside the far plane)
  if (camera) { DN.sky.position.copy(camera.position); DN.stars.position.copy(camera.position); }

  // moon: fake-but-believable — opposite the sun's azimuth, mirrored elevation
  const mElev = Math.max(0.12, -elev + 0.25), mAz = az + Math.PI;
  const mce = Math.cos(mElev);
  const mdir = tmpV.set(Math.sin(mAz) * mce, Math.sin(mElev), -Math.cos(mAz) * mce);
  const camP = camera ? camera.position : { x: anchor.x, y: 0, z: anchor.z };
  DN.moonMesh.position.set(camP.x + mdir.x * 1900, camP.y + mdir.y * 1900, camP.z + mdir.z * 1900);
  DN.moonMesh.material.color.setScalar(0.55 + 0.45 * DN.nightFactor);
  DN.moonLight.intensity = 0.35 * DN.nightFactor * clearK;
  DN.moonLight.position.set(anchor.x + mdir.x * 400, mdir.y * 400, anchor.z + mdir.z * 400);
  DN.moonLight.target.position.set(anchor.x, 0, anchor.z);

  DN.stars.material.opacity = Math.max(0, DN.nightFactor - W.cloud * 0.7) * 0.9;

  // Toon 2.0: exposure is FIXED — the palette is authored in display terms.
  renderer.toneMappingExposure = 1.0;

  // fog: distance follows time & weather; colour comes from the palette (weak — the
  // illustrated depth read comes from the InkPass stepped haze, not from milk)
  if (scene.fog) {
    const f = DN.fogBase * W.fogK * fogMul;
    scene.fog.near = f * (0.9 + dayS * 0.2);
    scene.fog.far = f * (2.6 + dayS * 1.0);
    scene.fog.color.copy(PAL.fog);
    if (scene.background && scene.background.isColor) scene.background.copy(PAL.skyHorizon);
  }
  dnRefreshEnv();
}

// Are we in "lights on" conditions? (night, dusk, heavy weather)
function dnLightsOn() {
  const W = (typeof WEATHER !== 'undefined') ? WEATHER : { rain: 0 };
  return DN.nightFactor > 0.25 || W.rain > 0.45;
}
