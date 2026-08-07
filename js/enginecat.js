// VALCORSA — The Standardization, slice 1: the atomic ENGINE STACK.
// Blocks, cranks, piston sets, cams, heads, turbos — real Valcorsa terminology,
// codes that decode (DESIGN.md §6.6, log in PARTS-QA.md). Pushed into window.PARTS
// (fam 'Engine', atom:true) so the store/packs sell them; the Workbench (garage3d.js)
// assembles them; ENGINEMATH computes honest specs; finished builds live in vc_builds.
// Also runs the Standardization Act migration: legacy engines -> relics + ₡ refund.
'use strict';

window.ENGINEMATH = (() => {
  const atoms = [];
  // add(kind, code, nick, brand, size, rarity, price, extra, note)
  function add(kind, code, nick, brand, size, rarity, price, extra, note) {
    const id = ('eng2-' + kind + '-' + code + '-' + brand).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const p = Object.assign({
      id, fam: 'Engine', atom: true, kind, code, size, brand, rarity, price,
      name: code + ' "' + nick + '"', stats: {}, note: note || '',
    }, extra);
    atoms.push(p);
    window.PARTS.push(p);
    return p;
  }

  // ---- BLOCKS (the ceiling: cc, cylinders, bay size) ----
  add('block', 'B-S1 1000', 'Poni II', 'Motores Granada', 'S', 'common',    90, { cc: 1000, cyl: 2 }, 'two happy cylinders');
  add('block', 'B-S2 1300', 'Trabajo', 'XB78 Corps',      'S', 'common',   120, { cc: 1300, cyl: 3 }, 'the delivery-kart classic');
  add('block', 'B-M1 1600', 'Strada',  'Norte Motori',    'M', 'common',   180, { cc: 1600, cyl: 4 }, 'the honest four');
  add('block', 'B-M2 2000', 'Doble',   'Norte Motori',    'M', 'solid',    260, { cc: 2000, cyl: 4 }, 'club racing backbone');
  add('block', 'B-L1 2400', 'Seis',    'Enginos',         'L', 'solid',    420, { cc: 2400, cyl: 6 }, 'the poster block');
  add('block', 'B-L2 3000', 'Ocho',    'Enginos',         'L', 'rare',     700, { cc: 3000, cyl: 8 }, 'sounds like weather anyway');
  add('block', 'B-L3 4200', 'Tempesta','Enginos',         'L', 'legendary',1600,{ cc: 4200, cyl: 12 },'the twelve. THE twelve.');

  // ---- CRANKSHAFTS (must match bay size; forged = revs + reliability) ----
  add('crank', 'CR-S',   'Girar',   'Motores Granada', 'S', 'common',  40, {}, 'spins fine');
  add('crank', 'CR-M',   'Eje',     'Norte Motori',    'M', 'common',  70, {}, 'standard journal');
  add('crank', 'CR-L',   'Grande',  'Enginos',         'L', 'solid',  120, {}, 'heavy metal');
  add('crank', 'CR-M F', 'Forjado', 'Basil Werk',      'M', 'rare',   160, { forged: true }, 'forged. probably.');
  add('crank', 'CR-L F', 'Martillo','Enginos',         'L', 'rare',   260, { forged: true }, 'forged for the majors');

  // ---- PISTON SETS (match bay size AND cylinder count) ----
  add('pistons', 'PS-S2',   'Par',      'Motores Granada', 'S', 'common',  36, { cyl: 2 }, 'a pair');
  add('pistons', 'PS-S3',   'Trio',     'XB78 Corps',      'S', 'common',  48, { cyl: 3 }, 'three of them');
  add('pistons', 'PS-M4',   'Cuatro',   'Norte Motori',    'M', 'common',  80, { cyl: 4 }, 'the working four');
  add('pistons', 'PS-L6',   'Seisset',  'Enginos',         'L', 'solid',  140, { cyl: 6 }, 'balanced set');
  add('pistons', 'PS-L8',   'Ochoset',  'Enginos',         'L', 'solid',  190, { cyl: 8 }, 'v8 slugs');
  add('pistons', 'PS-L12',  'Docena',   'Enginos',         'L', 'rare',   420, { cyl: 12 },'a dozen, matched');
  add('pistons', 'PS-M4 F', 'Fuerte',   'Basil Werk',      'M', 'rare',   170, { cyl: 4, forged: true }, 'trash or treasure');
  add('pistons', 'PS-L8 F', 'Tormenta', 'Enginos',         'L', 'rare',   320, { cyl: 8, forged: true }, 'storm slugs');

  // ---- CAMSHAFTS (grind: C1 comfort · S2 street · R3 race · R4 wild) ----
  add('cam', 'CAM-S C1', 'Suave',    'Motores Granada', 'S', 'common',  30, { grind: 1 }, 'purrs');
  add('cam', 'CAM-S S2', 'Calle',    'Norte Motori',    'S', 'common',  45, { grind: 2 }, 'street grind');
  add('cam', 'CAM-S R3', 'Pista',    'Basil Werk',      'S', 'solid',   90, { grind: 3 }, 'lumpy idle');
  add('cam', 'CAM-M C1', 'Turista',  'Norte Motori',    'M', 'common',  40, { grind: 1 }, 'grocery getter');
  add('cam', 'CAM-M S2', 'Strada',   'Norte Motori',    'M', 'common',  60, { grind: 2 }, 'daily racer');
  add('cam', 'CAM-M R3', 'Corsa',    'Enginos',         'M', 'solid',  130, { grind: 3 }, 'the club grind');
  add('cam', 'CAM-M R4', 'Loco',     'Basil Werk',      'M', 'rare',   210, { grind: 4 }, 'barely idles');
  add('cam', 'CAM-L S2', 'Crucero',  'Norte Motori',    'L', 'solid',  100, { grind: 2 }, 'big and calm');
  add('cam', 'CAM-L R3', 'Saeta',    'Enginos',         'L', 'rare',   240, { grind: 3 }, 'the fast grind');
  add('cam', 'CAM-L R4', 'Demonio',  'Enginos',         'L', 'rare',   300, { grind: 4 }, 'VCRA is watching');

  // ---- CYLINDER HEADS (flow grade 1-3; the head sets the turbo flange) ----
  add('head', 'HD-S1', 'Tapa',     'Motores Granada', 'S', 'common',  60, { flow: 1, flange: 'S' }, 'keeps the rain out');
  add('head', 'HD-S2', 'Respira',  'XB78 Corps',      'S', 'solid',  120, { flow: 2, flange: 'S' }, 'breathes a bit');
  add('head', 'HD-M1', 'Norte 1',  'Norte Motori',    'M', 'common', 100, { flow: 1, flange: 'M' }, 'stock breathing');
  add('head', 'HD-M2', 'Norte 2',  'Norte Motori',    'M', 'solid',  190, { flow: 2, flange: 'M' }, 'ported at the factory');
  add('head', 'HD-M3', 'Viento',   'Enginos',         'M', 'rare',   340, { flow: 3, flange: 'M' }, 'flows like wind');
  add('head', 'HD-L1', 'Grande 1', 'Enginos',         'L', 'solid',  220, { flow: 1, flange: 'M' }, 'big and honest');
  add('head', 'HD-L2', 'Grande 2', 'Enginos',         'L', 'rare',   380, { flow: 2, flange: 'L' }, 'race-ported');
  add('head', 'HD-L3', 'Huracán',  'Enginos',         'L', 'rare',   520, { flow: 3, flange: 'L' }, 'the hurricane head');

  // ---- TURBOCHARGERS (class 1-4; flange must match the head) ----
  add('turbo', 'T1-S', 'Soplete',    'Basil Werk',   'S', 'solid',    150, { cls: 1, flange: 'S' }, 'little blower');
  add('turbo', 'T2-M', 'Viento Dos', 'Norte Motori', 'M', 'solid',    260, { cls: 2, flange: 'M' }, 'the sensible spool');
  add('turbo', 'T3-M', 'Ciclón',     'Enginos',      'M', 'rare',     430, { cls: 3, flange: 'M' }, 'cyclone-rated');
  add('turbo', 'T4-L', 'La Tormenta','Enginos',      'L', 'legendary',780, { cls: 4, flange: 'L' }, 'hear it three corners away');

  // ---- hardware the bench consumes (into the Consumables aisle) ----
  function addCons(code, nick, price, extra, note) {
    const id = ('eng2-cons-' + code).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const p = Object.assign({ id, fam: 'Consumables', atom: true, kind: extra.kind, code,
      size: extra.size || null, brand: 'XB78 Corps', rarity: 'common', price,
      name: code + ' ' + nick, stats: {}, note: note || '' }, extra);
    atoms.push(p); window.PARTS.push(p); return p;
  }
  addCons('VM8×24', 'bolt box (12)', 10, { kind: 'bolts' }, 'one build = one box');
  addCons('HG-S', 'head gasket', 8,  { kind: 'gasket', size: 'S' }, 'do not forget this');
  addCons('HG-M', 'head gasket', 12, { kind: 'gasket', size: 'M' }, 'do not forget this');
  addCons('HG-L', 'head gasket', 18, { kind: 'gasket', size: 'L' }, 'do not forget this');

  // ---- brand quality (Basil rolls at the dyno — trash or treasure) ----
  const BRAND_Q = { 'Enginos': 1.05, 'Norte Motori': 1.0, 'Motores Granada': 0.97, 'XB78 Corps': 0.94 };
  const q = p => p.brand === 'Basil Werk' ? (0.88 + Math.random() * 0.27) : (BRAND_Q[p.brand] ?? 1);

  // ---- the honest math (simplified, learnable, predictable) ----
  const CAM_MUL = [0, 0.92, 1.0, 1.12, 1.22];              // by grind
  const TURBO_MUL = [1, 1.25, 1.4, 1.55, 1.75];            // by class (0 = none)
  function compute(sel) {   // sel = {block, crank, pistons, cam, head, turbo?} — atom objects
    const { block, crank, pistons, cam, head, turbo } = sel;
    let quality = q(block) * q(crank) * q(pistons) * q(cam) * q(head) * (turbo ? q(turbo) : 1);
    if (crank.forged) quality *= 1.04;
    if (pistons.forged) quality *= 1.05;
    const vp = Math.round(block.cc * 0.055 * CAM_MUL[cam.grind] * (1 + head.flow * 0.05)
                          * TURBO_MUL[turbo ? turbo.cls : 0] * quality);
    const mass = Math.round(block.cc * 0.034 + 14 + (turbo ? 8 + turbo.cls * 4 : 0));
    const heat = +(2 + (turbo ? turbo.cls * 1.5 : 0) + (cam.grind === 4 ? 1.6 : 0) + block.cc / 1500).toFixed(1);
    const rel = Math.max(1, Math.min(10, Math.round(9 - Math.max(0, cam.grind - 2) * 1.2
                          - (turbo ? turbo.cls * 0.5 : 0) + (crank.forged ? 0.7 : 0) + (pistons.forged ? 0.7 : 0))));
    const designation = block.size + Math.round(block.cc / 100) + (turbo ? 'T' : '');
    return { vp, mass, heat, rel, designation };
  }

  // fitment: size is LAW. Returns null if it fits, else the complaint.
  function fitError(kind, part, sel) {
    const b = sel.block;
    if (kind !== 'block' && !b) return 'the block goes on first';
    if (kind === 'crank'   && part.size !== b.size) return part.code + ' will not seat in an ' + b.size + ' block';
    if (kind === 'pistons' && (part.size !== b.size || part.cyl !== b.cyl)) return b.code + ' needs a ' + b.size + '-set of ' + b.cyl;
    if (kind === 'cam'     && part.size !== b.size) return 'cam journals are ' + part.size + ' — block is ' + b.size;
    if (kind === 'head'    && part.size !== b.size) return part.code + ' does not cover an ' + b.size + ' deck';
    if (kind === 'gasket'  && part.size !== b.size) return 'wrong gasket — needs HG-' + b.size;
    if (kind === 'turbo') {
      if (!sel.head) return 'no head, nowhere to bolt a turbo';
      if (part.flange !== sel.head.flange) return part.code + ' flange is ' + part.flange + ' — head takes ' + sel.head.flange;
    }
    return null;
  }

  // ---- builds ----
  const builds = () => JSON.parse(localStorage.getItem('vc_builds') || '[]');
  const saveBuilds = a => localStorage.setItem('vc_builds', JSON.stringify(a));

  // ---- THE STANDARDIZATION ACT: retire legacy engines, refund, keep relics ----
  function migrate() {
    const inv = JSON.parse(localStorage.getItem('vc_inv') || '{}');
    const relics = JSON.parse(localStorage.getItem('vc_legacy') || '[]');
    let refund = 0, moved = 0;
    for (const p of window.PARTS) {
      if (!p.legacy || !inv[p.id]) continue;
      refund += p.price * inv[p.id];
      for (let i = 0; i < inv[p.id]; i++) relics.push({ name: p.name, brand: p.brand, rarity: p.rarity });
      moved += inv[p.id];
      delete inv[p.id];
    }
    if (!moved) return;
    // retired engines come off every kart (they're museum pieces now)
    const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
    for (const k of liv) if (k.parts && k.parts.Engine && !window.PARTS.some(p => p.id === k.parts.Engine && !p.legacy))
      k.parts.Engine = null;
    localStorage.setItem('vc_livery', JSON.stringify(liv));
    // refund + a starter kit so the first bench trip can happen
    inv['eng2-cons-vm8-24'] = (inv['eng2-cons-vm8-24'] || 0) + 1;
    inv['eng2-cons-hg-m'] = (inv['eng2-cons-hg-m'] || 0) + 1;
    localStorage.setItem('vc_inv', JSON.stringify(inv));
    localStorage.setItem('vc_legacy', JSON.stringify(relics));
    localStorage.setItem('vc_money', String(+(localStorage.getItem('vc_money') || 600) + refund));
    localStorage.setItem('vc_act_toast', String(refund));   // garage shows the Act notice
  }
  migrate();

  return { atoms, compute, fitError, builds, saveBuilds,
           binCap: p => p.fam === 'Consumables' ? 24 : p.size === 'L' ? 1 : p.size === 'M' ? 4 : 8 };
})();
