import * as THREE from 'three';
import type { Sim } from '../sim/sim';
import type { WingDef } from '../sim/wing';
import { approach, clamp, dirFromAngles, rayBox, v3 } from '../sim/math';

export const PALETTE = {
  void: 0x0b0d10,
  rack: 0x1a1e24,
  sodium: 0xffb454,
  cyan: 0x6fe3ff,
  alarm: 0xff4d3d,
  paper: 0xe8edf2
};

const CHASE_BACK = 2.3;
const CHASE_UP = 1.15;
const CHASE_LOOK = 6.0;
const CHASE_LOOK_UP = 0.45;

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 220);

  private readonly statics = new THREE.Group();
  private readonly dynamic = new THREE.Group();
  private readonly craft = new THREE.Group();
  private readonly gimbalPod = new THREE.Group();
  private readonly rotors: { prop: THREE.Object3D; blur: THREE.Mesh; dir: number }[] = [];
  private readonly spot: THREE.SpotLight;
  private readonly playerLight: THREE.PointLight;
  private unitGroups: THREE.Group[] = [];
  private wing: WingDef | null = null;

  private readonly camPos = new THREE.Vector3();
  private camReady = false;
  private rotorSpeed = 18;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.scene.fog = new THREE.FogExp2(PALETTE.void, 0.021);
    this.scene.background = new THREE.Color(PALETTE.void);
    this.scene.add(this.statics, this.dynamic, this.craft);

    this.scene.add(new THREE.AmbientLight(0x2a3644, 1.05));
    this.scene.add(new THREE.HemisphereLight(0x1b2430, 0x0a0c0f, 0.85));

    this.spot = new THREE.SpotLight(0xdff3ff, 0, 26, 0.5, 0.6, 1.4);
    this.spot.visible = false;
    this.scene.add(this.spot, this.spot.target);

    this.playerLight = new THREE.PointLight(PALETTE.cyan, 8, 8, 2);
    this.scene.add(this.playerLight);

    this.buildCraft();
  }

  /** A small camera drone: frame, four arms, spinning props, a stabilised pod. */
  private buildCraft(): void {
    const dark = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.62, metalness: 0.25 });
    const darker = new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.8, metalness: 0.1 });
    const pale = new THREE.MeshStandardMaterial({ color: 0x2b333c, roughness: 0.5, metalness: 0.3 });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.085, 0.4), dark);
    this.craft.add(hull);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.3), pale);
    spine.position.y = 0.062;
    this.craft.add(spine);

    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ] as const) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.018, 0.3), darker);
      arm.position.set(x * 0.115, 0.03, z * 0.115);
      arm.rotation.y = Math.atan2(x, z);
      this.craft.add(arm);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 10), dark);
      pod.position.set(x * 0.2, 0.04, z * 0.2);
      this.craft.add(pod);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.105, 0.005, 6, 22),
        new THREE.MeshStandardMaterial({ color: 0x222a33, roughness: 0.7, metalness: 0.2 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x * 0.2, 0.075, z * 0.2);
      this.craft.add(ring);

      const prop = new THREE.Group();
      prop.position.set(x * 0.2, 0.078, z * 0.2);
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.004, 0.024),
        new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.55 })
      );
      prop.add(blade);
      const blade2 = blade.clone();
      blade2.rotation.y = Math.PI / 2;
      prop.add(blade2);
      this.craft.add(prop);

      const blur = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 20),
        new THREE.MeshBasicMaterial({
          color: 0x8fa0b0,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      blur.rotation.x = -Math.PI / 2;
      blur.position.set(x * 0.2, 0.08, z * 0.2);
      this.craft.add(blur);

      this.rotors.push({ prop, blur, dir: x * z > 0 ? 1 : -1 });
    }

    // Gimbal: a ball and a lens, counter-rotating against the airframe.
    this.gimbalPod.position.set(0, -0.045, 0.19);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), pale);
    this.gimbalPod.add(ball);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.05, 12), darker);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.045;
    this.gimbalPod.add(barrel);
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 12),
      new THREE.MeshBasicMaterial({ color: 0x0a2b33 })
    );
    glass.position.z = 0.071;
    this.gimbalPod.add(glass);
    this.craft.add(this.gimbalPod);

    // Orientation lights: cyan ahead, red behind. The fastest way to read heading.
    const cyan = new THREE.MeshBasicMaterial({ color: PALETTE.cyan });
    const red = new THREE.MeshBasicMaterial({ color: PALETTE.alarm });
    for (const x of [-0.09, 0.09]) {
      const front = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), cyan);
      front.position.set(x, 0.02, 0.205);
      this.craft.add(front);
      const rear = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), red);
      rear.position.set(x, 0.02, -0.205);
      this.craft.add(rear);
    }

    for (const x of [-0.075, 0.075]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.26), darker);
      skid.position.set(x, -0.072, 0);
      this.craft.add(skid);
    }
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildStatic(wing: WingDef): void {
    this.wing = wing;
    for (const child of [...this.statics.children]) {
      this.statics.remove(child);
      disposeTree(child);
    }

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(wing.bounds.x, wing.bounds.z),
      new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.95, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(wing.bounds.x / 2, 0, wing.bounds.z / 2);
    this.statics.add(floor);

    const rackGeo = new THREE.BoxGeometry(1, 1, 1);
    const rackMat = new THREE.MeshStandardMaterial({ color: PALETTE.rack, roughness: 0.88, metalness: 0.06 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x121519, roughness: 0.95, metalness: 0 });

    const racks = wing.boxes.filter((b) => b.max.y - b.min.y < 10);
    const walls = wing.boxes.filter((b) => b.max.y - b.min.y >= 10);
    const dummy = new THREE.Object3D();

    const addBoxes = (list: typeof wing.boxes, mat: THREE.Material): void => {
      if (list.length === 0) return;
      const mesh = new THREE.InstancedMesh(rackGeo, mat, list.length);
      list.forEach((b, i) => {
        dummy.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        dummy.scale.set(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.statics.add(mesh);
    };
    addBoxes(racks, rackMat);
    addBoxes(walls, wallMat);

    const stripMat = new THREE.MeshBasicMaterial({
      color: PALETTE.cyan,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    for (const lane of wing.lanes) {
      for (let i = 0; i < lane.points.length; i += 1) {
        const a = lane.points[i];
        const b = lane.points[(i + 1) % lane.points.length];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.1) continue;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, len), stripMat);
        strip.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
        strip.rotation.y = Math.atan2(dx, dz);
        this.statics.add(strip);
      }
    }

    const lampGeo = new THREE.BoxGeometry(1.1, 0.1, 0.3);
    const lampMat = new THREE.MeshBasicMaterial({ color: PALETTE.sodium });
    wing.lights.forEach((p, i) => {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(p.x, p.y, p.z);
      this.statics.add(lamp);

      if (i % 3 !== 2) {
        const light = new THREE.PointLight(PALETTE.sodium, 320, 42, 2);
        light.position.set(p.x, p.y - 0.4, p.z);
        this.statics.add(light);
      }
    });

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 3.2, 1.4),
      new THREE.MeshBasicMaterial({ color: PALETTE.alarm, transparent: true, opacity: 0.5 })
    );
    core.position.set(wing.core.x, wing.core.y, wing.core.z);
    this.statics.add(core);
    const coreLight = new THREE.PointLight(PALETTE.alarm, 90, 18, 2);
    coreLight.position.set(wing.core.x, wing.core.y, wing.core.z);
    this.statics.add(coreLight);

    for (const exit of wing.exits) {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 2.6, 0.16),
        new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.32 })
      );
      frame.position.set(exit.pos.x, 1.3, exit.pos.z);
      this.statics.add(frame);
    }

    for (const piece of wing.pieces) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.34, 0.34),
        new THREE.MeshBasicMaterial({ color: PALETTE.sodium })
      );
      cube.position.set(piece.pos.x, piece.pos.y, piece.pos.z);
      this.statics.add(cube);
    }

    for (const up of wing.uplinks) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.8 })
      );
      orb.position.set(up.x, up.y, up.z);
      this.statics.add(orb);
    }

    for (const subject of wing.subjects) {
      const face = new THREE.Mesh(
        new THREE.BoxGeometry(subject.size.x, subject.size.y, subject.size.z),
        new THREE.MeshStandardMaterial({
          color: PALETTE.paper,
          emissive: PALETTE.paper,
          emissiveIntensity: 0.18,
          roughness: 0.8
        })
      );
      face.position.set(subject.pos.x, subject.pos.y, subject.pos.z);
      this.statics.add(face);
    }
  }

  buildUnits(count: number): void {
    for (const g of this.unitGroups) {
      this.dynamic.remove(g);
      disposeTree(g);
    }
    this.unitGroups = [];

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.85, metalness: 0.1 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.alarm });

    for (let i = 0; i < count; i += 1) {
      const g = new THREE.Group();

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.72), bodyMat);
      g.add(body);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeMat);
      eye.position.set(0, 0.02, 0.38);
      g.add(eye);

      const reach = 7;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(Math.tan((70 * Math.PI) / 360) * reach, reach, 18, 1, true),
        new THREE.MeshBasicMaterial({
          color: PALETTE.cyan,
          transparent: true,
          opacity: 0.045,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, 0, reach / 2);
      g.add(cone);

      this.dynamic.add(g);
      this.unitGroups.push(g);
    }
  }

  sync(sim: Sim, time: number, dt: number): void {
    const drone = sim.drone;
    const speed = Math.hypot(drone.vel.x, drone.vel.y, drone.vel.z);

    // Airframe follows the flight state; the pod counter-rotates to stay level.
    this.craft.position.set(drone.pos.x, drone.pos.y, drone.pos.z);
    this.craft.rotation.set(drone.tilt, drone.yaw, -drone.bank);

    this.gimbalPod.rotation.set(-sim.viewPitch - drone.tilt, drone.gimbalYaw, drone.bank);
    this.gimbalPod.position.y = -0.045;

    const targetRotor = 20 + speed * 2.4 + (sim.sprinting ? 14 : 0);
    this.rotorSpeed = approach(this.rotorSpeed, targetRotor, 5, dt);
    const blurAmount = clamp((this.rotorSpeed - 28) / 70, 0, 0.22);
    for (const rotor of this.rotors) {
      rotor.prop.rotation.y += rotor.dir * this.rotorSpeed * dt;
      (rotor.blur.material as THREE.MeshBasicMaterial).opacity = blurAmount;
    }

    this.playerLight.position.set(drone.pos.x, drone.pos.y - 0.06, drone.pos.z);
    this.playerLight.intensity = 6 + speed * 0.4;

    if (sim.viewMode === 'chase') {
      this.craft.visible = true;
      this.updateChase(sim, dt);
    } else {
      this.craft.visible = false;
      this.updateGimbal(sim);
    }

    this.spot.visible = sim.light;
    if (sim.light) {
      const dir = dirFromAngles(sim.viewYaw, sim.viewPitch);
      const view = sim.viewPos();
      this.spot.position.set(view.x, view.y, view.z);
      this.spot.target.position.set(view.x + dir.x * 12, view.y + dir.y * 12, view.z + dir.z * 12);
      this.spot.intensity = 140;
    }

    sim.units.forEach((u, i) => {
      const g = this.unitGroups[i];
      if (!g) return;
      g.position.set(u.pos.x, u.pos.y + Math.sin(time * 2 + i) * 0.02, u.pos.z);
      g.rotation.y = u.yaw;
    });
  }

  private updateGimbal(sim: Sim): void {
    const view = sim.viewPos();
    const dir = dirFromAngles(sim.viewYaw, sim.viewPitch);
    this.camera.position.set(view.x, view.y, view.z);
    this.camera.lookAt(view.x + dir.x, view.y + dir.y, view.z + dir.z);
    this.setFov((sim.fov * 180) / Math.PI);
    this.camReady = false;
  }

  private updateChase(sim: Sim, dt: number): void {
    const drone = sim.drone;
    const fx = Math.sin(sim.viewYaw);
    const fz = Math.cos(sim.viewYaw);

    const desired = v3(drone.pos.x - fx * CHASE_BACK, drone.pos.y + CHASE_UP, drone.pos.z - fz * CHASE_BACK);

    // Pull the camera in if a rack is between it and the drone.
    let dist = Math.hypot(desired.x - drone.pos.x, desired.y - drone.pos.y, desired.z - drone.pos.z);
    const dir = {
      x: (desired.x - drone.pos.x) / dist,
      y: (desired.y - drone.pos.y) / dist,
      z: (desired.z - drone.pos.z) / dist
    };
    if (this.wing) {
      for (const box of this.wing.boxes) {
        const t = rayBox(drone.pos, dir, box);
        if (t > 0.15 && t < dist) dist = Math.max(0.7, t - 0.15);
      }
    }
    desired.x = drone.pos.x + dir.x * dist;
    desired.y = Math.max(0.3, drone.pos.y + dir.y * dist);
    desired.z = drone.pos.z + dir.z * dist;

    if (!this.camReady) {
      this.camPos.set(desired.x, desired.y, desired.z);
      this.camReady = true;
    } else {
      const k = 1 - Math.exp(-11 * dt);
      this.camPos.x += (desired.x - this.camPos.x) * k;
      this.camPos.y += (desired.y - this.camPos.y) * k;
      this.camPos.z += (desired.z - this.camPos.z) * k;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(
      drone.pos.x + fx * CHASE_LOOK,
      drone.pos.y + CHASE_LOOK_UP + Math.sin(sim.viewPitch) * 4,
      drone.pos.z + fz * CHASE_LOOK
    );
    this.camera.rotateZ(-drone.bank * 0.35);
    this.setFov(72 + (sim.sprinting ? 6 : 0));
  }

  private setFov(degrees: number): void {
    if (Math.abs(this.camera.fov - degrees) < 0.01) return;
    this.camera.fov = degrees;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
