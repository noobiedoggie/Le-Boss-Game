import { C } from '../palette';
import { circle, ellipse, fillStroke, poly, roundRectPath, star, shade } from '../draw';
import { sprites } from '../Sprites';
import type { HeroClassId, ModId, SuperId } from '../../data/types';
import type { Expr } from '../../game/Hero';

/**
 * Procedural hero art. Heroes are chibi: huge heads, tiny bodies, smug faces.
 * Drawn once per (look, expression) into the sprite cache.
 * Local coords: feet at (0,0), up is -y. Reference size: tile = 92px.
 */

export interface HeroLook {
  cls: HeroClassId;
  mods: ModId[];
  superId?: SuperId;
  tunic: string;
  skin: string;
  hair: string;
  seed: number;
  gender: 'm' | 'f';
  /** remaining extra heads (three-headed) */
  lives: number;
  /** paladin heads alive mask */
  heads?: boolean[];
}

const LW = 3;

export function heroKey(l: HeroLook, expr: Expr): string {
  const mods = l.mods.filter((m) => m !== 'tiny' && m !== 'giant').join('.');
  const heads = l.heads ? l.heads.map((h) => (h ? 1 : 0)).join('') : '';
  return `hero|${l.cls}|${l.superId ?? ''}|${mods}|${l.tunic}|${l.skin}|${l.hair}|${l.seed % 6}|${l.gender}|${l.lives}|${heads}|${expr}`;
}

export function ensureHeroSprite(l: HeroLook, expr: Expr): string {
  const key = heroKey(l, expr);
  const big = l.superId === 'paladin3';
  sprites.ensure(key, big ? 120 : 92, big ? 100 : 96, big ? 60 : 46, big ? 88 : 84, (ctx) => drawHero(ctx, l, expr));
  return key;
}

