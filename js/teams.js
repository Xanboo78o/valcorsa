// VALCORSA — TEAMS (lite). Start a team, join with a 4-char code, race under one
// color. Constructors standings = every member's league points banked together.
// Supabase: teams (code/name/color) + racers.team. The drama arrives later —
// this is the door.
'use strict';

window.TEAMS = (() => {
  const $ = id => document.getElementById(id);
  const cfg = window.APEX_CONFIG || {};
  const REST = (cfg.supabaseUrl || '') + '/rest/v1';
  const HEAD = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey };
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || {});
  const myName = () => acct().username || acct().name || '';
  const myTeam = () => localStorage.getItem('vc_team') || '';
  const COLORS = ['#2e6bff', '#ff8c1a', '#c73a2c', '#2e9d63', '#8931d6', '#0fb8c4', '#f2a900', '#f4f4f6'];

  function genTeamCode() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
    return c;
  }

  // ---- server ----
  const jfetch = async (url, opt) => { const r = await fetch(url, opt || { headers: HEAD }); if (!r.ok) throw new Error(r.status); return r.json().catch(() => null); };
  async function createTeam(name, color) {
    const code = genTeamCode();
    const rows = await jfetch(REST + '/teams?on_conflict=code', {
      method: 'POST', headers: { ...HEAD, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ code, name: name.slice(0, 20), color }),
    });
    if (!rows || !rows.length) return createTeam(name, color);   // code collision: reroll
    await setMyTeam(code);
    return code;
  }
  async function joinTeam(code) {
    const rows = await jfetch(REST + '/teams?code=eq.' + encodeURIComponent(code));
    if (!rows || !rows.length) return null;
    await setMyTeam(code);
    return rows[0];
  }
  async function setMyTeam(code) {
    localStorage.setItem('vc_team', code || '');
    const n = myName();
    if (!n) return;
    try {
      await fetch(REST + '/racers?on_conflict=name_lc', {
        method: 'POST', headers: { ...HEAD, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ name_lc: n.toLowerCase(), name: n, team: code || null }),
      });
    } catch (e) {}
  }

  // ---- UI ----
  function ensureDom() {
    if ($('teamsModal')) return;
    const d = document.createElement('div');
    d.id = 'teamsModal';
    d.innerHTML = `<div class="panel teamsPanel">
      <h2>TEAMS</h2>
      <div id="tmBody"><p class="setNote">calling the paddock…</p></div>
      <button class="closeSet" onclick="closeTeams()">Back to the paddock</button>
    </div>`;
    document.body.appendChild(d);
  }

  async function render() {
    const body = $('tmBody');
    const code = myTeam();
    if (!code) {
      body.innerHTML = `
        <div class="tmSplit">
          <div class="tmCard">
            <b>START A TEAM</b>
            <input id="tmName" maxlength="20" placeholder="Team name…" autocomplete="off">
            <div id="tmColors">${COLORS.map((c, i) => `<i data-c="${c}" class="${i === 0 ? 'sel' : ''}" style="background:${c}"></i>`).join('')}</div>
            <button id="tmCreate">CREATE — GET A CODE</button>
          </div>
          <div class="tmCard">
            <b>JOIN A TEAM</b>
            <p class="setNote">Get the 4-letter code from whoever runs it.</p>
            <input id="tmCode" maxlength="4" placeholder="CODE" autocomplete="off" style="text-transform:uppercase">
            <button id="tmJoin">JOIN UP</button>
          </div>
        </div>
        <p class="setNote">Your race points bank to the team — constructors standings live here and in THE SEASON.</p>`;
      let color = COLORS[0];
      body.querySelectorAll('#tmColors i').forEach(el => el.onclick = () => {
        body.querySelectorAll('#tmColors i').forEach(x => x.classList.remove('sel'));
        el.classList.add('sel'); color = el.dataset.c;
      });
      $('tmCreate').onclick = async () => {
        const n = ($('tmName').value || '').trim();
        if (!n) { $('tmName').focus(); return; }
        $('tmCreate').textContent = 'REGISTERING…';
        try { await createTeam(n, color); render(); } catch (e) { $('tmCreate').textContent = 'OFFLINE — TRY AGAIN'; }
      };
      $('tmJoin').onclick = async () => {
        const c = ($('tmCode').value || '').trim().toUpperCase();
        if (c.length !== 4) { $('tmCode').focus(); return; }
        $('tmJoin').textContent = 'CHECKING…';
        const t = await joinTeam(c).catch(() => null);
        if (t) render();
        else { $('tmJoin').textContent = 'NO SUCH TEAM'; setTimeout(() => { $('tmJoin').textContent = 'JOIN UP'; }, 1500); }
      };
      return;
    }
    // on a team: header + roster + constructors
    let team = null, roster = [], lookupOk = false;
    try {
      const rows = await jfetch(REST + '/teams?code=eq.' + code);
      lookupOk = true;
      team = rows && rows[0];
      roster = await jfetch(REST + '/racers?team=eq.' + code + '&select=name').catch(() => []) || [];
    } catch (e) {}
    if (!team) {
      if (lookupOk) { localStorage.setItem('vc_team', ''); render(); }   // server says: no such team
      else body.innerHTML = '<p class="setNote">Paddock phones are down — your team is safe, try again in a minute.</p>';
      return;
    }
    body.innerHTML = `
      <div class="tmHead" style="--tc:${team.color}">
        <i class="tmChip"></i>
        <div><b>${team.name}</b><span>join code: <em class="tmCode">${code}</em> — send it to the boys</span></div>
        <button id="tmLeave">LEAVE</button>
      </div>
      <p class="setNote">— THE ROSTER —</p>
      <div id="tmRoster">${roster.map(r => `<span class="liveChip">${r.name}</span>`).join('') || '<span class="setNote">just you so far</span>'}</div>
      <p class="setNote">— CONSTRUCTORS · VCRA STANDARD —</p>
      <div id="tmBoard"><p class="setNote">reading the tower…</p></div>`;
    $('tmLeave').onclick = async () => { await setMyTeam(''); render(); };
    renderConstructors($('tmBoard'));
  }

  // constructors: league_results points grouped by each racer's team
  async function renderConstructors(el) {
    try {
      const [results, racers, teams] = await Promise.all([
        jfetch(REST + '/league_results?league=eq.standard&select=player,pts&limit=2000'),
        jfetch(REST + '/racers?select=name,team'),
        jfetch(REST + '/teams?select=code,name,color'),
      ]);
      const teamOf = {};
      for (const r of racers || []) if (r.team) teamOf[r.name] = r.team;
      const pts = {};
      for (const r of results || []) { const t = teamOf[r.player]; if (t) pts[t] = (pts[t] || 0) + r.pts; }
      const rows = (teams || []).map(t => ({ ...t, pts: pts[t.code] || 0 }))
        .filter(t => t.pts > 0 || t.code === myTeam())
        .sort((a, b) => b.pts - a.pts);
      el.innerHTML = rows.length
        ? '<table class="tmTable">' + rows.map((t, i) =>
            `<tr class="${t.code === myTeam() ? 'me' : ''}"><td class="tmP">${i + 1}</td>
             <td><i class="tmDot" style="background:${t.color}"></i>${t.name}</td><td class="tmPts">${t.pts} pts</td></tr>`).join('') + '</table>'
        : '<p class="setNote">No constructor points yet. Race a scheduled grid.</p>';
    } catch (e) { el.innerHTML = '<p class="setNote">Tower’s offline. Points are still banking.</p>'; }
  }

  window.openTeams = () => { ensureDom(); $('teamsModal').style.display = 'flex'; render(); };
  window.closeTeams = () => { const m = $('teamsModal'); if (m) m.style.display = 'none'; };

  return { myTeam, openTeams };
})();
