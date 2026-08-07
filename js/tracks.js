// Valcorsa — venue definitions. First playable roster.
// Each track: name, desc, mode (discipline badge), width (half-width is width/2),
// surface, env theme, points: [x, z, y?] control points of the centerline (travel order).
// Closed loops unless stage:true (point-to-point, start beam -> finish beam).

function ovalPoints(halfLength, halfWidth, cornerR, ptsPerCorner) {
  // Rounded rectangle, driven counter-clockwise (like Indy).
  const pts = [];
  const cx = halfLength - cornerR, cz = halfWidth - cornerR;
  const corners = [
    { x: cx, z: cz, a0: 0 },            // corner centers + start angle
    { x: -cx, z: cz, a0: Math.PI / 2 },
    { x: -cx, z: -cz, a0: Math.PI },
    { x: cx, z: -cz, a0: 3 * Math.PI / 2 },
  ];
  for (const c of corners) {
    for (let i = 0; i <= ptsPerCorner; i++) {
      const a = c.a0 + (i / ptsPerCorner) * (Math.PI / 2);
      pts.push([c.x + cornerR * Math.cos(a), c.z + cornerR * Math.sin(a)]);
    }
  }
  return pts;
}

const TRACKS = [
  {
    // HERO 1 of the 40 — designed with Adam in 25 questions (TRACKS-QA.md).
    // The capital's clip cathedral: opening night of every season lives here.
    id: 'dreipuentes',
    name: 'Circuito Drei Puentes',
    mode: 'SMASHKART',
    desc: 'THE SHOW. Opening night, every season. Fly La Voladora, surf the neon canyon, cross all three bridges, and pick your deck in the Coliseo — the fork never deals the same surfaces twice.',
    width: 30,
    hills: 0,
    surface: 'asphalt',
    env: 'city',
    laps: 3,
    walls: true,
    night: true,                                    // always The Show After Dark (floodlit bright)
    dress: true,
    // the Coliseo fork: lanes rotate surfaces every lap — L1 asphalt+dirt, L2 dirt+wet, L3 wet+asphalt
    laneZones: [[0.58, 0.71]],
    laneRotate: [['asphalt', 'dirt'], ['dirt', 'wet'], ['wet', 'asphalt']],
    tunnel: [0.73, 0.82],                           // the exit tunnel dives UNDER the river
    points: [
      // start/finish: Avenida de la Fundación
      [0, 0, 0], [120, 4, 0], [230, 2, 0],
      // LA VOLADORA — the ramp over the main grandstand, airborne every lap
      [310, -4, 5], [380, -14, 16], [462, -34, 3],
      // dive south into THE NEON CANYON (Kesselgasse — the loudest street in the nation)
      [512, -96, 1], [498, -176, 0], [556, -244, 0], [500, -314, 0], [558, -386, 0], [516, -462, 0],
      // south-west sweep to the river
      [430, -540, 0], [300, -566, 0],
      // PUENTE UNO (north bank -> south bank)
      [225, -604, 3], [182, -662, 7], [140, -724, 3],
      // south bank boulevard
      [48, -764, 0], [-76, -744, 0],
      // PUENTE DOS (south -> north)
      [-136, -700, 6], [-178, -640, 8], [-222, -582, 3],
      // north bank, Altstadt side
      [-336, -560, 1], [-452, -588, 0],
      // PUENTE DREI (north -> south, the old one)
      [-498, -646, 5], [-520, -704, 7], [-540, -762, 3],
      // approach EL COLISEO
      [-566, -866, 0],
      // THE COLISEO — the bowl; the fork runs through here (divider island + rotating lanes)
      [-518, -952, 0], [-450, -1030, 0], [-472, -1128, 1], [-576, -1176, 1], [-688, -1128, 0], [-700, -1016, 0],
      // exit chute
      [-646, -924, -1],
      // THE EXIT TUNNEL — under the river, back to the north bank
      [-600, -800, -4], [-560, -680, -5], [-520, -556, -3],
      // resurface + the long TV sweep home
      [-472, -420, 0], [-380, -280, 0], [-250, -150, 0], [-110, -50, 0],
    ],
  },
  {
    // ARENA 1 — the Bullring. A walled disc (fat circle: width > radius = full floor).
    // Native game: DEMO DERBY — last kart rolling. The rotating playlist starts here.
    id: 'bullring',
    name: 'La Plaza de Granada',
    mode: 'ARENA',
    arena: 'derby',
    desc: 'The Bullring. No laps, no lines, no mercy — twelve karts walk in, one drives out. The south\'s favorite Sunday.',
    width: 116,
    hills: 0,
    surface: 'asphalt',
    env: 'desert',
    laps: 99,
    walls: true,
    points: (() => { const p = []; for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2; p.push([Math.cos(a) * 60, Math.sin(a) * 60, 0]); } return p; })(),
  },
  {
    id: 'perrosaltarin',
    name: 'Cañón del Perro Saltarín',
    mode: 'SMASHKART',
    desc: 'Jumping Dog Canyon. Tarmac out, gravel back, chaos everywhere. (Items arrive in a future update. The canyon is already unfair.)',
    width: 32,
    hills: 0.9,
    surface: 'asphalt',
    env: 'desert',
    laps: 3,
    surfaceZones: [[0.42, 0.78, 'dirt']],          // the gravel back section
    points: [
      [0, 0, 0], [180, -30, 2], [330, -80, 6], [430, -180, 10],
      [460, -300, 8], [400, -400, 12], [280, -430, 9],
      [160, -390, 14], [80, -300, 10],                            // canyon climb (tarmac)
      [20, -200, 16], [-80, -160, 20], [-180, -200, 17],          // onto the gravel
      [-260, -280, 22], [-360, -260, 18], [-420, -170, 24],       // gravel switchbacks
      [-440, -60, 20], [-380, 30, 25], [-280, 60, 21],
      [-200, 140, 16], [-100, 170, 11],                           // gravel crest run
      [-20, 130, 6], [-40, 40, 2],
    ],
  },
  {
    id: 'houndsborough',
    name: 'Ft. Houndsborough GP',
    mode: 'F1',
    desc: 'The big city takes racing seriously. Armco, a tunnel, 42m of climb. The locals here are killers.',
    width: 18,
    hills: 0,
    surface: 'asphalt',
    env: 'city',
    laps: 3,
    walls: true,
    tunnel: [0.545, 0.655],                       // fraction of lap under the tunnel roof
    points: [
      [0, 0, 0], [90, -18, 1],
      [150, -30, 2], [175, -18, 3],
      [200, 40, 8], [225, 105, 14], [250, 170, 20],             // the Fort climb
      [268, 215, 25], [255, 250, 28],
      [275, 285, 31], [305, 290, 32],                           // Garrison Square
      [330, 275, 30], [345, 245, 27],
      [352, 210, 22], [335, 190, 19],
      [322, 168, 15], [305, 158, 13], [298, 172, 13],           // the Kennel hairpin
      [310, 145, 11], [325, 120, 9],
      [345, 100, 5], [368, 95, 4],
      [420, 88, 3], [470, 95, 2], [520, 118, 1], [560, 150, 0], // THE TUNNEL (under the old fort)
      [585, 195, -1],
      [590, 240, -1], [578, 258, -1], [590, 275, -1],           // harbour chicane
      [585, 320, 0], [565, 345, 0],
      [520, 370, 0], [480, 362, 0],
      [440, 372, 0], [405, 358, 0],                             // docklands esses
      [360, 342, 0], [330, 320, 0],
      [295, 315, 0], [278, 330, 1],
      [250, 330, 1], [225, 312, 1],
      [160, 285, 1], [80, 230, 1], [20, 120, 0], [0, 45, 0],
    ],
  },
  {
    id: 'granada',
    name: 'Granada Town Sprint',
    mode: 'SPEEDKART',
    desc: 'Small southern town, big Sunday tradition. Fast, tight, zero patience. Blink and you\'re in a fruit stand.',
    width: 22,
    hills: 0.25,
    surface: 'asphalt',
    env: 'countryside',
    laps: 4,
    points: [
      [0, 0, 0], [150, -20, 1], [280, -70, 3], [340, -170, 2],
      [310, -270, 5], [200, -310, 3], [90, -280, 6],              // plaza loop
      [30, -190, 4], [-70, -160, 7], [-170, -200, 5],
      [-260, -150, 8], [-280, -50, 6], [-220, 30, 4],             // the market esses
      [-260, 120, 7], [-190, 190, 5], [-80, 200, 3],
      [10, 160, 2], [60, 90, 1],                                  // chapel chicane home
    ],
  },
  {
    // FORGE 1 of 32 — 10-Q session (TRACKS-QA.md). The rally school.
    id: 'hennenhof',
    name: 'Hennenhof',
    mode: 'RALLY',
    desc: '"Where the kids learn." All gravel: five switchbacks up the Ladder, straight through the barn (the chickens are fine), kind as a grandmother — except Der Biss.',
    width: 26,
    hills: 0.5,
    surface: 'dirt',
    env: 'forest',
    laps: 1,
    stage: true,
    points: [
      // valley run-out (confidence first)
      [0, 0, 0], [140, -10, 3], [260, 10, 8], [360, -20, 14],
      // THE LADDER — five switchbacks stacked up the face
      [440, 10, 20], [380, 60, 26], [470, 100, 32], [400, 150, 38], [490, 190, 44],
      [430, 240, 50],
      // ridge shoulder
      [520, 300, 54], [610, 290, 52],
      // THE BARN CHICANE (through the Hennenhof barn — doors open both ends)
      [680, 330, 50], [720, 310, 49], [760, 340, 48],
      // high meadow sweep
      [850, 330, 44], [930, 370, 38],
      // DER BISS — the downhill tightener that ends first rallies
      [990, 320, 32], [1000, 250, 26], [950, 210, 22],
      // the descent home, east side
      [1010, 140, 16], [980, 50, 10], [890, 0, 6], [770, -30, 3], [650, 0, 1], [540, -30, 0],
    ],
  },
  {
    id: 'heiligenstage',
    name: 'Heiligen Stage — North Coast',
    mode: 'RALLY',
    desc: 'A taste of October. Point to point through the pines. Three splits, one record, no second lap to fix it.',
    width: 22,
    hills: 1.15,
    surface: 'dirt',
    env: 'forest',
    laps: 1,
    stage: true,                                    // open curve: start beam -> finish beam
    points: [
      [0, 0, 0], [130, -20, 4], [250, -60, 9], [350, -140, 6],
      [420, -250, 13], [380, -370, 9], [280, -430, 15],
      [180, -520, 11], [220, -640, 17], [340, -690, 13],          // split 1
      [470, -660, 19], [560, -570, 15], [580, -450, 21],
      [660, -370, 17], [780, -390, 23], [870, -320, 19],          // ridge crest (air)
      [900, -200, 25], [840, -100, 21], [880, 10, 27],            // split 2
      [960, 90, 23], [1080, 80, 28], [1170, 150, 24],
      [1200, 270, 30], [1130, 370, 26], [1180, 480, 31],          // split 3
      [1280, 540, 27], [1400, 520, 32], [1500, 580, 29],
      [1540, 700, 33], [1620, 780, 30],                           // flying finish
    ],
  },
  {
    id: 'bahialluvia',
    name: 'Bahía Lluvia Speedway',
    mode: 'CIRCUIT',
    desc: 'Flat, wet, and furious. The south\'s bullring — the draft is a weapon and the leader is always defending.',
    width: 26,
    hills: 0.1,
    surface: 'asphalt',
    env: 'oval',
    laps: 8,
    points: ovalPoints(400, 175, 125, 6),
  },
  {
    id: 'sanvolante',
    name: 'San Volante — The Pentathlon',
    mode: 'FINALE',
    desc: 'The holy city\'s answer to everything: five disciplines, one track, one car. Two laps. Whoever comes out top, comes out top.',
    width: 34,
    hills: 0.8,
    surface: 'asphalt',
    env: 'city',
    laps: 2,
    surfaceZones: [[0.52, 0.74, 'dirt']],          // Sector IV: the rally leg
    points: [
      // Sector I — SMASHKART: wide swooping crests, air off the shrine hill
      [0, 0, 0], [150, -20, 2], [300, -90, 7], [420, -40, 12],
      [540, -110, 5], [660, -50, 9],
      // Sector II — SPEEDKART: the Flat-Out Mile, slight kinks, no lifting
      [820, -80, 3], [980, -60, 0], [1140, -120, 0], [1280, -220, 0],
      [1360, -360, 0],
      // Sector III — CIRCUIT: the great bowl, one huge drafting arc
      [1400, -520, 0], [1360, -680, 0], [1240, -780, 0], [1080, -800, 0],
      [940, -740, 0],
      // Sector IV — RALLY: dirt switchbacks climbing the old pilgrim road
      [800, -780, 6], [680, -700, 12], [560, -760, 18], [440, -680, 10],
      [360, -760, 16], [240, -700, 22], [140, -600, 14], [60, -660, 20],
      [-60, -560, 12],
      // Sector V — F1: precision chicanes descending to the Saint's straight
      [-160, -460, 6], [-120, -360, 3], [-200, -280, 2], [-140, -200, 1],
      [-220, -120, 0], [-150, -60, 0], [-70, -80, 0], [-90, 10, 0],
    ],
  },
];