// ------------------------------------------------------------------ faces
function face(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, expr: Expr, l: HeroLook, glasses = false): void {
  const ex = r * 0.38, ey = y - r * 0.02;
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  if (expr === 'dead') {
    for (const sx of [-1, 1]) {
      const cx = x + sx * ex;
      ctx.beginPath();
      ctx.moveTo(cx - 3, ey - 3); ctx.lineTo(cx + 3, ey + 3);
      ctx.moveTo(cx + 3, ey - 3); ctx.lineTo(cx - 3, ey + 3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 4, y + r * 0.45);
    ctx.quadraticCurveTo(x, y + r * 0.3, x + 4, y + r * 0.45);
    ctx.stroke();
    // tongue
    ellipse(ctx, x + 2, y + r * 0.5, 2, 2.6);
    fillStroke(ctx, '#ff7fa0', 1.2);
    return;
  }
  if (expr === 'hurt') {
    for (const sx of [-1, 1]) {
      const cx = x + sx * ex;
      ctx.beginPath();
      ctx.moveTo(cx - 3 * sx, ey - 3); ctx.lineTo(cx + 2 * sx, ey); ctx.lineTo(cx - 3 * sx, ey + 3);
      ctx.stroke();
    }
    ellipse(ctx, x, y + r * 0.45, 3.5, 2.5);
    fillStroke(ctx, '#5a1020', 1.6);
    return;
  }
  // eyes
  const big = expr === 'scared';
  for (const sx of [-1, 1]) {
    const cx = x + sx * ex;
    ellipse(ctx, cx, ey, big ? 3.8 : 3.1, big ? 4.4 : 3.6);
    fillStroke(ctx, '#ffffff', 1.6);
    circle(ctx, cx + (big ? 0 : 0.8), ey + (big ? 0 : 0.6), big ? 1.4 : 1.9);
    ctx.fillStyle = expr === 'angry' && l.superId === undefined && l.mods.length === 0 ? C.ink : C.ink;
    ctx.fill();
    circle(ctx, cx + 1.4, ey - 1, 0.8);
    ctx.fillStyle = '#fff';
    ctx.fill();
    if (expr === 'smug') {
      // half-closed smug lids
      ctx.beginPath();
      ctx.moveTo(cx - 3.4, ey - 0.6);
      ctx.lineTo(cx + 3.4, ey - 1.6 * sx * 0 - 0.6);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.lineWidth = 2;
    }
  }
  // eyebrows
  ctx.beginPath();
  if (expr === 'angry') {
    ctx.moveTo(x - ex - 4, ey - 6); ctx.lineTo(x - ex + 3, ey - 3.5);
    ctx.moveTo(x + ex + 4, ey - 6); ctx.lineTo(x + ex - 3, ey - 3.5);
  } else if (big) {
    ctx.moveTo(x - ex - 3, ey - 6); ctx.lineTo(x - ex + 3, ey - 7.5);
    ctx.moveTo(x + ex + 3, ey - 6); ctx.lineTo(x + ex - 3, ey - 7.5);
  } else {
    // one raised cocky brow
    ctx.moveTo(x - ex - 3, ey - 5); ctx.lineTo(x - ex + 3, ey - 5.5);
    ctx.moveTo(x + ex - 3, ey - 7); ctx.lineTo(x + ex + 3, ey - 5.5);
  }
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // mouth
  if (big) {
    ellipse(ctx, x, y + r * 0.45, 2.6, 3.4);
    fillStroke(ctx, '#5a1020', 1.6);
  } else if (expr === 'angry') {
    ctx.beginPath();
    ctx.moveTo(x - 4, y + r * 0.48); ctx.lineTo(x + 4, y + r * 0.42);
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // smug smirk
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y + r * 0.38);
    ctx.quadraticCurveTo(x + 1, y + r * 0.58, x + 5, y + r * 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (glasses) {
    ctx.fillStyle = '#111';
    roundRectPath(ctx, x - ex - 4.5, ey - 3, 8, 5.5, 2);
    ctx.fill();
    roundRectPath(ctx, x + ex - 3.5, ey - 3, 8, 5.5, 2);
    ctx.fill();
    ctx.fillRect(x - 1.5, ey - 1.5, 3, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x - ex - 3, ey - 2, 2, 1.5);
    ctx.fillRect(x + ex - 2, ey - 2, 2, 1.5);
  }
}

// ------------------------------------------------------------------- heads
function head(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, l: HeroLook, expr: Expr, cls: HeroClassId, variant = 0): void {
  const hasMod = (m: ModId) => l.mods.includes(m);
  // hair back (for non-helmet classes)
  if (cls !== 'knight' && cls !== 'rogue') {
    ellipse(ctx, x, y - r * 0.15, r * 1.05, r * 0.95);
    fillStroke(ctx, l.hair, LW);
  }
  circle(ctx, x, y, r);
  fillStroke(ctx, l.skin, LW);
  // cheeks
  ctx.fillStyle = 'rgba(255,110,120,0.35)';
  circle(ctx, x - r * 0.55, y + r * 0.25, r * 0.18);
  ctx.fill();
  circle(ctx, x + r * 0.55, y + r * 0.25, r * 0.18);
  ctx.fill();
  // hair fringe
  if (cls === 'cleric' || cls === 'archer' || cls === 'bard' || cls === 'mage') {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y - r * 0.15);
    ctx.quadraticCurveTo(x - r * 0.4, y - r * 0.9, x + r * 0.2, y - r * 0.55);
    ctx.quadraticCurveTo(x + r * 0.7, y - r * 0.95, x + r * 0.95, y - r * 0.2);
    ctx.quadraticCurveTo(x, y - r * 1.3, x - r * 0.95, y - r * 0.15);
    fillStroke(ctx, l.hair, 2.2);
  }
  face(ctx, x, y + r * 0.08, r, expr, l, hasMod('influencer'));
  // mage beard for some men
  if (cls === 'mage' && l.gender === 'm' && l.seed % 2 === 0 && variant === 0) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y + r * 0.55);
    ctx.quadraticCurveTo(x, y + r * 1.8, x + r * 0.6, y + r * 0.55);
    ctx.quadraticCurveTo(x, y + r * 0.9, x - r * 0.6, y + r * 0.55);
    fillStroke(ctx, '#f1eee8', 2);
  }
  headgear(ctx, x, y, r, l, cls, variant);
  if (hasMod('coward')) {
    // sweat drop
    ctx.beginPath();
    ctx.moveTo(x + r * 0.95, y - r * 0.5);
    ctx.quadraticCurveTo(x + r * 1.25, y - r * 0.05, x + r * 0.95, y + r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.7, y - r * 0.05, x + r * 0.95, y - r * 0.5);
    fillStroke(ctx, '#8fe8ff', 1.6);
  }
  if (hasMod('speedrunner')) {
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 0.3);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x - r, y - r * 0.55, r * 2, r * 0.3);
    poly(ctx, [x - r, y - r * 0.5, x - r * 1.8, y - r * 0.8, x - r * 1.7, y - r * 0.3]);
    fillStroke(ctx, '#ff3b3b', 1.8);
  }
  if (hasMod('streamer')) {
    // headset
    ctx.beginPath();
    ctx.arc(x, y, r * 1.05, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2b2b3a';
    ctx.stroke();
    circle(ctx, x - r * 1.0, y, r * 0.32);
    fillStroke(ctx, '#ff4d6d', 2);
    ctx.beginPath();
    ctx.moveTo(x - r * 1.0, y + r * 0.2);
    ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.8, x - r * 0.2, y + r * 0.65);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2b2b3a';
    ctx.stroke();
  }
  if (hasMod('pacifist')) {
    const cols = ['#ff6fb5', '#ffe14a', '#7be36b', '#4db8ff', '#ff8c42'];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.1 + i * 0.2);
      circle(ctx, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95, r * 0.24);
      fillStroke(ctx, cols[i], 1.5);
    }
  }
  if (hasMod('immortal')) {
    ellipse(ctx, x, y - r * 1.45, r * 0.75, r * 0.22);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.goldHi;
    ctx.stroke();
  }
}

