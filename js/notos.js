// VALCORSA — RACE NOTOS. "bro hop on, we've got a race in 20" — but the game
// says it. Web-push for the daily card: T-20 for every slot, lights-out for
// THE OPEN. Self-contained (injects its own Settings section + styles); the
// sender is the race-notos edge function, fired by pg_cron.
'use strict';

window.NOTOS = (() => {
  const VAPID_PUB = 'BOxTXqto7oynYzNXA7VbgtQG-zRA7UOoNPCxekWHsIzZFc7fNKjFEXh-1-fqKk21NQf3nXu3qVl_j2Ai-BBvldg';
  const cfg = window.APEX_CONFIG || {};
  const REST = (cfg.supabaseUrl || '') + '/rest/v1';
  const HEAD = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey };
  const pref = () => localStorage.getItem('vc_notos') || 'off';   // off | open | all
  const acct = () => (JSON.parse(localStorage.getItem('apex_account') || 'null') || {});

  function b64ToU8(s) {
    const pad = '='.repeat((4 - s.length % 4) % 4);
    const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  // ---- the daily card, published: every phone computes the same schedule, so
  // whoever boots first writes it and the push function can name the venue
  async function publishCard() {
    try {
      if (!window.SCHED || !cfg.supabaseUrl) return;
      const key = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate();
      if (localStorage.getItem('vc_card_pushed') === key) return;
      const card = SCHED.todays().map(r => ({ slot: r.slot, label: r.label, open: r.open, venue: r.def.name, mode: r.def.mode }));
      await fetch(REST + '/daily_card', {
        method: 'POST', headers: { ...HEAD, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ day: key, card }),
      });
      localStorage.setItem('vc_card_pushed', key);
    } catch (e) { /* offline: tomorrow's boot will get it */ }
  }

  // ---- subscribe / unsubscribe
  async function subscribe(mode) {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (window.toast) toast('Install VALCORSA to your home screen first, then flip this on');
      return false;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { if (window.toast) toast('Notifications are blocked for this site'); return false; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUB) });
    const j = sub.toJSON();
    await fetch(REST + '/push_subs', {
      method: 'POST', headers: { ...HEAD, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, player: acct().name || '', prefs: mode }),
    });
    return true;
  }
  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(REST + '/push_subs?endpoint=eq.' + encodeURIComponent(sub.endpoint), { method: 'DELETE', headers: HEAD });
        await sub.unsubscribe();
      }
    } catch (e) {}
  }

  async function setPref(mode) {
    if (mode === 'off') { localStorage.setItem('vc_notos', 'off'); await unsubscribe(); paint(); return; }
    const ok = await subscribe(mode);
    localStorage.setItem('vc_notos', ok ? mode : 'off');
    if (ok && window.toast) toast(mode === 'all' ? 'Race alerts ON — every slot, 20 minutes out' : 'Race alerts ON — THE OPEN, nightly');
    paint();
  }

  // ---- Settings section (injected; zero index.html edits)
  function paint() {
    const row = document.getElementById('notosRow');
    if (row) row.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.notos === pref()));
  }
  function inject() {
    const panel = document.querySelector('#settingsModal .panel');
    if (!panel || document.getElementById('notosRow')) return;
    const st = document.createElement('style');
    st.textContent = `
      #notosRow { display: flex; gap: 6px; margin: 4px 0 10px; }
      #notosRow button { flex: 1; min-width: 0 !important; padding: 8px 4px; font-size: 11px; }
      #notosRow button.sel { outline: 1.5px solid #ff8c1a; outline-offset: 2px; }`;
    document.head.appendChild(st);
    const sec = document.createElement('div');
    sec.innerHTML = `
      <p class="setNote">— RACE ALERTS —</p>
      <div id="notosRow">
        <button data-notos="off">OFF</button>
        <button data-notos="open">THE OPEN</button>
        <button data-notos="all">ALL RACES</button>
      </div>
      <p class="setNote">your phone taps you 20 minutes before the grid forms</p>`;
    panel.appendChild(sec);
    sec.querySelectorAll('[data-notos]').forEach(b => b.onclick = () => setPref(b.dataset.notos));
    paint();
  }

  // settings modal may not exist until opened — watch for it
  const mo = new MutationObserver(() => inject());
  mo.observe(document.body, { childList: true, subtree: true });
  inject();
  publishCard();

  return { setPref, publishCard, pref };
})();
