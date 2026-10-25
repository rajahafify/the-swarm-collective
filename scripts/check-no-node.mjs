import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The sim must run in a browser, in a Worker later, and in Node for tests.
// No Node builtins, no process, no Buffer.
const ROOTS = ['game/sim', 'shared'];
const BANNED = [
  [/from ['"]node:/, 'node: import'],
  [/require\s*\(/, 'require()'],
  [/\bprocess\./, 'process'],
  [/\bBuffer\b/, 'Buffer'],
  [/\b__dirname\b/, '__dirname']
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js)$/.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    for (const [re, label] of BANNED) {
      if (re.test(src)) offenders.push(`${file}: ${label}`);
    }
  }
}

if (offenders.length > 0) {
  console.error('check-no-node: the sim must stay platform-free, but found:');
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
console.log('check-no-node: clean');
