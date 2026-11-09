import { C } from '../palette';
import { circle, ellipse, fillStroke, poly, roundRectPath, shade, star, withAlpha } from '../draw';
import type { BossId } from '../../data/types';
import type { BossMood } from '../../game/World';
import { BOSSES } from '../../data/bosses';
import { TAU } from '../../core/math';

/**
 * The BOSS: huge, intimidating, alive. Drawn live every frame (it is one big
 * animated puppet). Local coords: (0,0) = bottom center, ~460 x 380.
 */
export interface BossPose {
  t: number;
  mood: BossMood;
  hurt: number;
  /** -1..1 horizontal look direction, -1..1 vertical */
  lookX: number;
  lookY: number;
  rage: number;
  charge: number;
  crown: string;
  skin: string;
}

interface Pal {
  main: string;
  dark: string;
  accent: string;
  eye: string;
  light: string;
}

export function bossPalette(id: BossId, skin: string): Pal {
  const d = BOSSES[id];
  let main = d.main, dark = d.dark, accent = d.accent, eye = d.eye;
  if (skin === 'neon') {
    main = shade(main, 0.25);
    accent = '#3affea';
    eye = '#ff3bd4';
  } else if (skin === 'gold') {
    main = '#e9b53a';
    dark = '#9a6a10';
    accent = '#fff2a8';
  } else if (skin === 'shadow') {
    main = '#3a2f4f';
    dark = '#1b1428';
    eye = '#ff3b3b';
  }
  return { main, dark, accent, eye, light: shade(main, 0.3) };
}

