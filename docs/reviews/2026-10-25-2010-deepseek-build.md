# Review: DeepSeek build

25 Oct 2026, 20:10 (UTC+8). Reviewer: Claude. Requested by: fify. Status: open.

Code reviewed: local main at 8d74458 (commits 8e473c4 to 8d74458), pushed for review as branch `deepseek-build` (8f37b03, same tree minus `.github/workflows/ci.yml`).

## Summary

A solid first slice. The structure is clean, `npm run build`, `npm run check` and `npm test` all pass (25 of 25). There are two bugs that break play, two that will corrupt recorded data later, and some balance issues. Nothing needs a rewrite.

## What's good

- The sim is kept apart from rendering and input. A fixed 60 Hz tick, seeded wings and a `Command` struct mean raids replay from a seed, which is the right shape for recording later.
- The recorder is a clean seam with a do-nothing `NullRecorder`. Nothing is captured.
- The UI is canvas only, and `check-no-dom` fails the build if `game/` touches the DOM.
- Input is handled carefully: no dropped clicks at 144 Hz, and the yaw convention is documented and tested.

## Bugs that hurt play

1. **Ctrl is descend** (`game/input/input.ts:116`). Ctrl+W closes the browser tab, and players hold W and Ctrl together all the time. Pointer lock does not stop it. Move descend to another key.
2. **Ground units drive through crates.** Crates are placed at random in the aisles, and in 965 of 1,000 tested seeds a crate sits on the ground lane at z 36 (`game/sim/wing.ts:221`). Units have no collision. Their line of sight also starts inside the box, and `rayBox` ignores a box you start inside, so they see through it.
3. **Ground units float.** Investigate moves units straight at the target in 3D (`game/sim/grader.ts:349`). A ground unit chasing a target at 6 m climbs to 5.8 m. Units on patrol and investigate also move through racks and walls.
4. **The drawn vision cone is 7 m, but units see 18 m** (`game/render/scene.ts:364` vs `game/sim/grader.ts:264`). Players get seen from outside the cone they can see.

## Data bugs (matter once recording turns on)

5. **Recorded acceleration is 6x too high.** `game/sim/sim.ts:673` divides the velocity change over 6 ticks by one tick's dt. Measured: 57 recorded against 9.5 actual.
6. **Samples hold live references.** The recorder gets `drone.pos`, `drone.vel` and `u.pos` as objects that change in place every tick. Any recorder that stores frames will see every frame overwritten with the latest position. Copy them.

## Design and balance

- Being seen adds 25 suspicion per second however you fly, so 4 seconds in any unit's view ends the raid. Flying on a lane at lane speed does not help. "Blend in" is not really in the game yet, only "stay out of view". This is the main thing to playtest.
- Shift is both sprint and RAW. A RAW shot while moving forward means sprinting, which ruins sharpness, so RAW only works hovering.
- "Hold E" is really tap E and stay in range. Releasing E does not cancel.
- When you are seen at the task station, the HUD says "working the task" instead of "seen" (`game/sim/sim.ts:343`).
- The staff gate exit is 3 m from the spawn dock.

## Smaller code notes

- The UI line geometry gets new GPU buffers every frame without freeing the old ones (`game/ui/core.ts:448`), and the text texture cache never clears. Memory grows over a long session.
- 10 sodium point lights plus 3 others with standard materials will be slow on laptops.
- The gamepad cannot aim the gimbal, and right stick X overwrites left stick yaw.
- Leftovers: `PERCEPTION.reportDelay` is unused, `stepUnits` ignores two arguments, the results screen reads localStorage every frame.
- The game chunk is 580 kB. Fine for now.

## Fix first

About half a day: 1, 3, 4, 5 and 6. Then playtest the suspicion rate before building step 4.

Owner of fixes: —
