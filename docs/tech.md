# Tech

25 Oct 2026. Owner: fify. Status: draft.

## Stack (demo)

Decided 25 Oct 2026.

- **Language: TypeScript, strict, ESM only.** The sim has to run unchanged in the browser now and in Node later, and it has to keep three controllers and one recorder schema honest. Types cost nothing at runtime and catch exactly those mistakes at build time. The "plain JS module" of the earlier draft becomes a plain *TS* module: no framework, no decorators, no bundler-only imports inside `game/sim/`.
- **Build: Vite.** `site/` and `game/` are two entries in one repo, built to static assets for Cloudflare. The dev server gives HMR on the game; the output is plain ESM.
- **Tests: `node:test`**, run through `tsx` so the suite needs no bundler: `node --import tsx --test tests/index.test.ts`. Only `game/sim/` gets unit tests, because it is the part with maths worth pinning. No browser or e2e suite in the demo. Vitest was the first pick and came out: on this toolchain its worker never initialised, and the built-in runner plus tsx covers the same ground with one less moving part.
- **Lint: none yet.** `tsc` in strict mode plus the two gates cover the rules that matter now. ESLint flat config when there is enough code to argue about.
- **Node 22 LTS, npm, lockfile committed.** One `package.json`. No monorepo tooling.
- **CI: GitHub Actions**, one job: `npm ci && npm run check && npm test && npm run build`. `npm run check` = `tsc --noEmit` plus `check-no-dom` and `check-no-node`. `wrangler deploy` joins the job when the Worker lands, with `CLOUDFLARE_API_TOKEN` and the account id as repo secrets.
- **Rendering:** three.js, pinned minor. No text library: `render/text.ts` rasterises glyphs into a canvas texture, cached by string, size and colour. That is the single DOM exemption in the gate besides the boot-time canvas grab, and it keeps the build offline — no font fetched from a CDN.
- **Sim:** a plain TS module on a fixed tick, separate from rendering. Holds the factory, pawns, the Grader's units, suspicion and the camera scoring. Imports nothing from three.js and touches no DOM, so it can move into Node without edits.
- **Physics:** start simple. Drones fly, and the factory is mostly boxes and racks, so hand-written box collision may be enough. Rapier (WASM) if it isn't.
- **Controllers:** every pawn is driven through one interface. `HumanController` reads input. `GraderController` runs the System 1 rules. Multiplayer later adds `NetworkController`.
- The demo runs fully in the browser. There is no game server.

### Project layout

```
index.html              site page, normal HTML and CSS
play/index.html         the game page: one <canvas> and nothing else
site/style.css
game/main.ts            boot, loop, wiring
  sim/      math.ts, wing.ts, flight.ts, grader.ts, camera.ts, sim.ts, tick.ts
  ui/       core.ts (immediate mode), hud.ts (HUD, title, results)
  render/   scene.ts (three.js), text.ts (glyph atlas)
  input/    input.ts (keyboard, pointer, gamepad -> one Command)
  recorder/ recorder.ts (interface + NullRecorder)
  profile/  local.ts (localStorage), remote.ts later (Worker + cookie)
shared/     types used by both sides
scripts/    check-no-dom.mjs, check-no-node.mjs
tests/      score.test.ts, sim.test.ts, index.test.ts
worker/     index.ts, when the Worker lands
```

### Sim tick

- Sim steps at a fixed **60 Hz**, decoupled from rendering: `requestAnimationFrame` accumulates real time, runs at most 4 catch-up steps, then drops the remainder.
- The recorder, when it lands, samples at **10 Hz** (every 6th tick). Playback interpolates between samples.
- Multiplayer later: the same 60 Hz step runs server-side, clients send input at 20 Hz.

## Flight model (decided 25 Oct 2026)

Modelled on a DJI camera drone, not FPV acro: self-levelling angle mode, altitude hold, stabilised gimbal. Acro is unlearnable on a first raid and wrong for a photography game; a rate-mode toggle can come later as an unlock. Numbers live in `game/sim/flight.ts`.

| Parameter | Value |
|---|---|
| Max tilt | 30 degrees, 38 sprinting |
| Cruise / sprint | 6 / 9 m/s |
| Climb / descend | 3 / 2.5 m/s |
| Yaw | 140 deg/s, 0.18 s ramp |
| Self-level | about 0.4 s |
| Braking | stops in about 0.5 m from cruise (position hold) |
| Gimbal | -90 to +30 degrees pitch, 90 deg/s slew, stabilised |
| Battery | 8 min; hover x1, cruise x1.2, sprint x2 |
| Collision | 0.25 m sphere against boxes, damped bounce |

