import { C } from '../palette';
import { circle, ellipse, fillStroke, poly, roundRectPath, star, text, withAlpha } from '../draw';
import type { TrapId } from '../../data/types';
import type { Trap } from '../../game/Trap';
import { t as tr } from '../../i18n';

/**
 * Trap art, drawn centred on (0,0) = tile centre, in "floor space":
 * the caller applies the board perspective scale. Tile ~ 92 x 70 px.
 */

const FLAT = 0.72;

export function drawTrapFloor(ctx: CanvasRenderingContext2D, kind: TrapId, level: number, anim: number, t: number, extra: { aim?: number; chew?: number; active?: boolean } = {}): void {
  switch (kind) {
    case 'spikes': {
      roundRectPath(ctx, -34, -34 * FLAT, 68, 68 * FLAT, 10);
      fillStroke(ctx, '#5b5370', 3.5);
      const up = anim < 0.28 ? 1 - anim / 0.28 : 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = -20 + i * 20, y = (-20 + j * 20) * FLAT;
        if (up > 0.05) {
          const h = 22 * up + 4;
          poly(ctx, [x - 6, y + 3, x + 6, y + 3, x, y + 3 - h]);
          fillStroke(ctx, level >= 3 ? C.goldHi : C.steel, 2);
        } else {
          ellipse(ctx, x, y, 4, 3);
          ctx.fillStyle = '#231a30';
          ctx.fill();
        }
      }
      break;
    }
    case 'slime': {
      const w = Math.sin(t * 3) * 2;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 36 + Math.sin(a * 3 + t * 2) * 4 + w;
        const x = Math.cos(a) * r, y = Math.sin(a) * r * FLAT;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      fillStroke(ctx, level >= 3 ? '#3fd16b' : C.slime, 3.5, '#14401c');
      ellipse(ctx, -10, -8, 12, 5, -0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i * 0.37) % 1;
        circle(ctx, -14 + i * 14, 6 - ph * 6, 3 + ph * 3);
        ctx.strokeStyle = withAlpha('#c9ffcf', 1 - ph);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'firejet': {
      roundRectPath(ctx, -28, -28 * FLAT, 56, 56 * FLAT, 12);
      fillStroke(ctx, '#4b3b52', 3.5);
      const glow = anim < 0.5 ? 1 - anim / 0.5 : 0.25 + Math.sin(t * 4) * 0.1;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
      g.addColorStop(0, withAlpha('#ffe14a', glow));
      g.addColorStop(1, withAlpha('#ff5a1a', 0));
      ctx.fillStyle = g;
      ellipse(ctx, 0, 0, 30, 22);
      ctx.fill();
      // nozzle pointing to aim
      const a = extra.aim ?? Math.PI / 2;
      ctx.save();
      ctx.scale(1, FLAT);
      ctx.rotate(a);
      roundRectPath(ctx, 0, -8, 26, 16, 5);
      fillStroke(ctx, level >= 3 ? C.gold : '#8d7a96', 3);
      ctx.fillStyle = '#ff8a1f';
      ctx.fillRect(22, -5, 4, 10);
      ctx.restore();
      circle(ctx, 0, 0, 9);
      fillStroke(ctx, '#2b1d33', 2.5);
      break;
    }
    case 'bounce': {
      const comp = anim < 0.3 ? Math.sin((anim / 0.3) * Math.PI) : 0;
      ellipse(ctx, 0, 4, 30, 30 * FLAT);
      fillStroke(ctx, '#3b3150', 3);
      // spring coil
      ctx.strokeStyle = C.steel;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ellipse(ctx, 0, 2 - i * (5 - comp * 3), 18, 7);
        ctx.stroke();
      }
      const top = -14 + comp * 10 - (anim < 0.15 ? 8 : 0);
      ellipse(ctx, 0, top, 30, 30 * FLAT * 0.8);
      fillStroke(ctx, level >= 3 ? C.gold : '#ff4d6d', 3.5);
      ellipse(ctx, 0, top, 16, 16 * FLAT * 0.8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ellipse(ctx, 0, top, 7, 7 * FLAT * 0.8);
      ctx.fillStyle = level >= 3 ? C.gold : '#ff4d6d';
      ctx.fill();
      break;
    }
    case 'trapdoor': {
      const open = anim < 0.7 ? Math.min(1, (0.7 - anim) / 0.2) : 0;
      roundRectPath(ctx, -32, -32 * FLAT, 64, 64 * FLAT, 6);
      fillStroke(ctx, '#05030a', 3.5);
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 32, 0);
        ctx.scale(1 - open * 0.85, 1);
        roundRectPath(ctx, s < 0 ? 0 : -31, -30 * FLAT, 31, 60 * FLAT, 4);
        fillStroke(ctx, level >= 3 ? '#b07a2c' : C.wood, 3);
        ctx.strokeStyle = C.woodDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s < 0 ? 4 : -27, -8);
        ctx.lineTo(s < 0 ? 27 : -4, -8);
        ctx.moveTo(s < 0 ? 4 : -27, 8);
        ctx.lineTo(s < 0 ? 27 : -4, 8);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'gas': {
      roundRectPath(ctx, -28, -28 * FLAT, 56, 56 * FLAT, 10);
      fillStroke(ctx, '#3d4a3a', 3.5);
      ctx.strokeStyle = '#1b2619';
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 9, -14);
        ctx.lineTo(i * 9, 14);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      g.addColorStop(0, withAlpha('#9cff4f', 0.5 + Math.sin(t * 3) * 0.2));
      g.addColorStop(1, withAlpha('#9cff4f', 0));
      ctx.fillStyle = g;
      ellipse(ctx, 0, 0, 28, 20);
      ctx.fill();
      break;
    }
    case 'axe': {
      // floor groove under the pendulum
      roundRectPath(ctx, -40, -8, 80, 16, 8);
      fillStroke(ctx, '#2a1d3a', 3);
      break;
    }
    case 'mimic':
      // shadow only; chest drawn in the sorted pass
      ellipse(ctx, 0, 6, 30, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      break;
  }
}

