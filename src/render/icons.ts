import { C } from './palette';
import { circle, ellipse, fillStroke, poly, roundRectPath, star } from './draw';
import { heart } from './fxArt';

/** Small vector icons (centred at 0,0, ~ size px). */
export function icon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size = 28, t = 0): void {
  ctx.save();
  ctx.translate(x, y);
  const k = size / 28;
  ctx.scale(k, k);
  switch (name) {
    case 'gold':
      ellipse(ctx, 0, 0, 12, 12);
      fillStroke(ctx, C.gold, 3);
      ellipse(ctx, 0, 0, 7, 7);
      ctx.strokeStyle = C.goldDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.goldHi;
      ellipse(ctx, -4, -4, 3, 2, -0.6);
      ctx.fill();
      break;
    case 'soul':
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(12, -2, 8, 8);
      ctx.quadraticCurveTo(0, 16, -8, 8);
      ctx.quadraticCurveTo(-12, -2, 0, -14);
      fillStroke(ctx, '#8fe8ff', 3);
      ctx.fillStyle = '#e8fbff';
      ellipse(ctx, -2, 2, 3, 4);
      ctx.fill();
      break;
    case 'heart':
      heart(ctx, 0, 2, 13);
      fillStroke(ctx, C.crimsonHi, 3);
      break;
    case 'rage':
      star(ctx, 0, 0, 14, 7, 7, t * 0.5);
      fillStroke(ctx, C.lava, 3);
      circle(ctx, 0, 0, 5);
      ctx.fillStyle = C.lavaHi;
      ctx.fill();
      break;
    case 'skull':
      ellipse(ctx, 0, -2, 11, 10);
      fillStroke(ctx, C.bone, 3);
      roundRectPath(ctx, -6, 5, 12, 7, 3);
      fillStroke(ctx, C.bone, 2.5);
      ctx.fillStyle = C.ink;
      circle(ctx, -4, -2, 3);
      ctx.fill();
      circle(ctx, 4, -2, 3);
      ctx.fill();
      break;
    case 'fire':
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(13, 0, 8, 10);
      ctx.quadraticCurveTo(0, 16, -8, 10);
      ctx.quadraticCurveTo(-13, 0, 0, -14);
      fillStroke(ctx, C.fire, 3);
      ellipse(ctx, 0, 5, 4, 6);
      ctx.fillStyle = C.fireHi;
      ctx.fill();
      break;
    case 'clock':
      circle(ctx, 0, 0, 12);
      fillStroke(ctx, '#e8e2ff', 3);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -7);
      ctx.moveTo(0, 0); ctx.lineTo(5, 3);
      ctx.stroke();
      break;
    case 'wall':
      roundRectPath(ctx, -13, -9, 26, 18, 3);
      fillStroke(ctx, C.wallTop, 3);
      ctx.strokeStyle = C.wallFront;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-13, 0); ctx.lineTo(13, 0);
      ctx.moveTo(0, -9); ctx.lineTo(0, 0);
      ctx.moveTo(-6, 0); ctx.lineTo(-6, 9);
      ctx.moveTo(6, 0); ctx.lineTo(6, 9);
      ctx.stroke();
      break;
    case 'up':
      poly(ctx, [0, -14, 12, 0, 5, 0, 5, 12, -5, 12, -5, 0, -12, 0]);
      fillStroke(ctx, C.uiGood, 3);
      break;
    case 'echo':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-6, 0, 5 + i * 5, -0.9, 0.9);
        ctx.lineWidth = 3;
        ctx.strokeStyle = i === 0 ? C.white : C.uiBlue;
        ctx.stroke();
      }
      break;
    case 'combo':
      star(ctx, 0, 0, 14, 6, 8);
      fillStroke(ctx, C.gold, 3);
      break;
    case 'boom':
      star(ctx, 0, 0, 14, 7, 9);
      fillStroke(ctx, C.lava, 3);
      star(ctx, 0, 0, 7, 3, 9);
      ctx.fillStyle = C.fireHi;
      ctx.fill();
      break;
    case 'lava':
      roundRectPath(ctx, -13, -6, 26, 14, 6);
      fillStroke(ctx, C.lava, 3);
      circle(ctx, -4, 0, 3);
      ctx.fillStyle = C.lavaHi;
      ctx.fill();
      break;
    case 'crown':
      poly(ctx, [-13, 8, -14, -8, -6, -1, 0, -12, 6, -1, 14, -8, 13, 8]);
      fillStroke(ctx, C.gold, 3);
      break;
    case 'claw':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-10 + i * 6, -12);
        ctx.quadraticCurveTo(i * 6, 0, 8 + i * 6, 12);
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.crimsonHi;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      break;
    case 'slime':
      ctx.beginPath();
      ctx.moveTo(-13, 8);
      ctx.quadraticCurveTo(-14, -10, 0, -11);
      ctx.quadraticCurveTo(14, -10, 13, 8);
      ctx.closePath();
      fillStroke(ctx, C.slime, 3);
      break;
    case 'gas':
      circle(ctx, -5, 2, 7);
      fillStroke(ctx, C.poison, 2.5);
      circle(ctx, 5, -3, 8);
      fillStroke(ctx, C.poison, 2.5);
      break;
    case 'spikes':
      for (let i = -1; i <= 1; i++) {
        poly(ctx, [i * 9 - 5, 10, i * 9 + 5, 10, i * 9, -12]);
        fillStroke(ctx, C.steel, 2.5);
      }
      break;
    case 'bounce':
      ellipse(ctx, 0, -4, 13, 6);
      fillStroke(ctx, '#ff4d6d', 3);
      ctx.strokeStyle = C.steel;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, 2); ctx.lineTo(6, 6); ctx.lineTo(-6, 10); ctx.lineTo(6, 13);
      ctx.stroke();
      break;
    case 'goblin':
      circle(ctx, 0, 0, 10);
      fillStroke(ctx, '#6fbf3a', 3);
      poly(ctx, [-8, -2, -18, -8, -8, 4]);
      fillStroke(ctx, '#6fbf3a', 2.5);
      poly(ctx, [8, -2, 18, -8, 8, 4]);
      fillStroke(ctx, '#6fbf3a', 2.5);
      ctx.fillStyle = C.ink;
      circle(ctx, -3, -1, 2);
      ctx.fill();
      circle(ctx, 3, -1, 2);
      ctx.fill();
      break;
    case 'book':
      roundRectPath(ctx, -12, -13, 24, 26, 3);
      fillStroke(ctx, C.crimson, 3);
      ctx.fillStyle = C.gold;
      ctx.fillRect(-12, -13, 5, 26);
      break;
    case 'gear':
      star(ctx, 0, 0, 14, 10, 8);
      fillStroke(ctx, C.steel, 3);
      circle(ctx, 0, 0, 4.5);
      fillStroke(ctx, C.uiPanel, 2);
      break;
    case 'trophy':
      ctx.beginPath();
      ctx.moveTo(-10, -12);
      ctx.lineTo(10, -12);
      ctx.quadraticCurveTo(10, 4, 0, 5);
      ctx.quadraticCurveTo(-10, 4, -10, -12);
      fillStroke(ctx, C.gold, 3);
      roundRectPath(ctx, -7, 8, 14, 5, 2);
      fillStroke(ctx, C.gold, 2.5);
      ctx.fillRect(-1.5, 4, 3, 5);
      break;
    case 'calendar':
      roundRectPath(ctx, -12, -11, 24, 23, 3);
      fillStroke(ctx, '#fff', 3);
      ctx.fillStyle = C.crimson;
      ctx.fillRect(-12, -11, 24, 7);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-12, -11, 24, 7);
      break;
    case 'pause':
      roundRectPath(ctx, -9, -11, 6, 22, 2);
      fillStroke(ctx, C.white, 2.5);
      roundRectPath(ctx, 3, -11, 6, 22, 2);
      fillStroke(ctx, C.white, 2.5);
      break;
    case 'lock':
      roundRectPath(ctx, -10, -2, 20, 15, 3);
      fillStroke(ctx, C.grey, 3);
      ctx.beginPath();
      ctx.arc(0, -3, 7, Math.PI, 0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      break;
    case 'tap':
    case 'swipe':
    case 'hold': {
      // finger
      roundRectPath(ctx, -5, -12, 10, 22, 5);
      fillStroke(ctx, '#ffd7b0', 2.5);
      if (name === 'swipe') {
        ctx.strokeStyle = C.white;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-14, 10); ctx.lineTo(-4, 14);
        ctx.moveTo(4, 14); ctx.lineTo(14, 10);
        ctx.stroke();
      } else if (name === 'hold') {
        ctx.beginPath();
        ctx.arc(0, -12, 9, 0, Math.PI * 2 * ((t * 0.8) % 1));
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        circle(ctx, 0, -14, 6 + ((t * 2) % 1) * 6);
        ctx.strokeStyle = C.white;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'dark':
      circle(ctx, 0, 0, 12);
      fillStroke(ctx, C.dark, 3);
      circle(ctx, 4, -3, 8);
      ctx.fillStyle = '#1d1030';
      ctx.fill();
      break;
    case 'music':
      ellipse(ctx, -4, 8, 5, 4, -0.4);
      fillStroke(ctx, C.white, 2);
      ctx.fillStyle = C.white;
      ctx.fillRect(0, -12, 3, 20);
      ctx.fillRect(0, -12, 10, 3);
      break;
    case 'mimic':
      roundRectPath(ctx, -13, -4, 26, 15, 3);
      fillStroke(ctx, C.wood, 3);
      ctx.beginPath();
      ctx.moveTo(-13, -4);
      ctx.quadraticCurveTo(0, -18, 13, -4);
      fillStroke(ctx, '#a8682f', 3);
      break;
    case 'chicken':
      ellipse(ctx, 0, 3, 11, 10);
      fillStroke(ctx, '#fff', 3);
      circle(ctx, 4, -9, 6);
      fillStroke(ctx, '#fff', 2.5);
      circle(ctx, 3, -16, 3);
      fillStroke(ctx, '#ff3b3b', 2);
      poly(ctx, [9, -9, 15, -7, 9, -5]);
      fillStroke(ctx, '#ffb31a', 1.5);
      break;
    case 'lawyer':
      roundRectPath(ctx, -12, -6, 24, 16, 3);
      fillStroke(ctx, '#6a3d1c', 3);
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.quadraticCurveTo(0, -12, 5, -6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      break;
    case 'streamer':
      roundRectPath(ctx, -13, -9, 26, 18, 4);
      fillStroke(ctx, '#9146ff', 3);
      poly(ctx, [-3, -4, 5, 0, -3, 4]);
      ctx.fillStyle = '#fff';
      ctx.fill();
      break;
    default:
      circle(ctx, 0, 0, 10);
      fillStroke(ctx, C.grey, 3);
  }
  ctx.restore();
}