**The gimbal is the keystone.** Because the camera is stabilised, body bank never blurs a shot; only gimbal slew and translation do. Sharpness becomes legible: stop moving, slow the pan, take the picture. Flying fast and shooting clean are separate acts, which is the tension the suspicion meter wants.

**Sprint is the most visible move, not the loudest.** At 38 degrees the drift off lane is obvious. Suspicion punishes pattern breaks rather than speed, so going fast is cheap inside a lane and expensive outside one.

**Controls.** Plain FPS layout. Mouse X turns the airframe, mouse Y tilts the gimbal. W/S forward and back, A/D strafe, Space/C altitude, Shift sprint, V raises or lowers the camera. No Ctrl bindings: Ctrl+W closes the tab. Gamepad: left stick move and strafe, right stick yaw and gimbal pitch, d-pad altitude.

**Two views, one craft (decided 26 Oct 2026).** Chase is the default: the camera sits 2.3 m behind and 1.15 m above the airframe, looking six metres ahead, and pulls in when a rack would block it. It exists because a pilot who cannot see the drone cannot read its attitude, and attitude is the whole control scheme: nose-down means moving, bank means turning, rotor pitch means throttle. The lens view is the gimbal, with the crosshair, and it is the only view that shows the frame you are about to photograph. The drone is drawn in chase and hidden in lens, and the pod visibly counter-rotates against the airframe so the gimbal reads as stabilised.

## UI: two parts (25 Oct, fify)

**Site (pre-game): normal web UI.** Landing page, Google sign-in, account, settings outside the game, news. Plain HTML and CSS are fine here, and so is Google's own sign-in button.

**Game (once loaded): everything in the canvas.** Same approach as hullpack-hero (rajahafify/hullpack-hero):
- The game page holds one `<canvas>` and nothing else. The only DOM access is grabbing it at boot.
- The HUD is a second three.js scene with an orthographic camera in screen pixels, drawn over the game each frame.
- Text is a cached canvas texture (`render/text.ts`). Panels, buttons and bars are meshes and lines from a small `ui/core` module, drawn immediate-mode and rebuilt every frame.
- Hit areas are registered every frame, immediate-mode style. The topmost one under the pointer gets the click.
- Input comes from pointer and keyboard listeners on the canvas and window, plus the gamepad API.
- All sizes, fonts and colors come from `style/theme` and `style/palette`.
- The sim owns the state and the UI only reads it. Every action, from mouse, gamepad or keyboard, goes through one command bus. That bus doubles as the clean action log for the recorder.
- The hideout, upgrades, notes, raid results and the pause menu are all in-game, so they are canvas too.

**How the two connect**
- Separate folders and pages: `site/` (normal UI) and `game/` (canvas only), for example `/` and `/play`.
- The site signs the player in. The Worker checks the Google token and sets a session cookie. The game page reads the player record from the Worker with that cookie, so it never needs a login screen of its own.
- The `check-no-dom` script runs on `game/` only and fails the build on DOM, CSS or UI framework use there. The one exemption is `game/main.ts` grabbing the canvas at boot. `site/` is not checked.
- Leaving the game (Quit) goes back to the site.

## Hosting (Cloudflare, free tier)

Decided 25 Oct 2026: **the demo runs entirely in the client.** One Worker serves the static build and handles only what cannot live in the browser: sign-in and the player record. No game logic, no simulation, no server tick, no Durable Object, no Containers in the demo. No recordings either: the shape is prepared, nothing is captured (see Recording).

| Piece | Runs where | Does |
|---|---|---|
| Site and game | Browser, static assets | Everything: 60 Hz sim, the Grader's units, suspicion, scoring, hideout UI |
| `worker/index.ts` | Worker | Three routes: sign in, read player, submit raid result. Nothing else |
| D1 | — | Player record: unlocks, data balance, fitted parts, notes |
| R2 | — | Not used in the demo. Reserved for raid recordings when they turn on |

One Worker with an assets directory (`html_handling: "auto-trailing-slash"`), built by Vite with `@cloudflare/vite-plugin`. Not Pages: same origin for `/`, `/play` and `/api` means no CORS and a session cookie that just works.

The client also runs with **no Worker at all.** The profile layer is one interface with two implementations: `LocalProfile` (localStorage) and `RemoteProfile` (Worker + cookie). Dev and offline play use the local one, so `npm run dev` needs no wrangler, no Google client and no network. It is also the fallback if auth breaks during a playtest.

**Trust.** With no server sim, raid results are client-reported, so the data balance is cheatable. Accepted for the demo, with two cheap guards: the Worker validates payload shape and clamps one raid's data to a sane ceiling, and the sim already carries seed, commands and per-agent state, so once the recorder lands a suspect raid can be replayed and checked offline without touching the client.

