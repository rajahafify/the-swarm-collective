import type { Vec3 } from '../../shared/types';

export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Exponential approach that is stable at any dt. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  const t = Math.PI * 2;
  const w = a - t * Math.floor((a + Math.PI) / t);
  return w === -Math.PI ? Math.PI : w;
}

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function lenXZ(a: Vec3): number {
  return Math.hypot(a.x, a.z);
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function normalize(a: Vec3): Vec3 {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function yawVec(yaw: number): Vec3 {
  return { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
}

export function dirFromAngles(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
}

/** Deterministic PRNG. Same seed, same wing, same patrols. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

/** Distance from a point to an axis-aligned box (0 inside). */
export function distToBox(p: Vec3, b: Aabb): number {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
  return Math.hypot(dx, dy, dz);
}

/** Ray vs AABB, slab method. Returns hit distance or Infinity. */
export function rayBox(origin: Vec3, dir: Vec3, b: Aabb): number {
  let tmin = 0;
  let tmax = Infinity;

  for (const axis of ['x', 'y', 'z'] as const) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = b.min[axis];
    const hi = b.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

/** True when nothing in boxes blocks the segment a -> b. */
export function lineOfSight(a: Vec3, b: Vec3, boxes: Aabb[]): boolean {
  const d = sub(b, a);
  const l = len(d);
  if (l < 1e-6) return true;
  const dir = scale(d, 1 / l);
  for (const box of boxes) {
    const t = rayBox(a, dir, box);
    if (t > 0.05 && t < l - 0.05) return false;
  }
  return true;
}

/** Shortest distance in the XZ plane from p to the segment a -> b. */
export function distToSegmentXZ(p: Vec3, a: Vec3, b: Vec3): number {
  const ax = a.x;
  const az = a.z;
  const bx = b.x;
  const bz = b.z;
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  if (l2 < 1e-9) return Math.hypot(p.x - ax, p.z - az);
  let t = ((p.x - ax) * dx + (p.z - az) * dz) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (ax + dx * t), p.z - (az + dz * t));
}