/** Tall trap parts drawn in the y-sorted pass (axe pendulum, mimic chest). */
export function drawTrapTall(ctx: CanvasRenderingContext2D, trap: Trap, t: number): void {
  if (trap.kind === 'axe') {
    // frame
    for (const s of [-1, 1]) {
      roundRectPath(ctx, s * 40 - 5, -96, 10, 98, 4);
      fillStroke(ctx, C.woodDark, 3);
    }
    roundRectPath(ctx, -46, -104, 92, 12, 5);
    fillStroke(ctx, C.wood, 3);
    // swing
    const swing = trap.anim < 0.55 ? Math.sin((trap.anim / 0.55) * Math.PI) : 0;
    const ang = trap.swingDir * (swing * 1.25) + Math.sin(t * 1.5) * 0.06 * (1 - swing);
    ctx.save();
    ctx.translate(0, -98);
    ctx.rotate(ang);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 74);
    ctx.stroke();
    ctx.strokeStyle = '#7d6a55';
    ctx.lineWidth = 3;
    ctx.stroke();
    // double blade
    ctx.beginPath();
    ctx.moveTo(0, 62);
    ctx.quadraticCurveTo(-34, 56, -30, 84);
    ctx.quadraticCurveTo(-14, 80, 0, 88);
    ctx.quadraticCurveTo(14, 80, 30, 84);
    ctx.quadraticCurveTo(34, 56, 0, 62);
    ctx.closePath();
    fillStroke(ctx, trap.level >= 3 ? C.goldHi : C.steel, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ellipse(ctx, -12, 70, 6, 3, -0.4);
    ctx.fill();
    ctx.restore();
    if (swing > 0.3) {
      // motion streak
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, -98, 82, Math.PI / 2 - 1.2, Math.PI / 2 + 1.2);
      ctx.stroke();
    }
  } else if (trap.kind === 'mimic') {
    const open = trap.chew > 0 ? 0.6 + Math.abs(Math.sin(t * 18)) * 0.4 : trap.anim < 0.4 ? 1 : 0;
    const breathe = Math.sin(t * 2.2) * 1.5;
    // chest body
    roundRectPath(ctx, -28, -30, 56, 32, 6);
    fillStroke(ctx, C.wood, 3.5);
    ctx.fillStyle = C.gold;
    ctx.fillRect(-28, -20, 56, 5);
    ctx.fillRect(-4, -30, 8, 32);
    // lid
    ctx.save();
    ctx.translate(0, -30 + breathe * 0.3);
    ctx.rotate(-open * 0.7);
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-30, -22, 0, -24);
    ctx.quadraticCurveTo(30, -22, 30, 0);
    ctx.closePath();
    fillStroke(ctx, trap.level >= 3 ? '#c48a2c' : '#a8682f', 3.5);
    ctx.fillStyle = C.gold;
    ctx.fillRect(-4, -23, 8, 23);
    if (open > 0.3) {
      // teeth on the lid
      ctx.fillStyle = C.white;
      for (let i = 0; i < 5; i++) poly(ctx, [-24 + i * 12, 0, -18 + i * 12, 0, -21 + i * 12, 9]);
      ctx.fill();
    }
    ctx.restore();
    if (open > 0.3) {
      ellipse(ctx, 0, -28, 24, 8 * open);
      ctx.fillStyle = '#3a0614';
      ctx.fill();
      ellipse(ctx, 6, -26, 12, 5 * open);
      ctx.fillStyle = '#ff6f91';
      ctx.fill();
    }
    // greedy eyes peek
    const peek = trap.chew > 0 || Math.sin(t * 0.7 + trap.tile) > 0.85;
    if (peek) {
      for (const s of [-1, 1]) {
        circle(ctx, s * 10, -36 - open * 6, 4);
        fillStroke(ctx, '#fff35a', 1.5);
        circle(ctx, s * 10, -35 - open * 6, 1.6);
        ctx.fillStyle = C.ink;
        ctx.fill();
      }
    }
    // sparkle bait
    if (!open) {
      star(ctx, 18, -48 + Math.sin(t * 3) * 3, 5, 2);
      ctx.fillStyle = C.goldHi;
      ctx.fill();
    }
  }
}

