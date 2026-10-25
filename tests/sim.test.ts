import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../game/sim/sim';
import { NullRecorder } from '../game/recorder/recorder';
import { consumeCommand, emptyCommand, mergeCommand } from '../shared/types';
import { createDrone, FLIGHT, stepDrone } from '../game/sim/flight';
import { createTicker } from '../game/sim/tick';
import { buildWing, distanceToLane } from '../game/sim/wing';
import { mulberry32 } from '../game/sim/math';

function fly(seconds: number, cmd = emptyCommand()): ReturnType<typeof createDrone> {
  const wing = buildWing(1);
  const drone = createDrone({ x: 20, y: 8, z: 8 });
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i += 1) stepDrone(drone, cmd, dt, wing.boxes);
  return drone;
}

function speedOf(drone: ReturnType<typeof createDrone>): number {
  return Math.hypot(drone.vel.x, drone.vel.z);
}

test('flight accelerates to cruise and holds it', () => {
  const s = speedOf(fly(3, { ...emptyCommand(), forward: 1 }));
  assert.ok(s > 5.4, 'speed ' + s);
  assert.ok(s < 6.4, 'speed ' + s);
});

test('sprint is faster than cruise', () => {
  const s = speedOf(fly(2.5, { ...emptyCommand(), forward: 1, sprint: true }));
  assert.ok(s > 7.5, 'speed ' + s);
});

test('releasing the stick brakes to a stop', () => {
  const wing = buildWing(1);
  const drone = createDrone({ x: 20, y: 8, z: 8 });
  for (let i = 0; i < 240; i += 1) stepDrone(drone, { ...emptyCommand(), forward: 1 }, 1 / 60, wing.boxes);
  for (let i = 0; i < 120; i += 1) stepDrone(drone, emptyCommand(), 1 / 60, wing.boxes);
  assert.ok(speedOf(drone) < 0.35);
});

test('a sprint into a wall stays inside the wing', () => {
  const wing = buildWing(1);
  const drone = createDrone({ x: 30, y: 2, z: 20 });
  for (let i = 0; i < 600; i += 1) stepDrone(drone, { ...emptyCommand(), forward: 1, sprint: true }, 1 / 60, wing.boxes);
  assert.ok(drone.pos.x > -1 && drone.pos.x < 61);
  assert.ok(drone.pos.z > -1 && drone.pos.z < 41);
});

test('every lane point sits on its own lane', () => {
  const wing = buildWing(7);
  for (const lane of wing.lanes) {
    for (const p of lane.points) {
      assert.ok(distanceToLane(wing, p, lane.body) < 0.01);
    }
  }
});

