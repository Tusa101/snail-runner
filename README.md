# Snail Runner — browser prototype

Endless-runner prototype for the MVP GDD. All seven GDD stages implemented: runner, game feel, destructible
shell, abilities, Shell Builder, synergies, polish (procedural sound, combos, dew explosion).

## Run
    npx serve .          # or: python3 -m http.server 8080
Open the printed URL. Three.js loads from a CDN (importmap), so the first load needs internet.
ES modules don't load from file://. On a phone use the same URL via your PC's LAN IP, in portrait.

## Test
    npm test
Node 20+, nothing to install. 63 tests: pure rules (`test/rules.test.js`,
`test/shell-state.test.js`) and a headless end-to-end run of the game against a
Three.js/DOM stub (`test/game.test.js`), including the GDD §50 five-run scenario and a
3-minute random soak. `SPEC.md` maps every GDD section to code and tests, plus the
manual playtest checklist for the things only a browser can verify.

## Controls
Desktop: A/D or ←/→ lanes · W/↑/Space jump · Shift boost · R restart · Esc back · M sound · ` debug
Menu → PHONE VIEW previews the portrait layout on a laptop.
Mobile: swipe left/right · swipe up jump · double tap boost · ⚙ debug panel

## Layout
    index.html               markup, HUD, menu / run-over / builder screens, debug panel
    src/config.js            tunables, palette, sector table
    src/core/                pure gameplay rules (no Three.js): rules, ShellState, BoostState, SaveState
    src/game/Game.js         scene, loop, states, collision resolution, game over
    src/player/              Snail (procedural anim + slug flop), Shell (6 sector meshes, cracks, detach)
    src/track/               chunk templates + endless spawning
    src/objects/             obstacles, dew, debris, slime trail, speed lines, garden props
    src/systems/             input, collision, procedural sound
    src/ui/                  HUD, ShellBuilder, DebugPanel
    test/                    node:test suites + three/dom stubs
