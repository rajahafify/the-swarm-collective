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
  yaw: number;
  lift: number;
  sprint: boolean;
  gimbalYawDelta: number;
  gimbalPitchDelta: number;
  zoom: boolean;
  actions: Action[];
}

export function emptyCommand(): Command {
  return {
    forward: 0,
    yaw: 0,
    lift: 0,
    sprint: false,
    gimbalYawDelta: 0,
    gimbalPitchDelta: 0,
    zoom: false,
    actions: []
  };
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
