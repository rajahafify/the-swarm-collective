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
- Full: kill switch. Doors lock, units converge, a short window to escape before reset.

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
