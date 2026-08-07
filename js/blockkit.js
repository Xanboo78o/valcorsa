/* VALCORSA — BLOCKKIT v2: the toy cars, sculpted (Adam's Trailmakers technique).
   Overrides buildToyCar (the REAL car pipeline — buildKitMesh calls it directly).
   The craft, from studying Trailmakers builds:
     1. slopes come in families — LONG SHALLOW wedges for hoods, steeper for glass
     2. curves are rationed — one obvious rounded moment per car (the seat hump)
     3. wheel wells — arch fenders that wrap the wheels, a whisker wider than the body
   Bodies weld (merge) into one mesh per material; wheels/lamps/riders keep the
   original toy contract so steering, spinning, brake glow and ink outlines all work. */
'use strict';
(function () {
  const MU = window.FX.BufferGeometryUtils;

  // ---- the vocabulary ----
  let _cube = null, _wedge = null, _curve = null, _arch = null;
  function cubeGeo() { return _cube || (_cube = new THREE.BoxGeometry(1, 1, 1)); }
  function wedgeGeo() {                       // prism: full height at -Z, zero at +Z (scale sy/sz = any slope)
    if (_wedge) return _wedge;
    const p = [], n = [], idx = [];
    const v = [
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5],
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
    ];
    function face(list, nx, ny, nz, flip) {
      const s = p.length / 3;
      for (const i of list) { p.push(...v[i]); n.push(nx, ny, nz); }
      if (list.length === 4) idx.push(s, s + (flip ? 2 : 1), s + (flip ? 1 : 2), s, s + (flip ? 3 : 2), s + (flip ? 2 : 3));
      else idx.push(s, s + (flip ? 2 : 1), s + (flip ? 1 : 2));
    }
    const sl = Math.SQRT1_2;
    face([0, 2, 3, 1], 0, -1, 0, false);       // bottom
    face([4, 5, 3, 2], 0, 0, -1, false);       // tail (vertical)
    face([0, 1, 5, 4], 0, sl, sl, false);      // the slope
    face([0, 4, 2], -1, 0, 0, false);          // caps
    face([1, 3, 5], 1, 0, 0, false);
    _wedge = new THREE.BufferGeometry();
    _wedge.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    _wedge.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    _wedge.setIndex(idx);
    return _wedge;
  }
  function curveGeo() {                       // quarter-round: crisp everywhere, curved on one shoulder
    if (_curve) return _curve;
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5);
    s.lineTo(0.5, -0.5);
    s.absarc(-0.5, -0.5, 1, 0, Math.PI / 2, false);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -0.5);
    g.rotateY(Math.PI / 2);
    _curve = g;
    return _curve;
  }
  function archGeo() {                        // fender: slab with the wheel well. ORIGIN AT THE AXLE.
    if (_arch) return _arch;
    const s = new THREE.Shape();
    s.moveTo(-0.62, -0.1);
    s.lineTo(-0.44, -0.1);
    s.lineTo(-0.44, 0);
    s.absarc(0, 0, 0.44, Math.PI, 0, true);
    s.lineTo(0.44, -0.1);
    s.lineTo(0.62, -0.1);
    s.lineTo(0.62, 0.6);
    s.lineTo(-0.62, 0.6);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -0.5);
    g.rotateY(Math.PI / 2);
    _arch = g;
    return _arch;
  }
  const GEO = { c: cubeGeo, w: wedgeGeo, q: curveGeo, a: archGeo };

  /* weld: blocks -> ONE mesh per material. Geometries are normalized to
     non-indexed position+normal so boxes and extrusions merge cleanly.
     block = [type, matKey, x, y, z, sx, sy, sz, ry(quarter turns)] */
  function weld(g, matMap, blocks) {
    const buckets = {};
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const b of blocks) {
      const [t, mat, x, y, z, sx, sy, sz, ry] = b;
      let geo = GEO[t]();
      geo = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const key of Object.keys(geo.attributes)) if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key);
      e.set(0, (ry || 0) * Math.PI / 2, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      geo.applyMatrix4(m4);
      (buckets[mat] = buckets[mat] || []).push(geo);
    }
    for (const key of Object.keys(buckets)) {
      const merged = MU.mergeGeometries(buckets[key], false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, matMap[key]);
      mesh.castShadow = true;
      g.add(mesh);
    }
  }

  // ---- the override: same contract as the original buildToyCar ----
  const HUBS = (typeof HUB_COLS !== 'undefined') ? HUB_COLS : [0xc8ccd4, 0xe8e2ce, 0xc9a13b, 0x3a3e46, 0x20f6e8];
  window.buildToyCar = function (g, kit, helmetColor, headMats, tailMats) {
    const vehicle = { formula: 'f1', truck: 'monster', gt: 'coupe', muscle: 'muscle' }[kit.chassis] || kit.chassis;
    const paint = (typeof paintMat === 'function')          // Hot Wheels finish: clearcoat + rim (palette.js)
      ? paintMat(PAINTS[kit.paint % PAINTS.length])
      : toonMat(PAINTS[kit.paint % PAINTS.length]);
    const dark = toonMat(0x1c1e22);
    const glass = glassMat();
    const helmetMat = toonMat(helmetColor);
    const wIdx = (typeof kit.wheels === 'number' ? kit.wheels : 0) % HUBS.length;
    const hub = wIdx === 4
      ? toonMat(0x20f6e8, { emissive: 0x20f6e8, emissiveIntensity: 1.2 })
      : toonMat(HUBS[wIdx]);
    const M = { paint, dark, glass };
    const wheels = [];

    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const lamp = (kind, x, y, z, w = 0.24, h = 0.12) => {
      const mat = kind === 'head'
        ? toonMat(0x2a2820, { emissive: 0xfff3d8, emissiveIntensity: 0 })
        : toonMat(0x33120f, { emissive: 0xff2218, emissiveIntensity: 0 });
      (kind === 'head' ? headMats : tailMats).push(mat);
      add(new THREE.BoxGeometry(w, h, 0.06), mat, x, y, z);
    };
    // ---- THE FACE — every marque gets eyes (always-on DRLs, unlit-bright day and night)
    // and a mouth. Eyes sit NEXT TO the night lamps, never over them (beams must stay visible).
    const EYE = 0xf2f8ff, EYE_WARM = 0xffeec4, PUPIL = 0x10141c;
    const chromeM = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.5 });
    const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
    const eye = (x, y, z, r, c) => add(new THREE.CircleGeometry(r, 12), glowM(c || EYE), x, y, z);
    const pupil = (x, y, z, r) => add(new THREE.CircleGeometry(r, 10), glowM(PUPIL), x, y, z);
    const squint = (x, y, z, w, h, tilt) => add(new THREE.BoxGeometry(w, h, 0.03), glowM(EYE), x, y, z, 0, 0, tilt);
    const tooth = (x, y, z, w, h) => add(new THREE.BoxGeometry(w, h, 0.05), chromeM, x, y, z);
    // wheel STYLES are visible now: hub size/color per style + deep-dish ring
    // 0 sport silver · 1 classic big cream · 2 gold deep-dish · 3 steelies · 4 neon
    const HUBR = [0.55, 0.66, 0.5, 0.4, 0.6];
    const wheel = (x, z, front, r = 0.45, width = 0.44) => {
      const wg = new THREE.Group();
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), dark);
      w.rotation.z = Math.PI / 2; w.castShadow = true;
      wg.add(w);
      const hr = HUBR[wIdx] ?? 0.55;
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(r * hr, r * hr, width + 0.02, wIdx === 3 ? 8 : 10), hub);
      hb.rotation.z = Math.PI / 2;
      w.add(hb);
      if (wIdx === 2) {                                            // deep-dish: cream outer ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, 0.045, 6, 14), toonMat(0xf4ecdd));
        ring.rotation.y = Math.PI / 2;
        w.add(ring);
      }
      if (wIdx === 1) {                                            // classic: center cap
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, width + 0.06, 8), dark);
        cap.rotation.z = Math.PI / 2;
        w.add(cap);
      }
      wg.position.set(x, r, z);
      wg.userData.front = !!front;
      g.add(wg); wheels.push(wg);
      return wg;
    };
    const rider = (z, lean) => {
      add(new THREE.BoxGeometry(0.5, 0.6, 0.42), dark, 0, 0.62, z, lean || 0);
      add(new THREE.SphereGeometry(0.28, 10, 8), helmetMat, 0, 1.0, z + (lean ? 0.18 : 0));
    };

    // ---- DECALS, finally real: canvas plates stuck on the body like stickers ----
    const num = kit.num || ((kit.paint * 37 + 13) % 89) + 1;
    function decalTex(kind) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const c = cv.getContext('2d');
      if (kind === 'number') {
        c.fillStyle = '#f4ecdd'; c.beginPath(); c.arc(128, 64, 56, 0, 7); c.fill();
        c.lineWidth = 7; c.strokeStyle = '#1c1e22'; c.stroke();
        c.fillStyle = '#1c1e22'; c.font = '900 64px "Archivo Black", sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(num, 128, 68);
      } else if (kind === 'stripes') {
        c.fillStyle = '#f4ecdd';
        c.fillRect(88, 0, 32, 128); c.fillRect(136, 0, 32, 128);
      } else if (kind === 'flames') {
        c.fillStyle = '#ff8c1a';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(20 + i * 46, 118); c.lineTo(43 + i * 46, 10 + (i % 2) * 26); c.lineTo(66 + i * 46, 118);
          c.closePath(); c.fill();
        }
        c.fillStyle = '#ffd23e';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(32 + i * 46, 118); c.lineTo(43 + i * 46, 52 + (i % 2) * 20); c.lineTo(54 + i * 46, 118);
          c.closePath(); c.fill();
        }
      } else if (kind === 'checker') {
        for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) {
          c.fillStyle = (x + y) % 2 ? '#1c1e22' : '#f4ecdd';
          c.fillRect(x * 32, y * 32, 32, 32);
        }
      } else return null;
      const tx = new THREE.CanvasTexture(cv);
      tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      return tx;
    }
    function plate(tex, w, h, x, y, z, face) {          // face: 'left'|'right'|'up'
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(x, y, z);
      if (face === 'right') m.rotation.y = Math.PI / 2;
      else if (face === 'left') m.rotation.y = -Math.PI / 2;
      else if (face === 'up') { m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI; m.rotation.z = 0; }
      g.add(m);
      return m;
    }
    function applyDecals(vehId) {
      const kind = kit.decal && kit.decal !== 'none' ? kit.decal : null;
      if (!kind) return;
      const tex = decalTex(kind === 'stripes' || kind === 'checker' ? kind : 'number');
      const art = decalTex(kind);                        // flames/stripes/checker art for the roof/hood
      if (!tex && !art) return;
      const D = {
        coupe:   { side: [0.966, 0.72, 0.1, 1.15, 0.42], top: [0, 1.415, -0.42, 1.15, 0.9] },
        muscle:  { side: [1.015, 0.72, 0.2, 1.3, 0.46], top: [0, 1.462, -0.55, 1.15, 1.0] },
        rally:   { side: [0.965, 0.78, 0.15, 1.1, 0.5], top: [0, 1.588, -0.2, 1.2, 1.05] },
        monster: { side: [0.92, 2.06, -0.32, 0.95, 0.42], top: [0, 2.19, 1.05, 1.35, 1.15] },
        kart:    { top: [0, 0.55, -0.18, 0.55, 0.5] },
        f1:      { side: [0.37, 0.56, 0.75, 0.55, 0.34], top: [0, 0.72, 1.5, 0.5, 0.7] },
        bike:    { side: [0.21, 0.95, 0.28, 0.42, 0.26] },
        monoposto: { side: [1.12, 0.55, -0.2, 0.9, 0.32], top: [0, 0.76, 1.3, 0.44, 0.8] },
        endurance: { side: [1.03, 0.62, 0.3, 1.2, 0.38], top: [0, 1.26, -0.32, 1.0, 0.8] },
        barrel:    { side: [0.6, 0.82, -0.1, 0.6, 0.45] },
        longframe: { side: [0.63, 0.52, 0.6, 1.2, 0.28], top: [0, 0.63, 0.7, 0.6, 1.3] },
        sofa:      { side: [1.1, 0.9, 0, 0.8, 0.4], top: [0, 0.83, 0.05, 0.8, 0.8] },
      }[vehId];
      if (!D) return;
      if (D.side && tex) {
        plate(tex, D.side[3], D.side[4], D.side[0], D.side[1], D.side[2], 'right');
        plate(tex, D.side[3], D.side[4], -D.side[0], D.side[1], D.side[2], 'left');
      }
      if (D.top && art) plate(art, D.top[3], D.top[4], D.top[0], D.top[1], D.top[2], 'up');
    }

    if (vehicle === 'coupe') {                // Enginos GT: the big rectangle, sculpted
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.76, 0.18, 4.06],                // inset rocker (panel line)
        ['c', 'paint', 0, 0.58, 0, 1.9, 0.48, 4.2],                // THE rectangle
        ['w', 'paint', 0, 0.92, 1.4, 1.9, 0.2, 1.55],              // hood: super subtle slope
        ['c', 'paint', 0, 0.88, 2.02, 1.9, 0.12, 0.4],             // nose cap
        ['c', 'dark', 0, 1.0, -0.3, 1.5, 0.32, 1.8],               // cabin core behind the glass
        ['w', 'glass', 0, 1.18, 0.5, 1.6, 0.42, 0.95],             // raked windshield
        ['c', 'paint', 0, 1.28, -0.42, 1.64, 0.26, 1.0],           // roof
        ['q', 'paint', 0, 1.18, -1.2, 1.64, 0.46, 0.78],        // THE curve: seat-hump fastback
        ['q', 'paint', 0, 0.84, -1.78, 1.9, 0.3, 0.5],          // curve step down the tail
        ['c', 'dark', 0, 0.98, -2.02, 1.68, 0.07, 0.34],           // ducktail blade
        ['a', 'paint', -0.95, 0.46, 1.4, 0.5, 1.12, 1.12],         // wheel wells, all four
        ['a', 'paint', 0.95, 0.46, 1.4, 0.5, 1.12, 1.12],
        ['a', 'paint', -0.95, 0.48, -1.4, 0.54, 1.16, 1.16],
        ['a', 'paint', 0.95, 0.48, -1.4, 0.54, 1.16, 1.16],
      ]);
      lamp('head', -0.58, 0.7, 2.24); lamp('head', 0.58, 0.7, 2.24);
      // FACE: the predator — angry squint brow over the beams, wide hungry intake
      squint(-0.52, 0.87, 2.245, 0.46, 0.075, -0.15); squint(0.52, 0.87, 2.245, 0.46, 0.075, 0.15);
      add(new THREE.BoxGeometry(1.15, 0.2, 0.05), dark, 0, 0.5, 2.13);
      lamp('tail', -0.6, 0.72, -2.17, 0.42, 0.12); lamp('tail', 0.6, 0.72, -2.17, 0.42, 0.12);
      wheel(-0.95, 1.4, 1, 0.46, 0.42); wheel(0.95, 1.4, 1, 0.46, 0.42);
      wheel(-0.95, -1.4, 0, 0.48, 0.46); wheel(0.95, -1.4, 0, 0.48, 0.46);

    } else if (vehicle === 'muscle') {        // Houndsborough Iron: long hood, upright cab
      weld(g, M, [
        ['c', 'dark', 0, 0.28, 0.1, 1.86, 0.18, 4.5],
        ['c', 'paint', 0, 0.58, 0.1, 2.0, 0.52, 4.6],              // long low body
        ['w', 'paint', 0, 0.94, 1.35, 2.0, 0.18, 1.8],             // subtle hood slope
        ['c', 'dark', 0, 1.04, 1.2, 0.9, 0.14, 0.7],               // scoop ON the slope
        ['c', 'dark', 0, 1.02, -0.5, 1.5, 0.34, 1.5],              // cabin core
        ['w', 'glass', 0, 1.22, 0.32, 1.56, 0.44, 0.75],           // windshield
        ['c', 'paint', 0, 1.3, -0.55, 1.6, 0.3, 1.1],              // roof
        ['w', 'paint', 0, 1.2, -1.35, 1.6, 0.44, 0.75, 2],         // rear glassline wedge (flipped)
        ['c', 'paint', 0, 0.9, -1.9, 2.0, 0.28, 0.7],              // trunk
        ['c', 'dark', 0, 1.02, -2.2, 1.9, 0.08, 0.3],              // ducktail
        ['c', 'dark', 0, 0.42, 2.35, 2.05, 0.2, 0.3],              // bumpers
        ['c', 'dark', 0, 0.42, -2.3, 2.05, 0.2, 0.3],
        ['a', 'paint', -1.02, 0.5, 1.5, 0.54, 1.2, 1.2],
        ['a', 'paint', 1.02, 0.5, 1.5, 0.54, 1.2, 1.2],
        ['a', 'paint', -1.02, 0.54, -1.5, 0.6, 1.28, 1.28],
        ['a', 'paint', 1.02, 0.54, -1.5, 0.6, 1.28, 1.28],
      ]);
      lamp('head', -0.62, 0.66, 2.42); lamp('head', 0.62, 0.66, 2.42);
      // FACE: golden retriever with a V8 — big round eyes, five-tooth chrome grin
      eye(-0.62, 0.85, 2.43, 0.14, EYE_WARM); eye(0.62, 0.85, 2.43, 0.14, EYE_WARM);
      for (let tx = -2; tx <= 2; tx++) tooth(tx * 0.22, 0.44, 2.52, 0.1, 0.18);
      lamp('tail', -0.65, 0.7, -2.37, 0.5, 0.12); lamp('tail', 0.65, 0.7, -2.37, 0.5, 0.12);
      wheel(-1.02, 1.5, 1, 0.5, 0.46); wheel(1.02, 1.5, 1, 0.5, 0.46);
      wheel(-1.02, -1.5, 0, 0.54, 0.52); wheel(1.02, -1.5, 0, 0.54, 0.52);

    } else if (vehicle === 'rally') {         // Heiligen Strada: box-flare hatch
      weld(g, M, [
        ['c', 'paint', 0, 0.6, 0, 1.9, 0.68, 4.0],                 // tall body
        ['w', 'paint', 0, 1.06, 1.55, 1.9, 0.24, 0.9],             // stubby hood slope
        ['c', 'dark', 0, 1.1, -0.15, 1.52, 0.4, 1.85],             // cabin core
        ['w', 'glass', 0, 1.32, 0.68, 1.58, 0.44, 0.72],           // windshield
        ['c', 'paint', 0, 1.42, -0.2, 1.66, 0.32, 1.15],           // roof
        ['c', 'dark', 0, 1.62, 0.15, 0.5, 0.14, 0.42],             // roof scoop
        ['q', 'paint', 0, 1.32, -0.98, 1.66, 0.42, 0.58],       // hatch curve
        ['c', 'dark', 0, 1.46, -0.95, 1.5, 0.08, 0.45],            // roof spoiler blade
        ['c', 'paint', -0.94, 1.12, -1.98, 0.1, 0.4, 0.5],         // spoiler struts
        ['c', 'paint', 0.94, 1.12, -1.98, 0.1, 0.4, 0.5],
        ['c', 'dark', 0, 1.28, -2.0, 2.0, 0.1, 0.5],               // big rear wing
        ['c', 'dark', 0, 0.5, 2.05, 1.8, 0.24, 0.3],               // bash bar
        ['a', 'dark', -1.0, 0.52, 1.45, 0.62, 1.28, 1.28],         // BOXY dark flares (rally!)
        ['a', 'dark', 1.0, 0.52, 1.45, 0.62, 1.28, 1.28],
        ['a', 'dark', -1.0, 0.52, -1.45, 0.62, 1.28, 1.28],
        ['a', 'dark', 1.0, 0.52, -1.45, 0.62, 1.28, 1.28],
      ]);
      lamp('head', -0.55, 0.86, 2.02); lamp('head', 0.55, 0.86, 2.02);
      lamp('head', -0.2, 1.2, 1.98, 0.18, 0.14); lamp('head', 0.2, 1.2, 1.98, 0.18, 0.14);   // pod lights
      // FACE: over-caffeinated — four wide-open round eyes stacked rally style
      eye(-0.5, 1.0, 2.02, 0.12); eye(0.5, 1.0, 2.02, 0.12);
      eye(-0.2, 1.09, 2.02, 0.085); eye(0.2, 1.09, 2.02, 0.085);
      lamp('tail', -0.6, 0.9, -2.02); lamp('tail', 0.6, 0.9, -2.02);
      wheel(-1.0, 1.45, 1, 0.52, 0.5); wheel(1.0, 1.45, 1, 0.52, 0.5);
      wheel(-1.0, -1.45, 0, 0.52, 0.5); wheel(1.0, -1.45, 0, 0.52, 0.5);

    } else if (vehicle === 'bike') {          // Perro Moto: the dog, properly drawn this time
      weld(g, M, [
        ['c', 'paint', 0, 0.66, -0.2, 0.3, 0.32, 1.6],             // frame spine
        ['q', 'paint', 0, 0.95, 0.28, 0.4, 0.32, 0.72, 2],         // THE tank curve (bigger, obvious)
        ['c', 'dark', 0, 0.46, -0.15, 0.38, 0.34, 0.9],            // engine block
        ['c', 'dark', 0, 0.86, -0.6, 0.38, 0.1, 0.7],              // seat pad
        ['w', 'paint', 0, 1.0, -1.02, 0.36, 0.3, 0.65, 2],         // tail up-kick wedge
        ['w', 'paint', 0, 0.8, 0.95, 0.46, 0.4, 0.6],              // front fairing slope
        ['w', 'glass', 0, 1.1, 0.78, 0.3, 0.28, 0.35],             // screen
      ]);
      add(new THREE.TorusGeometry(0.57, 0.06, 6, 12, Math.PI), paint, 0, 0.5, 1.25, 0, Math.PI / 2);   // round front fender
      add(new THREE.TorusGeometry(0.57, 0.06, 6, 12, Math.PI), paint, 0, 0.5, -1.25, 0, Math.PI / 2);  // rear hugger
      for (const sx of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 6), dark, sx * 0.14, 0.88, 1.02, 0.42);   // raked fork legs
        add(new THREE.BoxGeometry(0.06, 0.07, 0.75), dark, sx * 0.13, 0.5, -0.85);                  // swingarm
      }
      add(new THREE.BoxGeometry(0.66, 0.05, 0.07), dark, 0, 1.2, 0.7);                              // handlebar
      add(new THREE.CylinderGeometry(0.05, 0.075, 0.8, 6), dark, 0.2, 0.82, -1.0, 1.15);            // upswept megaphone
      add(new THREE.BoxGeometry(0.42, 0.6, 0.44), dark, 0, 1.06, -0.32, -0.55);                     // tucked torso
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 1.34, 0.1);
      add(new THREE.BoxGeometry(0.14, 0.46, 0.14), dark, -0.27, 0.98, 0.4, 0, 0, 0.6);              // arms to the bars
      add(new THREE.BoxGeometry(0.14, 0.46, 0.14), dark, 0.27, 0.98, 0.4, 0, 0, -0.6);
      add(new THREE.BoxGeometry(0.13, 0.4, 0.3), dark, -0.25, 0.62, -0.4, 0.3);                     // legs gripping the tank
      add(new THREE.BoxGeometry(0.13, 0.4, 0.3), dark, 0.25, 0.62, -0.4, 0.3);
      // FACE: the cyclops — one big round eye out front where the fender can't hide it
      eye(0, 1.0, 1.315, 0.105);
      lamp('head', 0, 0.84, 1.28, 0.18, 0.16); lamp('tail', 0, 1.04, -1.34, 0.16, 0.1);
      wheel(0, 1.25, 1, 0.5, 0.22);
      wheel(0, -1.25, 0, 0.5, 0.26);

    } else if (vehicle === 'monster') {       // Norte Titan: slab frame, wedge cab, curve nose
      weld(g, M, [
        ['c', 'dark', 0, 1.4, 0, 2.0, 0.5, 3.4],                   // frame
        ['c', 'paint', 0, 1.88, 1.05, 2.0, 0.6, 1.5],              // hood block
        ['q', 'paint', 0, 1.88, 1.75, 2.0, 0.6, 0.4, 2],              // curve nose
        ['c', 'dark', 0, 2.1, -0.3, 1.62, 0.5, 1.35],              // cab core
        ['w', 'glass', 0, 2.34, 0.42, 1.7, 0.5, 0.62],             // windshield wedge
        ['c', 'paint', 0, 2.42, -0.35, 1.8, 0.4, 1.2],             // cab roof
        ['w', 'paint', 0, 2.3, -1.1, 1.8, 0.42, 0.5, 2],           // cab rear wedge
        ['c', 'paint', 0, 1.78, -1.65, 2.0, 0.7, 1.0],             // bed
        ['c', 'dark', 0, 2.0, -1.65, 1.5, 0.24, 0.6],              // cargo hump
        ['c', 'dark', 0, 1.55, 1.95, 2.1, 0.3, 0.3],               // bull bar
      ]);
      add(new THREE.BoxGeometry(0.5, 0.2, 0.5), dark, 0, 2.72, 0.4);
      for (const lx of [-0.5, 0, 0.5]) add(new THREE.SphereGeometry(0.14, 8, 6), toonMat(0xfff2b0), lx, 2.88, 0.4);
      lamp('head', -0.6, 1.95, 1.98); lamp('head', 0.6, 1.95, 1.98);
      // FACE: gentle giant — tiny eyes way up high, one MASSIVE chrome-barred grille
      eye(-0.6, 2.08, 2.0, 0.09); eye(0.6, 2.08, 2.0, 0.09);
      add(new THREE.BoxGeometry(1.5, 0.34, 0.06), dark, 0, 1.62, 1.99);
      tooth(0, 1.54, 2.03, 1.3, 0.05); tooth(0, 1.62, 2.03, 1.3, 0.05); tooth(0, 1.7, 2.03, 1.3, 0.05);
      lamp('tail', -0.7, 1.65, -2.18); lamp('tail', 0.7, 1.65, -2.18);
      wheel(-1.15, 1.35, 1, 0.95, 0.8); wheel(1.15, 1.35, 1, 0.95, 0.8);
      wheel(-1.15, -1.35, 0, 0.95, 0.8); wheel(1.15, -1.35, 0, 0.95, 0.8);

    } else if (vehicle === 'kart') {          // Granada Sprint: plank + subtle nose
      weld(g, M, [
        ['c', 'paint', 0, 0.2, 0, 1.15, 0.16, 2.5],                // plank
        ['w', 'paint', 0, 0.34, 1.05, 1.0, 0.14, 0.55],            // subtle nose wedge
        ['c', 'dark', 0, 0.22, 1.35, 1.25, 0.12, 0.5],             // front bumper
        ['c', 'paint', 0, 0.45, -0.2, 0.9, 0.5, 0.7],              // seat box
        ['q', 'paint', 0, 0.72, -0.5, 0.8, 0.28, 0.32],         // seat-back curve (the hump!)
        ['c', 'dark', 0.5, 0.42, -1.05, 0.5, 0.4, 0.55],           // engine
        ['q', 'dark', -0.42, 0.4, -1.05, 0.44, 0.3, 0.32],         // airbox curve
      ]);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), dark, 0, 0.62, 0.75, Math.PI / 3);
      add(new THREE.TorusGeometry(0.22, 0.04, 6, 10), dark, 0, 0.78, 0.95, Math.PI / 2.4);
      // FACE: the gremlin — googly eyes on the nose, pupils looking somewhere stupid
      eye(-0.26, 0.43, 1.36, 0.1); eye(0.26, 0.43, 1.36, 0.1);
      pupil(-0.24, 0.405, 1.368, 0.045); pupil(0.285, 0.41, 1.368, 0.045);
      rider(-0.1);
      wheel(-0.72, 0.95, 1, 0.34, 0.3); wheel(0.72, 0.95, 1, 0.34, 0.3);
      wheel(-0.78, -0.95, 0, 0.4, 0.42); wheel(0.78, -0.95, 0, 0.4, 0.42);

    } else if (vehicle === 'monoposto') {     // F1 Monoposto: the pinnacle — halo, fin, sculpted pods
      weld(g, M, [
        ['c', 'dark', 0, 0.3, -0.2, 1.66, 0.14, 3.3],              // floor plank
        ['c', 'paint', 0, 0.48, -0.2, 0.66, 0.32, 3.2],            // monocoque spine
        ['w', 'paint', 0, 0.64, 1.35, 0.56, 0.3, 1.9],             // LONG nose droop
        ['c', 'paint', 0, 0.46, 2.42, 0.42, 0.2, 0.9],             // nose tip
        ['c', 'dark', 0, 0.28, 2.85, 2.1, 0.07, 0.6],              // front wing main
        ['w', 'dark', 0, 0.38, 2.6, 2.04, 0.1, 0.32, 2],           // wing flap rise
        ['c', 'dark', -1.02, 0.44, 2.85, 0.07, 0.3, 0.62],         // FW endplates
        ['c', 'dark', 1.02, 0.44, 2.85, 0.07, 0.3, 0.62],
        ['q', 'paint', -0.78, 0.62, 0.6, 0.5, 0.34, 0.5, 2],       // pod inlet curves
        ['q', 'paint', 0.78, 0.62, 0.6, 0.5, 0.34, 0.5, 2],
        ['c', 'paint', -0.82, 0.5, -0.4, 0.58, 0.4, 1.9],          // sidepods
        ['c', 'paint', 0.82, 0.5, -0.4, 0.58, 0.4, 1.9],
        ['w', 'paint', -0.82, 0.76, -0.95, 0.58, 0.14, 1.0, 2],    // pod-top downwash ramps
        ['w', 'paint', 0.82, 0.76, -0.95, 0.58, 0.14, 1.0, 2],
        ['c', 'dark', 0, 0.68, 0.45, 0.64, 0.26, 0.8],             // cockpit surround
        ['c', 'dark', 0, 1.04, -0.35, 0.3, 0.2, 0.4],              // airbox over the head
        ['w', 'paint', 0, 0.84, -1.05, 0.5, 0.44, 1.7, 2],         // engine cover taper
        ['c', 'paint', 0, 1.08, -1.35, 0.06, 0.42, 1.1],           // SHARK FIN
        ['c', 'dark', 0, 1.12, -2.05, 1.72, 0.08, 0.5],            // rear wing
        ['c', 'dark', -0.82, 0.86, -2.05, 0.07, 0.55, 0.55],       // RW endplates
        ['c', 'dark', 0.82, 0.86, -2.05, 0.07, 0.55, 0.55],
        ['w', 'dark', 0, 0.34, -1.85, 1.5, 0.22, 0.5],             // diffuser kick
      ]);
      add(new THREE.TorusGeometry(0.33, 0.045, 6, 14, Math.PI), dark, 0, 0.84, 0.32);        // THE HALO
      add(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6), dark, 0, 0.84, 0.52, 0.5);       // halo pillar, raked
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 0.8, 0.28);
      lamp('tail', 0, 0.92, -2.32, 0.16, 0.22);                                              // rain light
      // FACE: the Storm stare — one cold LED slit across the nose tip
      squint(0, 0.51, 2.885, 0.36, 0.055, 0);
      wheel(-1.0, 1.5, 1, 0.44, 0.4); wheel(1.0, 1.5, 1, 0.44, 0.4);
      wheel(-1.04, -1.45, 0, 0.47, 0.46); wheel(1.04, -1.45, 0, 0.47, 0.46);

    } else if (vehicle === 'endurance') {     // Heiligen Endurance Frame: October's night racer
      weld(g, M, [
        ['c', 'dark', 0, 0.28, 0, 1.9, 0.16, 4.3],                 // splitter floor
        ['c', 'paint', 0, 0.54, 0.1, 1.95, 0.42, 4.4],             // wide low hull
        ['w', 'paint', 0, 0.86, 1.45, 1.95, 0.2, 1.6],             // LONG nose slope
        ['c', 'paint', 0, 0.8, 2.25, 1.95, 0.14, 0.35],            // nose band
        ['w', 'glass', 0, 1.06, 0.55, 1.0, 0.34, 0.75],            // canopy windshield (narrow bubble)
        ['c', 'dark', 0, 1.1, -0.1, 0.96, 0.3, 0.7],               // canopy core
        ['q', 'paint', 0, 1.08, -0.55, 1.0, 0.34, 0.6],            // canopy fastback curve
        ['w', 'paint', 0, 0.9, -1.5, 1.9, 0.24, 1.3, 2],           // long tail taper
        ['c', 'paint', 0, 1.0, -1.2, 0.07, 0.5, 1.6],              // SHARK FIN down the tail
        ['c', 'dark', 0, 1.16, -2.0, 1.95, 0.08, 0.45],            // rear wing
        ['c', 'dark', -0.94, 0.94, -2.0, 0.07, 0.5, 0.5],          // endplates
        ['c', 'dark', 0.94, 0.94, -2.0, 0.07, 0.5, 0.5],
        ['w', 'dark', 0, 0.34, -1.95, 1.7, 0.2, 0.45],             // diffuser
        ['a', 'paint', -1.0, 0.5, 1.45, 0.54, 1.2, 1.2],           // full fenders
        ['a', 'paint', 1.0, 0.5, 1.45, 0.54, 1.2, 1.2],
        ['a', 'paint', -1.0, 0.52, -1.45, 0.56, 1.24, 1.24],
        ['a', 'paint', 1.0, 0.52, -1.45, 0.56, 1.24, 1.24],
      ]);
      // the endurance signature: SIX headlamps for the October night
      lamp('head', -0.62, 0.84, 2.32, 0.3, 0.14); lamp('head', 0.62, 0.84, 2.32, 0.3, 0.14);
      lamp('head', -0.32, 0.88, 2.36, 0.16, 0.16); lamp('head', 0.32, 0.88, 2.36, 0.16, 0.16);
      lamp('head', -0.28, 1.24, 0.24, 0.14, 0.1); lamp('head', 0.28, 1.24, 0.24, 0.14, 0.1); // canopy brow pods
      // FACE: the October monster — four extra spider eyes riding above the lamp clusters
      eye(-0.62, 0.96, 2.34, 0.07, EYE_WARM); eye(0.62, 0.96, 2.34, 0.07, EYE_WARM);
      eye(-0.32, 1.0, 2.38, 0.055, EYE_WARM); eye(0.32, 1.0, 2.38, 0.055, EYE_WARM);
      lamp('tail', -0.8, 0.86, -2.2, 0.3, 0.1); lamp('tail', 0.8, 0.86, -2.2, 0.3, 0.1);
      wheel(-1.0, 1.45, 1, 0.48, 0.44); wheel(1.0, 1.45, 1, 0.48, 0.44);
      wheel(-1.0, -1.45, 0, 0.5, 0.48); wheel(1.0, -1.45, 0, 0.5, 0.48);

    } else if (vehicle === 'barrel') {        // Barrel Kart: it's a barrel
      weld(g, M, [
        ['c', 'paint', 0, 0.2, 0.15, 1.1, 0.16, 2.3],              // kart plank
        ['w', 'paint', 0, 0.34, 1.2, 0.95, 0.14, 0.5],             // nose wedge
        ['c', 'dark', 0, 0.24, 1.5, 1.2, 0.12, 0.4],               // bumper
        ['c', 'dark', 0.48, 0.44, -0.95, 0.46, 0.38, 0.5],         // engine
        ['q', 'dark', -0.4, 0.42, -0.95, 0.4, 0.28, 0.3],          // airbox curve
      ]);
      add(new THREE.CylinderGeometry(0.58, 0.52, 1.05, 14), paint, 0, 0.8, -0.1);            // THE BARREL
      add(new THREE.TorusGeometry(0.575, 0.05, 6, 16), dark, 0, 0.5, -0.1, Math.PI / 2);     // hoops
      add(new THREE.TorusGeometry(0.59, 0.05, 6, 16), dark, 0, 1.08, -0.1, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 8), dark, 0, 0.62, 0.52, Math.PI / 2); // the spigot
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 1.46, -0.1);                  // pilot down in the cask
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), dark, 0, 0.66, 0.68, Math.PI / 3); // steering column
      add(new THREE.TorusGeometry(0.2, 0.04, 6, 10), dark, 0, 0.82, 0.84, Math.PI / 2.4);
      lamp('head', 0, 0.4, 1.66, 0.2, 0.1);
      lamp('tail', 0, 0.5, -1.14, 0.2, 0.1);
      // FACE: eyes on the cask itself — the barrel is the guy, the spigot is his nose
      eye(-0.2, 1.0, 0.45, 0.09); eye(0.2, 1.0, 0.45, 0.09);
      pupil(-0.185, 0.98, 0.458, 0.04); pupil(0.215, 0.98, 0.458, 0.04);
      wheel(-0.7, 0.95, 1, 0.34, 0.3); wheel(0.7, 0.95, 1, 0.34, 0.3);
      wheel(-0.74, -0.85, 0, 0.4, 0.42); wheel(0.74, -0.85, 0, 0.4, 0.42);

    } else if (vehicle === 'longframe') {     // Twin-Engine Longframe: why
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 0.84, 0.2, 5.4],                  // THE frame — absurdly long
        ['c', 'paint', 0, 0.48, 0.15, 0.74, 0.28, 4.6],            // body strip
        ['w', 'paint', 0, 0.64, 2.25, 0.6, 0.18, 0.9],             // nose wedge
        ['c', 'dark', 0, 0.82, 1.45, 0.6, 0.44, 0.85],             // ENGINE ONE (front)
        ['q', 'dark', 0, 1.12, 1.45, 0.4, 0.24, 0.32, 2],          // scoop one
        ['w', 'glass', 0, 0.8, 0.4, 0.5, 0.26, 0.5],               // tiny screen
        ['q', 'paint', 0, 0.8, -0.5, 0.5, 0.3, 0.5],               // headrest curve
        ['c', 'dark', 0, 0.84, -1.3, 0.62, 0.48, 0.9],             // ENGINE TWO (behind the driver)
        ['q', 'dark', 0, 1.16, -1.3, 0.42, 0.26, 0.34, 2],         // scoop two
        ['c', 'dark', 0, 0.66, -2.5, 0.4, 0.3, 0.4],               // chute box
        ['c', 'dark', 0, 1.3, -2.2, 1.5, 0.07, 0.4],               // rear wing on tall struts
        ['c', 'dark', -0.6, 1.05, -2.2, 0.07, 0.45, 0.4],
        ['c', 'dark', 0.6, 1.05, -2.2, 0.07, 0.45, 0.4],
      ]);
      for (const sx of [-1, 1]) {                                   // zoomie stacks on BOTH engines
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6), dark, sx * 0.36, 1.08, 1.25, 0, 0, sx * 0.5);
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6), dark, sx * 0.38, 1.12, -1.5, 0, 0, sx * 0.5);
      }
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 0.94, 0.05); // driver squeezed between engines
      add(new THREE.BoxGeometry(0.06, 0.05, 0.9), dark, -0.2, 0.24, -3.0);  // wheelie bar
      add(new THREE.BoxGeometry(0.06, 0.05, 0.9), dark, 0.2, 0.24, -3.0);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), dark, 0, 0.14, -3.42, 0, 0, Math.PI / 2);
      lamp('head', -0.26, 0.52, 2.72, 0.18, 0.1); lamp('head', 0.26, 0.52, 2.72, 0.18, 0.1);
      // FACE: little eyes way out on the long nose — unhinged and far from home
      eye(-0.26, 0.63, 2.72, 0.075); eye(0.26, 0.63, 2.72, 0.075);
      lamp('tail', -0.26, 0.58, -2.72, 0.2, 0.1); lamp('tail', 0.26, 0.58, -2.72, 0.2, 0.1);
      wheel(-0.72, 2.3, 1, 0.34, 0.22); wheel(0.72, 2.3, 1, 0.34, 0.22);    // skinny fronts way out there
      wheel(-0.86, -2.05, 0, 0.6, 0.62); wheel(0.86, -2.05, 0, 0.6, 0.62);  // the meats

    } else if (vehicle === 'sofa') {          // The Sofa: comfort-first engineering
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.62, 0.24, 2.3],                 // go-frame under the couch
        ['c', 'paint', 0, 0.52, 0.3, 1.66, 0.34, 1.5],             // seat base
        ['c', 'paint', -0.42, 0.72, 0.05, 0.76, 0.2, 0.9],         // cushions (two, with the gap)
        ['c', 'paint', 0.42, 0.72, 0.05, 0.76, 0.2, 0.9],
        ['q', 'paint', -0.42, 0.72, 0.55, 0.76, 0.22, 0.5, 2],     // cushion front rolls
        ['q', 'paint', 0.42, 0.72, 0.55, 0.76, 0.22, 0.5, 2],
        ['c', 'paint', 0, 1.0, -0.65, 1.66, 0.75, 0.45],           // backrest
        ['q', 'paint', 0, 1.42, -0.62, 1.66, 0.26, 0.4],           // backrest top roll
        ['c', 'paint', -0.94, 0.85, 0, 0.3, 0.5, 1.5],             // armrests
        ['c', 'paint', 0.94, 0.85, 0, 0.3, 0.5, 1.5],
        ['q', 'paint', -0.94, 1.14, 0.6, 0.3, 0.18, 0.3, 2],       // armrest front rolls
        ['q', 'paint', 0.94, 1.14, 0.6, 0.3, 0.18, 0.3, 2],
        ['c', 'dark', 0, 0.62, -1.12, 1.0, 0.5, 0.5],              // engine strapped to the back
        ['c', 'dark', 0, 0.34, 0.95, 1.5, 0.14, 0.3],              // front step bumper
      ]);
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 6), dark, 0.35, 1.0, -1.3, Math.PI / 6);  // exhaust pipe
      add(new THREE.BoxGeometry(0.3, 0.05, 0.16), dark, -0.94, 1.13, 0.1);                         // TV remote on the armrest
      add(new THREE.CylinderGeometry(0.07, 0.05, 0.12, 8), toonMat(0xf4ecdd), 0.94, 1.17, 0.05);   // the mug
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), dark, 0, 0.75, 0.95, Math.PI / 3.2);     // steering column bolted on
      add(new THREE.TorusGeometry(0.19, 0.035, 6, 10), dark, 0, 0.92, 1.08, Math.PI / 2.5);
      add(new THREE.BoxGeometry(0.5, 0.55, 0.4), dark, 0, 1.0, -0.32);                             // couch-potato torso, leaned back
      add(new THREE.SphereGeometry(0.28, 10, 8), helmetMat, 0, 1.42, -0.28);
      lamp('head', -0.5, 0.42, 1.12, 0.16, 0.12); lamp('head', 0.5, 0.42, 1.12, 0.16, 0.12);       // taped-on flashlights
      // FACE: born with googly eyes and doesn't know it — mismatched pupils, maximum derp
      eye(-0.5, 0.55, 1.13, 0.1); eye(0.5, 0.55, 1.13, 0.1);
      pupil(-0.475, 0.53, 1.138, 0.045); pupil(0.485, 0.525, 1.138, 0.04);
      lamp('tail', -0.6, 0.48, -1.38, 0.18, 0.1); lamp('tail', 0.6, 0.48, -1.38, 0.18, 0.1);
      wheel(-0.85, 0.85, 1, 0.32, 0.26); wheel(0.85, 0.85, 1, 0.32, 0.26);
      wheel(-0.85, -0.85, 0, 0.36, 0.3); wheel(0.85, -0.85, 0, 0.36, 0.3);

    } else {                                  // 'f1' — Enginos Volante F: the classic — cigar, airbox, fat slicks
      weld(g, M, [
        ['c', 'paint', 0, 0.46, 0.3, 0.72, 0.44, 2.9],             // cigar core
        ['q', 'paint', 0, 0.5, 1.7, 0.7, 0.36, 0.6, 2],            // rounded nose drop
        ['w', 'paint', 0, 0.74, 0.9, 0.66, 0.22, 1.3],             // scuttle slope to the cockpit
        ['c', 'dark', 0, 0.3, 2.35, 1.55, 0.07, 0.5],              // low front wing
        ['c', 'dark', 0, 0.7, 0.35, 0.6, 0.26, 0.7],               // cockpit surround
        ['q', 'paint', 0, 0.86, -0.25, 0.5, 0.34, 0.5],            // headrest fairing curve
        ['c', 'dark', 0, 1.1, -0.45, 0.34, 0.44, 0.44],            // TALL airbox
        ['w', 'dark', 0, 1.36, -0.45, 0.3, 0.14, 0.4, 2],          // airbox lip
        ['c', 'dark', 0, 0.56, -1.25, 0.78, 0.44, 1.1],            // exposed engine block
        ['c', 'paint', 0, 0.4, -1.2, 1.3, 0.16, 0.9],              // side fairings over the exhausts
        ['c', 'dark', 0, 1.2, -1.95, 1.62, 0.08, 0.5],             // rear wing up on struts
        ['c', 'dark', 0, 0.86, -1.95, 0.08, 0.6, 0.4],             // center strut
        ['c', 'dark', -0.78, 0.96, -1.95, 0.07, 0.42, 0.5],        // endplates
        ['c', 'dark', 0.78, 0.96, -1.95, 0.07, 0.42, 0.5],
      ]);
      for (const sx of [-1, 1]) {                                   // the open-wheel skeleton
        add(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 6), dark, sx * 0.42, 0.42, -1.75, Math.PI / 2);  // exhaust megaphones
        add(new THREE.BoxGeometry(0.05, 0.05, 1.0), dark, sx * 0.55, 0.48, 1.45, 0, sx * 0.55);          // front suspension arms
        add(new THREE.BoxGeometry(0.06, 0.05, 0.9), dark, sx * 0.6, 0.5, -1.3, 0, sx * -0.5);            // rear arms
      }
      add(new THREE.SphereGeometry(0.29, 10, 8), helmetMat, 0, 0.88, 0.3);
      add(new THREE.BoxGeometry(0.4, 0.06, 0.2), dark, 0, 0.72, 0.62);     // dash + tiny wheel
      lamp('tail', 0, 0.82, -2.2, 0.18, 0.18);
      // FACE: the vintage gentleman — two small warm eyes on the nose drop, wing for a mustache
      eye(-0.22, 0.58, 2.02, 0.075, EYE_WARM); eye(0.22, 0.58, 2.02, 0.075, EYE_WARM);
      wheel(-0.95, 1.5, 1, 0.4, 0.28); wheel(0.95, 1.5, 1, 0.4, 0.28);     // skinny fronts
      wheel(-1.02, -1.35, 0, 0.52, 0.56); wheel(1.02, -1.35, 0, 0.52, 0.56); // FAT rear slicks
    }
    applyDecals(vehicle);
    return wheels;
  };
})();
