// VALCORSA — the economy (DESIGN.md §6.5): money (₡ Corsas), the Parts Store,
// PartsPacks from four sponsors, chassis cards, inventory. Winnings come from
// racing; consumables are the floor; the catalogue is the ocean.
'use strict';

window.ECON = (() => {
  const $$ = id => document.getElementById(id);
  const money = () => +(localStorage.getItem('vc_money') ?? 600);
  const setMoney = n => { localStorage.setItem('vc_money', Math.max(0, Math.round(n))); refreshBalance(); };
  const inv = () => JSON.parse(localStorage.getItem('vc_inv') || '{}');
  const setInv = o => localStorage.setItem('vc_inv', JSON.stringify(o));
  const cards = () => JSON.parse(localStorage.getItem('vc_cards') || '{}');
  const setCards = o => localStorage.setItem('vc_cards', JSON.stringify(o));
  const give = (id, n = 1) => { const o = inv(); o[id] = (o[id] || 0) + n; setInv(o); };

  const SPONSORS = [
    { id: 'valcorsa', name: 'Valcorsa',           cost: 400, pulls: 5, tag: 'expensive · very high reward',
      odds: { common: 15, solid: 45, rare: 32, legendary: 8 } },
    { id: 'xb78',     name: 'Xanboo78MotorCorps', cost: 80,  pulls: 6, tag: 'cheap · high yield',
      odds: { common: 70, solid: 25, rare: 4.7, legendary: 0.3 } },
    { id: 'basil',    name: 'BasilAxles',         cost: 200, pulls: 2, tag: 'trash or treasure',
      odds: { common: 55, solid: 15, rare: 18, legendary: 12 }, trashBias: true },
    { id: 'chanes',   name: 'ChanesChassis',      cost: 250, pulls: 3, tag: 'chassis cards inside',
      odds: { common: 10, solid: 60, rare: 25, legendary: 5 }, cardChance: 0.75 },
  ];
  const CARDS_NEEDED = 3;

  function rollRarity(odds) {
    let x = Math.random() * Object.values(odds).reduce((a, b) => a + b, 0);
    for (const [r, w] of Object.entries(odds)) { x -= w; if (x <= 0) return r; }
    return 'common';
  }
  function rollPart(sponsor) {
    if (sponsor.cardChance && Math.random() < sponsor.cardChance) {
      const chs = PARTS.filter(p => p.fam === 'Chassis');
      return { card: chs[Math.floor(Math.random() * chs.length)] };
    }
    const rar = rollRarity(sponsor.odds);
    let pool = PARTS.filter(p => !p.legacy && p.rarity === rar && p.fam !== 'Chassis');
    if (sponsor.trashBias && rar === 'common' && Math.random() < 0.6)
      pool = PARTS.filter(p => !p.legacy && p.fam === 'Consumables');
    if (!pool.length) pool = PARTS.filter(p => !p.legacy && p.rarity === 'common');
    return { part: pool[Math.floor(Math.random() * pool.length)] };
  }

  // ---- race winnings ----
  const PAYOUT = [250, 190, 150, 125, 105, 95, 85, 75, 65, 58, 52, 46];
  function racePayout(pos, laps, finished) {
    const w = finished ? (PAYOUT[pos] || 40) : laps * 25 + 15;   // DNF: laps completed pay
    setMoney(money() + w);
    return w;
  }

  // ---- UI ----
  function refreshBalance() {
    document.querySelectorAll('[data-corsas]').forEach(e => e.textContent = money());
  }

  // ---- El Banco de Valcorsa: 7 quick taps on any ₡ chip = the vault opens.
  // (Undocumented. The economy is per-device localStorage anyway — league points
  // never touch money, so the worst a leak does is fill a kid's toy garage.)
  let bancoN = 0, bancoT = 0;
  document.addEventListener('click', e => {
    if (!e.target.closest('.corsas, [data-corsas]')) return;
    const now = performance.now();
    if (now - bancoT > 3000) bancoN = 0;
    bancoT = now;
    if (++bancoN >= 7) {
      bancoN = 0;
      setMoney(9999999);
      if (window.toast) toast('EL BANCO DE VALCORSA SMILES UPON YOU · ₡9,999,999');
    }
  });

  // The store is a STOREFRONT, not a settings menu: search up top, aisles you
  // flick through, a grid of product cards with pictures and big prices.
  function shopHTML() {
    const fi = f => window.PART_ICON ? PART_ICON({ fam: f }) : '';
    return `
    <div class="panel shopPanel storeFront">
      <div id="storeHead">
        <button id="storeClose" onclick="closeShop()">✕</button>
        <b id="storeLogo">VALCORSA<span>parts</span></b>
        <input id="partSearch" placeholder="Search everything…" autocomplete="off">
        <b class="corsas">₡<span data-corsas>0</span></b>
      </div>
      <div id="aisleRow">${PART_FAMILIES.map(f =>
        `<button data-fam="${f}">${fi(f)}<span>${f}</span></button>`).join('')}</div>
      <div id="packShelf"><span class="dealTag">PARTSPACKS</span>${SPONSORS.map(s => `
        <span class="packDuo"><button class="sponsorCard" data-sponsor="${s.id}">
          <b>${s.name}</b><span>${s.tag}</span><em>₡${s.cost}</em>
        </button><button class="rip10" data-sponsor10="${s.id}">RIP ×10<em>₡${s.cost * 10}</em></button></span>`).join('')}
      </div>
      <div id="storeGrid"></div>
      <p class="setNote invHead">— YOUR SHELVES —</p>
      <div id="invList"></div>
    </div>`;
  }

  let curFam = 'Engine';
  function renderStore() {
    const q = ($$('partSearch').value || '').toLowerCase();
    const my = inv(), cd = cards();
    const list = PARTS.filter(p => !p.legacy &&
      (q ? (p.name + p.brand + p.fam).toLowerCase().includes(q) : p.fam === curFam));
    $$('storeGrid').innerHTML = list.slice(0, 80).map(p => {
      const owned = my[p.id] || 0;
      const cardN = cd[p.id] || 0;
      const locked = p.fam === 'Chassis' && cardN < CARDS_NEEDED;
      const buy = locked
        ? `<span class="cardNeed">CARDS ${cardN}/${CARDS_NEEDED}</span>`
        : `<button class="buyBtn" data-buy="${p.id}">BUY</button>`;
      return `<div class="prodCard r-${p.rarity}">
        <div class="prodImg">${window.PART_ICON ? PART_ICON(p) : ''}${owned ? `<i class="prodOwned">×${owned}</i>` : ''}</div>
        <b class="prodName">${p.name}</b>
        <small class="prodBrand">${p.brand}</small>
        <small class="prodNote">${p.note || '&nbsp;'}</small>
        <div class="prodStats">${sheetHTML(p.stats, p.fam)}</div>
        ${p.atom ? '<small class="prodNote" style="color:#ff8c1a;font-weight:700">🔧 WORKBENCH PART — assemble in the Engineer Garage</small>' : ''}
        <div class="prodBuy"><span class="prodPrice">${p.price ? '₡' + p.price : 'FREE'}</span>${buy}</div>
      </div>`;
    }).join('') || '<p class="setNote gridEmpty">Nothing here matches.</p>';
    $$('storeGrid').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyPart(b.dataset.buy));
  }
  function renderInv() {
    const my = inv(), cd = cards();
    const rows = Object.entries(my).map(([id, n]) => {
      const p = PARTS.find(x => x.id === id);
      return p ? `<span class="invChip" style="border-color:${RARITY_META[p.rarity].color}">${p.name} x${n}</span>` : '';
    }).join('');
    const cardRows = Object.entries(cd).map(([id, n]) => {
      const p = PARTS.find(x => x.id === id);
      return p ? `<span class="invChip cardChip">🃏 ${p.name} ${n}/${CARDS_NEEDED}</span>` : '';
    }).join('');
    $$('invList').innerHTML = (rows + cardRows) || '<p class="setNote">Empty shelves. Rip a pack.</p>';
  }

  function buyPart(id) {
    const p = PARTS.find(x => x.id === id);
    if (!p || money() < p.price) { toast('Not enough Corsas'); return; }
    setMoney(money() - p.price);
    give(id);
    toast('Bought: ' + p.name);
    renderStore(); renderInv();
  }

  // ---- pack opening ceremony ----
  function openPack(sponsorId, free, count = 1) {
    const s = SPONSORS.find(x => x.id === sponsorId);
    if (!free) {
      const afford = Math.floor(money() / s.cost);
      if (afford < 1) { toast('Not enough Corsas — go race!'); return; }
      count = Math.min(count, afford, 10);                 // "up to 10" means up to 10
      if (count > 1) toast('RIPPING ×' + count);
      setMoney(money() - s.cost * count);
    }
    const pulls = Array.from({ length: s.pulls * count }, () => rollPart(s));
    const ov = document.createElement('div');
    ov.id = 'packReveal';
    ov.innerHTML = `<div class="packWrap"><div class="packArt">${s.name}<span>${count > 1 ? '×' + count + ' PARTSPACKS' : 'PARTSPACK'}</span></div><div class="pullRow"></div>
      <button id="packDone" style="display:none">SWEET</button></div>`;
    document.body.appendChild(ov);
    const art = ov.querySelector('.packArt'), row = ov.querySelector('.pullRow');
    art.onclick = () => {
      art.classList.add('torn');
      setTimeout(() => {
        art.style.display = 'none';
        pulls.forEach((pull, i) => setTimeout(() => {
          const item = pull.card ? pull.card : pull.part;
          const rm = RARITY_META[item.rarity];
          const el = document.createElement('div');
          el.className = 'pullCard rar-' + item.rarity + (pull.card ? ' isCard' : '');
          el.innerHTML = pull.card
            ? `<i>🃏</i><b>${item.name}</b><small>CHASSIS CARD</small>`
            : `<b>${item.brand}</b><b>${item.name}</b><small style="color:${rm.color}">${rm.label}</small>`;
          row.appendChild(el);
          if (pull.card) { const c = cards(); c[item.id] = (c[item.id] || 0) + 1; setCards(c);
            if (c[item.id] === CARDS_NEEDED) toast('🃏 ' + item.name + ' UNLOCKED in the catalogue!'); }
          else give(item.id);
          if (item.rarity === 'legendary' || item.rarity === 'rare') {
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 350);
          }
          if (i === pulls.length - 1) $$('packDone').style.display = '';
        }, i * (count > 1 ? 70 : 420)));   // bulk rips reveal at speed
      }, 380);
    };
    $$('packDone') && ($$('packDone').onclick = null);
    ov.querySelector('#packDone').onclick = () => { ov.remove(); renderStore(); renderInv(); refreshBalance(); };
  }

  // ---- modal plumbing ----
  function ensureModal() {
    if ($$('shopModal')) return;
    const m = document.createElement('div');
    m.id = 'shopModal';
    m.innerHTML = shopHTML();
    document.body.appendChild(m);
    m.querySelectorAll('[data-sponsor]').forEach(b => b.onclick = () => openPack(b.dataset.sponsor));
    m.querySelectorAll('[data-sponsor10]').forEach(b => b.onclick = () => openPack(b.dataset.sponsor10, false, 10));
    m.querySelectorAll('[data-fam]').forEach(b => b.onclick = () => {
      curFam = b.dataset.fam;
      m.querySelectorAll('[data-fam]').forEach(x => x.classList.toggle('sel', x === b));
      renderStore();
    });
    $$('partSearch').addEventListener('input', renderStore);
    m.querySelector('[data-fam]').classList.add('sel');
  }
  window.openShop = () => { ensureModal(); $$('shopModal').style.display = 'flex'; refreshBalance(); renderStore(); renderInv(); };
  window.closeShop = () => { $$('shopModal').style.display = 'none'; };

  // ---- THE LIVERY: your stable of built karts (DESIGN.md §6.5) ----
  const LFAMS = ['Engine', 'Tires', 'Brakes', 'Aero'];
  const STOCK_STATS = { Engine: { power: 55 }, Tires: { grip: 6 }, Brakes: { stop: 6 }, Aero: { downforce: 2, drag: 3 } };
  let modsCache = null, editingId = null, draftParts = {};
  const livery = () => JSON.parse(localStorage.getItem('vc_livery') || '[]');
  const setLivery = a => { localStorage.setItem('vc_livery', JSON.stringify(a)); modsCache = null; };
  const activeId = () => localStorage.getItem('vc_activeKart');
  function setActive(id) {
    localStorage.setItem('vc_activeKart', id);
    const k = livery().find(x => x.id === id);
    if (k && typeof KIT !== 'undefined') { Object.assign(KIT, k.kit); saveKit(); }
    modsCache = null;
  }
  // one physical part can only be bolted to ONE kart at a time
  function usedElsewhere(partId, exceptKartId) {
    let n = 0;
    for (const k of livery()) if (k.id !== exceptKartId)
      for (const f of LFAMS) if (k.parts && k.parts[f] === partId) n++;
    return n;
  }
  function buildStats(id) {   // 'build:xxx' → a stamped Workbench engine (vp 40-800 → power)
    if (!id || !String(id).startsWith('build:') || !window.ENGINEMATH) return null;
    const b = ENGINEMATH.builds().find(x => 'build:' + x.id === id);
    return b ? { power: 40 + b.vp / 6, weight: b.mass } : null;   // M1 basic build ≈ stock 55
  }
  function computeMods(parts, chassisId) {
    const cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
    const st = fam => {
      const id = parts && parts[fam];
      if (fam === 'Engine') { const bs = buildStats(id); if (bs) return bs; }
      const p = id && PARTS.find(x => x.id === id);
      return p ? p.stats : STOCK_STATS[fam];
    };
    const e = st('Engine'), t = st('Tires');
    const b = STOCK_STATS.Brakes, a = STOCK_STATS.Aero;   // Engineer Garage territory — always stock here
    // the chassis spec sheet is REAL (carfactory CHASSIS_STATS): aero cuts drag,
    // weight taxes accel, agility adds a whisker of grip, tough softens crashes
    const ch = (window.CHASSIS_STATS && CHASSIS_STATS[chassisId]) || { aero: 5, weight: 5, agility: 5, tough: 5 };
    // tire personality is REAL now: Wet Tread claws back most of the rain penalty
    // (and gives a little up in the dry); knobbies do the same for dirt. Physics reads
    // PM.grip per frame, so a getter makes tires weather/surface-aware with zero main.js edits.
    const tp = (() => { const id = parts && parts.Tires; const p = id && PARTS.find(x => x.id === id); return p ? p.name : ''; })();
    const isWet = /wet/i.test(tp), isKnob = /knobby|gravel/i.test(tp);
    const dryGrip = cl(0.9 + (t.grip ?? 6) * 0.018 + (a.downforce ?? 0) * 0.004 + (ch.agility - 5) * 0.004, 0.92, 1.12);
    return {
      accel: cl(0.82 + (e.power ?? 55) / 280 - (ch.weight - 5) * 0.006, 0.9, 1.14),
      get grip() {
        const gm = (typeof WEATHER !== 'undefined' && WEATHER.gripMul) || 1;
        if (isWet) {
          if (gm < 0.985) return dryGrip * (1 + (1 - gm) * 0.75 / gm);   // rain: recover 75% of the penalty
          return dryGrip * 0.985;                                        // dry: wets give a little up
        }
        return dryGrip;
      },
      brake: cl(0.9 + (b.stop ?? 6) * 0.02, 0.92, 1.1),
      drag:  cl((1 + ((a.drag ?? 3) - 3) * 0.012) * (1 - (ch.aero - 5) * 0.008), 0.94, 1.1),
      tireWear: t.wear ?? 6,                              // damage.js: tougher tires shrug off drift wear
      dirtTire: isKnob,
      tough: ch.tough ?? 5,                               // damage.js: crash damage scales off this
    };
  }
  function mods() {   // physics reads THIS: the active livery kart's build
    if (modsCache) return modsCache;
    const act = livery().find(k => k.id === activeId());
    const m = computeMods(act ? act.parts : null, (act && act.kit && act.kit.chassis) || (typeof KIT !== 'undefined' && KIT.chassis));
    // drift assist is a physical bay unit (garage3d): pulled out = way less self-straightening
    m.stab = act && act.assistOut ? 0.25 : 1;
    return modsCache = m;
  }
  function activeEngine() {   // the active kart's Engine part id ('' = stock) — roar keys the Vocalmotor off this
    const act = livery().find(k => k.id === activeId());
    return (act && act.parts && act.parts.Engine) || '';
  }

  // ---- garage UI: doors → livery rack → the SNAP WHEEL builder (Mario Kart style) ----
  // One category at a time; the wheel scroll-locks to an option; ◀ ▶ (or a sideways
  // swipe) moves through: Chassis → Decals → Wheels → Tires → Engine → Color.
  // Brakes & Aero are Engineer Garage territory — not here.
  function renderBars(parts) {
    const st = fam => {
      const id = parts && parts[fam];
      if (fam === 'Engine') { const bs = buildStats(id); if (bs) return bs; }
      const p = id && PARTS.find(x => x.id === id);
      return p ? p.stats : STOCK_STATS[fam];
    };
    const e = st('Engine'), t = st('Tires');
    const bar = (label, v, lo2, hi) =>
      `<div class="loBar"><span>${label}</span><div><i style="width:${Math.max(4, Math.min(100, Math.round(((v - lo2) / (hi - lo2)) * 100)))}%"></i></div></div>`;
    $$('loadoutBars').innerHTML =
      bar('Power', e.power ?? 55, 20, 115) +
      bar('Grip', t.grip ?? 6, 1, 10) +
      bar('Weight', (e.weight ?? 50) + (t.weight ?? 7) * 4, 55, 165);
  }

  // ---- SPEC SHEETS: every thing shows its real numbers (max 5 per sheet).
  // Orange 'bad' bars = stats where a big bar hurts (heat, fade, drag).
  const STAT_META = {
    aero: ['AERO', 10], agility: ['AGILITY', 10], tough: ['TOUGH', 10], trunk: ['TRUNK', 10],
    power: ['POWER', 115], heat: ['HEAT', 10, 1], reliability: ['RELIABLE', 10], loudness: ['LOUD', 11],
    grip: ['GRIP', 10], wear: ['LIFE', 10, 0, x => 11 - x], wet: ['WET', 10], dirt: ['DIRT', 10],
    stop: ['STOP', 10], bite: ['BITE', 10], fade: ['FADE', 10, 1], shift: ['SHIFT', 10],
    downforce: ['DOWNFRC', 10], drag: ['DRAG', 10, 1], balance: ['BALANCE', 10], style: ['STYLE', 10],
    weight: ['WEIGHT', 10], draw: ['DRAW', 6], size: ['SIZE', 10],
  };
  const W_MAX = { Engine: 110, Tires: 12, Gearbox: 14, Brakes: 12, Aero: 8 };   // weight scales per family
  function sheetHTML(stats, fam) {
    if (!stats) return '';
    return Object.entries(stats).filter(([k]) => STAT_META[k]).slice(0, 5).map(([k, raw]) => {
      const [label, max, bad, conv] = STAT_META[k];
      const val = conv ? conv(raw) : raw;
      const mx = k === 'weight' ? (W_MAX[fam] || 10) : max;
      const w = Math.max(4, Math.min(100, Math.round(val / mx * 100)));
      return `<div class="loBar sBar${bad ? ' bad' : ''}"><span>${label}</span><div><i style="width:${w}%"></i></div><em>${val}</em></div>`;
    }).join('');
  }
  function renderItemSheet() {
    let el = $$('itemStats');
    if (!el) {
      const lb = $$('loadoutBars');
      if (!lb) return;
      el = document.createElement('div');
      el.id = 'itemStats';
      lb.parentNode.insertBefore(el, lb);
    }
    const cat = CATS[catI], cur = cat.cur();
    let stats = null, ttl = '';
    if (cat.key === 'Chassis') {
      stats = window.CHASSIS_STATS && CHASSIS_STATS[cur];
      ttl = (typeof CHASSIS_LABELS !== 'undefined' && CHASSIS_LABELS[cur]) || '';
    } else if (cat.key === 'Tires' || cat.key === 'Engine') {
      if (!cur) { stats = STOCK_STATS[cat.key]; ttl = 'Standard issue'; }
      else if (String(cur).startsWith('build:') && window.ENGINEMATH) {
        const b = ENGINEMATH.builds().find(x => 'build:' + x.id === cur);
        if (b) {
          stats = { power: Math.round(40 + b.vp / 6), weight: Math.round(b.mass ?? 40),
                    heat: Math.round(b.heat ?? 5), reliability: Math.round(b.rel ?? 7) };
          ttl = b.name;
        }
      } else {
        const p = PARTS.find(x => x.id === cur);
        if (p) { stats = p.stats; ttl = p.name; }
      }
    }
    el.innerHTML = stats ? `<p class="sHead">${ttl} · SPEC SHEET</p>` + sheetHTML(stats, cat.key) : '';
  }
  const CH_MAP = { 'Enginos GT': 'gt', 'Houndsborough Iron': 'muscle', 'Heiligen Strada': 'rally',
                   'Enginos Volante F': 'formula', 'Norte Titan': 'truck',
                   'Granada Sprint Kart': 'kart', 'Perro Moto': 'bike',
                   'F1 Monoposto': 'monoposto', 'Heiligen Endurance Frame': 'endurance',
                   'Barrel Kart': 'barrel', 'Twin-Engine Longframe': 'longframe', 'The Sofa': 'sofa',
                   'Enginos Berlina M': 'berlina', 'Enginos Bavaria GT': 'bavaria', 'Enginos Piccola 02': 'piccola',
                   'Houndsborough Duke': 'duke', 'Houndsborough Chief': 'chief',
                   'Heiligen Sturm': 'sturm', 'Heiligen Wald': 'wald',
                   'Norte Stallion GT3': 'stallion', 'Norte Potro': 'potro',
                   'Granada Garra': 'garra', 'Granada Flecha': 'flecha',
                   'Braewick Anvil': 'anvil', 'Braewick Torr': 'torr',
                   'Đồi Tám-Sáu': 'tamsau', 'Đồi Trâu': 'trau', 'Đồi Ba Bánh': 'babanh',
                   'Hilja Tähti': 'tahti', 'Hilja Lumi': 'lumi', 'Hilja Siipi': 'siipi',
                   'Shopping Kart': 'shopkart' };
  function ownedChassis() {   // you START with the Enginos GT; the rest are earned
    const my = inv(), set = new Set(['gt']);
    for (const p of PARTS)
      if (p.fam === 'Chassis' && (my[p.id] || 0) > 0 && CH_MAP[p.name]) set.add(CH_MAP[p.name]);
    return [...set];
  }
  function partOpts(fam, stockLabel) {   // owned + unbooked parts only (one kart per part)
    const my = inv();
    const opts = [{ id: '', label: stockLabel, sub: 'standard issue', color: '#8a8a8a' }];
    if (fam === 'Engine' && window.ENGINEMATH) {
      // engines are BUILT now (Standardization §6.6): the wheel lists your stamped builds
      if (!ENGINEMATH.builds().length && PARTS.some(p => p.atom && p.fam === 'Engine' && (my[p.id] || 0) > 0))
        opts.push({ id: '', label: '🔧 your engine parts are at the workbench',
                    sub: 'Engineer Garage → bench → assemble & stamp, then it lists here', color: '#8fa8e8' });
      for (const b of ENGINEMATH.builds()) {
        const bid = 'build:' + b.id;
        const free = 1 - usedElsewhere(bid, editingId);
        if (free <= 0 && draftParts.Engine !== bid) continue;
        opts.push({ id: bid, label: b.name, sub: b.designation + ' · ' + b.vp + ' vp · by ' + b.builder, color: '#ff8c1a' });
      }
      // no return: sealed factory units (non-atom, non-legacy — the Vocalmotor) list below
    }
    for (const p of PARTS) {
      if (p.fam !== fam || (my[p.id] || 0) <= 0 || p.legacy || p.atom) continue;
      const free = (my[p.id] || 0) - usedElsewhere(p.id, editingId);
      if (free <= 0 && draftParts[fam] !== p.id) continue;   // bolted to another kart
      const stat = fam === 'Engine' ? 'power ' + (p.stats.power ?? '?') : 'grip ' + (p.stats.grip ?? '?');
      opts.push({ id: p.id, label: p.name, sub: p.brand + ' · ' + stat, color: RARITY_META[p.rarity].color });
    }
    return opts;
  }
  const CATS = [
    { key: 'Chassis', opts: () => ownedChassis().map(id => ({ id, label: CHASSIS_LABELS[id], sub: 'factory chassis', color: '#1e5741' })),
      cur: () => KIT.chassis, set: v => { KIT.chassis = v; saveKit(); } },
    { key: 'Decals', opts: () => DECALS.map(d => ({ id: d, label: DECAL_LABELS[d], sub: 'free', color: '#1e5741' })),
      cur: () => KIT.decal, set: v => { KIT.decal = v; saveKit(); } },
    { key: 'Wheels', opts: () => WHEEL_STYLES.map(w => ({ id: w, label: WHEEL_LABELS[w], sub: 'free', color: '#1e5741' })),
      cur: () => KIT.wheels, set: v => { KIT.wheels = v; saveKit(); } },
    { key: 'Tires', opts: () => partOpts('Tires', 'Stock Mediums'),
      cur: () => draftParts.Tires || '', set: v => { draftParts.Tires = v || null; } },
    { key: 'Engine', opts: () => partOpts('Engine', 'Stock I4'),
      cur: () => draftParts.Engine || '', set: v => { draftParts.Engine = v || null; } },
    { key: 'Color', opts: () => PAINTS.map((hex, i) => ({ id: String(i), label: '', sub: '',
        swatch: '#' + hex.toString(16).padStart(6, '0') })),
      cur: () => String(KIT.paint), set: v => { KIT.paint = +v; saveKit(); } },
  ];
  const CARD_H = 84;
  let catI = 0, wheelOpts = [], wheelLock = 0, scrollT = null;
  function buildWheel() {
    const cat = CATS[catI];
    wheelOpts = cat.opts();
    $$('catName').textContent = cat.key;
    $$('catDots').innerHTML = CATS.map((c, i) => `<i class="${i === catI ? 'on' : ''}"></i>`).join('');
    const w = $$('snapWheel');
    w.innerHTML = '<div class="wPad"></div>' + wheelOpts.map((o, i) =>
      `<div class="wCard" data-i="${i}" style="border-color:${o.color || '#999'}">` +
      (o.swatch ? `<span class="wSwatch" style="background:${o.swatch}"></span>`
                : `<b>${o.label}</b><small>${o.sub}</small>`) +
      `</div>`).join('') + '<div class="wPad"></div>';
    const curIdx = Math.max(0, wheelOpts.findIndex(o => o.id === cat.cur()));
    wheelLock = performance.now() + 250;
    w.scrollTop = curIdx * CARD_H;
    markCenter(curIdx);
    w.querySelectorAll('.wCard').forEach(c => c.onclick = () =>
      w.scrollTo({ top: (+c.dataset.i) * CARD_H, behavior: 'smooth' }));
    renderItemSheet();
  }
  function markCenter(idx) {
    $$('snapWheel').querySelectorAll('.wCard').forEach((c, i) => c.classList.toggle('centered', i === idx));
  }
  function wheelScrolled() {
    if (performance.now() < wheelLock) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const w = $$('snapWheel');
      const idx = Math.max(0, Math.min(wheelOpts.length - 1, Math.round(w.scrollTop / CARD_H)));
      markCenter(idx);
      const cat = CATS[catI];
      if (cat.cur() !== wheelOpts[idx].id) {
        cat.set(wheelOpts[idx].id);
        if (typeof refreshKitPreview === 'function') refreshKitPreview();
        renderBars(draftParts);
        if (navigator.vibrate) navigator.vibrate(8);
      }
      renderItemSheet();
    }, 110);
  }
  function stepCat(d) {
    catI = (catI + d + CATS.length) % CATS.length;
    buildWheel();
  }
  function renderLivery() {
    const rack = $$('liveryRack');
    if (!rack) return;
    const act = activeId();
    rack.innerHTML = livery().map(k => {
      const paint = '#' + (PAINTS[(k.kit.paint || 0) % PAINTS.length]).toString(16).padStart(6, '0');
      const partN = LFAMS.filter(f => k.parts && k.parts[f]).length;
      return `<div class="bayCard ${k.id === act ? 'active' : ''}">
        <span class="bayPaint" style="background:${paint}"></span>
        <b>${k.name}</b><small>${k.kit.chassis} · ${partN} custom part${partN === 1 ? '' : 's'}</small>
        <div class="bayBtns">
          <button data-race="${k.id}">${k.id === act ? 'RACING THIS' : 'RACE THIS'}</button>
          <button data-edit="${k.id}">EDIT</button>
          <button data-del="${k.id}">DEL</button>
        </div></div>`;
    }).join('') || '<p class="setNote">Empty stable — walk into the Simpleton Garage and build one.</p>';
    rack.querySelectorAll('[data-race]').forEach(b => b.onclick = () => { setActive(b.dataset.race); renderLivery(); toast('On the grid: ' + livery().find(k => k.id === b.dataset.race).name); });
    rack.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openBuilder(b.dataset.edit));
    rack.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      setLivery(livery().filter(k => k.id !== b.dataset.del));
      renderLivery();
    });
  }
  function showDoors() {
    $$('gBuilder').style.display = 'none';
    $$('gDoors').style.display = '';
    renderLivery(); refreshBalance();
  }
  function openBuilder(kartId) {
    editingId = kartId;
    const k = kartId && livery().find(x => x.id === kartId);
    draftParts = k ? { ...(k.parts || {}) } : {};
    if (k && typeof KIT !== 'undefined') { Object.assign(KIT, k.kit); saveKit(); }
    $$('kartName').value = k ? k.name : '';
    $$('gDoors').style.display = 'none';
    $$('gBuilder').style.display = '';
    catI = 0;
    buildWheel();
    if (typeof refreshKitPreview === 'function') refreshKitPreview();
    renderBars(draftParts);
  }
  function saveKart() {
    const name = $$('kartName').value.trim() || ('Kart ' + (livery().length + 1));
    const all = livery();
    const kart = { id: editingId || 'k' + Math.random().toString(36).slice(2, 9),
                   name, kit: { ...KIT }, parts: { ...draftParts } };
    const i = all.findIndex(x => x.id === kart.id);
    if (i >= 0) all[i] = kart; else all.push(kart);
    setLivery(all);
    if (!activeId() || activeId() === kart.id) setActive(kart.id);
    toast(name + ' saved to the livery');
    showDoors();
  }
  let garageWired = false;
  function garageUI() {
    if (!garageWired) {
      garageWired = true;
      $$('doorSimple').onclick = () => openBuilder(null);   // building happens IN the garage
      $$('doorEng').onclick = () => window.GARAGE3D ? GARAGE3D.open()
        : toast('The Engineer Garage opens with the sim core. Soon.');
      $$('gBack').onclick = showDoors;
      $$('gSave').onclick = saveKart;
      $$('catPrev').onclick = () => stepCat(-1);
      $$('catNext').onclick = () => stepCat(1);
      $$('snapWheel').addEventListener('scroll', wheelScrolled, { passive: true });
      // sideways swipe on the wheel = category change (swipe LEFT → next menu, per Adam)
      let sx = 0, sy = 0;
      const wrap = $$('snapWheelWrap');
      wrap.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
      wrap.addEventListener('pointerup', e => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) stepCat(dx < 0 ? 1 : -1);
      });
    }
    showDoors();
  }

  // ---- PACKS ARE WON (Adam's correction: race prizes are the FLEX packs — the
  // auras, the smokes, the finales. Parts you BUY; style you EARN.) Podium pulls
  // a Celebration pack, everyone else a Wrap pack. Rip button lives on the
  // results board (re-injected each render — live results rebuild the board).
  const PACK_BY_POS = pos => pos <= 3 ? 'celeb' : 'wrap';
  const prevER = window.endRace;
  if (prevER && !prevER._packs) {
    const wrapped = function (...a) {
      const r = prevER.apply(this, a);
      try {
        if (state === 'race' && player && player.isPlayer && player.finished && !(window.ARENA && ARENA.active)) {
          const pos = cars.filter(c => c.finished).length;   // finishers at my line-cross = my position
          localStorage.setItem('vc_pendingpack', PACK_BY_POS(pos));
        }
      } catch (e) {}
      return r;
    };
    wrapped._packs = true;
    window.endRace = wrapped;
  }
  setInterval(() => {
    const id = localStorage.getItem('vc_pendingpack');
    if (!id) return;
    const res = document.getElementById('results');
    const inner = res && res.querySelector('.resInner');
    if (inner && res.style.display !== 'none' && !document.getElementById('ripBtn')) {
      const b = document.createElement('button');
      b.id = 'ripBtn';
      const kind = (id === 'celeb' || id === 'wrap') ? id : 'wrap';   // old parts-pack pendings degrade gracefully
      b.textContent = kind === 'celeb' ? 'PODIUM PRIZE — RIP A CELEBRATION PACK' : 'RACE PRIZE — RIP A WRAP PACK';
      b.onclick = () => { localStorage.removeItem('vc_pendingpack'); if (window.FLEX) FLEX.openPack(kind, true); };
      inner.appendChild(b);
    }
    // skipped the results? the pack rips itself on the next paddock visit
    const menu = document.getElementById('menu');
    if (menu && menu.style.display !== 'none' && (!res || res.style.display === 'none') && !document.getElementById('packReveal')) {
      localStorage.removeItem('vc_pendingpack');
      if (window.FLEX) FLEX.openPack((id === 'celeb' || id === 'wrap') ? id : 'wrap', true);
    }
  }, 1000);

  refreshBalance();   // boot injects us after DOMContentLoaded — refresh now
  return { money, racePayout, refreshBalance, openPack, give, inv, cards, mods, garageUI, activeEngine,
           dirty: () => { modsCache = null; } };
})();
