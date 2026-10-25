import type { Command, LensTier, ShutterKey, Vec3 } from '../../shared/types';
import {
  clamp,
  dist,
  dirFromAngles,
  dot,
  len,
  lerp,
  lineOfSight,
  normalize,
  sub,
  v3
} from './math';
import { buildWing, distanceToLane, type Rarity, type SubjectDef, type WingDef } from './wing';
import { createDrone, droneSpeed, stepDrone, stepLook, type DroneState } from './flight';
import { createUnits, hears, sendToInvestigate, sightings, stepUnits, type Unit } from './grader';
import { LENSES, SCORE, lensFov, noveltyFor, photoValue, scoreShot, type ShotScore } from './camera';
import type { AgentSample, Recorder } from '../recorder/recorder';

export type Phase = 'dock' | 'active' | 'lockdown' | 'escaped' | 'reset';

export interface Photo {
  subject: string;
  name: string;
  rarity: Rarity;
  score: number;
  value: number;
  raw: boolean;
  secured: boolean;
  slots: number;
}

export interface ShotResult {
  ok: boolean;
  reason: string;
  subject?: string;
  score: number;
  value: number;
  rarity?: Rarity;
  breakdown?: ShotScore;
}

type HoldKind = 'exit' | 'piece' | 'uplink';

interface HoldState {
  kind: HoldKind;
  id: string;
  label: string;
  t: number;
  need: number;
}

export const RAID = {
  memorySlots: 6,
  batterySeconds: 480,
  lockdownSeconds: 20,
  reach: 2.6,
  coverRadius: 2.6,
  tickHz: 60,
  recordHz: 10,
  offLaneDistance: 1.8,
  fastSpeed: 6.5
} as const;

const HOLD_TIME: Record<HoldKind, number> = { exit: 1.5, piece: 2, uplink: 1.5 };

export class Sim {
  readonly wing: WingDef;
  readonly drone: DroneState;
  readonly units: Unit[];

  phase: Phase = 'dock';
  suspicion = 0;
  battery: number = RAID.batterySeconds;
  raidTime = 0;
  tick = 0;
  now = 0;

  viewMode: 'chase' | 'gimbal' = 'chase';
  lens: LensTier = 1;
  shutter: ShutterKey = '1/250';
  light = false;
  zoom = false;
  sprinting = false;

  photos: Photo[] = [];
  pieces = new Set<'code' | 'power'>();
  cover = false;
  hold: HoldState | null = null;

  lockdownTimer = 0;
  dataEarned = 0;
  resetReason = '';

  lastShot: ShotResult | null = null;
  message = '';
  messageUntil = 0;
  prompt = '';
  suspicionSource = '';

  angularSpeed = 0;
  linearSpeed = 0;

  private seenBy = 0;
  private sinceRise = 0;
  private lastInvestigate = -99;
  private prevYaw = 0;
  private prevPitch = 0;
  private prevVel: Vec3 = v3();
  private readonly recorder: Recorder;
  private readonly seed: number;

  constructor(seed: number, recorder: Recorder) {
    this.seed = seed;
    this.recorder = recorder;
    this.wing = buildWing(seed);
    this.drone = createDrone(this.wing.dock);
    this.units = createUnits(this.wing);
    this.drone.yaw = Math.PI / 2;
    this.prevYaw = this.drone.yaw;
    this.prevPitch = this.drone.gimbalPitch;
    this.recorder.start({
      schema: 1,
      raidId: 'raid-' + seed.toString(16),
      seed,
      wing: this.wing.name,
      startedAt: 0,
      tickHz: RAID.tickHz,
      recordHz: RAID.recordHz,
      build: 'slice'
    });
  }

  get usedSlots(): number {
    return this.photos.reduce((n, p) => n + p.slots, 0);
  }

  get viewYaw(): number {
    return this.drone.yaw + this.drone.gimbalYaw;
  }

  get viewPitch(): number {
    return this.drone.gimbalPitch;
  }

  get fov(): number {
    return lensFov(this.lens, this.zoom, this.sprinting);
  }

  viewPos(): Vec3 {
    const d = dirFromAngles(this.viewYaw, this.viewPitch);
    return v3(
      this.drone.pos.x + d.x * 0.12,
      this.drone.pos.y + d.y * 0.12,
      this.drone.pos.z + d.z * 0.12
    );
  }