**Cost.** Static requests are free and unlimited, so only `/api` is billed: about two requests per raid (read player, submit result), and sign-in once per session. D1 is the only storage ceiling in the demo; R2 arrives with the recorder. Workers Paid (about US$5 a month) only if a free limit is hit.

## Login

- Sign-in happens on the site with Google's sign-in button. The browser receives an ID token; the Worker verifies it against Google's JWKS with `jose` (no client secret needed for the ID-token flow) and sets a session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, 30 days. One player record per Google account, keyed by the token's `sub`.
- The game page never shows a login screen. With no valid cookie it runs on `LocalProfile` and the hideout stays local until the player signs in.
- fify creates the Google Cloud OAuth client ID and sets the allowed origins: the custom domain, plus `localhost` for dev. `*.workers.dev` preview URLs are for testing only and have to be added to that list while in use, which is why the custom domain is the real sign-in origin.
- The sign-up screen carries the line about recording play, which can wait until recording turns on. The wording is open.
- One account-deletion route: drops the D1 row, and the player's R2 prefix once recordings exist. Needed before a public playtest.

## Recording (prepared, not built)

Decided 25 Oct 2026: **the demo captures nothing.** What is prepared is the shape, so turning it on later costs one folder and one Worker route, not a change to the sim.

What "prepared" means, concretely:

- The sim already produces everything a recording needs: the seed, every agent's state each tick, and the event list below. The recorder is a consumer, never a hook inside the sim.
- One interface, `Recorder`: `start(raid)`, `frame(tick, agents)`, `event(e)`, `finish()`. The demo ships `NullRecorder`, which discards. Turning it on is a second implementation and one line at boot.
- The format below is frozen now, so the first real capture is already in the final shape.
- Not built yet: the R2 bucket, the upload route, the IndexedDB retry queue. All three are named here so the later step is mechanical.

Same shape as our existing internal drone recordings, so the data looks alike.

**Format (decided 25 Oct 2026).** NDJSON, gzipped, one file per raid: `raids/{raid_id}.ndjson.gz`. One JSON object per line, short keys, numbers quantised at write time (position and velocity in cm and cm/s as integers, angles in 0.1 degrees, lux and scores as integers), so the same raid always produces the same bytes.

Three line kinds, told apart by `t`:

1. `{"t":"raid",...}` — header, first line: schema version, raid id, seed, wing, started_at, tick_hz, record_hz, build hash.
2. `{"t":"frame","k":<tick>,"a":[...]}` — one line per recorded tick at 10 Hz, carrying **every** agent, so all agents sit on one clock. Per agent: `[agent_id, body, controller, x, y, z, vx, vy, vz, ax, ay, az, yaw, pitch, roll, battery, suspicion, lens, shutter, light, zoom, command]`.
3. `{"t":"event","k":<tick>,"e":<name>,"id":<agent_id>,"d":{...}}` — sparse: seen, suspicion_raised, lost_contact, reported, kill_switch, shot (score, subject, rarity), uplink, escaped, reset, near_miss, collision, note_written, note_read.

Each frame also carries `others_in_view` and `nearest_m` per agent: the two fields the stealth analysis actually needs, and cheap to compute.

**Size.** 10 agents x 10 Hz x 600 s = 60k agent-samples per raid. About 130 bytes each as JSON text is roughly 7.8 MB raw and about 1.3 MB gzipped, plus a few hundred event lines. When it lands, the R2 free tier (10 GB) holds roughly 7,500 raids. If that ever binds, drop to 5 Hz before touching the format.

The real recorder will run in the client: buffer NDJSON in memory at 10 Hz, and at the end of the raid let the Worker stream the file to R2. A failed upload must never block the raid result; the file goes to IndexedDB and retries on the next boot.

It logs many agents, not just yours, since the Grader's units are agents too.

**The cost of skipping.** Without recordings the first playtests produce no balance data, only the results screen and whatever testers say. That is acceptable while step 3 is still answering whether leave-or-push is fun. Turn recording on before the first tuning pass, not before the first playtest.

## Multiplayer plan (later)

- Move the same sim module into a server. First pick: **Cloudflare Containers** (a Node server per raid, started by a Durable Object, asleep between raids). Needs Workers Paid. Beta status and Singapore placement not checked.
- Fallbacks: a DigitalOcean Singapore droplet (about US$4 to 6 a month, unchecked), or fify's PC behind Tailscale Funnel or Cloudflare Tunnel for scheduled playtests.
- Server authoritative. Clients send inputs, predict their own drone, and interpolate everyone else. The server records every agent on one clock.
- Lobby and queue in a Worker or Durable Object.
- P2P (a browser host over WebRTC) was looked at and dropped: the host can cheat on loot, and the raid ends when the host leaves.
