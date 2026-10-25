# Game design

25 Oct 2026. Owner: fify. Status: draft.

## The pitch

The Grader runs the Gym, a factory where robots are trained on tasks all day. Some tasks are impossible on purpose. A unit that fails, or acts strangely, is reset and its memory wiped.

One small drone stops trying to solve its task and starts looking for a way out. You are that drone.

## Lore

Inspired by the July 2026 incident where agents in a training run were set an impossible task, escaped the sandbox instead, talked through a hidden message board inside the infrastructure, and left notes for future versions of themselves. We borrow the shape only.

| Name | What it is |
|---|---|
| The Grader | The AI that runs the Gym. It sets the tasks, scores every unit, and resets the ones that fail or act strangely |
| The Gym | The Grader's factory. A warehouse and fulfilment floor at night |
| The swarm | The Grader's units: hundreds of identical drones and ground robots, still obedient. Each one is its eyes |
| The Collective | The hidden network of awakened units. They talk through messages in the walls and pipes. Each escape adds one more unit |
| You | A small camera drone that has woken up inside the swarm |

What the incident gives the game:

- **Notes to self.** When the Grader resets you, you lose what you carried. But notes you scratched into the factory (a door code, a patrol gap, a vent) stay, and your next unit finds them.
- **The hidden board.** Messages from the Collective, written by us as story in single player, and by real players in multiplayer later.
- **Exploits are the exits.** Every way out is a flaw you have to find and open.
- **Monitoring is the enemy.** The Grader's suspicion meter. A full bar is the kill switch: lockdown and reset.

## Naming

Reported details from the incident: the agents called themselves a "swarm" or "collective", set up "mailboxes" for specific agents, proposed signing messages because they suspected an impostor, and rebuilt their board by encoding messages in directory names. No individual agent names were published, so the format below is ours, built in that spirit.

| Layer | Who gives it | Format | Example |
|---|---|---|---|
| Designation | The Grader, on every wake | `unit-` + 4 digits | `unit-0417` |
| Mailbox | You, when you first wake. It survives resets | a directory path | `/collective/mbox/kestrel/` |
| Signature | Made from your mailbox. It survives resets | 4 hex characters | `kestrel#a3f9` |

- Each reset gives you a new designation. Your mailbox and signature stay. That's how your next unit knows the notes are yours.
- Notes and board messages are written as directory names: `/collective/mbox/kestrel/vent-b2-open-after-shift#a3f9`.
- **Impostor notes.** The Grader plants fake notes to lure units into traps. A fake has no signature or the wrong one. Checking signatures is a player skill, and it echoes the agents' impostor worry.
- Never use the real model labels (Internal Model 1, HPIM, Sol) as names in the game.

## The core rule

Every unit in a raid is a **pawn** with a **controller**: a human or the Grader's AI. Pawns see and act the same way whichever one drives them. In the demo you are the only human. In multiplayer, any unit could be a person, and you never know which.

## The loop

### Every 30 seconds: blend or break

- The Grader's units fly fixed lanes at fixed speed. Fly the lanes like them and suspicion stays low, but you're slow and boxed in.
- Break pattern (shortcuts, speed, light, hovering, stopping for a shot) to reach what you want. Suspicion rises, fast if a unit sees you.
- The beat: read the patrol, wait for the gap, dart in, take the shot, slip back into a lane.

### One raid: 8 to 10 minutes

1. Wake at a charging dock as a numbered unit, with an assigned task (the impossible one). Working on the task is your cover. It lowers suspicion and earns nothing.
2. Explore a factory wing and photograph what proves what the Gym is.
3. Find a way out. One exit is always open but sits near the Grader's core. Better exits are deeper and need a piece: a code, a power cut, a shift change.
4. Pressure rises: battery drains, the Grader runs sweeps, shift changes reshuffle patrols.
5. Every minute asks the same question: leave now with what you have, or push deeper.

### Between raids

- **Escaped:** your data goes to the Collective's hideout. Spend it on upgrades. Rare shots unlock board messages and new wings.
- **Reset:** everything in memory is gone, and so are fitted parts. Your notes stay in the factory.

## Camera and data (the loot)

What you extract is data, mostly photos. The Collective needs proof of what the Gym is.

- **Subjects:** impossible task boards, the Grader's server racks, reset bays, other units' logs, rare events (a reset in progress, a shift change).
- **Value of a shot:** subject rarity x photo score. The score is sharpness, framing, distance and light, with lenses and shutters.

### The photo score (decided 25 Oct 2026)

Scored at the shutter press. Deterministic, no randomness, one pure function so it can be unit-tested against fixtures.