test('a seed builds the same wing, a new seed does not', () => {
  const a = buildWing(42).boxes.map((b) => b.min.x);
  const b = buildWing(42).boxes.map((b) => b.min.x);
  const c = buildWing(43).boxes.map((b) => b.min.x);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('the rng repeats for a seed', () => {
  const a = mulberry32(9);
  const b = mulberry32(9);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('a raid starts docked, launches, and runs the clock', () => {
  const sim = new Sim(5, new NullRecorder());
  assert.equal(sim.phase, 'dock');
  sim.step(1 / 60, { ...emptyCommand(), actions: ['launch'] });
  assert.equal(sim.phase, 'active');
  for (let i = 0; i < 60; i += 1) sim.step(1 / 60, emptyCommand());
  assert.ok(sim.raidTime > 0.9);
  assert.ok(sim.battery < 480);
});

test('a shot with nothing in frame is refused', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  // Face the south wall from the middle of the floor: no subject in the frame.
  sim.drone.pos = { x: 30, y: 2, z: 34 };
  sim.drone.yaw = 0;
  sim.drone.gimbalYaw = 0;
  sim.drone.gimbalPitch = 0;
  const shot = sim.shoot(false);
  assert.equal(shot.ok, false);
  assert.equal(sim.photos.length, 0);
});

test('a subject up close scores and takes a memory slot', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  const subject = sim.wing.subjects[0];
  assert.ok(subject);
  if (!subject) return;
  sim.drone.pos = { x: subject.pos.x, y: subject.pos.y, z: subject.pos.z + 3.2 };
  sim.drone.yaw = Math.PI;
  sim.drone.gimbalYaw = 0;
  sim.drone.gimbalPitch = 0;
  sim.light = true;
  const shot = sim.shoot(false);
  assert.equal(shot.ok, true);
  assert.ok(shot.score > 0, 'score ' + shot.score);
  assert.equal(sim.usedSlots, 1);
});

test('the battery dying ends the raid', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  sim.battery = 0.01;
  sim.step(1 / 60, emptyCommand());
  assert.equal(sim.phase, 'reset');
});

test('two minutes of noisy input never produces NaN', () => {
  const sim = new Sim(11, new NullRecorder());
  sim.launch();
  for (let i = 0; i < 60 * 120; i += 1) {
    const phase = Math.floor(i / 90) % 4;
    const cmd = emptyCommand();
    cmd.forward = phase === 0 ? 1 : phase === 1 ? -1 : 0;
    cmd.yaw = phase === 2 ? 0.7 : phase === 3 ? -0.7 : 0;
    cmd.strafe = phase === 1 ? 1 : phase === 3 ? -1 : 0;
    cmd.lift = i % 200 < 60 ? 1 : i % 200 > 160 ? -1 : 0;
    cmd.yawDelta = Math.sin(i / 40) * 0.01;
    cmd.gimbalPitchDelta = Math.cos(i / 55) * 0.01;
    sim.step(1 / 60, cmd);
    assert.ok(Number.isFinite(sim.drone.pos.x), 'x went non-finite at ' + i);
    assert.ok(Number.isFinite(sim.drone.pos.y), 'y went non-finite at ' + i);
    assert.ok(Number.isFinite(sim.suspicion), 'suspicion went non-finite at ' + i);
  }
  assert.ok(sim.drone.pos.x > -2 && sim.drone.pos.x < 62);
  assert.ok(sim.drone.pos.z > -2 && sim.drone.pos.z < 42);
  assert.ok(sim.drone.pos.y > -1 && sim.drone.pos.y < 30);
});

test('yaw increases to the left, so a right turn is a negative yaw', () => {
  // three builds the camera basis as right = cross(up, -forward).
  const up = { x: 0, y: 1, z: 0 };
  const forward = { x: Math.sin(0), y: 0, z: Math.cos(0) };
  const zAxis = { x: -forward.x, y: 0, z: -forward.z };
  const right = {
    x: up.y * zAxis.z - up.z * zAxis.y,
    y: up.z * zAxis.x - up.x * zAxis.z,
    z: up.x * zAxis.y - up.y * zAxis.x
  };
  const turned = { x: Math.sin(0.1), y: 0, z: Math.cos(0.1) };
  const towardRight = turned.x * right.x + turned.z * right.z;
  assert.ok(towardRight < 0, 'increasing yaw should turn away from screen right');
});

test('holding the right-turn input moves the drone toward screen right', () => {
  const wing = buildWing(1);
  const drone = createDrone({ x: 20, y: 8, z: 8 });
  // About a quarter turn: 140 deg/s with a 0.18 s ramp lands near -90 degrees.
  for (let i = 0; i < 45; i += 1) stepDrone(drone, { ...emptyCommand(), yaw: -1 }, 1 / 60, wing.boxes);
  for (let i = 0; i < 120; i += 1) stepDrone(drone, { ...emptyCommand(), forward: 1 }, 1 / 60, wing.boxes);
  assert.ok(drone.vel.x < -0.5, 'x velocity ' + drone.vel.x);
});

test('the camera starts in chase view and V toggles it', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  assert.equal(sim.viewMode, 'chase');
  sim.step(1 / 60, { ...emptyCommand(), actions: ['view'] });
  assert.equal(sim.viewMode, 'gimbal');
  sim.step(1 / 60, { ...emptyCommand(), actions: ['view'] });
  assert.equal(sim.viewMode, 'chase');
});

