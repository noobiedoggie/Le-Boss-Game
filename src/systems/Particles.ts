import { CONFETTI } from '../render/palette';
import { TAU } from '../core/math';
import { fx } from '../core/Rng';

/**
 * Pooled particle system in WORLD-SCREEN coordinates (logical px, before
 * camera). Pure data + update; drawing is in render/fxArt.ts.
 */
export type PKind =
  | 'confetti' | 'smoke' | 'spark' | 'fire' | 'gas' | 'slime' | 'star' | 'note' | 'heart'
  | 'ring' | 'debris' | 'sprite' | 'flash' | 'duck' | 'bubble' | 'pixel' | 'soul' | 'glitch' | 'drop' | 'like';

export interface Particle {
  kind: PKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number; size2: number;
  color: string;
  rot: number; vr: number;
  g: number; drag: number;
  /** ground line for bouncing (Infinity = none) */
  floor: number;
  bounce: number;
  key: string;
  alpha: number;
  sx: number;
  text: string;
}

const MAX = 900;

export class Particles {
  list: Particle[] = [];
  private pool: Particle[] = [];
  /** Global density multiplier (lower on weak devices). */
  density = 1;

  spawn(kind: PKind, x: number, y: number, o: Partial<Particle> = {}): Particle {
    let p = this.pool.pop();
    if (!p) p = {} as Particle;
    p.kind = kind;
    p.x = x; p.y = y;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0;
    p.max = o.max ?? o.life ?? 1;
    p.life = p.max;
    p.size = o.size ?? 6;
    p.size2 = o.size2 ?? p.size;
    p.color = o.color ?? '#fff';
    p.rot = o.rot ?? 0;
    p.vr = o.vr ?? 0;
    p.g = o.g ?? 0;
    p.drag = o.drag ?? 0;
    p.floor = o.floor ?? Infinity;
    p.bounce = o.bounce ?? 0.4;
    p.key = o.key ?? '';
    p.alpha = o.alpha ?? 1;
    p.sx = o.sx ?? 1;
    p.text = o.text ?? '';
    if (this.list.length >= MAX) {
      const old = this.list.shift()!;
      this.pool.push(old);
    }
    this.list.push(p);
    return p;
  }

  update(dt: number): void {
    const l = this.list;
    let w = 0;
    for (let i = 0; i < l.length; i++) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > p.floor) {
        p.y = p.floor;
        if (Math.abs(p.vy) > 40) {
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.7;
          p.vr *= 0.6;
        } else {
          p.vy = 0;
          p.vx *= 0.85;
          p.vr *= 0.8;
        }
      }
      if (p.kind === 'confetti') {
        // flutter
        p.vx += Math.sin(p.life * 9 + p.rot) * 40 * dt;
      }
      l[w++] = p;
    }
    l.length = w;
  }

  clear(): void {
    for (const p of this.list) this.pool.push(p);
    this.list.length = 0;
  }

  // ------------------------------------------------------------ presets
  confetti(x: number, y: number, n = 26, power = 1, floor = Infinity): void {
    n = Math.round(n * this.density);
    for (let i = 0; i < n; i++) {
      const a = fx.r(-Math.PI, 0) + fx.r(-0.3, 0.3);
      const s = fx.r(160, 420) * power;
      this.spawn('confetti', x, y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, g: 520, drag: 1.6,
        life: fx.r(0.9, 1.6), size: fx.r(5, 9), size2: fx.r(3, 5), color: fx.pick(CONFETTI),
        rot: fx.r(0, TAU), vr: fx.r(-14, 14), floor: floor + fx.r(-6, 10), bounce: 0.2,
      });
    }
  }

  smoke(x: number, y: number, n = 6, color = '#d8cce8', size = 18): void {
    n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n; i++) {
      this.spawn('smoke', x + fx.r(-10, 10), y + fx.r(-6, 6), {
        vx: fx.r(-40, 40), vy: fx.r(-70, -20), drag: 2.5, life: fx.r(0.5, 0.9),
        size: size * fx.r(0.6, 1), size2: size * fx.r(1.6, 2.4), color, alpha: 0.85,
      });
    }
  }

  sparks(x: number, y: number, n = 10, color = '#ffe14a', speed = 380): void {
    n = Math.round(n * this.density);
    for (let i = 0; i < n; i++) {
      const a = fx.r(0, TAU);
      const s = fx.r(0.4, 1) * speed;
      this.spawn('spark', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 5, life: fx.r(0.25, 0.5), size: fx.r(2, 4), color });
    }
  }

  fire(x: number, y: number, n = 8, spread = 14, size = 12): void {
    n = Math.round(n * this.density);
    for (let i = 0; i < n; i++) {
      this.spawn('fire', x + fx.r(-spread, spread), y + fx.r(-spread * 0.5, spread * 0.5), {
        vx: fx.r(-30, 30), vy: fx.r(-120, -40), drag: 2, life: fx.r(0.35, 0.7), size: size * fx.r(0.7, 1.3), size2: 2,
        color: fx.pick(['#ffe14a', '#ff8a1f', '#ff5a1a']),
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, life = 0.4, width = 8): void {
    this.spawn('ring', x, y, { size: r0, size2: r1, color, life, sx: width });
  }

  flash(x: number, y: number, r: number, color = '#fff', life = 0.15): void {
    this.spawn('flash', x, y, { size: r, size2: r * 1.4, color, life });
  }

  debris(x: number, y: number, n: number, color: string, floor: number): void {
    n = Math.round(n * this.density);
    for (let i = 0; i < n; i++) {
      const a = fx.r(-Math.PI, 0);
      const s = fx.r(120, 320);
      this.spawn('debris', x, y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, life: fx.r(0.6, 1.1), size: fx.r(4, 8), color,
        rot: fx.r(0, TAU), vr: fx.r(-10, 10), floor: floor + fx.r(-4, 8), bounce: 0.35,
      });
    }
  }
}
