/* VALCORSA — VALCORSA RADIO: the daily 3-minute in-world sports show.
   Two hosts (Ray Redline, play-by-play · Ana Cortez, analyst), hype-only,
   one episode per day. Speech via speechSynthesis (on-device, free), bed
   music from the rally-house library, jingle via WebAudio. Self-contained:
   injects its own menu button + modal; records race history by wrapping
   window.endRace. Push/lock-screen delivery = future plumbing. */
'use strict';
(function () {
  const R = { playing: false, li: 0, script: null, bed: null, utter: null };
  window.RADIO = R;

  const DAY = () => new Date().toISOString().slice(0, 10);
  const EP0 = Date.UTC(2026, 7, 7);
  const epNum = () => Math.max(1, Math.floor((Date.now() - EP0) / 864e5) + 1);
  function hash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h * 31 + s.charCodeAt(i), 0x9e3779b1) | 0; return Math.abs(h); }
  function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ---- race history: wrap endRace (top-level function decls live on window) ----
  const origEnd = window.endRace;
  if (origEnd && !origEnd._radio) {
    window.endRace = function () {
      origEnd.apply(this, arguments);
      try {
        const st = raceStandings();
        const pi = st.findIndex(c => c.isPlayer);
        const hist = JSON.parse(localStorage.getItem('vc_history') || '[]');
        hist.unshift({ d: DAY(), track: track.def.name, pos: pi + 1, n: st.length,
          best: player.bestLap ? Math.round(player.bestLap) : null });
        localStorage.setItem('vc_history', JSON.stringify(hist.slice(0, 30)));
      } catch (e) {}
    };
    window.endRace._radio = true;
  }

  // ---- the episode script (seeded per day: same show all day) ----
  const ADS = [
    ['RAY', "Quick word from our sponsor. Enginos. The heart of Valcorsa beats at nine thousand R P M."],
    ['ANA', "This episode is brought to you by BasilAxles. Are they good axles? Nobody knows. That's the fun."],
    ['RAY', "Brought to you by ChanesChassis. Collect the cards. Unlock the frame. Feel the... chassis."],
    ['ANA', "Sponsored by Xanboo Motor Corps. Cheap parts. Big dreams. Some smoke, probably."],
    ['RAY', "This one's sponsored by Perro Cola. The official soft drink of the jumping dog canyon. Woof."],
  ];
  const QUOTES = [
    ['ANA', "Our radio clip of the day. El Santo was asked if he fears anyone on the grid. He looked at the microphone... and he left, Ray. He just left."],
    ['RAY', "Radio clip of the day! Old Tomas, on the team channel, quote: I have been racing since before brakes were invented. And honestly? His braking data backs that up."],
    ['ANA', "Clip of the day: Greta's engineer asked her to save the tires. Greta responded, quote, the tires are a suggestion. Incredible athlete."],
    ['RAY', "Today's clip! Marisol's pit wall said box, box, box. She heard, quote, flat out, flat out, flat out. P4 anyway! This sport is beautiful."],
    ['ANA', "Clip of the day. Dmitri's engineer reports the entire radio conversation was, quote, breathing. Focused. We love to hear it. Literally."],
  ];
  const MAIL = [
    ['RAY', "Listener mail! Bruno from Granada asks: can I put two engines in one kart? Ana?"],
    ['ANA', "Legally, Bruno? The V C R A says ask again in writing. Physically? We believe in you."],
    ['RAY', "Listener mail! A fan asks: how do I get faster in corners? Ana, the professor's answer?"],
    ['ANA', "Brake earlier, turn once, and stop fighting the wheel. Smooth is fast. It's free, and nobody does it."],
    ['RAY', "Mail time! Anonymous asks: is El Santo human? We passed the question to his team."],
    ['ANA', "Their reply was a single air horn sound, Ray. Make of that what you will."],
  ];
  const ENVLINE = {
    desert: ['ANA', "Canyon air is thin and the gravel is loose out back — expect brave entries and braver exits."],
    city: ['ANA', "Street circuit rules apply: the walls give nothing back. Precision day."],
    countryside: ['ANA', "Fast, green, flowing. This is a rhythm track — find the beat and don't blink."],
  };

  function buildScript() {
    const r = rng(hash(DAY()));
    const S = [];
    const hot = window.HOTLAP ? HOTLAP.todaysTrack() : (typeof TRACKS !== 'undefined' ? TRACKS[0] : { name: 'the circuit', env: 'desert' });
    S.push(['RAY', `Goooood morning Valcorsa! You are locked in to VALCORSA RADIO, episode ${epNum()}. I'm Ray Redline!`]);
    S.push(['ANA', "And I'm Ana Cortez. Ray, drink your coffee, we have racing to discuss."]);
    // results drama — hype only
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem('vc_history') || '[]'); } catch (e) {}
    const last = hist[0];
    if (last) {
      if (last.pos === 1) {
        S.push(['RAY', `Let's get to it — the big story: P 1 at ${last.track}! A win! The crowd is still cleaning up the confetti!`]);
        S.push(['ANA', "A statement drive. Composed, committed, and the lap chart shows it — that one was earned."]);
      } else if (last.pos <= 3) {
        S.push(['RAY', `Big story of the day — a PODIUM at ${last.track}! P ${last.pos}, champagne earned!`]);
        S.push(['ANA', "And the pace is trending up. Whoever's on the pit wall over there — take a bow."]);
      } else {
        S.push(['RAY', `At ${last.track}, our headline driver brings it home P ${last.pos} of ${last.n} — and I saw FIGHT out there!`]);
        S.push(['ANA', "Points in the pocket, lessons in the notebook. Championships are built on days exactly like that one."]);
      }
      if (last.best) S.push(['RAY', `Best lap of the run: ${(last.best / 1000).toFixed(2)} seconds. Write it down, chase it tomorrow!`]);
    } else {
      S.push(['RAY', "The paddock is QUIET today, Ana. No timing sheets on my desk. I don't like it."]);
      S.push(['ANA', "The calm before a green flag, Ray. Somebody's about to go racing — I can feel it."]);
    }
    S.push(pick(r, QUOTES));
    S.push(pick(r, ADS));
    // track of the day
    S.push(['RAY', `Now — today's HOT LAP venue: ${hot.name}! One flying lap, the clock, and you!`]);
    S.push(ENVLINE[hot.env] || ['ANA', "A proper driver's track. Clean hands, big heart."]);
    S.push(pick(r, MAIL));
    S.push(['RAY', "That's the show! Race hard, be kind to your tires — Ana, send us home."]);
    S.push(['ANA', "Grip is a promise, not a guarantee. Drive accordingly. This was Valcorsa Radio."]);
    return S;
  }

  // ---- voices + playback ----
  let vA = null, vB = null;
  function pickVoices() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.startsWith('en'));
    if (!vs.length) return;
    vA = vs[0]; vB = vs.find(v => v !== vA) || vs[0];
  }
  if ('speechSynthesis' in window) {
    pickVoices();
    speechSynthesis.onvoiceschanged = pickVoices;
  }
  function jingle() {
    try {
      if (typeof audio === 'undefined' || !audio.ctx) return;
      const t0 = audio.ctx.currentTime;
      [523.25, 659.25, 784, 1046.5].forEach((f, i) => {
        const o = audio.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = audio.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.5);
        o.connect(g); g.connect(audio.master);
        o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.55);
      });
    } catch (e) {}
  }
  function speakLine() {
    if (!R.playing || !R.script) return;
    if (R.li >= R.script.length) { R.stop(true); return; }
    const [host, text] = R.script[R.li];
    const sub = document.getElementById('radioNow');
    if (sub) sub.innerHTML = `<b>${host === 'RAY' ? '🎙️ RAY' : '🧠 ANA'}:</b> ${text}`;
    if (!('speechSynthesis' in window) || (!vA && !vB)) {     // no TTS: readable transcript pace
      R.utter = null;
      R._t = setTimeout(() => { R.li++; speakLine(); }, 340 + text.length * 55);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    if (host === 'RAY') { u.voice = vA; u.rate = 1.08; u.pitch = 1.15; }
    else { u.voice = vB; u.rate = 0.96; u.pitch = 0.82; }
    u.volume = 1;
    u.onend = () => { R.li++; speakLine(); };
    u.onerror = () => { R.li++; speakLine(); };
    R.utter = u;
    speechSynthesis.speak(u);
  }
  R.play = function () {
    if (R.playing) { R.stop(); return; }
    R.script = buildScript();
    R.playing = true; R.li = 0;
    localStorage.setItem('vc_radio_last', DAY());
    const dot = document.getElementById('radioDot'); if (dot) dot.style.display = 'none';
    const btn = document.getElementById('radioPlayBtn'); if (btn) btn.textContent = '⏹ Stop';
    try { R.bed = new Audio('music/take-you-higher.mp3'); R.bed.loop = true; R.bed.volume = 0.07; R.bed.play().catch(() => {}); } catch (e) {}
    jingle();
    setTimeout(speakLine, 700);
  };
  R.stop = function (natural) {
    R.playing = false;
    clearTimeout(R._t);
    try { speechSynthesis.cancel(); } catch (e) {}
    if (R.bed) { try { R.bed.pause(); } catch (e) {} R.bed = null; }
    const btn = document.getElementById('radioPlayBtn'); if (btn) btn.textContent = '▶ Play Episode';
    const sub = document.getElementById('radioNow');
    if (sub && natural) sub.innerHTML = '<b>— end of episode ' + epNum() + ' —</b>';
    if (natural) jingle();
  };

  // ---- UI: menu button + modal (injected: zero index.html edits) ----
  const css = document.createElement('style');
  css.textContent = `
    #radioBtn { position: relative; }
    #radioDot { position: absolute; top: 4px; right: 6px; width: 9px; height: 9px; border-radius: 50%;
      background: #e23b2e; box-shadow: 0 0 6px #e23b2e; }
    #radioModal { display: none; position: fixed; inset: 0; z-index: 72; align-items: center;
      justify-content: center; background: rgba(8,10,14,.78); backdrop-filter: blur(6px); overflow-y: auto; }
    #radioModal .panel { max-width: 480px; width: 92vw; }
    .radioHead { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; opacity: .7; }
    #radioNow { min-height: 84px; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px; padding: 12px 14px; font-size: 15px; line-height: 1.5; text-align: left; }
    #radioNow b { color: #e2b654; }
    .radioCast { font-size: 12.5px; opacity: .6; }`;
  document.head.appendChild(css);
  function inject() {
    if (document.getElementById('radioBtn')) return;
    const row = document.getElementById('diffRow');
    if (!row) return;
    const b = document.createElement('button');
    b.className = 'navBtn'; b.id = 'radioBtn';
    b.innerHTML = '📻 RADIO' + (localStorage.getItem('vc_radio_last') === DAY() ? '' : '<span id="radioDot"></span>');
    b.onclick = openRadio;
    row.insertBefore(b, row.firstChild);
    const m = document.createElement('div');
    m.id = 'radioModal';
    m.innerHTML = `<div class="panel">
      <p class="radioHead">Valcorsa Radio · Episode ${epNum()} · ${DAY()}</p>
      <h2>📻 The Morning Grid</h2>
      <p class="radioCast">with Ray Redline &amp; Ana Cortez · hype only, always</p>
      <div id="radioNow">Today: results drama, the radio clip of the day, and your Hot Lap track preview.</div>
      <button id="radioPlayBtn" onclick="RADIO.play()">▶ Play Episode</button>
      <button onclick="RADIO.close()">Close</button>
    </div>`;
    document.body.appendChild(m);
  }
  function openRadio() { inject(); document.getElementById('radioModal').style.display = 'flex'; }
  R.close = function () { R.stop(); const m = document.getElementById('radioModal'); if (m) m.style.display = 'none'; };
  inject();
})();
