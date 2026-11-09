import { C } from '../render/palette';
import { fillStroke, roundRectPath, text, wobblyRectPath, withAlpha } from '../render/draw';
import { easeOutBack } from '../core/math';
import { icon } from '../render/icons';

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string = C.uiPanel, seed = 7): void {
  wobblyRectPath(ctx, x, y + 6, w, h, 22, seed, 1.5);
  fillStroke(ctx, 'rgba(0,0,0,0.45)', 0);
  wobblyRectPath(ctx, x, y, w, h, 22, seed, 1.5);
  fillStroke(ctx, color, 5);
  wobblyRectPath(ctx, x + 8, y + 8, w - 16, h - 16, 16, seed + 2, 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, back = '#24163a'): void {
  roundRectPath(ctx, x, y, w, h, h / 2);
  fillStroke(ctx, back, 4);
  if (frac > 0.001) {
    roundRectPath(ctx, x + 3, y + 3, Math.max(h - 6, (w - 6) * Math.min(1, frac)), h - 6, (h - 6) / 2);
    ctx.fillStyle = color;
    ctx.fill();
    roundRectPath(ctx, x + 6, y + 4, Math.max(0, (w - 12) * Math.min(1, frac)), (h - 6) * 0.35, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  }
}

export function dim(ctx: CanvasRenderingContext2D, W: number, H: number, a = 0.6): void {
  ctx.fillStyle = `rgba(8,3,14,${a})`;
  ctx.fillRect(0, 0, W, H);
}

/** Global toast queue (achievements, unlocks). */
interface Toast {
  title: string;
  sub: string;
  icon: string;
  t: number;
}

class Toasts {
  list: Toast[] = [];
  /** Scenes can move the toast (e.g. away from the HUD during a run). */
  anchor: (() => number) | null = null;
  push(title: string, sub: string, ic = 'trophy'): void {
    this.list.push({ title, sub, icon: ic, t: 0 });
  }
  update(rdt: number): void {
    if (!this.list.length) return;
    this.list[0].t += rdt;
    if (this.list[0].t > 3) this.list.shift();
  }
  draw(ctx: CanvasRenderingContext2D, W: number, top: number): void {
    const to = this.list[0];
    if (!to) return;
    const inT = Math.min(1, to.t / 0.4);
    const outT = Math.max(0, (to.t - 2.6) / 0.4);
    const base = this.anchor ? this.anchor() : top + 10;
    const y = base - 120 * (1 - easeOutBack(inT)) * (this.anchor ? -1 : 1) - 140 * outT * (this.anchor ? -1 : 1);
    const w = 520, h = 78, x = (W - w) / 2;
    ctx.globalAlpha = this.anchor ? Math.min(1, 1.6 - outT * 1.6) : 1;
    panel(ctx, x, y, w, h, '#3b1f55', 3);
    icon(ctx, to.icon, x + 44, y + h / 2, 38, to.t);
    text(ctx, to.title, x + w / 2 + 24, y + 26, { size: 22, color: C.goldHi, maxWidth: w - 110 });
    text(ctx, to.sub, x + w / 2 + 24, y + 54, { size: 18, color: C.white, maxWidth: w - 110 });
    ctx.globalAlpha = 1;
  }
}

export const toasts = new Toasts();

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.5): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, withAlpha(color, a));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
