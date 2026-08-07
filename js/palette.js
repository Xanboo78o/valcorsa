/* Toon 2.0 palettes — the single source of color truth for the illustrated look.
   PALETTES[env][day|dusk|night]; paletteBlend(env) lerps them by the daynight factors
   into the live PAL object that materials, sky, fog, ink and haze all read. */
'use strict';

// helper: build one palette entry from hex values
function _pal(p) {
  const c = (h) => new THREE.Color(h);
  return {
    skyTop: c(p.skyTop), skyHorizon: c(p.skyHorizon),
    sunColor: c(p.sunColor), sunI: p.sunI,
    hemiSky: c(p.hemiSky), hemiGround: c(p.hemiGround), hemiI: p.hemiI,
    ground: p.ground.map(c),           // [shadow, mid, light] — 3-step painted terrain ramp
    canopy: p.canopy.map(c),           // [lo, hi] foliage tint range
    road: c(p.road), roadEdge: c(p.roadEdge), marking: c(p.marking),
    kerb: p.kerb.map(c),               // [red, cream]
    fog: c(p.fog), ink: c(p.ink), rim: c(p.rim),
    haze: p.haze.map(c),               // [near, mid, far] stepped illustrated haze
  };
}

const PALETTES = {
  meadow: {
    day: _pal({
      skyTop: 0x3d8fe0, skyHorizon: 0xcfeaff,
      sunColor: 0xfff4de, sunI: 2.8,
      hemiSky: 0xbcdcf5, hemiGround: 0x6d8a52, hemiI: 0.55,
      ground: [0x4c8a34, 0x63a844, 0x7fc258],
      canopy: [0x3f7f33, 0x63a848],
      road: 0x6d7280, roadEdge: 0xe9e5da, marking: 0xf2efe6,
      kerb: [0xd0342c, 0xefe8da],
      fog: 0xd8ecfa, ink: 0x26324a, rim: 0xcfe4ff,
      haze: [0xcfe6f5, 0xbcd8ee, 0xa9c8e6],
    }),
    dusk: _pal({
      skyTop: 0x51447e, skyHorizon: 0xf5a35c,
      sunColor: 0xffb35c, sunI: 1.7,
      hemiSky: 0xc79ac2, hemiGround: 0x5b5348, hemiI: 0.42,
      ground: [0x3f6234, 0x557a41, 0x6f9350],
      canopy: [0x35602e, 0x527d3d],
      road: 0x4f4a55, roadEdge: 0xe0cdb4, marking: 0xe8d9c0,
      kerb: [0xb52f28, 0xdcccb0],
      fog: 0xe9b98d, ink: 0x3a2b47, rim: 0xffcf9a,
      haze: [0xedbf94, 0xd9a184, 0xb87f84],
    }),
    night: _pal({
      skyTop: 0x0c1430, skyHorizon: 0x22335c,
      sunColor: 0xbdd2f5, sunI: 0.32,
      hemiSky: 0x2a3a5e, hemiGround: 0x131b18, hemiI: 0.26,
      ground: [0x14251c, 0x1d3226, 0x284232],
      canopy: [0x122417, 0x1c3322],
      road: 0x232830, roadEdge: 0x9aa4b6, marking: 0xaab4c4,
      kerb: [0x6e2724, 0x8e887a],
      fog: 0x141d33, ink: 0x67799e, rim: 0x8fb3e8,
      haze: [0x1a2745, 0x162138, 0x111a2c],
    }),
  },
};
PALETTES.forest = {
  day: _pal({
    skyTop: 0x3583d6, skyHorizon: 0xc6e6f5,
    sunColor: 0xfdf3d9, sunI: 2.6,
    hemiSky: 0xaed4ea, hemiGround: 0x54754a, hemiI: 0.52,
    ground: [0x3e7530, 0x54963c, 0x6cb04e],
    canopy: [0x2f6329, 0x4e8a3a],
    road: 0x686d7a, roadEdge: 0xe6e2d6, marking: 0xf0ede2,
    kerb: [0xc93129, 0xece5d6],
    fog: 0xcfe6ef, ink: 0x223145, rim: 0xc8e2fa,
    haze: [0xc4e0ea, 0xaed2e2, 0x97c0d8],
  }),
  dusk: PALETTES.meadow.dusk,
  night: PALETTES.meadow.night,
};
PALETTES.desert = {
  day: _pal({
    skyTop: 0x4a90d9, skyHorizon: 0xf6e3b8,
    sunColor: 0xfff0cd, sunI: 3.0,
    hemiSky: 0xead9b5, hemiGround: 0x9c7a4e, hemiI: 0.6,
    ground: [0xc09155, 0xd6ad6a, 0xe8c584],
    canopy: [0x6a7538, 0x8a9448],
    road: 0x767268, roadEdge: 0xf2ecd9, marking: 0xf6f1e2,
    kerb: [0xd0392c, 0xf2ead6],
    fog: 0xf3e2c0, ink: 0x4a3226, rim: 0xffe6b8,
    haze: [0xf0ddb9, 0xe3c9a0, 0xcfae8a],
  }),
  dusk: _pal({
    skyTop: 0x6b3a70, skyHorizon: 0xf88f4d,
    sunColor: 0xffa64d, sunI: 1.8,
    hemiSky: 0xd99a94, hemiGround: 0x6e5240, hemiI: 0.44,
    ground: [0x9c7343, 0xb58a52, 0xc99f63],
    canopy: [0x565f2e, 0x6f783b],
    road: 0x5c5450, roadEdge: 0xe4cbaa, marking: 0xe9d5b4,
    kerb: [0xb03026, 0xdec9a8],
    fog: 0xf0ab72, ink: 0x47263c, rim: 0xffc27e,
    haze: [0xf2b483, 0xdd9372, 0xbb7570],
  }),
  night: PALETTES.meadow.night,
};
PALETTES.city = {
  day: _pal({
    skyTop: 0x4585c9, skyHorizon: 0xd6e2ec,
    sunColor: 0xfef2da, sunI: 2.7,
    hemiSky: 0xc2d3e2, hemiGround: 0x5d6068, hemiI: 0.56,
    ground: [0x757b85, 0x8a9099, 0x9ea4ad],
    canopy: [0x3f7f33, 0x63a848],
    road: 0x60656f, roadEdge: 0xe6e2d6, marking: 0xefece0,
    kerb: [0xcf342b, 0xece6d8],
    fog: 0xdae4ec, ink: 0x28303f, rim: 0xd3e3f2,
    haze: [0xd4e0ea, 0xc2d0de, 0xafc0d2],
  }),
  dusk: PALETTES.meadow.dusk,
  night: PALETTES.meadow.night,
};
PALETTES.countryside = PALETTES.meadow;
PALETTES.oval = PALETTES.meadow;
// the frozen interior (Hiljaisuus): snow ground, dark spruce, pale light
PALETTES.taiga = {
  day: _pal({
    skyTop: 0x9db8d4, skyHorizon: 0xeef4fa,
    sunColor: 0xfff8ec, sunI: 2.2,
    hemiSky: 0xdbe8f4, hemiGround: 0xb8c4d2, hemiI: 0.6,
    ground: [0xdfe7ee, 0xedf3f8, 0xfafdff],
    canopy: [0x2c473a, 0x3d5c4a],
    road: 0x565c68, roadEdge: 0xf2f5f9, marking: 0xffffff,
    kerb: [0xd0342c, 0xffffff],
    fog: 0xe8eef6, ink: 0x2c3a50, rim: 0xffffff,
    haze: [0xe4edf6, 0xd3e0ee, 0xc0d2e6],
  }),
  dusk: _pal({
    skyTop: 0x6a5e8e, skyHorizon: 0xf5b97c,
    sunColor: 0xffc27c, sunI: 1.4,
    hemiSky: 0xc0a8cc, hemiGround: 0x8e94a4, hemiI: 0.45,
    ground: [0xc9c4d6, 0xd8d4e2, 0xe8e4ef],
    canopy: [0x27392f, 0x33493c],
    road: 0x4a4c5c, roadEdge: 0xe6dfd8, marking: 0xf2ece4,
    kerb: [0xb52f28, 0xe8e0d4],
    fog: 0xe2c4a8, ink: 0x3a3450, rim: 0xffd9ae,
    haze: [0xe8c9a8, 0xd4ab9c, 0xb490a0],
  }),
  night: _pal({
    skyTop: 0x0a1226, skyHorizon: 0x1d2c4e,
    sunColor: 0xbdd2f5, sunI: 0.4,
    hemiSky: 0x2c3c5e, hemiGround: 0x202a38, hemiI: 0.34,
    ground: [0x2c3644, 0x37445a, 0x46566e],
    canopy: [0x101d16, 0x18291e],
    road: 0x20242e, roadEdge: 0xa2acbe, marking: 0xb2bccc,
    kerb: [0x6e2724, 0x9a94a2],
    fog: 0x101a30, ink: 0x67799e, rim: 0x9fc0f0,
    haze: [0x1a2745, 0x162138, 0x111a2c],
  }),
};