function headgear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, l: HeroLook, cls: HeroClassId, variant: number): void {
  switch (cls) {
    case 'knight': {
      // steel helmet with visor slit + plume
      ctx.beginPath();
      ctx.arc(x, y + r * 0.05, r * 1.08, Math.PI * 0.98, Math.PI * 2.02);
      ctx.lineTo(x + r * 1.08, y + r * 0.1);
      ctx.lineTo(x - r * 1.08, y + r * 0.1);
      ctx.closePath();
      fillStroke(ctx, l.superId === 'chosen' ? C.gold : C.steel, LW);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ellipse(ctx, x - r * 0.45, y - r * 0.55, r * 0.25, r * 0.15, -0.6);
      ctx.fill();
      ctx.strokeStyle = C.steelDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.0);
      ctx.lineTo(x, y - r * 0.05);
      ctx.stroke();
      if (variant === 0) {
        // plume
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.0);
        ctx.quadraticCurveTo(x + r * 0.2, y - r * 2.1, x - r * 0.9, y - r * 1.9);
        ctx.quadraticCurveTo(x - r * 0.4, y - r * 1.45, x, y - r * 1.0);
        fillStroke(ctx, l.superId === 'chosen' ? '#ff4d6d' : l.tunic, 2.4);
      }
      break;
    }
    case 'rogue': {
      // hood
      ctx.beginPath();
      ctx.arc(x, y, r * 1.12, Math.PI * 0.85, Math.PI * 2.15);
      ctx.quadraticCurveTo(x + r * 0.7, y + r * 0.2, x + r * 0.62, y - r * 0.25);
      ctx.quadraticCurveTo(x, y - r * 0.75, x - r * 0.62, y - r * 0.25);
      ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.2, x - r * 1.0, y + r * 0.55);
      ctx.closePath();
      fillStroke(ctx, l.superId === 'player' ? '#22222f' : shade(l.tunic, -0.45), LW);
      // mask band
      if (l.superId !== 'player') {
        ctx.fillStyle = '#2a1840';
        roundRectPath(ctx, x - r * 0.75, y + r * 0.3, r * 1.5, r * 0.4, 3);
        ctx.fill();
      }
      break;
    }
    case 'mage': {
      // big pointy hat
      ctx.beginPath();
      ctx.moveTo(x - r * 1.35, y - r * 0.45);
      ctx.quadraticCurveTo(x, y - r * 0.85, x + r * 1.35, y - r * 0.45);
      ctx.lineTo(x + r * 0.7, y - r * 0.7);
      ctx.quadraticCurveTo(x + r * 0.5, y - r * 2.2, x + r * 1.3, y - r * 2.9);
      ctx.quadraticCurveTo(x - r * 0.3, y - r * 2.5, x - r * 0.7, y - r * 0.7);
      ctx.closePath();
      fillStroke(ctx, l.tunic, LW);
      star(ctx, x + r * 0.05, y - r * 1.4, r * 0.32, r * 0.14);
      fillStroke(ctx, C.goldHi, 1.4);
      break;
    }
    case 'cleric': {
      // mitre
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 0.55);
      ctx.lineTo(x - r * 0.6, y - r * 1.7);
      ctx.quadraticCurveTo(x, y - r * 2.3, x + r * 0.6, y - r * 1.7);
      ctx.lineTo(x + r * 0.8, y - r * 0.55);
      ctx.quadraticCurveTo(x, y - r * 0.8, x - r * 0.8, y - r * 0.55);
      fillStroke(ctx, '#fffaf0', LW);
      circle(ctx, x, y - r * 1.25, r * 0.28);
      fillStroke(ctx, C.gold, 1.6);
      break;
    }
    case 'archer': {
      // feathered cap
      ctx.beginPath();
      ctx.moveTo(x - r * 1.15, y - r * 0.35);
      ctx.quadraticCurveTo(x - r * 0.2, y - r * 1.75, x + r * 1.3, y - r * 0.5);
      ctx.quadraticCurveTo(x, y - r * 0.75, x - r * 1.15, y - r * 0.35);
      fillStroke(ctx, '#3f9b3a', LW);
      ctx.beginPath();
      ctx.moveTo(x + r * 0.3, y - r * 1.0);
      ctx.quadraticCurveTo(x + r * 1.0, y - r * 2.2, x + r * 1.6, y - r * 1.8);
      ctx.quadraticCurveTo(x + r * 1.0, y - r * 1.5, x + r * 0.3, y - r * 1.0);
      fillStroke(ctx, '#ff5b5b', 2);
      break;
    }
    case 'bard': {
      // floppy beret + feather
      ellipse(ctx, x - r * 0.15, y - r * 0.8, r * 1.25, r * 0.5, -0.2);
      fillStroke(ctx, shade(l.tunic, -0.2), LW);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 1.0);
      ctx.quadraticCurveTo(x - r * 2.0, y - r * 2.3, x - r * 1.8, y - r * 2.8);
      ctx.quadraticCurveTo(x - r * 1.0, y - r * 1.8, x - r * 0.6, y - r * 1.0);
      fillStroke(ctx, '#ffe14a', 2);
      break;
    }
  }
}

