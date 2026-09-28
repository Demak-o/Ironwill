# Ironwill

A round-based (wave-based) action roguelike in the spirit of **Brotato** and **The Binding
of Isaac**, built with plain HTML5 canvas + classic scripts. No build step, no
dependencies: everything you see uses the pixel art already sitting in `Assets/`.

---

## Running it

The game loads its sprites over `fetch`, so a browser will block it on a `file://` URL.
Serve the folder over HTTP and open the page:

```powershell
cd D:\Code\IW\Ironwill
python -m http.server 8080      # or: npx serve .
```

Then open <http://localhost:8080/>. Click the canvas once so it takes keyboard focus.

### Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move (attacks fire automatically at the nearest enemy in range) |
| `Left Shift` or `Space` | Class ability |
| Mouse | Menus: click character cards, shop slots, boons |
| `1` - `4` | Pick a class on the character-select screen |
| `Enter` | Confirm / start / advance |
| `R` | Reroll the shop stock |
| `P` / `Escape` | Pause |

---

## The loop

1. **Wave** - enemies spawn for the wave's duration (`20s`, up to `45s`). Kill them and
   they drop **gold** and **XP**; gold pickups are drawn in as you walk near them.
2. **Wave clear** - every wave ends with a short summary of kills, gold and time.
3. **Shop** - four randomly-rolled items appear (see *Luck*, below). Rerolls cost
   `8` gold and then `x1.6 + 2` each time.
4. **Level up** - filling the XP bar offers **three boons** (stat upgrades such as
   `+5 Luck`, `+8% Cooldown Reduction`, `+40 Pickup Range`) and you pick one.
5. Repeat. **Wave 20 is the final wave**; clearing it wins the run, and then **endless
   mode** keeps going for as long as you can survive.

Dying ends the run. The title screen shows your best wave.

---

## The four classes

All four come from the **blue** unit set. Each has a unique weapon *and* a unique ability,
all bound to `Left Shift`.

| Class | Sprite | Weapon | Ability |
| --- | --- | --- | --- |
| **Knight** | `Blue/Warrior` | *Longsword* - a wide melee arc that sweeps everything in front of him and knocks it back | **Aegis Stance** - brief invulnerability plus a shockwave that hurls attackers away |
| **Archer** | `Blue/Archer` | *Hunting Bow* - fast projectiles that fly at the nearest enemy | **Windstep Dash** - a short dash that ignores all damage while you travel |
| **Lancer** | `Blue/Lancer` | *Boar Spear* - a narrow thrust that skewers a whole line | **Brace & Riposte** - take 65% less damage while braced, then your next thrust is empowered and strikes wider |
| **Monk** | `Blue/Monk` | *Sanctified Wave* - a radial pulse that damages everything around him | **Mend Wounds** - channel to restore 35% of maximum health |

Base stats differ per class: the Knight is a 130 HP tank with 3 armor, the Archer is an
88 HP glass cannon with 5% dodge and a faster attack, etc. Each class also starts with a
small bonus to its own damage type (`melee`, `ranged`, `damage`).
---

## Enemies: colour = tier

Blue is reserved for the player, so the other four unit colours are the enemy tiers. Every
tier has the same five archetypes - colour is purely strength, so a purple Peasant hits
harder than a black Man-at-Arms.

| Tier | Colour | Name | HP | Damage | Gold | Unlocks |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Black** | Shade | x1.00 | x1.00 | x1.00 | wave 1 |
| 2 | **Red** | Crimson | x1.35 | x1.25 | x1.80 | wave 3 |
| 3 | **Yellow** | Gilded | x1.80 | x1.50 | x2.80 | wave 6 |
| 4 | **Purple** | Void | x2.60 | x1.85 | x4.20 | wave 9 |

Each enemy draws a **coloured ring** at its feet so you can read its tier at a glance.

**Archetypes** - every tier has all five:

- **Peasant** (`Pawn`) - chases you in numbers, cheap fodder.
- **Man-at-Arms** (`Warrior`) - slower, tanky, has a wind-up melee swing.
- **Bowman** (`Archer`) - keeps its distance and shoots (from wave 2).
- **Pikeman** (`Lancer`) - telegraphs, then charges across the screen (from wave 4).
- **Zealot** (`Monk`) - hangs back and heals nearby enemies (from wave 5).

