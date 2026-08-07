/* Car factory: real curved bodywork + Mario-Kart-style modular customization.
   Bodies are LOFTED — superellipse cross-sections swept nose-to-tail with per-station
   width/height/roundness taken from real car proportion sheets, smooth normals, fender
   bulges over the wheels. Paint is a decal-baked clearcoat texture (stripes, numbers,
   flames...). Wheels are swappable styles. Everything combines: chassis × paint × wheels × decal.
   Public API: KIT (player's saved kit), randomKit(), buildKitMesh(kit, helmetColor). */
'use strict';

const CHASSIS = ['gt', 'muscle', 'rally', 'formula', 'truck', 'kart', 'bike'];
// Valcorsan showroom — every chassis is a factory car from an in-world marque.
const CHASSIS_LABELS = { gt: '🏎️ Enginos GT', muscle: '🚗 Houndsborough Iron', rally: '🚙 Heiligen Strada', formula: '🏁 Enginos Volante F', truck: '🛻 Norte Titan', kart: '🛞 Granada Sprint Kart', bike: '🏍️ Perro Moto' };
const WHEEL_STYLES = ['sport', 'classic', 'deep', 'offroad', 'neon'];
const WHEEL_LABELS = { sport: 'Sport 5-spoke', classic: 'Classic steel', deep: 'Gold deep-dish', offroad: 'Off-road knobby', neon: 'Neon glow' };
const DECALS = ['none', 'stripes', 'number', 'flames', 'checker'];
const DECAL_LABELS = { none: 'Clean', stripes: 'Racing stripes', number: 'Number roundel', flames: 'Flames', checker: 'Checker flank' };
const PAINTS = [0xc8102e, 0x1f6feb, 0xf2a900, 0x18944b, 0xf4f4f6, 0x101216, 0x8931d6, 0x0fb8c4, 0xff6a13, 0xd6336c, 0x6a7788, 0x2b3a67];

// The player's saved kit (garage selections live in localStorage)
const KIT = (() => {
  try { const k = JSON.parse(localStorage.getItem('apex_kit')); if (k && k.chassis) return k; } catch (e) {}
  const legacy = localStorage.getItem('apex_vehicle');                  // migrate the old picker
  const map = { f1: 'formula', rally: 'rally', kart: 'kart', bike: 'bike', monster: 'truck' };
  return { chassis: map[legacy] || 'gt', paint: 0, wheels: 'sport', decal: 'stripes' };
})();
function saveKit() { localStorage.setItem('apex_kit', JSON.stringify(KIT)); }
function randomKit() {
  return { chassis: CHASSIS[Math.floor(Math.random() * 5)],            // AI stick to 4-wheelers mostly
           paint: Math.floor(Math.random() * PAINTS.length),
           wheels: WHEEL_STYLES[Math.floor(Math.random() * WHEEL_STYLES.length)],
           decal: DECALS[Math.floor(Math.random() * DECALS.length)] };
}

