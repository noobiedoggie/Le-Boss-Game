import { Camera } from './Camera';
import type { Pointer, Scene } from './Scene';
import { clamp } from './math';

/** Logical width of the game. Height adapts to the device aspect ratio. */
export const LOGICAL_W = 720;

/**
 * The Game owns the canvas, the main loop, the active scene and the global
 * time controls (hit-stop, slow-motion) plus the camera.
 */
export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  W = LOGICAL_W;
  H = 1280;
  /** Device pixels per logical unit. */
  scale = 1;
  safeTop = 0;
  safeBottom = 0;
  readonly camera = new Camera();

  scene: Scene | null = null;
  /** Drawn on top of every scene (toasts...). */
  overlay: ((ctx: CanvasRenderingContext2D, rdt: number) => void) | null = null;
  private nextScene: Scene | null = null;
  private fade = 0; // 0 = clear, 1 = black
  private fadeDir = 0;

  /** Simulation speed multiplier (slow-mo). */
  timeScale = 1;
  private slowTimer = 0;
  private slowTarget = 1;
  private hitStopTimer = 0;

  /** Real time since start, seconds. */
  time = 0;
  private last = 0;
  private pointers = new Map<number, Pointer>();
  private primary: number | null = null;
  fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  /** Recompute logical size + backing store resolution. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.scale = this.canvas.width / LOGICAL_W;
    this.W = LOGICAL_W;
    // Clamp to sane portrait ratios so layouts never break on odd devices.
    this.H = clamp(Math.round(this.canvas.height / this.scale), 1040, 1800);
    this.readSafeArea(cw);
    this.camera.snap(this.W, this.H);
    this.scene?.resize?.();
  }

  private readSafeArea(cssWidth: number): void {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const k = LOGICAL_W / cssWidth;
    this.safeTop = (parseFloat(cs.paddingTop) || 0) * k;
    this.safeBottom = (parseFloat(cs.paddingBottom) || 0) * k;
    probe.remove();
  }

  // ---------------------------------------------------------------- scenes
  setScene(scene: Scene, instant = false): void {
    if (instant || !this.scene) {
      this.scene?.exit?.();
      this.scene = scene;
      this.resetTime();
      this.camera.snap(this.W, this.H);
      scene.enter?.();
      if (!instant) {
        this.fade = 1;
        this.fadeDir = -1;
      }
      return;
    }
    this.nextScene = scene;
    this.fadeDir = 1;
  }

  private resetTime(): void {
    this.timeScale = 1;
    this.slowTimer = 0;
    this.slowTarget = 1;
    this.hitStopTimer = 0;
  }

  // ---------------------------------------------------------- time control
  /** Freeze the simulation for a few milliseconds (impact feel). */
  hitStop(ms: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
  }

  /** Slow motion for `duration` real seconds, then ease back to normal. */
  slowMo(scale: number, duration: number): void {
    this.slowTarget = scale;
    this.slowTimer = duration;
    this.timeScale = Math.min(this.timeScale, scale);
  }

  get isHitStopped(): boolean {
    return this.hitStopTimer > 0;
  }

  // ------------------------------------------------------------------ loop
  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      const rdt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      if (rdt > 0) this.fps = this.fps * 0.95 + (1 / rdt) * 0.05;
      this.tick(rdt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(rdt: number): void {
    this.time += rdt;
    // Scene transition fade.
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * rdt * 4.5;
      if (this.fadeDir > 0 && this.fade >= 1) {
        this.fade = 1;
        if (this.nextScene) {
          this.scene?.exit?.();
          this.scene = this.nextScene;
          this.nextScene = null;
          this.resetTime();
          this.camera.snap(this.W, this.H);
          this.scene.enter?.();
        }
        this.fadeDir = -1;
      } else if (this.fadeDir < 0 && this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }

    // Time scale management.
    if (this.slowTimer > 0) {
      this.slowTimer -= rdt;
      this.timeScale = this.slowTarget;
    } else if (this.timeScale < 1) {
      this.timeScale = Math.min(1, this.timeScale + rdt * 2.5);
    }
    let dt = rdt * this.timeScale;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rdt;
      dt = 0;
    }

    this.camera.update(rdt);
    const scene = this.scene;
    if (scene) {
      // Sub-step large frames for stable physics.
      if (dt > 1 / 40) {
        const steps = Math.ceil(dt / (1 / 60));
        for (let i = 0; i < steps; i++) scene.update(dt / steps, i === 0 ? rdt : 0);
      } else {
        scene.update(dt, rdt);
      }
    }

    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = '#120a1c';
    ctx.fillRect(0, 0, this.W, this.H);
    scene?.render(ctx);
    if (this.overlay) {
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.overlay(ctx, rdt);
    }
    if (this.fade > 0) {
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.globalAlpha = clamp(this.fade, 0, 1);
      ctx.fillStyle = '#07030c';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
  }

  // ----------------------------------------------------------------- input
  private toLogical(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const k = LOGICAL_W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Single-touch game: ignore extra fingers.
      if (this.primary !== null) return;
      const { x, y } = this.toLogical(e);
      const p: Pointer = { id: e.pointerId, x, y, startX: x, startY: y, downAt: performance.now() };
      this.primary = e.pointerId;
      this.pointers.set(e.pointerId, p);
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (this.fadeDir <= 0 || this.fade < 0.5) this.scene?.pointerDown?.(p);
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const { x, y } = this.toLogical(e);
      p.x = x;
      p.y = y;
      this.scene?.pointerMove?.(p);
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const { x, y } = this.toLogical(e);
      p.x = x;
      p.y = y;
      this.pointers.delete(e.pointerId);
      if (this.primary === e.pointerId) this.primary = null;
      this.scene?.pointerUp?.(p);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
