import { consumeCommand, emptyCommand, mergeCommand, type Command } from '../shared/types';
import { Sim } from './sim/sim';
import { World } from './render/scene';
import { Ui } from './ui/core';
import { drawHud, drawResults, drawTitle } from './ui/hud';
import { Input } from './input/input';
import { NullRecorder } from './recorder/recorder';
import { LocalProfile } from './profile/local';
import { createTicker } from './sim/tick';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('the game page needs one canvas');

const world = new World(canvas);
const ui = new Ui();
const input = new Input(canvas);
const profile = new LocalProfile();

let saved = false;
const pending: Command = emptyCommand();

function newRaid(): Sim {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const sim = new Sim(seed, new NullRecorder());
  world.buildStatic(sim.wing);
  world.buildUnits(sim.units.length);
  saved = false;
  return sim;
}

let sim = newRaid();

const ticker = createTicker((dt) => {
  sim.step(dt, pending);
  consumeCommand(pending);
});

let last = performance.now();
let viewW = 0;
let viewH = 0;

function saveRun(): void {
  if (saved) return;
  saved = true;
  const next = profile.load();
  next.data += sim.dataEarned;
  next.runs += 1;
  if (sim.phase === 'escaped') next.escaped += 1;
  next.best = Math.max(next.best, sim.dataEarned);
  profile.save(next);
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== viewW || h !== viewH) {
    viewW = w;
    viewH = h;
    world.resize(w, h);
  }

  input.active = sim.phase === 'active' || sim.phase === 'lockdown';
  // A frame can run zero sim steps (144 Hz display) or several (slow frame).
  // mergeCommand and consumeCommand keep both cases from losing input.
  mergeCommand(pending, input.sample());
  ticker(dt);

  world.sync(sim, now / 1000, dt);
  world.render();

  ui.begin(w, h);
  ui.pointer.x = input.pointer.x;
  ui.pointer.y = input.pointer.y;
  ui.pointer.clicked = input.pointer.clicked;

  if (sim.phase === 'dock') {
    if (drawTitle(ui, w, h)) sim.launch();
  } else if (sim.phase === 'escaped' || sim.phase === 'reset') {
    saveRun();
    const result = drawResults(ui, sim, profile.load(), w, h);
    if (result.again) sim = newRaid();
    if (result.site) window.location.href = '/';
  } else {
    drawHud(ui, sim, w, h, input.mouseCaptured);
  }

  ui.end();

  world.renderer.autoClear = false;
  world.renderer.clearDepth();
  world.renderer.render(ui.scene, ui.camera);
  world.renderer.autoClear = true;

  input.pointer.clicked = false;

  if (sim.phase === 'escaped' || sim.phase === 'reset' || sim.phase === 'dock') {
    if (input.locked) input.release();
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
