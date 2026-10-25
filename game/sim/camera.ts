import type { LensTier, ShutterKey } from '../../shared/types';
import type { Rarity } from './wing';
import { clamp } from './math';

export const SHUTTERS: Record<ShutterKey, { blur: number; gain: number }> = {
  '1/500': { blur: 1, gain: 1 },
  '1/250': { blur: 2, gain: 2 },
  '1/125': { blur: 4, gain: 4 },
  '1/60': { blur: 8, gain: 8 }
};

export const LENSES: Record<LensTier, { range: number; fov: number; blur: number; light: number }> = {
  1: { range: 12, fov: 65, blur: 1, light: 1 },
  2: { range: 20, fov: 45, blur: 1.6, light: 0.75 },
  3: { range: 32, fov: 30, blur: 2.5, light: 0.55 }
};

export const RARITY_VALUE: Record<Rarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 60,
  event: 120
};

export const SCORE = {
  weights: { sharpness: 0.35, framing: 0.3, exposure: 0.2, distance: 0.15 },
  idealCoverage: 0.3,
  blurDivisor: 1.6,
  exposureTarget: 200,
  exposureStops: 2.5,
  occlusionLimit: 0.6,
  unusable: 20,
  rawBonus: 1.4
} as const;

export interface ShotInput {
  angularSpeed: number;
  linearSpeed: number;
  coverage: number;
  offCentre: number;
  lux: number;
  distance: number;
  lens: LensTier;
  shutter: ShutterKey;
  occlusion: number;
}

export interface ShotScore {
  score: number;
  sharpness: number;
  framing: number;
  exposure: number;
  distance: number;
  invalid: boolean;
}

export function scoreShot(input: ShotInput): ShotScore {
  const lens = LENSES[input.lens];
  const shutter = SHUTTERS[input.shutter];
  const blur = shutter.blur * lens.blur;

  const sharpness = clamp(1 - ((input.angularSpeed + 0.35 * input.linearSpeed) * blur) / SCORE.blurDivisor, 0, 1);
  const coverage = clamp(input.coverage / SCORE.idealCoverage, 0, 1);
  const off = clamp(input.offCentre, 0, Math.PI);
  const centring = clamp(1 - 0.5 * (off / 0.6) ** 2, 0, 1);
  const framing = Math.pow(coverage, 0.6) * centring;

  const effectiveLux = input.lux * shutter.gain * lens.light;
  const exposure = clamp(1 - Math.abs(Math.log2(effectiveLux / SCORE.exposureTarget)) / SCORE.exposureStops, 0, 1);

  const distance = clamp((lens.range - input.distance) / (lens.range - 2), 0, 1);

  const invalid = input.occlusion >= SCORE.occlusionLimit;
  const weighted =
    SCORE.weights.sharpness * sharpness +
    SCORE.weights.framing * framing +
    SCORE.weights.exposure * exposure +
    SCORE.weights.distance * distance;

  const score = invalid ? 0 : 100 * weighted * (1 - clamp(input.occlusion, 0, 1));
  return { score, sharpness, framing, exposure, distance, invalid };
}

export function photoValue(rarity: Rarity, score: number, novelty: number, raw: boolean): number {
  const base = RARITY_VALUE[rarity] * (score / 100) * novelty * (raw ? SCORE.rawBonus : 1);
  return Math.floor(base);
}

export function noveltyFor(count: number): number {
  if (count <= 0) return 1;
  if (count === 1) return 0.5;
  return 0.25;
}

export function lensFov(lens: LensTier, zoom: boolean, sprinting: boolean): number {
  const base = LENSES[lens].fov;
  const zoomed = zoom ? base * 0.55 : base;
  return (zoomed + (sprinting ? 6 : 0)) * (Math.PI / 180);
}
