export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Body = 'drone' | 'ground';
export type ControllerKind = 'human' | 'ai';

export type LensTier = 1 | 2 | 3;
export type ShutterKey = '1/500' | '1/250' | '1/125' | '1/60';

export type Action =
  | 'shutter'
  | 'light'
  | 'lens'
  | 'shutterSpeed'
  | 'interact'
  | 'uplink'
  | 'delete'
  | 'view'
  | 'launch';

export interface Command {
  forward: number;
  /** Right is positive. */
  strafe: number;
  /** Stick yaw rate, -1..1. Left is positive (see input.ts). */
  yaw: number;
  lift: number;
  sprint: boolean;
  /** Mouse yaw in radians, applied straight to the airframe. */
  yawDelta: number;
  gimbalPitchDelta: number;
  zoom: boolean;
  actions: Action[];
}

export function emptyCommand(): Command {
  return {
    forward: 0,
    strafe: 0,
    yaw: 0,
    lift: 0,
    sprint: false,
    yawDelta: 0,
    gimbalPitchDelta: 0,
    zoom: false,
    actions: []
  };
}

/**
 * Fold a fresh input sample into the command waiting for the next sim step.
 * Held axes overwrite; edges and mouse deltas accumulate until a step uses them.
 */
export function mergeCommand(pending: Command, sample: Command): void {
  pending.forward = sample.forward;
  pending.strafe = sample.strafe;
  pending.yaw = sample.yaw;
  pending.lift = sample.lift;
  pending.sprint = sample.sprint;
  pending.zoom = sample.zoom;
  pending.yawDelta += sample.yawDelta;
  pending.gimbalPitchDelta += sample.gimbalPitchDelta;
  if (sample.actions.length > 0) pending.actions.push(...sample.actions);
}

/**
 * After a sim step: drop the one-shot parts, keep the held axes. A slow frame
 * runs several steps on one sample, and every one of them must still fly.
 */
export function consumeCommand(pending: Command): void {
  pending.actions = [];
  pending.yawDelta = 0;
  pending.gimbalPitchDelta = 0;
}

export interface RaidHeader {
  schema: 1;
  raidId: string;
  seed: number;
  wing: string;
  startedAt: number;
  tickHz: number;
  recordHz: number;
  build: string;
}

export interface EventRecord {
  k: number;
  e: string;
  id: number;
  d: Record<string, number | string | boolean>;
}
