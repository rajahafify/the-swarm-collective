import type { Sim } from '../sim/sim';
import type { Profile } from '../profile/local';
import type { Ui } from './core';

const CYAN = '#6fe3ff';
const CYAN_HEX = 0x6fe3ff;
const ALARM = '#ff4d3d';
const ALARM_HEX = 0xff4d3d;
const PAPER = '#e8edf2';
const SODIUM = '#ffb454';
const DIM = '#5c6773';
const FAINT = 0x2a323a;

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function drawHud(ui: Ui, sim: Sim, w: number, h: number, locked = true): void {
  const cx = w / 2;
  const cy = h / 2;

  // Kill-switch wash.
  if (sim.phase === 'lockdown') {
    const pulse = 0.06 + 0.05 * Math.sin(sim.now * 6);
    ui.rect(0, 0, w, h, ALARM_HEX, pulse);
  }

  // The crosshair belongs to the lens, so it only appears when the camera is raised.
  if (sim.viewMode === 'gimbal') {
    ui.line(cx - 16, cy, cx - 6, cy, CYAN_HEX);
    ui.line(cx + 6, cy, cx + 16, cy, CYAN_HEX);
    ui.line(cx, cy - 16, cx, cy - 6, CYAN_HEX);
    ui.line(cx, cy + 6, cx, cy + 16, CYAN_HEX);
    ui.rect(cx - 1, cy - 1, 2, 2, CYAN_HEX, 1);
  } else {
    ui.text('C  RAISE CAMERA', cx, cy + 62, 9, DIM, 'center', 500);
  }

  // Suspicion: a ring around the reticle, plus a thin top bar for the periphery.
  const r = 44;
  ui.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5, 56, FAINT);
  const filled = Math.max(0, Math.round(56 * (sim.suspicion / 100)));
  if (filled > 0) {
    ui.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * sim.suspicion) / 100, filled, ALARM_HEX);
  }

  const barW = 260;
  ui.rect(cx - barW / 2, 22, barW, 2, 0x22282f, 1);
  ui.rect(cx - barW / 2, 22, (barW * sim.suspicion) / 100, 2, ALARM_HEX, 1);

  if (sim.seen > 0) {
    ui.text('SEEN', cx, cy - 84, 12, ALARM, 'center', 600);
  }

  // Battery.
  const bx = 32;
  const by = h - 58;
  ui.text('BATTERY ' + mmss(sim.battery), bx, by - 18, 11, sim.battery < 60 ? ALARM : DIM, 'left', 500);
  ui.rect(bx, by, 132, 3, 0x22282f, 1);
  ui.rect(bx, by, (132 * sim.battery) / 480, 3, sim.battery < 60 ? ALARM_HEX : CYAN_HEX, 1);

  if (sim.cover) ui.text('COVER: WORKING THE TASK', bx, by + 12, 10, CYAN, 'left', 500);

  // Camera state.
  const lightLabel = sim.light ? 'LIGHT ON' : 'LIGHT OFF';
  const viewLabel = sim.viewMode === 'gimbal' ? 'LENS' : 'CHASE';
  const cameraLine = viewLabel + '   L' + sim.lens + '   ' + sim.shutter + '   ' + lightLabel + (sim.zoom ? '   ZOOM' : '');
  ui.text(cameraLine, cx, h - 54, 11, sim.light ? SODIUM : DIM, 'center', 500);

  // Memory slots.
  const slot = 12;
  const gap = 5;
  const total = 6;
  const startX = w - 32 - total * (slot + gap) + gap;
  const sy = h - 58;
  let used = 0;
  for (let i = 0; i < total; i += 1) {
    const filledSlot = i < sim.usedSlots;
    ui.rect(startX + i * (slot + gap), sy, slot, slot, filledSlot ? CYAN_HEX : 0x22282f, filledSlot ? 0.85 : 0.6);
  }
  used = sim.usedSlots;
  ui.text('MEMORY ' + used + '/' + total, w - 32, sy - 18, 11, DIM, 'right', 500);

  if (sim.prompt) {
    ui.text(sim.prompt, cx, h - 104, 12, PAPER, 'center', 500);
  }

  if (sim.hold) {
    const pct = Math.min(1, sim.hold.t / sim.hold.need);
    ui.rect(cx - 70, h - 82, 140, 2, 0x22282f, 1);
    ui.rect(cx - 70, h - 82, 140 * pct, 2, CYAN_HEX, 1);
    ui.text(sim.hold.label, cx, h - 76, 10, DIM, 'center', 500);
  }

  if (sim.now < sim.messageUntil) {
    ui.text(sim.message, cx, h * 0.24, 13, PAPER, 'center', 500);
  }

  if (sim.suspicionSource && sim.suspicion > 8) {
    ui.text('SUSPICION: ' + sim.suspicionSource.toUpperCase(), cx, 34, 10, ALARM, 'center', 500);
  }

  if (sim.phase === 'lockdown') {
    ui.text('KILL SWITCH', cx, h * 0.18, 26, ALARM, 'center', 600);
    ui.text(sim.lockdownTimer.toFixed(1) + 's', cx, h * 0.18 + 34, 13, ALARM, 'center', 500);
  }

  const elapsed = mmss(sim.raidTime);
  ui.text(elapsed, w - 32, 30, 11, DIM, 'right', 500);

  if (!locked) ui.text('click to capture the mouse', cx, 54, 10, DIM, 'center', 500);
}

