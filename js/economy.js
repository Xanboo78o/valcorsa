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

  function shopHTML() {
    return `
    <div class="panel shopPanel">
      <h2>THE PARTS SHOP</h2>
      <p class="garageSub">Balance: <b class="corsas">₡<span data-corsas>0</span></b> · winnings buy parts, parts win races</p>
      <p class="setNote">— PARTSPACKS · pick your sponsor —</p>
      <div id="sponsorRow">${SPONSORS.map(s => `
        <button class="sponsorCard" data-sponsor="${s.id}">
          <b>${s.name}</b><span>${s.tag}</span><em>₡${s.cost}</em>
        </button>`).join('')}
      </div>
      <p class="setNote">— THE CATALOGUE · every single part —</p>
      <div id="famRow">${PART_FAMILIES.map(f => `<button data-fam="${f}">${f}</button>`).join('')}</div>
      <input id="partSearch" placeholder="Search the catalogue…" autocomplete="off">
      <div id="storeList"></div>
      <p class="setNote">— YOUR SHELVES —</p>
      <div id="invList"></div>
      <button class="closeSet" onclick="closeShop()">Done</button>
    </div>`;
  }

  let curFam = 'Engine';
  function renderStore() {
    const q = ($$('partSearch').value || '').toLowerCase();
    const my = inv(), cd = cards();
    const list = PARTS.filter(p => !p.legacy &&
      (q ? (p.name + p.brand + p.fam).toLowerCase().includes(q) : p.fam === curFam));
    $$('storeList').innerHTML = list.slice(0, 60).map(p => {
      const rm = RARITY_META[p.rarity];
      const stats = Object.entries(p.stats).map(([k, v2]) => `${k} ${v2}`).join(' · ');
      const isChassis = p.fam === 'Chassis';
      const owned = my[p.id] || 0;
      const cardN = cd[p.id] || 0;
      const locked = isChassis && cardN < CARDS_NEEDED;
      const buy = locked
        ? `<span class="cardNeed">cards ${cardN}/${CARDS_NEEDED}</span>`
        : `<button class="buyBtn" data-buy="${p.id}">${p.price ? '₡' + p.price : 'FREE'}</button>`;
      return `<div class="partRow">
        <span class="rarDot" style="background:${rm.color}"></span>
        <div class="partInfo"><b>${p.brand} ${p.name}</b><small>${stats}${p.note ? ' — ' + p.note : ''}</small></div>
        ${owned ? `<span class="ownedN">x${owned}</span>` : ''}${buy}
      </div>`;
    }).join('') || '<p class="setNote">Nothing here matches.</p>';
    $$('storeList').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyPart(b.dataset.buy));
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
  function openPack(sponsorId) {
    const s = SPONSORS.find(x => x.id === sponsorId);
    if (money() < s.cost) { toast('Not enough Corsas — go race!'); return; }
    setMoney(money() - s.cost);
    const pulls = Array.from({ length: s.pulls }, () => rollPart(s));
    const ov = document.createElement('div');
    ov.id = 'packReveal';
    ov.innerHTML = `<div class="packWrap"><div class="packArt">${s.name}<span>PARTSPACK</span></div><div class="pullRow"></div>
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
        }, i * 420));
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
  function computeMods(parts) {
    const cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
    const st = fam => {
      const id = parts && parts[fam];
      if (fam === 'Engine') { const bs = buildStats(id); if (bs) return bs; }
      const p = id && PARTS.find(x => x.id === id);
      return p ? p.stats : STOCK_STATS[fam];
    };
    const e = st('Engine'), t = st('Tires');
    const b = STOCK_STATS.Brakes, a = STOCK_STATS.Aero;   // Engineer Garage territory — always stock here
    return {
      accel: cl(0.82 + (e.power ?? 55) / 280, 0.9, 1.14),
      grip:  cl(0.9 + (t.grip ?? 6) * 0.018 + (a.downforce ?? 0) * 0.004, 0.92, 1.12),
      brake: cl(0.9 + (b.stop ?? 6) * 0.02, 0.92, 1.1),
      drag:  cl(1 + ((a.drag ?? 3) - 3) * 0.012, 0.95, 1.08),
    };
  }
  function mods() {   // physics reads THIS: the active livery kart's build
    if (modsCache) return modsCache;
    const act = livery().find(k => k.id === activeId());
    return modsCache = computeMods(act ? act.parts : null);
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
  const CH_MAP = { 'Enginos GT': 'gt', 'Houndsborough Iron': 'muscle', 'Heiligen Strada': 'rally',
                   'Enginos Volante F': 'formula', 'Norte Titan': 'truck',
                   'Granada Sprint Kart': 'kart', 'Perro Moto': 'bike' };
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
      for (const b of ENGINEMATH.builds()) {
        const bid = 'build:' + b.id;
        const free = 1 - usedElsewhere(bid, editingId);
        if (free <= 0 && draftParts.Engine !== bid) continue;
        opts.push({ id: bid, label: b.name, sub: b.designation + ' · ' + b.vp + ' vp · by ' + b.builder, color: '#ff8c1a' });
      }
      return opts;
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

  refreshBalance();   // boot injects us after DOMContentLoaded — refresh now
  return { money, racePayout, refreshBalance, openPack, give, inv, cards, mods, garageUI };
})();