// ---------------- decal-baked paint ----------------
// One 512² canvas per car: paint base + chosen decal + subtle wear. UV: u wraps the section
// (0 = under left sill, 0.5 = spine, 1 = under right sill), v runs nose(0) -> tail(1).
function paintTexture(hex, decal, num) {
  const S = 512, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const col = '#' + hex.toString(16).padStart(6, '0');
  x.fillStyle = col; x.fillRect(0, 0, S, S);
  // subtle vertical shading: darker near the sills (u 0 and 1)
  const g = x.createLinearGradient(0, 0, S, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.34)'); g.addColorStop(0.18, 'rgba(0,0,0,0)');
  g.addColorStop(0.82, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.34)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const ink = (hex === 0xf4f4f6 || hex === 0xf2a900) ? '#14161a' : '#f2f3f5';
  if (decal === 'stripes') {                       // twin spine stripes, nose to tail
    x.fillStyle = ink;
    x.fillRect(S * 0.455, 0, S * 0.033, S); x.fillRect(S * 0.512, 0, S * 0.033, S);
  } else if (decal === 'number') {                 // roundel on both doors
    for (const u of [0.25, 0.75]) {
      x.fillStyle = '#f2f3f5'; x.beginPath(); x.arc(S * u, S * 0.52, S * 0.1, 0, 7); x.fill();
      x.strokeStyle = '#14161a'; x.lineWidth = 5; x.stroke();
      x.fillStyle = '#14161a'; x.font = '900 ' + S * 0.11 + 'px system-ui';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(num), S * u, S * 0.525);
    }
  } else if (decal === 'flames') {                 // flames licking back from the nose
    x.fillStyle = '#ff7a1a';
    for (const u of [0.2, 0.5, 0.8]) {
      x.beginPath(); x.moveTo(S * (u - 0.11), 0);
      for (let i = 0; i <= 8; i++) x.lineTo(S * (u - 0.11 + 0.0275 * i), S * (0.06 + (i % 2 ? 0.13 : 0.04) + i * 0.012));
      x.lineTo(S * (u + 0.11), 0); x.fill();
    }
    x.fillStyle = '#ffd23e';
    for (const u of [0.2, 0.5, 0.8]) {
      x.beginPath(); x.moveTo(S * (u - 0.06), 0);
      for (let i = 0; i <= 6; i++) x.lineTo(S * (u - 0.06 + 0.02 * i), S * (0.03 + (i % 2 ? 0.08 : 0.02)));
      x.lineTo(S * (u + 0.06), 0); x.fill();
    }
  } else if (decal === 'checker') {                // checker band along both flanks
    const cs = S * 0.032;
    for (const u0 of [0.13, 0.81]) {
      for (let r = 0; r < 2; r++) for (let i = 0; i < 32; i++)
        if ((i + r) % 2 === 0) { x.fillStyle = '#14161a'; x.fillRect(S * u0 + r * cs, i * cs, cs, cs); }
        else { x.fillStyle = '#f2f3f5'; x.fillRect(S * u0 + r * cs, i * cs, cs, cs); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function kitPaintMat(kit, num) {
  return new THREE.MeshPhysicalMaterial({ map: paintTexture(PAINTS[kit.paint % PAINTS.length], kit.decal, num || 7),
    roughness: 0.3, metalness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.1, envMapIntensity: 1.0,
    side: THREE.DoubleSide });                     // loft shells are open surfaces — never see-through
}

// ---------------- the loft engine ----------------
// stations: [{ z, w, h, y, e (squareness .5 soft..1.2 boxy), crown (extra top curvature) }]
// Returns an indexed BufferGeometry with smooth normals + body UVs for the decal map.
function loftBody(stations, ringN = 24) {
  const pos = [], uv = [], idx = [];
  const S = stations.length;
  for (let s = 0; s < S; s++) {
    const st = stations[s];
    for (let r = 0; r <= ringN; r++) {
      const t = r / ringN;                          // 0..1 around: left sill -> roof -> right sill
      const a = Math.PI * (1 - t);                  // π..0 (upper half section)
      const ca = Math.cos(a), sa = Math.sin(a);
      const e = st.e || 0.72;
      const px = Math.sign(ca) * Math.pow(Math.abs(ca), e) * st.w / 2;
      let py = st.y + Math.pow(Math.max(sa, 0), e) * st.h;
      py += (st.crown || 0) * Math.sin(t * Math.PI);            // extra roof camber
      pos.push(px, py, st.z);
      uv.push(t, s / (S - 1));
    }
  }
  // close the underside with a flat floor strip (two extra columns at y = station.y)
  const cols = ringN + 1;
  for (let s = 0; s < S - 1; s++)
    for (let r = 0; r < ringN; r++) {
      const a = s * cols + r, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// widen stations near wheel z-centres => fender bulges
function bulge(stations, wheelZs, amount, span) {
  return stations.map(st => {
    let w = st.w;
    for (const wz of wheelZs) {
      const d = Math.abs(st.z - wz) / span;
      if (d < 1) w += amount * (1 - d * d);
    }
    return Object.assign({}, st, { w });
  });
}

// ---------------- modular wheels ----------------
function buildWheel(style, r, width, mats) {
  const wg = new THREE.Group(), roll = new THREE.Group();
  const tireR = style === 'offroad' ? r * 1.08 : r;
  const fat = style === 'offroad' ? 1.35 : 1;
  // tire = a straight cylinder (clean tread silhouette) with softened shoulders
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, width * fat, 26, 1), mats.rubber);
  tire.rotation.z = Math.PI / 2; tire.castShadow = true;
  roll.add(tire);
  for (const s of [-1, 1]) {                        // rounded sidewall shoulders
    const sh = new THREE.Mesh(new THREE.TorusGeometry(tireR * 0.88, tireR * 0.12, 8, 22), mats.rubber);
    sh.rotation.y = Math.PI / 2; sh.position.x = s * width * fat * 0.5;
    roll.add(sh);
  }
  if (style === 'offroad') {                        // chunky lugs around the tread
    for (let i = 0; i < 12; i++) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(width * 1.15, tireR * 0.24, tireR * 0.2), mats.rubber);
      const a = (i / 12) * Math.PI * 2;
      lug.position.set(0, Math.cos(a) * tireR * 0.88, Math.sin(a) * tireR * 0.88);
      lug.rotation.x = -a;
      roll.add(lug);
    }
  }
  const rimMat = style === 'deep' ? mats.gold : style === 'classic' ? mats.steel : style === 'neon' ? mats.dark : mats.gunmetal;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.58, tireR * 0.58, width * fat * 1.04, 22), rimMat);
  rim.rotation.z = Math.PI / 2;
  roll.add(rim);
  if (style === 'neon') {                           // glowing ring — lights up at night
    const glow = new THREE.Mesh(new THREE.TorusGeometry(tireR * 0.5, tireR * 0.035, 6, 20), mats.neon);
    glow.rotation.y = Math.PI / 2; roll.add(glow);
  }
  if (style === 'deep') {                           // dished face
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.42, tireR * 0.48, width * 0.3, 18), rimMat);
    dish.rotation.z = Math.PI / 2; roll.add(dish);
  }
  const spokeN = style === 'classic' ? 0 : style === 'deep' ? 6 : 5;
  for (let s = 0; s < spokeN; s++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(width * fat * 1.1, tireR * 1.02, tireR * 0.14), mats.dark);
    sp.rotation.x = (s / spokeN) * Math.PI * 2;
    roll.add(sp);
  }
  if (style === 'classic') {                        // steel face + chrome hubcap
    const face = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.46, tireR * 0.46, width * 0.5, 18), mats.steel);
    face.rotation.z = Math.PI / 2; roll.add(face);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(tireR * 0.2, 12, 8), mats.chrome);
    cap.scale.x = 0.5; roll.add(cap);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.13, tireR * 0.13, width * 0.95, 10), mats.dark);
  hub.rotation.z = Math.PI / 2; roll.add(hub);
  wg.add(roll);
  wg.position.y = tireR;
  return { wg, tireR };
}

