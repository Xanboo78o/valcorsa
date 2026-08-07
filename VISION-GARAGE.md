# THE ENGINEER GARAGE — Adam's vision (verbatim, 2026-08-07)

The north-star user story for the full Engineer Garage. Fix the gap between
this and the current bench slice. (Bench UX fixes + jank system shipped same day.)

## The vision, in Adam's words

Walk into the garage with joystick, and a problem. "Liam said the OPAT V1 makes
a jiggling sound on turns. lets fix it." (selects OPAT v1 from the car selection)
Then walks to the car, and gets a 3d view where he can rotate, zoom and all and
see every part. "ah! the suspension is loose, and i think i could make the
suspension better while im here." Exits view, goes to the other shelves where HE
stores his suspension (a garage is a big area with a car and shelves that are
just a grid of slots really) and grabs 4. Replaces and tightens, puts a new
sticker on from Liam's sticker collection from winning, renames it the OPAT v2,
sends it out.

Then selects the MONO v3. Derek says it's too slow. "No problem, I've been
wanting to see what my custom v8 + 4 turbochargers does." Grabs the stuff, pops
the hood, takes it out — "OH I NEED SCREWS!" — grabs screws, takes engine out,
"I'll put this in the back." Tries to fit the custom engine — it doesn't fit.
Takes out the drift limiter (Derek doesn't use it). Puts the custom engine in.
But he doesn't know how to connect a Ftg fuel line to a KNOT intake — watches a
YT vid, does it. Struggles to fit 4 turbochargers (lol). Adds a fuel line from
the tank to the back, a coolant line, straps the engine, connects it, redoes the
tires and the paint job — Derek likes red better than the Valcorsa flag (valid).
Adds his favorite number, renames it MONO v4.

Closes the app, opens iMessage. The GC is fighting over who should race at Bahía
Lluvia. "Derek, you should race tomorrow, your car goes 225 now." "WHAT? 225?
FROM 193 TOPS to 225?? TYTYTYTYTY" (manager) "Good — Derek and Liam race
tomorrow, sorry Vince." "no its fine i suck anyway lmfao"

## What this locks
- Sessions are driven by CUSTOMER PROBLEMS, not menus ("jiggling sound on turns")
- Client cars have VERSIONS (OPAT v1 → v2); the engineer renames on delivery
- Diagnosis is VISUAL: full-orbit 3D inspect view, see every part, spot the loose one
- The garage is a PLACE: big area + car + shelves that are a grid of slots YOU organize
- Fasteners are real (screws), space is real (engine doesn't fit → remove something)
- Tradeoffs are personal (drift limiter out because THIS client doesn't drift)
- Connections have nomenclature (Ftg fuel line vs KNOT intake) and can be LEARNED (in-world video?)
- Fuel lines, coolant lines, straps = the three primitives, visible
- Cosmetics are part of the job (client's color taste, sticker from client's winnings, number)
- The payoff is SOCIAL: the group chat sees the result (193 → 225), the manager makes the call

## Jank law (same day)
Fitment is never impossible — mismatches are JANKY: assemble with persuasion,
+jank per size-step of mismatch. Jank lowers the average, widens the spread —
usually worse, occasionally MAGIC. The truth lands at the DYNO ROLL on stamping.

## Design session locks (2026-08-07, 12 questions, sessions "sounder")

**Jobs**: clients TYPE their requests in their own words (no auto-telemetry).
Human complaints, human vagueness — "it feels slidey idk" is a valid ticket.

**Diagnosis**: eyes AND hands. Damaged parts LOOK wrong (wobble, stains,
bald tires) and you can grab-shake them — loose ones rattle and shift.

**Shelves**: full physical inventory. No search, no auto-sort. Your layout
is your identity; a messy garage is a slow garage.

**Space**: Trailmakers rule — complex part shapes, simple grid volumes.
"A 4×5×2 under your hood." Parts occupy block-space in bays; if it doesn't
fit, something comes out.

**Connections**: ports have TYPES (like Phillips vs star screws) — Ftg, KNOT,
etc. NO in-game tutorial site: the tutorials are REAL YouTube videos on
Adam's actual channel. The game's knowledge base lives in the real world.

**Delivery**: teams share a livery + a team LOCKER with a tab per member
(everyone's pack winnings — stickers, colors — usable by owner AND engineer).
Team engineer: rename lands in the shared livery + app notification +
optional receipt. SHOP engineer (for strangers): the fast-food ordering
console — tap the services performed, add description, total price; client
pays, car returns to their livery.

**Wrenching**: a wrench appears, you drag round and round until it slows to
a stop. Push past the stop = STRIPPED BOLT (Jank Law applies to labor).
Forgot the gasket? It runs. It leaks. They come back mad.

**Focus**: one car in the garage at a time. Pick the job, that car's on
the lift, nothing else exists.

**Pay**: team engineers draw salary from the Manager's wallet (contracts
system); shop work for strangers is priced by you at the console.

**The garage grows**: RENTED TIERS. Monthly rent for square footage —
bigger premises, more shelf grids, dyno corner, paint booth. Downsize if
broke. The shop must earn its floor.
