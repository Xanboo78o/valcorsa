// VALCORSA — TEAMS. A full PAGE, not a popup (Adam's law). Teams are half the
// game: every crew needs racers, ENGINEERS and RADIO — the four hats from canon
// (hats not cages, anyone can wear any). Supabase: teams (code/name/color),
// racers.team + racers.role. Constructors = the crew's league points, banked.
'use strict';

window.TEAMS = (() => {
  const $ = id => document.getElementById(id);
  const cfg = window.APEX_CONFIG || {};
  const REST = (cfg.supabaseUrl || '') + '/rest/v1';
  const HEAD = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey };
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || {});
  const myName = () => acct().username || acct().name || '';
  const myTeam = () => localStorage.getItem('vc_team') || '';
  const myRole = () => localStorage.getItem('vc_role') || 'racer';
  const COLORS = ['#2e6bff', '#ff8c1a', '#c73a2c', '#2e9d63', '#8931d6', '#0fb8c4', '#f2a900', '#f4f4f6'];

  // the four hats (canon: Racer · Engineer · Radio & Pit · Manager — hats not cages)
  const ROLES = [
    { id: 'racer',    name: 'RACER',       blurb: 'Drives the thing. Wins the thing.',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 108 8 8 8 0 00-8-8zm0 2a6 6 0 015.6 4H14a2 2 0 00-4 0H6.4A6 6 0 0112 6zm0 12a6 6 0 01-5.6-4H10a2 2 0 004 0h3.6a6 6 0 01-5.6 4z"/></svg>' },
    { id: 'engineer', name: 'ENGINEER',    blurb: 'Builds the karts. Signs the engines.',
      icon: '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>' },
    { id: 'radio',    name: 'RADIO & PIT', blurb: 'Eyes on the timing tower, voice in the helmet.',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 1a9 9 0 00-9 9v8a3 3 0 003 3h2v-8H5v-3a7 7 0 0114 0v3h-3v8h2a3 3 0 003-3v-8a9 9 0 00-9-9z"/></svg>' },
    { id: 'manager',  name: 'MANAGER',     blurb: 'Runs the show. Picks the lineup. Takes the blame.',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 2L4 6v5c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6zm0 4a2.5 2.5 0 11-2.5 2.5A2.5 2.5 0 0112 6zm0 12.5a7.6 7.6 0 01-5-2.3c0-1.7 3.3-2.6 5-2.6s5 .9 5 2.6a7.6 7.6 0 01-5 2.3z"/></svg>' },
  ];

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
    if (!rows || !rows.length) return createTeam(name, color);
    localStorage.setItem('vc_role', 'manager');          // founder wears the MANAGER hat (swap any time)
    await saveMe(code, 'manager');
    return code;
  }
  async function joinTeam(code) {
    const rows = await jfetch(REST + '/teams?code=eq.' + encodeURIComponent(code));
    if (!rows || !rows.length) return null;
    await saveMe(code, myRole());
    return rows[0];
  }
  async function saveMe(team, role) {
    localStorage.setItem('vc_team', team || '');
    const n = myName();
    if (!n) return;
    try {
      await fetch(REST + '/racers?on_conflict=name_lc', {
        method: 'POST', headers: { ...HEAD, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ name_lc: n.toLowerCase(), name: n, team: team || null, role: role || 'racer' }),
      });
    } catch (e) {}
  }

  // ---- identity: the name you log as + your racing number (Adam's spec) ----
  const myNum = () => {
    try { const k = JSON.parse(localStorage.getItem('apex_kit')); if (k && k.num) return k.num; } catch (e) {}
    return null;
  };
  async function saveIdentity(newName, num) {
    const a = acct();
    const oldName = myName();
    newName = (newName || oldName).trim().slice(0, 16);
    // the number rides the kit (it's what the decal roundel paints) — and every livery kart
    if (num) {
      try {
        const k = JSON.parse(localStorage.getItem('apex_kit') || '{}'); k.num = num;
        localStorage.setItem('apex_kit', JSON.stringify(k));
        if (typeof KIT !== 'undefined') { KIT.num = num; if (typeof saveKit === 'function') saveKit(); }
        const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
        for (const kart of liv) if (kart.kit) kart.kit.num = num;
        localStorage.setItem('vc_livery', JSON.stringify(liv));
      } catch (e) {}
    }
    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      // claim the new name (unique across the country) before letting go of the old
      const r = await fetch(REST + '/racers?on_conflict=name_lc', {
        method: 'POST', headers: { ...HEAD, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ name_lc: newName.toLowerCase(), name: newName, code: a.code || '', team: myTeam() || null, role: myRole(), num: num || myNum() }),
      });
      if (!r.ok) return 'offline';
      let rows = await r.json();
      if (!rows.length) {
        // ignored duplicate — but it might be OUR row from a half-finished rename
        const ex = await jfetch(REST + '/racers?name_lc=eq.' + encodeURIComponent(newName.toLowerCase()) + '&select=code').catch(() => null);
        if (!(ex && ex[0] && ex[0].code === (a.code || ''))) return 'taken';
      }
      await fetch(REST + '/racers?name_lc=eq.' + encodeURIComponent(oldName.toLowerCase()), { method: 'DELETE', headers: HEAD }).catch(() => {});
      a.username = newName;
      localStorage.setItem('apex_account', JSON.stringify(a));
      // pair.js keeps its own live `account` object (shared lexical global) and re-saves
      // it on pairing events — mutate THAT too or it clobbers the rename right back
      try { if (typeof account !== 'undefined' && account) { account.username = newName; if (typeof saveAccount === 'function') saveAccount(account); } } catch (e) {}
      if (typeof updateAccountChip === 'function') try { updateAccountChip(); } catch (e) {}
    } else {
      await fetch(REST + '/racers?on_conflict=name_lc', {
        method: 'POST', headers: { ...HEAD, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ name_lc: oldName.toLowerCase(), name: oldName, team: myTeam() || null, role: myRole(), num: num || myNum() }),
      }).catch(() => {});
    }
    return 'ok';
  }

  // ---- the PAGE ----
  function ensureDom() {
    if ($('teamsScreen')) return;
    const d = document.createElement('div');
    d.id = 'teamsScreen';
    d.innerHTML = `<div class="tmScroll">
      <div class="tmMast"><h2>TEAMS</h2><p>Half this game happens on the garage wall. Get a crew.</p></div>
      <div id="tmBody"><p class="setNote">calling the paddock…</p></div>
    </div>`;
    document.body.appendChild(d);
  }

  const hatsHTML = (sel, clickable) => `
    <div class="tmHats${clickable ? ' pick' : ''}">${ROLES.map(r => `
      <div class="tmHat${sel === r.id ? ' sel' : ''}" data-role="${r.id}">
        <i>${r.icon}</i><b>${r.name}</b><span>${r.blurb}</span>
      </div>`).join('')}
    </div>`;

  async function render() {
    const body = $('tmBody');
    const code = myTeam();

    if (!code) {
      body.innerHTML = `
        <p class="tmLede">A Valcorsa team isn’t a name tag — it’s a CREW. Somebody drives. Somebody builds.
        Somebody sits on the pit wall with the map. The four hats — anyone can wear any, swap whenever:</p>
        ${hatsHTML(null, false)}
        <div class="tmSplit">
          <div class="tmCard">
            <b>START A TEAM</b>
            <span class="tmSub">You’ll get a 4-letter code. Send it to the boys. Founder wears the MANAGER hat.</span>
            <input id="tmName" maxlength="20" placeholder="Team name…" autocomplete="off">
            <div id="tmColors">${COLORS.map((c, i) => `<i data-c="${c}" class="${i === 0 ? 'sel' : ''}" style="background:${c}"></i>`).join('')}</div>
            <button id="tmCreate">REGISTER WITH THE VCRA</button>
          </div>
          <div class="tmCard">
            <b>JOIN A TEAM</b>
            <span class="tmSub">Got a code from a friend? You’re one field away from a garage wall.</span>
            <input id="tmCode" maxlength="4" placeholder="CODE" autocomplete="off" style="text-transform:uppercase">
            <button id="tmJoin">JOIN THE CREW</button>
          </div>
        </div>`;
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
        else { $('tmJoin').textContent = 'NO SUCH TEAM'; setTimeout(() => { $('tmJoin').textContent = 'JOIN THE CREW'; }, 1500); }
      };
      return;
    }

    // ---- on a crew ----
    let team = null, roster = [], lookupOk = false;
    try {
      const rows = await jfetch(REST + '/teams?code=eq.' + code);
      lookupOk = true;
      team = rows && rows[0];
      roster = await jfetch(REST + '/racers?team=eq.' + code + '&select=name,role,num').catch(() => []) || [];
    } catch (e) {}
    if (!team) {
      if (lookupOk) { localStorage.setItem('vc_team', ''); render(); }
      else body.innerHTML = '<p class="setNote">Paddock phones are down — your team is safe, try again in a minute.</p>';
      return;
    }

    const byRole = {};
    for (const r of roster) (byRole[r.role || 'racer'] = byRole[r.role || 'racer'] || []).push(r);
    const missing = [];
    if (!byRole.engineer) missing.push('VCRA notes: no ENGINEER on file — who’s building the karts?');
    if (!byRole.radio) missing.push('VCRA notes: no RADIO — who’s calling the pit?');

    body.innerHTML = `
      <div class="tmBanner" style="--tc:${team.color}">
        <i class="tmSlab"></i>
        <div class="tmBname"><b>${team.name}</b><span>VCRA registered crew · ${roster.length} member${roster.length === 1 ? '' : 's'}</span></div>
        <div class="tmTicket"><span>JOIN CODE</span><b>${code}</b><em>send it to the boys</em></div>
      </div>
      <div id="tmIdent">
        <span>RACING AS</span><b>${myName()}</b><i class="tmNum">#${myNum() || '—'}</i>
        <button id="tmIdEdit">CHANGE NAME / NUMBER</button>
      </div>
      <div id="tmIdForm" style="display:none">
        <input id="tmIdName" maxlength="16" placeholder="Race name" autocomplete="off">
        <input id="tmIdNum" type="number" min="1" max="99" placeholder="#">
        <button id="tmIdSave">SAVE</button>
        <p id="tmIdMsg" class="setNote"></p>
      </div>
      <p class="setNote">— YOUR HAT · tap to swap, the crew sees it —</p>
      <div id="tmMyRole">${hatsHTML(myRole(), true)}</div>
      <p class="setNote">— THE CREW —</p>
      <div class="tmCrew">${ROLES.map(r => `
        <div class="tmCrewCol">
          <div class="tmCrewHead"><i>${r.icon}</i>${r.name}</div>
          ${(byRole[r.id] || []).map(m => `<span class="liveChip${m.name === myName() ? ' meChip' : ''}">${m.name}${m.num ? ' <i class="chipNum">#' + m.num + '</i>' : ''}</span>`).join('') || '<span class="tmEmpty">—</span>'}
        </div>`).join('')}
      </div>
      ${missing.map(m => `<p class="tmWarn">${m}</p>`).join('')}
      <p class="setNote">— CONSTRUCTORS · VCRA STANDARD —</p>
      <div id="tmBoard"><p class="setNote">reading the tower…</p></div>
      <button id="tmLeave">LEAVE THE CREW</button>`;
    $('tmIdEdit').onclick = () => {
      const f = $('tmIdForm');
      f.style.display = f.style.display === 'none' ? 'flex' : 'none';
      $('tmIdName').value = myName();
      $('tmIdNum').value = myNum() || '';
    };
    $('tmIdSave').onclick = async () => {
      const n = ($('tmIdName').value || '').trim();
      const num = Math.max(0, Math.min(99, +($('tmIdNum').value || 0))) || null;
      $('tmIdMsg').textContent = 'filing with the VCRA…';
      const res = await saveIdentity(n, num);
      if (res === 'taken') { $('tmIdMsg').textContent = 'That name is taken. The country is watching — pick another.'; return; }
      if (res === 'offline') { $('tmIdMsg').textContent = 'Paddock phones are down. Try again in a minute.'; return; }
      render();
    };
    body.querySelectorAll('#tmMyRole .tmHat').forEach(el => el.onclick = async () => {
      localStorage.setItem('vc_role', el.dataset.role);
      await saveMe(code, el.dataset.role);
      render();
    });
    $('tmLeave').onclick = async () => { await saveMe('', myRole()); localStorage.setItem('vc_team', ''); render(); };
    renderConstructors($('tmBoard'));
  }

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
        : '<p class="setNote">No constructor points yet. Race a scheduled grid — every member banks for the crew.</p>';
    } catch (e) { el.innerHTML = '<p class="setNote">Tower’s offline. Points are still banking.</p>'; }
  }

  window.openTeams = () => { ensureDom(); $('teamsScreen').style.display = 'block'; render(); };
  window.closeTeams = () => { const m = $('teamsScreen'); if (m) m.style.display = 'none'; };

  return { myTeam, myRole, openTeams };
})();