  launch(): void {
    if (this.phase !== 'dock') return;
    this.phase = 'active';
    this.say('Raid live. Blend in, take the shot, find a way out.');
    this.recorder.event({ k: this.tick, e: 'launch', id: 0, d: { seed: this.seed } });
  }

  step(dt: number, cmd: Command): void {
    this.tick += 1;
    this.now += dt;

    if (this.phase === 'dock') {
      if (cmd.actions.includes('launch')) this.launch();
      this.sample(dt, cmd);
      return;
    }
    if (this.phase === 'escaped' || this.phase === 'reset') {
      this.sample(dt, cmd);
      return;
    }

    this.raidTime += dt;
    this.handleActions(cmd);
    stepLook(this.drone, cmd);
    const result = stepDrone(this.drone, cmd, dt, this.wing.boxes);
    this.sprinting = result.sprinting;
    this.linearSpeed = droneSpeed(this.drone);
    this.zoom = cmd.zoom;

    if (result.collided) this.recorder.event({ k: this.tick, e: 'collision', id: 0, d: {} });

    this.updateCameraSpeed(dt);
    stepUnits(this.units, dt, this.drone.pos, this.wing.boxes);
    this.updateSuspicion(dt);
    this.updateBattery(dt);
    this.updateCover();
    this.updateHold(dt);
    this.updatePrompt();
    this.updateLockdown(dt);

    this.sample(dt, cmd);
  }

  private updateCameraSpeed(dt: number): void {
    const yaw = this.viewYaw;
    const pitch = this.viewPitch;
    let dy = yaw - this.prevYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const dp = pitch - this.prevPitch;
    const w = Math.hypot(dy, dp) / Math.max(dt, 1e-4);
    this.angularSpeed = lerp(this.angularSpeed, w, 0.35);
    this.prevYaw = yaw;
    this.prevPitch = pitch;
  }

  private updateSuspicion(dt: number): void {
    const seen = sightings(this.units, this.drone.pos, this.wing.boxes);
    this.seenBy = seen.length;
    const laneD = distanceToLane(this.wing, this.drone.pos, 'drone');
    const nearest = this.nearestUnitDistance();
    const parked = dist(this.drone.pos, this.wing.dock) < 4;

    let rise = 0;
    let source = '';
    if (seen.length > 0) {
      rise += 25;
      source = 'seen';
    }
    if (laneD > RAID.offLaneDistance && !parked) {
      rise += 6;
      if (!source) source = 'off lane';
    }
    if (this.linearSpeed > RAID.fastSpeed) {
      rise += 4;
      if (!source) source = 'too fast';
    }
    if (this.light && nearest < 10) {
      rise += 10;
      if (!source) source = 'light seen';
    }
    if (this.cover) {
      rise -= 8;
      source = 'working the task';
    }

    this.suspicionSource = rise > 0 ? source : '';

    if (rise > 0) {
      this.suspicion += rise * dt;
      this.sinceRise = 0;
    } else {
      this.sinceRise += dt;
      if (this.sinceRise > 3) this.suspicion -= 3 * dt;
    }
    this.suspicion = clamp(this.suspicion, 0, 100);

    if (seen.length > 0 && this.suspicion > 45 && this.raidTime - this.lastInvestigate > 4) {
      this.lastInvestigate = this.raidTime;
      sendToInvestigate(this.units, seen.map((s) => s.id), this.drone.pos);
      this.recorder.event({ k: this.tick, e: 'reported', id: seen[0]?.id ?? 0, d: {} });
      this.say('A unit reported you.');
    } else if (seen.length === 0 && this.linearSpeed > 7.5) {
      const ids = hears(this.units, this.drone.pos);
      if (ids.length > 0 && this.raidTime - this.lastInvestigate > 6) {
        this.lastInvestigate = this.raidTime;
        sendToInvestigate(this.units, ids, this.drone.pos);
      }
    }

    if (this.suspicion >= 100 && this.phase === 'active') {
      this.phase = 'lockdown';
      this.lockdownTimer = RAID.lockdownSeconds;
      sendToInvestigate(this.units, this.units.map((u) => u.id), this.drone.pos);
      this.recorder.event({ k: this.tick, e: 'kill_switch', id: 0, d: {} });
      this.say('Kill switch. Doors locked. Get out.');
    }
  }

