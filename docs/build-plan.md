# Build plan

25 Oct 2026. Owner: fify. Status: draft. Runway is under three months, so each step is short and playable.

| Step | What | Rough time |
|---|---|---|
| 0 | Scaffold: npm, Vite, TypeScript, `site/` and `game/` entries, `check-no-dom` and `check-no-node` gates, CI, one smoke test. Nothing playable | 0.5 day |
| 1 | Flight and camera in three.js: drone flight model, lenses, shutters, photo scoring (ported from the Firefly code, internal only) | 3 to 4 days |
| 2 | One factory wing, the Grader's units on lanes with System 1 rules, suspicion meter, kill switch | 3 to 4 days |
| 3 | Raid loop: assigned task as cover, memory slots, uplinks, exits with pieces, escape or reset, results screen | 2 to 3 days |
| 4 | Site page with Google sign-in (normal HTML). In-game hideout (canvas): data balance, 4 upgrades x 3 tiers, notes to self, a few board messages. Cloudflare Worker + D1 | 2 to 3 days |
| 5 | Playtest with a handful of people: results screen and notes by hand. Recording stays off | 1 to 2 days |

As of 25 Oct 2026, steps 0 to 3 exist in the repo as a first slice: one wing, one raid, flight, camera scoring, patrols, suspicion, kill switch, exits, results, local profile. Step 4 (sign-in, hideout) and step 5 (playtest) are not built.

About two weeks to a playable demo, plus half a day of scaffold. Step 3 is where we find out if leave-or-push is fun. If it isn't, fix that before anything else.

## Open questions

- Final title: The Swarm Collective or Escape From the Swarm. Trademark check: —
- Run length: 8 to 10 minutes proposed.
- How many notes per raid: —
- Art direction for the factory: —
- Domain: —
- When recording turns on, and the consent wording: — (shape is prepared in tech.md, nothing captured yet)
