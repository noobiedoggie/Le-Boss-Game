import { C } from '../palette';
import { circle, ellipse, fillStroke, poly, roundRectPath, star, withAlpha } from '../draw';
import { sprites } from '../Sprites';
import type { MonsterId } from '../../data/types';

/**
 * Monster art, cached per (kind, level). Feet at (0,0). Levels evolve
 * visibly: L2 = armour/gold trim, L3 = crown, horns & glow.
 */

export function monsterKey(kind: MonsterId | 'skeleton' | 'minigob' | 'slimeling', level: number, frame = 0): string {
  return `mon|${kind}|${level}|${frame}`;
}

export function ensureMonster(kind: MonsterId | 'skeleton' | 'minigob' | 'slimeling', level: number, frame = 0): string {
  const key = monsterKey(kind, level, frame);
  const big = kind === 'ogre';
  sprites.ensure(key, big ? 120 : 90, big ? 120 : 96, big ? 60 : 45, big ? 112 : 88, (ctx) => drawMonster(ctx, kind, level, frame));
  return key;
}

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, r: number, col = '#ff3b3b'): void {
  for (const s of [-1, 1]) {
    circle(ctx, x + s * gap, y, r);
    fillStroke(ctx, col, 1.6);
    circle(ctx, x + s * gap + 0.6, y + 0.3, r * 0.45);
    ctx.fillStyle = C.ink;
    ctx.fill();
  }
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  poly(ctx, [x - 9 * k, y, x - 10 * k, y - 10 * k, x - 4 * k, y - 5 * k, x, y - 12 * k, x + 4 * k, y - 5 * k, x + 10 * k, y - 10 * k, x + 9 * k, y]);
  fillStroke(ctx, C.gold, 2);
}

