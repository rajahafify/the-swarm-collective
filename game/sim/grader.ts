import type { Body, Vec3 } from '../../shared/types';
import { clamp, DEG, dirFromAngles, dist, dot, lineOfSight, normalize, sub, v3, type Aabb } from './math';
import type { LaneDef, WingDef } from './wing';

export const PERCEPTION = {
  cone: 70 * DEG,
  sight: 18,
  hearing: 12,
  investigateSpeed: 3.4,
  searchTime: 6,
  reportDelay: 0.6
} as const;

export type UnitMode = 'patrol' | 'investigate';

export interface Unit {
  id: number;
  body: Body;
  lane: LaneDef;
  seg: number;
  pos: Vec3;
  yaw: number;
  mode: UnitMode;
  timer: number;
  target: Vec3 | null;
  speed: number;
}

export function createUnits(wing: WingDef): Unit[] {
  const units: Unit[] = [];
  let id = 1;
  for (const lane of wing.lanes) {
    const count = lane.body === 'ground' ? 2 : lane.id === 'lane-d' ? 3 : 2;
    for (let i = 0; i < count; i += 1) {
      const p = pointOnLane(lane, (i + 0.5) / count);
      units.push({
        id,
        body: lane.body,
        lane,
        seg: p.seg,
        pos: p.pos,
        yaw: p.yaw,
        mode: 'patrol',
        timer: 0,
        target: null,
        speed: lane.speed
      });
      id += 1;
    }
  }
  return units;
}

function pointOnLane(lane: LaneDef, t: number): { pos: Vec3; seg: number; yaw: number } {
  const total = lane.points.length;
  const f = clamp(t, 0, 0.999) * total;
  const seg = Math.floor(f);
  const frac = f - seg;
  const a = lane.points[seg] ?? lane.points[0];
  const b = lane.points[(seg + 1) % total] ?? a;
  const pos = v3(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac, a.z + (b.z - a.z) * frac);
  return { pos, seg, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}

export function stepUnits(units: Unit[], dt: number, playerPos: Vec3, boxes: Aabb[]): void {
  for (const u of units) {
    if (u.mode === 'patrol') {
      const a = u.lane.points[u.seg];
      const b = u.lane.points[(u.seg + 1) % u.lane.points.length];
      if (!a || !b) continue;
      const d = dist(u.pos, b);
      const step = u.speed * dt;
      if (d <= step) {
        u.pos = { ...b };
        u.seg = (u.seg + 1) % u.lane.points.length;
      } else {
        const dir = normalize(sub(b, u.pos));
        u.pos.x += dir.x * step;
        u.pos.y += dir.y * step;
        u.pos.z += dir.z * step;
        u.yaw = Math.atan2(dir.x, dir.z);
      }
    } else {
      u.timer -= dt;
      if (u.target) {
        const d = dist(u.pos, u.target);
        const step = PERCEPTION.investigateSpeed * dt;
        if (d <= step || u.timer <= 0) {
          u.mode = 'patrol';
          u.target = null;
        } else {
          const dir = normalize(sub(u.target, u.pos));
          u.pos.x += dir.x * step;
          u.pos.y += dir.y * step;
          u.pos.z += dir.z * step;
          u.yaw = Math.atan2(dir.x, dir.z);
        }
      }
    }
  }
}

export interface Sighting {
  id: number;
  distance: number;
}

/** Which units can see the player right now. */
export function sightings(units: Unit[], playerPos: Vec3, boxes: Aabb[]): Sighting[] {
  const out: Sighting[] = [];
  for (const u of units) {
    const d = dist(u.pos, playerPos);
    if (d > PERCEPTION.sight) continue;
    const to = normalize(sub(playerPos, u.pos));
    const facing = dirFromAngles(u.yaw, 0);
    if (dot(facing, to) < Math.cos(PERCEPTION.cone / 2)) continue;
    if (!lineOfSight(u.pos, playerPos, boxes)) continue;
    out.push({ id: u.id, distance: d });
  }
  return out;
}

export function hears(units: Unit[], playerPos: Vec3): number[] {
  const out: number[] = [];
  for (const u of units) {
    if (dist(u.pos, playerPos) <= PERCEPTION.hearing) out.push(u.id);
  }
  return out;
}

export function sendToInvestigate(units: Unit[], ids: number[], target: Vec3): void {
  for (const u of units) {
    if (!ids.includes(u.id)) continue;
    u.mode = 'investigate';
    u.timer = PERCEPTION.searchTime;
    u.target = { ...target };
  }
}