  private updateLockdown(dt: number): void {
    if (this.phase !== 'lockdown') return;
    this.lockdownTimer -= dt;
    if (this.lockdownTimer <= 0) this.reset('the Grader reset you');
  }

  private updateBattery(dt: number): void {
    const draw = this.sprinting ? 2 : this.linearSpeed > 4 ? 1.2 : 1;
    this.battery = Math.max(0, this.battery - dt * draw);
    if (this.battery <= 0) this.reset('battery died');
  }

  private updateCover(): void {
    this.cover = dist(this.drone.pos, this.wing.station) < RAID.coverRadius;
  }

  private handleActions(cmd: Command): void {
    for (const action of cmd.actions) {
      if (action === 'shutter') this.shoot(cmd.sprint);
      if (action === 'light') {
        this.light = !this.light;
        this.recorder.event({ k: this.tick, e: 'light', id: 0, d: { on: this.light } });
      }
      if (action === 'lens') this.lens = (this.lens === 3 ? 1 : this.lens + 1) as LensTier;
      if (action === 'shutterSpeed') this.shutter = nextShutter(this.shutter);
      if (action === 'view') {
        this.viewMode = this.viewMode === 'chase' ? 'gimbal' : 'chase';
        this.say(this.viewMode === 'gimbal' ? 'Camera raised.' : 'Camera lowered.');
      }
      if (action === 'interact') this.beginHold();
      if (action === 'delete') this.deleteLast();
    }
  }

  private deleteLast(): void {
    const idx = [...this.photos].reverse().findIndex((p) => !p.secured);
    if (idx < 0) return;
    const at = this.photos.length - 1 - idx;
    const [removed] = this.photos.splice(at, 1);
    if (removed) this.say('Deleted ' + removed.name + '.');
  }

  private beginHold(): void {
    if (this.hold) return;
    const p = this.drone.pos;

    for (const exit of this.wing.exits) {
      if (dist(p, exit.pos) > RAID.reach) continue;
      if (exit.requires !== 'none' && !this.pieces.has(exit.requires)) {
        this.say(exit.name + ' needs the ' + exit.requires + '.');
        return;
      }
      this.hold = { kind: 'exit', id: exit.id, label: 'leaving through ' + exit.name, t: 0, need: HOLD_TIME.exit };
      return;
    }
    for (const piece of this.wing.pieces) {
      if (this.pieces.has(piece.id)) continue;
      if (dist(p, piece.pos) > RAID.reach) continue;
      this.hold = { kind: 'piece', id: piece.id, label: 'taking the ' + piece.label, t: 0, need: HOLD_TIME.piece };
      return;
    }
    for (const up of this.wing.uplinks) {
      if (dist(p, up) > RAID.reach) continue;
      if (this.photos.every((ph) => ph.secured)) {
        this.say('Nothing to uplink.');
        return;
      }
      this.hold = { kind: 'uplink', id: 'uplink-' + this.wing.uplinks.indexOf(up), label: 'uplinking', t: 0, need: HOLD_TIME.uplink };
      return;
    }
  }

  private updateHold(dt: number): void {
    const h = this.hold;
    if (!h) return;
    const target =
      h.kind === 'exit'
        ? this.wing.exits.find((e) => e.id === h.id)?.pos
        : h.kind === 'piece'
          ? this.wing.pieces.find((p) => p.id === h.id)?.pos
          : this.wing.uplinks[Number(h.id.split('-')[1] ?? 0)];
    if (!target || dist(this.drone.pos, target) > RAID.reach + 0.6) {
      this.hold = null;
      this.say('Interrupted.');
      return;
    }
    h.t += dt;
    if (h.t < h.need) return;
    this.hold = null;

    if (h.kind === 'exit') {
      this.escape();
    } else if (h.kind === 'piece') {
      const piece = this.wing.pieces.find((p) => p.id === h.id);
      if (piece) {
        this.pieces.add(piece.id);
        this.say('Got the ' + piece.label + '.');
        this.recorder.event({ k: this.tick, e: 'piece', id: 0, d: { piece: piece.id } });
      }
    } else {
      let count = 0;
      for (const photo of this.photos) {
        if (!photo.secured) {
          photo.secured = true;
          count += 1;
        }
      }
      this.suspicion = clamp(this.suspicion + 15, 0, 100);
      this.say(count + ' photo(s) sent home.');
      this.recorder.event({ k: this.tick, e: 'uplink', id: 0, d: { photos: count } });
    }
  }

