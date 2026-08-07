/* VALCORSA — BLOCKKIT: the chassis, rebuilt Trailmakers-style (Adam's technique).
   Bodies are assembled from a small block vocabulary — cube, wedge, quarter-curve —
   and WELDED (merged) into one mesh per material. No lofted CAD surfaces: every
   chassis reads as a machine built from blocks, which is also exactly the language
   the Engineer Garage will speak later. Engineers don't make chassis — we do, here.
   Zero carfactory.js edits: this file swaps the CHASSIS_BUILDERS entries in place.
   Wheels arrays, lamp hookups (mats._head/_tail) and dims match the originals. */
'use strict';
(function () {
  const MU = window.FX.BufferGeometryUtils;

  // ---- the vocabulary ----
  let _cube = null, _wedge = null, _curve = null;
  function cubeGeo() { return _cube || (_cube = new THREE.BoxGeometry(1, 1, 1)); }
  function wedgeGeo() {                       // right prism: full height at -Z, zero at +Z
    if (_wedge) return _wedge;
    const p = [], n = [], idx = [];
    const v = [
      [-0.5, -0.5,  0.5], [0.5, -0.5,  0.5],                      // nose base
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5],                      // tail base
      [-0.5,  0.5, -0.5], [0.5,  0.5, -0.5],                      // tail top
    ];
    function quad(a, b, c, d, nx, ny, nz) {
      const s = p.length / 3;
      for (const i of [a, b, c, d]) { p.push(...v[i]); n.push(nx, ny, nz); }
      idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
    }
    function tri(a, b, c, nx, ny, nz) {
      const s = p.length / 3;
      for (const i of [a, b, c]) { p.push(...v[i]); n.push(nx, ny, nz); }
      idx.push(s, s + 1, s + 2);
    }
    const sl = Math.hypot(1, 1);
    quad(0, 2, 3, 1, 0, -1, 0);                                    // bottom
    quad(4, 2, 3, 5, 0, 0, -1); idx.splice(-6, 6, ...(() => { const s = p.length / 3 - 4; return [s, s + 2, s + 1, s, s + 3, s + 2]; })());
    quad(0, 1, 5, 4, 0, 1 / sl, 1 / sl);                           // the slope
    tri(0, 4, 2, -1, 0, 0);                                        // left cap
    tri(1, 3, 5, 1, 0, 0);                                         // right cap
    _wedge = new THREE.BufferGeometry();
    _wedge.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    _wedge.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    _wedge.setIndex(idx);
    return _wedge;
  }
  function curveGeo() {                       // quarter-round: flat bottom + back, faceted arc to the top
    if (_curve) return _curve;
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5);
    s.lineTo(0.5, -0.5);
    s.absarc(-0.5, -0.5, 1, 0, Math.PI / 2, false);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 5 });
    g.translate(0, 0, -0.5);
    g.rotateY(Math.PI / 2);                   // extrusion runs along X (block width)
    _curve = g;
    return _curve;
  }
  const GEO = { c: cubeGeo, w: wedgeGeo, q: curveGeo };

  /* weld(): blocks -> one mesh per material. block = [type, mat, x, y, z, sx, sy, sz, ry, rz]
     type: c cube / w wedge / q curve · ry/rz in quarter-turns (0-3). */
  function weld(g, mats, blocks) {
    const buckets = {};
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const b of blocks) {
      const [t, mat, x, y, z, sx, sy, sz, ry, rz] = b;
      const geo = GEO[t]().clone();
      e.set((rz ? 0 : 0), (ry || 0) * Math.PI / 2, (rz || 0) * Math.PI / 2, 'YXZ');
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      geo.applyMatrix4(m4);
      (buckets[mat] = buckets[mat] || []).push(geo);
    }
    for (const key of Object.keys(buckets)) {
      const merged = MU.mergeGeometries(buckets[key], false);
      const mesh = new THREE.Mesh(merged, mats[key]);
      mesh.castShadow = true;
      g.add(mesh);
    }
  }
  function driver(g, mats, y, z, s) {
    s = s || 1;
    const torso = new THREE.Mesh(cubeGeo(), mats.suit);
    torso.position.set(0, y, z); torso.scale.set(0.5 * s, 0.55 * s, 0.4 * s);
    g.add(torso);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27 * s, 14, 10), mats.helmet);
    helm.position.set(0, y + 0.42 * s, z);
    g.add(helm);
  }

  // ---- the seven, re-authored in blocks (wheels arrays: verbatim from the originals) ----
  const B = {};

  B.gt = () => ({                             // Enginos GT: low coupe, curve nose, fastback wedge
    wheels: [[-0.76, 1.5, 1, 0.36, 0.28], [0.76, 1.5, 1, 0.36, 0.28], [-0.76, -1.5, 0, 0.37, 0.3], [0.76, -1.5, 0, 0.37, 0.3]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 0.46, 0.1, 1.52, 0.36, 3.5],             // floor slab
        ['c', 'paint', 0, 0.78, 1.05, 1.52, 0.3, 1.15],            // hood
        ['q', 'paint', 0, 0.78, 1.75, 1.52, 0.3, 0.34, 0, 0],      // nose curve
        ['w', 'glass', 0, 1.09, 0.42, 1.36, 0.34, 0.62],           // windshield wedge
        ['c', 'paint', 0, 1.09, -0.25, 1.4, 0.34, 0.72],           // cabin
        ['q', 'paint', 0, 1.09, -0.83, 1.4, 0.34, 0.5, 2, 0],      // roof curve down to deck
        ['c', 'paint', 0, 0.78, -1.35, 1.52, 0.3, 0.9],            // tail deck
        ['c', 'dark', 0, 0.62, -1.82, 1.3, 0.12, 0.14],            // diffuser lip
        ['c', 'dark', 0, 0.98, -1.78, 1.44, 0.07, 0.3],            // ducktail
      ]);
      mirrors(g, mats, 0.78, 1.02, 0.72);
      exhausts(g, mats, [-0.3, 0.3], 0.42, -1.82);
      lampBar(g, mats, 'head', 1.9, 0.72, 1.1, 0.1);
      lampBar(g, mats, 'tail', -1.83, 0.86, 1.2, 0.09);
    },
  });

  B.muscle = () => ({                         // Houndsborough Iron: long hood, upright cab, wedge deck
    wheels: [[-0.78, 1.62, 1, 0.37, 0.28], [0.78, 1.62, 1, 0.37, 0.28], [-0.78, -1.62, 0, 0.38, 0.32], [0.78, -1.62, 0, 0.38, 0.32]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 0.5, 0, 1.58, 0.42, 3.8],                // slab body
        ['c', 'paint', 0, 0.86, 1.15, 1.58, 0.3, 1.35],            // the long hood
        ['c', 'dark', 0, 1.03, 1.15, 0.44, 0.08, 0.9],             // hood scoop
        ['w', 'glass', 0, 1.18, 0.28, 1.4, 0.38, 0.55],            // windshield
        ['c', 'paint', 0, 1.18, -0.35, 1.46, 0.38, 0.75],          // cab
        ['w', 'paint', 0, 1.18, -0.98, 1.46, 0.38, 0.5, 2],        // rear deck wedge (flipped)
        ['c', 'paint', 0, 0.86, -1.45, 1.58, 0.3, 0.9],            // trunk
        ['c', 'dark', 0, 0.62, 1.95, 1.5, 0.16, 0.14],             // front bumper bar
        ['c', 'dark', 0, 0.62, -1.95, 1.5, 0.16, 0.14],            // rear bumper bar
      ]);
      mirrors(g, mats, 0.8, 1.12, 0.6);
      exhausts(g, mats, [-0.45, 0.45], 0.4, -1.95);
      lampsQuad(g, mats, 'head', 0.5, 1.98, 0.22, 0.14, 0.82);
      lampBar(g, mats, 'tail', -1.96, 0.92, 1.3, 0.1);
    },
  });

  B.rally = () => ({                          // Heiligen Strada: chunky hatch, roof curve, mud lights
    wheels: [[-0.76, 1.3, 1, 0.36, 0.28], [0.76, 1.3, 1, 0.36, 0.28], [-0.76, -1.28, 0, 0.36, 0.3], [0.76, -1.28, 0, 0.36, 0.3]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 0.5, 0, 1.54, 0.44, 3.1],                // tall slab body
        ['w', 'paint', 0, 0.88, 1.28, 1.54, 0.32, 0.55],           // short hood wedge
        ['w', 'glass', 0, 1.22, 0.55, 1.4, 0.4, 0.6],              // windshield
        ['c', 'paint', 0, 1.22, -0.25, 1.46, 0.4, 1.0],            // boxy cabin
        ['q', 'paint', 0, 1.22, -0.98, 1.46, 0.4, 0.45, 2, 0],     // hatch roof curve
        ['c', 'dark', 0, 1.47, -0.9, 1.2, 0.07, 0.4],              // roof spoiler
        ['c', 'dark', 0, 0.34, 1.6, 1.5, 0.18, 0.2],               // bash guard
        ['c', 'dark', 0, 0.3, 0, 1.62, 0.12, 2.6],                 // rocker armor
      ]);
      // rally pod lights on the hood lip
      lampsQuad(g, mats, 'head', 0.3, 1.55, 0.2, 0.16, 1.06);
      lampBar(g, mats, 'tail', -1.58, 0.95, 1.25, 0.1);
      mirrors(g, mats, 0.78, 1.16, 0.85);
    },
  });

  B.formula = () => ({                        // Enginos Volante F: needle tub, pods, wings
    wheels: [[-1.02, 1.55, 1, 0.45, 0.44], [1.02, 1.55, 1, 0.45, 0.44], [-1.06, -1.55, 0, 0.47, 0.5], [1.06, -1.55, 0, 0.47, 0.5]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 0.52, 0.3, 0.66, 0.4, 2.4],              // the tub
        ['w', 'paint', 0, 0.52, 1.85, 0.6, 0.4, 0.9],              // nose wedge
        ['c', 'paint', 0, 0.34, 2.35, 2.1, 0.09, 0.5],             // front wing
        ['w', 'paint', 0, 0.72, -0.62, 0.62, 0.34, 0.5, 2],        // headrest wedge (flipped)
        ['c', 'paint', -0.72, 0.5, -0.45, 0.55, 0.36, 1.5],        // left sidepod
        ['c', 'paint', 0.72, 0.5, -0.45, 0.55, 0.36, 1.5],         // right sidepod
        ['q', 'paint', -0.72, 0.5, 0.35, 0.55, 0.36, 0.4, 0, 0],   // pod inlet curves
        ['q', 'paint', 0.72, 0.5, 0.35, 0.55, 0.36, 0.4, 0, 0],
        ['c', 'dark', -0.5, 1.0, -1.62, 0.1, 0.5, 0.12],           // wing pylons
        ['c', 'dark', 0.5, 1.0, -1.62, 0.1, 0.5, 0.12],
        ['c', 'paint', 0, 1.3, -1.62, 1.9, 0.1, 0.55],             // rear wing
        ['c', 'dark', 0, 0.3, -1.1, 1.2, 0.14, 0.9],               // diffuser block
      ]);
      driver(g, mats, 0.85, -0.15, 0.95);
      lampBar(g, mats, 'tail', -1.9, 0.6, 0.5, 0.09);
    },
  });

  B.truck = () => ({                          // Norte Titan: big rig energy on monster wheels
    wheels: [[-1.22, 1.5, 1, 0.82, 0.72], [1.22, 1.5, 1, 0.82, 0.72], [-1.22, -1.5, 0, 0.82, 0.72], [1.22, -1.5, 0, 0.82, 0.72]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 1.12, 0, 1.9, 0.5, 3.6],                 // high slab frame
        ['c', 'paint', 0, 1.62, 0.9, 1.9, 0.55, 1.5],              // hood block
        ['q', 'paint', 0, 1.62, 1.7, 1.9, 0.55, 0.35, 0, 0],       // nose curve
        ['w', 'glass', 0, 2.08, 0.15, 1.7, 0.5, 0.65],             // windshield wedge
        ['c', 'paint', 0, 2.08, -0.6, 1.8, 0.5, 0.95],             // cab
        ['c', 'paint', 0, 1.45, -1.35, 1.9, 0.6, 0.95],            // bed
        ['c', 'dark', 0, 1.7, -1.35, 1.5, 0.2, 0.6],               // bed cargo hump
        ['c', 'dark', 0, 0.86, 1.95, 1.96, 0.3, 0.22],             // bull bar
        ['c', 'chrome', 0, 2.42, -0.28, 1.5, 0.06, 0.08],          // roof light bar
      ]);
      lampsQuad(g, mats, 'head', 0.62, 2.0, 0.26, 0.18, 1.5);
      lampBar(g, mats, 'tail', -1.86, 1.5, 1.6, 0.12);
      exhausts(g, mats, [-0.95, 0.95], 2.2, -1.05);
      mirrors(g, mats, 1.0, 2.2, 0.55);
    },
  });

  B.kart = () => ({                           // Granada Sprint: bare-bones block kart, driver in the wind
    wheels: [[-0.72, 0.95, 1, 0.33, 0.32], [0.72, 0.95, 1, 0.33, 0.32], [-0.78, -0.95, 0, 0.39, 0.44], [0.78, -0.95, 0, 0.39, 0.44]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 0.34, 0.15, 0.95, 0.18, 2.2],            // floor plank
        ['w', 'paint', 0, 0.52, 1.15, 0.9, 0.24, 0.5],             // nose wedge
        ['c', 'paint', 0, 0.34, 0.15, 1.7, 0.14, 0.6],             // side bumper spar
        ['c', 'dark', 0, 0.62, -0.55, 0.62, 0.5, 0.5],             // seat box
        ['w', 'dark', 0, 1.0, -0.72, 0.6, 0.3, 0.3, 2],            // seat back wedge
        ['c', 'dark', 0.5, 0.5, -0.95, 0.42, 0.34, 0.5],           // engine block
        ['q', 'dark', -0.4, 0.5, -0.95, 0.4, 0.3, 0.3, 0, 0],      // airbox curve
      ]);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.7, 6), mats.dark);
      col.position.set(0, 0.62, 0.62); col.rotation.x = Math.PI / 3; g.add(col);
      const sw = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 14), mats.dark);
      sw.position.set(0, 0.8, 0.82); sw.rotation.x = Math.PI / 2.4; g.add(sw);
      driver(g, mats, 0.72, -0.25, 1);
      lampBar(g, mats, 'tail', -1.28, 0.34, 0.5, 0.08);
    },
  });

  B.bike = () => ({                           // Perro Moto: one block wide, curve tank, wedge tail
    wheels: [[0, 1.25, 1, 0.5, 0.26], [0, -1.25, 0, 0.5, 0.32]],
    build(g, mats) {
      weld(g, mats, [
        ['c', 'paint', 0, 0.6, 0, 0.34, 0.34, 1.7],                // spine
        ['q', 'paint', 0, 0.86, 0.15, 0.36, 0.3, 0.55, 0, 0],      // tank curve
        ['w', 'paint', 0, 0.86, -0.62, 0.36, 0.26, 0.55],          // tail wedge... nose-forward
        ['w', 'paint', 0, 0.72, 0.72, 0.44, 0.3, 0.4],             // front fairing wedge
        ['w', 'glass', 0, 0.98, 0.68, 0.32, 0.24, 0.3],            // screen
        ['c', 'dark', 0, 0.92, -0.5, 0.36, 0.1, 0.7],              // seat slab
      ]);
      for (const sx of [-0.09, 0.09]) {
        const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.85, 8), mats.chrome);
        fork.position.set(sx, 0.8, 0.95); fork.rotation.x = Math.PI / 2.6; g.add(fork);
      }
      const bars = new THREE.Mesh(cubeGeo(), mats.dark);
      bars.position.set(0, 1.04, 0.9); bars.scale.set(0.7, 0.05, 0.07); g.add(bars);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.75, 8), mats.chrome);
      pipe.position.set(0.16, 0.42, -0.6); pipe.rotation.x = Math.PI / 2.15; g.add(pipe);
      const torso = new THREE.Mesh(cubeGeo(), mats.suit);
      torso.position.set(0, 1.07, -0.12); torso.scale.set(0.42, 0.66, 0.42); torso.rotation.x = -0.5; g.add(torso);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), mats.helmet);
      helm.position.set(0, 1.36, 0.34); g.add(helm);
      lampsQuad(g, mats, 'head', 0, 0.78, 0.2, 0.14, 1.06);
      lampBar(g, mats, 'tail', -1.04, 0.98, 0.18, 0.08);
    },
  });

  // ---- swap the builders in place (shared script scope; carfactory keeps everything else) ----
  for (const key of Object.keys(B)) CHASSIS_BUILDERS[key] = B[key];
})();
