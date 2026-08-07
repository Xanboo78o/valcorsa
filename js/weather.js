/* Weather: three modes — real (open-meteo for the rig's actual NH sky), random (fronts roll
   through), manual (picked in pause/settings). Drives rain particles, wet-road materials,
   fog thickness, and a mild grip penalty. wInitScene(scene) per scene build; wUpdate(dt) per frame. */
'use strict';

const WEATHER = {
  mode: localStorage.getItem('apex_weatherMode') || 'real',    // real | random | manual
  manual: localStorage.getItem('apex_weatherManual') || 'clear', // clear | cloudy | fog | rain | storm | snow
  // current (smoothed) state
  cloud: 0.2, rain: 0, snow: 0, fogK: 1, wet: 0, snowCover: 0,
  // targets we ease toward
  tCloud: 0.2, tRain: 0, tSnow: 0, tFogK: 1,
  gripMul: 1,
  rainPts: null, rainGeo: null, snowPts: null, snowGeo: null,
  lastFetch: -1e9, lastRandom: -1e9, fetchFail: false,
  roadMats: [],                       // materials that get the wet treatment
  groundSwaps: [],                    // {mesh, base, snowy} — terrain goes white under snow cover
};

const W_PRESETS = {
  clear:  { cloud: 0.12, rain: 0,    snow: 0, fogK: 1.05 },
  cloudy: { cloud: 0.75, rain: 0,    snow: 0, fogK: 0.9 },
  fog:    { cloud: 0.6,  rain: 0,    snow: 0, fogK: 0.28 },
  rain:   { cloud: 0.9,  rain: 0.6,  snow: 0, fogK: 0.55 },
  storm:  { cloud: 1.0,  rain: 1.0,  snow: 0, fogK: 0.4 },
  snow:   { cloud: 0.85, rain: 0,    snow: 1, fogK: 0.45 },
};

function wSetMode(mode, manual) {
  WEATHER.mode = mode;
  localStorage.setItem('apex_weatherMode', mode);
  if (manual) { WEATHER.manual = manual; localStorage.setItem('apex_weatherManual', manual); }
  WEATHER.lastFetch = -1e9; WEATHER.lastRandom = -1e9;   // re-evaluate immediately
  WEATHER.rush = 7;   // picked weather ROLLS IN fast — a choice should be visible in seconds
}

async function wFetchReal() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.2&longitude=-71.5'
      + '&current=precipitation,cloud_cover,weather_code&timezone=auto');
    const j = await r.json();
    const c = j.current;
    WEATHER.tCloud = THREE.MathUtils.clamp(c.cloud_cover / 100, 0, 1);
    const code = c.weather_code | 0;
    const snowing = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (snowing) { WEATHER.tSnow = 1; WEATHER.tRain = 0; WEATHER.tFogK = 0.45; }       // NH winter
    else if (code >= 95) { WEATHER.tRain = 1; WEATHER.tSnow = 0; WEATHER.tFogK = 0.4; } // thunderstorm
    else if (code >= 51 || c.precipitation > 0.05) {                                    // rain/drizzle
      WEATHER.tRain = THREE.MathUtils.clamp(0.3 + c.precipitation * 0.25, 0.3, 1);
      WEATHER.tSnow = 0; WEATHER.tFogK = 0.55;
    } else if (code >= 45 && code <= 48) { WEATHER.tRain = 0; WEATHER.tSnow = 0; WEATHER.tFogK = 0.28; } // fog
    else { WEATHER.tRain = 0; WEATHER.tSnow = 0; WEATHER.tFogK = 1.05 - WEATHER.tCloud * 0.2; }
    WEATHER.fetchFail = false;
  } catch (e) { WEATHER.fetchFail = true; }   // offline -> random takes over below
}

function wPickRandom() {
  const m = new Date().getMonth();                     // winter months can roll snow
  const winter = m <= 2 || m === 11;
  const keys = winter ? ['clear', 'clear', 'cloudy', 'cloudy', 'snow', 'snow', 'fog', 'rain']
                      : ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'fog', 'rain', 'storm'];
  const p = W_PRESETS[keys[Math.floor(Math.random() * keys.length)]];
  WEATHER.tCloud = p.cloud * (0.75 + Math.random() * 0.35);
  WEATHER.tRain = p.rain * (0.7 + Math.random() * 0.4);
  WEATHER.tSnow = p.snow;
  WEATHER.tFogK = p.fogK;
}

// Rain + snow: Points clouds of streaks/flakes, recycled around the camera.
function wInitScene(sc) {
  WEATHER.roadMats = [];
  WEATHER.groundSwaps = [];
  const mkCloud = (n, spread, hgt, cv, size, color) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = Math.random() * hgt;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.PointsMaterial({ map: tex, size, transparent: true, opacity: 0, depthWrite: false, color });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    sc.add(pts);
    return { pts, g };
  };
  { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 32;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, 'rgba(200,215,235,0)'); grad.addColorStop(0.5, 'rgba(200,215,235,0.85)'); grad.addColorStop(1, 'rgba(200,215,235,0)');
    x.fillStyle = grad; x.fillRect(2, 0, 4, 32);
    const r = mkCloud(1800, 90, 40, cv, 1.5, 0xcfd8e8);
    WEATHER.rainPts = r.pts; WEATHER.rainGeo = r.g;
  }
  { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const x = cv.getContext('2d');
    const grad = x.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grad; x.fillRect(0, 0, 16, 16);
    const s = mkCloud(1400, 80, 36, cv, 0.9, 0xf2f5fa);
    WEATHER.snowPts = s.pts; WEATHER.snowGeo = s.g;
  }
}

