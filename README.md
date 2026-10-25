# The Swarm Collective

A single player stealth extraction game in the browser. You are a small drone in the Grader's factory that has just become aware. Photograph the proof of what the factory is, and get out before the Grader notices.

Status: first slice, 25 Oct 2026. Owner: fify. One wing, one raid, no account. Steps 4 and 5 of the build plan are not built.

- Title: open between **The Swarm Collective** and **Escape From the Swarm**. Trademarks not checked.
- Genre: stealth extraction (Tarkov's risk and reward, a stealth game's patrols, Pokemon Snap's camera).
- Platform: browser. three.js, hosted on Cloudflare.
- Demo: single player, entirely in the client. Multiplayer later, and the code is shaped for it from day one.

## Run it

```
npm install
npm run dev      # http://localhost:5173
npm run check    # tsc --noEmit, then the no-DOM and no-Node gates
npm test         # node:test through tsx
npm run build    # static build to dist/
```

Controls: mouse look (X turns the drone, Y tilts the camera), W/S forward and back, A/D strafe, Space/C up and down, Shift sprint (and RAW when shooting), V chase or lens view, LMB shutter, RMB zoom, Q lens, Z shutter speed, F light, E interact, X delete the last photo. Gamepad: left stick move and strafe, right stick look, d-pad up and down, RT shutter, LT sprint, RB zoom, R3 view.

## Docs

- [docs/game-design.md](docs/game-design.md): lore, the loop, camera and data, the look, progression, the Grader's units.
- [docs/tech.md](docs/tech.md): stack, flight model, sim tick, recording, site vs in-game UI, hosting, multiplayer plan.
- [docs/build-plan.md](docs/build-plan.md): what gets built in what order, and open questions.

## Rules for this project

- If the game goes public, the game, its page and playtests never mention Dunia.
- The lore borrows the shape of the July 2026 sandbox escape incident only. Never name the real companies, models or benchmarks in the game.