  private updatePrompt(): void {
    const p = this.drone.pos;
    this.prompt = '';
    for (const exit of this.wing.exits) {
      if (dist(p, exit.pos) > RAID.reach) continue;
      const ready = exit.requires === 'none' || this.pieces.has(exit.requires);
      this.prompt = ready ? 'hold E to leave through the ' + exit.name : exit.name + ' needs the ' + exit.requires;
      return;
    }
    for (const piece of this.wing.pieces) {
      if (this.pieces.has(piece.id) || dist(p, piece.pos) > RAID.reach) continue;
      this.prompt = 'hold E to take the ' + piece.label;
      return;
    }
    for (const up of this.wing.uplinks) {
      if (dist(p, up) > RAID.reach) continue;
      this.prompt = 'hold E to uplink ' + this.photos.filter((ph) => !ph.secured).length + ' photo(s)';
      return;
    }
    if (this.cover) this.prompt = 'working the assigned task (cover)';
  }

  shoot(raw: boolean): ShotResult {
    if (this.phase !== 'active' && this.phase !== 'lockdown') {
      return { ok: false, reason: 'not in a raid', score: 0, value: 0 };
    }
    const pos = this.viewPos();
    const dir = dirFromAngles(this.viewYaw, this.viewPitch);
    const fov = this.fov;

    let best: { subject: SubjectDef; d: number; angle: number } | null = null;
    for (const subject of this.wing.subjects) {
      const to = sub(subject.pos, pos);
      const d = len(to);
      if (d > LENSES[this.lens].range * 1.2) continue;
      const angle = Math.acos(clamp(dot(normalize(to), dir), -1, 1));
      if (angle > (fov / 2) * 0.9) continue;
      if (!best || angle < best.angle) best = { subject, d, angle };
    }

    if (!best) {
      this.say('Nothing worth photographing in frame. Aim the gimbal, then shoot.');
      this.lastShot = { ok: false, reason: 'no subject in frame', score: 0, value: 0 };
      return this.lastShot;
    }

    const subject = best.subject;
    const frameHeight = 2 * best.d * Math.tan(fov / 2);
    const coverage = subject.size.y / Math.max(frameHeight, 0.001);
    const occlusion = this.occlusion(subject, pos);
    const lux = this.luxAt(subject.pos);

    const scored = scoreShot({
      angularSpeed: this.angularSpeed,
      linearSpeed: this.linearSpeed,
      coverage,
      offCentre: best.angle,
      lux,
      distance: best.d,
      lens: this.lens,
      shutter: this.shutter,
      occlusion
    });

    const already = this.photos.filter((p) => p.subject === subject.id).length;
    const novelty = noveltyFor(already);
    const value = scored.invalid ? 0 : photoValue(subject.rarity, scored.score, novelty, raw);
    const slots = raw ? 2 : 1;

    if (this.usedSlots + slots > RAID.memorySlots) {
      this.say('Memory full. Delete something or leave.');
      this.lastShot = { ok: false, reason: 'memory full', score: scored.score, value: 0, subject: subject.id, breakdown: scored };
      return this.lastShot;
    }

    const photo: Photo = {
      subject: subject.id,
      name: subject.name,
      rarity: subject.rarity,
      score: Math.round(scored.score),
      value,
      raw,
      secured: false,
      slots
    };
    this.photos.push(photo);
    this.lastShot = {
      ok: true,
      reason: scored.invalid ? 'occluded' : '',
      subject: subject.id,
      score: Math.round(scored.score),
      value,
      rarity: subject.rarity,
      breakdown: scored
    };

    this.recorder.event({
      k: this.tick,
      e: 'shot',
      id: 0,
      d: { subject: subject.id, score: photo.score, value, rarity: subject.rarity, raw }
    });
    if (scored.invalid) this.say('Occluded. Nothing usable.');
    else if (photo.score < SCORE.unusable) this.say('Unusable shot. It still takes a slot.');
    else this.say(photo.name + ' +' + value + ' data');
    return this.lastShot;
  }

