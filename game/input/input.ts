import { emptyCommand, type Action, type Command } from '../../shared/types';

const ACTIONS: Record<string, Action> = {
  KeyE: 'interact',
  KeyF: 'light',
  KeyQ: 'lens',
  KeyZ: 'shutterSpeed',
  KeyX: 'delete',
  KeyV: 'view',
  Enter: 'launch'
};

/**
 * Heading convention: forward is (sin yaw, cos yaw). With +Y up and the camera
 * looking down +Z at yaw 0, screen-right is -X. So a right turn *decreases*
 * yaw: mouse right and right stick right must both subtract.
 *
 * Layout is plain FPS: mouse turns the airframe and tilts the gimbal, W/S fly
 * forward and back, A/D strafe, Space up, C down. No Ctrl: Ctrl+W closes the tab.
 */
export class Input {
  pointer = { x: 0, y: 0, clicked: false };
  locked = false;
  active = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly down = new Set<string>();
  private actions: Action[] = [];
  private yawDelta = 0;
  private pitchDelta = 0;
  private zoomHeld = false;
  private lockUnavailable = false;
  private padPrev: boolean[] = [];
  private lastSample = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      const action = ACTIONS[e.code];
      if (action) this.actions.push(action);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));

    window.addEventListener('mousemove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      // Mouse right turns right, which is a yaw decrease under this convention.
      this.yawDelta -= e.movementX * 0.0026;
      this.pitchDelta -= e.movementY * 0.0024;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.zoomHeld = true;
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;

      if (!this.active) {
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.pointer.clicked = true;
        return;
      }
      if (!this.locked && !this.lockUnavailable) {
        this.requestLock();
        return;
      }
      this.actions.push('shutter');
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.zoomHeld = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => {
      this.down.clear();
      this.zoomHeld = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockUnavailable = true;
    });
  }

  requestLock(): void {
    if (this.locked) return;
    try {
      const request = this.canvas.requestPointerLock() as unknown;
      if (request && typeof (request as Promise<void>).catch === 'function') {
        (request as Promise<void>).catch(() => {
          this.lockUnavailable = true;
        });
      }
    } catch {
      this.lockUnavailable = true;
    }
  }

  release(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  get mouseCaptured(): boolean {
    return this.locked || this.lockUnavailable;
  }

  sample(): Command {
    const cmd = emptyCommand();
    const now = performance.now();
    const dt = this.lastSample > 0 ? Math.min(0.1, (now - this.lastSample) / 1000) : 0;
    this.lastSample = now;

    const fwd = (this.down.has('KeyW') ? 1 : 0) - (this.down.has('KeyS') ? 1 : 0);
    const strafe = (this.down.has('KeyD') ? 1 : 0) - (this.down.has('KeyA') ? 1 : 0);
    const lift = (this.down.has('Space') ? 1 : 0) - (this.down.has('KeyC') ? 1 : 0);

    cmd.forward = fwd;
    cmd.strafe = strafe;
    cmd.lift = lift;
    cmd.sprint = this.down.has('ShiftLeft') || this.down.has('ShiftRight');
    cmd.zoom = this.zoomHeld;
    cmd.yawDelta = this.yawDelta;
    cmd.gimbalPitchDelta = this.pitchDelta;

    // Standard pad: left stick moves and strafes, right stick X yaws, right
    // stick Y tilts the gimbal. D-pad up and down for altitude.
    const pad = navigator.getGamepads?.()[0] ?? null;
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      if (Math.abs(ax) > 0.15) cmd.strafe = ax;
      if (Math.abs(ay) > 0.15) cmd.forward = -ay;
      if (Math.abs(rx) > 0.15) cmd.yaw = -rx;
      if (Math.abs(ry) > 0.15) cmd.gimbalPitchDelta -= ry * 1.6 * dt;
      if (pad.buttons[12]?.pressed) cmd.lift = 1;
      if (pad.buttons[13]?.pressed) cmd.lift = -1;
      if ((pad.buttons[6]?.value ?? 0) > 0.4) cmd.sprint = true;
      if ((pad.buttons[5]?.value ?? 0) > 0.4) cmd.zoom = true;

      const edges: [number, Action][] = [
        [7, 'shutter'],
        [0, 'interact'],
        [2, 'light'],
        [3, 'lens'],
        [1, 'delete'],
        [11, 'view']
      ];
      for (const [index, action] of edges) {
        const pressed = pad.buttons[index]?.pressed ?? false;
        const was = this.padPrev[index] ?? false;
        if (pressed && !was) this.actions.push(action);
        this.padPrev[index] = pressed;
      }
    }

    cmd.actions = this.actions;
    this.actions = [];
    this.yawDelta = 0;
    this.pitchDelta = 0;
    return cmd;
  }
}
