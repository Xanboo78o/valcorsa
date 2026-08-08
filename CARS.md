# THE CARS OF VALCORSA

Every marque, every model, every year. This is the master list — carfactory.js and the
showroom read from it, and nothing ships that isn't written down here first.

## The laws

1. **No class gating, ever.** Anything may enter anything. You can put a monster truck in
   an F1 race. It is a *terrible idea*, and the car — not a rule — is what tells you so.
   Family labels below exist to browse the shop. They never block an entry.
2. **Years are real.** A car is "1968 Enginos Piccola 02," not "Piccola." One nameplate
   across two decades is two different cars with the same soul, and the argument about
   which generation was better is a feature.
3. **One quirk each.** Every car has exactly one weird true thing. Some are physics, some
   are theater, and you don't find out which until you drive it.
4. **Some cars can't be bought.** Unicorns (marked ★) only come out of packs. No grinding
   your way to them.
5. **The truth is in four numbers the old sheet didn't have** — see *New physics* at the
   bottom. Height/CG makes tall cars roll. Gearing makes torque and top speed a choice.
   Terrain fit makes a Flecha helpless on gravel. Mass makes brakes matter.

## The politics

- **The Alliance: Enginos + Heiligen.** Money and measurement. Insufferable. Usually winning.
- **Enginos vs Norte** — the class war. Enginos has never said the word "Norte" out loud.
- **Houndsborough vs Heiligen** — the philosophy war. Neighbors. Worse.
- **Houndsborough and Norte are not friends.** They just hate the same people. The Alliance
  is coordinated; the opposition isn't. That's why the Alliance keeps winning.
- **Granada × Hilja are best friends** — fire and ice, aligned with nobody, and the only
  pair in Valcorsa with a co-branded car.
- **Braewick, Đồi, Perro, Polvo** do not care about any of this. They're working.

---

## ENGINOS — San Volante
*The Ferrari of Valcorsa.* Founded on the coast road, wins everything, mentions it.
**Badge:** gold laurel around a red shield, one star. **Palette:** rosso, gold, black.
**Face DNA:** twin kidney grilles, twin-element squint. **Era note:** the wedge years
(1980–1992) are their loudest and least sensible, and everyone's favourite.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `vecchia` | 1957 | Vecchia Spyder | Vintage | no roof, no belt — rain is an actual emergency |
| `corsauno` | 1963 | Corsa Uno | Open-Wheel | front-engine cigar; the pedals are ahead of the axle and you feel it |
| `piccola` | 1968 | Piccola 02 | Hatch | tiny, angry, the whole car pivots on the inside front wheel |
| `gt` | 1974 | GT | GT | the big rectangle. Long hood, hilarious blind spots |
| `lupo` | 1984 | Lupo | Super | the wedge is so flat you steer over the nose by faith |
| `tempesta` ★ | 1991 | Tempesta | Hyper | the V12 is so long the cabin got shoved forward. Sounds like weather |
| `berlina` | 1996 | Berlina M | Sedan | four doors, one attitude problem |
| `volante` | 1998 | Volante F | Open-Wheel | the flyer — ground effect that dies the moment you're sideways |
| `bavaria` | 2004 | Bavaria GT | GT | silence, then 280. No drama at any speed, which IS the drama |
| `piccola6` | 2012 | Piccola 06 | Hatch | turbo lag, then a shove that arrives after you needed it |
| `nuvola` ★ | 2024 | Nuvola E | Hyper | silent. The crowd doesn't know you're coming and neither do they |

