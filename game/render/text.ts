import * as THREE from 'three';

const DPR = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
const cache = new Map<string, { tex: THREE.CanvasTexture; w: number; h: number }>();

export interface TextTexture {
  tex: THREE.CanvasTexture;
  w: number;
  h: number;
}

/**
 * Glyphs are rasterised into an offscreen canvas once and cached. This is the
 * single DOM exemption in the game besides the boot-time canvas grab: it makes
 * textures, not HTML UI.
 */
export function textTexture(text: string, px: number, color: string, weight = 500): TextTexture {
  const key = text + '|' + px + '|' + color + '|' + weight;
  const hit = cache.get(key);
  if (hit) return hit;

  const font = weight + ' ' + Math.round(px * DPR) + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');
  if (!measure) throw new Error('no 2d context');
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width) + Math.ceil(6 * DPR);
  const h = Math.ceil(px * DPR * 1.5);

  canvas.width = Math.max(w, 2);
  canvas.height = Math.max(h, 2);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 3 * DPR, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const entry = { tex, w: canvas.width / DPR, h: canvas.height / DPR };
  cache.set(key, entry);
  return entry;
}
