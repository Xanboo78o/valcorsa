// VALCORSA — THE SEASON SCREEN. The one page that holds the whole campaign:
// today's schedule, the map of the nation (its first ever), the contenders,
// and the races already run. Deliberately LIGHT — broadcast graphics on paper,
// a clean sheet inside the dark Storm app.
'use strict';

window.SEASON = (() => {
  const $ = id => document.getElementById(id);
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || {});
  let sb = null, tick = null, league = 'standard';
  function client() {
    if (sb) return sb;
    if (!window.supabase || !window.APEX_CONFIG) return null;
    sb = window.supabase.createClient(APEX_CONFIG.supabaseUrl, APEX_CONFIG.supabaseKey);
    return sb;
  }

  // ---- the map of Valcorsa, v1 — every pin is a decree Adam can overturn ----
  // viewBox 460x340. Regions per canon: Heiligen alps north, Scots cliffs NW,
  // Finnish interior NE, capital west-center, Anglo center, Con chó east,
  // desert + holy city south-center, Granada/PT coast south.
  const PINS = {
    theskirl:      { x: 74,  y: 74,  n: 'The Skirl' },
    hennenhof:     { x: 170, y: 62,  n: 'Hennenhof' },
    heiligenstage: { x: 214, y: 44,  n: 'Heiligen Stage' },
    hiljaisuus:    { x: 316, y: 70,  n: 'Hiljaisuus' },
    dreipuentes:   { x: 120, y: 140, n: 'DREI PUENTES', capital: true },
    houndsborough: { x: 208, y: 128, n: 'Ft. Houndsborough' },
    doichonhay:    { x: 330, y: 150, n: 'Đồi Chó Nhảy' },
    perrosaltarin: { x: 176, y: 196, n: 'Perro Saltarín' },
    sanvolante:    { x: 226, y: 236, n: 'San Volante', holy: true },
    granada:       { x: 176, y: 268, n: 'Granada' },
    bullring:      { x: 160, y: 282, n: 'La Plaza' },
    trestouros:    { x: 268, y: 280, n: 'Três Touros' },
  };
  const LAND = 'M28,96 Q20,64 56,52 Q84,26 132,34 Q168,16 214,26 Q262,10 306,28 Q356,20 396,44 Q436,60 428,96 Q444,124 420,148 Q408,178 372,182 Q352,206 318,198 Q300,224 272,226 Q262,252 244,270 Q238,296 214,308 Q188,316 176,296 Q152,290 148,264 Q124,252 122,224 Q92,214 92,186 Q56,178 48,148 Q24,130 28,96 Z';

  function mapSvg(today) {
    const pins = Object.entries(PINS).map(([id, p]) => {
      const isToday = today.some(r => r.def.id === id);
      const cls = p.capital ? 'mpCap' : p.holy ? 'mpHoly' : 'mp';
      return `<g class="${cls}${isToday ? ' mpToday' : ''}">
        <circle cx="${p.x}" cy="${p.y}" r="${p.capital || p.holy ? 6 : 4.2}"/>
        ${isToday ? `<circle class="pulse" cx="${p.x}" cy="${p.y}" r="10"/>` : ''}
        <text x="${p.x}" y="${p.y - (p.capital || p.holy ? 10 : 8)}">${p.n}</text>
      </g>`;
    }).join('');
    const tour = today.map(r => PINS[r.def.id]).filter(Boolean);
    const tourLine = tour.length > 1
      ? `<polyline class="tourLine" points="${tour.map(p => p.x + ',' + p.y).join(' ')}"/>` : '';
    return `<svg viewBox="0 0 460 340" id="vcMap" aria-label="The map of Valcorsa">
      <path class="sea" d="M0,0 H460 V340 H0 Z"/>
      <path class="land" d="${LAND}"/>
      ${tourLine}${pins}
      <text class="mapTitle" x="20" y="326">VALCORSA · seven tongues, one racing faith</text>
    </svg>`;
  }

  // ---- schedule strip ----
  const fmtAt = at => at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function fmtIn(ms) {
    if (ms <= 0) return 'GRID OPEN';
    const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
    return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm ' + String(s).padStart(2, '0') + 's';
  }
  function renderSlots() {
    const el = $('ssSlots');
    if (!el) return;
    const today = SCHED.todays();
    el.innerHTML = today.map(r => {
      const dt = r.at.getTime() - Date.now();
      const joinable = dt < 15 * 60000 && dt > -3 * 60000;
      return `<div class="ssRace${dt <= 0 && dt > -3 * 60000 ? ' live' : ''}${dt <= -3 * 60000 ? ' done' : ''}">
        <b class="ssLabel">${r.label}${r.open ? ' · 20 KARTS' : ''}</b>
        <span class="ssTrack">${r.def.name}</span>
        <span class="ssMode">${r.def.mode} · ${fmtAt(r.at)}</span>
        <span class="ssWhen">${dt <= -3 * 60000 ? 'RACED' : fmtIn(dt)}</span>
        ${joinable ? `<button data-slot="${r.slot}">${dt <= 0 ? 'GET ON THE GRID' : 'WAIT ON THE GRID'}</button>` : ''}
      </div>`;
    }).join('');
    el.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
      const r = SCHED.todays()[+b.dataset.slot];
      closeSeason();
      if (SCHED.enter) SCHED.enter(r);
    });
  }

  // ---- contenders + recent races ----
  async function renderContenders() {
    const el = $('ssContenders');
    el.innerHTML = '<p class="ssNote">reading the timing tower…</p>';
    const c = client();
    if (!c) { el.innerHTML = '<p class="ssNote">offline — the tower is dark</p>'; return; }
    const { data } = await c.from('league_results').select('player,pcode,pts').eq('league', league).limit(2000);
    const tally = new Map();
    for (const r of (data || [])) {
      const k = r.player + '|' + r.pcode;
      const t = tally.get(k) || { player: r.player, pts: 0, races: 0 };
      t.pts += r.pts; t.races++; tally.set(k, t);
    }
    const rows = [...tally.values()].sort((a, b) => b.pts - a.pts).slice(0, 12);
    el.innerHTML = rows.length
      ? rows.map((r, i) => `<div class="ssRow${r.player === (acct().name || '') ? ' me' : ''}">
          <i>${i + 1}</i><b>${r.player}</b><span>${r.pts} pts</span><small>${r.races} race${r.races === 1 ? '' : 's'}</small>
        </div>`).join('')
      : '<p class="ssNote">Nobody has scored yet. The first name written here is written forever.</p>';
  }
  async function renderRecent() {
    const el = $('ssRecent');
    const c = client();
    if (!c) { el.innerHTML = ''; return; }
    const { data } = await c.from('league_results')
      .select('league,day,slot,player,pos,pts').order('id', { ascending: false }).limit(120);
    const races = new Map();
    for (const r of (data || [])) {
      const k = r.league + '|' + r.day + '|' + r.slot;
      const g = races.get(k) || { league: r.league, day: r.day, slot: r.slot, rows: [] };
      g.rows.push(r); races.set(k, g);
    }
    const recent = [...races.values()].slice(0, 6);
    el.innerHTML = recent.length
      ? recent.map(g => {
          const win = [...g.rows].sort((a, b) => a.pos - b.pos)[0];
          return `<div class="ssRow"><i>🏁</i><b>${win.player}</b>
            <span>won · P${win.pos}</span><small>${g.day} · slot ${g.slot + 1} · ${g.league === 'hard' ? 'HARD' : 'STANDARD'}</small></div>`;
        }).join('')
      : '<p class="ssNote">No races run yet — tonight\'s card is waiting.</p>';
  }

  // ---- open/close ----
  function ensureDom() {
    if ($('seasonScreen')) return;
    const el = document.createElement('div');
    el.id = 'seasonScreen';
    el.innerHTML = `
      <div class="ssInner">
        <div class="ssHead">
          <button id="ssClose">✕</button>
          <div class="ssTitle"><b>THE VALCORSA SEASON</b><span>VCRA sanctioned · every race counts</span></div>
          <div class="ssLeague">
            <button data-lg="standard" class="sel">STANDARD</button>
            <button data-lg="hard">HARD</button>
          </div>
        </div>
        <p class="ssSection">TODAY IN VALCORSA</p>
        <div id="ssSlots"></div>
        <p class="ssSection">THE NATION</p>
        <div id="ssMap"></div>
        <div class="ssCols">
          <div><p class="ssSection">THE CONTENDERS</p><div id="ssContenders"></div></div>
          <div><p class="ssSection">RECENT RACES</p><div id="ssRecent"></div></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    $('ssClose').onclick = closeSeason;
    el.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => {
      league = b.dataset.lg;
      el.querySelectorAll('[data-lg]').forEach(x => x.classList.toggle('sel', x === b));
      renderContenders();
    });
  }
  window.openSeason = () => {
    ensureDom();
    $('seasonScreen').style.display = 'block';
    $('ssMap').innerHTML = mapSvg(SCHED.todays());
    renderSlots(); renderContenders(); renderRecent();
    tick = setInterval(renderSlots, 1000);
  };
  window.closeSeason = () => {
    const el = $('seasonScreen');
    if (el) el.style.display = 'none';
    clearInterval(tick);
  };

  return { PINS };
})();