// -------------------------------------------------------------------- body
function weapon(ctx: CanvasRenderingContext2D, l: HeroLook): void {
  const cls = l.cls;
  if (cls === 'knight') {
    // sword
    ctx.save();
    ctx.translate(12, -14);
    ctx.rotate(-0.5);
    roundRectPath(ctx, -2, -22, 4, 22, 1.5);
    fillStroke(ctx, l.superId === 'chosen' ? '#fff7b0' : C.steel, 2.4);
    ctx.fillStyle = C.gold;
    roundRectPath(ctx, -5.5, -1.5, 11, 3.5, 1.5);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // shield
    ctx.beginPath();
    ctx.moveTo(-17, -20);
    ctx.lineTo(-7, -20);
    ctx.lineTo(-7, -11);
    ctx.quadraticCurveTo(-8, -5, -12, -3);
    ctx.quadraticCurveTo(-16, -5, -17, -11);
    ctx.closePath();
    fillStroke(ctx, l.superId === 'chosen' ? C.gold : l.tunic, 2.6);
    star(ctx, -12, -13, 3.2, 1.4);
    ctx.fillStyle = '#fff';
    ctx.fill();
  } else if (cls === 'rogue') {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 11, -12);
      ctx.rotate(s * 0.7);
      poly(ctx, [-1.6, 0, 1.6, 0, 0, -11]);
      fillStroke(ctx, C.steel, 2);
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(-1.5, 0, 3, 4);
      ctx.restore();
    }
  } else if (cls === 'mage') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(13, -2);
    ctx.lineTo(15, -34);
    ctx.stroke();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    circle(ctx, 15, -36, 4.5);
    fillStroke(ctx, '#7fe9ff', 2);
  } else if (cls === 'cleric') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(13, -2);
    ctx.lineTo(13, -30);
    ctx.stroke();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    star(ctx, 13, -32, 6, 3, 8);
    fillStroke(ctx, C.goldHi, 1.8);
  } else if (cls === 'archer') {
    ctx.beginPath();
    ctx.arc(10, -14, 11, -1.2, 1.2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = C.wood;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10 + Math.cos(-1.2) * 11, -14 + Math.sin(-1.2) * 11);
    ctx.lineTo(10 + Math.cos(1.2) * 11, -14 + Math.sin(1.2) * 11);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#eee';
    ctx.stroke();
  } else if (cls === 'bard') {
    ctx.save();
    ctx.translate(-2, -11);
    ctx.rotate(-0.6);
    ellipse(ctx, 0, 0, 7, 6);
    fillStroke(ctx, C.wood, 2.4);
    circle(ctx, 0, 0, 1.8);
    ctx.fillStyle = C.ink;
    ctx.fill();
    roundRectPath(ctx, -1.5, -17, 3, 12, 1);
    fillStroke(ctx, C.woodDark, 1.8);
    ctx.restore();
  }
}