*(`formula` is the legacy id for `volante` — kept as an alias so old garages don't break.)*

---

## NORTE — Cruzero
*The people's horsepower.* A Spanish name in a working northern city, right on the seam
between the two Valcorsas — which is exactly why everybody claims them. Their entire
business is selling you 90% of an Enginos for 30% of the money.
**Badge:** a horse's head over three bars. **Palette:** blue, white, a lot of chrome-delete.
**Face DNA:** wide slotted grille, four round lamps.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `coyote` | 1969 | Coyote | Muscle | leaf springs — the back end steps out over every bump |
| `potro` | 1979 | Potro | Muscle | the people's fastback; rust is included at no extra cost |
| `escuela` | 1979 | Escuela | Bus | it's a school bus. Passing it feels illegal |
| `cargo` | 1985 | Cargo | Van | empty, it rattles; loaded, it's the most stable thing you own |
| `patrulla` | 1997 | Patrulla | Sedan | working siren. The AI *moves over* — briefly, and then remembers |
| `titan` | 1998 | Titan | Truck | heavy is a feature |
| `lobo` | 2003 | Lobo | Truck | tows anything, tips at anything. The cautionary tale in car form |
| `rayo` | 2014 | Rayo | Coupe | nothing special about it, and it has never once broken |
| `stallion` ★ | 2019 | Stallion GT3 | Super | the rebrand. Full send. Factory-backed and it acts like it |

---

## HOUNDSBOROUGH — Ft. Houndsborough
*Northern iron.* Chrome, mass, and doors that shut like a bank vault. They build by feel,
they build by weight, and they think measuring things is for cowards.
**Badge:** a hound's head in a chrome shield. **Palette:** deep maroon, cream, chrome.
**Face DNA:** vertical LED blades, chrome-framed slab grille.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `marshal` | 1959 | Marshal | Vintage | the fins are real downforce. Nobody has ever admitted this was on purpose |
| `ladder` | 1966 | Ladder 12 | Utility | articulated fire truck — the back half steers too, and it's chaos |
| `muscle` | 1970 | Iron | Muscle | northern steel; the hood is longer than some cars |
| `verger` | 1971 | Verger | Utility | the hearse. Silent inside. Enormous trunk. Deeply unsettling in a mirror |
| `duke` | 1976 | Duke | Vintage | a living room at speed — it cannot take a hairpin in one bite |
| `cab` | 1983 | Cab | Sedan | the meter runs. This car *earns* while you drive it |
| `chief` | 1989 | Chief | Sedan | the executive fortress |
| `sentinel` | 1994 | Sentinel | Truck | armoured. Shrugs off damage, weighs a house, stops like a rumour |
| `plow` | 2001 | Plow | Utility | shoves whatever's in front of it out of the way. Unstoppable in snow |

---

## HEILIGEN — Heiligen
*Cold perfection.* Alpine, bright, tidy, and absolutely certain. Everything is measured
twice. Sides with Enginos, cannot stand Houndsborough.
**Badge:** a compass rose inside a halo. **Palette:** silver, white, one thin red line.
**Face DNA:** narrow lamp slots, a single horizontal bar, a lot of nothing.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `traktor` | 1962 | Traktor | Utility | infinite torque, 24 mph, immovable. It has beaten cars. Ask October |
| `bergziege` | 1978 | Bergziege | Off-Road | the mountain goat: climbs literally anything, tops out at nothing |
| `wald` | 1988 | Wald | Wagon | carries dogs and firewood, and outruns things it shouldn't |
| `rally` | 1993 | Strada | Rally | coast-road bones, box flares, permanently sideways |
| `werk` | 1996 | Werk | Van | a rolling garage — it repairs itself, slowly, while you drive |
| `sturm` | 1999 | Sturm | Rally | the scoop breathes. You can hear it inhale before it moves |
| `nadel` | 2009 | Nadel | Coupe | no radio, no carpet, no mercy. Lightest thing on any grid |
| `endurance` ★ | 2016 | Nacht LMP | Prototype | built for October — the only car happier at 3am than at noon |
| `uhr` | 2018 | Uhr | GT | it drives itself a little. Everyone argues about whether that's cheating |

---

## GRANADA — Granada
*Fire.* A small southern town that makes small furious machines. Best friends with Hilja,
which nobody can explain and everybody enjoys.
**Badge:** a split pomegranate, seeds like sparks. **Palette:** deep red, hot orange, brass.
**Face DNA:** round lamps, a wide low mouth, a lot of teeth.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `toro` | 1968 | Toro | GT | the bull. It hits *hard* — the best rammer in smashkart, by design |
| `feria` | 1975 | Feria | Novelty | open-top parade car, covered in lights. The crowd goes insane |
| `helado` | 1988 | Helado | Van | the ice cream truck. It plays the jingle. It never stops playing the jingle |
| `chispa` | 1992 | Chispa | Coupe | featherweight roadster — a crosswind is a genuine threat |
| `cascabel` | 2001 | Cascabel | Coupe | rattles at idle like a snake. You hear it two ridges away |
| `garra` | 2007 | Garra | Super | the claw comes out |
| `kart` | — | Sprint Kart | Kart | the starter dream |
| `flecha` ★ | 2021 | Flecha | Hyper | the arrow never lands. Untouchable on tarmac, hopeless on anything else |

---

## HILJA — Talvi
*Silence.* Far-north minimalists. Their cars have fewer parts than anyone else's and
they'd like you to notice. On the shop wall, a Hilja card is mostly empty space — that
whitespace **is** the brand, don't fill it.
**Badge:** a single thin six-point star. **Palette:** white, pale grey, ice blue.
**Face DNA:** one continuous light bar, no grille at all.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `siipi` ★ | 1961 | Siipi | Vintage | the wing remembers. Chrome-era GT, and it still out-corners modern cars |
| `vene` | 1968 | Vene | Novelty | it floats. Water stops being fatal and starts being a shortcut |
| `lumi` | 1972 | Lumi | Sedan | geometry refuses to age |
| `sisu` ★ | 1983 | Sisu | Rally | the turbo arrives like a light switch and tries to kill you |
| `kuura` | 1994 | Kuura | Wagon | all-wheel drive; completely unbothered by weather anyone else fears |
| `tahti` | 2015 | Tähti | Hyper | silence at 300 |
| `yo` | 2022 | Yö E | Coupe | one pedal. Lift off and it stops. It feels alien for exactly one lap |

---

## BRAEWICK — Braewick
*Blacksmiths.* Highland shed-builders who discovered that a well-made box is very hard to
beat and then refused to learn anything else.
**Badge:** hammer over anvil. **Palette:** bottle green, black, bare steel.
**Face DNA:** two square lamps and a grille that's just a hole.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `croft` | 1974 | Croft | Hatch | a shed with wheels. It will not die. It has never died |
| `anvil` | 1982 | Anvil | Coupe | a box that outruns you |
| `drover` | 1990 | Drover | Truck | there are sheep in the back. You can hear them. They have opinions |
| `whin` | 1998 | Whin | Hatch | no traction control, no assists, no apology |
| `torr` | 2003 | Torr | Super | highland monolith |
| `kirk` | 2008 | Kirk | Sedan | the aerodynamics of a filing cabinet and the crash structure of a church |

---

## ĐỒI — Đồi Cao
*Work.* Eastern hills. Cheap, indestructible, beloved. More Đồis on the road than
everything else combined, and every single one has 300,000 miles on it.
**Badge:** three hills. **Palette:** yellow, red, primer grey.
**Face DNA:** round lamps set wide, a friendly gap-toothed grille.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `babanh` | 1974 | Ba Bánh | Novelty | three wheels, zero fear. It tips if you *look* at it wrong |
| `tuk` | 1976 | Tuk | Novelty | fits through gaps that are not gaps |
| `cho` | 1982 | Chợ | Truck | stacked with crates — and they fall off, into everyone behind you |
| `tamsau` | 1986 | Tám-Sáu | Coupe | eight-six. You know |
| `trau` | 1991 | Trâu | Truck | the buffalo forgives nothing |
| `xeom` | 1998 | Xe Ôm | Bike | the bike taxi. Weaves through absolutely anything |
| `bonbon` | 2005 | Bốn-Bốn | Off-Road | unstoppable in mud, hopeless on tarmac, cheerful about both |
| `rong` | 2019 | Rồng | Coupe | the dragon nobody saw coming. Cheap, fast, permanently underestimated |

---

## POLVO — Polvareda, El Medio
*Dust.* Founded 1978 in the empty interior by people with no roads. Polvo doesn't race on
tracks, it races **across** them: exposed cages, suspension travel measured in feet, and
machines built to *land* well rather than corner well. Everyone else is fastest on the
racing line. A Polvo does not care where the line is. In October, they win.
**Badge:** a dust plume with two headlights in it. **Palette:** sand, rust orange, matte black.
**Face DNA:** a light bar across the cage, no bodywork to speak of.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `rastro` | 1978 | Rastro | Side-by-Side | the original. No doors, no roof, no electronics — nothing to break |
| `coyotepv` | 2009 | Coyote | Side-by-Side | the work model. The bed swallows spares like a garage that follows you |
| `gigante` | 2011 | Gigante | Off-Road | the monster truck. Crushes, rolls, tops out at 90. Adam's cautionary tale |
| `chubasco` | 2013 | Chubasco | Side-by-Side | snorkelled. Mud and water do precisely nothing to it |
| `vibora` | 2016 | Víbora | Side-by-Side | lands flat from any height. Any height |
| `liebre` ★ | 2021 | Liebre | Side-by-Side | genuinely *faster over rough ground than smooth*. The whoops are the road |
| `sombra` ★ | 2024 | Sombra E | Side-by-Side | electric. You never hear it in your mirrors |

---

## PERRO
*Bikes.* Barks at corners. Headquarters unknown; there are always three of them outside.
**Badge:** a dog mid-leap. **Palette:** black, safety yellow.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `sidecar` | 1961 | Sidecar | Bike | turns better one way than the other. Forever |
| `sabueso` | 1985 | Sabueso | Bike | the tourer: panniers full of spares, slow to change its mind |
| `bike` | — | Moto | Bike | the dog |
| `cachorro` | 2003 | Cachorro | Bike | a scooter. 40 mph and infinite charm |
| `galgo` ★ | 2017 | Galgo | Bike | fastest thing alive in a straight line. One mistake and that's the race |

---

## CHANESCHASSIS — the dealership
Not a manufacturer. A lot with a flag on it, run by a man named Chanes who will sell you
anything with wheels, including several things that shouldn't have them. Also the licensed
outlet for the federation's spec car.

| id | year | model | family | quirk |
|---|---|---|---|---|
| `monoposto` ★ | — | VCRA Monoposto | Open-Wheel | the pinnacle. Federation-supplied, identical for everyone, no excuses |
| `barrel` | — | Barrel Kart | Novelty | it's a barrel |
| `sofa` | — | The Sofa | Novelty | comfort-first engineering. Highest centre of gravity in Valcorsa |
| `longframe` ★ | — | Twin-Engine Longframe | Novelty | why |
| `shopkart` | — | Shopping Kart | Novelty | returned to the wrong lot. One wheel does its own thing |
| `bathtub` | — | The Bathtub | Novelty | full of water that sloshes and moves your weight around corners |
| `piano` ★ | — | The Grand Piano | Novelty | plays a chord every time you hit something. Wrecks become music |
| `sled` ★ | — | The Rocket Sled | Novelty | no brakes. That is the entire product |

---

## The collab

**★ `granadahilja` — 2020 Granada×Hilja "Ceniza"** — fire and ice, built because two friends
felt like it. Granada body, Hilja bones. Pull-only, and it only appears in packs alongside
a card from either parent brand. There is no rival pair in Valcorsa that could ever make one.

---

## New physics (what makes "bad idea" honest)

The existing sheet — aero, weight, agility, tough, trunk — can't make a monster truck at
170 into a *disaster*. Four numbers fix that:

- **height / CG** — tall car + tight corner + speed = it goes **over**, not sideways. This
  is the number that makes the Sofa the most dangerous vehicle ever sold.
- **gearing** — torque or top speed, pick one. The truck leads to the first corner and then
  watches the field walk away down the straight. Funnier than "slow car is slow."
- **terrain fit** — every chassis loves a surface. Flecha: untouchable on tarmac, helpless on
  gravel. Polvo: embarrassing on a circuit, unstoppable in October. This is what makes
  "which car for this weekend" a real question **without a single permission rule.**
- **mass → brakes** — heavy things do not stop. Houndsborough's whole personality, quantified.

## Counts

86 cars. 10 marques plus the dealership. 14 unicorns. Six decades, 1957 → 2024.