export function drawMonster(ctx: CanvasRenderingContext2D, kind: MonsterId | 'skeleton' | 'minigob' | 'slimeling', level: number, frame: number): void {
  switch (kind) {
    case 'goblin':
    case 'minigob': {
      const skin = kind === 'minigob' ? '#9cff4f' : level >= 3 ? '#4fd65b' : '#6fbf3a';
      const k = 1 + (level - 1) * 0.1;
      ctx.scale(k, k);
      // spear
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(12, -2); ctx.lineTo(16, -42);
      ctx.stroke();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      poly(ctx, [12, -40, 20, -42, 17, -54]);
      fillStroke(ctx, level >= 2 ? C.gold : C.steel, 2);
      // body
      ellipse(ctx, 0, -12, 11, 12);
      fillStroke(ctx, level >= 2 ? '#8a5a2c' : '#6d4b8a', 3);
      // head
      for (const s of [-1, 1]) {
        poly(ctx, [s * 8, -30, s * 26, -38, s * 10, -22]);
        fillStroke(ctx, skin, 2.6);
      }
      circle(ctx, 0, -28, 11);
      fillStroke(ctx, skin, 3);
      eyes(ctx, 0, -29, 4.2, 2.8, '#ffe14a');
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -22);
      ctx.lineTo(4, -22);
      ctx.stroke();
      ctx.fillStyle = C.white;
      poly(ctx, [-3, -22, -1, -22, -2, -19]);
      ctx.fill();
      poly(ctx, [1, -22, 3, -22, 2, -19]);
      ctx.fill();
      if (level >= 2) {
        ctx.beginPath();
        ctx.arc(0, -31, 11.5, Math.PI, 0);
        ctx.closePath();
        fillStroke(ctx, C.steelDark, 2.4);
      }
      if (level >= 3) crown(ctx, 0, -42, 1);
      if (kind === 'minigob') {
        ctx.strokeStyle = withAlpha(C.dark, 0.7);
        ctx.lineWidth = 2;
        circle(ctx, 0, -20, 22);
        ctx.stroke();
      }
      break;
    }
    case 'archer':
    case 'skeleton': {
      const k = 1 + (level - 1) * 0.08;
      ctx.scale(k, k);
      const bone = kind === 'skeleton' ? '#d9c8ff' : C.bone;
      // legs
      ctx.strokeStyle = bone;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, 0); ctx.lineTo(-3, -10);
      ctx.moveTo(4, 0); ctx.lineTo(3, -10);
      ctx.stroke();
      // ribcage
      roundRectPath(ctx, -8, -24, 16, 14, 4);
      fillStroke(ctx, bone, 2.6);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-6, -21 + i * 4);
        ctx.lineTo(6, -21 + i * 4);
        ctx.stroke();
      }
      if (level >= 3 && kind === 'archer') {
        poly(ctx, [-9, -24, 9, -24, 13, -4, -13, -4]);
        fillStroke(ctx, '#6b1f3f', 2);
      }
      // skull
      ellipse(ctx, 0, -33, 10, 9.5);
      fillStroke(ctx, bone, 2.8);
      const eyeCol = level >= 3 || kind === 'skeleton' ? '#b388ff' : '#ff3b3b';
      for (const s of [-1, 1]) {
        circle(ctx, s * 4, -34, 2.8);
        ctx.fillStyle = C.ink;
        ctx.fill();
        circle(ctx, s * 4, -34, 1.3);
        ctx.fillStyle = eyeCol;
        ctx.fill();
      }
      ctx.fillStyle = C.ink;
      ctx.fillRect(-4, -27, 8, 2);
      if (level >= 2) {
        ctx.beginPath();
        ctx.arc(0, -36, 10.5, Math.PI, 0);
        ctx.closePath();
        fillStroke(ctx, C.steelDark, 2.2);
      }
      if (level >= 3) crown(ctx, 0, -45, 0.9);
      if (kind === 'archer') {
        ctx.beginPath();
        ctx.arc(-12, -20, 13, -1.3, 1.3);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = level >= 2 ? C.gold : C.wood;
        ctx.stroke();
      } else {
        // rusty sword
        ctx.save();
        ctx.translate(10, -16);
        ctx.rotate(-0.6);
        roundRectPath(ctx, -1.5, -16, 3, 16, 1);
        fillStroke(ctx, '#a08a7a', 1.8);
        ctx.restore();
      }
      break;
    }
    case 'ogre': {
      const skin = level >= 3 ? '#9c6bd1' : '#8c86a8';
      const k = 1 + (level - 1) * 0.1;
      ctx.scale(k, k);
      // club
      ctx.save();
      ctx.translate(30, -40);
      ctx.rotate(0.5);
      ctx.beginPath();
      ctx.moveTo(-5, 30);
      ctx.lineTo(-9, -24);
      ctx.quadraticCurveTo(0, -36, 9, -24);
      ctx.lineTo(5, 30);
      ctx.closePath();
      fillStroke(ctx, C.wood, 3.4);
      if (level >= 2) {
        for (let i = 0; i < 3; i++) {
          poly(ctx, [-9, -16 + i * 10, -16, -12 + i * 10, -9, -8 + i * 10]);
          fillStroke(ctx, C.steel, 1.8);
        }
      }
      ctx.restore();
      // legs
      for (const s of [-1, 1]) {
        roundRectPath(ctx, s * 12 - 7, -16, 14, 16, 5);
        fillStroke(ctx, skin, 3);
      }
      // belly
      ellipse(ctx, 0, -40, 30, 28);
      fillStroke(ctx, skin, 3.5);
      ellipse(ctx, 0, -34, 20, 16);
      ctx.fillStyle = withAlpha('#ffffff', 0.18);
      ctx.fill();
      // loincloth / armour
      roundRectPath(ctx, -24, -24, 48, 12, 4);
      fillStroke(ctx, level >= 2 ? C.steelDark : C.woodDark, 2.6);
      // head
      circle(ctx, 0, -72, 16);
      fillStroke(ctx, skin, 3.4);
      eyes(ctx, 0, -75, 6, 3, '#ffe14a');
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-11, -82); ctx.lineTo(-2, -79);
      ctx.moveTo(11, -82); ctx.lineTo(2, -79);
      ctx.stroke();
      // underbite tusks
      roundRectPath(ctx, -9, -66, 18, 6, 3);
      fillStroke(ctx, '#3a1a2a', 2);
      ctx.fillStyle = C.white;
      poly(ctx, [-8, -64, -4, -64, -6, -71]);
      ctx.fill();
      poly(ctx, [4, -64, 8, -64, 6, -71]);
      ctx.fill();
      if (level >= 3) {
        for (const s of [-1, 1]) {
          poly(ctx, [s * 8, -86, s * 20, -102, s * 14, -82]);
          fillStroke(ctx, C.bone, 2.4);
        }
        crown(ctx, 0, -88, 1.1);
      }
      break;
    }
    case 'bats': {
      const col = level >= 3 ? '#b13b6b' : level >= 2 ? '#5d3a8a' : '#3b2f55';
      for (let i = 0; i < 3; i++) {
        const bx = [-12, 12, 0][i], by = [-34, -30, -46][i];
        const up = (frame + i) % 2 === 0;
        ctx.save();
        ctx.translate(bx, by);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(s * 10, up ? -14 : 4, s * 18, up ? -8 : 8);
          ctx.quadraticCurveTo(s * 12, up ? -2 : 6, s * 9, up ? 2 : 6);
          ctx.quadraticCurveTo(s * 5, 0, 0, 3);
          ctx.closePath();
          fillStroke(ctx, col, 2);
        }
        circle(ctx, 0, 0, 5.5);
        fillStroke(ctx, col, 2);
        circle(ctx, -2, -1, 1.3);
        ctx.fillStyle = '#ff3b3b';
        ctx.fill();
        circle(ctx, 2, -1, 1.3);
        ctx.fill();
        ctx.restore();
      }
      if (level >= 3) crown(ctx, 0, -54, 0.7);
      break;
    }
    case 'necro': {
      const robe = level >= 3 ? '#3d1a5e' : '#4a2a6a';
      // staff
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-16, -52);
      ctx.stroke();
      ctx.strokeStyle = '#5a4030';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      const g = ctx.createRadialGradient(-16, -56, 1, -16, -56, 14);
      g.addColorStop(0, '#eaffd6');
      g.addColorStop(0.5, withAlpha(C.toxic, 0.9));
      g.addColorStop(1, withAlpha(C.toxic, 0));
      ctx.fillStyle = g;
      circle(ctx, -16, -56, 14);
      ctx.fill();
      skullSmall(ctx, -16, -56);
      // robe
      ctx.beginPath();
      ctx.moveTo(-12, -32);
      ctx.quadraticCurveTo(0, -38, 12, -32);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      fillStroke(ctx, robe, 3);
      // hood
      ctx.beginPath();
      ctx.moveTo(-12, -28);
      ctx.quadraticCurveTo(-16, -52, 0, -54);
      ctx.quadraticCurveTo(16, -52, 12, -28);
      ctx.quadraticCurveTo(0, -24, -12, -28);
      fillStroke(ctx, robe, 3);
      ellipse(ctx, 0, -37, 7, 8);
      ctx.fillStyle = '#120a1c';
      ctx.fill();
      for (const s of [-1, 1]) {
        circle(ctx, s * 3, -38, 1.8);
        ctx.fillStyle = C.toxic;
        ctx.fill();
      }
      if (level >= 2) {
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, -8);
        ctx.lineTo(14, -8);
        ctx.stroke();
      }
      if (level >= 3) crown(ctx, 0, -53, 0.8);
      break;
    }
    case 'slimeling': {
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.quadraticCurveTo(-16, -22, 0, -24);
      ctx.quadraticCurveTo(16, -22, 14, 0);
      ctx.closePath();
      fillStroke(ctx, C.slime, 3);
      eyes(ctx, 0, -12, 4, 2.6, '#ffffff');
      star(ctx, 0, -26, 4, 2);
      ctx.fillStyle = C.gold;
      ctx.fill();
      break;
    }
  }
}

function skullSmall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ellipse(ctx, x, y, 5, 4.5);
  fillStroke(ctx, C.bone, 1.4);
  ctx.fillStyle = C.ink;
  circle(ctx, x - 2, y - 0.5, 1.2);
  ctx.fill();
  circle(ctx, x + 2, y - 0.5, 1.2);
  ctx.fill();
}
