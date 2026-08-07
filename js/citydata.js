/* Crescent Bay — the open-world map, generated deterministically (seeded) so the game and the
   phone build the exact same city. Produces window.CITY (aliased to window.PEMBROKE for the
   phone map code): { name, bbox, nodes, edges[{pts,ys,w,cls}], buildings[{poly,h,kind}],
   water, waterways, forests, height{...}, landmarks, races }.
   Layout: lakefront SW, low-rise downtown center, ring highway, switchback summit NE,
   countryside lanes S/E, forests, festival landmarks. */
'use strict';

(function () {
  // ---- seeded RNG (determinism matters: phone + game must agree) ----
  let _s = 20260721 >>> 0;
  const R = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = (a, b) => a + R() * (b - a);

  const BB = 2200;                      // half-extent; bbox is [-BB,-BB,BB,BB]
  const CITY = { name: 'Crescent Bay', bbox: [-BB, -BB, BB, BB], nodes: [], edges: [], buildings: [], water: [], waterways: [], forests: [], races: [], schools: [] };

  // ---- value-noise heightfield helpers ----
  const nz2 = (() => {                  // 2D value noise w/ smooth interp, seeded lattice
    const P = new Float32Array(512 * 512 / 64);   // hash lattice via mulberry on ints
    const lat = (ix, iz) => {
      let h = (ix * 374761393 + iz * 668265263) ^ 0x5bf03635;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
    };
    return (x, z) => {
      const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
      const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
      const a = lat(ix, iz), b = lat(ix + 1, iz), c = lat(ix, iz + 1), d = lat(ix + 1, iz + 1);
      return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
    };
  })();
  const fbm = (x, z, oct) => { let v = 0, amp = 1, f = 1, tot = 0; for (let o = 0; o < oct; o++) { v += nz2(x * f, z * f) * amp; tot += amp; amp *= 0.5; f *= 2.1; } return v / tot; };
  const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

  const LAKE = { cx: -1150, cz: 950, r: 520 };
  const SUMMIT = { cx: 1250, cz: -1250, h: 130, r: 700 };

  // base terrain before roads are burned in
  function baseH(x, z) {
    let h = (fbm(x / 900 + 7.3, z / 900 + 2.1, 4) - 0.5) * 90;          // rolling NH hills
    h += (fbm(x / 260 + 3.7, z / 260 + 9.9, 3) - 0.5) * 16;             // detail
    h += SUMMIT.h * gauss(x, z, SUMMIT.cx, SUMMIT.cz, SUMMIT.r);        // the summit
    h += 55 * gauss(x, z, -1500, -1550, 800);                           // NW highlands
    const dt = 1 - gauss(x, z, 150, -150, 800);                         // flatten downtown basin
    h *= 0.25 + 0.75 * dt;
    const lake = gauss(x, z, LAKE.cx, LAKE.cz, LAKE.r * 1.5);           // bowl for the lake
    h -= 26 * lake;
    return h;
  }

  // ---- roads ----
  const nodeMap = new Map();
  function nodeAt(x, z) {
    const k = Math.round(x / 6) + ',' + Math.round(z / 6);
    if (!nodeMap.has(k)) { nodeMap.set(k, CITY.nodes.length); CITY.nodes.push([x, z]); }
    return nodeMap.get(k);
  }
  function road(pts, w, cls) {
    const e = { pts, w, cls, a: nodeAt(pts[0][0], pts[0][1]), b: nodeAt(pts[pts.length - 1][0], pts[pts.length - 1][1]) };
    CITY.edges.push(e);
    return e;
  }
  const line = (x0, z0, x1, z1, seg = 1) => { const p = []; for (let i = 0; i <= seg; i++) p.push([x0 + (x1 - x0) * i / seg, z0 + (z1 - z0) * i / seg]); return p; };
  // a gently wandering country road between two points
  function wander(x0, z0, x1, z1, amp, seg = 14) {
    const p = [], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = -dz / L, nzz = dx / L;
    const ph = rr(0, 6.28), f = rr(1.5, 2.6);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, o = Math.sin(t * Math.PI * f + ph) * amp * Math.sin(t * Math.PI);
      p.push([x0 + dx * t + nx * o, z0 + dz * t + nzz * o]);
    }
    return p;
  }

  // downtown grid (streets w14) — cols x: -240..540 step 130, rows z: -370..70 step 110
  const GX = [], GZ = [];
  for (let x = -240; x <= 540; x += 130) GX.push(x);
  for (let z = -370; z <= 70; z += 110) GZ.push(z);
  for (const z of GZ) road(line(GX[0], z, GX[GX.length - 1], z, GX.length - 1), 14, 'street');
  for (const x of GX) road(line(x, GZ[0], x, GZ[GZ.length - 1], GZ.length - 1), 14, 'street');

  // ring highway: rounded loop through 8 anchor points
  const ringPts = [];
  const RA = [[0, -1750], [1250, -1600], [1800, -500], [1750, 800], [900, 1650], [-400, 1800], [-1600, 1500], [-1850, 200], [-1500, -1100], [-700, -1650]];
  for (let i = 0; i <= RA.length; i++) {          // Catmull-ish smoothing by midpoint subdivision
    const a = RA[i % RA.length], b = RA[(i + 1) % RA.length];
    ringPts.push(a, [(a[0] + b[0]) / 2 + rr(-60, 60), (a[1] + b[1]) / 2 + rr(-60, 60)]);
  }
  ringPts.push(ringPts[0]);
  road(ringPts.map(p => [p[0], p[1]]), 20, 'highway');

  // connectors: downtown edge -> ring
  road(line(150, GZ[0], 0, -1750, 6), 16, 'avenue');                     // north
  road(line(GX[GX.length - 1], -150, 1750, 800, 6), 16, 'avenue');       // east
  road(line(150, GZ[GZ.length - 1], 400, 1000, 5).concat(line(400, 1000, -400, 1800, 4).slice(1)), 16, 'avenue'); // south
  road(line(GX[0], -150, -900, 300, 4), 16, 'avenue');                   // west toward the lake

  // lakefront: marina boulevard + crescent coastal road hugging the NE shore
  const coast = [];
  for (let i = 0; i <= 16; i++) {
    const a = -0.55 + (i / 16) * 1.75;                                   // arc angle around the lake
    const r = LAKE.r + 95 + Math.sin(i * 1.7) * 22;
    coast.push([LAKE.cx + Math.cos(a) * r, LAKE.cz - Math.sin(a) * r]);
  }
  road(coast, 12, 'coastal');
  road(line(-900, 300, coast[10][0], coast[10][1], 3), 14, 'avenue');    // lake link
  road(line(coast[15][0], coast[15][1], -400, 1800, 3), 12, 'coastal');  // south shore link

  // summit switchbacks (NE) from the ring up the hill
  { const sw = [[1500, -1000]];
    let x = 1500, z = -1000;
    const tx = SUMMIT.cx, tz = SUMMIT.cz;
    for (let i = 0; i < 7; i++) {
      const t = (i + 1) / 8;
      const bx = 1500 + (tx - 1500) * t, bz = -1000 + (tz + 60 - -1000) * t;
      const side = i % 2 ? 1 : -1;
      sw.push([bx + side * (170 - i * 18), bz + rr(-25, 25)]);
    }
    sw.push([tx, tz]);
    road(sw, 10, 'mountain');
  }

  // countryside lanes with farms (S + E)
  road(wander(400, 1000, 1750, 800, 90), 10, 'lane');
  road(wander(0, -1750, -1500, -1100, 120), 10, 'lane');
  road(wander(900, 1650, 1750, 800, 80), 10, 'lane');
  road(wander(GX[GX.length - 1], -150, 1250, -1600, 110), 10, 'lane');

  // drive-in access
  road(line(900, 1650, 900, 1000, 3), 10, 'lane');

  // ---- venues: race facilities scattered around town, drivable in free roam ----
  // (edges flagged venue:true get no houses; surf:'dirt' renders gravel; dressed in city.js)
  function venue(pts, w, opts = {}) {
    const e = road(pts, w, 'venue');
    e.venue = true;
    if (opts.surf) e.surf = opts.surf;
    if (opts.stage) e.stage = true;
    if (opts.name) e.vname = opts.name;
    return e;
  }
  // Crescent Speedway: tri-oval in the south fields (same footprint as the circuit)
  {
    const c = [430, 1370], rot = 0.42, oval = [];
    const HL = 260, HWo = 120, CR = 88, PC = 6;
    const cxo = HL - CR, czo = HWo - CR;
    const corners = [[cxo, czo, 0], [-cxo, czo, Math.PI / 2], [-cxo, -czo, Math.PI], [cxo, -czo, 3 * Math.PI / 2]];
    for (const [qx, qz, a0] of corners)
      for (let i = 0; i <= PC; i++) {
        const a = a0 + (i / PC) * (Math.PI / 2);
        const px = qx + CR * Math.cos(a), pz = qz + CR * Math.sin(a);
        oval.push([c[0] + px * Math.cos(rot) - pz * Math.sin(rot), c[1] + px * Math.sin(rot) + pz * Math.cos(rot)]);
      }
    oval.push([oval[0][0], oval[0][1]]);
    venue(oval, 24, { name: 'Crescent Speedway' });
    road(line(400, 1000, oval[14][0], oval[14][1], 3), 10, 'lane');   // access from the south avenue
  }
  // Crescent Bay GP: the city-limits circuit west of downtown (mirrors the 'baygp' track def)
  {
    const off = [-700, -430];
    const gp = [
      [0, 0], [150, -20], [280, -70], [340, -170],
      [310, -270], [200, -310], [90, -280],
      [30, -190], [-70, -160], [-170, -200],
      [-260, -150], [-280, -50], [-220, 30],
      [-260, 120], [-190, 190], [-80, 200],
      [10, 160], [60, 90],
    ].map(p => [p[0] + off[0], p[1] + off[1]]);
    gp.push([gp[0][0], gp[0][1]]);
    venue(gp, 26, { name: 'Crescent Bay GP' });
    road(line(-240, -150, gp[0][0], gp[0][1], 3), 12, 'avenue');      // access from downtown's west edge
  }
  // Summit Stage: dirt run off the ring road climbing toward the radio tower
  {
    const sp = wander(1080, -680, SUMMIT.cx - 140, SUMMIT.cz + 260, 70, 16);
    venue(sp, 14, { surf: 'dirt', stage: true, name: 'Summit Stage' });
    road(line(1250, -1600, 1080, -680, 3), 10, 'lane');               // access spur from the ring
  }

  // ---- water ----
  { const poly = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = LAKE.r * (0.86 + 0.2 * fbm(Math.cos(a) * 2 + 9, Math.sin(a) * 2 + 4, 2));
      poly.push([LAKE.cx + Math.cos(a) * r, LAKE.cz + Math.sin(a) * r]);
    }
    CITY.water.push({ poly });
  }
  CITY.waterways.push({ pts: wander(LAKE.cx + LAKE.r * 0.7, LAKE.cz - LAKE.r * 0.5, 2100, -400, 160, 18), w: 16 });  // outlet river to the east

  const inLake = (x, z) => ((x - LAKE.cx) ** 2 + (z - LAKE.cz) ** 2) < (LAKE.r * 0.95) ** 2;

  // ---- buildings ----
  function bRect(cx, cz, w, d, ang, h, kind) {
    const ca = Math.cos(ang), sa = Math.sin(ang), hw = w / 2, hd = d / 2;
    const poly = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(p => [cx + p[0] * ca - p[1] * sa, cz + p[0] * sa + p[1] * ca]);
    CITY.buildings.push({ poly, h, kind });
  }
  // downtown blocks: buildings around each block perimeter
  for (let gi = 0; gi < GX.length - 1; gi++) for (let gj = 0; gj < GZ.length - 1; gj++) {
    const x0 = GX[gi] + 13, x1 = GX[gi + 1] - 13, z0 = GZ[gj] + 12, z1 = GZ[gj + 1] - 12;
    const per = [[x0, z0, x1, z0, 0], [x1, z0, x1, z1, Math.PI / 2], [x0, z1, x1, z1, 0], [x0, z0, x0, z1, Math.PI / 2]];
    for (const [ax, az, bx, bz, ang] of per) {
      const len = Math.hypot(bx - ax, bz - az);
      let t = 10;
      while (t < len - 10) {
        const w = rr(14, 26), d = rr(11, 17);
        if (t + w > len - 6) break;
        const f = (t + w / 2) / len;
        const px = ax + (bx - ax) * f + (ang ? (rr(0, 1) < 0.5 ? d / 2 + 1 : -d / 2 - 1) : 0);
        const pz = az + (bz - az) * f + (ang ? 0 : (rr(0, 1) < 0.5 ? d / 2 + 1 : -d / 2 - 1));
        const corner = t < 16 || t + w > len - 22;              // block corners run taller
        if (R() < 0.85) bRect(px, pz, w, d, ang, corner ? rr(16, 30) : rr(7, 20), 'city');
        t += w + rr(3, 9);
      }
    }
  }
  // suburbs: houses strung along streets/avenues/lanes
  for (const e of CITY.edges) {
    if (e.cls === 'highway' || e.cls === 'mountain' || e.venue) continue;
    const density = e.cls === 'lane' ? 0.24 : e.cls === 'coastal' ? 0.5 : 0.35;
    for (let i = 0; i < e.pts.length - 1; i++) {
      const [ax, az] = e.pts[i], [bx, bz] = e.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(L / 30));
      for (let k = 0; k < n; k++) {
        if (R() > density) continue;
        const t = (k + 0.5) / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        const side = R() < 0.5 ? 1 : -1, off = e.w / 2 + rr(9, 18);
        const hx = px + -dz * side * off, hz = pz + dx * side * off;
        if (Math.abs(hx) > BB - 60 || Math.abs(hz) > BB - 60 || inLake(hx, hz)) continue;
        if (Math.abs(hx - 150) < 420 && Math.abs(hz + 150) < 300) continue;   // downtown handled above
        const ang = Math.atan2(dz, dx);
        if (e.cls === 'lane' && R() < 0.3) {                                   // farm cluster
          bRect(hx, hz, rr(14, 22), rr(10, 16), ang, rr(7, 10), 'barn');
          bRect(hx + -dz * side * 26, hz + dx * side * 26, rr(8, 12), rr(8, 12), ang + rr(-0.3, 0.3), rr(4.5, 6), 'house');
        } else {
          bRect(hx, hz, rr(9, 14), rr(8, 12), ang + rr(-0.08, 0.08), rr(4.5, 7), 'house');
        }
      }
    }
  }

  // ---- forests ----
  function blob(cx, cz, r, n = 22) {
    const poly = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      poly.push([cx + Math.cos(a) * r * (0.7 + 0.5 * fbm(Math.cos(a) + cx * 0.001, Math.sin(a) + cz * 0.001, 2)), cz + Math.sin(a) * r * (0.7 + 0.5 * fbm(Math.sin(a) * 2, Math.cos(a) * 2, 2))]);
    }
    return { poly };
  }
  CITY.forests.push(blob(-1450, -1350, 620), blob(1400, 1500, 520), blob(950, -900, 420), blob(-1850, 550, 320), blob(1800, 100, 300), blob(-500, 1400, 300));

  // ---- landmarks ----
  CITY.landmarks = {
    ferris: [LAKE.cx + LAKE.r + 170, LAKE.cz - 240],
    marina: [LAKE.cx + LAKE.r + 130, LAKE.cz - 60],
    radio: [SUMMIT.cx, SUMMIT.cz],
    drivein: [900, 940],
    turbines: [[1620, -780], [1690, -460], [1740, -140], [1750, 190], [1720, 500]],
  };

  // ---- races (phase 4 scaffolding — start markers live in the world already) ----
  CITY.races = [
    { id: 'bay_sprint', name: 'Bayfront Sprint', tier: 1, reward: 500, start: [coast[2][0], coast[2][1]], line: coast.slice(0, 14) },
    { id: 'downtown_loop', name: 'Downtown Loop', tier: 1, reward: 600, start: [GX[0], GZ[0]], line: [] },
    { id: 'summit_climb', name: 'Summit Climb', tier: 2, reward: 900, start: [1500, -1000], line: [] },
    { id: 'ring_gp', name: 'Ring Circuit', tier: 3, reward: 1500, start: [0, -1750], line: [] },
  ];

  // ---- heightmap: base terrain with every road burned flat into it ----
  const COLS = 300, ROWS = 300;
  const x0 = -BB, z0 = -BB, dx = (BB * 2) / (COLS - 1), dz = (BB * 2) / (ROWS - 1);
  const data = new Float32Array(COLS * ROWS);
  for (let r2 = 0; r2 < ROWS; r2++) for (let c = 0; c < COLS; c++)
    data[r2 * COLS + c] = baseH(x0 + c * dx, z0 + r2 * dz);

  // per-edge: resample ~9m, smooth elevations along the road, then stamp into the grid
  const weight = new Float32Array(COLS * ROWS);
  for (const e of CITY.edges) {
    // resample
    const rp = [];
    for (let i = 0; i < e.pts.length - 1; i++) {
      const [ax, az] = e.pts[i], [bx, bz] = e.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 9));
      for (let k = 0; k < n; k++) rp.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    rp.push(e.pts[e.pts.length - 1].slice());
    // longitudinal smoothing of the road's elevation profile (roads cut/fill through hills)
    let ys = rp.map(p => baseH(p[0], p[1]));
    for (let pass = 0; pass < 3; pass++) {
      const s = ys.slice();
      for (let i = 0; i < ys.length; i++) {
        let acc = 0, cnt = 0;
        for (let j = -4; j <= 4; j++) { const k = i + j; if (k >= 0 && k < ys.length) { acc += s[k]; cnt++; } }
        ys[i] = acc / cnt;
      }
    }
    e.rs = rp; e.rys = ys;
    // burn into the grid: within corridor, terrain -> road elevation
    const corr = e.w / 2 + 22;
    for (let i = 0; i < rp.length; i++) {
      const [px, pz] = rp[i], py = ys[i];
      const c0 = Math.max(0, Math.floor((px - corr - x0) / dx)), c1 = Math.min(COLS - 1, Math.ceil((px + corr - x0) / dx));
      const r0 = Math.max(0, Math.floor((pz - corr - z0) / dz)), r1 = Math.min(ROWS - 1, Math.ceil((pz + corr - z0) / dz));
      for (let rr2 = r0; rr2 <= r1; rr2++) for (let cc = c0; cc <= c1; cc++) {
        const gx = x0 + cc * dx, gz = z0 + rr2 * dz;
        const d = Math.hypot(gx - px, gz - pz);
        if (d > corr) continue;
        const t = d / corr, w = 1 - t * t * (3 - 2 * t);          // 1 at centre -> 0 at corridor edge
        const idx = rr2 * COLS + cc;
        if (w > weight[idx]) {
          data[idx] = data[idx] * (1 - w) + py * w;
          weight[idx] = w;
        }
      }
    }
  }
  // water shelf: keep terrain under the lake below water level
  { const wl = -14;
    for (let r2 = 0; r2 < ROWS; r2++) for (let c = 0; c < COLS; c++) {
      const gx = x0 + c * dx, gz = z0 + r2 * dz;
      const g = gauss(gx, gz, LAKE.cx, LAKE.cz, LAKE.r);
      if (g > 0.4) data[r2 * COLS + c] = Math.min(data[r2 * COLS + c], wl - (g - 0.4) * 10);
    }
  }
  CITY.height = { x0, z0, dx, dz, cols: COLS, rows: ROWS, base: 0, data };
  CITY.waterLevel = -12;

  // final road elevations come FROM the burned grid, so roads + terrain agree exactly
  const hAt = (x, z) => {
    let cf = (x - x0) / dx, rf = (z - z0) / dz;
    cf = Math.max(0, Math.min(COLS - 1.001, cf)); rf = Math.max(0, Math.min(ROWS - 1.001, rf));
    const c = cf | 0, r2 = rf | 0, fc = cf - c, fr = rf - r2;
    const a = data[r2 * COLS + c], b = data[r2 * COLS + c + 1], cc = data[(r2 + 1) * COLS + c], d = data[(r2 + 1) * COLS + c + 1];
    return (a * (1 - fc) + b * fc) * (1 - fr) + (cc * (1 - fc) + d * fc) * fr;
  };
  for (const e of CITY.edges) e.rys = e.rs.map(p => hAt(p[0], p[1]));
  CITY.heightAtFn = hAt;

  window.CITY = CITY;
  window.PEMBROKE = CITY;               // phone map + old call sites read this name
})();