export function drawBoss(ctx: CanvasRenderingContext2D, id: BossId, x: number, y: number, scale: number, p: BossPose): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const pal = bossPalette(id, p.skin);
  drawThrone(ctx, p);
  // mood-driven global motion
  const breath = Math.sin(p.t * 2.1);
  let shakeX = 0;
  if (p.mood === 'laugh') shakeX = Math.sin(p.t * 40) * 3;
  if (p.mood === 'angry') shakeX = Math.sin(p.t * 55) * 4;
  if (p.mood === 'roar' || p.mood === 'ult') shakeX = Math.sin(p.t * 70) * 2.5 * (0.5 + p.charge);
  ctx.translate(shakeX, 0);
  switch (id) {
    case 'demon': drawDemon(ctx, p, pal, breath); break;
    case 'dragon': drawDragon(ctx, p, pal, breath); break;
    case 'lich': drawLich(ctx, p, pal, breath); break;
    case 'slime': drawSlimeKing(ctx, p, pal, breath); break;
    case 'kraken': drawKraken(ctx, p, pal, breath); break;
  }
  // hurt flash
  if (p.hurt > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,60,60,${Math.min(0.5, p.hurt * 1.4)})`;
    ctx.fillRect(-300, -420, 600, 440);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ------------------------------------------------------------------ throne
function drawThrone(ctx: CanvasRenderingContext2D, p: BossPose): void {
  // back slab
  ctx.beginPath();
  ctx.moveTo(-190, 0);
  ctx.lineTo(-200, -300);
  ctx.quadraticCurveTo(-150, -330, -120, -370);
  ctx.lineTo(-90, -330);
  ctx.lineTo(-45, -395);
  ctx.lineTo(0, -345);
  ctx.lineTo(45, -395);
  ctx.lineTo(90, -330);
  ctx.lineTo(120, -370);
  ctx.quadraticCurveTo(150, -330, 200, -300);
  ctx.lineTo(190, 0);
  ctx.closePath();
  fillStroke(ctx, '#2a1d3d', 6);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-178, -10);
  ctx.lineTo(-186, -290);
  ctx.moveTo(178, -10);
  ctx.lineTo(186, -290);
  ctx.stroke();
  // gem with rage glow
  const g = 0.5 + p.rage * 0.5;
  const rg = ctx.createRadialGradient(0, -330, 2, 0, -330, 40);
  rg.addColorStop(0, withAlpha('#ff3b5c', g));
  rg.addColorStop(1, 'rgba(255,59,92,0)');
  ctx.fillStyle = rg;
  circle(ctx, 0, -330, 40);
  ctx.fill();
  poly(ctx, [0, -350, 12, -330, 0, -310, -12, -330]);
  fillStroke(ctx, '#ff3b5c', 3);
  // skulls on armrest bases
  for (const s of [-1, 1]) skull(ctx, s * 205, -40, 1.1);
}

function skull(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ellipse(ctx, 0, 0, 20, 18);
  fillStroke(ctx, C.bone, 4);
  roundRectPath(ctx, -10, 10, 20, 12, 4);
  fillStroke(ctx, C.bone, 4);
  ctx.fillStyle = C.ink;
  ellipse(ctx, -7, 0, 5, 6);
  ctx.fill();
  ellipse(ctx, 7, 0, 5, 6);
  ctx.fill();
  ctx.restore();
}

// --------------------------------------------------------------- eyes etc.
function glowEye(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, col: string, p: BossPose, angry: boolean): void {
  const blink = (p.t % 4.3) > 4.15 && p.mood === 'idle';
  const gr = ctx.createRadialGradient(x, y, 2, x, y, rx * 2.4);
  gr.addColorStop(0, withAlpha(col, 0.7));
  gr.addColorStop(1, withAlpha(col, 0));
  ctx.fillStyle = gr;
  circle(ctx, x, y, rx * 2.4);
  ctx.fill();
  if (blink || p.mood === 'dead') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (p.mood === 'dead') {
      ctx.moveTo(x - rx, y - ry); ctx.lineTo(x + rx, y + ry);
      ctx.moveTo(x + rx, y - ry); ctx.lineTo(x - rx, y + ry);
    } else {
      ctx.moveTo(x - rx, y);
      ctx.lineTo(x + rx, y);
    }
    ctx.stroke();
    return;
  }
  ellipse(ctx, x, y, rx, ry, rot);
  fillStroke(ctx, angry ? '#ff5a3a' : col, 4);
  // pupil slit follows the look target
  const px = x + p.lookX * rx * 0.35, py = y + p.lookY * ry * 0.3;
  ellipse(ctx, px, py, rx * 0.18, ry * 0.75, rot);
  ctx.fillStyle = C.ink;
  ctx.fill();
  circle(ctx, x - rx * 0.35, y - ry * 0.35, rx * 0.16);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

function mouthOpen(p: BossPose): number {
  switch (p.mood) {
    case 'laugh': return 0.7 + Math.abs(Math.sin(p.t * 16)) * 0.3;
    case 'roar': return 0.6 + p.charge * 0.4;
    case 'ult': return 1;
    case 'cast': return 0.7;
    case 'angry': return 0.15;
    case 'dead': return 0.3;
    default: return 0.05 + Math.max(0, Math.sin(p.t * 0.9)) * 0.05;
  }
}

function toothyMouth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, open: number, angry: boolean): void {
  const h = 10 + open * 46;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + (angry ? -8 : 18), x + w / 2, y);
  ctx.quadraticCurveTo(x + w * 0.3, y + h + 10, x, y + h + 14);
  ctx.quadraticCurveTo(x - w * 0.3, y + h + 10, x - w / 2, y);
  ctx.closePath();
  fillStroke(ctx, '#3a0614', 5);
  ctx.save();
  ctx.clip();
  // tongue
  ellipse(ctx, x, y + h + 10, w * 0.25, 12);
  ctx.fillStyle = '#e8456a';
  ctx.fill();
  // teeth
  ctx.fillStyle = C.white;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const tx = x - w / 2 + (w / n) * (i + 0.5);
    poly(ctx, [tx - w / n / 2 + 1, y - 4, tx + w / n / 2 - 1, y - 4, tx, y + 12 + (i % 3 === 0 ? 6 : 0)]);
    ctx.fill();
  }
  for (let i = 0; i < n - 2; i++) {
    const tx = x - w * 0.35 + (w * 0.7 / (n - 2)) * (i + 0.5);
    poly(ctx, [tx - 6, y + h + 16, tx + 6, y + h + 16, tx, y + h + 2]);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCrown(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, k: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  switch (kind) {
    case 'none':
      break;
    case 'party':
      poly(ctx, [-26, 0, 26, 0, 0, -70]);
      fillStroke(ctx, '#4db8ff', 4);
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#ff4d6d', '#ffe14a', '#7dff3a', '#ffffff'][i];
        ctx.fillRect(-30, -12 - i * 16, 60, 6);
      }
      ctx.restore();
      circle(ctx, 0, -72, 9);
      fillStroke(ctx, '#ff6fb5', 3);
      break;
    case 'flowers':
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const fx = Math.cos(a) * 46, fy = Math.sin(a) * 14 - 4;
        for (let j = 0; j < 5; j++) {
          circle(ctx, fx + Math.cos((j / 5) * TAU) * 6, fy + Math.sin((j / 5) * TAU) * 6, 5);
          fillStroke(ctx, ['#ff6fb5', '#ffe14a', '#ffffff', '#b388ff', '#ff8c42', '#7be36b', '#4db8ff'][i], 2);
        }
        circle(ctx, fx, fy, 3.5);
        ctx.fillStyle = '#ffc83a';
        ctx.fill();
      }
      break;
    case 'viking':
      ctx.beginPath();
      ctx.arc(0, 4, 48, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, C.steel, 5);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 40, -16);
        ctx.quadraticCurveTo(s * 85, -30, s * 78, -80);
        ctx.quadraticCurveTo(s * 68, -40, s * 30, -36);
        ctx.closePath();
        fillStroke(ctx, C.bone, 4);
      }
      break;
    case 'halo': {
      const bob = Math.sin(t * 2) * 4;
      ellipse(ctx, 0, -40 + bob, 50, 14, 0.12);
      ctx.lineWidth = 12;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.strokeStyle = C.goldHi;
      ctx.stroke();
      // the dent
      ctx.fillStyle = '#2a1d3d';
      circle(ctx, 30, -32 + bob, 6);
      ctx.fill();
      break;
    }
    default: {
      // gold crown
      ctx.beginPath();
      ctx.moveTo(-44, 0);
      ctx.lineTo(-50, -46);
      ctx.lineTo(-26, -24);
      ctx.lineTo(0, -62);
      ctx.lineTo(26, -24);
      ctx.lineTo(50, -46);
      ctx.lineTo(44, 0);
      ctx.closePath();
      fillStroke(ctx, C.gold, 5);
      ctx.fillStyle = C.goldHi;
      ctx.fillRect(-40, -12, 80, 6);
      for (const [gx, col] of [[-30, '#4db8ff'], [0, '#ff3b5c'], [30, '#7dff3a']] as [number, string][]) {
        circle(ctx, gx, -6, 6);
        fillStroke(ctx, col, 3);
      }
      star(ctx, 0, -62, 7, 3);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }
  ctx.restore();
}

// -------------------------------------------------------------------- arms
function arm(ctx: CanvasRenderingContext2D, side: number, sx: number, sy: number, hx: number, hy: number, col: string, dark: string, claw: string, lift: number): void {
  // upper arm + forearm as a thick curved stroke
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ex = (sx + hx) / 2 + side * 40, ey = (sy + hy) / 2 - 10 - lift * 30;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(ex, ey, hx, hy);
  ctx.lineWidth = 64;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.lineWidth = 54;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.lineWidth = 16;
  ctx.strokeStyle = withAlpha('#ffffff', 0.15);
  ctx.beginPath();
  ctx.moveTo(sx - side * 8, sy - 10);
  ctx.quadraticCurveTo(ex - side * 8, ey - 12, hx - side * 6, hy - 14);
  ctx.stroke();
  // hand with claws
  ellipse(ctx, hx, hy, 38, 28);
  fillStroke(ctx, dark, 5);
  for (let i = 0; i < 4; i++) {
    const cx = hx - 27 + i * 18;
    ctx.beginPath();
    ctx.moveTo(cx - 7, hy + 10);
    ctx.quadraticCurveTo(cx - 4, hy + 34, cx + 4 * side, hy + 42);
    ctx.quadraticCurveTo(cx + 5, hy + 26, cx + 7, hy + 10);
    ctx.closePath();
    fillStroke(ctx, claw, 3.5);
  }
}

// ------------------------------------------------------------------- DEMON
function drawDemon(ctx: CanvasRenderingContext2D, p: BossPose, pal: Pal, breath: number): void {
  const castLift = p.mood === 'cast' ? 1 : p.mood === 'roar' || p.mood === 'ult' ? 0.6 : 0;
  const slam = p.mood === 'angry' ? Math.abs(Math.sin(p.t * 18)) * 14 : 0;
  // arms behind torso
  arm(ctx, -1, -120, -200, -205, -40 + slam, pal.main, pal.dark, C.bone, 0);
  arm(ctx, 1, 120, -200, 205 - castLift * 40, -40 - castLift * 110 + slam, pal.main, pal.dark, C.bone, castLift);
  // torso
  ctx.save();
  ctx.translate(0, 0);
  ctx.scale(1, 1 + breath * 0.018);
  ctx.beginPath();
  ctx.moveTo(-150, -205);
  ctx.quadraticCurveTo(0, -255, 150, -205);
  ctx.quadraticCurveTo(170, -90, 120, 0);
  ctx.lineTo(-120, 0);
  ctx.quadraticCurveTo(-170, -90, -150, -205);
  ctx.closePath();
  fillStroke(ctx, pal.main, 6);
  // belly + abs
  ellipse(ctx, 0, -90, 82, 80);
  ctx.fillStyle = pal.light;
  ctx.fill();
  ctx.strokeStyle = withAlpha(pal.dark, 0.6);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -160); ctx.lineTo(0, -30);
  ctx.moveTo(-40, -120); ctx.quadraticCurveTo(0, -110, 40, -120);
  ctx.moveTo(-45, -75); ctx.quadraticCurveTo(0, -65, 45, -75);
  ctx.stroke();
  // gold belt + skull buckle
  roundRectPath(ctx, -130, -36, 260, 28, 10);
  fillStroke(ctx, C.gold, 5);
  skull(ctx, 0, -24, 0.8);
  ctx.restore();
  // pauldrons
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 135, -205);
    ellipse(ctx, 0, 0, 52, 36, s * 0.25);
    fillStroke(ctx, C.gold, 5);
    for (let i = 0; i < 3; i++) {
      poly(ctx, [s * (-26 + i * 22) - 8, -24, s * (-26 + i * 22) + 8, -24, s * (-22 + i * 24), -58]);
      fillStroke(ctx, C.bone, 4);
    }
    ctx.restore();
  }
  // head
  const hb = Math.sin(p.t * 2.1 + 0.5) * 4;
  let hx = p.lookX * 10, hy = -282 + hb + p.lookY * 6;
  let tilt = p.lookX * 0.06;
  if (p.mood === 'laugh') { hy -= 12; tilt = Math.sin(p.t * 9) * 0.08; }
  if (p.mood === 'dead') { hy += 50; tilt = 0.5; }
  if (p.mood === 'cast' || p.mood === 'roar') hy += 8;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  // horns
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 55, -40);
    ctx.quadraticCurveTo(s * 150, -60, s * 130, -175);
    ctx.quadraticCurveTo(s * 110, -95, s * 30, -70);
    ctx.closePath();
    fillStroke(ctx, C.bone, 5);
    ctx.strokeStyle = withAlpha('#9b8b6a', 0.7);
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * (60 + i * 14), -48 - i * 22);
      ctx.lineTo(s * (40 + i * 18), -70 - i * 14);
      ctx.stroke();
    }
  }
  // skull shape
  ctx.beginPath();
  ctx.moveTo(-88, -10);
  ctx.quadraticCurveTo(-95, -95, 0, -100);
  ctx.quadraticCurveTo(95, -95, 88, -10);
  ctx.quadraticCurveTo(80, 55, 0, 70);
  ctx.quadraticCurveTo(-80, 55, -88, -10);
  ctx.closePath();
  fillStroke(ctx, pal.main, 6);
  ellipse(ctx, -40, -60, 26, 12, -0.4);
  ctx.fillStyle = withAlpha('#ffffff', 0.12);
  ctx.fill();
  // brow ridge
  const angry = p.mood === 'angry' || p.mood === 'roar' || p.mood === 'ult';
  ctx.beginPath();
  ctx.moveTo(-78, angry ? -42 : -50);
  ctx.quadraticCurveTo(-30, angry ? -18 : -40, 0, angry ? -30 : -36);
  ctx.quadraticCurveTo(30, angry ? -18 : -40, 78, angry ? -42 : -50);
  ctx.lineTo(70, -60);
  ctx.quadraticCurveTo(0, -58, -70, -60);
  ctx.closePath();
  fillStroke(ctx, pal.dark, 5);
  // eyes
  glowEye(ctx, -36, -20, 21, 13, 0.25, pal.eye, p, angry);
  glowEye(ctx, 36, -20, 21, 13, -0.25, pal.eye, p, angry);
  // nostrils
  ctx.fillStyle = pal.dark;
  ellipse(ctx, -9, 8, 4, 6, 0.3);
  ctx.fill();
  ellipse(ctx, 9, 8, 4, 6, -0.3);
  ctx.fill();
  toothyMouth(ctx, 0, 22, 110, mouthOpen(p), angry);
  // goatee
  poly(ctx, [-14, 62, 14, 62, 0, 96]);
  fillStroke(ctx, pal.dark, 4);
  if (p.mood !== 'dead') drawCrown(ctx, p.crown, 0, -92, 1, p.t);
  ctx.restore();
  if (p.mood === 'dead') drawCrown(ctx, p.crown, 150, -10, 0.8, p.t);
}

// ------------------------------------------------------------------ DRAGON
function drawDragon(ctx: CanvasRenderingContext2D, p: BossPose, pal: Pal, breath: number): void {
  const flap = Math.sin(p.t * (p.mood === 'idle' ? 1.6 : 6)) * 0.12;
  // wings
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 110, -230);
    ctx.rotate(s * (0.2 + flap));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 230, -140);
    ctx.quadraticCurveTo(s * 220, -40, s * 250, 30);
    ctx.quadraticCurveTo(s * 190, 0, s * 170, 60);
    ctx.quadraticCurveTo(s * 120, 20, s * 90, 80);
    ctx.quadraticCurveTo(s * 60, 40, 0, 60);
    ctx.closePath();
    fillStroke(ctx, pal.dark, 6);
    ctx.strokeStyle = withAlpha('#000000', 0.35);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(s * 250, 30);
    ctx.moveTo(0, 0); ctx.lineTo(s * 170, 60);
    ctx.moveTo(0, 0); ctx.lineTo(s * 90, 80);
    ctx.stroke();
    ctx.restore();
  }
  const castLift = p.mood === 'cast' ? 1 : 0;
  arm(ctx, -1, -100, -170, -195, -40, pal.main, pal.dark, '#fff2d6', 0);
  arm(ctx, 1, 100, -170, 195, -40 - castLift * 60, pal.main, pal.dark, '#fff2d6', castLift);
  // body
  ctx.save();
  ctx.scale(1, 1 + breath * 0.02);
  ctx.beginPath();
  ctx.moveTo(-125, -190);
  ctx.quadraticCurveTo(0, -240, 125, -190);
  ctx.quadraticCurveTo(160, -80, 110, 0);
  ctx.lineTo(-110, 0);
  ctx.quadraticCurveTo(-160, -80, -125, -190);
  fillStroke(ctx, pal.main, 6);
  // belly plates
  for (let i = 0; i < 5; i++) {
    roundRectPath(ctx, -55 + i * 2, -185 + i * 36, 110 - i * 4, 30, 12);
    fillStroke(ctx, '#ffd98a', 4);
  }
  ctx.restore();
  // neck + head
  const hb = Math.sin(p.t * 2 + 0.4) * 5;
  let hy = -280 + hb;
  if (p.mood === 'laugh') hy -= 14;
  if (p.mood === 'dead') hy += 60;
  ctx.save();
  ctx.translate(p.lookX * 14, hy);
  ctx.rotate(p.lookX * 0.08 + (p.mood === 'dead' ? 0.5 : 0));
  // horns / frill
  for (const s of [-1, 1]) {
    poly(ctx, [s * 40, -60, s * 120, -130, s * 72, -40]);
    fillStroke(ctx, '#3d2b1a', 5);
    poly(ctx, [s * 70, -20, s * 130, -40, s * 80, 5]);
    fillStroke(ctx, pal.dark, 4);
  }
  // head
  ctx.beginPath();
  ctx.moveTo(-80, -30);
  ctx.quadraticCurveTo(-70, -95, 0, -95);
  ctx.quadraticCurveTo(70, -95, 80, -30);
  ctx.quadraticCurveTo(75, 10, 52, 30);
  ctx.lineTo(-52, 30);
  ctx.quadraticCurveTo(-75, 10, -80, -30);
  fillStroke(ctx, pal.main, 6);
  // snout
  const open = mouthOpen(p);
  ellipse(ctx, 0, 40 + open * 20, 62, 28 + open * 12);
  fillStroke(ctx, '#3a0614', 5);
  roundRectPath(ctx, -60, 0, 120, 44, 22);
  fillStroke(ctx, pal.light, 5);
  ctx.fillStyle = C.ink;
  ellipse(ctx, -18, 14, 6, 4);
  ctx.fill();
  ellipse(ctx, 18, 14, 6, 4);
  ctx.fill();
  // fangs
  ctx.fillStyle = C.white;
  for (const s of [-1, 1]) {
    poly(ctx, [s * 40, 40, s * 30, 40, s * 36, 60 + open * 10]);
    ctx.fill();
  }
  if (open > 0.5) {
    for (let i = 0; i < 3; i++) {
      const fy = 60 + open * 30 + i * 6;
      ellipse(ctx, Math.sin(p.t * 30 + i) * 6, fy, 16 - i * 4, 8);
      ctx.fillStyle = ['#ffe14a', '#ff8a1f', '#ff5a1a'][i];
      ctx.fill();
    }
  }
  const angry = p.mood === 'angry' || p.mood === 'roar';
  glowEye(ctx, -36, -38, 18, 12, 0.3, pal.eye, p, angry);
  glowEye(ctx, 36, -38, 18, 12, -0.3, pal.eye, p, angry);
  if (p.mood !== 'dead') drawCrown(ctx, p.crown, 0, -92, 0.9, p.t);
  ctx.restore();
}

// -------------------------------------------------------------------- LICH
function drawLich(ctx: CanvasRenderingContext2D, p: BossPose, pal: Pal, breath: number): void {
  const float = Math.sin(p.t * 1.5) * 8;
  ctx.save();
  ctx.translate(0, float - 10);
  // ghostly robe
  ctx.beginPath();
  ctx.moveTo(-150, -210);
  ctx.quadraticCurveTo(0, -260, 150, -210);
  ctx.quadraticCurveTo(190, -80, 170, 10);
  for (let i = 0; i <= 8; i++) {
    const x = 170 - (340 / 8) * i;
    ctx.quadraticCurveTo(x + 21, 30 + Math.sin(p.t * 3 + i) * 8, x, 10);
  }
  ctx.quadraticCurveTo(-190, -80, -150, -210);
  ctx.closePath();
  fillStroke(ctx, pal.main, 6);
  ctx.strokeStyle = withAlpha(pal.accent, 0.5);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -230);
  ctx.lineTo(0, 0);
  ctx.stroke();
  // runes
  for (let i = 0; i < 4; i++) {
    star(ctx, -90 + i * 60, -60 + Math.sin(p.t * 2 + i) * 4, 8, 4, 5);
    ctx.fillStyle = withAlpha(pal.accent, 0.6 + 0.4 * Math.sin(p.t * 3 + i));
    ctx.fill();
  }
  ctx.scale(1, 1 + breath * 0.01);
  // bony hands + staff
  const castLift = p.mood === 'cast' ? 1 : 0;
  for (const s of [-1, 1]) {
    const hx = s * 190, hy = -60 - (s > 0 ? castLift * 80 : 0);
    ctx.strokeStyle = C.bone;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 130, -180);
    ctx.quadraticCurveTo(s * 200, -130, hx, hy);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 16 + i * 10, hy + 26);
      ctx.stroke();
    }
  }
  // staff
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(-200, 10);
  ctx.lineTo(-215, -330);
  ctx.stroke();
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 9;
  ctx.stroke();
  const orb = ctx.createRadialGradient(-215, -350, 2, -215, -350, 50);
  orb.addColorStop(0, '#eaffd6');
  orb.addColorStop(0.4, withAlpha(pal.accent, 0.9));
  orb.addColorStop(1, withAlpha(pal.accent, 0));
  ctx.fillStyle = orb;
  circle(ctx, -215, -350, 50);
  ctx.fill();
  // hood + skull
  const hb = Math.sin(p.t * 1.8) * 4;
  let hy = -285 + hb;
  if (p.mood === 'laugh') hy -= 10;
  if (p.mood === 'dead') hy += 50;
  ctx.save();
  ctx.translate(p.lookX * 10, hy);
  ctx.rotate(p.mood === 'laugh' ? Math.sin(p.t * 10) * 0.08 : p.lookX * 0.05);
  ctx.beginPath();
  ctx.moveTo(-100, 40);
  ctx.quadraticCurveTo(-110, -120, 0, -125);
  ctx.quadraticCurveTo(110, -120, 100, 40);
  ctx.quadraticCurveTo(0, 10, -100, 40);
  fillStroke(ctx, pal.dark, 6);
  // skull
  ellipse(ctx, 0, -20, 66, 70);
  fillStroke(ctx, C.bone, 5);
  ctx.fillStyle = '#1a0f22';
  ellipse(ctx, -26, -25, 20, 22);
  ctx.fill();
  ellipse(ctx, 26, -25, 20, 22);
  ctx.fill();
  const angry = p.mood === 'angry';
  glowEye(ctx, -26, -25, 9, 9, 0, pal.eye, p, angry);
  glowEye(ctx, 26, -25, 9, 9, 0, pal.eye, p, angry);
  poly(ctx, [0, 0, -8, 14, 8, 14]);
  ctx.fillStyle = '#1a0f22';
  ctx.fill();
  // jaw opens
  const open = mouthOpen(p);
  roundRectPath(ctx, -40, 22 + open * 22, 80, 26, 10);
  fillStroke(ctx, C.bone, 4);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-30 + i * 12, 22 + open * 22);
    ctx.lineTo(-30 + i * 12, 34 + open * 22);
    ctx.stroke();
  }
  if (p.mood !== 'dead') drawCrown(ctx, p.crown, 0, -95, 0.85, p.t);
  ctx.restore();
  ctx.restore();
}

// -------------------------------------------------------------- SLIME KING
function drawSlimeKing(ctx: CanvasRenderingContext2D, p: BossPose, pal: Pal, breath: number): void {
  const wob = Math.sin(p.t * 3.2) * 0.04 + (p.mood === 'angry' ? Math.sin(p.t * 30) * 0.05 : 0) + (p.hurt > 0 ? 0.06 : 0);
  ctx.save();
  ctx.scale(1 + wob, 1 - wob + breath * 0.01);
  // blob
  ctx.beginPath();
  ctx.moveTo(-210, 0);
  ctx.quadraticCurveTo(-230, -180, -120, -280);
  ctx.quadraticCurveTo(0, -350, 120, -280);
  ctx.quadraticCurveTo(230, -180, 210, 0);
  ctx.closePath();
  const gr = ctx.createLinearGradient(0, -340, 0, 0);
  gr.addColorStop(0, pal.light);
  gr.addColorStop(1, pal.main);
  fillStroke(ctx, gr, 6);
  // drips
  for (let i = 0; i < 6; i++) {
    const dx = -170 + i * 68;
    const dl = 20 + ((Math.sin(p.t * 1.3 + i * 1.7) + 1) / 2) * 30;
    ellipse(ctx, dx, 4 + dl / 2, 12, dl / 2 + 6);
    fillStroke(ctx, pal.main, 4);
  }
  // shine
  ellipse(ctx, -90, -230, 40, 22, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  // swallowed stuff inside (helmets!)
  ctx.globalAlpha = 0.45;
  ellipse(ctx, 90, -80, 26, 18, 0.6);
  ctx.fillStyle = C.steel;
  ctx.fill();
  roundRectPath(ctx, -120, -60, 20, 40, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  // face
  const angry = p.mood === 'angry' || p.mood === 'roar';
  const fy = -190 + (p.mood === 'dead' ? 40 : 0);
  ctx.save();
  ctx.translate(p.lookX * 16, fy);
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 55, 0, 32, 38);
    fillStroke(ctx, '#ffffff', 5);
    if (p.mood === 'dead') {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s * 55 - 14, -14); ctx.lineTo(s * 55 + 14, 14);
      ctx.moveTo(s * 55 + 14, -14); ctx.lineTo(s * 55 - 14, 14);
      ctx.stroke();
    } else {
      circle(ctx, s * 55 + p.lookX * 10, 6 + p.lookY * 6, 14);
      ctx.fillStyle = C.ink;
      ctx.fill();
      circle(ctx, s * 55 + p.lookX * 10 - 5, 0, 5);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    if (angry) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(s * 20, -40);
      ctx.lineTo(s * 85, -55);
      ctx.stroke();
    }
  }
  const open = mouthOpen(p);
  ctx.beginPath();
  ctx.moveTo(-60, 60);
  ctx.quadraticCurveTo(0, 60 + 30 + open * 70, 60, 60);
  ctx.quadraticCurveTo(0, 70, -60, 60);
  fillStroke(ctx, '#1f5a2a', 5);
  ctx.restore();
  ctx.restore();
  if (p.mood !== 'dead') drawCrown(ctx, p.crown, p.lookX * 10, -320 + wob * 200, 1.1, p.t);
}

// ------------------------------------------------------------------ KRAKEN
function drawKraken(ctx: CanvasRenderingContext2D, p: BossPose, pal: Pal, breath: number): void {
  // tentacles
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1;
    const k = i % 3;
    const bx = s * (60 + k * 40), by = -90;
    const sway = Math.sin(p.t * 2 + i) * 30 + (p.mood === 'angry' ? Math.sin(p.t * 20 + i) * 20 : 0);
    const tx = s * (180 + k * 30) + sway, ty = -20 + k * 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx + s * 60, by - 60, tx - s * 20 + sway, ty - 120, tx, ty);
    ctx.lineWidth = 46 - k * 6;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 38 - k * 6;
    ctx.strokeStyle = k === 1 ? pal.dark : pal.main;
    ctx.stroke();
    // suckers
    for (let j = 1; j < 5; j++) {
      const tt = j / 5;
      const x = bx + (tx - bx) * tt + Math.sin(tt * 3) * s * 20;
      const y = by + (ty - by) * tt - Math.sin(tt * Math.PI) * 60;
      circle(ctx, x, y, 6 - k);
      fillStroke(ctx, '#ffb3d1', 2);
    }
  }
  // mantle/head
  ctx.save();
  ctx.scale(1 + breath * 0.02, 1 - breath * 0.015);
  ctx.beginPath();
  ctx.moveTo(-150, -80);
  ctx.quadraticCurveTo(-170, -300, 0, -360);
  ctx.quadraticCurveTo(170, -300, 150, -80);
  ctx.quadraticCurveTo(0, -40, -150, -80);
  fillStroke(ctx, pal.main, 6);
  // spots
  for (let i = 0; i < 7; i++) {
    circle(ctx, -90 + (i % 4) * 60 + (i > 3 ? 30 : 0), -300 + Math.floor(i / 4) * 60 + (i % 2) * 15, 10 + (i % 3) * 4);
    ctx.fillStyle = withAlpha(pal.dark, 0.6);
    ctx.fill();
  }
  ctx.restore();
  const angry = p.mood === 'angry' || p.mood === 'roar';
  const ey = -170 + (p.mood === 'dead' ? 30 : 0);
  ctx.save();
  ctx.translate(p.lookX * 12, ey);
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 58, 0, 36, 30);
    fillStroke(ctx, '#ffe9a8', 5);
    glowEye(ctx, s * 58, 0, 22, 16, 0, pal.eye, p, angry);
  }
  // beak mouth
  const open = mouthOpen(p);
  poly(ctx, [-24, 44, 24, 44, 0, 70 + open * 30]);
  fillStroke(ctx, '#3a2a1a', 4);
  ctx.restore();
  if (p.mood !== 'dead') drawCrown(ctx, p.crown, p.lookX * 10, -350, 1, p.t);
}

/** Small boss portrait used by menus (head only, cached by the caller). */
export function drawBossPortrait(ctx: CanvasRenderingContext2D, id: BossId, x: number, y: number, size: number, t: number, crown = 'gold', skin = 'classic', mood: BossMood = 'idle'): void {
  const k = size / 420;
  drawBoss(ctx, id, x, y + size * 0.5, k, { t, mood, hurt: 0, lookX: 0, lookY: 0, rage: 0.5, charge: 0, crown, skin });
}