  private occlusion(subject: SubjectDef, from: Vec3): number {
    const samples: Vec3[] = [subject.pos];
    const hx = subject.size.x * 0.3;
    const hy = subject.size.y * 0.3;
    samples.push(v3(subject.pos.x + hx, subject.pos.y + hy, subject.pos.z));
    samples.push(v3(subject.pos.x - hx, subject.pos.y + hy, subject.pos.z));
    samples.push(v3(subject.pos.x + hx, subject.pos.y - hy, subject.pos.z));
    samples.push(v3(subject.pos.x - hx, subject.pos.y - hy, subject.pos.z));
    let hidden = 0;
    for (const p of samples) if (!lineOfSight(from, p, this.wing.boxes)) hidden += 1;
    return hidden / samples.length;
  }

  private luxAt(p: Vec3): number {
    let lux = 8;
    for (const light of this.wing.lights) {
      const d = dist(light, p);
      if (d < 18) lux += 900 / (1 + d * d * 0.6);
    }
    if (this.light) {
      const d = dist(this.viewPos(), p);
      if (d < 9) lux += 500 / (1 + d * d * 0.4);
    }
    return lux;
  }

  nearestUnitDistance(): number {
    let best = Infinity;
    for (const u of this.units) {
      const d = dist(u.pos, this.drone.pos);
      if (d < best) best = d;
    }
    return best;
  }

  get seen(): number {
    return this.seenBy;
  }

  escape(): void {
    if (this.phase === 'escaped' || this.phase === 'reset') return;
    this.phase = 'escaped';
    this.dataEarned = this.photos.reduce((n, p) => n + p.value, 0);
    this.recorder.event({ k: this.tick, e: 'escaped', id: 0, d: { data: this.dataEarned } });
    this.recorder.finish('escaped');
    this.say('Out. ' + this.dataEarned + ' data recovered.');
  }

  reset(reason: string): void {
    if (this.phase === 'escaped' || this.phase === 'reset') return;
    this.phase = 'reset';
    this.resetReason = reason;
    this.dataEarned = this.photos.filter((p) => p.secured).reduce((n, p) => n + p.value, 0);
    this.recorder.event({ k: this.tick, e: 'reset', id: 0, d: { reason } });
    this.recorder.finish('reset');
    this.say('Reset. ' + reason + '.');
  }

  say(text: string): void {
    this.message = text;
    this.messageUntil = this.now + 3.4;
  }

  private sample(dt: number, cmd: Command): void {
    if (this.tick % Math.round(RAID.tickHz / RAID.recordHz) !== 0) return;
    const agents: AgentSample[] = [
      {
        id: 0,
        body: 'drone',
        controller: 'human',
        pos: this.drone.pos,
        vel: this.drone.vel,
        accel: {
          x: (this.drone.vel.x - this.prevVel.x) / Math.max(dt, 1e-4),
          y: (this.drone.vel.y - this.prevVel.y) / Math.max(dt, 1e-4),
          z: (this.drone.vel.z - this.prevVel.z) / Math.max(dt, 1e-4)
        },
        yaw: this.drone.yaw,
        pitch: this.drone.gimbalPitch,
        roll: this.drone.bank,
        battery: this.battery,
        suspicion: this.suspicion,
        lens: this.lens,
        shutter: SHUTTER_INDEX[this.shutter],
        light: this.light,
        zoom: this.zoom,
        command: cmd
      }
    ];
    for (const u of this.units) {
      agents.push({
        id: u.id,
        body: u.body,
        controller: 'ai',
        pos: u.pos,
        vel: v3(),
        accel: v3(),
        yaw: u.yaw,
        pitch: 0,
        roll: 0,
        battery: 100,
        suspicion: 0,
        lens: 0,
        shutter: 0,
        light: false,
        zoom: false,
        command: null
      });
    }
    this.prevVel = { ...this.drone.vel };
    this.recorder.frame(this.tick, agents, this.seenBy, this.nearestUnitDistance());
  }
}

const SHUTTER_INDEX: Record<ShutterKey, number> = { '1/500': 0, '1/250': 1, '1/125': 2, '1/60': 3 };
const SHUTTER_ORDER: ShutterKey[] = ['1/500', '1/250', '1/125', '1/60'];

function nextShutter(s: ShutterKey): ShutterKey {
  const i = SHUTTER_ORDER.indexOf(s);
  return SHUTTER_ORDER[(i + 1) % SHUTTER_ORDER.length] ?? '1/250';
}