// ---------------- chassis definitions (proportions from reference sheets) ----------------
// Each returns { wheels: [[x,z,front,r,width]...], build(g, mats) }.
function chassisGT() {
  // low wide GT coupe: long hood, cab-rearward, fastback tail (911/GT vibes)
  const st = [
    { z: 2.3, w: 1.2, h: 0.26, y: 0.22, e: 0.9 },
    { z: 2.1, w: 1.56, h: 0.36, y: 0.19, e: 0.82 },
    { z: 1.5, w: 1.76, h: 0.46, y: 0.17, e: 0.75 },    // front arches
    { z: 0.95, w: 1.8, h: 0.5, y: 0.16, e: 0.72 },     // hood/scuttle
    { z: 0.4, w: 1.82, h: 0.92, y: 0.16, e: 0.7, crown: 0.05 },   // windshield base->roof
    { z: -0.25, w: 1.8, h: 1.0, y: 0.16, e: 0.7, crown: 0.06 },   // roof
    { z: -0.95, w: 1.82, h: 0.8, y: 0.16, e: 0.72, crown: 0.04 }, // fastback
    { z: -1.55, w: 1.86, h: 0.54, y: 0.18, e: 0.78 },  // rear haunches
    { z: -2.1, w: 1.68, h: 0.42, y: 0.22, e: 0.85 },
    { z: -2.3, w: 1.36, h: 0.28, y: 0.26, e: 0.95 },
  ];
  return {
    wheels: [[-0.76, 1.5, 1, 0.36, 0.28], [0.76, 1.5, 1, 0.36, 0.28], [-0.76, -1.5, 0, 0.37, 0.3], [0.76, -1.5, 0, 0.37, 0.3]],
    build(g, mats) {
      const body = new THREE.Mesh(loftBody(bulge(st, [1.5, -1.5], 0.07, 0.6)), mats.paint);
      body.castShadow = true; g.add(body);
      floorPan(g, mats, 1.42, 3.1, 0.18);
      glassCanopy(g, mats, { z0: 0.48, z1: -0.85, w: 1.46, y: 0.74, h: 0.3, rake: 0.42 });
      addLip(g, mats, 0, 0.18, 2.34, 1.44, 0.09);                    // splitter
      addDuck(g, mats, 0, 0.92, -2.12, 1.44);                        // ducktail
      lampsQuad(g, mats, 'head', 0.48, 2.18, 0.36, 0.11, 0.44);
      lampBar(g, mats, 'tail', -2.32, 0.58, 1.26, 0.09);
      mirrors(g, mats, 0.94, 0.82, 0.66);
      exhausts(g, mats, [-0.26, 0.26], 0.26, -2.34);
    },
  };
}
function chassisMuscle() {
  // long-nose muscle: high beltline, upright rear, big haunches (Mustang/Charger vibes)
  const st = [
    { z: 2.45, w: 1.3, h: 0.34, y: 0.24, e: 0.95 },
    { z: 2.1, w: 1.72, h: 0.5, y: 0.2, e: 0.88 },
    { z: 1.4, w: 1.82, h: 0.56, y: 0.18, e: 0.82 },
    { z: 0.7, w: 1.84, h: 0.6, y: 0.18, e: 0.8 },
    { z: 0.25, w: 1.82, h: 1.0, y: 0.18, e: 0.75, crown: 0.04 },
    { z: -0.5, w: 1.8, h: 1.04, y: 0.18, e: 0.75, crown: 0.05 },
    { z: -1.2, w: 1.86, h: 0.84, y: 0.18, e: 0.78 },
    { z: -1.9, w: 1.88, h: 0.62, y: 0.2, e: 0.85 },
    { z: -2.4, w: 1.68, h: 0.52, y: 0.24, e: 1.0 },
  ];
  return {
    wheels: [[-0.78, 1.62, 1, 0.37, 0.28], [0.78, 1.62, 1, 0.37, 0.28], [-0.78, -1.62, 0, 0.38, 0.32], [0.78, -1.62, 0, 0.38, 0.32]],
    build(g, mats) {
      const body = new THREE.Mesh(loftBody(bulge(st, [1.62, -1.62], 0.06, 0.6)), mats.paint);
      body.castShadow = true; g.add(body);
      floorPan(g, mats, 1.44, 3.3, 0.2);
      glassCanopy(g, mats, { z0: 0.42, z1: -1.18, w: 1.62, y: 0.8, h: 0.4, rake: 0.42 });
      // hood scoop + grille
      const scoop = new THREE.Mesh(new window.FX.RoundedBoxGeometry(0.56, 0.12, 0.85, 2, 0.05), mats.dark);
      scoop.position.set(0, 0.82, 1.5); g.add(scoop);
      const grille = new THREE.Mesh(new window.FX.RoundedBoxGeometry(1.24, 0.26, 0.08, 2, 0.03), mats.dark);
      grille.position.set(0, 0.48, 2.44); g.add(grille);
      lampsQuad(g, mats, 'head', 0.56, 2.45, 0.3, 0.14, 0.5);
      lampBar(g, mats, 'tail', -2.42, 0.56, 1.5, 0.11);
      mirrors(g, mats, 0.94, 0.86, 0.45);
      exhausts(g, mats, [-0.36, 0.36], 0.26, -2.44);
      addLip(g, mats, 0, 0.2, 2.48, 1.5, 0.08);
    },
  };
}
function chassisRally() {
  // compact rally hatch: short overhangs, boxy arches, roof vent, huge wing (WRC vibes)
  const st = [
    { z: 1.95, w: 1.34, h: 0.36, y: 0.24, e: 0.9 },
    { z: 1.65, w: 1.66, h: 0.48, y: 0.21, e: 0.85 },
    { z: 1.1, w: 1.76, h: 0.56, y: 0.2, e: 0.8 },
    { z: 0.55, w: 1.8, h: 1.02, y: 0.2, e: 0.75, crown: 0.05 },
    { z: -0.15, w: 1.78, h: 1.08, y: 0.2, e: 0.75, crown: 0.06 },
    { z: -0.85, w: 1.8, h: 1.02, y: 0.2, e: 0.78, crown: 0.04 },
    { z: -1.5, w: 1.82, h: 0.8, y: 0.22, e: 0.85 },
    { z: -1.78, w: 1.56, h: 0.62, y: 0.26, e: 0.95 },
  ];
  return {
    wheels: [[-0.76, 1.3, 1, 0.36, 0.28], [0.76, 1.3, 1, 0.36, 0.28], [-0.76, -1.28, 0, 0.36, 0.3], [0.76, -1.28, 0, 0.36, 0.3]],
    build(g, mats) {
      const body = new THREE.Mesh(loftBody(bulge(st, [1.3, -1.28], 0.08, 0.55)), mats.paint);
      body.castShadow = true; g.add(body);
      floorPan(g, mats, 1.4, 2.7, 0.22);
      glassCanopy(g, mats, { z0: 0.68, z1: -1.05, w: 1.58, y: 0.8, h: 0.42, rake: 0.55 });
      const scoop = new THREE.Mesh(new window.FX.RoundedBoxGeometry(0.5, 0.12, 0.5, 2, 0.04), mats.dark);
      scoop.position.set(0, 1.28, -0.1); g.add(scoop);                 // roof vent
      // the big wing
      const wing = new THREE.Mesh(new window.FX.RoundedBoxGeometry(1.7, 0.07, 0.44, 2, 0.02), mats.dark);
      wing.position.set(0, 1.28, -1.7); wing.rotation.x = 0.12; wing.castShadow = true; g.add(wing);
      for (const sx of [-0.7, 0.7]) {
        const post = new THREE.Mesh(new window.FX.RoundedBoxGeometry(0.06, 0.34, 0.3, 1, 0.02), mats.dark);
        post.position.set(sx, 1.08, -1.68); g.add(post);
      }
      lampsQuad(g, mats, 'head', 0.5, 1.97, 0.42, 0.15);
      lampsQuad(g, mats, 'tail', 0.55, -1.8, 0.4, 0.14);
      mirrors(g, mats, 0.96, 0.9, 0.85);
      exhausts(g, mats, [0.3], 0.36, -1.84);
      // mud flaps
      for (const [sx, sz] of [[-0.84, -1.62], [0.84, -1.62]]) {
        const flap = new THREE.Mesh(new window.FX.RoundedBoxGeometry(0.3, 0.3, 0.04, 1, 0.01), mats.rubber);
        flap.position.set(sx, 0.22, sz); g.add(flap);
      }
    },
  };
}
function chassisFormula() {
  // open-wheeler: slim lofted tub + nose, wings, halo, exposed wheels
  const st = [
    { z: 2.9, w: 0.34, h: 0.14, y: 0.3, e: 0.7 },
    { z: 2.2, w: 0.5, h: 0.22, y: 0.28, e: 0.7 },
    { z: 1.4, w: 0.9, h: 0.34, y: 0.24, e: 0.72 },
    { z: 0.6, w: 1.3, h: 0.5, y: 0.22, e: 0.72 },
    { z: -0.2, w: 1.42, h: 0.56, y: 0.22, e: 0.74 },   // sidepod belly
    { z: -1.1, w: 1.2, h: 0.62, y: 0.22, e: 0.72 },
    { z: -1.9, w: 0.74, h: 0.5, y: 0.26, e: 0.7 },
    { z: -2.2, w: 0.5, h: 0.34, y: 0.3, e: 0.8 },
  ];
  return {
    wheels: [[-1.02, 1.55, 1, 0.45, 0.44], [1.02, 1.55, 1, 0.45, 0.44], [-1.06, -1.55, 0, 0.47, 0.5], [1.06, -1.55, 0, 0.47, 0.5]],
    build(g, mats) {
      const body = new THREE.Mesh(loftBody(st, 20), mats.paint);
      body.castShadow = true; g.add(body);
      const RB = window.FX.RoundedBoxGeometry;
      for (const wy of [0.24, 0.34]) { const el = new THREE.Mesh(new RB(2.05, 0.045, 0.5, 2, 0.02), mats.dark); el.position.set(0, wy, 2.8); el.rotation.x = -0.12; g.add(el); }
      for (const sx of [-1.02, 1.02]) { const ep = new THREE.Mesh(new RB(0.05, 0.24, 0.62, 1, 0.02), mats.dark); ep.position.set(sx, 0.34, 2.76); g.add(ep); }
      for (const wy of [1.0, 1.12]) { const el = new THREE.Mesh(new RB(1.75, 0.05, 0.42, 2, 0.02), mats.dark); el.position.set(0, wy, -2.1); el.rotation.x = 0.14; g.add(el); }
      for (const sx of [-0.85, 0.85]) { const ep = new THREE.Mesh(new RB(0.05, 0.5, 0.6, 1, 0.02), mats.dark); ep.position.set(sx, 0.9, -2.08); g.add(ep); }
      const fin = new THREE.Mesh(new RB(0.05, 0.4, 1.0, 1, 0.02), mats.paint); fin.position.set(0, 0.98, -1.4); g.add(fin);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 20, Math.PI), mats.dark);
      halo.position.set(0, 0.92, 0.42); halo.rotation.set(-0.32, 0, 0); g.add(halo);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), mats.dark);
      strut.position.set(0, 0.8, 0.72); strut.rotation.x = 0.5; g.add(strut);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), mats.helmet);
      helm.position.set(0, 0.82, 0.3); g.add(helm);
      for (const [sx, sz] of [[-1.02, 1.55], [1.02, 1.55], [-1.06, -1.55], [1.06, -1.55]])
        for (const dy of [0.28, 0.46]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, Math.abs(sx) - 0.24, 6), mats.dark);
          arm.position.set(sx / 2, dy, sz); arm.rotation.z = Math.PI / 2; g.add(arm);
        }
      lampBar(g, mats, 'tail', -2.24, 0.62, 0.3, 0.16);              // rain light
    },
  };
}
function chassisTruck() {
  // lifted trophy truck
  const st = [
    { z: 2.3, w: 1.62, h: 0.5, y: 1.28, e: 1.05 },
    { z: 1.6, w: 1.86, h: 0.62, y: 1.24, e: 1.0 },
    { z: 0.9, w: 1.9, h: 0.66, y: 1.22, e: 0.98 },
    { z: 0.35, w: 1.88, h: 1.14, y: 1.22, e: 0.92, crown: 0.02 },
    { z: -0.45, w: 1.86, h: 1.16, y: 1.22, e: 0.92, crown: 0.02 },
    { z: -0.85, w: 1.88, h: 0.72, y: 1.22, e: 1.0 },
    { z: -2.2, w: 1.86, h: 0.68, y: 1.24, e: 1.08 },
  ];
  return {
    wheels: [[-1.22, 1.5, 1, 0.82, 0.72], [1.22, 1.5, 1, 0.82, 0.72], [-1.22, -1.5, 0, 0.82, 0.72], [1.22, -1.5, 0, 0.82, 0.72]],
    build(g, mats) {
      const body = new THREE.Mesh(loftBody(st), mats.paint);
      body.castShadow = true; g.add(body);
      glassCanopy(g, mats, { z0: 0.42, z1: -0.9, w: 1.7, y: 2.06, h: 0.5, rake: 0.4 });
      const RB = window.FX.RoundedBoxGeometry;
      const bump = new THREE.Mesh(new RB(2.2, 0.24, 0.3, 2, 0.06), mats.chrome); bump.position.set(0, 1.06, 2.34); g.add(bump);
      const grille = new THREE.Mesh(new RB(1.4, 0.42, 0.08, 2, 0.03), mats.dark); grille.position.set(0, 1.6, 2.32); g.add(grille);
      const bar = new THREE.Mesh(new RB(1.5, 0.14, 0.5, 2, 0.05), mats.dark); bar.position.set(0, 2.6, -0.15); g.add(bar);
      for (const lx of [-0.45, -0.15, 0.15, 0.45]) {
        const lm = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, emissive: 0xfff3d8, emissiveIntensity: 0, roughness: 0.2 });
        const lq = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 10), lm);
        lq.position.set(lx, 2.7, -0.15); lq.rotation.x = Math.PI / 2.3; g.add(lq); mats._head.push(lm);
      }
      for (const [fx, fz] of [[-0.85, 1.05], [0.85, 1.05], [-0.85, -1.05], [0.85, -1.05]]) {
        const link = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), mats.chrome);
        link.position.set(fx, 0.85, fz); link.rotation.x = 0.5; g.add(link);
      }
      lampsQuad(g, mats, 'head', 0.6, 2.36, 0.4, 0.16);
      lampBar(g, mats, 'tail', -2.28, 1.5, 1.5, 0.12);
      exhausts(g, mats, [-0.5, 0.5], 1.1, -2.3);
    },
  };
}
function chassisKart() {
  return {
    wheels: [[-0.72, 0.95, 1, 0.33, 0.32], [0.72, 0.95, 1, 0.33, 0.32], [-0.78, -0.95, 0, 0.39, 0.44], [0.78, -0.95, 0, 0.39, 0.44]],
    build(g, mats) {
      const RB = window.FX.RoundedBoxGeometry;
      const pan = new THREE.Mesh(new RB(1.12, 0.12, 2.5, 2, 0.05), mats.paint); pan.position.set(0, 0.2, 0); pan.castShadow = true; g.add(pan);
      for (const [len, zz] of [[1.3, 1.32], [1.1, -1.28]]) {
        const barM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), mats.chrome);
        barM.position.set(0, 0.24, zz); barM.rotation.z = Math.PI / 2; g.add(barM);
      }
      for (const sx of [-0.62, 0.62]) { const pod = new THREE.Mesh(new RB(0.22, 0.18, 1.5, 2, 0.06), mats.paint); pod.position.set(sx, 0.26, 0); g.add(pod); }
      const seat = new THREE.Mesh(new RB(0.62, 0.55, 0.55, 2, 0.16), mats.dark); seat.position.set(0, 0.5, -0.35); g.add(seat);
      const eng = new THREE.Mesh(new RB(0.5, 0.4, 0.55, 2, 0.1), mats.dark); eng.position.set(0.52, 0.42, -1.0); g.add(eng);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 6), mats.dark); col.position.set(0, 0.6, 0.72); col.rotation.x = Math.PI / 3; g.add(col);
      const sw = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16), mats.dark); sw.position.set(0, 0.78, 0.92); sw.rotation.x = Math.PI / 2.4; g.add(sw);
      const torso = new THREE.Mesh(new RB(0.5, 0.62, 0.42, 2, 0.12), mats.suit); torso.position.set(0, 0.62, -0.1); g.add(torso);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), mats.helmet); helm.position.set(0, 1.0, -0.1); g.add(helm);
      lampBar(g, mats, 'tail', -1.32, 0.3, 0.5, 0.08);
    },
  };
}
function chassisBike() {
  return {
    wheels: [[0, 1.25, 1, 0.5, 0.26], [0, -1.25, 0, 0.5, 0.32]],
    build(g, mats) {
      const RB = window.FX.RoundedBoxGeometry;
      const tank = new THREE.Mesh(new RB(0.36, 0.42, 1.4, 2, 0.14), mats.paint); tank.position.set(0, 0.74, -0.05); tank.castShadow = true; g.add(tank);
      const seat = new THREE.Mesh(new RB(0.38, 0.14, 0.85, 2, 0.06), mats.dark); seat.position.set(0, 0.94, -0.55); g.add(seat);
      const fair = new THREE.Mesh(new RB(0.5, 0.44, 0.75, 2, 0.16), mats.paint); fair.position.set(0, 0.68, 0.72); fair.rotation.x = 0.25; g.add(fair);
      const screen = new THREE.Mesh(new RB(0.34, 0.3, 0.4, 2, 0.12), mats.glass); screen.position.set(0, 0.92, 0.82); screen.rotation.x = 0.6; g.add(screen);
      const bars = new THREE.Mesh(new RB(0.7, 0.045, 0.07, 1, 0.02), mats.dark); bars.position.set(0, 1.02, 0.92); g.add(bars);
      for (const sx of [-0.09, 0.09]) { const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.85, 8), mats.chrome); fork.position.set(sx, 0.8, 0.95); fork.rotation.x = Math.PI / 2.6; g.add(fork); }
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.75, 8), mats.chrome); pipe.position.set(0.16, 0.42, -0.6); pipe.rotation.x = Math.PI / 2.15; g.add(pipe);
      const torso = new THREE.Mesh(new RB(0.42, 0.66, 0.42, 2, 0.14), mats.suit); torso.position.set(0, 1.07, -0.12); torso.rotation.x = -0.5; g.add(torso);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), mats.helmet); helm.position.set(0, 1.36, 0.34); g.add(helm);
      for (const sx of [-0.3, 0.3]) { const arm = new THREE.Mesh(new RB(0.15, 0.48, 0.15, 1, 0.05), mats.suit); arm.position.set(sx, 1.0, 0.5); arm.rotation.z = sx > 0 ? -0.5 : 0.5; g.add(arm); }
      lampsQuad(g, mats, 'head', 0, 0.78, 0.2, 0.14, 1.06);
      lampBar(g, mats, 'tail', -1.04, 0.98, 0.18, 0.08);
    },
  };
}

