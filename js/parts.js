// VALCORSA — The Parts Catalogue. Every single part. Every single one.
// Deliberately giant and confusing-ish, but it makes sense to engineers:
// brands have personalities, spec codes mean things, prices follow rarity.
// Parts are collection + future sim fuel (the Engineer Garage arrives later).
'use strict';

window.PARTS = (() => {
  const P = [];
  const h = s => { let x = 7; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
  const v = (s, lo, hi) => lo + (h(s) % 1000) / 1000 * (hi - lo);   // deterministic variance
  const R = { common: 1, solid: 2.6, rare: 6.5, legendary: 18 };

  function add(fam, brand, name, rarity, basePrice, stats, note) {
    const id = (fam + '-' + brand + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    P.push({ id, fam, brand, name, rarity,
             price: Math.round(basePrice * R[rarity] * v(id, 0.85, 1.2) / 5) * 5,
             stats, note: note || '' });
  }

  // ---- ENGINES (the heart) ----
  const EB = ['Enginos', 'Norte Motori', 'XB78 Corps', 'Basil Werk', 'Motores Granada'];
  const ES = [
    ['P2 "Poni"',        'common',    28, 'a lawnmower with dreams'],
    ['I3 Sputter',       'common',    36, 'three cylinders, two work'],
    ['I4 Strada',        'common',    50, 'the honest one'],
    ['V6 Corsa',         'solid',     64, 'club racing standard'],
    ['V8 Cavallo',       'solid',     80, 'the poster on every kid’s wall'],
    ['V12 Tempesta',     'rare',      96, 'sounds like weather'],
    ['RTX Rotary',       'rare',      88, 'spins. just spins.'],
    ['E-Volt',           'legendary', 92, 'silent. terrifying.'],
  ];
  for (const b of EB) for (const [name, rar, pow, note] of ES)
    add('Engine', b, name, rar, 60, {
      power: Math.round(pow * v(b + name, 0.9, 1.12)),
      weight: Math.round(pow * v(name + b, 0.7, 1.1)),
      heat: Math.round(v(b + name + 'h', 2, 9)),
      reliability: Math.round(v(name + b + 'r', 4, 10)),
    }, note);
  // THE STANDARDIZATION ACT (DESIGN §6.6): pre-standard engines are retired.
  // They stay in PARTS so prices/refunds resolve, but the store won't sell them,
  // packs won't pull them, and karts can't run them. Real engines: js/enginecat.js.
  for (const p of P) p.legacy = true;   // everything added so far = the old engines

  // THE ONE EXCEPTION: a sealed post-standard factory unit, VCRA type-approved
  // under protest. No serviceable parts inside. Do not open. (It is a voice.)
  add('Engine', 'Xanboo78MotorCorps', 'The Vocalmotor', 'legendary', 260,
      { power: 96, weight: 44, heat: 5, reliability: 8, loudness: 11 }, 'sealed at the factory. inside: a voice.');

  // ---- TIRES ----
  const TB = ['Valgrip', 'Södergummi', 'El Pulpo'];
  // wet/dirt columns mirror the REAL weather physics (only /wet/ names claw back
  // rain, only /knobby|gravel/ names claw back dirt — the sheet never lies)
  const TS = [
    ['Racing Soft',   'solid',   9, 3, 2, 2, 'grip now, regret later'],
    ['Racing Medium', 'common',  7, 5, 3, 2, 'the sensible shoe'],
    ['Racing Hard',   'common',  5, 9, 3, 2, 'outlives empires'],
    ['Rally Knobby',  'solid',   6, 7, 3, 8, 'eats gravel for breakfast'],
    ['Wet Tread',     'solid',   6, 6, 9, 2, 'southern weather insurance'],
    ['Gravel Slinger','common',  5, 6, 2, 8, 'leaves a mess'],
    ['Drift Special', 'rare',    8, 2, 2, 3, 'sideways is a lifestyle'],
    ['Wooden Wagon',  'common',  1, 10, 1, 3, 'technically a tire'],
    ['Beach Ball',    'rare',    2, 1, 1, 1, 'VCRA reviewing legality'],
  ];
  for (const b of TB) for (const [name, rar, grip, wear, wet, dirt, note] of TS)
    add('Tires', b, name, rar, 25, { grip, wear, wet, dirt, weight: Math.round(v(b + name, 4, 11)) }, note);

  // ---- GEARBOXES ----
  const GB = ['ChanesDrive', 'Basil Werk', 'XB78 Corps'];
  const GS = [
    ['3-Speed Manual', 'common', 'three friends'], ['4-Speed Manual', 'common', 'four friends'],
    ['5-Speed Close', 'solid', 'tight ratios, tight cornering'],
    ['6-Speed Race', 'solid', 'the club standard'],
    ['CVT Rubber Band', 'common', 'mooooooooo'],
    ['Sequential Six', 'rare', 'bang bang bang'],
    ['Single-Speed "Yolo"', 'rare', 'one gear. commit.'],
  ];
  for (const b of GB) for (const [name, rar, note] of GS)
    add('Gearbox', b, name, rar, 35, {
      shift: Math.round(v(b + name, 3, 10)), weight: Math.round(v(name + b, 5, 14)) }, note);

  // ---- BRAKES ----
  for (const b of ['Valgrip', 'Basil Werk', 'Norte Motori'])
    for (const [name, rar, note] of [
      ['Drum Brakes', 'common', 'they participate'], ['Disc Brakes', 'common', 'they work'],
      ['Vented Discs', 'solid', 'they work repeatedly'],
      ['Ceramic Race Discs', 'rare', 'they work angrily'],
      ['The Anchor', 'rare', 'a literal anchor'],
    ])
      add('Brakes', b, name, rar, 22, { stop: Math.round(v(b + name, 3, 10)), bite: Math.round(v(name + b + 'bi', 2, 10)), fade: Math.round(v(b + name + 'fa', 2, 9)), weight: Math.round(v(name, 3, 12)), reliability: Math.round(v(name + 'rel', 4, 10)) }, note);

  // ---- AERO ----
  for (const b of ['Enginos Aero', 'XB78 Corps', 'Papel S.A.'])
    for (const [name, rar, note] of [
      ['Ducktail', 'common', 'subtle'], ['Splitter', 'common', 'scrapes on everything'],
      ['GT Wing', 'solid', 'the poser classic'], ['Diffuser', 'solid', 'invisible speed'],
      ['Big Boy Wing', 'rare', 'visible speed'],
      ['Drag Parachute', 'rare', 'stops you. once.'],
      ['Umbrella Mount', 'common', 'aero AND dry'],
    ])
      add('Aero', b, name, rar, 20, { downforce: Math.round(v(b + name, 1, 9)), drag: Math.round(v(name + b, 1, 8)), weight: Math.round(v(b + name + 'w', 1, 8)), balance: Math.round(v(name + b + 'ba', 3, 9)), style: Math.round(v(b + name + 'st', 1, 10)) }, note);

  // ---- ELECTRICAL ----
  for (const [name, rar, note] of [
    ['Push Button', 'common', 'wires to anything'], ['Toggle Switch', 'common', 'satisfying click'],
    ['Kill Switch', 'solid', 'the big red one'], ['Headlights', 'common', 'see the wall first'],
    ['Brake Light', 'common', 'courtesy'], ['Horn', 'common', 'beep'],
    ['LOUDER Horn', 'solid', 'BEEP'], ['Speedometer', 'common', 'the only honest gauge'],
    ['Tachometer', 'common', 'the angry gauge'], ['Temp Gauge', 'common', 'the worried gauge'],
    ['Fuel Gauge', 'common', 'the liar'], ['Wiring Loom S', 'common', '2m of wire'],
    ['Wiring Loom M', 'common', '5m of wire'], ['Wiring Loom L', 'solid', '12m of wire'],
    ['Battery 12V', 'common', 'standard sparks'], ['Battery HD', 'solid', 'chunky sparks'],
    ['AM Radio', 'solid', 'rally house, always'], ['Taunt Speaker', 'rare', 'plays your anthem at rivals'],
  ]) add('Electrical', 'Voltcorsa', name, rar, 12, { draw: Math.round(v(name, 1, 6)) }, note);

  // ---- FLUID ----
  for (const [name, rar, note] of [
    ['Radiator S', 'common', 'cools politely'], ['Radiator M', 'common', 'cools properly'],
    ['Radiator XL', 'solid', 'cools aggressively'], ['Coolant 2L', 'common', 'the green juice'],
    ['Coolant Racing 2L', 'solid', 'the greener juice'], ['Fuel Tank 20L', 'common', 'sprint size'],
    ['Fuel Tank 45L', 'common', 'club size'], ['Fuel Tank 90L', 'solid', 'Heiligen size'],
    ['Fuel Line Kit', 'common', 'the important spaghetti'], ['Braided Fuel Lines', 'solid', 'fancy spaghetti'],
    ['Oil 4L', 'common', 'engine coffee'], ['Racing Oil 4L', 'solid', 'engine espresso'],
  ]) add('Fluid', 'Fluidos GC', name, rar, 14, { size: Math.round(v(name, 1, 9)) }, note);

  // ---- CHASSIS (bought via ChanesChassis cards) ----
  // stats come from the real spec sheets in carfactory.js (CHASSIS_STATS) — the
  // store card shows exactly what the physics reads
  for (const [name, rar, note, chId] of [
    ['Enginos GT', 'solid', 'the marque', 'gt'], ['Houndsborough Iron', 'solid', 'northern steel', 'muscle'],
    ['Heiligen Strada', 'solid', 'coast-road bones', 'rally'], ['Enginos Volante F', 'rare', 'the flyer', 'formula'],
    ['Norte Titan', 'solid', 'heavy is a feature', 'truck'], ['Granada Sprint Kart', 'common', 'the starter dream', 'kart'],
    ['Perro Moto', 'common', 'barks at corners', 'bike'],
    ['F1 Monoposto', 'legendary', 'the pinnacle', 'monoposto'],
    ['Heiligen Endurance Frame', 'legendary', 'built for October', 'endurance'],
    ['Barrel Kart', 'rare', 'it’s a barrel', 'barrel'],
    ['Twin-Engine Longframe', 'legendary', 'why', 'longframe'],
    ['The Sofa', 'rare', 'comfort-first engineering', 'sofa'],
  ]) add('Chassis', 'ChanesChassis', name, rar, 90,
         (window.CHASSIS_STATS && CHASSIS_STATS[chId]) ? { ...CHASSIS_STATS[chId] } : { weight: Math.round(v(name, 40, 120)) }, note);

  // ---- CONSUMABLES (the floor of the whole economy) ----
  for (const [name, note] of [
    ['Bolts M4 (box of 40)', 'small but mighty'], ['Bolts M6 (box of 30)', 'the workhorse'],
    ['Bolts M8 (box of 20)', 'serious business'], ['Bolts M10 (box of 12)', 'engine-grade'],
    ['Bolts M12 (box of 8)', 'chassis-grade'], ['Washers Small (box of 60)', 'you WILL run out'],
    ['Washers Large (box of 40)', 'you will ALSO run out'], ['Solder Spool', 'the shiny string'],
    ['Duct Tape Roll', 'the fast fix tier'], ['Zip Ties (bag of 50)', 'motorsport jewelry'],
    ['Wood Screws (box of 30)', 'for wooden wagon owners'], ['Cotter Pins (box of 25)', 'the forgotten heroes'],
  ]) add('Consumables', 'Ferreteria V', name, 'common', 4, { count: 1 }, note);

  // ---- SILLY (free, per canon) ----
  for (const [name, note] of [
    ['Rubber Duck', 'morale officer'], ['Fuzzy Dice', 'aerodynamically neutral'],
    ['Garden Gnome', 'watches the apex'], ['Air Freshener (Pine)', 'smells like victory'],
    ['Checkered Flag (small)', 'manifesting'], ['Plastic Crown', 'confidence'],
    ['Sticker: FAST', 'adds 0 hp, feels like 20'], ['Cardboard Spoiler', 'believes in itself'],
    ['Bobblehead: El Santo', 'nods at your mistakes'],
  ]) { add('Silly', 'Mercado Libre', name, 'common', 0, {}, note); P[P.length - 1].price = 0; }

  return P;
})();

window.PART_FAMILIES = ['Engine', 'Tires', 'Gearbox', 'Brakes', 'Aero', 'Electrical', 'Fluid', 'Chassis', 'Consumables', 'Silly'];
window.RARITY_META = {
  common:    { label: 'COMMON',    color: '#2b2119' },
  solid:     { label: 'SOLID',     color: '#1e5741' },
  rare:      { label: 'RARE',      color: '#c99a2e' },
  legendary: { label: 'LEGENDARY', color: '#c73a2c' },
};