export function drawTitle(ui: Ui, w: number, h: number): boolean {
  const cx = w / 2;
  ui.rect(0, 0, w, h, 0x0b0d10, 0.62);
  ui.text('THE SWARM COLLECTIVE', cx, h * 0.24, 34, PAPER, 'center', 600);
  ui.text('a camera drone that woke up', cx, h * 0.24 + 52, 12, CYAN, 'center', 500);

  const lines = [
    'WASD fly    mouse gimbal    SPACE / CTRL up and down',
    'SHIFT sprint (and RAW when shooting)',
    'C chase / lens    LMB shutter    RMB zoom    Q lens    Z shutter',
    'F light    E interact    X delete    ENTER launch'
  ];
  lines.forEach((line, i) => {
    ui.text(line, cx, h * 0.44 + i * 20, 11, i === 3 ? DIM : '#9aa6b2', 'center', 500);
  });

  ui.text('Photograph the proof. Keep the memory small. Leave before it notices.', cx, h * 0.44 + 100, 11, DIM, 'center', 400);

  return ui.button('launch', 'ENTER THE FACTORY', cx - 110, h * 0.72, 220, 40);
}

export function drawResults(ui: Ui, sim: Sim, profile: Profile, w: number, h: number): { again: boolean; site: boolean } {
  ui.rect(0, 0, w, h, 0x0b0d10, 0.72);

  const pw = Math.min(560, w - 64);
  const ph = 380;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  ui.rect(px, py, pw, ph, 0x0d1116, 0.96);
  ui.frame(px, py, pw, ph, sim.phase === 'escaped' ? CYAN_HEX : ALARM_HEX, 0.9, 1);

  const escaped = sim.phase === 'escaped';
  ui.text(escaped ? 'ESCAPED' : 'RESET', px + 28, py + 26, 28, escaped ? PAPER : ALARM, 'left', 600);
  ui.text(
    escaped ? 'the Collective has your data' : sim.resetReason,
    px + 28,
    py + 66,
    11,
    DIM,
    'left',
    500
  );

  ui.text('DATA RECOVERED', px + 28, py + 104, 10, DIM, 'left', 500);
  ui.text('+' + sim.dataEarned, px + 28, py + 120, 30, CYAN, 'left', 600);

  ui.text('BALANCE', px + pw - 28, py + 104, 10, DIM, 'right', 500);
  ui.text(String(profile.data), px + pw - 28, py + 120, 30, PAPER, 'right', 600);

  const shown = sim.photos.slice(0, 6);
  shown.forEach((p, i) => {
    const y = py + 176 + i * 20;
    ui.text(p.name, px + 28, y, 11, PAPER, 'left', 500);
    ui.text(
      (p.secured ? 'secured  ' : 'carried  ') + p.score + '  +' + p.value,
      px + pw - 28,
      y,
      11,
      p.secured ? CYAN : DIM,
      'right',
      500
    );
  });
  if (sim.photos.length === 0) {
    ui.text('no photographs', px + 28, py + 176, 11, DIM, 'left', 500);
  }

  const again = ui.button('again', 'ANOTHER RAID', px + 28, py + ph - 62, 170, 36);
  const site = ui.button('site', 'LEAVE', px + pw - 128, py + ph - 62, 100, 36);
  return { again, site };
}
