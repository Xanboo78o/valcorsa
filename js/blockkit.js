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
    const paint = toonMat(PAINTS[kit.paint % PAINTS.length]);
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
    const wheel = (x, z, front, r = 0.45, width = 0.44) => {
      const wg = new THREE.Group();
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), dark);
      w.rotation.z = Math.PI / 2; w.castShadow = true;
      wg.add(w);
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, width + 0.02, 10), hub);
      hb.rotation.z = Math.PI / 2;
      w.add(hb);
      wg.position.set(x, r, z);
      wg.userData.front = !!front;
      g.add(wg); wheels.push(wg);
      return wg;
    };
    const rider = (z, lean) => {
      add(new THREE.BoxGeometry(0.5, 0.6, 0.42), dark, 0, 0.62, z, lean || 0);
      add(new THREE.SphereGeometry(0.28, 10, 8), helmetMat, 0, 1.0, z + (lean ? 0.18 : 0));
    };

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
      lamp('tail', -0.6, 0.9, -2.02); lamp('tail', 0.6, 0.9, -2.02);
      wheel(-1.0, 1.45, 1, 0.52, 0.5); wheel(1.0, 1.45, 1, 0.52, 0.5);
      wheel(-1.0, -1.45, 0, 0.52, 0.5); wheel(1.0, -1.45, 0, 0.52, 0.5);

    } else if (vehicle === 'bike') {          // Perro Moto: tank curve, tail wedge
      weld(g, M, [
        ['c', 'paint', 0, 0.7, -0.1, 0.34, 0.4, 1.55],             // spine
        ['q', 'paint', 0, 0.94, 0.18, 0.38, 0.3, 0.6, 2],             // tank curve (faces forward)
        ['w', 'paint', 0, 0.98, -0.75, 0.36, 0.28, 0.6],           // tail wedge
        ['w', 'paint', 0, 0.72, 0.85, 0.48, 0.34, 0.5],            // front fairing slope
        ['w', 'glass', 0, 1.0, 0.72, 0.32, 0.26, 0.32],            // screen
        ['c', 'dark', 0, 0.94, -0.45, 0.4, 0.12, 0.8],             // seat
      ]);
      add(new THREE.BoxGeometry(0.7, 0.05, 0.08), dark, 0, 1.0, 0.95);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), dark, 0, 0.82, 0.9, Math.PI / 2.6);
      add(new THREE.BoxGeometry(0.42, 0.7, 0.42), dark, 0, 1.05, -0.1, -0.5);
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 1.35, 0.35);
      add(new THREE.BoxGeometry(0.16, 0.5, 0.16), dark, -0.3, 1.0, 0.5, 0, 0, 0.5);
      add(new THREE.BoxGeometry(0.16, 0.5, 0.16), dark, 0.3, 1.0, 0.5, 0, 0, -0.5);
      lamp('head', 0, 0.7, 1.12, 0.18, 0.14); lamp('tail', 0, 0.9, -1.05, 0.16, 0.1);
      wheel(0, 1.25, 1, 0.5, 0.24);
      wheel(0, -1.25, 0, 0.5, 0.28);

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
      rider(-0.1);
      wheel(-0.72, 0.95, 1, 0.34, 0.3); wheel(0.72, 0.95, 1, 0.34, 0.3);
      wheel(-0.78, -0.95, 0, 0.4, 0.42); wheel(0.78, -0.95, 0, 0.4, 0.42);

    } else {                                  // 'f1' — Enginos Volante: needle + pods + wings
      weld(g, M, [
        ['c', 'paint', 0, 0.42, -0.1, 1.5, 0.42, 3.4],             // wide floor
        ['w', 'paint', 0, 0.68, 0.8, 0.66, 0.26, 1.6],             // LONG subtle nose slope
        ['c', 'paint', 0, 0.44, 2.1, 0.6, 0.26, 1.4],              // nose tip beam
        ['c', 'dark', 0, 0.3, 2.8, 2.1, 0.09, 0.62],               // front wing
        ['w', 'dark', 0, 0.42, 2.45, 2.06, 0.1, 0.3],              // wing flap slope
        ['c', 'paint', 0, 0.76, -1.0, 0.9, 0.5, 1.5],              // engine cover
        ['q', 'paint', 0, 0.9, -0.35, 0.72, 0.5, 0.62],         // headrest curve behind driver
        ['q', 'paint', -0.62, 0.6, 0.1, 0.5, 0.36, 0.5, 2],           // sidepod inlet curves
        ['q', 'paint', 0.62, 0.6, 0.1, 0.5, 0.36, 0.5, 2],
        ['c', 'paint', -0.98, 0.45, -0.5, 0.5, 0.4, 1.7],          // sidepods
        ['c', 'paint', 0.98, 0.45, -0.5, 0.5, 0.4, 1.7],
        ['c', 'dark', 0, 1.06, -2.1, 1.8, 0.09, 0.55],             // rear wing
        ['c', 'dark', -0.82, 0.82, -2.1, 0.08, 0.5, 0.55],         // endplates
        ['c', 'dark', 0.82, 0.82, -2.1, 0.08, 0.5, 0.55],
        ['c', 'dark', 0, 0.72, 0.55, 0.7, 0.28, 0.7],              // cockpit surround
      ]);
      add(new THREE.SphereGeometry(0.3, 10, 8), helmetMat, 0, 0.86, 0.35);
      lamp('tail', 0, 0.85, -2.35, 0.2, 0.2);
      wheel(-1.02, 1.55, 1); wheel(1.02, 1.55, 1);
      wheel(-1.06, -1.55, 0); wheel(1.06, -1.55, 0);
    }
    return wheels;
  };
})();