// ---- shared detail helpers ----
function glassCanopy(g, mats, o) {
  // lofted greenhouse: raked windshield -> roof -> rear glass. Slightly INSET from the
  // body sides so the paint keeps a visible roof rail (reads like real DLO trim).
  const st = [
    { z: o.z0 + 0.08, w: o.w * 0.86, h: 0.02, y: o.y, e: 0.62 },
    { z: o.z0 - o.rake, w: o.w * 0.88, h: o.h * 0.9, y: o.y, e: 0.6, crown: 0.02 },
    { z: o.z1 + 0.45, w: o.w * 0.88, h: o.h * 0.9, y: o.y, e: 0.6, crown: 0.02 },
    { z: o.z1, w: o.w * 0.8, h: o.h * 0.35, y: o.y, e: 0.66 },
  ];
  const m = new THREE.Mesh(loftBody(st, 16), mats.glass);
  g.add(m);
}
function floorPan(g, mats, w, len, y) {
  // closes the open loft underside so you can't see through the car
  const m = new THREE.Mesh(new window.FX.RoundedBoxGeometry(w, 0.14, len, 1, 0.04), mats.dark);
  m.position.set(0, y, 0);
  g.add(m);
}
function lampsQuad(g, mats, kind, sx, z, w, h, yOverride) {
  for (const s of (sx === 0 ? [0] : [-sx, sx])) {
    const m = new THREE.MeshStandardMaterial(kind === 'head'
      ? { color: 0xe8ecf2, emissive: 0xfff3d8, emissiveIntensity: 0, roughness: 0.18, metalness: 0.4 }
      : { color: 0x66090c, emissive: 0xff2218, emissiveIntensity: 0, roughness: 0.25 });
    const q = new THREE.Mesh(new window.FX.RoundedBoxGeometry(w, h, 0.07, 1, 0.03), m);
    q.position.set(s, yOverride || (kind === 'head' ? 0.62 : 0.7), z);
    g.add(q);
    (kind === 'head' ? mats._head : mats._tail).push(m);
  }
}
function lampBar(g, mats, kind, z, y, w, h) {
  const m = new THREE.MeshStandardMaterial(kind === 'head'
    ? { color: 0xe8ecf2, emissive: 0xfff3d8, emissiveIntensity: 0, roughness: 0.18 }
    : { color: 0x66090c, emissive: 0xff2218, emissiveIntensity: 0, roughness: 0.25 });
  const q = new THREE.Mesh(new window.FX.RoundedBoxGeometry(w, h, 0.07, 1, 0.03), m);
  q.position.set(0, y, z);
  g.add(q);
  (kind === 'head' ? mats._head : mats._tail).push(m);
}
function mirrors(g, mats, sx, y, z) {
  for (const s of [-sx, sx]) {
    const m = new THREE.Mesh(new window.FX.RoundedBoxGeometry(0.1, 0.09, 0.26, 1, 0.03), mats.paint);
    m.position.set(s, y, z); m.rotation.z = s > 0 ? -0.25 : 0.25;
    g.add(m);
  }
}
function addLip(g, mats, x, y, z, w, h) {
  const m = new THREE.Mesh(new window.FX.RoundedBoxGeometry(w, h, 0.3, 1, 0.03), mats.dark);
  m.position.set(x, y, z); g.add(m);
}
function addDuck(g, mats, x, y, z, w) {
  const m = new THREE.Mesh(new window.FX.RoundedBoxGeometry(w, 0.06, 0.34, 1, 0.02), mats.dark);
  m.position.set(x, y, z); m.rotation.x = 0.16; g.add(m);
}
function exhausts(g, mats, xs, y, z) {
  for (const ex of xs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 12), mats.chrome);
    m.position.set(ex, y, z); m.rotation.x = Math.PI / 2;
    g.add(m);
  }
}

