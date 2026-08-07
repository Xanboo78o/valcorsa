# Valcorsa
**Home of racing.**

Design document — locked 2026-08-06. This is the canon. Changes require a design session.

---

## 1. The One Sentence

> **"Bro hop on, we've got a race in 20."**

Valcorsa is a persistent friend-group racing *league*, not a racing game. The shared possession is the season standings. It lives at one browser link, runs on any phone/iPad/laptop, and the world keeps moving whether you're online or not.

**The emotional north star:** the game manufactures recognition for kids who don't usually get it. The quiet kid who cooks at rally gets a fanbase. The redstone kid who can't drive becomes a legendary engineer. Every system serves "being known for something."

**Market position (Aug 2026):** the "friendslop" co-op wave (Lethal Company → R.E.P.O. → PEAK) is Steam-only, paid, PC-only, and session-based with no persistence. Valcorsa takes the same friend-group chaos energy and fills both gaps: free browser link + a persistent thing the group owns.

---

## 2. The League

- One league per friend group. Accounts. New players can join at any season boundary.
- **Seasons last 1 month** (~20 scoring days). Monthly champion. Trophies persist forever.
- **The trophy is the Valcorsa Cup.** Winning it makes you a celebrity in-world — fame and lots of prize money. Money buys parts, chassis, cosmetics — *options, never raw power* (budget caps guard fairness; see §5).
- **Silly season:** 2–3 dead days between seasons — awards (champion, best engineer, most improved, biggest crash), head-to-head brags, team swaps, drama.
- **Teams of 2** (driver pairs sharing a garage/engineer) + **constructors championship** alongside the drivers' title. Team names, liveries.
- Long-term persistence under monthly resets: **track records** at every venue, held by name, forever. Lifetime head-to-head records. Trophy cases. Follower counts.

## 3. The Calendar

- A race every day. **Mon/Wed/Fri/Sat/Sun full points; Tue/Thu reduced** (practice-stakes days).
- **Missing days is never punished.** Drop-round scoring: only your best N races per week count. Racing extra days buys insurance (deletes your worst result), never extra points.
- **Weekdays = async ghost races.** Track of the day, run it whenever you want that day against the live-recorded ghosts of your league. Wordle-of-racing: everyone talks about the same race.
- **Weekends = live lobbies.** Full grids, voice chat, chaos. That's why they're worth more.
- **The daily reveal** is a group-chat moment: venue + mode + budget cap, not known in advance. The season is a **tour** — it travels the country, so region hints at mode without spoiling it.
- Flat F1-style points curve. Small points, they add up. Consistency beats peaks; the sweatiest complete racer wins.

## 4. The Five Modes

Each mode tests a *different skill*. The champion is the most complete racer.

| Mode | Tests | Notes |
|---|---|---|
| **F1** | Handling, precision, the perfect line | Clean racing, no items |
| **Circuit** (NASCAR) | Passing & defending — 70% of the strat | Cranked slipstream keeps packs together; skill is positional, reading people |
| **Rally** | Drifting, car control, nerve | Solo vs clock, loose surfaces — the natural ghost mode |
| **Speedkart** | Raw speed, reactions | Everything faster; one mistake unrecoverable |
| **Smashkart** | Chaos management, creativity | Mario Kart DNA: items, flying, cursed builds |

- **No mains — Favorites.** Everyone races every mode. Favorite = identity/cosmetics only, zero scoring bonus. Get good at everything or you'll suck.
- **Smashkart is the game's front door.** (Locked 2026-08-06.) Scoring stays equal across modes, but Smashkart is the flagship identity — the Quick Race default, first on the venue list, the mode a brand-new player lands in ten seconds after opening the link. Valcorsa markets itself with chaos; the championship teaches depth later.

## 4.5 Smashkart Items (LOCKED 2026-08-06)

