import { clamp, damp } from './math';

/**
 * Trauma based screen shake + smooth zoom on a focus point.
 * Runs on REAL time so the shake keeps going during hit-stop freezes.
 */
export class Camera {
  trauma = 0;
  zoom = 1;
  targetZoom = 1;
  focusX = 360;
  focusY = 640;
  targetFocusX = 360;
  targetFocusY = 640;
  private t = 0;
  private ox = 0;
  private oy = 0;
  private rot = 0;
  /** 0..1 multiplier from settings (accessibility). */
  intensity = 1;

  shake(amount: number): void {
    this.trauma = clamp(this.trauma + amount * this.intensity, 0, 1);
  }

  zoomTo(z: number, fx: number, fy: number): void {
    this.targetZoom = z;
    this.targetFocusX = fx;
    this.targetFocusY = fy;
  }

  reset(W: number, H: number): void {
    this.targetZoom = 1;
    this.targetFocusX = W / 2;
    this.targetFocusY = H / 2;
  }

  snap(W: number, H: number): void {
    this.reset(W, H);
    this.zoom = 1;
    this.focusX = W / 2;
    this.focusY = H / 2;
    this.trauma = 0;
  }

  update(rdt: number): void {
    this.t += rdt;
    this.trauma = Math.max(0, this.trauma - rdt * 1.5);
    const s = this.trauma * this.trauma;
    const max = 26;
    // Layered sines give a cheap, smooth pseudo-noise.
    this.ox = max * s * (Math.sin(this.t * 51.3) * 0.6 + Math.sin(this.t * 87.1 + 1.7) * 0.4);
    this.oy = max * s * (Math.sin(this.t * 47.9 + 3.1) * 0.6 + Math.sin(this.t * 93.7 + 0.3) * 0.4);
    this.rot = 0.035 * s * Math.sin(this.t * 37.3 + 2.2);
    this.zoom = damp(this.zoom, this.targetZoom, 7, rdt);
    this.focusX = damp(this.focusX, this.targetFocusX, 7, rdt);
    this.focusY = damp(this.focusY, this.targetFocusY, 7, rdt);
  }

  /** Apply the camera transform for the world layer. */
  apply(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.translate(W / 2 + this.ox, H / 2 + this.oy);
    ctx.rotate(this.rot);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.focusX, -this.focusY);
  }

  /** Convert a screen point to world point (inverse of apply, ignoring shake). */
  toWorld(x: number, y: number, W: number, H: number): { x: number; y: number } {
    return {
      x: (x - W / 2) / this.zoom + this.focusX,
      y: (y - H / 2) / this.zoom + this.focusY,
    };
  }
}
