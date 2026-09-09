# Spec traceability — MVP GDD → implementation → tests

The GDD is the spec. Every gameplay rule lives in `src/core/` as pure data/functions
(no Three.js, no DOM) and is covered by `npm test`. Rendering and feel are verified
by the manual checklist at the bottom — a browser is the only real test for those.

Run tests: `npm test` (Node 20+, no install needed — uses `node:test` and a Three.js stub).

| GDD § | Rule | Where | Automated test |
|---|---|---|---|
| §2 | PC keys A/D/←/→, W/↑/Space, Shift, R; mobile swipes + double tap | `systems/InputSystem.js` | manual (P1) |
| §3 | Lanes −2/0/+2, 0.2 s smooth change, tilt/eyes/shell lag | `config.js`, `player/Snail.js` | `game.test` (lane x = −2 after moveLane); feel manual (P2) |
| §4 | Speed 12 → +0.7 / 15 s → cap 22 | `core/rules.js speedAt` | `rules.test §4` |
| §6 | 6 outer sectors, each a separate mesh | `player/Shell.js` | `game.test Run 1` (6 destroyed, ≥6 debris meshes) |
| §7 | Sector HP tables; no global HP bar | `core/ShellState.js sectorMaxHp` | `shell-state.test §7/§12/§32` |
| §8 | Frontal hit 60/20/20 on front zones, only living sectors | `ShellState.pickHitSlot` | `shell-state.test §8` (10k-sample distribution, fallback when front is gone) |
| §9 | Healthy >60 % / Damaged 31–60 / Critical 1–30 / Destroyed | `ShellState sectorState` | `shell-state.test §9` |
| §10 | Break: hit-stop 50–70 ms, shake, detach back+up, spin, debris | `game/Game.js _applyShellEvents`, `Shell._detach`, `objects/Debris.js` | `game.test Run 1` (debris count); timing manual (P5) |
| §11 | Last sector: slow-mo 20 %, shell collapses, slug flies, flops, looks, blinks, RUN OVER | `Game._startGameOver`, `Snail._updateSlug`, `HUD.showRunOver` | `game.test Run 1` (state → RUN OVER screen + stats); animation manual (P6) |
| §12 | Types Armor/Jump/Spike/Boost/Magnet with HP, colors, abilities | `config.js SECTOR_TYPES`, `core/rules.js` | `shell-state.test`, `rules.test` |
| §12.4 | Boost +50 % for 1.5 s, cooldown 8/7/6 | `core/BoostState.js` | `rules.test §12.4`, `game.test Run 3` |
| §12.5 | Magnet radius 3.5/4.5/5.5 | `rules.js magnetRadius`, `Game._updateMagnet` | `rules.test`, `game.test Magnet` |
| §13 / §40 | Abilities derived from living sectors; loss is immediate; JUMP/SPIKES/BOOST/MAGNET LOST | `ShellState.hasAbility`, `Game._applyShellEvents` | `shell-state.test §13/§40`, `game.test Run 2/3` |
| §14 | Position matters: only the outer ring is active (single ring in MVP) | `ShellState` | n/a (inner ring out of scope) |
| §15 | Spike+Boost RAM MODE; Armor+Jump adjacency +20 %; Magnet+Boost radius ×2 | `rules.js resolveCollision/jumpHeightMul/magnetRadius`, `ShellState.hasHeavyBounce` | `rules.test §15`, `shell-state.test §15`, `game.test Run 5 / Magnet` |
| §16 | Start 6×Armor; unlock Jump → Boost → Spike → Magnet after each run, auto-placed | `core/SaveState.js endRun` | `rules.test §16`, `game.test Runs 1–4` |
| §17 | Shell Builder: 6 slots, drag & drop, swap, highlight, info card | `ui/ShellBuilder.js` | `game.test Shell Builder` (swap, place, info, upgrade, persisted, applied) |
| §18–19 | Dew +1/+5; straight / lane-change / arc / risk patterns | `objects/Dew.js`, `track/chunks.js` | `rules.test §21` (patterns inside chunk bounds) |
| §20 | 7 obstacles: damage, breakability, jumpable, Spike self-damage 15/20, salt slow ×0.55 for 1 s, Pot needs RAM | `rules.js OBSTACLES/resolveCollision` | `rules.test §20/§42`, `game.test Run 4` |
| §20.6–7 | Apple rolls across lanes; bird shadow then strike after 0.8 s | `objects/Obstacle.js` | soak test (both spawn); behaviour manual (P8) |
| §21 | 12–15 chunk templates, 20–30 units, random chaining | `track/chunks.js`, `track/TrackManager.js` | `rules.test §21` (≥12 templates, items in bounds, RAM chunk exists) |
| §22 | Tiers 0–20 / 20–40 / 40–60 / 60+ | `rules.js tierAt`, `TrackManager` | `rules.test §22`, soak test (all types appear) |
| §23–26 | One garden biome, palette, one directional + hemisphere light, portrait camera 0/5/8, FOV +8 on boost | `objects/Environment.js`, `Game._initScene`, `_updateCamera` | `game.test Run 3` (FOV rises); look manual (P3) |
| §27–28 | Feel minimum incl. slime trail (longer on boost) | `Snail`, `SlimeTrail`, `SpeedLines`, `Debris` | manual (P2, P4, P5) |
| §29 | HUD: distance, dew, boost ring, schematic shell that darkens/disappears | `ui/HUD.js` | `game.test` (distance text, toasts); look manual |
| §30–31 | States MENU / SHELL_BUILDER / RUN / GAME_OVER; menu shows BEST and DEW | `Game` | `game.test §30` |
| §32 | Upgrades 3 levels, 100 / 250 dew | `SaveState upgrade`, `rules.js` | `rules.test §32`, `game.test Shell Builder` |
| §33 | No repair — sectors restore after each run | `ShellState.repairAll` | `shell-state.test §33` |
| §35–36 | Milestones 250…2000 + NEW DISTANCE!; stats best/dew/runs/destroyed | `Game._updateRun`, `SaveState` | `rules.test §35/§36` |
| §41–42 | Collision pipeline and Spike pseudo-logic | `systems/CollisionSystem.js`, `rules.js` | `rules.test §42`, `game.test Runs 4–5` |
| §43 | Shell spins visually, logical slots stay fixed | `Shell.update` | by construction (slots never rotate) |
| §44–45 | No physics engine: distance checks + manual debris integration | `CollisionSystem`, `Debris` | soak test |
| §47 | localStorage save shape, tolerant of corruption | `SaveState loadSave/persistSave` | `rules.test §47` |
| §10–11, §27 | Sounds KRR-CHAK / PLOP / CRUNCH / CRASH / dew streak / ability lost — procedural WebAudio, no files; M or 🔊 toggles | `systems/Sound.js` | `sound.test`, `game.test Run 1/5` (event log) |
| §52 D | Destruction fantasy feedback: COMBO xN on chained breaks, dew explosion in RAM MODE flies to the snail | `Game.onObstacleHit`, `_dewExplosion`, `objects/Dew.js` | `game.test Run 5` |
| — | Debug panel: speeds, HP/damage mult, density, invuln, dew, DAMAGE / BREAK / BOOST / RAM buttons | `ui/DebugPanel.js` | `game.test debug` |
| — | 3-minute random soak: no exceptions, bounded object counts | everything | `game.test soak` |

## Manual playtest checklist (needs a browser / phone)

P1. Input: every key and swipe does what §2 says; double tap boosts; no page scroll on phone.
P2. Lane change feels snappy, not floaty; tilt and shell lag visible; eyes look into the turn.
P3. Looks like a stylized garden, not a debug scene; three lanes fully visible in portrait.
P4. Jump: clears Branch/Rock/Mushroom comfortably; squash on takeoff, splash on landing.
P5. Sector break: obvious freeze + shake; you can tell *which* colored piece flew off; hole is visible.
P6. Game Over: slow-mo, shell rains off, slug flops on its belly, eyes rise, one blinks, then RUN OVER.
P7. RAM MODE (debug → SPAWN RAM TEST): chain of CRUNCH/CRASH feels like the best moment of the run.
P8. Apple is readable and dodgeable; bird shadow gives 0.8 s of warning.
P9. Shell Builder on a phone: drag from palette and slot-to-slot swap work with a finger.
P10. Phone performance: steady frame rate for a full 2-minute run.

Success signals (§51): the tester starts talking about *where* to put sectors.