// ---------------- the hero: real scanned-quality glTF body (assets/ferrari.glb) ----------------
// Proper AAA-style mesh with separated body/rims/trim/glass parts; we re-materialize per kit.
function buildGlbCar(g, mats, kit) {
  const car = window.CAR_GLB.clone(true);
  const paint = new THREE.MeshPhysicalMaterial({ color: PAINTS[kit.paint % PAINTS.length],
    metalness: 0.9, roughness: 0.38, clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
  const rimColor = kit.wheels === 'deep' ? 0xb8901f : kit.wheels === 'classic' ? 0x9aa0a8
    : kit.wheels === 'neon' ? 0x20f6e8 : 0xc8ccd4;
  const details = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 1.0, roughness: 0.32, envMapIntensity: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x101216, metalness: 0.25, roughness: 0.06, envMapIntensity: 1.3 });
  const byName = n => car.getObjectByName(n);
  if (byName('body')) byName('body').material = paint;
  for (const n of ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim']) { const o = byName(n); if (o) o.material = details; }
  if (byName('glass')) byName('glass').material = glass;
  const wheels = [];
  for (const n of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const w = byName(n); if (!w) continue;
    const wrap = new THREE.Group();
    wrap.position.copy(w.position);
    const parent = w.parent;
    w.position.set(0, 0, 0);
    parent.add(wrap); wrap.add(w);
    wheels.push(wrap);
  }
  // this asset models the nose at -z: flip to face our +z forward; front wheels are
  // then the pair at local -z (names in the asset are unreliable)
  car.rotation.y = Math.PI;
  for (const w of wheels) w.userData.front = w.position.z < 0;
  car.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(car);
  car.position.y -= bb.min.y;                       // tires exactly on the road
  car.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  g.add(car);
  return wheels;
}

const CHASSIS_BUILDERS = { gt: chassisGT, muscle: chassisMuscle, rally: chassisRally, formula: chassisFormula, truck: chassisTruck, kart: chassisKart, bike: chassisBike };

// ---------------- Toon 2.0: the beloved old TOY CARS are back ----------------
// Chunky box-built vehicles from the cel era, colored by the kit (paint / wheel style /
// helmet) with working head/brake light emissives. Chassis map: formula->f1 truck->monster.
const HUB_COLS = [0xc8ccd4, 0xe8e2ce, 0xc9a13b, 0x3a3e46, 0x20f6e8];
function buildToyCar(g, kit, helmetColor, headMats, tailMats) {
  const vehicle = { formula: 'f1', truck: 'monster', gt: 'coupe', muscle: 'muscle' }[kit.chassis] || kit.chassis;
  const paint = toonMat(PAINTS[kit.paint % PAINTS.length]);
  const dark = toonMat(0x1c1e22);
  const glass = glassMat();
  const helmetMat = toonMat(helmetColor);
  const wIdx = (typeof kit.wheels === 'number' ? kit.wheels : 0) % HUB_COLS.length;   // old kits stored style names
  const hub = wIdx === 4
    ? toonMat(0x20f6e8, { emissive: 0x20f6e8, emissiveIntensity: 1.2 })
    : toonMat(HUB_COLS[wIdx]);
  const wheels = [];

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const lamp = (kind, x, y, z, w = 0.24, h = 0.12) => {          // head/tail emissive block
    const mat = kind === 'head'
      ? toonMat(0x2a2820, { emissive: 0xfff3d8, emissiveIntensity: 0 })
      : toonMat(0x33120f, { emissive: 0xff2218, emissiveIntensity: 0 });
    (kind === 'head' ? headMats : tailMats).push(mat);
    add(new THREE.BoxGeometry(w, h, 0.06), mat, x, y, z);
  };
  // a wheel = a group (steers via .rotation.y) whose child[0] is the rolling cylinder.
  const wheel = (x, z, front, r = 0.45, width = 0.44) => {
    const wg = new THREE.Group();
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), dark);
    w.rotation.z = Math.PI / 2; w.castShadow = true;
    wg.add(w);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, width + 0.02, 10), hub);
    hb.rotation.z = Math.PI / 2;
    w.add(hb);
    wg.position.set(x, r, z);            // bottom of wheel sits at mesh-local y=0 (on the road)
    wg.userData.front = !!front;
    g.add(wg); wheels.push(wg);
    return wg;
  };
  const rider = (z, lean) => {                  // seated driver: torso + helmet (karts, bike)
    add(new THREE.BoxGeometry(0.5, 0.6, 0.42), dark, 0, 0.62, z, lean || 0);
    add(new THREE.SphereGeometry(0.28, 10, 8), helmetMat, 0, 1.0, z + (lean ? 0.18 : 0));
  };

  if (vehicle === 'kart') {
    add(new THREE.BoxGeometry(1.15, 0.16, 2.5), paint, 0, 0.2, 0);
    add(new THREE.BoxGeometry(1.25, 0.12, 0.5), dark, 0, 0.22, 1.35);
    add(new THREE.BoxGeometry(0.9, 0.5, 0.7), paint, 0, 0.45, -0.2);
    add(new THREE.BoxGeometry(0.5, 0.4, 0.55), dark, 0.5, 0.42, -1.05);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), dark, 0, 0.62, 0.75, Math.PI / 3);
    add(new THREE.TorusGeometry(0.22, 0.04, 6, 10), dark, 0, 0.78, 0.95, Math.PI / 2.4);
    rider(-0.1);
    wheel(-0.72, 0.95, 1, 0.34, 0.3); wheel(0.72, 0.95, 1, 0.34, 0.3);
    wheel(-0.78, -0.95, 0, 0.4, 0.42); wheel(0.78, -0.95, 0, 0.4, 0.42);
  } else if (vehicle === 'rally') {
    add(new THREE.BoxGeometry(1.9, 0.7, 4.0), paint, 0, 0.6, 0);
    add(new THREE.BoxGeometry(1.7, 0.6, 1.9), paint, 0, 1.15, -0.15);
    add(new THREE.BoxGeometry(1.55, 0.42, 1.7), glass, 0, 1.2, -0.15);
    add(new THREE.BoxGeometry(1.72, 0.5, 1.0), paint, 0, 1.35, -0.2);
    add(new THREE.BoxGeometry(0.5, 0.16, 0.4), dark, 0, 1.66, 0.1);
    add(new THREE.BoxGeometry(2.0, 0.1, 0.5), dark, 0, 1.05, -2.05);
    add(new THREE.BoxGeometry(0.09, 0.35, 0.5), paint, -0.9, 0.9, -2.05);
    add(new THREE.BoxGeometry(0.09, 0.35, 0.5), paint, 0.9, 0.9, -2.05);
    add(new THREE.BoxGeometry(1.6, 0.2, 0.3), dark, 0, 0.55, 2.05);
    for (const fz of [1.45, -1.45]) add(new THREE.BoxGeometry(2.1, 0.5, 0.9), dark, 0, 0.4, fz);
    lamp('head', -0.55, 0.72, 2.02); lamp('head', 0.55, 0.72, 2.02);
    lamp('tail', -0.6, 0.75, -2.02); lamp('tail', 0.6, 0.75, -2.02);
    wheel(-1.0, 1.45, 1, 0.52, 0.5); wheel(1.0, 1.45, 1, 0.52, 0.5);
    wheel(-1.0, -1.45, 0, 0.52, 0.5); wheel(1.0, -1.45, 0, 0.52, 0.5);
  } else if (vehicle === 'bike') {
    add(new THREE.BoxGeometry(0.34, 0.42, 1.5), paint, 0, 0.72, -0.1);
    add(new THREE.BoxGeometry(0.4, 0.16, 0.9), dark, 0, 0.92, -0.55);
    add(new THREE.BoxGeometry(0.5, 0.3, 0.7), paint, 0, 0.66, 0.75);
    add(new THREE.BoxGeometry(0.7, 0.05, 0.08), dark, 0, 1.0, 0.95);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), dark, 0, 0.82, 0.9, Math.PI / 2.6);
    add(new THREE.BoxGeometry(0.42, 0.7, 0.42), dark, 0, 1.05, -0.1, -0.5);
    add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 1.35, 0.35);
    add(new THREE.BoxGeometry(0.16, 0.5, 0.16), dark, -0.3, 1.0, 0.5, 0, 0, 0.5);
    add(new THREE.BoxGeometry(0.16, 0.5, 0.16), dark, 0.3, 1.0, 0.5, 0, 0, -0.5);
    lamp('head', 0, 0.7, 1.12, 0.18, 0.14); lamp('tail', 0, 0.9, -1.0, 0.16, 0.1);
    wheel(0, 1.25, 1, 0.5, 0.24);
    wheel(0, -1.25, 0, 0.5, 0.28);
  } else if (vehicle === 'monster') {
    add(new THREE.BoxGeometry(2.0, 0.5, 3.4), dark, 0, 1.4, 0);
    add(new THREE.BoxGeometry(2.0, 0.9, 1.5), paint, 0, 2.0, -0.3);
    add(new THREE.BoxGeometry(1.8, 0.55, 1.2), glass, 0, 2.1, -0.25);
    add(new THREE.BoxGeometry(2.0, 0.7, 1.4), paint, 0, 1.85, 1.1);
    add(new THREE.BoxGeometry(2.2, 0.25, 0.3), dark, 0, 1.7, 1.9);
    add(new THREE.BoxGeometry(0.5, 0.2, 0.5), dark, 0, 2.55, 0.4);
    for (const lx of [-0.5, 0, 0.5]) add(new THREE.SphereGeometry(0.14, 8, 6), toonMat(0xfff2b0), lx, 2.7, 0.4);
    lamp('head', -0.6, 1.85, 1.83); lamp('head', 0.6, 1.85, 1.83);
    lamp('tail', -0.7, 1.55, -1.73); lamp('tail', 0.7, 1.55, -1.73);
    wheel(-1.15, 1.35, 1, 0.95, 0.8); wheel(1.15, 1.35, 1, 0.95, 0.8);
    wheel(-1.15, -1.35, 0, 0.95, 0.8); wheel(1.15, -1.35, 0, 0.95, 0.8);
  } else if (vehicle === 'muscle') {
    add(new THREE.BoxGeometry(2.0, 0.62, 4.6), paint, 0, 0.58, 0.1);          // long low body
    add(new THREE.BoxGeometry(1.7, 0.55, 1.6), paint, 0, 1.1, -0.5);          // cabin set back
    add(new THREE.BoxGeometry(1.55, 0.4, 1.45), glass, 0, 1.16, -0.5);
    add(new THREE.BoxGeometry(0.9, 0.14, 0.7), dark, 0, 0.94, 1.2);           // hood scoop
    add(new THREE.BoxGeometry(1.9, 0.12, 0.4), dark, 0, 0.95, -2.15);         // ducktail
    add(new THREE.BoxGeometry(2.05, 0.2, 0.3), dark, 0, 0.4, 2.35);
    add(new THREE.BoxGeometry(2.05, 0.2, 0.3), dark, 0, 0.4, -2.3);
    lamp('head', -0.62, 0.62, 2.42); lamp('head', 0.62, 0.62, 2.42);
    lamp('tail', -0.65, 0.66, -2.37, 0.5, 0.12); lamp('tail', 0.65, 0.66, -2.37, 0.5, 0.12);
    wheel(-1.02, 1.5, 1, 0.5, 0.46); wheel(1.02, 1.5, 1, 0.5, 0.46);
    wheel(-1.02, -1.5, 0, 0.54, 0.52); wheel(1.02, -1.5, 0, 0.54, 0.52);
  } else if (vehicle === 'coupe') {                                            // 'gt' slot
    add(new THREE.BoxGeometry(1.9, 0.55, 4.2), paint, 0, 0.52, 0);            // sleek body
    add(new THREE.BoxGeometry(1.6, 0.5, 2.0), paint, 0, 1.0, -0.25);          // fastback cabin
    add(new THREE.BoxGeometry(1.45, 0.36, 1.85), glass, 0, 1.06, -0.25);
    add(new THREE.BoxGeometry(1.55, 0.3, 0.9), paint, 0, 0.92, 1.3);          // sloping nose
    add(new THREE.BoxGeometry(1.7, 0.1, 0.4), dark, 0, 0.98, -2.0);           // lip spoiler
    add(new THREE.BoxGeometry(1.95, 0.18, 0.3), dark, 0, 0.34, 2.12);
    add(new THREE.BoxGeometry(1.95, 0.18, 0.3), dark, 0, 0.36, -2.1);
    lamp('head', -0.58, 0.58, 2.2); lamp('head', 0.58, 0.58, 2.2);
    lamp('tail', -0.6, 0.64, -2.17, 0.42, 0.12); lamp('tail', 0.6, 0.64, -2.17, 0.42, 0.12);
    wheel(-0.95, 1.4, 1, 0.46, 0.42); wheel(0.95, 1.4, 1, 0.46, 0.42);
    wheel(-0.95, -1.4, 0, 0.48, 0.46);  wheel(0.95, -1.4, 0, 0.48, 0.46);
  } else {   // 'f1'
    add(new THREE.BoxGeometry(1.5, 0.42, 3.4), paint, 0, 0.42, -0.1);
    add(new THREE.BoxGeometry(0.62, 0.3, 1.7), paint, 0, 0.42, 2.0);
    add(new THREE.BoxGeometry(2.1, 0.09, 0.62), dark, 0, 0.3, 2.8);
    add(new THREE.BoxGeometry(0.9, 0.5, 1.5), paint, 0, 0.76, -1.0);
    add(new THREE.BoxGeometry(0.7, 0.28, 0.7), dark, 0, 0.72, 0.55);
    add(new THREE.SphereGeometry(0.3, 10, 8), helmetMat, 0, 0.86, 0.35);
    add(new THREE.BoxGeometry(1.8, 0.09, 0.55), dark, 0, 1.06, -2.1);
    add(new THREE.BoxGeometry(0.08, 0.5, 0.55), dark, -0.82, 0.82, -2.1);
    add(new THREE.BoxGeometry(0.08, 0.5, 0.55), dark, 0.82, 0.82, -2.1);
    add(new THREE.BoxGeometry(0.5, 0.4, 1.6), paint, -0.98, 0.45, -0.4);
    add(new THREE.BoxGeometry(0.5, 0.4, 1.6), paint, 0.98, 0.45, -0.4);
    lamp('tail', 0, 0.85, -2.35, 0.2, 0.2);
    wheel(-1.02, 1.55, 1); wheel(1.02, 1.55, 1);
    wheel(-1.06, -1.55, 0); wheel(1.06, -1.55, 0);
  }
  return wheels;
}

// ---------------- assembly ----------------
function buildKitMesh(kit, helmetColor, num) {
  const g = new THREE.Group();
  const headMats = [], tailMats = [];
  g.userData.headMats = headMats;
  g.userData.tailMats = tailMats;
  g.userData.wheels = buildToyCar(g, kit, helmetColor, headMats, tailMats);
  if (typeof addOutlines === 'function') addOutlines(g, 1.05);   // the classic ink shell
  return g;
}
