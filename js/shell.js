// VALCORSA — app shell. The paddock tab bar, screen exit transitions, and the
// My Music mode (step aside and let the player's own apps keep playing).
// Loads LAST in boot.js: it wraps open/close globals the other files define.
(function () {
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- animated closes
  // Open animations are pure CSS (they restart when display flips none->flex).
  // Closing needs JS: play .vcOut for 150ms, then run the original close.
  const CLOSERS = { closeGarage: 'garageModal', closeSettings: 'settingsModal', closeShop: 'shopModal', closePair: 'pairModal' };
  for (const fn in CLOSERS) {
    const orig = window[fn], id = CLOSERS[fn];
    if (!orig) continue;
    window[fn] = function () {
      const m = $(id);
      if (!m || m.style.display !== 'flex' || m._closing) { orig(); return; }
      m._closing = true;
      m.classList.add('vcOut');
      setTimeout(() => { m.classList.remove('vcOut'); m._closing = false; orig(); }, 150);
    };
  }

  // ---------------------------------------------------------------- the tab bar
  function modalOpen(id) { const m = $(id); return !!m && m.style.display === 'flex' && !m._closing; }
  function current() {
    if (modalOpen('settingsModal')) return 'settings';
    if (modalOpen('garageModal')) return 'garage';
    if (modalOpen('shopModal')) return 'shop';
    const v = $('venuesMenu');
    return (v && v.style.display !== 'none') ? 'venues' : 'home';
  }
  window.vcTabSync = function () {
    const cur = current();
    document.querySelectorAll('#tabBar button').forEach(b => b.classList.toggle('on', b.dataset.tab === cur));
  };
  window.vcTab = function (tab) {
    if (modalOpen('garageModal') && tab !== 'garage') closeGarage();
    if (modalOpen('shopModal') && tab !== 'shop') closeShop();
    if (modalOpen('settingsModal') && tab !== 'settings') closeSettings();
    if (tab === 'home') hideVenues();
    else if (tab === 'venues') showVenues();
    else if (tab === 'garage') { if (!modalOpen('garageModal')) openGarage(); }
    else if (tab === 'shop') { if (!modalOpen('shopModal')) openShop(); }
    else if (tab === 'settings') { if (!modalOpen('settingsModal')) openSettings(); }
    vcTabSync();
  };

  // bar shows on the paddock: menu shell up, first-run account screen not.
  // Modal styles are watched too so the highlight follows Done/Back buttons.
  function updateBar() {
    const menuUp = $('menu').style.display !== 'none';
    const acct = $('accountScreen');
    document.body.classList.toggle('tabsOn', menuUp && !(acct && acct.style.display === 'flex'));
    const np = $('nowPlaying');                       // the radio chip is a menu thing
    if (np && !menuUp) np.style.display = 'none';
    vcTabSync();
  }
  const mo = new MutationObserver(updateBar);
  ['menu', 'accountScreen', 'garageModal', 'settingsModal', 'pairModal', 'venuesMenu'].forEach(id => {
    const el = $(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['style'] });
  });
  const bodyMo = new MutationObserver(() => {           // the shop modal is built lazily
    const shop = $('shopModal');
    if (shop && !shop._observed) { shop._observed = true; mo.observe(shop, { attributes: true, attributeFilter: ['style'] }); updateBar(); }
  });
  bodyMo.observe(document.body, { childList: true });
  updateBar();

  // ---------------------------------------------------------------- My Music
  // 'own' = the rally house radio never plays; on iOS 17+ the ambient audio
  // session mixes our engine/SFX with whatever app is already playing.
  const src = () => localStorage.getItem('vc_msrc') || 'ost';
  function applyMusicSrc(s, byUser) {
    document.body.classList.toggle('ownMusic', s === 'own');
    const note = $('ownMusicNote'); if (note) note.style.display = s === 'own' ? '' : 'none';
    document.querySelectorAll('#musicSrcRow button').forEach(b => b.classList.toggle('sel', b.dataset.msrc === s));
    try { if (navigator.audioSession) navigator.audioSession.type = s === 'own' ? 'ambient' : 'auto'; } catch (e) {}
    if (!byUser || !window.RALLYHOUSE) return;
    if (s === 'own') RALLYHOUSE.stop();
    else if ($('menu').style.display !== 'none') RALLYHOUSE.start({ id: 'menu' });
  }
  document.querySelectorAll('#musicSrcRow button').forEach(b =>
    b.addEventListener('click', () => { localStorage.setItem('vc_msrc', b.dataset.msrc); applyMusicSrc(b.dataset.msrc, true); }));
  applyMusicSrc(src(), false);
})();
