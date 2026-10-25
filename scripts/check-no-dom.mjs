import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The game page is a canvas and nothing else. This gate fails the build on
// HTML UI construction inside game/, with two exemptions: main.ts grabbing the
// canvas at boot, and render/text.ts drawing glyphs into an offscreen canvas.
const EXEMPT = new Set(['game/main.ts', 'game/render/text.ts']);

const BANNED = [
  [/\binnerHTML\b/, 'innerHTML'],
  [/\bouterHTML\b/, 'outerHTML'],
  [/\bquerySelector(All)?\b/, 'querySelector'],
  [/\bcreateElement\b/, 'createElement'],
  [/\bappendChild\b/, 'appendChild'],
  [/\bgetComputedStyle\b/, 'getComputedStyle'],
  [/\bclassList\b/, 'classList'],
  [/\bdocument\.body\b/, 'document.body'],
  [/from ['"]react['"]|from ['"]vue['"]|from ['"]svelte['"]|from ['"]preact['"]/, 'UI framework import'],
  [/\bcssText\b/, 'cssText']
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const offenders = [];
for (const file of walk('game')) {
  if (EXEMPT.has(file)) continue;
  const src = readFileSync(file, 'utf8');
  for (const [re, label] of BANNED) {
    const m = src.match(re);
    if (m) offenders.push(`${file}: ${label}`);
  }
}

if (offenders.length > 0) {
  console.error('check-no-dom: the game is canvas-only, but found DOM/HTML UI use:');
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
console.log('check-no-dom: clean');
