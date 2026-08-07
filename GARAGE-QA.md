# THE GARAGE UPDATE — 20-Question Design Session
*Started 2026-08-06. Adam's insight that triggered it: Speedkart/Smashkart are
self-preservation modes because YOUR CAR CAN BREAK. Answers logged as we go;
locked outcomes fold into DESIGN.md §6 at the end.*

Already locked (DESIGN.md §6, for reference — not re-asked): 3 connection primitives
(mechanical/electrical/fluid), 4 garage views, physical verbs (saw/solder/screw/tape),
trunk = spares, engineer builds driver's cockpit UI, two garage doors (presets ARE real
builds), drivers feel symptoms / engineers see causes, arcade handling from real params.

## The 20

1. What causes damage in a NORMAL race? — **ANSWERED:** wall hits, car-to-car crashes,
   over-revving, excessive drifting wears racing tires (tire type matters), + items.
2. Mid-race recovery / DNF? — **ANSWERED:** DNF exists — a bad enough accident SHATTERS
   the car, race over. Minor damage = felt, not fatal: flat tire → screen gets joggly,
   steering gets wiggly. No pit lane mentioned; you carry your wounds to the flag.
3. Damage persistence — **ANSWERED (TIERED):** within Smashkart, damage lasts the RACE
   only, never the whole season. Post-race: small stuff (flat tire, fender bump)
   auto-fixes; BIG stuff (DNF shatters, engine overheats/blown) persists and must be
   actually repaired in the garage.
4. The Saw ruling — **ANSWERED:** the victim can NEVER reattach it, but the severed part
   stays physically on track and CAN be Scrap-Magneted. Your fender is gone for you,
   alive for your enemies.
5. Symptom design — **ANSWERED: FULL SENSORY.** Phone vibration buzzes, noises, steering
   bumps, screen shake, slowness, engine unreliability. Crash damage scales with speed:
   impacts above ~198 km/h do BIG damage (fatal-tier: "carisvaporizeditis," the rare
   disease occurring when you dump your car into anything above mach 8 — canon joke,
   keep it in flavor text somewhere).
6. v1 part catalog — **ANSWERED: EVERYTHING AT ONCE.** The whole giant catalogue from
   day one. Confusing immediately, engineers feast. The Heiligen spirit.
7. Sim build order — **ANSWERED: ALL THREE AT ONCE.** Mechanical + fluid + electrical
   before the garage opens. The full trinity; catalog's weird parts work on day one.
8. Overheating — **ANSWERED:** simple redline meter, SUPER forgiving — Adam's law: heat
   must NOT change race strategy. Clean/normal driving never thinks about it; only
   sustained flagrant abuse (long over-revving) tips into overheat damage.
9. Parts economy — **ANSWERED: PartsPacks + the Parts Store.**
   **PartsPacks** (soft gambling): pick your sponsor —
   - **Valcorsa** — expensive, very high reward (the national brand)
   - **Xanboo78MotorCorps** — cheap, high yield
   - **BasilAxles** — mid price, low count, huge variance: absolute trash (screws) OR legendary gold parts
   - **ChanesChassis** — very high chance of CHASSIS CARDS; collect enough (e.g. F1
     chassis cards) → unlocks buying that chassis from the store
   **Parts Store:** a GIANT catalogue of every single part. Deliberately confusing-ish
   but makes sense to engineers (catalog literacy = engineer skill). Parts cost money.
   **Money:** mostly from winning races; sometimes inside PartsPacks.
10. The money feel — **ANSWERED (reframed by Adam): CONSUMABLES ARE THE FLOOR.** Your
    garage holds finite bolts and washers — you WILL have to buy more. Every build and
    repair burns hardware. **Price sheet v1 DRAFT is LIVE for tuning:** payouts P1 ₡250
    → P12 ₡46, DNF = laps×25+15; packs — Valcorsa ₡400/5 pulls, XB78 ₡80/6, BasilAxles
    ₡200/2, ChanesChassis ₡250/3 (75% cards, 3 cards unlock a chassis); consumables ~₡5-15,
    engines ~₡50-1100 by rarity; silly parts FREE per canon. Currency: **₡ the Corsa**
    (name = my draft, Adam may rename).
11. The casual door — **ANSWERED: LIVERIES.** A livery (team stable) holds multiple built
    karts; racers pick from it and karts get SNATCHED IN REAL TIME (teammates can take
    the good one first — multiple racers per livery per race). When BUILDING, two garages:
    **Simpleton Garage** (chassis/wheels/engine + stat bars — and most casuals never even
    look at the bars, only pre-engineers do) and **Engineer Garage** (full sim). Most
    casuals never build at all — they grab from the stable.
12. Touch verbs — **ANSWERED:** real gestures for every verb (saw drags back-and-forth,
    trace solder, twist screws, drag tape). Design target: **iPad-first for the Engineer
    Garage** — "most engineers would be on iPad, they need tha space."
13. Engineer's live race role — **ANSWERED:** telemetry + voice, and the pit dashboard is
    open to ANYONE on the team (engineer is just the natural pick). No remote tweaks;
    all influence flows through the human voice.
14. Solo players — **ANSWERED: PLAYER MARKET.** League engineers can help people learn,
    or SELL their ability in the shop — builds and repairs as services. The redstone
    kids get famous and rich. (Adam reacted ":0000" — this one sparked joy.)
15. Trunk in normal races — **ANSWERED:** the race card decides — trunk/spares legality
    is another VCRA regulation line in the daily reveal.
16. Cursed builds — **ANSWERED:** anything that bolts, runs — physics is the judge — BUT
    **the VCRA** (Valcorsa's governing body, now canon) sets part limits (the budget
    caps), and individual races carry regulations on the daily card: "no more than 4
    tires," "no moving aero." Finding what's legal-but-cursed is the sport.
17. Visual damage — **ANSWERED: both.** Literal part states (fender GONE, tire visibly
    flat and wobbling, steam from the hood, sheared bolt stubs) PLUS toon flair on top
    (stars on big hits, comic smoke). Honest skeleton, expressive skin.
18. DNF and points — **ANSWERED:** points for laps completed (partial credit). A lap-2
    shatter still beats not showing up.
19. Garage secrets — **ANSWERED: emergent combos only.** No scripted easter eggs — the
    secrets ARE the honest sim. Engineers discover; the lunch table is the wiki.
20. First slice — **ANSWERED: DAMAGE FIRST.** Wire existing races into the new rules now
    (crash/wall/over-rev/drift-wear damage, full-sensory symptoms, DNF shatters,
    laps-completed points). Garage economy second. Racing feels dangerous THIS WEEK.

## SESSION COMPLETE — 20/20 answered 2026-08-06. Folded into DESIGN.md §6.5.
