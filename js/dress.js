/* Track dressing — the Mario Kart pass. Crowds that actually cheer, boardwalks, the
   lighthouse, gag billboards, sky traffic. Everything here is DECOR: no physics, no AI.
   Perf rules: every repeated thing is ONE InstancedMesh, every one-off is merged; crowd
   animation runs in the VERTEX SHADER (a shared time uniform — zero per-frame JS/matrix
   work); nothing in this file casts shadows except large structures.

   dressTrack(def, env) runs at scene build when def.dress is set.
   dressUpdate(dt) runs every frame from render() — keep it O(handful of transforms).  */
'use strict';

// ---- sponsor roster -------------------------------------------------------------
// PLACEHOLDERS. Adam is writing the real list (inside jokes). Swap text/colors here —
// everything else (billboards, banners, awnings) picks brands from this array.
const BRANDS = [
  { name: 'APEX COLA',    bg: '#d0342c', fg: '#ffffff', accent: '#ffd23e' },
  { name: 'TURBO SNAIL',  bg: '#1f7a3d', fg: '#eaffcf', accent: '#8ecf6a' },
  { name: 'GRIP+',        bg: '#20304a', fg: '#7ec8ff', accent: '#ffffff' },
  { name: 'UNCLE WHEELS', bg: '#e8892a', fg: '#2b1a08', accent: '#ffffff' },
  { name: 'MOM\'S FUEL',  bg: '#7a4a9e', fg: '#ffe9ff', accent: '#ffd23e' },
  { name: 'SEASIDE FM',   bg: '#2e7fc0', fg: '#ffffff', accent: '#ffd23e' },
];

const DRESS = {
  uT: { value: 0 },            // shared shader clock (crowds, flags, water)
  anims: [],                   // per-frame transform animations [{obj, fn}]
  glowMats: [],                // emissive mats that brighten at night
  beam: null,                  // lighthouse beam group
};

// ---- shader helpers -------------------------------------------------------------
// Inject a vertex-space displacement AFTER begin_vertex. Instanced meshes get a per-
// instance phase hashed from the instance's world position (so paired meshes — bodies
// and heads standing on the same spot — bounce in sync without any bookkeeping).
function animMat(mat, kind) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uT = DRESS.uT;
    let code = '';
    if (kind === 'hop') code = `
      #ifdef USE_INSTANCING
        float ph = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        transformed.y += max(0.0, sin(uT * (5.2 + ph * 2.6) + ph * 6.2832)) * (0.10 + 0.22 * ph);
      #endif`;
    else if (kind === 'flutter') code = `
      #ifdef USE_INSTANCING
        float phf = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        transformed.x += sin(uT * 7.0 + phf * 6.2832 + uv.x * 4.0) * 0.10 * uv.x;
      #endif`;
    else if (kind === 'water') code = `
      transformed.y += sin(uT * 0.9 + position.x * 0.011) * 0.22
                     + sin(uT * 1.3 - position.z * 0.017) * 0.14;`;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uT;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + code);
  };
  mat.customProgramCacheKey = () => 'dress_' + kind;
  return mat;
}

function dressTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// merged one-off geometry -> single mesh
function addMerged(geos, mat, shadow = false) {
  if (!geos.length) return null;
  const BGU = window.FX.BufferGeometryUtils;
  const g = BGU.mergeGeometries(geos.map(x => x.index ? x.toNonIndexed() : x));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = shadow;
  m.receiveShadow = false;
  scene.add(m);
  return m;
}