function body(ctx: CanvasRenderingContext2D, l: HeroLook): void {
  const has = (m: ModId) => l.mods.includes(m);
  // cape for the chosen one
  if (l.superId === 'chosen') {
    ctx.beginPath();
    ctx.moveTo(-8, -20);
    ctx.quadraticCurveTo(-16, -6, -13, 0);
    ctx.lineTo(13, 0);
    ctx.quadraticCurveTo(16, -6, 8, -20);
    ctx.closePath();
    fillStroke(ctx, '#e0263f', 2.6);
  }
  // arms (behind)
  circle(ctx, -10, -12, 3.5);
  fillStroke(ctx, l.skin, 2.2);
  circle(ctx, 10, -12, 3.5);
  fillStroke(ctx, l.skin, 2.2);
  // tunic
  ctx.beginPath();
  ctx.moveTo(-8, -21);
  ctx.quadraticCurveTo(0, -24, 8, -21);
  ctx.lineTo(10, -5);
  ctx.quadraticCurveTo(0, -2, -10, -5);
  ctx.closePath();
  const tunic = l.cls === 'knight' ? (l.superId === 'chosen' ? '#fff3b0' : C.steel) : l.tunic;
  fillStroke(ctx, tunic, LW);
  if (l.cls === 'knight') {
    // tabard
    poly(ctx, [-4, -20, 4, -20, 4, -6, 0, -4, -4, -6]);
    fillStroke(ctx, l.superId === 'chosen' ? '#e0263f' : l.tunic, 2);
  }
  // belt
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(-9, -11, 18, 2.6);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-1.5, -11.3, 3, 3.2);
  if (has('lawyer')) {
    poly(ctx, [-1.8, -21, 1.8, -21, 2.6, -12, 0, -9.5, -2.6, -12]);
    fillStroke(ctx, '#d41f3f', 1.4);
    // briefcase
    roundRectPath(ctx, -21, -12, 11, 8, 2);
    fillStroke(ctx, '#6a3d1c', 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.quadraticCurveTo(-15.5, -15, -13, -12);
    ctx.stroke();
  }
  if (has('pacifist')) {
    circle(ctx, 0, -15, 3.4);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -18.4); ctx.lineTo(0, -11.6);
    ctx.moveTo(0, -15); ctx.lineTo(-2.4, -12.6);
    ctx.moveTo(0, -15); ctx.lineTo(2.4, -12.6);
    ctx.stroke();
  }
  if (has('influencer')) {
    // selfie stick + phone
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.lineTo(-22, -34);
    ctx.stroke();
    roundRectPath(ctx, -27, -42, 9, 13, 2);
    fillStroke(ctx, '#ff6fb5', 1.8);
  }
  if (!has('pacifist')) weapon(ctx, l);
}

