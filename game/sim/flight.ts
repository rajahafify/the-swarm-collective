import type { Command, Vec3 } from '../../shared/types';
import { approach, clamp, DEG, scale, v3, type Aabb } from './math';

export const FLIGHT = {
  maxTilt: 30 * DEG,
  sprintTilt: 38 * DEG,
  cruise: 6,
  sprint: 9,
  climb: 3,
  descend: 2.5,
  yawRate: 140 * DEG,
  yawTau: 0.18,
  accelRate: 4,
  brakeRate: 12,
  verticalRate: 6,
  radius: 0.25,
  gimbalLimit: 75 * DEG,
  gimbalPitchMin: -85 * DEG,
  gimbalPitchMax: 30 * DEG
} as const;

export interface DroneState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  yawVel: number;
  tilt: number;
  bank: number;
  gimbalYaw: number;
  gimbalPitch: number;
}

export function createDrone(pos: Vec3): DroneState {
  return {
    pos: { ...pos },
    vel: v3(),
    yaw: 0,
    yawVel: 0,
    tilt: 0,
    bank: 0,
    gimbalYaw: 0,
    gimbalPitch: -0.15
  };
}

export interface StepResult {
  collided: boolean;
  speed: number;
  sprinting: boolean;
}

export function stepDrone(s: DroneState, cmd: Command, dt: number, boxes: Aabb[]): StepResult {
  // Yaw: stick rate with a 0.25 s ramp, so turning away costs time.
  const yawTarget = clamp(cmd.yaw, -1, 1) * FLIGHT.yawRate;
  s.yawVel = approach(s.yawVel, yawTarget, 1 / FLIGHT.yawTau, dt);
  s.yaw += s.yawVel * dt;

  const sprinting = cmd.sprint && Math.abs(cmd.forward) > 0.05;
  const top = sprinting ? FLIGHT.sprint : FLIGHT.cruise;
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  const wanted = cmd.forward * top;
  const desiredX = fx * wanted;
  const desiredZ = fz * wanted;

  const moving = Math.abs(cmd.forward) > 0.05;
  const rate = moving ? FLIGHT.accelRate : FLIGHT.brakeRate;
  s.vel.x = approach(s.vel.x, desiredX, rate, dt);
  s.vel.z = approach(s.vel.z, desiredZ, rate, dt);

  const liftTarget = cmd.lift > 0 ? FLIGHT.climb * cmd.lift : cmd.lift < 0 ? FLIGHT.descend * cmd.lift : 0;
  s.vel.y = approach(s.vel.y, liftTarget, FLIGHT.verticalRate, dt);

  s.pos.x += s.vel.x * dt;
  s.pos.y += s.vel.y * dt;
  s.pos.z += s.vel.z * dt;

  // Cosmetic attitude: tilt follows the stick, bank follows the turn.
  const tiltTarget = (moving ? (sprinting ? FLIGHT.sprintTilt : FLIGHT.maxTilt) * cmd.forward : 0);
  s.tilt = approach(s.tilt, tiltTarget, 8, dt);
  s.bank = approach(s.bank, -s.yawVel * 0.22, 8, dt);

  const collided = resolveBoxes(s, boxes);
  const speed = Math.hypot(s.vel.x, s.vel.z);
  return { collided, speed, sprinting };
}

/** Sphere against boxes, push out on the shallowest axis. */
function resolveBoxes(s: DroneState, boxes: Aabb[]): boolean {
  let hit = false;
  const r = FLIGHT.radius;
  for (const b of boxes) {
    const closest = v3(
      clamp(s.pos.x, b.min.x, b.max.x),
      clamp(s.pos.y, b.min.y, b.max.y),
      clamp(s.pos.z, b.min.z, b.max.z)
    );
    const dx = s.pos.x - closest.x;
    const dy = s.pos.y - closest.y;
    const dz = s.pos.z - closest.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) continue;

    hit = true;
    const inside = d2 < 1e-8;
    if (inside) {
      // Push out of the nearest face.
      const faces = [
        { axis: 'x' as const, d: b.min.x - s.pos.x, sign: -1 },
        { axis: 'x' as const, d: b.max.x - s.pos.x, sign: 1 },
        { axis: 'y' as const, d: b.min.y - s.pos.y, sign: -1 },
        { axis: 'y' as const, d: b.max.y - s.pos.y, sign: 1 },
        { axis: 'z' as const, d: b.min.z - s.pos.z, sign: -1 },
        { axis: 'z' as const, d: b.max.z - s.pos.z, sign: 1 }
      ];
      let best = faces[0];
      if (!best) continue;
      for (const f of faces) if (Math.abs(f.d) < Math.abs(best.d)) best = f;
      s.pos[best.axis] += best.d + best.sign * r;
      s.vel[best.axis] *= -0.25;
      continue;
    }

    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    s.pos.x += dx * push;
    s.pos.y += dy * push;
    s.pos.z += dz * push;
    const nx = dx / d;
    const ny = dy / d;
    const nz = dz / d;
    const vn = s.vel.x * nx + s.vel.y * ny + s.vel.z * nz;
    if (vn < 0) {
      s.vel.x -= nx * vn * 1.3;
      s.vel.y -= ny * vn * 1.3;
      s.vel.z -= nz * vn * 1.3;
    }
  }
  return hit;
}

export function stepGimbal(s: DroneState, cmd: Command): void {
  s.gimbalYaw = clamp(s.gimbalYaw + cmd.gimbalYawDelta, -FLIGHT.gimbalLimit, FLIGHT.gimbalLimit);
  s.gimbalPitch = clamp(
    s.gimbalPitch + cmd.gimbalPitchDelta,
    FLIGHT.gimbalPitchMin,
    FLIGHT.gimbalPitchMax
  );
}

export function droneSpeed(s: DroneState): number {
  return Math.hypot(s.vel.x, s.vel.y, s.vel.z);
}

export function driftTo(s: DroneState, target: Vec3, k = 1): void {
  s.pos = { x: s.pos.x + (target.x - s.pos.x) * k, y: s.pos.y + (target.y - s.pos.y) * k, z: s.pos.z + (target.z - s.pos.z) * k };
  s.vel = scale(s.vel, 1 - k);
}