**Elites** are scaled up (+28% size, x3 HP, x4 gold) and ringed in gold - they start
showing up once the horde has teeth.

**The difficulty curve** (`IW.waveConfig`) ramps everything each wave:

```
duration      20s -> 45s cap
spawn gap     2.1s -> 0.42s floor
group size    1 + floor(wave / 3)
live cap      14 + wave*2 (72 max)
enemy HP      1 + 0.13*(w-1) + 0.012*(w-1)^2     <- quadratic, so late waves stay punchy
enemy damage  1 + 0.085*(w-1)  (x3.2 cap)
gold / XP     scale with wave and tier, so later waves fund later builds
```

Loot scales the same way: a wave-20 Void Warrior is worth many times the gold of a wave-1
Shade, which is what pays for the expensive late-game items.

---

## Stats and Luck

Everything is a modifier on a single stat sheet (`src/data/stats.js`):

`Max HP`, `Regen`, `Armor`, `Dodge`, `Damage`, `Melee`, `Ranged`, `Attack Speed`,
`Move Speed`, `Crit`, `Crit Damage`, `Lifesteal`, `Pickup Range`, `Luck`, `Cooldown`.

**Luck is a real stat** and it appears in the HUD panel and the shop sidebar like any
other. It does exactly one thing: it shifts the shop's rarity table toward the top tiers.

Rarity weights are `base * (1 + LUCK_FACTOR[rarity] * luck)`:

| Rarity | Base weight | per point of Luck |
| --- | --- | --- |
| Common | 100 | `-0.55%` |
| Uncommon | 52 | `0` |
| Rare | 20 | `+3.5%` |
| Epic | 6.5 | `+6.0%` |
| Legendary | 1.4 | `+9.0%` |

So at 0 Luck the shop is overwhelmingly Common and the odds of any single slot being
Legendary are only **1.4 in 179.9 - about 1 in 130**. Stack Luck and Legendaries become
genuinely reachable: the pool includes `Lucky Coin` (+3), `Fortuna Charm` (+6),
`Glittering Hoard` (+10), `Crown of Avarice` (+20) and the `Duck of Destiny` (+12) to
build toward it. Item prices also creep up `+4%` per wave so late gold has somewhere to go.

There are 40+ items across Common / Uncommon / Rare / Epic / Legendary plus the level-up
boons, all reusing icons and swords cropped from the existing UI sheets.
---

## Repo layout

```
index.html             canvas + script tags (order matters, no modules)
styles.css             page frame, loading bar
src/util.js            rng, lerp, hashing, weighted picks, seeded helpers
src/assets.js          manifest of every sprite used, sheet slicing + frame metadata,
                       UI plate nine-slice bands (see tools/inspect_ui_cells.ps1)
src/audio.js           tiny WebAudio blips (no audio files needed)
src/input.js           keyboard/mouse state
src/data/stats.js      the stat sheet, armor curve, description/summary helpers
src/data/characters.js the four blue classes (weapon + ability per class)
src/data/enemies.js    enemy tiers, archetypes, wave difficulty curve
src/data/items.js      item pool, luck-weighted rarity roll, level-up boons
src/entities.js        Player, Enemy, Projectile, Pickup, and the ability effects
src/arena.js           the arena: water border, grass field, decor placement, camera
src/ui.js              every screen: title, select, HUD, shop, level up, pause, results
src/game.js            the Game controller/state machine and the main loop
tools/                 dev-only inspection + test scripts (not needed to play)
```

### Tests

`tools/headless_test.js` stubs a canvas and runs the real game logic with no browser. It
checks the four classes, the tier/luck/difficulty formulas, the asset manifest, the menu
flow, and then simulates full runs - one per class, plus a funded deep run and the victory
path - asserting nothing ends up `NaN` or negative.

```powershell
node tools/headless_test.js      # prints ALL CHECKS PASSED
```

Everything else in `tools/` are the scripts used while building the look and feel:
`measure_units.ps1` / `measure_decor.ps1` measured sprite scale, feet offsets and decor
base offsets; `score_tiles.ps1` / `verify_tiles.ps1` scored every tile of the tileset to
find the ones that are genuinely seamless interior grass (only `cols 1-2 / rows 1-2` of a
variant are - the rest carry a shoreline trim); and `arena_mock.ps1` renders a plain
System.Drawing preview of the arena. They write their PNGs to `tools/_inspect/`, which is
pure scratch space and not part of the game.