// instancing pool: collect transforms + colors, build one InstancedMesh at the end
function pool() { return { m4s: [], cols: [] }; }
function poolAdd(p, x, y, z, yaw, s, color) {
  const m4 = new THREE.Matrix4().makeRotationY(yaw);
  m4.scale(new THREE.Vector3(s, s, s));
  m4.setPosition(x, y, z);
  p.m4s.push(m4);
  p.cols.push(color);
}
function poolBuild(p, geo, mat, shadow = false) {
  if (!p.m4s.length) return null;
  const inst = new THREE.InstancedMesh(geo, mat, p.m4s.length);
  for (let i = 0; i < p.m4s.length; i++) {
    inst.setMatrixAt(i, p.m4s[i]);
    if (p.cols[i]) inst.setColorAt(i, p.cols[i]);
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.castShadow = shadow;
  inst.computeBoundingSphere();
  scene.add(inst);
  return inst;
}

// track geometry helpers (rounds, so callers can pass fractional sample indices)
const _IWD = (i) => { i = Math.round(i); return ((i % track.N) + track.N) % track.N; };
function trkPoint(i, lat) {
  const s = track.samples[_IWD(i)], r = track.rights[_IWD(i)];
  return { x: s.x + r.x * lat, y: s.y, z: s.z + r.z * lat,
           yaw: Math.atan2(track.tangents[_IWD(i)].x, track.tangents[_IWD(i)].z) };
}

// ---- crowd figures ---------------------------------------------------------------
const SHIRTS = [0xd0342c, 0x2e7fc0, 0xffd23e, 0x1f7a3d, 0xe8892a, 0x7a4a9e, 0xf2f2f2, 0x20304a];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
let _figGeos = null;
function figGeos() {
  if (_figGeos) return _figGeos;
  const BGU = window.FX.BufferGeometryUtils;
  const torso = () => {
    const t = new THREE.CylinderGeometry(0.13, 0.18, 0.62, 6);
    t.translate(0, 0.66, 0);
    return t;
  };
  const legs = () => {
    const l = new THREE.CylinderGeometry(0.14, 0.12, 0.36, 6);
    l.translate(0, 0.18, 0);
    return l;
  };
  const arm = (sideX, up) => {
    const a = new THREE.CylinderGeometry(0.045, 0.045, 0.42, 5);
    if (up) { a.rotateZ(sideX * -0.5); a.translate(sideX * 0.26, 1.08, 0); }
    else { a.rotateZ(sideX * 0.25); a.translate(sideX * 0.21, 0.68, 0); }
    return a;
  };
  const bodyDown = BGU.mergeGeometries([torso(), legs(), arm(1, false), arm(-1, false)].map(g => g.toNonIndexed()));
  const bodyUp = BGU.mergeGeometries([torso(), legs(), arm(1, true), arm(-1, true)].map(g => g.toNonIndexed()));
  const head = new THREE.SphereGeometry(0.15, 6, 5);
  head.translate(0, 1.12, 0);
  _figGeos = { bodyDown, bodyUp, head };
  return _figGeos;
}

// flat-cutout fans for the back rows (one drawn fan-pair, tinted per instance)
let _cutoutTex = null;
function cutoutTex() {
  if (_cutoutTex) return _cutoutTex;
  _cutoutTex = dressTex(128, 128, (x) => {
    const INK = '#20301f';
    x.lineWidth = 5; x.lineJoin = x.lineCap = 'round';
    for (const [cx, up] of [[36, true], [92, false]]) {
      x.strokeStyle = INK; x.fillStyle = '#ffffff';
      // body blob (white -> takes instance tint)
      x.beginPath(); x.ellipse(cx, 92, 20, 26, 0, 0, 6.28); x.fill(); x.stroke();
      // arms
      x.beginPath();
      if (up) { x.moveTo(cx - 16, 82); x.lineTo(cx - 30, 52); x.moveTo(cx + 16, 82); x.lineTo(cx + 30, 52); }
      else { x.moveTo(cx - 16, 88); x.lineTo(cx - 28, 104); x.moveTo(cx + 16, 88); x.lineTo(cx + 28, 104); }
      x.stroke();
      // head (cream, reads as face at distance)
      x.fillStyle = '#f3ddb5';
      x.beginPath(); x.arc(cx, 52, 14, 0, 6.28); x.fill(); x.stroke();
    }
  });
  return _cutoutTex;
}

// ---- the dressing entry points ----------------------------------------------------
function dressTrack(def, env) {
  DRESS.anims.length = 0;
  DRESS.glowMats.length = 0;
  DRESS.beam = null;
  _figGeos = null; _cutoutTex = null;               // rebuilt per scene (materials die with it)
  if (track.sea) buildSeaWater();
  if (def.dress === 'seaside') dressSeaside(def);
}

function dressUpdate(dt) {
  DRESS.uT.value += dt;
  for (const a of DRESS.anims) a.fn(a.obj, dt, DRESS.uT.value);
  const night = (typeof DN !== 'undefined') ? DN.nightFactor : 0;
  for (const m of DRESS.glowMats) m.emissiveIntensity = m.userData.glowDay + night * m.userData.glowNight;
}

// ---- ocean -----------------------------------------------------------------------
function buildSeaWater() {
  const sea = track.sea;
  const W = 6400, D = 3400;
  const g = new THREE.PlaneGeometry(W, D, 48, 24);   // segments so the shader swell shows
  g.rotateX(-Math.PI / 2);
  const mat = animMat(toonMat(0x2e7fc0, { transparent: true, opacity: 0.86 }), 'water');
  const m = new THREE.Mesh(g, mat);
  const c = sea.shore - 60 + D / 2;                  // starts under the beach, runs to horizon
  m.position.set(sea.dirX * c, sea.level, sea.dirZ * c);
  m.rotation.y = Math.atan2(sea.dirX, sea.dirZ);
  m.receiveShadow = false;
  scene.add(m);
}

// ---- seaside ----------------------------------------------------------------------
function dressSeaside(def) {
  const sea = track.sea;
  const N = track.N, halfW = track.halfW;

  // which lateral side of the road faces the sea, per sample
  const seaSide = (i) => {
    const s = track.samples[i], r = track.rights[i];
    return (r.x * sea.dirX + r.z * sea.dirZ) > 0 ? 1 : -1;
  };
  // how "seaside" a sample is (0..1): is there water within ~120m off the sea edge?
  const seasideK = (i) => {
    const side = seaSide(i);
    const p = trkPoint(i, side * (halfW + 55));
    return sea.k(p.x, p.z);
  };

  // shared pools — filled by every builder below, instanced ONCE at the end
  const P = {
    bodyDown: pool(), bodyUp: pool(), head: pool(), cutout: pool(),
    umbrella: pool(), towel: pool(), flag: pool(), pole: pool(), bulb: pool(),
  };
  const addFan = (x, y, z, yaw, seated) => {
    const up = Math.random() < 0.45;
    const shirt = new THREE.Color(SHIRTS[(Math.random() * SHIRTS.length) | 0]);
    poolAdd(up ? P.bodyUp : P.bodyDown, x, y, z, yaw + rand(-0.4, 0.4), rand(0.9, 1.1), shirt);
    poolAdd(P.head, x, y, z, yaw, rand(0.9, 1.1), new THREE.Color(SKINS[(Math.random() * SKINS.length) | 0]));
  };

  // ---------- grandstands (curvature-aware placement: straights only) ----------
  const standMatA = toonMat(0xcfd6de);              // structure
  const standMatB = toonMat(0x9aa5b1);              // rails/skirt
  const structGeos = [], skirtGeos = [];
  const buildStand = (i0, len, side, rows) => {
    for (let i = i0; i < i0 + len; i += 3) {
      const yawP = trkPoint(i, 0).yaw;
      for (let r2 = 0; r2 < rows; r2++) {
        const lat = side * (halfW + 10 + r2 * 2.0);
        const p = trkPoint(i, lat);
        const gy = terrainHeight(p.x, p.z);
        const bench = new THREE.BoxGeometry(2.0, 0.5, 3.4 * 2);
        bench.rotateY(yawP);
        bench.translate(p.x, gy + 1.0 + r2 * 1.15, p.z);
        structGeos.push(bench);
        // fans on this bench chunk (front 2 rows = 3D figs, back = cutouts)
        for (const t of [-2.6, -1.3, 0, 1.3, 2.6]) {
          if (Math.random() < 0.14) continue;       // empty seats read as real
          const fx = p.x + Math.sin(yawP) * t, fz = p.z + Math.cos(yawP) * t;
          const fy = gy + 1.25 + r2 * 1.15;
          const faceYaw = yawP + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI;
          if (r2 < 2) addFan(fx, fy, fz, faceYaw, true);
          else poolAdd(P.cutout, fx, fy + 0.85, fz, faceYaw,
                       rand(1.5, 1.8), new THREE.Color(SHIRTS[(Math.random() * SHIRTS.length) | 0]));
        }
      }
      // skirt wall at the back
      const pB = trkPoint(i, side * (halfW + 10 + rows * 2.0));
      const wall = new THREE.BoxGeometry(0.4, 1.2 + rows * 1.15, 3.4 * 2);
      wall.rotateY(yawP);
      wall.translate(pB.x, terrainHeight(pB.x, pB.z) + (1.2 + rows * 1.15) / 2, pB.z);
      skirtGeos.push(wall);
    }
  };
  // start/finish main stand (inland side) + two corner stands
  const startSide = -seaSide(0);
  buildStand(N - 21, 42, startSide, 6);
  buildStand((N * 0.30) | 0, 24, -seaSide((N * 0.30) | 0), 4);
  buildStand((N * 0.62) | 0, 24, -seaSide((N * 0.62) | 0), 4);
  addMerged(structGeos, standMatA, true);
  addMerged(skirtGeos, standMatB, false);

  // ---------- trackside superfans (clusters on the inland verges) ----------
  for (let c = 0; c < 26; c++) {
    const i = (Math.random() * N) | 0;
    const side = -seaSide(i);
    const lat = side * (halfW + rand(7, 16));
    const p = trkPoint(i, lat);
    const gy = terrainHeight(p.x, p.z);
    if (sea.k(p.x, p.z) > 0.02 && gy < sea.level + 0.6) continue;
    const face = p.yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI;
    for (let f = 0; f < 3 + ((Math.random() * 4) | 0); f++)
      addFan(p.x + rand(-3, 3), gy, p.z + rand(-3, 3), face, false);
  }

  // ---------- beach: umbrellas, towels, beach fans ----------
  const umbGeo = (() => {
    const BGU = window.FX.BufferGeometryUtils;
    const polef = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5); polef.translate(0, 1.1, 0);
    const top = new THREE.ConeGeometry(1.6, 0.7, 8); top.translate(0, 2.3, 0);
    return BGU.mergeGeometries([polef.toNonIndexed(), top.toNonIndexed()]);
  })();
  const towelGeo = new THREE.PlaneGeometry(1.1, 2.0); towelGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < N; i += 2) {
    const k = seasideK(i);
    if (k < 0.2 || Math.random() < 0.55) continue;
    const side = seaSide(i);
    for (let tries = 0; tries < 4; tries++) {
      const lat = side * (halfW + rand(14, 46));
      const p = trkPoint(i, lat);
      const gy = terrainHeight(p.x, p.z);
      if (gy < sea.level + 0.5 || gy > sea.level + 2.4) continue;    // sand band only
      const col = new THREE.Color(SHIRTS[(Math.random() * SHIRTS.length) | 0]);
      if (Math.random() < 0.6) poolAdd(P.umbrella, p.x, gy, p.z, rand(0, 6.28), rand(0.8, 1.15), col);
      else poolAdd(P.towel, p.x, gy + 0.03, p.z, rand(0, 6.28), 1, col);
      if (Math.random() < 0.5) addFan(p.x + rand(-2, 2), gy, p.z + rand(-2, 2), p.yaw + Math.PI, false);
      break;
    }
  }

  // ---------- boardwalk along the seaside arc ----------
  const walkTex = dressTex(128, 128, (x) => {
    x.fillStyle = '#c8a066'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#8a6a3c'; x.lineWidth = 4;
    for (let i2 = 0; i2 <= 8; i2++) { x.beginPath(); x.moveTo(0, i2 * 16); x.lineTo(128, i2 * 16); x.stroke(); }
    x.strokeStyle = '#20301f'; x.lineWidth = 2.5;
    x.strokeRect(1, 1, 126, 126);
  });
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
  const walkMat = toonMat(0xffffff, { map: walkTex });
  const walkRanges = [];
  { // contiguous ranges of seaside samples
    let s0 = -1;
    for (let i = 0; i <= N; i++) {
      const on = i < N && seasideK(i) > 0.3;
      if (on && s0 < 0) s0 = i;
      if (!on && s0 >= 0) { if (i - s0 > 24) walkRanges.push([s0, i]); s0 = -1; }
    }
  }
  const walkGeos = [];
  for (const [a, b] of walkRanges) {
    const posArr = [], uvArr = [];
    for (let i = a; i <= b; i++) {
      const side = seaSide(i);
      const p1 = trkPoint(i, side * (halfW + 2.5)), p2 = trkPoint(i, side * (halfW + 9.5));
      const y = track.samples[_IWD(i)].y + 0.18;
      posArr.push(p1.x, y, p1.z, p2.x, y, p2.z);
      uvArr.push(0, i * 0.55, 1, i * 0.55);
    }
    const g = new THREE.BufferGeometry();
    const idx = [];
    for (let q = 0; q < (b - a); q++) {
      const v = q * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    g.computeVertexNormals();
    walkGeos.push(g);
  }
  if (walkGeos.length) {
    const wm = addMerged(walkGeos, walkMat, false);
    if (wm) wm.material.side = THREE.DoubleSide;
  }

  // ---------- boardwalk shops + string lights ----------
  const awningTexs = [0, 1].map(v => dressTex(128, 64, (x) => {
    const cols = v ? ['#d0342c', '#f2ece0'] : ['#2e7fc0', '#f2ece0'];
    for (let i2 = 0; i2 < 8; i2++) { x.fillStyle = cols[i2 % 2]; x.fillRect(i2 * 16, 0, 16, 64); }
  }));
  const shopMats = [toonMat(0xf2e3c8), toonMat(0xdfe8ea), toonMat(0xf5d9c8)];
  const shopGeoParts = [[], [], []];
  const awnGeos = [[], []];
  let kitschAnchor = null;
  let shopIdx = 0;
  for (const [a, b] of walkRanges) {
    for (let i = a + 8; i < b - 8; i += 14) {
      const side = seaSide(i);
      const p = trkPoint(i, side * (halfW + 13.5));
      const gy = Math.max(terrainHeight(p.x, p.z), track.samples[_IWD(i)].y);
      const yaw = p.yaw;
      const w = rand(5.5, 7.5), d2 = 4.2, h = rand(3.2, 4.0);
      const box = new THREE.BoxGeometry(w, h, d2);
      box.rotateY(yaw); box.translate(p.x, gy + h / 2, p.z);
      shopGeoParts[shopIdx % 3].push(box);
      const awn = new THREE.BoxGeometry(w + 0.6, 0.12, 1.8);
      awn.rotateX(0.25); awn.rotateY(yaw);
      const ax = p.x - Math.cos(yaw) * (side * (d2 / 2 + 0.8)), az = p.z + Math.sin(yaw) * (side * (d2 / 2 + 0.8));
      awn.translate(ax, gy + h * 0.72, az);
      awnGeos[shopIdx % 2].push(awn);
      if (!kitschAnchor) kitschAnchor = { x: p.x, z: p.z, gy, yaw, side, i };
      shopIdx++;
      // string-light poles + bulbs along this shop's stretch of boardwalk
      const pp = trkPoint(i, side * (halfW + 9.0));
      poolAdd(P.pole, pp.x, track.samples[_IWD(i)].y + 0.18, pp.z, 0, 1, null);
      for (let bl = 0; bl < 8; bl++) {
        const bi2 = i - 7 + bl * 2;
        const pb = trkPoint(bi2, side * (halfW + 9.0));
        const sag = Math.sin((bl / 7) * Math.PI) * 0.55;
        poolAdd(P.bulb, pb.x, track.samples[_IWD(bi2)].y + 3.55 - sag, pb.z, 0, 1, null);
      }
    }
  }
  shopGeoParts.forEach((g, gi) => addMerged(g, shopMats[gi], true));
  awnGeos.forEach((g, gi) => addMerged(g, toonMat(0xffffff, { map: awningTexs[gi] }), false));

  // ---------- THE GIANT ICE CREAM (kitsch landmark; rename when brands land) ----------
  if (kitschAnchor) {
    const K = kitschAnchor;
    const px = K.x + Math.sin(K.yaw + K.side * Math.PI / 2) * 10;
    const pz = K.z + Math.cos(K.yaw + K.side * Math.PI / 2) * 10;
    const gy = terrainHeight(px, pz);
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 10), toonMat(0xd9a55e));
    cone.rotation.x = Math.PI; cone.position.y = 4.5;
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 9), toonMat(0xfdf6e3));
    s1.position.y = 10.4;
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(2.9, 12, 9), toonMat(0xf7c8d8));
    s2.position.y = 14.6;
    const s3 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 9), toonMat(0xc8e8f7));
    s3.position.y = 18.0;
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), toonMat(0xd0342c));
    cherry.position.y = 20.6;
    g.add(cone, s1, s2, s3, cherry);
    g.position.set(px, gy, pz);
    g.traverse(o => { o.castShadow = true; });
    scene.add(g);
    DRESS.anims.push({ obj: g, fn: (o, dt2) => { o.rotation.y += dt2 * 0.25; } });
  }

  // ---------- lighthouse on the island ----------
  if (sea.island) {
    const [ix, iz] = sea.island;
    const top = terrainHeight(ix, iz);
    const g = new THREE.Group();
    const stripeTex = dressTex(32, 128, (x) => {
      for (let i2 = 0; i2 < 8; i2++) { x.fillStyle = i2 % 2 ? '#d0342c' : '#f6f1e6'; x.fillRect(0, i2 * 16, 32, 16); }
    });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.1, 19, 12), toonMat(0xffffff, { map: stripeTex }));
    tower.position.y = 9.5;
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.5, 12), toonMat(0x20304a));
    gallery.position.y = 19.2;
    const lampMat = toonMat(0xfff2b0, { emissive: 0xffe089, emissiveIntensity: 0.4 });
    lampMat.userData = { glowDay: 0.4, glowNight: 2.6 };
    DRESS.glowMats.push(lampMat);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 10), lampMat);
    lantern.position.y = 20.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 10), toonMat(0xd0342c));
    roof.position.y = 22.9;
    g.add(tower, gallery, lantern, roof);
    // rocks around the base
    const rockMat = toonMat(0x8a8f96);
    for (let r2 = 0; r2 < 5; r2++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(2, 4.5), 0), rockMat);
      rock.position.set(rand(-8, 8), rand(-1.5, 0.5), rand(-8, 8));
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(rock);
    }
    // the rotating beam: two opposed translucent cones
    const beam = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const s2 of [1, -1]) {
      const bc = new THREE.Mesh(new THREE.ConeGeometry(7, 95, 8, 1, true), beamMat);
      bc.rotation.z = s2 * Math.PI / 2;
      bc.position.x = s2 * 47.5;
      beam.add(bc);
    }
    beam.position.y = 20.6;
    g.add(beam);
    DRESS.beam = beam;
    DRESS.anims.push({ obj: beam, fn: (o, dt2) => { o.rotation.y += dt2 * 0.7; } });
    g.position.set(ix, top - 0.4, iz);
    g.traverse(o => { if (o !== beam && !beam.children.includes(o)) o.castShadow = true; });
    scene.add(g);
  }

  // ---------- billboards (BRANDS placeholders — Adam's list swaps in up top) ----------
  const bbFrameGeos = [];
  const bbSpots = [];
  for (let b = 0; b < 6; b++) {
    const i = ((N * (b + 0.5) / 6) | 0);
    const side = -seaSide(i);
    const p = trkPoint(i, side * (halfW + 15));
    bbSpots.push({ p, i, side });
  }
  bbSpots.forEach((spot, bi) => {
    const brand = BRANDS[bi % BRANDS.length];
    const tex = dressTex(512, 192, (x, w, h) => {
      x.fillStyle = brand.bg; x.fillRect(0, 0, w, h);
      x.strokeStyle = brand.accent; x.lineWidth = 10; x.strokeRect(10, 10, w - 20, h - 20);
      x.fillStyle = brand.fg;
      x.font = '900 64px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(brand.name, w / 2, h / 2 + 4);
    });
    const gy = terrainHeight(spot.p.x, spot.p.z);
    const face = spot.p.yaw + (spot.side > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.8), toonMat(0xffffff, { map: tex }));
    panel.position.set(spot.p.x, gy + 5.6, spot.p.z);
    panel.rotation.y = face;
    panel.material.side = THREE.DoubleSide;
    scene.add(panel);
    for (const px of [-5.2, 5.2]) {                 // posts along the panel's local X axis
      const post = new THREE.BoxGeometry(0.45, 6.2, 0.45);
      post.translate(spot.p.x + Math.cos(face) * px, gy + 3.1, spot.p.z - Math.sin(face) * px);
      bbFrameGeos.push(post);
    }
  });
  addMerged(bbFrameGeos, toonMat(0x4a525c), false);

  // ---------- bunting flags along the start straight ----------
  const flagGeo = new THREE.PlaneGeometry(0.55, 0.42);
  flagGeo.translate(0, -0.21, 0);
  for (let i = -18; i <= 18; i += 3) {
    for (const side of [1, -1]) {
      const p = trkPoint(i, side * (halfW + 2.2));
      for (let f = 0; f < 4; f++) {
        const t2 = f / 3;
        const px2 = p.x + Math.sin(p.yaw) * (t2 - 0.5) * 5;
        const pz2 = p.z + Math.cos(p.yaw) * (t2 - 0.5) * 5;
        poolAdd(P.flag, px2, track.samples[_IWD(i)].y + 4.6 - Math.sin(t2 * Math.PI) * 0.4,
                pz2, p.yaw + Math.PI / 2, 1, new THREE.Color(SHIRTS[(f + i + (side > 0 ? 0 : 3)) & 7]));
      }
    }
  }

  // ---------- sky: blimp + balloons + gulls ----------
  { // blimp with a banner, slow orbit
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), toonMat(0xdfe6ee));
    body.scale.set(2.6, 1, 1);
    const fin = toonMat(0xd0342c);
    for (const [ry, rz] of [[0, 0.9], [0, -0.9], [0.9, 0], [-0.9, 0]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 3), fin);
      f.position.set(-20, ry * 6, rz * 6);
      f.rotation.x = rz ? 0 : Math.PI / 2;
      g.add(f);
    }
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 2.4), toonMat(0x4a525c));
    gondola.position.y = -9.5;
    const btx = dressTex(512, 96, (x, w, h) => {
      x.fillStyle = '#f6f1e6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#20304a'; x.font = '900 58px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('SEASIDE 300', w / 2, h / 2 + 2);
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(30, 5.5), toonMat(0xffffff, { map: btx }));
    banner.material.side = THREE.DoubleSide;
    banner.position.x = -44;
    g.add(body, gondola, banner);
    g.position.set(0, 130, 0);
    scene.add(g);
    DRESS.anims.push({ obj: g, fn: (o, dt2, t) => {
      const a = t * 0.028;
      o.position.set(Math.cos(a) * 480, 128 + Math.sin(t * 0.2) * 4, Math.sin(a) * 480);
      o.rotation.y = -a - Math.PI / 2;
    } });
  }
  { // hot-air balloons drifting over the water
    const balloonPool = pool();
    const BGU = window.FX.BufferGeometryUtils;
    const env2 = new THREE.SphereGeometry(6, 10, 8); env2.translate(0, 7, 0);
    const bask = new THREE.BoxGeometry(1.6, 1.4, 1.6); bask.translate(0, 0.7, 0);
    const bGeo = BGU.mergeGeometries([env2.toNonIndexed(), bask.toNonIndexed()]);
    for (let b = 0; b < 5; b++) {
      const a = rand(0, 6.28), r2 = rand(0, 1);
      poolAdd(balloonPool, sea.dirX * rand(700, 1600) + Math.cos(a) * 500 * r2,
              rand(60, 140), sea.dirZ * rand(700, 1600) + Math.sin(a) * 500 * r2,
              rand(0, 6.28), rand(0.9, 1.6), new THREE.Color(SHIRTS[b % SHIRTS.length]));
    }
    const bm = poolBuild(balloonPool, bGeo, toonMat(0xffffff), false);
    if (bm) DRESS.anims.push({ obj: bm, fn: (o, dt2, t) => { o.position.y = Math.sin(t * 0.11) * 3; } });
  }
  { // seagulls: instanced M-birds orbiting the lighthouse and the boardwalk
    const BGU = window.FX.BufferGeometryUtils;
    const wing1 = new THREE.PlaneGeometry(1.4, 0.4); wing1.rotateZ(0.35); wing1.translate(-0.6, 0, 0);
    const wing2 = new THREE.PlaneGeometry(1.4, 0.4); wing2.rotateZ(-0.35); wing2.translate(0.6, 0, 0);
    const gullGeo = BGU.mergeGeometries([wing1, wing2]);
    gullGeo.rotateX(-Math.PI / 2);                  // wings lie flat like a gliding bird
    const gullMat = toonMat(0xf2f2f2); gullMat.side = THREE.DoubleSide;
    const centers = [];
    if (sea.island) centers.push([sea.island[0], 34, sea.island[1]]);
    if (kitschAnchor) centers.push([kitschAnchor.x, 22, kitschAnchor.z]);
    centers.forEach(([cx, cy, cz]) => {
      const grp = new THREE.Group();
      const gp = pool();
      for (let b2 = 0; b2 < 6; b2++)
        poolAdd(gp, Math.cos(b2 / 6 * 6.28) * rand(12, 26), rand(-4, 4), Math.sin(b2 / 6 * 6.28) * rand(12, 26),
                rand(0, 6.28), rand(0.7, 1.2), null);
      const im = new THREE.InstancedMesh(gullGeo, gullMat, gp.m4s.length);
      gp.m4s.forEach((m4, mi) => im.setMatrixAt(mi, m4));
      im.computeBoundingSphere();
      grp.add(im);
      grp.position.set(cx, cy, cz);
      scene.add(grp);
      DRESS.anims.push({ obj: grp, fn: (o, dt2) => { o.rotation.y += dt2 * 0.5; } });
    });
  }

  // ---------- finalize the instanced pools ----------
  const F = figGeos();
  const figMat = animMat(toonMat(0xffffff), 'hop');
  const headMat = animMat(toonMat(0xffffff), 'hop');
  poolBuild(P.bodyDown, F.bodyDown, figMat, false);
  poolBuild(P.bodyUp, F.bodyUp, figMat, false);
  poolBuild(P.head, F.head, headMat, false);
  const cutMat = animMat(toonMat(0xffffff, { map: cutoutTex(), alphaTest: 0.5 }), 'hop');
  cutMat.side = THREE.DoubleSide;
  const cutGeo = new THREE.PlaneGeometry(1.15, 1.15);
  cutGeo.translate(0, 0.1, 0);
  poolBuild(P.cutout, cutGeo, cutMat, false);
  poolBuild(P.umbrella, umbGeo, toonMat(0xffffff), false);
  poolBuild(P.towel, towelGeo, toonMat(0xffffff, { side: THREE.DoubleSide }), false);
  const flagMat = animMat(toonMat(0xffffff, { side: THREE.DoubleSide }), 'flutter');
  poolBuild(P.flag, flagGeo, flagMat, false);
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6);
  poleGeo.translate(0, 1.8, 0);
  poolBuild(P.pole, poleGeo, toonMat(0x5a5148), false);
  const bulbMat = toonMat(0xfff4c8, { emissive: 0xffd98a, emissiveIntensity: 0.25 });
  bulbMat.userData = { glowDay: 0.25, glowNight: 2.4 };
  DRESS.glowMats.push(bulbMat);
  poolBuild(P.bulb, new THREE.SphereGeometry(0.09, 6, 5), bulbMat, false);
}