// The live blended palette — every color is a THREE.Color instance that gets lerped
// in place each frame, so materials can hold references to them safely.
const PAL = _pal({
  skyTop: 0x3d8fe0, skyHorizon: 0xcfeaff, sunColor: 0xfff4de, sunI: 2.8,
  hemiSky: 0xbcdcf5, hemiGround: 0x6d8a52, hemiI: 0.55,
  ground: [0x4c8a34, 0x63a844, 0x7fc258], canopy: [0x3f7f33, 0x63a848],
  road: 0x6d7280, roadEdge: 0xe9e5da, marking: 0xf2efe6, kerb: [0xd0342c, 0xefe8da],
  fog: 0xd8ecfa, ink: 0x26324a, rim: 0xcfe4ff,
  haze: [0xcfe6f5, 0xbcd8ee, 0xa9c8e6],
});
PAL.key = 'meadow';

// Blend day/dusk/night into PAL using the daynight factors (wDay+wDusk+wNight ≈ 1).
function paletteBlend(envKey, wDay, wDusk, wNight) {
  const P = PALETTES[envKey] || PALETTES.meadow;
  PAL.key = envKey;
  const mixC = (out, a, b, c2) => {
    out.setRGB(a.r * wDay + b.r * wDusk + c2.r * wNight,
               a.g * wDay + b.g * wDusk + c2.g * wNight,
               a.b * wDay + b.b * wDusk + c2.b * wNight);
  };
  for (const k of ['skyTop', 'skyHorizon', 'sunColor', 'hemiSky', 'hemiGround',
                   'road', 'roadEdge', 'marking', 'fog', 'ink', 'rim']) {
    mixC(PAL[k], P.day[k], P.dusk[k], P.night[k]);
  }
  for (const arr of ['ground', 'canopy', 'kerb', 'haze'])
    for (let i = 0; i < PAL[arr].length; i++)
      mixC(PAL[arr][i], P.day[arr][i], P.dusk[arr][i], P.night[arr][i]);
  PAL.sunI = P.day.sunI * wDay + P.dusk.sunI * wDusk + P.night.sunI * wNight;
  PAL.hemiI = P.day.hemiI * wDay + P.dusk.hemiI * wDusk + P.night.hemiI * wNight;
}

