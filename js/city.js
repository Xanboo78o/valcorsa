/* Crescent Bay world builder. Renders window.CITY (citydata.js) with the realism pipeline:
   real house geometry (gables/porches/chimneys/lit windows), facade-textured downtown blocks,
   streetlamps with pooled real lights, landmarks (ferris wheel, turbines, radio mast, drive-in),
   ambient traffic, and roads that share the terrain heightmap exactly (no clipping, ever).
   Defines: buildWorld(), worldCollide(car), cityUpdate(dt), trafficInputs(car). */
'use strict';

const ROAD_LIFT = 0.14;
const CB = {                                  // live handles for cityUpdate
  windowMats: [], lampHead: null, lampLights: [], lampPos: [],
  ferris: null, turbines: [], beacons: [], screenTex: null, screenCv: null,
  built: false,
};

// ---------------- building collision (oriented boxes in a spatial hash) ----------------
let WORLD_BLDG = [], WORLD_BHASH = new Map();
const WORLD_BCELL = 40;
function worldCollide(car) {
  const cx = Math.floor(car.x / WORLD_BCELL), cz = Math.floor(car.z / WORLD_BCELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const arr = WORLD_BHASH.get((cx + i) + ',' + (cz + j)); if (!arr) continue;
    for (const bi of arr) {
      const b = WORLD_BLDG[bi], dx = car.x - b.cx, dz = car.z - b.cz;
      const u = dx * b.ca + dz * b.sa, v = -dx * b.sa + dz * b.ca;
      if (u > -b.hw && u < b.hw && v > -b.hd && v < b.hd) {
        const pu = b.hw - Math.abs(u), pv = b.hd - Math.abs(v);
        let nu = 0, nv = 0; if (pu < pv) nu = u < 0 ? -1 : 1; else nv = v < 0 ? -1 : 1;
        const nx = nu * b.ca - nv * b.sa, nz = nu * b.sa + nv * b.ca, push = Math.min(pu, pv);
        car.x += nx * push; car.z += nz * push;
        const vo = car.velX * nx + car.velZ * nz;
        if (vo < 0) { car.velX -= vo * nx * 1.3; car.velZ -= vo * nz * 1.3; car.velX *= 0.85; car.velZ *= 0.85; }
      }
    }
  }
}
function addOBB(cx, cz, w, d, ang, pad = 1.4) {
  const obb = { cx, cz, hw: w / 2 + pad, hd: d / 2 + pad, ca: Math.cos(ang), sa: Math.sin(ang) };
  const idx = WORLD_BLDG.length; WORLD_BLDG.push(obb);
  const r = Math.max(w, d) / 2 + pad;
  const c0 = Math.floor((cx - r) / WORLD_BCELL), c1 = Math.floor((cx + r) / WORLD_BCELL);
  const d0 = Math.floor((cz - r) / WORLD_BCELL), d1 = Math.floor((cz + r) / WORLD_BCELL);
  for (let a = c0; a <= c1; a++) for (let b = d0; b <= d1; b++) {
    const k = a + ',' + b; (WORLD_BHASH.get(k) || WORLD_BHASH.set(k, []).get(k)).push(idx);
  }
}

