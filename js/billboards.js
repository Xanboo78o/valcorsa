/* VALCORSA — PROPAGANDA & ADS: trackside billboards.
   The racing nation speaks. Posters are drawn on canvas in the GP-poster
   palette (cream/green/rosso/gold) and planted on billboards along every
   circuit. Half national propaganda played dead straight, half ads for the
   in-world brands. Self-contained: watches for track rebuilds, no main.js edits. */
'use strict';
(function () {
  const B = { group: null, trackId: null, textures: null };
  window.BILLBOARDS = B;

  const CREAM = '#f4ecdd', GREEN = '#1e5741', ROSSO = '#c73a2c', GOLD = '#c99a2e', INK = '#2b2119';

  // ---- poster designs: [bg, draw(ctx, w, h)] ----
  function txt(ctx, lines, w, h, color, sizes) {
    ctx.textAlign = 'center';
    let y = h * 0.28;
    lines.forEach((line, i) => {
      const s = sizes[i] || sizes[sizes.length - 1];
      ctx.font = `900 ${s}px 'Alfa Slab One', Georgia, serif`;
      ctx.fillStyle = color;
      ctx.fillText(line, w / 2, y);
      y += s * 1.25;
    });
  }
  function border(ctx, w, h, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, w - 28, h - 28);
  }
  const DESIGNS = [
    // ---- propaganda ----
    [GREEN, (c, w, h) => { border(c, w, h, CREAM); txt(c, ['VALCORSA', 'HOME OF RACING'], w, h + 60, CREAM, [64, 34]);
      c.fillStyle = GOLD; c.beginPath(); c.arc(w / 2, h * 0.72, 40, 0, 7); c.fill();
      c.fillStyle = ROSSO; c.beginPath(); c.arc(w / 2, h * 0.72, 16, 0, 7); c.fill(); }],
    [CREAM, (c, w, h) => { border(c, w, h, ROSSO); txt(c, ['YOUR NATION', 'NEEDS SPEED'], w, h + 40, ROSSO, [54, 54]);
      c.fillStyle = INK; c.font = '700 22px Georgia'; c.fillText('— the VCRA', w / 2, h * 0.82); }],
    [INK, (c, w, h) => { txt(c, ['SLOW', 'IS A CHOICE.'], w, h + 30, CREAM, [70, 44]);
      c.fillStyle = GOLD; c.font = '900 30px Georgia'; c.fillText('CHOOSE WISELY.', w / 2, h * 0.8); }],
    [CREAM, (c, w, h) => { border(c, w, h, GREEN); txt(c, ['EVERY TOWN', 'HAS A TRACK'], w, h + 40, GREEN, [48, 48]);
      c.fillStyle = ROSSO; c.font = '700 24px Georgia'; c.fillText('every kid has a dream', w / 2, h * 0.8); }],
    [ROSSO, (c, w, h) => { txt(c, ['RACE HARD'], w, h + 60, CREAM, [64]);
      c.fillStyle = CREAM; c.font = '700 30px Georgia'; c.fillText('be kind to your tires', w / 2, h * 0.62);
      c.font = '700 20px Georgia'; c.fillText('— Valcorsa Radio', w / 2, h * 0.82); }],
    [GREEN, (c, w, h) => { border(c, w, h, GOLD); txt(c, ['THE SAINTS', 'DROVE FIRST'], w, h + 40, CREAM, [50, 50]);
      c.fillStyle = GOLD; c.font = '700 22px Georgia'; c.fillText('Rally der Heiligen · every October', w / 2, h * 0.82); }],
    [INK, (c, w, h) => { c.fillStyle = '#ff7a1a'; c.font = `900 90px 'Alfa Slab One', Georgia, serif`;
      c.textAlign = 'center'; c.fillText('HE', w / 2, h * 0.42); c.fillText('IS COMING.', w / 2, h * 0.68);
      c.font = '700 20px Georgia'; c.fillStyle = CREAM; c.fillText('El Santo · undefeated where it matters', w / 2, h * 0.88); }],
    [CREAM, (c, w, h) => { border(c, w, h, INK); txt(c, ['TRUNKS WILL BE', 'INSPECTED'], w, h + 40, INK, [42, 52]);
      c.fillStyle = ROSSO; c.font = '700 22px Georgia'; c.fillText('VCRA technical directive 78-B', w / 2, h * 0.82); }],
    // ---- ads ----
    [GREEN, (c, w, h) => { txt(c, ['ENGINOS'], w, h + 70, GOLD, [78]);
      c.fillStyle = CREAM; c.font = '700 26px Georgia';
      c.fillText('the heart of Valcorsa', w / 2, h * 0.62);
      c.fillText('beats at 9000 rpm', w / 2, h * 0.74); }],
    [CREAM, (c, w, h) => { border(c, w, h, GREEN); txt(c, ['BASILAXLES'], w, h + 60, GREEN, [58]);
      c.fillStyle = INK; c.font = '700 26px Georgia'; c.fillText('are they good axles?', w / 2, h * 0.6);
      c.fillStyle = ROSSO; c.font = '900 30px Georgia'; c.fillText('FIND OUT.', w / 2, h * 0.78); }],
    [GOLD, (c, w, h) => { txt(c, ['PERRO', 'COLA'], w, h + 30, INK, [64, 64]);
      c.fillStyle = INK; c.font = '700 24px Georgia'; c.fillText('the official drink of jumping', w / 2, h * 0.8);
      c.fillStyle = ROSSO; c.beginPath(); c.arc(w * 0.82, h * 0.25, 26, 0, 7); c.fill(); }],
    [INK, (c, w, h) => { txt(c, ['XANBOO', 'MOTOR CORPS'], w, h + 30, CREAM, [54, 40]);
      c.fillStyle = GOLD; c.font = '700 26px Georgia'; c.fillText('cheap parts. big dreams.', w / 2, h * 0.72);
      c.font = '700 20px Georgia'; c.fillText('(some smoke, probably)', w / 2, h * 0.84); }],
    [CREAM, (c, w, h) => { border(c, w, h, ROSSO); txt(c, ['CHANES', 'CHASSIS'], w, h + 30, ROSSO, [56, 56]);
      c.fillStyle = INK; c.font = '700 24px Georgia'; c.fillText('collect the cards · unlock the frame', w / 2, h * 0.8); }],
    [GREEN, (c, w, h) => { txt(c, ['THE MORNING', 'GRID'], w, h + 30, CREAM, [46, 60]);
      c.fillStyle = GOLD; c.font = '700 24px Georgia'; c.fillText('📻 daily on Valcorsa Radio', w / 2, h * 0.8); }],
  ];

  function makeTextures() {
    if (B.textures) return B.textures;
    B.textures = DESIGNS.map(([bg, draw]) => {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 320;
      const c = cv.getContext('2d');
      c.fillStyle = bg; c.fillRect(0, 0, 512, 320);
      // paper grain flecks
      c.globalAlpha = 0.05;
      for (let i = 0; i < 120; i++) { c.fillStyle = INK; c.fillRect(Math.random() * 512, Math.random() * 320, 2, 2); }
      c.globalAlpha = 1;
      try { draw(c, 512, 320); } catch (e) {}
      const tx = new THREE.CanvasTexture(cv);
      tx.anisotropy = 4;
      return tx;
    });
    return B.textures;
  }

  function build() {
    if (B.group) { try { scene.remove(B.group); } catch (e) {} B.group = null; }
    if (typeof track === 'undefined' || !track || !track.samples) return;
    const g = new THREE.Group();
    const N = track.N, tex = makeTextures();
    const postMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
    const backMat = new THREE.MeshLambertMaterial({ color: 0x6b5f52 });
    const step = Math.floor(N / 12);                       // ~12 boards per circuit
    for (let k = 0; k < 12; k++) {
      const i = (k * step + Math.floor(step * 0.5)) % N;
      const s = track.samples[i], r = track.rights[i], t = track.tangents[i];
      const side = k % 2 === 0 ? 1 : -1;
      const off = track.halfW + 7 + (k % 3);
      const x = s.x + r.x * off * side, z = s.z + r.z * off * side;
      let y = s.y;
      try { if (typeof fieldAt === 'function') y = fieldAt(x, z); } catch (e) {}
      const board = new THREE.Group();
      // panel: poster face + plain back
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.5, 0.3),
        [backMat, backMat, backMat, backMat,
         new THREE.MeshBasicMaterial({ map: tex[(k * 5 + (track.def && track.def.laps || 0)) % tex.length] }), backMat]);
      panel.position.y = 5.2;
      board.add(panel);
      for (const px of [-2.9, 2.9]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.5, 0.35), postMat);
        post.position.set(px, 2.75, 0);
        board.add(post);
      }
      board.position.set(x, y, z);
      // face the road: look along -right (toward centerline)
      board.rotation.y = Math.atan2(-r.x * side, -r.z * side);
      g.add(board);
    }
    scene.add(g);
    B.group = g;
    B.trackId = track.def ? track.def.id : 'x';
  }

  // watch for races being built / left
  setInterval(() => {
    try {
      const have = typeof track !== 'undefined' && track && track.samples;
      if (!have) { if (B.group) { scene.remove(B.group); B.group = null; B.trackId = null; } return; }
      const id = track.def ? track.def.id : 'x';
      if (id !== B.trackId || !B.group || !B.group.parent) build();
    } catch (e) {}
  }, 1200);
})();
