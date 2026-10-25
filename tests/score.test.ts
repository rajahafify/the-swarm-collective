import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENSES, SHUTTERS, noveltyFor, photoValue, scoreShot } from '../game/sim/camera';

const base = {
  angularSpeed: 0,
  linearSpeed: 0,
  coverage: 0.3,
  offCentre: 0,
  lux: 200,
  distance: 4,
  lens: 1 as const,
  shutter: '1/500' as const,
  occlusion: 0
};

test('a steady, centred, lit shot scores near 100', () => {
  const s = scoreShot(base);
  assert.ok(s.score > 90, 'score ' + s.score);
  assert.equal(s.invalid, false);
});

test('an occluded shot is void at the 0.6 limit', () => {
  const s = scoreShot({ ...base, occlusion: 0.6 });
  assert.equal(s.invalid, true);
  assert.equal(s.score, 0);
});

test('panning on a slow shutter kills sharpness', () => {
  const steady = scoreShot({ ...base, shutter: '1/60' });
  const panning = scoreShot({ ...base, shutter: '1/60', angularSpeed: 0.9 });
  assert.ok(steady.sharpness > 0.9);
  assert.ok(panning.sharpness < 0.2);
});

test('distance credit runs out past the lens range', () => {
  const near = scoreShot({ ...base, distance: 6 });
  const far = scoreShot({ ...base, distance: 14 });
  assert.ok(near.distance > 0.5);
  assert.equal(far.distance, 0);
});

test('the same shot in the dark is unusable', () => {
  const lit = scoreShot(base);
  const dark = scoreShot({ ...base, lux: 8 });
  assert.equal(dark.exposure, 0);
  assert.ok(dark.score < lit.score);
});

test('loot pays rarity x score, and RAW pays more', () => {
  assert.equal(photoValue('rare', 100, 1, false), 60);
  assert.equal(photoValue('rare', 100, 1, true), 84);
  assert.equal(photoValue('common', 50, 1, false), 5);
});

test('repeats pay half, then a quarter', () => {
  assert.equal(noveltyFor(0), 1);
  assert.equal(noveltyFor(1), 0.5);
  assert.equal(noveltyFor(4), 0.25);
});

test('the lens trade holds', () => {
  assert.ok(LENSES[3].range > LENSES[1].range);
  assert.ok(LENSES[3].blur > LENSES[1].blur);
  assert.ok(LENSES[3].light < LENSES[1].light);
  assert.ok(SHUTTERS['1/60'].gain > SHUTTERS['1/500'].gain);
});