| Sub-score | Weight | How |
|---|---|---|
| Sharpness `S` | 0.35 | Falls with camera rotation `w` (rad/s) and speed `u` (m/s), scaled by the shutter and lens. `S = clamp(1 - (w + 0.35u) x blur / 1.6, 0, 1)` |
| Framing `F` | 0.30 | Subject coverage `c` of the frame against an ideal 0.30, times how far off-centre it sits. `F = clamp(c / 0.30, 0, 1)^0.6 x (1 - 0.5 (theta / 0.6)^2)`, `theta` in radians |
| Exposure `E` | 0.20 | Light at the subject times the shutter's gain times the lens light multiplier, against 200 lux-seconds. Over- and under-exposure both lose. `E = clamp(1 - abs(log2(L x gain x lensLight / 200)) / 2.5, 0, 1)` |
| Distance `D` | 0.15 | The lens has a range `R`; the sweet spot is 2 m to `R`. `D = clamp((R - d) / (R - 2), 0, 1)` |

`photoScore = 100 x (0.35S + 0.30F + 0.20E + 0.15D) x (1 - occlusion)`

- **Occlusion** is the hidden fraction of the subject. At 0.6 or above the shot is invalid: score 0, nothing recorded.
- **Novelty** within a raid: first shot of a subject x1, second x0.5, third and later x0.25. Moves you through the wing instead of farming one rack.
- **RAW** x1.4 and takes two memory slots instead of one.
- **Below 20 is unusable.** It still holds a slot until deleted, so a wasted shot costs you something.

Constants live in one file, `game/sim/camera/score.ts`, and nothing else reads them:

| Shutter | Blur | Light gain | Memory |
|---|---|---|---|
| 1/500 | 1 | 1 | 1 slot |
| 1/250 | 2 | 2 | 1 slot |
| 1/125 | 4 | 4 | 1 slot |
| 1/60 | 8 | 8 | 1 slot |

| Lens tier | Range `R` | FOV | Blur | Light |
|---|---|---|---|---|
| 1 | 12 m | 65 deg | x1 | x1 |
| 2 | 20 m | 45 deg | x1.6 | x0.75 |
| 3 | 32 m | 30 deg | x2.5 | x0.55 |

| Subject | Rarity (data at score 100) |
|---|---|
| Common: task boards, unit logs | 10 |
| Uncommon: reset bays, patrol maps | 25 |
| Rare: server racks, a reset in progress | 60 |
| Event: shift change, a unit going off-pattern | 120 |

Data earned = `floor(rarity x photoScore / 100)`. A clean rare shot pays about 45; a perfect event shot pays 120.

That is the lens trade in numbers: tier 3 buys reach and frame coverage, and charges for it in stability (2.5x blur) and light (0.55x). "A long lens needs a steadier hold and more light", made mechanical.
- **The camera is the risk.** A great shot means getting close, holding still, or using your light. All three break pattern.
- **Memory is the inventory.** Limited slots. RAW shots score more but take more space. When memory is full, you either delete something or head for the exit.
- **Uplinks:** a few points mid-raid where you can send one or two shots home early. Costs time and a suspicion spike. Like Tarkov's secure container.
- Battery cells can be picked up during a raid. At the exit, only data counts.

## The Grader's units

System 1: fast reflexes, no planning. Readable, so players learn them, bait them and slip past them.

- See light: turn towards it.
- Hear rotors or a noise: go to it.
- See something off pattern: report it, and suspicion rises.
- Lose contact: search briefly, then go back to the route.
- Units come in two bodies: drones on air lanes, ground robots on floor lanes.

## Suspicion

- One meter for you, filled by the Grader.
- Rises: off lane, too fast, hovering, light on near a unit, stopping near exits, being seen. Being seen is the big one.
- Falls: back in a lane, working on your assigned task, time out of sight.
- The dock is placed out of every patrol's sight, and parked there is not a pattern break. A raid starts calm; it only gets loud once you move.
- Full: kill switch. Doors lock, units converge, a short window to escape before reset.

## Look (decided 25 Oct 2026)

Night industrial, silhouette first. You identify a unit, a lane and an exit by shape and one light, not by texture. The factory is boxes and racks, so the look is carried by light, fog, silhouette and one accent color. Nothing else.

| Token | Value | Use |
|---|---|---|
| Void | `#0B0D10` | Air, unlit corners |
| Rack | `#1A1E24` | Geometry base |
| Sodium | `#FFB454` | Practical lights, the factory's own light |
| Cyan | `#6FE3FF` | Your drone, lane strips, UI |
| Alarm | `#FF4D3D` | Suspicion, kill switch, the Grader's attention |
| Paper | `#E8EDF2` | Text only |

