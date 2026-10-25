import * as THREE from 'three';
import { textTexture } from '../render/text';

export interface Pointer {
  x: number;
  y: number;
  clicked: boolean;
}

interface Hit {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Immediate-mode canvas UI: everything is a mesh, nothing is DOM. */
export class Ui {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 100);
  pointer: Pointer = { x: 0, y: 0, clicked: false };

  private readonly texts: THREE.Mesh[] = [];
  private readonly rects: THREE.Mesh[] = [];
  private textIndex = 0;
  private rectIndex = 0;
  private order = 0;

  private readonly linePositions: number[] = [];
  private readonly lineColors: number[] = [];
  private readonly lineGeo = new THREE.BufferGeometry();
  private readonly lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  private readonly lines: THREE.LineSegments;

  private height = 1;
  private hits: Hit[] = [];
  private clickConsumed = false;

  constructor() {
    this.camera.position.z = 10;
    this.lines = new THREE.LineSegments(this.lineGeo, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  begin(w: number, h: number): void {
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
    this.height = h;
    this.textIndex = 0;
    this.rectIndex = 0;
    this.order = 0;
    this.hits = [];
    this.clickConsumed = false;
    this.linePositions.length = 0;
    this.lineColors.length = 0;
  }

  rect(x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
    let mesh = this.rects[this.rectIndex];
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthTest: false })
      );
      mesh.frustumCulled = false;
      this.rects.push(mesh);
      this.scene.add(mesh);
    }
    this.rectIndex += 1;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = alpha;
    mesh.position.set(x + w / 2, this.height - (y + h / 2), 0);
    mesh.scale.set(w, h, 1);
    mesh.renderOrder = this.order;
    this.order += 1;
    mesh.visible = true;
  }

  frame(x: number, y: number, w: number, h: number, color: number, alpha = 0.9, thickness = 1): void {
    this.rect(x, y, w, thickness, color, alpha);
    this.rect(x, y + h - thickness, w, thickness, color, alpha);
    this.rect(x, y, thickness, h, color, alpha);
    this.rect(x + w - thickness, y, thickness, h, color, alpha);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: number): void {
    const c = new THREE.Color(color);
    this.linePositions.push(x1, this.height - y1, 0, x2, this.height - y2, 0);
    this.lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }

  arc(cx: number, cy: number, r: number, from: number, to: number, segments: number, color: number): void {
    for (let i = 0; i < segments; i += 1) {
      const a0 = from + ((to - from) * i) / segments;
      const a1 = from + ((to - from) * (i + 1)) / segments;
      this.line(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, color);
    }
  }

  text(value: string, x: number, y: number, size: number, color: string, align: 'left' | 'center' | 'right' = 'left', weight = 500): void {
    if (value.length === 0) return;
    const { tex, w, h } = textTexture(value, size, color, weight);
    let mesh = this.texts[this.textIndex];
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthTest: false })
      );
      mesh.frustumCulled = false;
      this.texts.push(mesh);
      this.scene.add(mesh);
    }
    this.textIndex += 1;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
    mat.opacity = 1;
    const left = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
    mesh.position.set(left + w / 2, this.height - (y + h / 2), 0);
    mesh.scale.set(w, h, 1);
    mesh.renderOrder = this.order;
    this.order += 1;
    mesh.visible = true;
  }

  /** Returns true on the frame this button was clicked. Topmost wins. */
  button(id: string, label: string, x: number, y: number, w: number, h: number): boolean {
    const hovered =
      this.pointer.x >= x && this.pointer.x <= x + w && this.pointer.y >= y && this.pointer.y <= y + h;
    this.rect(x, y, w, h, 0x0b0d10, 0.85);
    this.frame(x, y, w, h, hovered ? 0x9beeff : 0x6fe3ff, 0.95, 1);
    this.text(label, x + w / 2, y + h / 2 - 7, 13, hovered ? '#9beeff' : '#e8edf2', 'center', 600);
    this.hits.push({ id, x, y, w, h });

    if (!hovered || !this.pointer.clicked || this.clickConsumed) return false;
    this.clickConsumed = true;
    return true;
  }

  get clickHandled(): boolean {
    return this.clickConsumed;
  }

  end(): void {
    for (let i = this.textIndex; i < this.texts.length; i += 1) {
      const m = this.texts[i];
      if (m) m.visible = false;
    }
    for (let i = this.rectIndex; i < this.rects.length; i += 1) {
      const m = this.rects[i];
      if (m) m.visible = false;
    }

    this.lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(this.linePositions, 3));
    this.lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(this.lineColors, 3));
    this.lineGeo.computeBoundingSphere();
    this.lines.visible = this.linePositions.length > 0;
  }
}