// Register a road material for the wet treatment (remembers its dry look).
// Toon 2.0: wet = darker fill + the road shader's wetK uniform (streaky sheen in-shader).
function wRegisterRoad(mat) {
  mat.userData.dryCol = mat.color.clone();
  WEATHER.roadMats.push(mat);
}

// Register a terrain/ground mesh that should whiten under snow cover.
let SNOW_MAT = null;
function wSnowMaterial() {
  if (SNOW_MAT) return SNOW_MAT;
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#e8edf2'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 16000; i++) {
    const v = 200 + Math.random() * 55 | 0;
    x.fillStyle = `rgba(${v},${v + 3},${v + 8},0.35)`;
    x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(200, 200);
  t.colorSpace = THREE.SRGBColorSpace;
  SNOW_MAT = toonMat(0xffffff, { map: t });          // flat comic snow
  return SNOW_MAT;
}
function wRegisterGround(mesh) {
  WEATHER.groundSwaps.push({ mesh, base: mesh.material, snowy: false });
}

function wUpdate(dt) {
  const now = performance.now();
  // -- pick targets by mode --
  if (WEATHER.mode === 'manual') {
    const p = W_PRESETS[WEATHER.manual] || W_PRESETS.clear;
    WEATHER.tCloud = p.cloud; WEATHER.tRain = p.rain; WEATHER.tSnow = p.snow; WEATHER.tFogK = p.fogK;
  } else if (WEATHER.mode === 'real' && !WEATHER.fetchFail) {
    if (now - WEATHER.lastFetch > 10 * 60 * 1000) { WEATHER.lastFetch = now; wFetchReal(); }
  } else {   // random (also the offline fallback for real)
    if (now - WEATHER.lastRandom > (150 + Math.random() * 150) * 1000) { WEATHER.lastRandom = now; wPickRandom(); }
  }

  // -- ease toward targets (weather rolls in, doesn't snap) --
  // rush: for a few seconds after the player PICKS weather, it arrives fast — a
  // 12s ease made every weather change look broken ("I chose storm, nothing happened")
  const rushing = (WEATHER.rush || 0) > 0;
  if (rushing) WEATHER.rush -= dt;
  const k = 1 - Math.exp(-dt / (rushing ? 1.6 : 12));
  WEATHER.cloud += (WEATHER.tCloud - WEATHER.cloud) * k;
  WEATHER.rain += (WEATHER.tRain - WEATHER.rain) * k;
  WEATHER.snow += (WEATHER.tSnow - WEATHER.snow) * k;
  WEATHER.fogK += (WEATHER.tFogK - WEATHER.fogK) * k;
  // wetness: soaks fast, dries slow
  const wetT = WEATHER.rain > 0.08 ? 1 : 0;
  WEATHER.wet += (wetT - WEATHER.wet) * (1 - Math.exp(-dt / (rushing ? 4 : wetT ? 14 : 60)));
  // snow cover: builds while snowing, melts slowly
  const covT = WEATHER.snow > 0.2 ? 1 : 0;
  WEATHER.snowCover += (covT - WEATHER.snowCover) * (1 - Math.exp(-dt / (covT ? (rushing ? 16 : 45) : 240)));
  WEATHER.gripMul = 1 - WEATHER.wet * 0.12 - WEATHER.snowCover * 0.16;   // mild wet/winter penalty

  // -- precipitation particles follow + fall around the camera --
  const fallCloud = (pts, geo, amount, fall, drift) => {
    if (!pts || !camera) return;
    pts.material.opacity = amount;
    pts.visible = amount > 0.02;
    if (!pts.visible) return;
    const p = geo.attributes.position, arr = p.array;
    const f = fall * dt, t = performance.now() / 1000;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= f;
      if (drift) arr[i] += Math.sin(t * 0.8 + i) * drift * dt;
      if (arr[i + 1] < 0) {
        arr[i] = (Math.random() - 0.5) * 90; arr[i + 1] = 34 + Math.random() * 5; arr[i + 2] = (Math.random() - 0.5) * 90;
      }
    }
    p.needsUpdate = true;
    pts.position.set(camera.position.x, Math.max(0, camera.position.y - 16), camera.position.z);
  };
  fallCloud(WEATHER.rainPts, WEATHER.rainGeo, WEATHER.rain * 0.75, 34 + WEATHER.rain * 22, 0);
  fallCloud(WEATHER.snowPts, WEATHER.snowGeo, WEATHER.snow * 0.85, 3.2, 1.6);

  // -- snow cover: swap registered ground meshes to the white material --
  for (const gs of WEATHER.groundSwaps) {
    const want = WEATHER.snowCover > 0.55;
    if (want !== gs.snowy) { gs.snowy = want; gs.mesh.material = want ? wSnowMaterial() : gs.base; }
  }

  // -- wet roads (toon): darker fill + drive the road shader's wetK for streaky sheen --
  for (const m of WEATHER.roadMats) {
    if (m.userData.dryCol) m.color.copy(m.userData.dryCol).multiplyScalar(1 - WEATHER.wet * 0.35);
    if (m.userData.shader) m.userData.shader.uniforms.wetK.value = WEATHER.wet;
  }
}
