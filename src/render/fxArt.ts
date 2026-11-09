import { C } from './palette';
import { circle, ellipse, fillStroke, font, poly, roundRectPath, star, text, withAlpha, wrap } from './draw';
import { sprites } from './Sprites';
import type { Particles } from '../systems/Particles';
import type { FloatTexts } from '../systems/FloatText';
import { easeOutBack, easeOutElastic } from '../core/math';

/** Rendering of particles, floating texts and speech bubbles. */

export function drawParticles(ctx: CanvasRenderingContext2D, ps: Particles): void {
  for (const p of ps.list) {
    const k = p.life / p.max; // 1 -> 0
    const age = 1 - k;
    switch (p.kind) {
      case 'confetti': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 2.3));
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size2 / 2, p.size, p.size2);
        ctx.restore();
        break;
      }
      case 'smoke':
      case 'gas': {
        const r = p.size + (p.size2 - p.size) * age;
        ctx.globalAlpha = p.alpha * k * (p.kind === 'gas' ? 0.7 : 0.8);
        circle(ctx, p.x, p.y, r);
        ctx.fillStyle = p.color;
        ctx.fill();
        break;
      }
      case 'spark': {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
        break;
      }
      case 'fire': {
        const r = p.size + (p.size2 - p.size) * age;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        circle(ctx, p.x, p.y, r);
        ctx.fillStyle = age < 0.3 ? '#fff2a0' : p.color;
        ctx.fill();
        break;
      }
      case 'star':
        ctx.globalAlpha = Math.min(1, k * 2);
        star(ctx, p.x + Math.cos(p.life * 6) * 12, p.y + Math.sin(p.life * 6) * 4, p.size, p.size * 0.45, 5, p.life * 3);
        fillStroke(ctx, p.color, 1.5);
        break;
      case 'note':
        ctx.globalAlpha = k;
        ellipse(ctx, p.x, p.y, p.size * 0.45, p.size * 0.35, -0.4);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillRect(p.x + p.size * 0.35, p.y - p.size, 2, p.size);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      case 'heart':
      case 'like':
        ctx.globalAlpha = Math.min(1, k * 2);
        heart(ctx, p.x, p.y, p.size);
        fillStroke(ctx, p.color, 1.6);
        break;
      case 'ring': {
        const r = p.size + (p.size2 - p.size) * Math.sqrt(age);
        ctx.globalAlpha = k;
        ellipse(ctx, p.x, p.y, r, r * 0.75);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.sx * k);
        ctx.stroke();
        break;
      }
      case 'debris':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        break;
      case 'sprite':
      case 'duck':
        ctx.globalAlpha = Math.min(1, k * 3);
        sprites.draw(ctx, p.key, p.x, p.y, p.sx, Math.abs(p.sx), p.rot);
        break;
      case 'soul': {
        const a = Math.min(1, k * 2.5);
        ctx.globalAlpha = a * 0.95;
        const wob = Math.sin(p.life * 5) * 5;
        sprites.draw(ctx, 'soul', p.x + wob, p.y, p.sx, p.sx);
        if (p.text && age > 0.08) bubble(ctx, p.text, p.x + wob, p.y - 22 * p.sx, a, 15);
        break;
      }
      case 'flash': {
        const r = p.size + (p.size2 - p.size) * age;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, withAlpha(p.color.length === 7 ? p.color : '#ffffff', 0.9 * k));
        g.addColorStop(1, withAlpha(p.color.length === 7 ? p.color : '#ffffff', 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        circle(ctx, p.x, p.y, r);
        ctx.fill();
        break;
      }
      case 'bubble':
        ctx.globalAlpha = Math.min(1, k * 2);
        circle(ctx, p.x, p.y, p.size);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        circle(ctx, p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        break;
      case 'pixel':
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, p.size, p.size);
        break;
      case 'glitch': {
        ctx.globalAlpha = k;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = ['#ff00ff', '#00ffff', '#ffffff', '#ff3b3b'][i];
          ctx.fillRect(p.x - p.size + Math.random() * p.size, p.y - p.size + Math.random() * p.size * 2, p.size * (0.4 + Math.random()), 3 + Math.random() * 4);
        }
        break;
      }
      case 'drop':
        ctx.globalAlpha = Math.min(1, k * 2);
        circle(ctx, p.x, p.y, p.size);
        fillStroke(ctx, p.color, 1.5);
        break;
      case 'slime':
        ctx.globalAlpha = k;
        circle(ctx, p.x, p.y, p.size);
        fillStroke(ctx, p.color, 1.5);
        break;
    }
  }
  ctx.globalAlpha = 1;
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.3, x - s * 0.5, y - s * 1.0, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.0, x + s * 1.1, y - s * 0.3, x, y + s * 0.35);
  ctx.closePath();
}

export function drawFloatTexts(ctx: CanvasRenderingContext2D, ft: FloatTexts): void {
  for (const f of ft.list) {
    const age = f.max - f.life;
    const k = f.life / f.max;
    let scale = 1;
    if (f.kind === 'combo' || f.kind === 'big') scale = age < 0.5 ? easeOutElastic(age / 0.5) : 1;
    else scale = age < 0.14 ? easeOutBack(age / 0.14, 3) : 1;
    const alpha = Math.min(1, k * 3.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.scale(scale, scale);
    if (f.kind === 'combo') {
      text(ctx, f.text, 0, 0, { size: f.size, color: f.color, stroke: '#2a0a10', lw: f.size * 0.22 });
    } else if (f.kind === 'crit') {
      text(ctx, f.text, 0, 0, { size: f.size, color: f.color, stroke: '#3a0a00', lw: f.size * 0.2 });
    } else {
      text(ctx, f.text, 0, 0, { size: f.size, color: f.color, lw: Math.max(3, f.size * 0.2) });
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Comic speech bubble with a tail pointing down at (x, y). */
export function bubble(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, alpha = 1, size = 17, maxW = 200): void {
  const lines = wrap(ctx, str, maxW, size);
  ctx.font = font(size);
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += 18;
  const lh = size * 1.12;
  const h = lines.length * lh + 10;
  let bx = x - w / 2;
  bx = Math.max(6, Math.min(720 - 6 - w, bx));
  const by = y - h - 10;
  ctx.globalAlpha = alpha;
  roundRectPath(ctx, bx, by, w, h, 11);
  ctx.fillStyle = '#fffdf6';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // tail
  const tx = Math.max(bx + 12, Math.min(bx + w - 12, x));
  poly(ctx, [tx - 7, by + h - 1.5, tx + 7, by + h - 1.5, tx + (x > tx ? 4 : -4), by + h + 10]);
  ctx.fillStyle = '#fffdf6';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tx - 7, by + h);
  ctx.lineTo(tx + (x > tx ? 4 : -4), by + h + 10);
  ctx.lineTo(tx + 7, by + h);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 5 + lh / 2 + i * lh));
  ctx.globalAlpha = 1;
}
