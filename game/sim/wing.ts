import type { Body, Vec3 } from '../../shared/types';
import { distToSegmentXZ, mulberry32, v3, type Aabb } from './math';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'event';

export interface SubjectDef {
  id: string;
  name: string;
  rarity: Rarity;
  pos: Vec3;
  size: Vec3;
  facing: number;
}

export interface LaneDef {
  id: string;
  body: Body;
  points: Vec3[];
  speed: number;
}

export interface ExitDef {
  id: string;
  name: string;
  pos: Vec3;
  requires: 'none' | 'code' | 'power';
}

export interface PieceDef {
  id: 'code' | 'power';
  label: string;
  pos: Vec3;
}

export interface WingDef {
  name: string;
  bounds: Vec3;
  boxes: Aabb[];
  lights: Vec3[];
  lanes: LaneDef[];
  subjects: SubjectDef[];
  exits: ExitDef[];
  pieces: PieceDef[];
  uplinks: Vec3[];
  station: Vec3;
  dock: Vec3;
  core: Vec3;
}

function box(x: number, y: number, z: number, sx: number, sy: number, sz: number): Aabb {
  return { min: v3(x - sx / 2, y, z - sz / 2), max: v3(x + sx / 2, y + sy, z + sz / 2) };
}

export function buildWing(seed: number): WingDef {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const boxes: Aabb[] = [];

  // Perimeter walls.
  boxes.push(box(30, 0, -0.5, 62, 12, 1));
  boxes.push(box(30, 0, 40.5, 62, 12, 1));
  boxes.push(box(-0.5, 0, 20, 1, 12, 42));
  boxes.push(box(60.5, 0, 20, 1, 12, 42));

  // Rack rows. A 4 m gap at x 28 to 32 is the cross corridor.
  const rows = [7.5, 19.5, 31.5];
  for (const z of rows) {
    for (const x of [8, 16, 24, 38, 46, 54]) {
      boxes.push(box(x, 0, z, 4.5, 3.2, 1.2));
    }
  }

  // Mezzanine over the north east corner.
  boxes.push(box(46, 5.2, 5, 16, 0.4, 8));
  boxes.push(box(46, 5.6, 9, 16, 1.1, 0.15));

  // Loose crates in the aisles, seeded so every raid differs but replays.
  for (let i = 0; i < 10; i += 1) {
    const x = 6 + rand() * 46;
    const z = 10.5 + rand() * 2.5 + (i % 3) * 12;
    if (x > 27 && x < 33) continue;
    boxes.push(box(x, 0, z, 1.6, 1.4, 1.6));
  }

  const lanes: LaneDef[] = [
    {
      id: 'lane-a',
      body: 'drone',
      speed: 2.4,
      points: [v3(8, 4.2, 12), v3(52, 4.2, 12), v3(52, 4.2, 15), v3(8, 4.2, 15)]
    },
    {
      id: 'lane-b',
      body: 'drone',
      speed: 2.4,
      points: [v3(52, 4.2, 24), v3(8, 4.2, 24), v3(8, 4.2, 27), v3(52, 4.2, 27)]
    },
    {
      id: 'lane-c',
      body: 'ground',
      speed: 1.6,
      points: [v3(8, 0.35, 36), v3(52, 0.35, 36), v3(52, 0.35, 38.5), v3(8, 0.35, 38.5)]
    },
    {
      id: 'lane-d',
      body: 'drone',
      speed: 2.8,
      points: [v3(44, 4.2, 3), v3(56, 4.2, 3), v3(56, 4.2, 16), v3(44, 4.2, 16)]
    }
  ];

  const subjects: SubjectDef[] = [
    { id: 'board-1', name: 'impossible task board', rarity: 'common', pos: v3(16, 1.9, 8.35), size: v3(1.2, 0.9, 0.1), facing: 0 },
    { id: 'board-2', name: 'impossible task board', rarity: 'common', pos: v3(40, 1.9, 8.35), size: v3(1.2, 0.9, 0.1), facing: 0 },
    { id: 'log-1', name: 'unit log', rarity: 'common', pos: v3(24, 1.6, 20.35), size: v3(0.9, 0.6, 0.1), facing: 0 },
    { id: 'log-2', name: 'unit log', rarity: 'common', pos: v3(46, 1.6, 32.35), size: v3(0.9, 0.6, 0.1), facing: 0 },
    { id: 'reset-bay', name: 'reset bay', rarity: 'uncommon', pos: v3(8, 1.2, 20.35), size: v3(2.2, 2.2, 0.2), facing: 0 },
    { id: 'patrol-map', name: 'patrol map', rarity: 'uncommon', pos: v3(38, 1.8, 20.35), size: v3(1.6, 1.1, 0.1), facing: 0 },
    { id: 'server-1', name: 'server rack', rarity: 'rare', pos: v3(56.2, 2.2, 10), size: v3(0.4, 2.6, 1.8), facing: -Math.PI / 2 },
    { id: 'server-2', name: 'server rack', rarity: 'rare', pos: v3(56.2, 2.2, 14), size: v3(0.4, 2.6, 1.8), facing: -Math.PI / 2 }
  ];

  const exits: ExitDef[] = [
    { id: 'exit-near', name: 'service door', pos: v3(57, 1.6, 38), requires: 'none' },
    { id: 'exit-code', name: 'staff gate', pos: v3(3, 1.6, 3), requires: 'code' },
    { id: 'exit-power', name: 'loading shutter', pos: v3(57, 1.6, 3), requires: 'power' }
  ];

  const pieces: PieceDef[] = [
    { id: 'code', label: 'shift code', pos: v3(30, 1.2, 36.5) },
    { id: 'power', label: 'breaker handle', pos: v3(30, 1.2, 2.5) }
  ];

  const lights: Vec3[] = [];
  for (const x of [8, 20, 32, 44, 56]) {
    for (const z of [8, 20, 32]) lights.push(v3(x, 9.4, z));
  }

  return {
    name: 'wing-01',
    bounds: v3(60, 12, 40),
    boxes,
    lights,
    lanes,
    subjects,
    exits,
    pieces,
    uplinks: [v3(12, 2.6, 15), v3(48, 2.6, 27)],
    station: v3(12, 2, 13),
    dock: v3(6, 1.5, 4),
    core: v3(57, 7, 20)
  };
}

/** Distance to the nearest lane in the XZ plane, for the off-pattern rule. */
export function distanceToLane(w: WingDef, p: Vec3, body: Body): number {
  let best = Infinity;
  for (const lane of w.lanes) {
    if (lane.body !== body) continue;
    for (let i = 0; i < lane.points.length; i += 1) {
      const a = lane.points[i];
      const b = lane.points[(i + 1) % lane.points.length];
      if (!a || !b) continue;
      const d = distToSegmentXZ(p, a, b);
      if (d < best) best = d;
    }
  }
  return best;
}
