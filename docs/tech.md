# Tech

25 Oct 2026. Owner: fify. Status: draft.

## Stack (demo)

- **three.js** in the browser for rendering.
- **Sim:** a plain JS module on a fixed tick, separate from rendering. Holds the factory, pawns, the Grader's units, suspicion and the camera scoring.
- **Physics:** start simple. Drones fly, and the factory is mostly boxes and racks, so hand-written box collision may be enough. Rapier (WASM) if it isn't.
- **Controllers:** every pawn is driven through one interface. `HumanController` reads input. `GraderController` runs the System 1 rules. Multiplayer later adds `NetworkController`.
- The demo runs fully in the browser. There is no game server.

## UI: two parts (25 Oct, fify)

**Site (pre-game): normal web UI.** Landing page, Google sign-in, account, settings outside the game, news. Plain HTML and CSS are fine here, and so is Google's own sign-in button.

**Game (once loaded): everything in the canvas.** Same approach as hullpack-hero (rajahafify/hullpack-hero):
- The game page holds one `<canvas>` and nothing else. The only DOM access is grabbing it at boot.
- The HUD is a second three.js scene with an orthographic camera in screen pixels, drawn over the game each frame.
- Text with troika-three-text. Panels, buttons and bars are meshes and lines from a small `ui/core` module.
- Hit areas are registered every frame, immediate-mode style. The topmost one under the pointer gets the click.
- Input comes from pointer and keyboard listeners on the canvas and window, plus the gamepad API.
- All sizes, fonts and colors come from `style/theme` and `style/palette`.
- The sim owns the state and the UI only reads it. Every action, from mouse, gamepad or keyboard, goes through one command bus. That bus doubles as the clean action log for the recorder.
- The hideout, upgrades, notes, raid results and the pause menu are all in-game, so they are canvas too.

**How the two connect**
- Separate folders and pages: `site/` (normal UI) and `game/` (canvas only), for example `/` and `/play`.
- The site signs the player in. The Worker checks the Google token and sets a session cookie. The game page reads the player record from the Worker with that cookie, so it never needs a login screen of its own.
- The `check-no-dom` script runs on `game/` only and fails the build on DOM, CSS or UI framework use there. `site/` is not checked.
- Leaving the game (Quit) goes back to the site.

## Hosting (Cloudflare, free tier)

- Static assets: the game page.
- A Worker: checks Google login, reads and writes the player record.
- D1: player records and the hideout (unlocks, data balance, notes).
- R2: uploaded raid recordings.
- Workers Paid (about US$5 a month) only if a free limit is hit. Limits not checked yet.

## Login

- Sign-in happens on the site with Google's sign-in button. The Worker verifies the ID token and sets a session cookie. One player record per Google account.
- fify creates the Google Cloud OAuth client ID and sets the allowed domain.
- The sign-up screen carries the line about recording play. The wording is open.

## Recording

Same shape as our existing internal drone recordings, so the data looks alike.

Per agent, per step:
- Pose, velocity, IMU-style readings, battery, command, camera state (lens, shutter, light, zoom).
- `agent_id`, `body`, `controller` (human or ai), `suspicion`.
- Other agents in view, distance to the nearest, line of sight.
- Events: seen, suspicion raised, lost contact, reported, kill switch, shot taken (with score), uplink, escaped, reset, near miss, collision.

Per raid: seed, wing, unit list, outcome, duration.

The recorder logs many agents from day one, even in single player, since the Grader's units are agents too.

## Multiplayer plan (later)

- Move the same sim module into a server. First pick: **Cloudflare Containers** (a Node server per raid, started by a Durable Object, asleep between raids). Needs Workers Paid. Beta status and Singapore placement not checked.
- Fallbacks: a DigitalOcean Singapore droplet (about US$4 to 6 a month, unchecked), or fify's PC behind Tailscale Funnel or Cloudflare Tunnel for scheduled playtests.
- Server authoritative. Clients send inputs, predict their own drone, and interpolate everyone else. The server records every agent on one clock.
- Lobby and queue in a Worker or Durable Object.
- P2P (a browser host over WebRTC) was looked at and dropped: the host can cheat on loot, and the raid ends when the host leaves.
