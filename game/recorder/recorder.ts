import type { Command, EventRecord, RaidHeader, Vec3 } from '../../shared/types';

export interface AgentSample {
  id: number;
  body: 'drone' | 'ground';
  controller: 'human' | 'ai';
  pos: Vec3;
  vel: Vec3;
  accel: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  battery: number;
  suspicion: number;
  lens: number;
  shutter: number;
  light: boolean;
  zoom: boolean;
  command: Command | null;
}

/** The seam. Nothing is captured in the demo; the real recorder implements this. */
export interface Recorder {
  start(header: RaidHeader): void;
  frame(tick: number, agents: AgentSample[], othersInView: number, nearest: number): void;
  event(record: EventRecord): void;
  finish(outcome: string): void;
}

export class NullRecorder implements Recorder {
  start(_header: RaidHeader): void {}
  frame(_tick: number, _agents: AgentSample[], _othersInView: number, _nearest: number): void {}
  event(_record: EventRecord): void {}
  finish(_outcome: string): void {}
}
