// VALCORSA — LeagueSSS. The campaign IS the season: scheduled races award
// points into two ladders (VCRA Standard League / Hard Mode League) stored in
// Supabase. Flat F1-style curve — consistency beats peaks (canon). Challenge
// rooms never score. COM legends fill grids but don't bank points (yet).
'use strict';

window.LEAGUE = (() => {
  const $ = id => document.getElementById(id);
  // flat curve, 12 grid slots (canon: peaks don't run away with it)
  const PTS = [20, 17, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5];
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || {});
  let sb = null;
  function client() {
    if (sb) return sb;
    if (!window.supabase || !window.APEX_CONFIG) return null;
    sb = window.supabase.createClient(APEX_CONFIG.supabaseUrl, APEX_CONFIG.supabaseKey);
    return sb;
  }
  const leagueNow = () => (typeof hardMode !== 'undefined' && hardMode) ? 'hard' : 'standard';

  // ---------------------------------------------------------------- scoring
  // Called by NET when a live scheduled race compiles results, and by endRace
  // for a solo scheduled grid. Only VD#### rooms are league races.
  async function postResult(room, myPos) {
    if (!/^VD\d{4}$/.test(room || '')) return;                 // challenge rooms never score
    const today = window.SCHED ? SCHED.todays() : [];
    const slot = today.findIndex(r => r.room === room);
    if (slot < 0) return;
    const c = client(); if (!c) return;
    const a = acct();
    const pts = PTS[Math.max(0, Math.min(myPos - 1, PTS.length - 1))];
    const d = new Date();
    const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    try {
      await c.from('league_results').upsert({
        league: leagueNow(), day, slot, room,
        player: a.username || a.name || 'RACER', pcode: a.code || '', pos: myPos, pts,
      }, { onConflict: 'league,day,slot,player,pcode' });
      if (window.toast) toast('🏆 P' + myPos + ' · +' + pts + ' pts — ' + (leagueNow() === 'hard' ? 'HARD' : 'VCRA STANDARD') + ' LEAGUE');
    } catch (e) { /* offline: the race still happened, the points didn't */ }
  }

  // NET calls this with compiled live results; find my row
  function onLiveResults(results, room) {
    const a = acct();
    const mine = results.findIndex(r => r.name === (a.username || a.name || 'RACER'));
    if (mine >= 0) postResult(room, mine + 1);
  }

  // solo scheduled race (grid of one human + the locals): score my field position
  function onSoloFinish(room, myPos) { postResult(room, myPos); }

  // ---------------------------------------------------------------- standings
  async function fetchStandings(league) {
    const c = client(); if (!c) return [];
    const { data } = await c.from('league_results')
      .select('player,pcode,pts,day,slot').eq('league', league).limit(2000);
    if (!data) return [];
    const tally = new Map();
    for (const r of data) {
      const k = r.player + '|' + r.pcode;
      const t = tally.get(k) || { player: r.player, pts: 0, races: 0, wins: 0 };
      t.pts += r.pts; t.races++;
      tally.set(k, t);
    }
    return [...tally.values()].sort((a, b) => b.pts - a.pts);
  }

  async function openStandings(league) {
    league = league || 'standard';
    const m = $('standingsModal');
    m.style.display = 'flex';
    m.querySelectorAll('[data-league]').forEach(b => b.classList.toggle('sel', b.dataset.league === league));
    const body = $('standingsBody');
    body.innerHTML = '<p class="setNote">reading the timing tower…</p>';
    const rows = await fetchStandings(league);
    body.innerHTML = rows.length
      ? '<table>' + rows.map((r, i) =>
          `<tr class="${r.player === (acct().username || acct().name || '') ? 'me' : ''}">
            <td>${i + 1}</td><td>${r.player}</td><td>${r.pts} pts</td><td>${r.races} race${r.races === 1 ? '' : 's'}</td>
          </tr>`).join('') + '</table>'
      : '<p class="setNote">No results yet. The season starts when somebody races a scheduled grid.</p>';
  }
  window.openStandings = openStandings;
  window.closeStandings = () => { $('standingsModal').style.display = 'none'; };

  function wire() {
    const m = $('standingsModal');
    if (!m) return;
    m.querySelectorAll('[data-league]').forEach(b => b.onclick = () => openStandings(b.dataset.league));
  }
  wire();

  return { onLiveResults, onSoloFinish, postResult };
})();
