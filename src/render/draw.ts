import { C } from './palette';
import { TAU } from '../core/math';

/**
 * Low-level vector drawing helpers. Everything in the game is drawn with
 * thick dark outlines + saturated fills ("dark cartoon").
 */

export const FONT = "'Lilita One', 'Arial Black', Impact, sans-serif";

export function font(size: number): string {
  return `${Math.round(size)}px ${FONT}`;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Hand-drawn looking rounded rect: corners are jittered with a stable seed so
 * the wobble does not flicker between frames.
 */
export function wobblyRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, seed = 1, amt = 2.2): void {
  const j = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * amt;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr + j(1), y + j(2));
  ctx.quadraticCurveTo(x + w / 2, y + j(3) * 0.8, x + w - rr + j(4), y + j(5));
  ctx.quadraticCurveTo(x + w + j(6) * 0.5, y + j(6) * 0.5, x + w + j(7), y + rr + j(8));
  ctx.quadraticCurveTo(x + w + j(9) * 0.8, y + h / 2, x + w + j(10), y + h - rr + j(11));
  ctx.quadraticCurveTo(x + w + j(12) * 0.5, y + h + j(12) * 0.5, x + w - rr + j(13), y + h + j(14));
  ctx.quadraticCurveTo(x + w / 2, y + h + j(15) * 0.8, x + rr + j(16), y + h + j(17));
  ctx.quadraticCurveTo(x + j(18) * 0.5, y + h + j(18) * 0.5, x + j(19), y + h - rr + j(20));
  ctx.quadraticCurveTo(x + j(21) * 0.8, y + h / 2, x + j(22), y + rr + j(23));
  ctx.quadraticCurveTo(x + j(24) * 0.5, y + j(24) * 0.5, x + rr + j(1), y + j(2));
  ctx.closePath();
}

export function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 4, stroke: string = C.ink): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, n = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function poly(ctx: CanvasRenderingContext2D, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export interface TextOpts {
  size?: number;
  color?: string;
  stroke?: string;
  lw?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  shadow?: boolean;
  maxWidth?: number;
}

/** Chunky outlined text (the signature UI look). */
export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 32;
  let fs = size;
  ctx.font = font(fs);
  if (o.maxWidth) {
    const w = ctx.measureText(str).width;
    if (w > o.maxWidth) {
      fs = Math.max(8, size * (o.maxWidth / w));
      ctx.font = font(fs);
    }
  }
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  const lw = o.lw ?? Math.max(3, fs * 0.18);
  if (o.shadow !== false && lw > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = lw;
    ctx.strokeText(str, x, y + fs * 0.09);
    ctx.fillText(str, x, y + fs * 0.09);
  }
  if (lw > 0) {
    ctx.strokeStyle = o.stroke ?? C.ink;
    ctx.lineWidth = lw;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color ?? C.white;
  ctx.fillText(str, x, y);
}

/** Word-wrap a string to lines fitting maxWidth at the given font size. */
export function wrap(ctx: CanvasRenderingContext2D, str: string, maxWidth: number, size: number): string[] {
  ctx.font = font(size);
  const words = str.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function textBlock(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, maxWidth: number, o: TextOpts = {}): number {
  const size = o.size ?? 24;
  const lines = wrap(ctx, str, maxWidth, size);
  const lh = size * 1.15;
  const start = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => text(ctx, l, x, start + i * lh, o));
  return lines.length * lh;
}

export function shade(hex: string, amt: number): string {
  // amt in [-1,1]: negative darkens, positive lightens.
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