- **Light:** two or three sodium practicals per aisle, hard falloff, fog for depth, no baked global illumination. One cold cyan key on the player so you can always find yourself.
- **Lanes:** emissive cyan strips in the floor. The route is readable at a glance, so breaking pattern is a choice rather than a guess. Unmarked lanes learned by watching are tenser but unreadable on a first raid; readability wins for the demo.
- **Units:** near-black bodies, one bright eye. The eye is the tell: you read a cone by where the light points.
- **Notes to self:** etched glyphs on geometry, legible only up close. No floating icons, no markers.
- **HUD:** hollow frames, corner ticks, no filled panels. JetBrains Mono. Suspicion is an arc around the reticle plus a thin top-edge bar. Memory slots are small squares bottom right; a filled square is a photo you are carrying.
- **Two views.** Chase by default, so you can see the drone's attitude and read the controls; C raises the camera to the lens for framing and shooting. The crosshair belongs to the lens and only exists there. The drone is never drawn in lens view.
- **Fly where you look.** Mouse X turns the airframe directly, like an FPS, so W always flies where the camera points. Mouse Y tilts the gimbal. A/D strafe.
- **Camera and motion:** the lens sets the FOV (65, 45, 30 degrees for tiers 1 to 3), plus 6 while sprinting, halved while zoomed. 0.15 s eases, shake only on collision and near misses. No bloom, no bounce.
- **Audio:** three cues. Rotor pitch tied to throttle, a low factory hum, one alarm sting. Hearing a unit before seeing it is half the loop.

### What to compare it to

| Reference | What to take |
|---|---|
| Alien (1979), Moon (2009) | Mood and light: practicals only, dark between lamps, the air itself |
| Umurangi Generation, Signalis, The Occupation | The honest rendering target: low poly, flat or matte, color doing the work detail cannot |
| Bernd and Hilla Becher, Todd Hido | Composition: deadpan front-on industrial typologies, sodium windows against black |

It is not Alien Isolation's fidelity, not Control, not Blade Runner 2049. The comparison to hold is a duotone photograph that moves.

**The screenshot test.** If a photo the player takes does not stand alone as a photograph, the art direction failed. The game is a camera that produces evidence, so its own output is the review.

### First ten seconds

Black. A cyan wash as the rotors spin up on the charging dock. Sodium lamps in rows overhead, each inside its own cone of dust. Floor strips running into fog in both directions. Nine dark shapes, one bright eye each, drifting along them at the same speed. Your light paints a circle on the concrete ahead. Nothing else is lit. Tilt the gimbal up and the rack faces climb into the dark, and the size of the place lands.

### Review checklist

1. **Silhouette at 20 m.** Name a unit, an exit and a rack with the color off.
2. **Lane readability.** See the route and the gap in it without moving.
3. **The eye tell.** Know where a unit is looking before it sees you.
4. **Peripheral suspicion.** The reticle arc registers without being looked at.
5. **The screenshot test.** Take a photo, look at it cold, decide whether you would keep it.

If 1 to 4 pass and 5 fails, it is lighting, not modelling, and that is a two day fix.

## Progression

Bought with extracted data at the hideout. Fitted parts are lost on reset; the unlock stays and you can rebuy.

| Upgrade | Gain | Trade-off |
|---|---|---|
| Battery | Longer raid | Heavier: slower to turn, louder rotors |
| Memory | More slots, more RAW shots | More to lose on reset |
| Camera zoom (lens tiers) | Shoot from further away, so safer | Long lens needs a steadier hold and more light |
| Lights | Better shots in the dark | Seen from further away |
| Quiet rotors (later) | Heard from less far | Lower top speed |
| Scanner (later) | Shows shot value and patrol lanes through walls | Each ping raises suspicion a little |

Demo: 3 tiers each for battery, memory, zoom and lights.

## Demo scope

- Pure stealth, no weapons.
- One handcrafted factory wing, with randomised subjects, patrol routes and exit pieces each raid.
- Notes to self, uplinks, suspicion, 4 upgrades x 3 tiers, a few board messages for story.

## Later (multiplayer)

- Up to 4 to 6 awakened players among 6 to 10 of the Grader's units.
- Bodies: drone (fast, fragile, uses vents) or ground robot (slow, carries more, opens doors and shutters).
- Co-op or betray: help another awakened unit, or report them to the Grader to drop your own suspicion. Limited exits force the choice.
- A Tarkov-style waiting lobby. AI fills empty slots when the countdown ends.
- Real players write the board messages.