export function drawTrapStatus(ctx: CanvasRenderingContext2D, trap: Trap): void {
  // level pips
  for (let i = 0; i < trap.level; i++) {
    star(ctx, -26 + i * 11, 22, 5, 2.2);
    fillStroke(ctx, C.goldHi, 1.4);
  }
  if (trap.illegal) {
    ctx.save();
    ctx.rotate(-0.25);
    roundRectPath(ctx, -40, -12, 80, 24, 4);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = C.crimsonHi;
    ctx.stroke();
    text(ctx, tr('hud.illegal'), 0, 1, { size: 16, color: C.crimsonHi, stroke: '#2a0010', lw: 3, shadow: false });
    ctx.restore();
  } else if (trap.disarmed) {
    ctx.fillStyle = 'rgba(30,20,40,0.55)';
    ellipse(ctx, 0, 0, 34, 24);
    ctx.fill();
    ctx.strokeStyle = C.grey;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-14, -10); ctx.lineTo(14, 10);
    ctx.moveTo(14, -10); ctx.lineTo(-14, 10);
    ctx.stroke();
  }
}

/** Icon used in build cards / pact cards (centred, ~60px). */
export function drawTrapIcon(ctx: CanvasRenderingContext2D, kind: TrapId, t: number): void {
  if (kind === 'axe') {
    ctx.save();
    ctx.scale(0.55, 0.55);
    ctx.translate(0, 50);
    drawTrapTall(ctx, { kind: 'axe', anim: 9, swingDir: 1, level: 1 } as Trap, t);
    ctx.restore();
    return;
  }
  if (kind === 'mimic') {
    ctx.save();
    ctx.scale(0.8, 0.8);
    ctx.translate(0, 18);
    drawTrapTall(ctx, { kind: 'mimic', anim: (t % 2.5) < 0.4 ? 0 : 9, chew: 0, level: 1, tile: 0 } as Trap, t);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.scale(0.75, 0.9);
  drawTrapFloor(ctx, kind, 1, kind === 'spikes' ? (t % 1.2) : kind === 'bounce' ? (t % 1.4) : 9, t, { aim: -Math.PI / 4 });
  ctx.restore();
}