test('a shot works from chase view, using the gimbal aim', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  const subject = sim.wing.subjects[0];
  assert.ok(subject);
  if (!subject) return;
  sim.drone.pos = { x: subject.pos.x, y: subject.pos.y, z: subject.pos.z + 3.2 };
  sim.drone.yaw = Math.PI;
  sim.drone.gimbalYaw = 0;
  sim.drone.gimbalPitch = 0;
  sim.light = true;
  assert.equal(sim.viewMode, 'chase');
  const shot = sim.shoot(false);
  assert.equal(shot.ok, true);
  assert.ok(shot.score > 0);
});

function angleBetween(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

test('mouse look turns the airframe with no stop', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  const before = sim.viewYaw;
  // 172 degrees of mouse drag, spread over a second.
  const turn = (-172 * Math.PI) / 180;
  for (let i = 0; i < 60; i += 1) sim.step(1 / 60, { ...emptyCommand(), yawDelta: turn / 60 });
  assert.ok(angleBetween(sim.viewYaw, before + turn) < 0.001, 'view turned to ' + sim.viewYaw);
  assert.equal(sim.drone.gimbalYaw, 0);
});

test('W flies where the camera points, from the first moment', () => {
  const sim = new Sim(5, new NullRecorder());
  sim.launch();
  sim.drone.pos = { x: 30, y: 4.5, z: 20 };
  sim.step(1 / 60, { ...emptyCommand(), yawDelta: (-75 * Math.PI) / 180 });
  const view = sim.viewYaw;
  for (let i = 0; i < 15; i += 1) {
    sim.step(1 / 60, { ...emptyCommand(), forward: 1 });
    const heading = Math.atan2(sim.drone.vel.x, sim.drone.vel.z);
    assert.ok(angleBetween(heading, view) < 0.01, 'tick ' + i + ' off by ' + angleBetween(heading, view));
  }
});

test('D strafes toward screen right', () => {
  const wing = buildWing(1);
  const drone = createDrone({ x: 20, y: 8, z: 8 });
  for (let i = 0; i < 60; i += 1) stepDrone(drone, { ...emptyCommand(), strafe: 1 }, 1 / 60, wing.boxes);
  // At yaw 0 the camera looks down +Z and screen right is -X.
  assert.ok(drone.vel.x < -3, 'x velocity ' + drone.vel.x);
  assert.ok(Math.abs(drone.vel.z) < 0.01, 'z velocity ' + drone.vel.z);
  assert.equal(drone.yaw, 0);
});

test('diagonal flight is capped at top speed', () => {
  const s = speedOf(fly(3, { ...emptyCommand(), forward: 1, strafe: 1 }));
  assert.ok(s <= FLIGHT.cruise + 1e-6, 'speed ' + s);
  assert.ok(s > FLIGHT.cruise * 0.9, 'speed ' + s);
});

test('a slow frame keeps flying on every step it runs', () => {
  const run = (frameDt: number, frames: number): number => {
    const sim = new Sim(5, new NullRecorder());
    sim.launch();
    sim.drone.pos = { x: 30, y: 4.5, z: 20 };
    const pending = emptyCommand();
    const ticker = createTicker((dt) => {
      sim.step(dt, pending);
      consumeCommand(pending);
    });
    for (let i = 0; i < frames; i += 1) {
      mergeCommand(pending, { ...emptyCommand(), forward: 1 });
      ticker(frameDt);
    }
    return sim.drone.pos.x;
  };
  // One second at 60 fps and one second at 15 fps (four steps a frame) should fly about the same distance.
  const fast = run(1 / 60, 60);
  const slow = run(1 / 15, 15);
  assert.ok(Math.abs(fast - slow) < 0.1 * Math.abs(fast - 30), 'fast ' + fast + ' slow ' + slow);
});

test('mouse deltas and actions are used once, held axes are kept', () => {
  const pending = emptyCommand();
  mergeCommand(pending, { ...emptyCommand(), forward: 1, strafe: -1, lift: 1, yawDelta: 0.2, actions: ['shutter'] });
  consumeCommand(pending);
  assert.equal(pending.forward, 1);
  assert.equal(pending.strafe, -1);
  assert.equal(pending.lift, 1);
  assert.equal(pending.yawDelta, 0);
  assert.deepEqual(pending.actions, []);
});