window.PALETTES = PALETTES;
window.PAL = PAL;
window.paletteBlend = paletteBlend;

// ---- Toon 2.0 material core (shared by the game AND dev harnesses like carshow) ----
let GRAD3 = null;
function toonRamp() {
  if (GRAD3) return GRAD3;
  const d = new Uint8Array([122, 176, 255]);   // lifted shadow step — crushed blacks kill the comic look
  GRAD3 = new THREE.DataTexture(d, 3, 1, THREE.RedFormat, THREE.UnsignedByteType);
  GRAD3.minFilter = GRAD3.magFilter = THREE.NearestFilter;
  GRAD3.generateMipmaps = false;
  GRAD3.needsUpdate = true;
  return GRAD3;
}
const TOON_OK = ['color', 'map', 'vertexColors', 'side', 'alphaTest', 'transparent',
                 'opacity', 'emissive', 'emissiveMap', 'emissiveIntensity', 'fog'];
function toonMat(color, opts = {}) {
  const o = { color, gradientMap: toonRamp() };
  for (const k of TOON_OK) if (opts[k] !== undefined) o[k] = opts[k];
  return new THREE.MeshToonMaterial(o);
}
// cars keep a glossy clearcoat lobe (stylized racers keep specular cars) + palette rim light
function paintMat(color) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0.25,
    clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });
  addRimLight(m);
  return m;
}
// fresnel³ rim light in the palette rim color — pops cars off the flat fills
function addRimLight(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: PAL.rim };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
      .replace('#include <opaque_fragment>',
        'float rimF = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);\n' +
        'outgoingLight += rimColor * rimF * 0.55;\n#include <opaque_fragment>');
  };
  return mat;
}
// flat ink glass with a painted diagonal highlight streak
let GLASS_STREAK = null;
function glassStreakTex() {
  if (GLASS_STREAK) return GLASS_STREAK;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#141a22'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(232,240,250,0.5)'; x.lineWidth = 9; x.lineCap = 'round';
  x.beginPath(); x.moveTo(18, 110); x.lineTo(84, 22); x.stroke();
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(46, 116); x.lineTo(108, 34); x.stroke();
  GLASS_STREAK = new THREE.CanvasTexture(c);
  GLASS_STREAK.colorSpace = THREE.SRGBColorSpace;
  return GLASS_STREAK;
}
function glassMat() {
  return toonMat(0xffffff, { map: glassStreakTex(), transparent: true, opacity: 0.96,
    side: THREE.DoubleSide });
}
// Classic inverted-hull ink shell for cars + hero props (world lines come from the InkPass).
let OUTLINE_MAT = null;
function addOutlines(group, thickness = 1.06) {
  if (!OUTLINE_MAT) {
    OUTLINE_MAT = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    OUTLINE_MAT.color = PAL.ink;                   // live palette reference
  }
  const clones = [];
  group.traverse(o => {
    if (o.isMesh && !o.userData.isOutline && !o.material.transparent) clones.push(o);
  });
  for (const m of clones) {
    const o = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    o.position.copy(m.position);
    o.rotation.copy(m.rotation);
    o.scale.copy(m.scale).multiplyScalar(thickness);
    o.castShadow = false;
    o.userData.isOutline = true;
    m.parent.add(o);
  }
}

window.toonMat = toonMat;
window.paintMat = paintMat;
window.glassMat = glassMat;
window.addOutlines = addOutlines;
window.toonRamp = toonRamp;