// -------------------------------------------------------------- full hero
export function drawHero(ctx: CanvasRenderingContext2D, l: HeroLook, expr: Expr): void {
  if (l.mods.includes('chicken')) {
    drawChicken(ctx, l, expr);
    return;
  }
  if (l.superId === 'paladin3') {
    drawPaladin(ctx, l, expr);
    return;
  }
  body(ctx, l);
  const r = 12.5;
  const hy = -33;
  if (l.mods.includes('threeheads')) {
    const extra = Math.max(0, l.lives - 1);
    if (extra >= 1) head(ctx, -14, hy + 4, r * 0.82, l, expr === 'smug' ? 'angry' : expr, l.cls, 1);
    if (extra >= 2) head(ctx, 14, hy + 4, r * 0.82, l, expr === 'smug' ? 'scared' : expr, l.cls, 2);
  }
  head(ctx, 0, hy, r, l, expr, l.cls);
  if (l.superId === 'player') {
    // gamer headset with RGB
    ctx.beginPath();
    ctx.arc(0, hy, r * 1.12, Math.PI * 1.0, Math.PI * 2.0);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    for (const s of [-1, 1]) {
      ellipse(ctx, s * r * 1.05, hy + 1, 3.6, 5.2);
      fillStroke(ctx, s < 0 ? '#3ac1ff' : '#ff3bd4', 2);
    }
  }
}

function drawChicken(ctx: CanvasRenderingContext2D, l: HeroLook, expr: Expr): void {
  // body
  ellipse(ctx, 0, -16, 15, 14);
  fillStroke(ctx, '#fffdf6', LW);
  // wing
  ellipse(ctx, -6, -15, 7, 5, 0.4);
  fillStroke(ctx, '#f0e9dc', 2.2);
  // head
  circle(ctx, 6, -32, 9.5);
  fillStroke(ctx, '#fffdf6', LW);
  // comb
  for (let i = 0; i < 3; i++) {
    circle(ctx, 2 + i * 3.6, -42 + (i === 1 ? -2 : 0), 3.2);
    fillStroke(ctx, '#ff3b3b', 2);
  }
  // beak
  poly(ctx, [13, -33, 21, -30, 13, -27]);
  fillStroke(ctx, '#ffb31a', 2);
  // wattle
  ellipse(ctx, 13, -24.5, 2.2, 3.2);
  fillStroke(ctx, '#ff3b3b', 1.6);
  // eye
  if (expr === 'dead') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, -36); ctx.lineTo(10, -31);
    ctx.moveTo(10, -36); ctx.lineTo(5, -31);
    ctx.stroke();
  } else {
    circle(ctx, 8, -33.5, 2.6);
    fillStroke(ctx, '#fff', 1.4);
    circle(ctx, 8.6, -33.3, 1.4);
    ctx.fillStyle = C.ink;
    ctx.fill();
    // fierce brow
    ctx.beginPath();
    ctx.moveTo(4, -38); ctx.lineTo(11, -36);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  // tiny helmet
  ctx.beginPath();
  ctx.arc(5, -36, 7, Math.PI, 0);
  ctx.closePath();
  fillStroke(ctx, C.steel, 2.2);
  // sword
  ctx.save();
  ctx.translate(-12, -14);
  ctx.rotate(-0.9);
  roundRectPath(ctx, -1.8, -20, 3.6, 20, 1.5);
  fillStroke(ctx, C.steel, 2.2);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-5, -1.2, 10, 3);
  ctx.restore();
  void l;
}