**Laws:** every item is a physical object with a dumb physical verb — no abstract powers, no
pure utility (shields/hooks/boosts were considered and vetoed). Items ride visibly on the
roof rack (everyone can see what you're carrying — bluffing and "HE'S GOT
THE SAW" are gameplay), plus ONE deliberate HUD exception: a round poster-styled item box,
top middle, showing your own carry (Adam's call, 2026-08-06). Distribution is comeback-curved (leaders draw mild, backmarkers draw
monsters). **Venue pools:** the core six appear everywhere; the regional six only at their
venues — the item pool prints on the daily race card, so trash talk starts at reveal.
"Flying" in Smashkart means airborne ALONG the track — glides down the road, not hops.
A few item interactions are coded and never documented, per standing law.

**THE CORE SIX (every Smashkart race):**
1. **Spare Tire** — thrown; bounces with real physics, ricochets, persists as a rolling hazard.
2. **Coolant Dump** — vent a slick behind you; spins victims; your engine runs hot for a lap.
3. **The Saw** — lunge; cuts one bolted part off the victim's kart; their handling really changes.
4. **The Jack of Hearts** — a giant playing card (J♥). Spring-launch up and FORWARD into a
   glide along the track. The flying item. Twirls gently on the roof rack of whoever holds it.
5. **Air Horn** — stadium-horn pressure blast; shoves every nearby kart away. Its sound is its warning.
6. **Fireworks Volley** — three tifosi rockets, dumb-fired spread. No guidance. Valcorsa believes in more fireworks.

**THE REGIONAL SIX:**
7. **Snowballs** *(alpine north)* — a volley rolls forward along the track hunting P1, growing
   as it goes, happily flattening anyone in the path. The north's answer to the blue shell.
8. **Los Monos** *(the south)* — summons monkeys. What they do is RANDOM: might band together
   and push your kart, might sabotage your steering, might throw poop and rocks at your
   enemies. Full behavior table undocumented forever.
9. **Pocket Storm** *(wet southern flats)* — a personal raincloud adopts your target; their
   grip goes to soup for ~10s; everyone else stays dry.
10. **Saint's Candle** *(Heiligen venues + night races)* — brief ghost-form; karts, tires,
    snowballs and monkeys pass through you. The saints briefly look away.
11. **Road Works** *(city streets)* — official cones + a municipal speed bump that LASTS the
    whole race. The track evolves lap by lap.
12. **Scrap Magnet** *(industrial venues)* — crane magnet gathers loose debris (thrown tires,
    sawed-off parts) into an orbiting junk shield. Yes, it can catch your rival's own fender.

**Open:** the Saw's teeth — do severed parts stay off all race, or return after a lap?
(Decides mischievous vs vicious; Adam to rule.)

## 5. Budget Caps

Every race reveals a **budget cap** — every legal build must fit under it. The cap is a dial, not a rule:

- **Cap 0–1 (stock days):** everyone in near-identical karts. Pure skill. Also the new-player equalizer — an empty garage is zero disadvantage.
- **Mid caps:** the real chess. What do you cut? Different teams answer differently.
- **Unlimited (rare, special):** the engineer's Super Bowl. **Builds secret until the grid** — covers come off, everyone loses their minds.
- Unlocking parts/chassis (~20 chassis planned) grants *options*, never raw power. The genius engineer beats the grinder because building well under a cap is the puzzle.
- The calendar doubles as the balance patch: a broken meta build dies when the caps stop allowing it.

## 6. The Garage & The Car Sim

**LOCKED: the car is real, not theater.** Functional simulation built from **three connection primitives**:

1. **Mechanical** — bolts, welds, duct tape: joints with strength. Sawing cuts them.
2. **Electrical** — wires carry signal/power from sources to devices.
3. **Fluid** — fuel and coolant lines from tanks to engines.

Every part = connection points + weight. Everything else emerges. The proof case: a second engine bolted in the trunk, hooked to fuel — never designed as a feature, possible because the systems are real.

- **Engineer gameplay is hands-on:** four views — **Engine, Bottom, Cockpit, Trunk**. Drag parts on, solder wires (drag motions), saw parts off, screw them down, duct-tape them (fast, janky, fails when you least want it).
- **The trunk is literal spares storage** — space and weight tradeoffs, no inventory menus.
- **The cockpit is the HUD.** There is no game UI in the car. Speedometer exists only if installed. Steering-wheel buttons the engineer adds become the driver's actual controls.
- **Knowledge asymmetry:** drivers *feel* symptoms (thunky sound, dead blinker — emergent from real state); engineers *see* causes (system views drivers don't get). The duo has to talk. Engineers read cars like master builders.
- **Garage privacy toggle:** fully open / semi / closed spectating. Open = showman fame. Closed = mystique and grid reveals.

**Two doors, one garage:**
- **Basic build (casual door):** Mario Kart-style — swap chassis/wheels/engine, balance stat bars. Underneath, the game assembles a REAL build (one truth, no parallel systems). Parts you don't see/understand stay untouched.
- **Sim garage (engineer door):** full hands-on access.
- **The graduation moment:** any casual can open the hood of their preset and discover it's made of stuff. The skill ceiling recruits from its own casuals.
- Presets are lore: stock builds are **factory cars from Valcorsan manufacturers** (Enginos = the Ferrari of Valcorsa). Engineers publishing builds for teammates = founding a constructor.

**Handling: arcade on top, truth underneath.** Kart-feel, drifty, generous — but grip comes from the tires bolted on, acceleration from engines and fuel routing, balance from where weight sits, and damage bends the feel (bent suspension pulls left; taped joints rattle at speed).

## 6.5 The Garage Update (LOCKED 2026-08-06 — 20-Q session, full log in GARAGE-QA.md)

**Damage** (the reason Speedkart/Smashkart are self-preservation modes): sources = wall
hits, car-car crashes, over-revving, drift-wearing racing tires, items. Impact damage
scales with speed; above ~198 km/h = catastrophic ("carisvaporizeditis"). Bad accidents
SHATTER the car = DNF, scoring points for laps completed. Minor damage (flat, fender)
is felt (joggly screen, wiggly steering, phone buzz, sounds, unreliability — FULL
sensory symptom language, no text) and auto-fixes post-race; MAJOR damage (shatters,
blown engines) persists and must be repaired in the garage. Damage never crosses a
season. Overheat = forgiving redline meter; heat must never change race strategy.
Damage LOOK = true part states (missing fender, flat wobbling tire, steam) + toon flair.
The Saw's cut: victim can never reattach; the part stays on track, Scrap-Magnet legal.

**Liveries:** a team's stable of built karts. Racers pick from the livery and karts are
snatched in REAL TIME (multiple racers per livery per race — teammates can take the
good one). Two build doors: **Simpleton Garage** (chassis/wheels/engine + stat bars)
and **Engineer Garage** (full sim, real gestures — saw/solder/screw/tape — iPad-first).

**Economy:** **PartsPacks** from a sponsor of your choice — Valcorsa (expensive, very
high reward), Xanboo78MotorCorps (cheap, high yield), BasilAxles (mid price, low count,
trash-or-legendary variance), ChanesChassis (chassis CARDS; collect a set → unlock
buying that chassis). **Parts Store:** giant catalogue of every single part, launched
COMPLETE, confusing-ish but coherent to engineers. Money mostly from race winnings,
sometimes in packs. **Consumables are the floor: bolts and washers run out.** League
engineers can sell their skills/builds in shop (player market — the redstone kids get
famous). Garage secrets = emergent combos only; the honest sim is the mystery.

**The VCRA** (governing body, now canon): sets part limits (budget caps) and per-race
regulations on the daily card — "no more than 4 tires," "no moving aero," trunk/spares
legality. Anything that bolts, runs — within the card.

**Pit wall:** live telemetry dashboard + voice for ANYONE on the team (engineer is the
natural pick). No remote tweaks — influence flows through the human voice.

**Build order:** all three sim primitives together; first shipped slice = DAMAGE
(wire existing races into these rules before the garage economy exists).

## 6.6 The Standardization — Parts System v2 (LOCKED 2026-08-07 — 19-Q session, log in PARTS-QA.md)

**The lore IS the migration:** the VCRA passes the **Standardization Act**. The old
~190-part catalogue is retired — owned pre-standard parts become non-functional
**legacy collectibles** ("pre-standard era" shelf relics) plus a ₡ refund. The whole
industry now speaks one decodable language.

**The language (the point of the update):** real terminology *of the Valcorsa world* —
codes and acronyms that MEAN things and can be learned. **Per-family dialects, like
Earth industry** (tire codes read differently than oil, which reads differently than
bolts — each family is its own little language to get famous for knowing). On top:
**Brand · Model · Code** ("Enginos Tempesta — B-L2 2400") — brand carries personality
and quality bias, the code carries the truth.

- **Size is physical law:** S / M / L classes on bays, mounts, flanges, seats. An M cam
  will not seat in an L head. Cursed adapters may exist as parts.
- **Full spec sheets** on every part; **real-logic math** when parts combine —
  simplified but honest physics (displacement × cam × induction shape the power curve;
  cooling headroom vs heat; mass matters). Predictable to someone who LEARNS it.
- **Units:** honest metric (cc, mm, kg) + **vp "valc-power"**, Valcorsa's own dyno unit
  (40 lawnmower → 800+ open top; VCRA caps races in vp) + the **VM bolt standard**
  (VM8×24). Approved dialect drafts: tires `210/55 R14-S`, oil/coolant `C10-40`,
  fuses `F-30`, wire `W-2.5 ×5m`.
- **Fully atomic catalogue, 13 systems:** engine internals · induction · fuel ·
  exhaust · cooling · drivetrain · suspension · brakes · wheels & tires · electrical ·
  aero & body · cockpit · hardware/consumables. (Anatomy map: PARTS-ANATOMY.svg.)

**The Workbench loop** (diagram: WORKBENCH-LOOP.svg): the Engineer door opens into a
**3D garage you move through by tapping between stations** (shelves/racks/drawers by
system — bought parts arrive here). You **grab** what you need, then **stage the SIX
BENCH BINS** — size-weighted: an L block fills a bin ×1, M parts stack ×4, hardware
×24. You build FROM the bins; what you didn't grab you don't have (forgot the gasket =
a whole trip — the trip is the game). Building enforces fitment, consumes bolts, and
computes specs live. A finished build is **named + signed + earns its designation**:
"WIDOWMAKER · L24T · 486 vp · built by Adam · S1" — the designation is computed from
what's inside, never chosen. Builds drop into Simpleton karts, and are the unit of
future engineer-shop commerce (see teams canon).

**THE GARAGE GARAGE (Adam's reveal):** the Engineer Garage environment will eventually
be **Adam's real house garage, 3D-reconstructed from ~30 photos**, with his real bins
as the in-game storage. The v1 built garage uses the same station layout so the swap
is seamless.

**The store:** ONE big national parts store — aisles organized by system like a real
parts store, brands are shelves within aisles. Packs stay generic gambling.

**First slice (one-primitive rule): the ENGINE BENCH.** Garage stations + six bins +
bench with only the engine stack atomic (blocks, cranks, pistons, cams, heads, turbos).
Everything else stays as-is until the next slice.

## 7. Controls & Views (LOCKED: phone-first)

- Device: **phone or iPad**, that simple. (Laptop/Chromebook supported — it's a browser link.)
- Racer views: **FPS** (you see the cockpit your engineer built — instruments only if installed) and **3rd person** (steering-wheel buttons map to the screen edges as touch buttons).
- Steering modes: **tilt-to-turn** and on-screen **steering wheel**.

## 8. Challenge Races

- Anytime PvP: challenge anyone for practice and beef. **Zero season points, ever.**
- **Lifetime head-to-head records** tracked and displayed (Marcus 12–9 you). Rivalries are self-fueling.
- Private lobbies double as the engineer's test track — any mode, any cap, teammates only, secrets safe.

## 9. The World

**Valcorsa** — always written "Valcorsa," never all-caps in branding. A nation of racing fanatics; racing is their baseball AND their football. Settler lore: they crossed into this land, felt "HOME!?", and found speed as a comfort. Racing isn't a sport with fans — it's the national faith, canonized in two settler tongues (*San* in the south, *Heiligen* in the north).

**North aesthetic (locked):** Dungeons of Hinterburg energy — bright alpine tourist-town, saturated pastel mountains, painted shutters, gondolas, trail signage. The Heiligen north is charming first, rugged second.

- **Geography:** shaped like Russia merged with South America, sized like Australia. Big country, but every track is close — literally everyone has a home track.
- **North:** hilly, Anglo/Germanic names. Rally and smashkart country. **Ft. Houndsborough** — huge city, F1 race.
- **South:** flat and wet, Spanish names. Circuit country; rain is a regional personality. **Granada** — small town, smashkart/speedkart.
- **San Volante** — the holy city ("Saint of the Wheel") and **the finale venue**. Home of the season-ending pentathlon track (see §10.5).
- **COM racers with lore:** named persistent locals fill every grid. Difficulty scales with venue prestige (Granada farmers vs Houndsborough killers). Locals become shared league rivals and hold track records until players take them.

## 10. Rally der Heiligen (the October major)

The Iditarod with cars. Every October, a **real-time, month-long, ~8,000-mile point-to-point rally** east→west along the north coast. A pilgrimage. Winning a month makes you a champion; winning October makes you a saint (distinct permanent trophy).

- **Daily budget: 2 checkpoints/day.** The race is won by efficiency — clean driving, route choice, weather timing — never by hours played. Bounded daily progress keeps it schoolable and keeps nobody mathematically dead early.
- **Effectively unlimited build cap** — because the loot feeds it (below).
- **Diegetic tows:** wreck it and you're towed at 50mph-over-rough-terrain to the next checkpoint. The tow happens in-world; rivals drive past you mid-tow. (Cars need a horn button.)
- **Damage is doctrine:** every car breaks ~20 times per event. Graded damage by what you hit (hindered/inaccurate/flipped). Push-broken-or-wait-for-repair, with cascade risk (cracked radiator → overheat → dead engine → tow). Teams KNOW and prepare.
- **Persistent damage** across the month; the engineer's job is nightly.
- **Checkpoint garages (the roguelike layer):** loot tables generated once per event, themed per checkpoint (this year 200 rolled winter, 400 rolled engines). Limited stock + basics always available (wires, brake plates, headlights) + crazy uniques. **+10% chance to restock one item per player arrival** — traffic feeds the resupply; hot checkpoints become bazaars. Loot quality **ramps westward** (hidden catch-up curve; everyone's build spirals into madness together for the finale).
- **Loot intel:** hidden until first arrival, then public on the dot map. Fast teams reveal the map for everyone; fans become an intelligence agency.
- **The dot map:** live spectator page, no account needed — everyone's dot crawling across Valcorsa. THE recruitment funnel. Spectate live stages; follower counts on profiles.
- The car you finish with is a chimera written by luck, damage, and choices. The finisher's portrait matters.

## 10.5 The San Volante Finale

Every season ends in the holy city on one **huge track with five sections, one per mode, in sequence**:

> **Smashkart → Speedkart → Circuit → Rally → F1. Two laps. Whoever comes out top, comes out top.**

- Each section enforces its discipline through terrain and zone rules (items live only in the smashkart section; slipstream cranked in the circuit section; loose surface in rally; clean precision to the flag).
- Lap 1 you learn it, lap 2 decides it.
- **One car for all five sections** — the engineer's generalist exam. A year of specialist builds, and the finale asks: what do you compromise?
- The design thesis as asphalt: the champion must be the most complete racer. No hiding.

## 10.6 The Valcorsan Year

Three majors with three different personalities:

- **October — Rally der Heiligen** (the grind major, fixed): the pilgrimage. See §10.
- **April — the Clover Cup** (the luck major, fixed): all month, clovers spawn on the tracks of a huge sprawling open-world city course. No fixed racing line — navigation, route-craft, and greed management, the skills no mode tests. Common clovers on safe roads; rare fat ones in terrible places; the four-leaf is a once-a-year legend-maker. **Clovers are currency** — and in April, PvP challenges become **cloven or uncloven**: cloven means clovers are bet on the result. Betting on yourself is the best income a racer has. April is the economy's harvest season.
- **Con chó nhảy — the Wandering Major** (roaming): theme rotates yearly (water year, fire year, ...) and **its month is unknown — any month except April and October**. The announcement is itself an event; nobody can circle it on a calendar. (Named by Valcorsa's Vietnamese community — "the jumping dog." They do stuff like that. Third settler tongue confirmed.)

All other months are normal touring seasons flavored by **seasonal + regional weather**: January is snow up north and Florida-warm down south; the same venue races differently by month. Weather is content.

## 11. Tech Notes

- Browser, one link. **Engine: forked from Apex Racer (2026-08-06)** — three.js low-poly racing with weather, day/night, AI personas, procedural music, accounts, phone-as-wheel pairing, garage cosmetics. Also reusable later: **Supabase Realtime** netcode patterns from BIG PROBLEM; Netlify deploy flow; INKOGNITO doodle tech if drawn liveries happen.
- **First playable is LIVE: https://valcorsa.netlify.app** (Netlify site `valcorsa`, siteId `d9452681-e2a7-423c-a757-3b2e86df4508`). Local dev: `node server.js` in this folder → http://localhost:3000. Six venues: Ft. Houndsborough GP (F1), Granada Town Sprint (Speedkart), Heiligen Stage — North Coast (Rally, point-to-point), Bahía Lluvia Speedway (Circuit), Cañón del Perro Saltarín (Smashkart, no items yet), San Volante — The Pentathlon (FINALE: 5 sectors, dirt Sector IV via surfaceZones, 2 laps). Grids filled by named Valcorsan locals; ~1 in 5 races **El Santo** appears (the engine's ringer bot, renamed — he keeps his entrance theme).
- **Build order flag (do not skip): the car sim core is the next prototype.** A bare chassis on a flat plane — bolt an engine, wire a cockpit button, saw off a fender, drive the result. Everything stands on that slice. League/seasons and the real garage come after.

## 12. Open Threads (next design sessions)

1. **The map** — draw Valcorsa: regions, terrain, marquee venues, San Volante's pin on it.
2. **Major details** — Clover Cup scoring/duration; the Wandering Major's NAME, its warning time (announced day-of? a week out?), and what water/fire years actually change.
3. **Finale details** — cap rule for the San Volante race (stock? mid-cap? season car?), and how finale points weigh against the season.
4. **Economy** — what money buys, prize amounts, celebrity/fame mechanics.
5. Points values, N for drop-rounds, grid sizes, track counts per venue.
6. Local COM characters — names, personalities, the first legends.
7. Spectator/fan features scope (follows, cheering, clips).
8. Engineer repair depth at normal-season scale (nightly Heiligen surgery vs weekday tune-ups).
9. **Standardization details** — each family's full code dialect (engine designation
   grammar: bay letter + displacement/100 + flags, e.g. L24T); the engine-stack catalog
   contents (how many blocks/cams/heads/turbos, their specs and prices); the garage v1
   station list; legacy refund values; VCRA vp caps per mode/day.
10. **The garage scan** — capture checklist for Adam's ~30 photos, reconstruction
   pipeline, bin mapping.
