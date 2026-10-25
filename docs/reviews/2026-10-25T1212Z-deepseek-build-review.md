# Review: DeepSeek build of The Swarm Collective

Reviewed 2026-10-25 12:12 UTC (20:12 MYT). Branch `deepseek-build` (commit 8f37b03), the same code as fify's local main minus `.github/workflows/ci.yml`.

## Verdict

A solid first slice. Steps 0 to 3 of the build plan are there and the code is clean. Fix the eight bugs below before anyone plays it. Steps 4 and 5 (sign-in, hideout, notes to self, upgrades, playtest) are not built, as its README says.

## What I checked

- `npm run check` passes: tsc, plus the no-DOM and no-Node gates. `npm test` passes 25 of 25. `npm run build` passes, with one warning: the game chunk is 581 kB (149 kB gzip).
- Ran it in headless Chromium: the site page, the title card and a raid load with no console errors.
- Read the sim (sim, flight, grader, camera, wing, tick, main) and probed the bugs below with a script.

## What's good

- It follows the docs closely: site/ is normal HTML, the game page is one canvas, and the HUD is drawn in three.js.
- The sim is pure TS with no DOM or three.js inside, on a fixed 60 Hz tick. A `check-no-node` gate keeps it portable. That's the multiplayer-ready shape we asked for.
- The photo score is one pure function with unit tests. It wrote the formula and tables back into game-design.md.
- The look matches the design: dark factory, sodium lights, drone in chase view, hollow HUD.

## Bugs (fix first)

1. **No floor or ceiling.** The wing has four walls and racks, but nothing above or below. Holding descend for 10 s puts the drone at y = -23 m, and climbing above 12 m flies it over the walls and out of the factory. Fix: clamp y between about 0.3 m and the roof, or add floor and roof boxes.
2. **Cover doesn't work.** Parked at the task station for 5 s, suspicion went from 50 up to 73. Cover only takes 8 off the rise, so a unit seeing you (+25) still wins. And when nothing else is rising, the -8 is thrown away, because decay is a fixed 3 per second after a 3 second wait. Fix: while on cover, don't count sightings and decay faster.
3. **Input drops on slow frames.** In `game/main.ts`, `pending` is reset after every sim step. When a frame runs two or more steps (any display below 60 fps), every step after the first gets an empty command. Forward, lift and yaw go to zero, so the drone stutters and flies slower on weaker machines. Fix: clear only the edges and mouse deltas after a step, and keep held axes.
4. **Ground robots can float.** In `grader.ts`, investigate mode moves units straight at the target in 3D. A ground robot sent after a drone at 5 m rises 5 m into the air. Units also pass through racks, since `stepUnits` ignores `boxes`. Fix: keep ground units at floor height and steer them around boxes (or along lanes).
5. **Ctrl is descend.** Ctrl+W closes the browser tab, and players hold W all the time. Move descend to another key.
6. **Crates block the ground patrol lane** in 965 of 1,000 seeds (wing.ts, lane at z 36). Units drive through them, and because the line-of-sight test ignores a box you start inside, they can also see through them.
7. **The drawn vision cone is 7 m, but units see 18 m.** Players get caught from outside the cone they can see.
8. **Samples hold live references** to drone and unit positions, so any recorder that stores frames gets every frame overwritten with the latest position. Copy them. (Only matters once recording is on.)

## Design

- **"Blend in" isn't in the game yet.** Being seen adds 25 suspicion a second however you fly, so 4 seconds in view ends the raid, even on a lane at lane speed. It's really "stay out of view". This is the main thing to playtest and tune.
- Shift is both sprint and RAW. A RAW shot means sprinting, and sprinting raises speed, which blurs the shot. Give RAW its own key.
- "Hold E" is really tap E: once started, the hold finishes even if you let go.
- The Grader's System 1 rules are half there. Units don't turn toward your light (the light only adds suspicion), there's no brief search on lost contact, and `reportDelay` is defined but never used.
- Seen at the task station, the HUD says "working the task" instead of "seen".
- The staff gate exit is 3 m from the spawn dock.

## Smaller things

- Recording is off (NullRecorder), and the build plan now says "Recording stays off". That's fine for the first playtest, but it drops the data side for now. When it comes back: unit velocities are logged as zero, and acceleration is divided by one tick over a 6-tick gap (6x too big).
- UI line geometry creates new GPU buffers every frame without freeing them, and the text cache never clears, so memory grows over a long session.
- 10 sodium point lights with standard materials will be slow on laptops.
- A gamepad can't aim the gimbal, and the right stick's X overwrites the left stick's yaw.
- ci.yml is only on local main. Pushing it needs a GitHub token with the `workflow` scope (`gh auth refresh -s workflow`).

## Next step

About a day: fix bugs 1 to 8, then tune suspicion so flying a lane at lane speed while seen is safe, or nearly. Then fify plays it for 10 minutes and answers one question before step 4 gets built: is leave-or-push fun yet?