function drawPaladin(ctx: CanvasRenderingContext2D, l: HeroLook, expr: Expr): void {
  // armored body
  ctx.beginPath();
  ctx.moveTo(-18, -26);
  ctx.quadraticCurveTo(0, -32, 18, -26);
  ctx.lineTo(16, -5);
  ctx.quadraticCurveTo(0, -1, -16, -5);
  ctx.closePath();
  fillStroke(ctx, C.steel, LW);
  poly(ctx, [-6, -26, 6, -26, 6, -7, 0, -4, -6, -7]);
  fillStroke(ctx, '#4db8ff', 2.2);
  // shoulder pads
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 18, -25, 7, 5);
    fillStroke(ctx, C.gold, 2.4);
  }
  // big sword
  ctx.save();
  ctx.translate(22, -16);
  ctx.rotate(-0.35);
  roundRectPath(ctx, -2.5, -30, 5, 30, 2);
  fillStroke(ctx, C.steel, 2.6);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-7, -1.5, 14, 4);
  ctx.restore();
  const heads = l.heads ?? [true, true, true];
  const pos = [[-17, -40], [0, -46], [17, -40]];
  const exprs: Expr[] = ['smug', 'angry', 'scared'];
  for (const i of [0, 2, 1]) {
    const [x, y] = pos[i];
    const sub: HeroLook = { ...l, hair: ['#f0f0f0', '#2b1a12', '#ff6fb5'][i], gender: i === 2 ? 'f' : 'm', seed: i };
    const cls: HeroClassId = i === 0 ? 'cleric' : i === 1 ? 'knight' : 'mage';
    head(ctx, x, y, i === 1 ? 12 : 11, sub, heads[i] ? (expr === 'smug' ? exprs[i] : expr) : 'dead', cls, 0);
  }
}

/** Little dead "soul" ghost used in death effects (annoyed face). */
export function drawSoul(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.quadraticCurveTo(-12, -14, 0, -15);
  ctx.quadraticCurveTo(12, -14, 10, 6);
  ctx.quadraticCurveTo(7, 2, 5, 7);
  ctx.quadraticCurveTo(2, 2, 0, 7);
  ctx.quadraticCurveTo(-2, 2, -5, 7);
  ctx.quadraticCurveTo(-7, 2, -10, 6);
  ctx.closePath();
  fillStroke(ctx, 'rgba(235,245,255,0.92)', 2.4, '#5a6b8c');
  // annoyed eyes (flat lids)
  ctx.fillStyle = '#2b3550';
  ctx.fillRect(-6, -6, 4, 2.2);
  ctx.fillRect(2, -6, 4, 2.2);
  ctx.strokeStyle = '#2b3550';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.lineTo(3, 0);
  ctx.stroke();
}

/** Hats that pop off on death and bounce around. */
export function drawHat(ctx: CanvasRenderingContext2D, cls: HeroClassId, color: string): void {
  switch (cls) {
    case 'knight':
      ctx.beginPath();
      ctx.arc(0, 4, 13, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, C.steel, 2.6);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.quadraticCurveTo(3, -20, -9, -18);
      ctx.quadraticCurveTo(-4, -13, 0, -9);
      fillStroke(ctx, color, 2);
      break;
    case 'mage':
      poly(ctx, [-15, 4, 15, 4, 8, 1, 6, -18, 14, -26, -6, -18, -8, 1]);
      fillStroke(ctx, color, 2.6);
      break;
    case 'cleric':
      poly(ctx, [-9, 4, -7, -12, 0, -18, 7, -12, 9, 4]);
      fillStroke(ctx, '#fffaf0', 2.6);
      break;
    case 'archer':
      ellipse(ctx, 0, 0, 13, 6, -0.2);
      fillStroke(ctx, '#3f9b3a', 2.6);
      break;
    case 'bard':
      ellipse(ctx, 0, 0, 14, 6, -0.2);
      fillStroke(ctx, shade(color, -0.2), 2.6);
      break;
    default:
      ellipse(ctx, 0, 0, 12, 7);
      fillStroke(ctx, shade(color, -0.45), 2.6);
  }
}

export function defineHeroStatics(): void {
  sprites.define('soul', 30, 30, 15, 16, drawSoul);
}