// ---------------- facade textures: walls with real window grids + night glow ----------------
// Returns { map, emissiveMap, normalScaleOK } — one texture per style, shared by many buildings.
function facadeTexture(style) {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const ex = e.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  const base = style.wall;
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  // material grain: brick courses or siding laps
  if (style.kind === 'brick') {
    x.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = 0; y < H; y += 8) x.fillRect(0, y, W, 1.4);
    for (let y = 0; y < H; y += 8) for (let xx = (y / 8) % 2 ? 0 : 12; xx < W; xx += 24) x.fillRect(xx, y, 1.2, 8);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 6, 3); }
  } else if (style.kind === 'siding') {
    for (let y = 0; y < H; y += 10) { x.fillStyle = 'rgba(0,0,0,0.1)'; x.fillRect(0, y, W, 2); x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, y + 2, W, 1); }
  } else if (style.kind === 'glass') {
    // curtain-wall office: glass field with thin mullions and sky-gradient reflections
    const grd = x.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#7f98ad'); grd.addColorStop(0.5, '#57707f'); grd.addColorStop(1, '#3c4c58');
    x.fillStyle = grd; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,0.16)';
    x.beginPath(); x.moveTo(0, H * 0.75); x.lineTo(W * 0.6, 0); x.lineTo(W * 0.9, 0); x.lineTo(W * 0.2, H * 0.9); x.fill();
    x.fillStyle = style.wall;
    for (let y = 0; y < H; y += H / 8) x.fillRect(0, y, W, 4);
    for (let xx = 0; xx < W; xx += W / 6) x.fillRect(xx, 0, 3, H);
  } else {   // stucco / concrete
    for (let i = 0; i < 2600; i++) { const v = Math.random() * 0.07; x.fillStyle = `rgba(0,0,0,${v})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  }
  // window grid: floors x bays. Texture repeats vertically per-floor via UV, so draw 4 floors.
  const floors = 4, bays = style.bays || 4;
  const fh = H / floors, bw = W / bays;
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
    const wx = b * bw + bw * 0.22, wy = f * fh + fh * 0.24, ww = bw * 0.56, wh = fh * 0.5;
    x.fillStyle = '#11161d';                                   // frame recess
    x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
    const sky = ['#3a4a5c', '#46586c', '#2e3c4c'][Math.floor(Math.random() * 3)];
    x.fillStyle = sky; x.fillRect(wx, wy, ww, wh);              // glass w/ sky tint
    x.fillStyle = 'rgba(255,255,255,0.18)';                     // reflection streak
    x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx + ww * 0.45, wy); x.lineTo(wx + ww * 0.7, wy); x.lineTo(wx + ww * 0.25, wy + wh); x.fill();
    x.fillStyle = style.trim; x.fillRect(wx - 3, wy + wh + 1, ww + 6, 3);   // sill
    // some windows glow at night (drawn on the emissive map)
    if (Math.random() < 0.42) {
      ex.fillStyle = ['#ffd98c', '#ffe6b0', '#e8f0ff'][Math.floor(Math.random() * 3)];
      ex.fillRect(wx, wy, ww, wh);
    }
  }
  // street level: storefronts for downtown styles
  if (style.shop) {
    const sy = H - fh;
    x.fillStyle = '#1a1e24'; x.fillRect(0, sy, W, fh);
    x.fillStyle = '#2c3e50'; x.fillRect(6, sy + 8, W - 12, fh - 26);
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(6, sy + 8, W - 12, 10);
    x.fillStyle = style.awning || '#8c2f2a'; x.fillRect(0, sy, W, 9);
    ex.fillStyle = '#fff2cc'; ex.fillRect(6, sy + 8, W - 12, fh - 26);      // shop glow
  }
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  return { map: mk(c, true), emissiveMap: mk(e, true) };
}

const FACADES = [
  { kind: 'brick', wall: '#8a5040', trim: '#d8cfc0', bays: 4, shop: true, awning: '#7c2f28' },
  { kind: 'brick', wall: '#9c6650', trim: '#e0d8ca', bays: 5, shop: true, awning: '#2f5c40' },
  { kind: 'stucco', wall: '#b8aa92', trim: '#efe8da', bays: 4, shop: true, awning: '#3a4a6a' },
  { kind: 'stucco', wall: '#98a0a8', trim: '#d6dade', bays: 5, shop: false },
  { kind: 'brick', wall: '#6e4a3c', trim: '#c8beb0', bays: 3, shop: false },
  { kind: 'siding', wall: '#aab4ba', trim: '#e8eef2', bays: 4, shop: false },
  { kind: 'glass', wall: '#3c4c5c', trim: '#9fb2c4', bays: 6, shop: false },
  { kind: 'glass', wall: '#46525e', trim: '#b8c6d2', bays: 5, shop: true, awning: '#26343f' },
  { kind: 'brick', wall: '#a45a38', trim: '#e8ddc8', bays: 4, shop: true, awning: '#8a6a1c' },
  { kind: 'stucco', wall: '#c8b89a', trim: '#f2ecdc', bays: 3, shop: true, awning: '#5c3040' },
  { kind: 'brick', wall: '#5c4436', trim: '#beb2a0', bays: 5, shop: false },
  { kind: 'stucco', wall: '#8f9aa4', trim: '#dde3e8', bays: 4, shop: false },
];
const HOUSE_PALETTE = [0xcfd8dc, 0xe8e2d0, 0xb0c4cc, 0xd8c8a8, 0x9aab9a, 0xc8b8c8, 0xe0d5c5, 0x8fa3b0];
const ROOF_PALETTE = [0x4a4440, 0x5a5048, 0x3a3c40, 0x6a5448, 0x46505a];

// ---------------- the build ----------------
function buildWorld() {
  const P = window.CITY;
  const H = P.height;
  const heightAt = (x, z) => {
    let cf = (x - H.x0) / H.dx, rf = (z - H.z0) / H.dz;
    cf = Math.max(0, Math.min(H.cols - 1.001, cf)); rf = Math.max(0, Math.min(H.rows - 1.001, rf));
    const c = cf | 0, r = rf | 0, fc = cf - c, fr = rf - r, d = H.data, cw = H.cols;
    return (d[r * cw + c] * (1 - fc) + d[r * cw + c + 1] * fc) * (1 - fr) + (d[(r + 1) * cw + c] * (1 - fc) + d[(r + 1) * cw + c + 1] * fc) * fr;
  };
  const BGU = window.FX.BufferGeometryUtils;
  const RBox = window.FX.RoundedBoxGeometry;

  disposeScene();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0f4);
  dnInit(scene, { fog: 2900 });
  wInitScene(scene);
  CB.windowMats = []; CB.lampLights = []; CB.lampPos = []; CB.turbines = []; CB.beacons = [];
  WORLD_BLDG = []; WORLD_BHASH = new Map();
  if (camera) { camera.far = Math.max(camera.far, 9000); camera.updateProjectionMatrix(); }

  // ---- merged road-network samples for physics (nearestInfo over every street) ----
  const samples = [], rights = [], width = [], bank = [];
  for (const e of P.edges) {
    const rp = e.rs, ys = e.rys, hw = e.w / 2;
    for (let i = 0; i < rp.length; i++) {
      const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
      samples.push(new THREE.Vector3(rp[i][0], ys[i], rp[i][1]));
      rights.push(new THREE.Vector3(tz / L, 0, -tx / L));
      width.push(hw); bank.push(0);
    }
  }
  const N = samples.length, cellSize = 40, hash = new Map();
  for (let i = 0; i < N; i++) { const p = samples[i], k = Math.floor(p.x / cellSize) + ',' + Math.floor(p.z / cellSize); (hash.get(k) || hash.set(k, []).get(k)).push(i); }
  const nearestInfo = (x, z) => {                 // NO O(N) fallback (would hang at this scale)
    let bd = 1e9, bi = 0; const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const arr = hash.get((cx + i) + ',' + (cz + j)); if (arr) for (const s of arr) { const p = samples[s], d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; bi = s; } } }
    return { d: bd, y: samples[bi].y, i: bi };
  };
  const townDef = { env: 'city', hills: 0, surface: 'asphalt', laps: 0 };
  track = { def: townDef, open: true, heightAt, roadLift: ROAD_LIFT, samples, rights, bank, width, N, halfW: 9, ds: 9,
            nearestInfo, distToTrack: (x, z) => nearestInfo(x, z).d, bbox: P.bbox, nodes: P.nodes, edges: P.edges, races: P.races };

  // ---- terrain: heightmap-aligned CHUNKS (6x6) so off-screen land culls away; ground
  // colour gets real variety — hue patches, dry-grass swathes, dirt shoulders, rocky summits ----
  { const cols = H.cols, rows = H.rows, CH = 6;
    const groundMat = toonMat(0xffffff, { vertexColors: true });
    const n2 = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.0021 + Math.sin(z * 0.0017) * 2.1) * Math.cos(z * 0.0019 + Math.sin(x * 0.0023) * 1.7);
    const n3 = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.011 + z * 0.007) * Math.cos(z * 0.009 - x * 0.006);
    const cGreenA = new THREE.Color(0x466f2e), cGreenB = new THREE.Color(0x5f8f3e);
    const cDry = new THREE.Color(0x8f854a), cDirt = new THREE.Color(0x7a6a50), cRock = new THREE.Color(0x8a8578);
    const white = new THREE.Color(0xffffff), cc = new THREE.Color();
    const cw = Math.floor((cols - 1) / CH), rh = Math.floor((rows - 1) / CH);
    for (let bx = 0; bx < CH; bx++) for (let bz = 0; bz < CH; bz++) {
      const c0 = bx * cw, r0 = bz * rh;
      const c1 = bx === CH - 1 ? cols - 1 : c0 + cw, r1 = bz === CH - 1 ? rows - 1 : r0 + rh;
      const nx = c1 - c0 + 1, nz = r1 - r0 + 1;
      const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
      let vi = 0;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = H.x0 + c * H.dx, z = H.z0 + r * H.dz, y = heightAt(x, z);
        pos[vi * 3] = x; pos[vi * 3 + 1] = y - 0.06; pos[vi * 3 + 2] = z;
        uv[vi * 2] = c / (cols - 1); uv[vi * 2 + 1] = 1 - r / (rows - 1);
        // colour: meadow hue drift + dry patches + dirt near roads + rock up high
        // Toon 2.0: HARD painted patches — no gradients, crisp illustrated ground
        cc.copy(n2(x, z) > 0.55 ? cGreenB : cGreenA);
        if (n3(x, z) > 0.75) cc.copy(cDry);
        const rd = nearestInfo(x, z);
        if (rd.d < 18) cc.copy(cDirt);
        if (y > 60) cc.copy(cRock);
        col[vi * 3] = cc.r; col[vi * 3 + 1] = cc.g; col[vi * 3 + 2] = cc.b;
        vi++;
      }
      const idx = [];
      for (let r = 0; r < nz - 1; r++) for (let c = 0; c < nx - 1; c++) {
        const a = r * nx + c;
        idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const ground = new THREE.Mesh(geo, groundMat);
      ground.receiveShadow = true;
      scene.add(ground);
      wRegisterGround(ground);
    }
  }

  // ---- water: reflective lake + rivers at the fixed water level ----
  { const wl = P.waterLevel;
    // calm-reflective, NOT a sun mirror (a mirror lake + bloom = full-screen white blowout)
    const wMat = toonMat(0x2e6b96, { transparent: true, opacity: 0.94 });   // flat comic water
    const parts = [];
    for (const w of (P.water || [])) {
      const poly = w.poly; let cx = 0, cz = 0;
      for (const q of poly) { cx += q[0]; cz += q[1]; } cx /= poly.length; cz /= poly.length;
      const pos = [cx, wl, cz]; const idx = [];
      for (const q of poly) pos.push(q[0], wl, q[1]);
      for (let i = 0; i < poly.length; i++) idx.push(0, 1 + i, 1 + (i + 1) % poly.length);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      parts.push(g);
    }
    for (const rv of (P.waterways || [])) {
      const pts = rv.pts, hw = rv.w / 2, pos = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
        const rx = tz / L, rz = -tx / L;
        const y = Math.min(heightAt(pts[i][0], pts[i][1]) - 0.5, wl + 2 - i * 0.001);
        pos.push(pts[i][0] + rx * hw, y, pts[i][1] + rz * hw, pts[i][0] - rx * hw, y, pts[i][1] - rz * hw);
      }
      for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      parts.push(g);
    }
    if (parts.length) {
      const merged = BGU.mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
      const m = new THREE.Mesh(merged, wMat);
      m.material.side = THREE.DoubleSide; m.frustumCulled = false; m.receiveShadow = true;
      scene.add(m);
    }
  }

  // ---- roads: per-rail-draped ribbons + curb skirts + gravel shoulders, built PER EDGE
  // and merged into spatial chunks (whole-map single meshes defeated culling = lag) ----
  { const roadItems = [], dirtItems = [], curbItems = [], shItems = [];
    for (const e of P.edges) {
      const rp = e.rs, ys = e.rys, hw = e.w / 2;
      const roadPos = [], roadIdx = [], roadUv = [];
      const curbPos = [], curbIdx = [];
      const shPos = [], shIdx = [];
      let dist = 0;
      for (let i = 0; i < rp.length; i++) {
        const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
        const rx = tz / L, rz = -tx / L;
        if (i) dist += Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]);
        const lY = heightAt(rp[i][0] + rx * hw, rp[i][1] + rz * hw);
        const rY = heightAt(rp[i][0] - rx * hw, rp[i][1] - rz * hw);
        const y = ys[i];
        roadPos.push(rp[i][0] + rx * hw, Math.max(y, lY) + ROAD_LIFT, rp[i][1] + rz * hw,
                     rp[i][0] - rx * hw, Math.max(y, rY) + ROAD_LIFT, rp[i][1] - rz * hw);
        roadUv.push(0, dist / 24, 1, dist / 24);
        for (const sgn of [1, -1]) {
          const px = rp[i][0] + rx * hw * sgn, pz = rp[i][1] + rz * hw * sgn;
          const top = Math.max(y, heightAt(px, pz)) + ROAD_LIFT;
          curbPos.push(px, top, pz, px, top - 1.1, pz);
          const outX = rp[i][0] + rx * (hw + 2.6) * sgn, outZ = rp[i][1] + rz * (hw + 2.6) * sgn;
          shPos.push(px, top - 0.02, pz, outX, heightAt(outX, outZ) + 0.04, outZ);
        }
      }
      for (let i = 0; i < rp.length - 1; i++) {
        const a = i * 2;
        roadIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        const c = i * 4;
        curbIdx.push(c, c + 1, c + 4, c + 1, c + 5, c + 4, c + 2, c + 6, c + 3, c + 3, c + 6, c + 7);
        shIdx.push(c, c + 1, c + 4, c + 1, c + 5, c + 4, c + 2, c + 6, c + 3, c + 3, c + 6, c + 7);
      }
      const mid = rp[Math.floor(rp.length / 2)];
      const mk = (pos, idx, uv) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        else {                                             // simple strip uvs for detail maps
          const n = pos.length / 3, u2 = new Float32Array(n * 2);
          for (let i = 0; i < n; i++) { u2[i * 2] = (i % 4) / 3; u2[i * 2 + 1] = Math.floor(i / 4) * 0.25; }
          g.setAttribute('uv', new THREE.BufferAttribute(u2, 2));
        }
        g.setIndex(idx); g.computeVertexNormals();
        return g;
      };
      (e.surf === 'dirt' ? dirtItems : roadItems).push({ g: mk(roadPos, roadIdx, roadUv), x: mid[0], z: mid[1] });
      curbItems.push({ g: mk(curbPos, curbIdx), x: mid[0], z: mid[1] });
      shItems.push({ g: mk(shPos, shIdx), x: mid[0], z: mid[1] });
    }
    const roadMat = toonRoadMat('public');
    addMergedChunks(roadItems, roadMat, { cell: 640, shadow: false });
    wRegisterRoad(roadMat);
    if (dirtItems.length)     // dirt venue roads (Summit Stage)
      addMergedChunks(dirtItems, toonMat(0x9a7c52), { cell: 640, shadow: false });
    addMergedChunks(curbItems, toonMat(0x4c4f55, { roughness: 0.9, side: THREE.DoubleSide }), { cell: 640, shadow: false });
    addMergedChunks(shItems, toonMat(0x8a765a, { side: THREE.DoubleSide }), { cell: 640, shadow: false });
    // intersection patches
    const ipItems = [];
    for (const nd of P.nodes) {
      const [x, z] = nd, r = 10;
      const pos = [x - r, heightAt(x - r, z - r) + ROAD_LIFT + 0.012, z - r, x + r, heightAt(x + r, z - r) + ROAD_LIFT + 0.012, z - r,
                   x - r, heightAt(x - r, z + r) + ROAD_LIFT + 0.012, z + r, x + r, heightAt(x + r, z + r) + ROAD_LIFT + 0.012, z + r];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      ipItems.push({ g, x, z });
    }
    const ipMat = toonRoadMat('none');              // unmarked toon asphalt for junctions
    addMergedChunks(ipItems, ipMat, { cell: 640, shadow: false });
    wRegisterRoad(ipMat);
  }

  // ---- buildings ----
  buildCityBlocks(P, heightAt, BGU);
  buildHouses(P, heightAt, BGU, RBox);
  buildStreetlamps(P, heightAt);
  buildLandmarks(P, heightAt, BGU);
  buildVenues(P, heightAt);                    // speedway / GP / summit-stage dressing
  buildCityTrees(P, heightAt, nearestInfo);
  buildStreetLife(P, heightAt, nearestInfo);   // sidewalks, crosswalks, parked cars, tufts

  const spawn = (P.races[1] && P.races[1].start) || [0, 0];   // downtown — better first impression than the lake basin
  track.spawn = { x: spawn[0], z: spawn[1] };
  CB.built = true;
  return track;
}

// ---- building material textures (clapboard siding, roof shingles) + chunked merging ----
let SIDING_TEX = null;
function sidingTexture() {
  if (SIDING_TEX) return SIDING_TEX;
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#e8e6e0'; x.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 26) {                     // clapboard laps (~0.25m at 2.5m tile)
    const g = x.createLinearGradient(0, y, 0, y + 26);
    g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.8, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    x.fillStyle = g; x.fillRect(0, y, S, 26);
  }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; x.fillRect(Math.random() * S, Math.random() * S, 3, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  SIDING_TEX = { map: t };
  return SIDING_TEX;
}
// merge world-space geometries into ~cell-sized chunks so culling works
function addMergedChunks(items, mat, { cell = 480, shadow = true } = {}) {
  const BGU = window.FX.BufferGeometryUtils;
  const buckets = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(it.g);
  }
  for (const arr of buckets.values()) {
    const m = new THREE.Mesh(BGU.mergeGeometries(arr.map(g => g.index ? g.toNonIndexed() : g)), mat);
    m.castShadow = shadow; m.receiveShadow = true;
    scene.add(m);
  }
}

// Downtown/city blocks: box buildings wearing facade textures with real window grids.
function buildCityBlocks(P, heightAt, BGU) {
  const buckets = FACADES.map(() => []);
  const roofGeos = [];
  const obbOf = (poly) => {
    const [a, b, c] = [poly[0], poly[1], poly[2]];
    const w = Math.hypot(b[0] - a[0], b[1] - a[1]), d = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const cx = (poly[0][0] + poly[2][0]) / 2, cz = (poly[0][1] + poly[2][1]) / 2;
    return { cx, cz, w, d, ang };
  };
  for (const b of P.buildings) {
    if (b.kind !== 'city') continue;
    const o = obbOf(b.poly);
    const gy = heightAt(o.cx, o.cz);
    const fi = Math.floor(Math.random() * FACADES.length);
    const floors = Math.max(1, Math.round(b.h / 3.4));
    const g = new THREE.BoxGeometry(o.w, b.h, o.d);
    // per-face UV: repeat one texture-floor per real floor, bays scale with width
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, u * Math.max(1, Math.round(o.w / 7)), v * floors / 4);
    }
    g.rotateY(-o.ang);
    g.translate(o.cx, gy + b.h / 2 - 0.3, o.cz);
    buckets[fi].push({ g, x: o.cx, z: o.cz });
    // flat roof cap w/ parapet vibe
    const rg = new THREE.BoxGeometry(o.w + 0.5, 0.5, o.d + 0.5);
    rg.rotateY(-o.ang); rg.translate(o.cx, gy + b.h - 0.1, o.cz);
    roofGeos.push({ g: rg, x: o.cx, z: o.cz });
    if (Math.random() < 0.4) {   // rooftop AC unit
      const ac = new THREE.BoxGeometry(2 + Math.random() * 2, 1.2, 2);
      ac.rotateY(-o.ang + Math.random());
      ac.translate(o.cx + (Math.random() - 0.5) * o.w * 0.4, gy + b.h + 0.7, o.cz + (Math.random() - 0.5) * o.d * 0.4);
      roofGeos.push({ g: ac, x: o.cx, z: o.cz });
    }
    addOBB(o.cx, o.cz, o.w, o.d, o.ang);
  }
  buckets.forEach((geos, fi) => {
    if (!geos.length) return;
    const tex = facadeTexture(FACADES[fi]);
    const mat = toonMat(0xffffff, { map: tex.map, emissiveMap: tex.emissiveMap,
      emissive: 0xffffff, emissiveIntensity: 0 });
    CB.windowMats.push(mat);
    addMergedChunks(geos, mat);
  });
  if (roofGeos.length) addMergedChunks(roofGeos, toonMat(0x3c3e42, { roughness: 0.92 }));
}

// Houses: real geometry — body, gabled roof, porch, chimney, door, window quads that glow.
function buildHouses(P, heightAt, BGU, RBox) {
  const bodyGeos = [], roofGeos = [], trimGeos = [], glassGeos = [];
  const bodyCol = [], roofCol = [];
  const cW = new THREE.Color(), cR = new THREE.Color();
  let _hx = 0, _hz = 0;                       // current house centre (set per building below)
  const pushColored = (geo, arr, col) => {   // per-vertex colour for palette variety in one draw
    const n = geo.attributes.position.count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    arr.push({ g: geo, x: _hx, z: _hz });
  };
  const metersUV = (geo, sx, sy) => {         // scale 0..1 box UVs to world metres (texture tile = 2.5m)
    const uv = geo.attributes.uv;
    if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / 2.5, uv.getY(i) * sy / 2.5);
    return geo;
  };
  const gable = (w, h, d) => {               // triangular-prism roof
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.5, 0); s.lineTo(w / 2 + 0.5, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.6, bevelEnabled: false });
    g.translate(0, 0, -(d + 0.6) / 2);
    const uv = g.attributes.uv;                          // extrude UVs are metres; shingle tile = 2.5m
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5);
    return g;
  };
  const obbOf = (poly) => {
    const [a, b, c] = [poly[0], poly[1], poly[2]];
    const w = Math.hypot(b[0] - a[0], b[1] - a[1]), d = Math.hypot(c[0] - b[0], c[1] - b[1]);
    return { cx: (poly[0][0] + poly[2][0]) / 2, cz: (poly[0][1] + poly[2][1]) / 2, w, d, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  };
  for (const b of P.buildings) {
    if (b.kind === 'city') continue;
    const o = obbOf(b.poly);
    const gy = heightAt(o.cx, o.cz);
    _hx = o.cx; _hz = o.cz;
    const isBarn = b.kind === 'barn';
    cW.setHex(isBarn ? (Math.random() < 0.7 ? 0x9c3028 : 0xb8b0a0) : HOUSE_PALETTE[Math.floor(Math.random() * HOUSE_PALETTE.length)]);
    cR.setHex(ROOF_PALETTE[Math.floor(Math.random() * ROOF_PALETTE.length)]);
    const rot = -o.ang, bh = b.h;
    const place = (g, dx, dy, dz) => { g.rotateY(rot); const ca = Math.cos(rot), sa = Math.sin(rot); g.translate(o.cx + dx * ca + dz * sa, gy + dy, o.cz - dx * sa + dz * ca); return g; };
    // body
    pushColored(place(metersUV(new THREE.BoxGeometry(o.w, bh, o.d), Math.max(o.w, o.d), bh), 0, bh / 2 - 0.25, 0), bodyGeos, cW);
    bodyCol.push(cW.clone());
    // gabled roof (barns get a taller gambrel-ish pitch)
    const rh = isBarn ? o.w * 0.5 : o.w * 0.34;
    pushColored(place(gable(o.w, rh, o.d), 0, bh - 0.25, 0), roofGeos, cR);
    // chimney on most houses
    if (!isBarn && Math.random() < 0.65)
      pushColored(place(new THREE.BoxGeometry(0.8, rh + 1.6, 0.8), o.w * (Math.random() < 0.5 ? 0.28 : -0.28), bh + rh / 2, 0), trimGeos, cR.clone().multiplyScalar(0.7));
    // porch: slab + posts + little roof on the road-facing side
    if (!isBarn && Math.random() < 0.55) {
      const pw = Math.min(o.w * 0.7, 6), pd = 1.7;
      pushColored(place(new THREE.BoxGeometry(pw, 0.3, pd), 0, 0.15, o.d / 2 + pd / 2), trimGeos, cW.clone().multiplyScalar(0.85));
      pushColored(place(new THREE.BoxGeometry(pw + 0.3, 0.18, pd + 0.3), 0, 2.5, o.d / 2 + pd / 2), roofGeos, cR);
      for (const px of [-pw / 2 + 0.2, pw / 2 - 0.2])
        pushColored(place(new THREE.BoxGeometry(0.16, 2.4, 0.16), px, 1.3, o.d / 2 + pd - 0.2), trimGeos, cW.clone().lerp(new THREE.Color(0xffffff), 0.4));
    }
    // door + windows (glass quads slightly proud of the wall; glow at night)
    const face = o.d / 2 + 0.03;
    pushColored(place(new THREE.BoxGeometry(1.0, 2.1, 0.08), o.w * 0.18, 1.05, face), trimGeos, new THREE.Color(0x4a3428));
    const nWin = Math.max(2, Math.floor(o.w / 3.4));
    for (let wi = 0; wi < nWin; wi++) {
      const wx = -o.w / 2 + (wi + 0.5) * (o.w / nWin);
      if (Math.abs(wx - o.w * 0.18) < 1.2) continue;                        // skip the door bay
      glassGeos.push({ g: place(new THREE.BoxGeometry(1.15, 1.35, 0.06), wx, 1.6, face), x: _hx, z: _hz });
      if (bh > 5.4) glassGeos.push({ g: place(new THREE.BoxGeometry(1.15, 1.25, 0.06), wx, bh - 1.6, face), x: _hx, z: _hz });
    }
    // barn: big sliding door + hay loft opening
    if (isBarn) {
      pushColored(place(new THREE.BoxGeometry(Math.min(4.4, o.w * 0.4), 3.6, 0.1), 0, 1.8, face), trimGeos, new THREE.Color(0x3c2e22));
      pushColored(place(new THREE.BoxGeometry(1.3, 1.3, 0.1), 0, bh - 1.2, face), trimGeos, new THREE.Color(0x241c14));
    }
    addOBB(o.cx, o.cz, o.w, o.d, o.ang);
  }
  const sd = sidingTexture();
  addMergedChunks(bodyGeos, toonMat(0xffffff, { vertexColors: true, map: sd.map }));
  addMergedChunks(roofGeos, toonMat(0xffffff, { vertexColors: true }));
  addMergedChunks(trimGeos, toonMat(0xffffff, { vertexColors: true, roughness: 0.8 }));
  if (glassGeos.length) {
    const gm = toonMat(0x27313c, { emissive: 0xffd98c, emissiveIntensity: 0 });
    CB.windowMats.push(gm);
    addMergedChunks(glassGeos, gm, { shadow: false });
  }
}

// Streetlamps along downtown streets + avenues; heads glow at night, nearest few cast real light.
function buildStreetlamps(P, heightAt) {
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.6, 8);
  const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
  const headGeo = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.16, 0.5, 4, 8) : new THREE.SphereGeometry(0.2, 8, 6);
  const spots = [];
  for (const e of P.edges) {
    if (e.cls !== 'street' && e.cls !== 'avenue' && e.cls !== 'coastal') continue;
    const rp = e.rs; let acc = 0;
    for (let i = 1; i < rp.length; i++) {
      acc += Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]);
      if (acc < 42) continue;
      acc = 0;
      const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
      const side = (spots.length % 2) ? 1 : -1;
      const off = e.w / 2 + 1.2;
      const x = rp[i][0] + (tz / L) * off * side, z = rp[i][1] - (tx / L) * off * side;
      spots.push({ x, z, y: heightAt(x, z), ang: Math.atan2(tx, tz) + (side > 0 ? Math.PI : 0) });
    }
  }
  const nP = spots.length;
  const poleMat = toonMat(0x2a2d33, { roughness: 0.6, metalness: 0.7 });
  const headMat = toonMat(0xd8d4c8, { emissive: 0xffd9a0, emissiveIntensity: 0 });
  CB.lampHead = headMat;
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, nP);
  const arms = new THREE.InstancedMesh(armGeo, poleMat, nP);
  const heads = new THREE.InstancedMesh(headGeo, headMat, nP);
  poles.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), sv = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  spots.forEach((s, i) => {
    m4.compose(pv.set(s.x, s.y + 2.8, s.z), q.setFromEuler(eul.set(0, s.ang, 0)), sv);
    poles.setMatrixAt(i, m4);
    const ax = Math.sin(s.ang) * 0.7, az = Math.cos(s.ang) * 0.7;
    m4.compose(pv.set(s.x + ax, s.y + 5.5, s.z + az), q.setFromEuler(eul.set(Math.PI / 2.3, s.ang, 0)), sv);
    arms.setMatrixAt(i, m4);
    m4.compose(pv.set(s.x + ax * 2, s.y + 5.72, s.z + az * 2), q.setFromEuler(eul.set(Math.PI / 2, s.ang, 0)), sv);
    heads.setMatrixAt(i, m4);
    CB.lampPos.push([s.x + ax * 2, s.y + 5.4, s.z + az * 2]);
  });
  scene.add(poles, arms, heads);
  for (let i = 0; i < 6; i++) {         // pooled real lights, repositioned to the nearest lamps
    const pl = new THREE.PointLight(0xffd9a0, 0, 30, 1.8);
    scene.add(pl); CB.lampLights.push(pl);
  }
}

// The festival: ferris wheel, wind turbines, radio mast, drive-in, marina docks.
// Venue dressing: start gantries, grandstands, pit garages on the venue edge-loops.
function buildVenues(P, heightAt) {
  const gMat = toonMat(0x2b2e33, { roughness: 0.8 });
  const standMat = toonMat(0x6e7681, { roughness: 0.9 });
  const seatMat = toonMat(0x37507a, { roughness: 0.85 });
  const pitMat = toonMat(0x9aa0a8, { roughness: 0.88 });
  // tangent/right/height at sample i of a resampled edge polyline
  const frame = (rp, i) => {
    const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    return { x: rp[i][0], z: rp[i][1], tx, tz, rx: tz, rz: -tx, y: heightAt(rp[i][0], rp[i][1]) };
  };
  const gate = (f, wing) => {
    const grp = new THREE.Group();
    for (const s of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.9), gMat);
      pil.position.set(f.rx * s * wing, 4.5, f.rz * s * wing);
      pil.castShadow = true;
      grp.add(pil);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(wing * 2 + 1.5, 1.4, 1.1), gMat);
    beam.position.y = 8.4;
    beam.rotation.y = Math.atan2(f.rx, f.rz) + Math.PI / 2;
    grp.add(beam);
    grp.position.set(f.x, f.y, f.z);
    scene.add(grp);
  };
  for (const e of P.edges) {
    if (!e.venue) continue;
    const rp = e.rs, hw = e.w / 2;
    gate(frame(rp, 1), hw + 2.5);                                  // start line
    if (e.stage) { gate(frame(rp, rp.length - 2), hw + 2.5); continue; }  // dirt stage: finish arch only
    // grandstands along the opening straight (outside of the racing surface)
    for (const si of [8, 22]) {
      if (si >= rp.length - 1) continue;
      const f = frame(rp, si);
      const sx = f.x + f.rx * (hw + 10), sz = f.z + f.rz * (hw + 10);
      const gy = heightAt(sx, sz);
      const ang = Math.atan2(f.tz, f.tx);
      const base = new THREE.Mesh(new THREE.BoxGeometry(34, 1.4, 8), standMat);
      base.rotation.y = -ang;
      base.position.set(sx, gy + 0.7, sz);
      base.castShadow = true; base.receiveShadow = true;
      const seats = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 6), seatMat);
      seats.rotation.y = -ang;
      seats.rotation.z = 0.32;                                     // raked seating slab
      seats.position.set(sx + f.rx * 1.6, gy + 3.4, sz + f.rz * 1.6);
      seats.castShadow = true;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 9), gMat);
      roof.rotation.y = -ang;
      roof.position.set(sx + f.rx * 1.2, gy + 7.4, sz + f.rz * 1.2);
      roof.castShadow = true;
      scene.add(base, seats, roof);
      addOBB(sx, sz, 34, 9, ang);
    }
    // GP circuits get a pit garage row opposite the stands
    if (e.w >= 26) {
      const f = frame(rp, 14);
      const px = f.x - f.rx * (hw + 12), pz = f.z - f.rz * (hw + 12);
      const gy = heightAt(px, pz);
      const ang = Math.atan2(f.tz, f.tx);
      const pit = new THREE.Mesh(new THREE.BoxGeometry(64, 6, 12), pitMat);
      pit.rotation.y = -ang;
      pit.position.set(px, gy + 3, pz);
      pit.castShadow = true; pit.receiveShadow = true;
      scene.add(pit);
      addOBB(px, pz, 64, 12, ang);
    }
  }
}

function buildLandmarks(P, heightAt, BGU) {
  const L = P.landmarks;
  const steel = toonMat(0xc8ccd4, { roughness: 0.35, metalness: 0.9 });
  // -- ferris wheel --
  { const [fx, fz] = L.ferris, gy = heightAt(fx, fz);
    const grp = new THREE.Group();
    const R = 26;
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.5, 8, 44), steel);
    wheel.add(rim);
    const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 6, 44),
      new THREE.MeshStandardMaterial({ color: 0xff5f8a, emissive: 0xff5f8a, emissiveIntensity: 0 }));
    wheel.add(rimGlow); CB.windowMats.push(rimGlow.material);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, R, 6), steel);
      spoke.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0);
      spoke.rotation.z = a + Math.PI / 2;
      wheel.add(spoke);
      const cab = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8),
        paintMat([0xe23b2e, 0x2f6fe0, 0xf0a821, 0x28b45a, 0x9b30e0, 0x14b8c4][i % 6]));
      cab.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.6, 0);
      cab.scale.y = 1.2; cab.castShadow = true;
      wheel.add(cab);
    }
    wheel.position.y = R + 6;
    grp.add(wheel); CB.ferris = wheel;
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, R + 8, 8), steel);
      leg.position.set(s * 7, (R + 6) / 2, 2.5); leg.rotation.z = s * 0.24; leg.castShadow = true;
      grp.add(leg);
    }
    grp.position.set(fx, gy, fz);
    scene.add(grp);
    addOBB(fx, fz, 18, 8, 0);
  }
  // -- wind turbines on the ridge --
  for (const [tx, tz] of L.turbines) {
    const gy = heightAt(tx, tz);
    const grp = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, 42, 10), toonMat(0xe8eaee, { roughness: 0.4 }));
    tower.position.y = 21; tower.castShadow = true; grp.add(tower);
    const hub = new THREE.Group();
    hub.position.set(0, 42, 1.4);
    hub.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), toonMat(0xdfe2e8, { roughness: 0.4 })));
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 17, 0.35), toonMat(0xf2f4f8, { roughness: 0.35 }));
      blade.geometry.translate(0, 8.5, 0);
      blade.rotation.z = (b / 3) * Math.PI * 2;
      blade.castShadow = true;
      hub.add(blade);
    }
    grp.add(hub);
    CB.turbines.push(hub);
    grp.position.set(tx, gy, tz);
    grp.rotation.y = Math.random() * 0.6 - 1.8;
    scene.add(grp);
  }
  // -- radio mast with blinking beacons --
  { const [rx, rz] = L.radio, gy = heightAt(rx, rz);
    const grp = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.2, 70, 6, 4, true), new THREE.MeshStandardMaterial({ color: 0xb84438, roughness: 0.6, wireframe: true }));
    mast.position.y = 35; grp.add(mast);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.7, 70, 6), toonMat(0x8a8f98, { roughness: 0.5, metalness: 0.8 }));
    core.position.y = 35; grp.add(core);
    for (const by of [30, 50, 70]) {
      const bm = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 0 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), bm);
      bulb.position.y = by; grp.add(bulb); CB.beacons.push(bm);
    }
    grp.position.set(rx, gy, rz);
    scene.add(grp);
    addOBB(rx, rz, 5, 5, 0);
  }
  // -- drive-in theater --
  { const [dx, dz] = L.drivein, gy = heightAt(dx, dz);
    const grp = new THREE.Group();
    CB.screenCv = document.createElement('canvas'); CB.screenCv.width = 128; CB.screenCv.height = 72;
    const sx = CB.screenCv.getContext('2d'); sx.fillStyle = '#06080c'; sx.fillRect(0, 0, 128, 72);
    CB.screenTex = new THREE.CanvasTexture(CB.screenCv);
    CB.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(30, 17),
      new THREE.MeshStandardMaterial({ map: CB.screenTex, emissiveMap: CB.screenTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7 }));
    screen.position.set(0, 11, 0); grp.add(screen);
    CB.screenMat = screen.material;
    const back = new THREE.Mesh(new THREE.BoxGeometry(31, 18.5, 0.8), toonMat(0x565a62, { roughness: 0.85 }));
    back.position.set(0, 11, -0.6); back.castShadow = true; grp.add(back);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), toonMat(0x565a62));
      leg.position.set(s * 13, 5, -0.5); grp.add(leg);
    }
    const lot = new THREE.Mesh(new THREE.CircleGeometry(38, 24), toonMat(0x56514a, { roughness: 0.96 }));
    lot.rotation.x = -Math.PI / 2; lot.position.y = 0.08; lot.receiveShadow = true; grp.add(lot);
    grp.position.set(dx, gy, dz);
    grp.rotation.y = Math.PI;                     // faces the access lane
    scene.add(grp);
    addOBB(dx, dz - 0.5, 31, 2, Math.PI);
  }
  // -- marina: boardwalk + moored boats --
  { const [mx, mz] = L.marina, wl = P.waterLevel;
    const wood = toonMat(0x8a6a48, { roughness: 0.9 });
    for (let d = 0; d < 3; d++) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 26), wood);
      dock.position.set(mx - 30 - d * 14, wl + 0.5, mz + 10);
      dock.castShadow = true;
      scene.add(dock);
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(1.1, 3.4, 4, 8) : new THREE.SphereGeometry(1.4, 8, 6), paintMat([0xe8e8e8, 0x2f6fe0, 0xc44536][d]));
      hull.rotation.x = Math.PI / 2; hull.scale.y = 0.55;
      boat.add(hull);
      const mastB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), wood);
      mastB.position.y = 3; boat.add(mastB);
      boat.position.set(mx - 34 - d * 14, wl + 0.6, mz + 22);
      scene.add(boat);
    }
  }
}

// Trees: forest polys + rural fill, planted via the shared organic chunked system (main.js).
function buildCityTrees(P, heightAt, nearestInfo) {
  const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; };
  const spots = [];
  for (const f of (P.forests || [])) {
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (const q of f.poly) { mnx = Math.min(mnx, q[0]); mxx = Math.max(mxx, q[0]); mnz = Math.min(mnz, q[1]); mxz = Math.max(mxz, q[1]); }
    let placed = 0, tries = 0, want = 2200;
    while (placed < want && tries < want * 6) {
      tries++;
      const x = mnx + Math.random() * (mxx - mnx), z = mnz + Math.random() * (mxz - mnz);
      if (!pip(x, z, f.poly)) continue;
      if (nearestInfo(x, z).d < 14) continue;
      spots.push([x, z]); placed++;
    }
  }
  { let placed = 0, tries = 0; const FILL = 4200, [mnx, mnz, mxx, mxz] = P.bbox;
    while (placed < FILL && tries < FILL * 5) {
      tries++;
      const x = mnx + Math.random() * (mxx - mnx), z = mnz + Math.random() * (mxz - mnz);
      const inf = nearestInfo(x, z);
      if (inf.d < 26) continue;
      const bc = Math.floor(x / WORLD_BCELL) + ',' + Math.floor(z / WORLD_BCELL);
      if (WORLD_BHASH.has(bc)) continue;
      if (heightAt(x, z) < (P.waterLevel + 1.5)) continue;
      spots.push([x, z]); placed++;
    }
  }
  plantTrees(spots, 340);
}

// ---------------- street life: sidewalks, crosswalks, parked cars, grass tufts ----------------
// Downtown sidewalks with curb faces; striped crosswalks at street crossings; rows of BAKED
// parked cars (each variant merged to ONE vertex-colored geometry, then chunk-instanced);
// grass tufts along every road corridor.
function segCross(a0, a1, b0, b1) {          // segment intersection point or null
  const d1x = a1[0] - a0[0], d1z = a1[1] - a0[1], d2x = b1[0] - b0[0], d2z = b1[1] - b0[1];
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((b0[0] - a0[0]) * d2z - (b0[1] - a0[1]) * d2x) / den;
  const u = ((b0[0] - a0[0]) * d1z - (b0[1] - a0[1]) * d1x) / den;
  if (t < 0.03 || t > 0.97 || u < 0.03 || u > 0.97) return null;
  return [a0[0] + d1x * t, a0[1] + d1z * t];
}
function buildStreetLife(P, heightAt, nearestInfo) {
  const BGU = window.FX.BufferGeometryUtils;

  // ---- crossings of street-class edges (downtown grid junctions aren't nodes) ----
  const streets = P.edges.filter(e => e.cls === 'street');
  const crossings = [];
  for (let i = 0; i < streets.length; i++)
    for (let j = i + 1; j < streets.length; j++) {
      const A = streets[i].pts, B = streets[j].pts;
      const hit = segCross(A[0], A[A.length - 1], B[0], B[B.length - 1]);
      if (hit) crossings.push(hit);
    }

  // ---- sidewalks: raised strip + curb face along both sides of every street ----
  { const topItems = [], faceItems = [];
    for (const e of P.edges) {
      if (e.cls !== 'street') continue;
      const rp = e.rs, ys = e.rys, hw = e.w / 2;
      const tPos = [], tIdx = [], fPos = [], fIdx = [];
      for (let i = 0; i < rp.length; i++) {
        const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
        const rx = tz / L, rz = -tx / L;
        for (const sgn of [1, -1]) {
          const inX = rp[i][0] + rx * (hw + 0.1) * sgn, inZ = rp[i][1] + rz * (hw + 0.1) * sgn;
          const outX = rp[i][0] + rx * (hw + 2.6) * sgn, outZ = rp[i][1] + rz * (hw + 2.6) * sgn;
          const y = ys[i] + ROAD_LIFT + 0.14;
          tPos.push(inX, y, inZ, outX, Math.max(y - 0.06, heightAt(outX, outZ) + 0.06), outZ);
          fPos.push(inX, y, inZ, inX, y - 0.3, inZ);          // curb face down into the road edge
        }
      }
      for (let i = 0; i < rp.length - 1; i++) {
        const q = i * 4;
        tIdx.push(q, q + 1, q + 4, q + 1, q + 5, q + 4, q + 2, q + 6, q + 3, q + 3, q + 6, q + 7);
        fIdx.push(q, q + 1, q + 4, q + 1, q + 5, q + 4, q + 2, q + 6, q + 3, q + 3, q + 6, q + 7);
      }
      const mid = rp[Math.floor(rp.length / 2)];
      const mk = (pos, idx) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const n = pos.length / 3, uv = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) { uv[i * 2] = (i % 4) / 2; uv[i * 2 + 1] = Math.floor(i / 4) * 0.6; }
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        return g;
      };
      topItems.push({ g: mk(tPos, tIdx), x: mid[0], z: mid[1] });
      faceItems.push({ g: mk(fPos, fIdx), x: mid[0], z: mid[1] });
    }
    const conc = toonMat(0xb4b6ba, { roughness: 0.95, side: THREE.DoubleSide });
    addMergedChunks(topItems, conc, { cell: 640, shadow: false });
    addMergedChunks(faceItems, toonMat(0x8f9296, { roughness: 0.92, side: THREE.DoubleSide }), { cell: 640, shadow: false });
  }

  // ---- crosswalks: striped quads on the 4 approaches of each crossing ----
  { const cwItems = [];
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const x = cv.getContext('2d'); x.clearRect(0, 0, 128, 64);
    x.fillStyle = 'rgba(226,229,233,0.85)';
    for (let sx = 4; sx < 128; sx += 22) x.fillRect(sx, 4, 12, 56);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [cx, cz] of crossings) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const px = cx + dx * 9.6, pz = cz + dz * 9.6;
        const g = new THREE.PlaneGeometry(12, 3.2);
        g.rotateX(-Math.PI / 2);
        if (dx !== 0) g.rotateY(Math.PI / 2);
        g.translate(px, heightAt(px, pz) + ROAD_LIFT + 0.03, pz);
        cwItems.push({ g, x: px, z: pz });
      }
    }
    addMergedChunks(cwItems, mat, { cell: 640, shadow: false });
  }

  // ---- parked cars: bake loft variants to single vertex-colored geometries, instance in rows ----
  { const kits = [];
    for (let i = 0; i < 8; i++)
      kits.push({ chassis: ['muscle', 'rally'][i % 2], paint: (i * 3 + 1) % PAINTS.length, wheels: 'classic', decal: 'none' });
    const bakes = kits.map(k => bakeCarGeo(k));
    const mat = toonMat(0xffffff, { vertexColors: true });
    // spots along streets + avenues, clear of crossings
    const spots = [];
    for (const e of P.edges) {
      if (e.cls !== 'street' && e.cls !== 'avenue') continue;
      const rp = e.rs, ys = e.rys, hw = e.w / 2;
      let acc = 0, flip = 1;
      for (let i = 1; i < rp.length; i++) {
        acc += Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]);
        if (acc < 7.4) continue;
        acc = 0; flip = -flip;
        if (_vhash(rp[i][0], rp[i][1], 77) > 0.34) continue;
        let clear = true;
        for (const c of crossings) if (Math.hypot(c[0] - rp[i][0], c[1] - rp[i][1]) < 16) { clear = false; break; }
        if (!clear) continue;
        const a = rp[i - 1], b = rp[Math.min(rp.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
        const rx = tz / L, rz = -tx / L;
        const off = hw - 1.45;
        const px = rp[i][0] + rx * off * flip, pz = rp[i][1] + rz * off * flip;
        spots.push({ x: px, z: pz, y: ys[i] + ROAD_LIFT, ang: Math.atan2(tx / L, tz / L) + (flip > 0 ? 0 : Math.PI) });
      }
    }
    // chunked instancing per variant
    const buckets = new Map();
    spots.forEach((sp2, i) => {
      const vi = i % bakes.length;
      const k = Math.floor(sp2.x / 520) + ',' + Math.floor(sp2.z / 520) + ':' + vi;
      (buckets.get(k) || buckets.set(k, []).get(k)).push(sp2);
    });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), sv = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
    for (const [k, arr] of buckets) {
      const geo = bakes[+k.split(':')[1]];
      if (!geo) continue;
      const inst = new THREE.InstancedMesh(geo, mat, arr.length);
      arr.forEach((sp2, j) => {
        m4.compose(pv.set(sp2.x, sp2.y, sp2.z), q.setFromEuler(eul.set(0, sp2.ang, 0)), sv);
        inst.setMatrixAt(j, m4);
      });
      inst.castShadow = true;
      inst.computeBoundingSphere();
      scene.add(inst);
    }
    for (const sp2 of spots) addOBB(sp2.x, sp2.z, 2.0, 4.7, sp2.ang, 0.4);   // solid — no clipping through
  }

  // ---- grass tufts along every road corridor ----
  { const spots = [];
    for (const e of P.edges) {
      const rp = e.rs, hw = e.w / 2;
      for (let i = 0; i < rp.length; i += 2) {
        for (const sgn of [1, -1]) {
          if (_vhash(rp[i][0] * sgn, rp[i][1], 51) > 0.55) continue;
          const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
          let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1;
          const off = hw + 3 + _vhash(rp[i][0], rp[i][1] * sgn, 57) * 20;
          const px = rp[i][0] + (tz / L) * off * sgn, pz = rp[i][1] - (tx / L) * off * sgn;
          if (heightAt(px, pz) < P.waterLevel + 1) continue;
          spots.push([px, pz]);
          if (spots.length > 15000) break;
        }
        if (spots.length > 15000) break;
      }
      if (spots.length > 15000) break;
    }
    plantTufts(spots);
  }
}
// Bake a kit's loft mesh into ONE vertex-colored geometry (for cheap parked-car instancing).
function bakeCarGeo(kit) {
  const src = buildKitMesh(kit, 0x222222, 7);
  src.updateMatrixWorld(true);
  const geos = [], fallback = new THREE.Color(0x24262a);
  const paintCol = new THREE.Color(PAINTS[kit.paint % PAINTS.length]);
  src.traverse(o => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const n = g.attributes.position.count, cols = new Float32Array(n * 3);
    const col = (o.material && o.material.map) ? paintCol : (o.material && o.material.color) ? o.material.color : fallback;
    for (let i = 0; i < n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    const clean = new THREE.BufferGeometry();
    clean.setAttribute('position', g.attributes.position);
    if (!g.attributes.normal) g.computeVertexNormals();
    clean.setAttribute('normal', g.attributes.normal);
    clean.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(clean);
  });
  return geos.length ? window.FX.BufferGeometryUtils.mergeGeometries(geos) : null;
}

// ---------------- ambient traffic ----------------
const TRAFFIC_COLORS = [0x8a8f98, 0xc8ccd4, 0x2c2e33, 0x6a4a3a, 0x4a5a6a, 0x7a2e28, 0x3a4a3a, 0xd8d4c8];
function spawnTraffic(n) {
  const P = window.CITY;
  const adj = new Map();                        // node -> [{edge, end}]
  P.edges.forEach((e, ei) => {
    (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push({ ei, end: 'a' });
    (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push({ ei, end: 'b' });
  });
  track.adj = adj;
  // weighted edge pick: highways/avenues carry 3x the traffic
  const pool = [];
  P.edges.forEach((e2, ei2) => { const w2 = (e2.cls === 'highway' || e2.cls === 'avenue') ? 3 : 1; for (let k2 = 0; k2 < w2; k2++) pool.push(ei2); });
  for (let i = 0; i < n; i++) {
    const ei = pool[Math.floor(Math.random() * pool.length)];
    const e = P.edges[ei];
    const c = makeCar(TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], false, 'traffic', 0x222222, 'rally');
    c.traffic = true;
    c.tEdge = ei; c.tIdx = Math.floor(Math.random() * e.rs.length); c.tDir = Math.random() < 0.5 ? 1 : -1;
    const p = e.rs[c.tIdx];
    c.x = p[0]; c.z = p[1]; c.y = track.heightAt(p[0], p[1]) + ROAD_LIFT;
    c.heading = Math.random() * 6.28;
    cars.push(c);
    scene.add(c.mesh);
  }
}
function trafficInputs(car) {
  const P = window.CITY, e = P.edges[car.tEdge];
  // advance the waypoint pointer when close
  let wp = e.rs[car.tIdx];
  if (Math.hypot(wp[0] - car.x, wp[1] - car.z) < 9) {
    car.tIdx += car.tDir;
    if (car.tIdx < 0 || car.tIdx >= e.rs.length) {              // pick the next street at the node
      const nodeId = car.tIdx < 0 ? e.a : e.b;
      const opts = (track.adj.get(nodeId) || []).filter(o => o.ei !== car.tEdge);
      const nxt = opts.length ? opts[Math.floor(Math.random() * opts.length)] : { ei: car.tEdge, end: car.tIdx < 0 ? 'a' : 'b' };
      car.tEdge = nxt.ei;
      const ne = P.edges[car.tEdge];
      if (nxt.end === 'a') { car.tIdx = 0; car.tDir = 1; } else { car.tIdx = ne.rs.length - 1; car.tDir = -1; }
      wp = ne.rs[car.tIdx];
    } else wp = e.rs[car.tIdx];
  }
  // steer to the waypoint, keep a lane offset to the right of travel
  const ee = P.edges[car.tEdge];
  const nx2 = ee.rs[Math.max(0, Math.min(ee.rs.length - 1, car.tIdx + car.tDir))];
  let tx = nx2[0] - wp[0], tz = nx2[1] - wp[1];
  const L = Math.hypot(tx, tz) || 1;
  const laneOff = Math.min(ee.w * 0.24, 3.2);
  const gx = wp[0] + (tz / L) * laneOff * (car.tDir > 0 ? 1 : -1) * 0;   // markers already near lane centre
  const gz = wp[1];
  let err = Math.atan2(wp[0] + (tz / L) * laneOff * car.tDir - car.x, wp[1] - (tx / L) * laneOff * car.tDir - car.z) - car.heading;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  const steer = THREE.MathUtils.clamp(err * 2.2, -1, 1);
  // speed: sedate, slower in corners/near others
  const speed = Math.hypot(car.velX, car.velZ);
  let vT = (ee.cls === 'highway' ? 22 : ee.cls === 'lane' || ee.cls === 'mountain' ? 10 : 13);
  vT *= 1 - Math.min(Math.abs(err) * 1.6, 0.75);
  // yield: brake for anything ahead (player included)
  const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
  for (const o of cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dz = o.z - car.z, d = Math.hypot(dx, dz);
    if (d < 14 && (dx * fwdX + dz * fwdZ) > d * 0.5) vT = Math.min(vT, Math.max(0, (d - 6) * 1.6));
  }
  let throttle = 0, brake = 0;
  if (speed < vT - 0.5) throttle = 0.6;
  else if (speed > vT + 1) brake = 0.6;
  return { steer, throttle, brake, handbrake: 0 };
}

// ---------------- per-frame city life (lights, wheel, turbines, beacons, screen) ----------------
let _lampT = 0, _beaconT = 0;
function cityUpdate(dt) {
  if (!CB.built || !track || !track.open) return;
  const night = DN.nightFactor;
  const glow = THREE.MathUtils.smoothstep(night, 0.25, 0.8);
  for (const m of CB.windowMats) m.emissiveIntensity = glow * 1.6;
  if (CB.lampHead) CB.lampHead.emissiveIntensity = glow * 2.6;
  // pooled streetlights hop to the lamps nearest the player
  _lampT += dt;
  if (player && CB.lampPos.length && _lampT > 0.5) {
    _lampT = 0;
    const near = CB.lampPos
      .map(p => ({ p, d: (p[0] - player.x) ** 2 + (p[2] - player.z) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, CB.lampLights.length);
    CB.lampLights.forEach((pl, i) => {
      if (near[i] && near[i].d < 120 * 120) { pl.position.set(near[i].p[0], near[i].p[1], near[i].p[2]); pl.intensity = glow * 55; }
      else pl.intensity = 0;
    });
  }
  if (CB.ferris) CB.ferris.rotation.z += dt * 0.1;
  for (const t of CB.turbines) t.children.forEach((c, i) => { if (i > 0) c.rotation.z += dt * 0.9; });
  _beaconT += dt;
  const blink = (Math.sin(_beaconT * 2.4) > 0.2) ? 1 : 0;
  for (const b of CB.beacons) b.emissiveIntensity = blink * (0.4 + night * 2.6);
  // drive-in screen: plays colour after dark
  if (CB.screenMat) {
    CB.screenMat.emissiveIntensity = glow * 1.8;
    if (glow > 0.05 && CB.screenCv) {
      const x = CB.screenCv.getContext('2d'), t = performance.now() / 1000;
      const g = x.createLinearGradient(0, 0, 128, 72);
      g.addColorStop(0, `hsl(${(t * 12) % 360},60%,${30 + Math.sin(t * 0.7) * 14}%)`);
      g.addColorStop(1, `hsl(${(t * 12 + 80) % 360},55%,${24 + Math.cos(t * 0.9) * 10}%)`);
      x.fillStyle = g; x.fillRect(0, 0, 128, 72);
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.fillRect(0, 64, 128, 8);
      CB.screenTex.needsUpdate = true;
    }
  }
}
