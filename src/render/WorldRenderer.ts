import { C } from './palette';
import { circle, ellipse, fillStroke, poly, roundRectPath, text, withAlpha, shade } from './draw';
import { sprites } from './Sprites';
import { drawParticles, drawFloatTexts, bubble } from './fxArt';
import { ensureHeroSprite, type HeroLook } from './art/heroArt';
import { ensureMonster } from './art/monsterArt';
import { drawTrapFloor, drawTrapStatus, drawTrapTall } from './art/trapArt';
import { drawBoss, type BossPose } from './art/bossArt';
import { COLS, ROWS, Tile, type Board } from '../game/Board';
import type { World } from '../game/World';
import type { Hero } from '../game/Hero';
import type { Monster } from '../game/Monster';
import type { Trap } from '../game/Trap';
import { clamp, easeOutBack, TAU } from '../core/math';
import { t as tr } from '../i18n';
import type { BuildId } from '../data/types';
import { TRAPS } from '../data/traps';

export interface RenderOpts {
  t: number;
  W: number;
  H: number;
  res: number;
  build: boolean;
  hoverTile: number;
  hoverId: BuildId | null;
  hoverOk: boolean;
  selectedTile: number;
  crown: string;
  skin: string;
  charge: number;
  holdX?: number;
  holdY?: number;
  bossX: number;
  bossY: number;
  bossScale: number;
  drawBoss: boolean;
}

interface Sortable {
  key: number;
  draw: () => void;
}

const REF_TILE = 92;
/** Characters are drawn a bit bigger than the tile ratio for readability. */
const CHAR = 1.32;

/**
 * Draws a World: cached dungeon background, tiles, traps, entities (y-sorted),
 * the boss, effects and texts. Pure view: never mutates the simulation.
 */
export class WorldRenderer {
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private pt = { x: 0, y: 0 };

  // ================================================================ static
  private ensureCache(w: World, o: RenderOpts): void {
    const b = w.board;
    const key = `${b.version}:${o.W}:${o.H}:${o.res}:${b.top}:${b.tileW}`;
    if (this.cache && key === this.cacheKey) return;
    this.cacheKey = key;
    const c = this.cache ?? document.createElement('canvas');
    c.width = Math.ceil(o.W * o.res);
    c.height = Math.ceil(o.H * o.res);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(o.res, 0, 0, o.res, 0, 0);
    this.drawStatic(ctx, w, o);
    this.cache = c;
  }

  private corner(b: Board, gx: number, gy: number): [number, number] {
    const p = b.project(gx, gy, this.pt);
    return [p.x, p.y];
  }

  private quadPath(ctx: CanvasRenderingContext2D, b: Board, c0: number, r0: number, c1: number, r1: number, lift = 0): void {
    const [ax, ay] = this.corner(b, c0, r0);
    const [bx, by] = this.corner(b, c1, r0);
    const [cx, cy] = this.corner(b, c1, r1);
    const [dx, dy] = this.corner(b, c0, r1);
    ctx.beginPath();
    ctx.moveTo(ax, ay - lift);
    ctx.lineTo(bx, by - lift);
    ctx.lineTo(cx, cy - lift);
    ctx.lineTo(dx, dy - lift);
    ctx.closePath();
  }

  private hash(i: number, k = 0): number {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  private drawStatic(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts): void {
    const b = w.board;
    const { W, H } = o;
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b0612');
    bg.addColorStop(0.5, '#1a0f2b');
    bg.addColorStop(1, '#120a1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const [tlx, tly] = this.corner(b, 0, 0);
    const [trx] = this.corner(b, COLS, 0);
    const [blx, bly] = this.corner(b, 0, ROWS);
    const [brx] = this.corner(b, COLS, ROWS);

    // ---- back wall (bricks) above row 0
    const wallTop = tly - b.tileH * 1.6;
    ctx.fillStyle = '#2b1b40';
    ctx.fillRect(0, wallTop, W, tly - wallTop);
    ctx.strokeStyle = '#1a0f28';
    ctx.lineWidth = 3;
    const bh = b.tileH * 0.32;
    for (let row = 0; wallTop + row * bh < tly; row++) {
      const y = wallTop + row * bh;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      const off = row % 2 ? 0 : 30;
      for (let x = off; x < W; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + bh);
        ctx.stroke();
      }
    }
    // top shadow
    const sh = ctx.createLinearGradient(0, wallTop, 0, wallTop + 60);
    sh.addColorStop(0, '#07030c');
    sh.addColorStop(1, 'rgba(7,3,12,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, wallTop, W, 60);
    ctx.fillStyle = '#07030c';
    ctx.fillRect(0, 0, W, wallTop);
    // banners
    for (const bx of [tlx + (trx - tlx) * 0.18, tlx + (trx - tlx) * 0.82]) {
      poly(ctx, [bx - 22, wallTop + 6, bx + 22, wallTop + 6, bx + 22, wallTop + 70, bx, wallTop + 58, bx - 22, wallTop + 70]);
      fillStroke(ctx, C.crimsonDark, 3);
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.arc(bx, wallTop + 32, 9, 0, TAU);
      ctx.fill();
    }
    // entrance arch
    const [ex0] = this.corner(b, b.entrance - 0.1, 0);
    const [ex1] = this.corner(b, b.entrance + 1.1, 0);
    const archTop = tly - b.tileH * 1.25;
    ctx.beginPath();
    ctx.moveTo(ex0, tly);
    ctx.lineTo(ex0, archTop + (ex1 - ex0) / 2);
    ctx.arc((ex0 + ex1) / 2, archTop + (ex1 - ex0) / 2, (ex1 - ex0) / 2, Math.PI, 0);
    ctx.lineTo(ex1, tly);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, archTop, 0, tly);
    lg.addColorStop(0, '#fff2c4');
    lg.addColorStop(1, '#ffb347');
    fillStroke(ctx, lg, 5);
    ctx.strokeStyle = '#6d4c9a';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    // open doors
    for (const s of [-1, 1]) {
      const dx = s < 0 ? ex0 : ex1;
      poly(ctx, [dx, tly, dx, archTop + 20, dx + s * 18, archTop + 30, dx + s * 18, tly + 4]);
      fillStroke(ctx, C.wood, 3);
    }

    // ---- side walls
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? tlx : trx;
      const x1 = s < 0 ? blx : brx;
      ctx.beginPath();
      ctx.moveTo(x0, tly);
      ctx.lineTo(s < 0 ? 0 : W, tly);
      ctx.lineTo(s < 0 ? 0 : W, bly + 40);
      ctx.lineTo(x1, bly);
      ctx.closePath();
      ctx.fillStyle = '#1f1430';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0, tly);
      ctx.lineTo(x1, bly);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#4a3070';
      ctx.stroke();
    }

    // ---- floor tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = b.idx(c, r);
        const tt = b.tiles[i] as Tile;
        if (tt === Tile.Pit) {
          this.quadPath(ctx, b, c, r, c + 1, r + 1);
          ctx.fillStyle = '#05020a';
          ctx.fill();
          this.quadPath(ctx, b, c + 0.08, r + 0.06, c + 0.92, r + 0.94);
          const g = ctx.createLinearGradient(0, b.rowY(r), 0, b.rowY(r + 1));
          g.addColorStop(0, '#140a22');
          g.addColorStop(1, '#000000');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#3b2a55';
          ctx.stroke();
          continue;
        }
        if (tt === Tile.Lava) {
          this.quadPath(ctx, b, c, r, c + 1, r + 1);
          const g = ctx.createLinearGradient(0, b.rowY(r), 0, b.rowY(r + 1));
          g.addColorStop(0, C.lavaDeep);
          g.addColorStop(1, C.lava);
          ctx.fillStyle = g;
          ctx.fill();
          continue;
        }
        if (tt === Tile.Water) {
          this.quadPath(ctx, b, c, r, c + 1, r + 1);
          ctx.fillStyle = '#1d5fa8';
          ctx.fill();
          this.quadPath(ctx, b, c + 0.05, r + 0.05, c + 0.95, r + 0.95);
          ctx.fillStyle = C.water;
          ctx.fill();
          continue;
        }
        // floor stone
        this.quadPath(ctx, b, c, r, c + 1, r + 1);
        ctx.fillStyle = C.floorEdge;
        ctx.fill();
        this.quadPath(ctx, b, c + 0.04, r + 0.04, c + 0.96, r + 0.96);
        ctx.fillStyle = (c + r) % 2 ? C.floorA : C.floorB;
        ctx.fill();
        // bevel highlight
        this.quadPath(ctx, b, c + 0.1, r + 0.1, c + 0.9, r + 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fill();
        // details
        const h = this.hash(i, w.opts.seed % 97);
        const [mx, my] = this.corner(b, c + 0.5, r + 0.5);
        const k = b.pxPerTile(r + 0.5) / REF_TILE;
        if (h < 0.12) {
          // crack
          ctx.strokeStyle = 'rgba(15,6,25,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mx - 20 * k, my - 10 * k);
          ctx.lineTo(mx - 6 * k, my - 2 * k);
          ctx.lineTo(mx + 2 * k, my - 12 * k);
          ctx.lineTo(mx + 18 * k, my + 4 * k);
          ctx.stroke();
        } else if (h < 0.18) {
          // little bone
          ctx.save();
          ctx.translate(mx + 12 * k, my + 8 * k);
          ctx.rotate(h * 30);
          roundRectPath(ctx, -9 * k, -2 * k, 18 * k, 4 * k, 2);
          fillStroke(ctx, '#cbbfa6', 1.5);
          ctx.restore();
        } else if (h < 0.24) {
          ellipse(ctx, mx - 10 * k, my + 6 * k, 12 * k, 6 * k);
          ctx.fillStyle = 'rgba(90,160,60,0.28)';
          ctx.fill();
        } else if (h < 0.27) {
          // tiny skull
          circle(ctx, mx, my, 7 * k);
          fillStroke(ctx, '#d6cbb3', 1.6);
          ctx.fillStyle = C.ink;
          circle(ctx, mx - 2.4 * k, my - 0.5 * k, 1.6 * k);
          ctx.fill();
          circle(ctx, mx + 2.4 * k, my - 0.5 * k, 1.6 * k);
          ctx.fill();
        }
      }
    }
    // lava glow onto neighbours
    for (let i = 0; i < b.tiles.length; i++) {
      if (b.tiles[i] !== Tile.Lava) continue;
      const [mx, my] = this.corner(b, b.col(i) + 0.5, b.row(i) + 0.5);
      const g = ctx.createRadialGradient(mx, my, 10, mx, my, b.tileW * 1.1);
      g.addColorStop(0, 'rgba(255,120,30,0.25)');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - b.tileW * 1.2, my - b.tileW * 1.2, b.tileW * 2.4, b.tileW * 2.4);
    }

    // ---- front lip with exit stairs
    const lip = b.tileH * 0.35;
    ctx.beginPath();
    ctx.moveTo(blx, bly);
    ctx.lineTo(brx, bly);
    ctx.lineTo(brx, bly + lip);
    ctx.lineTo(blx, bly + lip);
    ctx.closePath();
    ctx.fillStyle = '#24163a';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    const [sx0] = this.corner(b, b.exit + 0.05, ROWS);
    const [sx1] = this.corner(b, b.exit + 0.95, ROWS);
    for (let i = 0; i < 3; i++) {
      const y = bly + i * (lip / 3);
      roundRectPath(ctx, sx0 - i * 3, y, sx1 - sx0 + i * 6, lip / 3 + 2, 2);
      fillStroke(ctx, i % 2 ? '#5d3f86' : '#6d4c9a', 2.5);
    }
    // red carpet down the exit tile
    this.quadPath(ctx, b, b.exit + 0.22, ROWS - 1, b.exit + 0.78, ROWS);
    ctx.fillStyle = withAlpha(C.crimson, 0.75);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // =============================================================== frame
  render(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts, pose: BossPose): void {
    this.ensureCache(w, o);
    const b = w.board;
    if (this.cache) ctx.drawImage(this.cache, 0, 0, this.cache.width, this.cache.height, 0, 0, o.W, o.H);
    this.drawAnimatedTiles(ctx, w, o);
    // floor traps
    for (const trap of w.traps) this.drawTrapFloorAt(ctx, w, trap, o);
    // build overlays
    if (o.build) this.drawBuildOverlay(ctx, w, o);
    // zones (ground)
    this.drawZones(ctx, w, o, false);
    // shadows
    for (const h of w.heroes) if (h.state !== 'dead' && h.state !== 'gone' && h.state !== 'respawn' && h.y < ROWS + 0.3) this.shadow(ctx, b, h.x, h.y, 16 * h.scale * CHAR, h.z);
    for (const m of w.monsters) if (m.alive) this.shadow(ctx, b, m.x, m.y, (m.kind === 'ogre' ? 28 : 15) * CHAR, m.kind === 'bats' ? 0.6 : 0);

    // y-sorted pass
    const items: Sortable[] = [];
    for (let i = 0; i < b.tiles.length; i++) {
      const tt = b.tiles[i] as Tile;
      if (tt === Tile.Wall || tt === Tile.Pillar) {
        const c = b.col(i), r = b.row(i);
        items.push({ key: r + 0.999, draw: () => this.drawBlock(ctx, w, c, r, tt, o) });
      }
    }
    for (const trap of w.traps) {
      if (trap.kind === 'axe' || trap.kind === 'mimic') items.push({ key: trap.cy + 0.3, draw: () => this.drawTrapTallAt(ctx, w, trap, o) });
    }
    for (const m of w.monsters) if (m.alive) items.push({ key: m.y + (m.kind === 'bats' ? 0.5 : 0), draw: () => this.drawMonsterAt(ctx, w, m, o) });
    const throne: Hero[] = [];
    for (const h of w.heroes) {
      if (h.state === 'dead' || h.state === 'gone' || h.state === 'respawn') continue;
      if (h.y >= ROWS - 0.05 || h.state === 'flung') throne.push(h);
      else items.push({ key: h.y, draw: () => this.drawHeroAt(ctx, w, h, o) });
    }
    items.sort((a, c) => a.key - c.key);
    for (const it of items) it.draw();

    this.drawZones(ctx, w, o, true);
    // boss + heroes that reached it
    if (o.drawBoss) drawBoss(ctx, w.opts.bossId, o.bossX, o.bossY, o.bossScale, pose);
    for (const h of throne) this.drawHeroAt(ctx, w, h, o);

    this.drawProjectiles(ctx, w, o);
    this.drawSlashes(ctx, w);
    drawParticles(ctx, w.particles);
    // hold aim reticle
    if (o.holdX !== undefined && o.holdY !== undefined) this.drawHoldReticle(ctx, w, o);
    // bubbles & name tags on top
    for (const h of w.heroes) this.drawHeroTop(ctx, w, h, o);
    drawFloatTexts(ctx, w.texts);
  }

  private shadow(ctx: CanvasRenderingContext2D, b: Board, x: number, y: number, r: number, z: number): void {
    const p = b.project(x, y, this.pt);
    const k = b.pxPerTile(y) / REF_TILE;
    const s = 1 / (1 + z * 0.6);
    ellipse(ctx, p.x, p.y, r * k * s, r * 0.42 * k * s);
    ctx.fillStyle = 'rgba(5,0,12,0.4)';
    ctx.fill();
  }

  private drawAnimatedTiles(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts): void {
    const b = w.board;
    const t = o.t;
    for (let i = 0; i < b.tiles.length; i++) {
      const tt = b.tiles[i];
      if (tt !== Tile.Lava && tt !== Tile.Water) continue;
      const c = b.col(i), r = b.row(i);
      const k = b.pxPerTile(r + 0.5) / REF_TILE;
      const p = b.project(c + 0.5, r + 0.5, this.pt);
      if (tt === Tile.Lava) {
        for (let j = 0; j < 3; j++) {
          const ph = (t * 0.4 + this.hash(i, j)) % 1;
          const bx = p.x + (this.hash(i, j + 5) - 0.5) * 60 * k;
          const by = p.y + (this.hash(i, j + 9) - 0.5) * 36 * k;
          ellipse(ctx, bx, by, (6 + ph * 10) * k, (4 + ph * 6) * k);
          ctx.fillStyle = withAlpha(C.lavaHi, 0.8 * (1 - ph));
          ctx.fill();
        }
        const fl = 0.15 + Math.sin(t * 3 + i) * 0.08;
        this.quadPath(ctx, b, c, r, c + 1, r + 1);
        ctx.fillStyle = `rgba(255,220,80,${fl})`;
        ctx.fill();
      } else {
        ctx.strokeStyle = withAlpha(C.waterHi, 0.55);
        ctx.lineWidth = 2;
        for (let j = 0; j < 2; j++) {
          const ph = (t * 0.5 + this.hash(i, j)) % 1;
          ellipse(ctx, p.x + (j - 0.5) * 24 * k, p.y + (j - 0.5) * 10 * k, (8 + ph * 22) * k, (4 + ph * 10) * k);
          ctx.globalAlpha = 1 - ph;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    // torches on the back wall
    const [tlx, tly] = this.corner(b, 0, 0);
    const [trx] = this.corner(b, COLS, 0);
    const ty = tly - b.tileH * 0.95;
    for (const tx of [tlx + (trx - tlx) * 0.05, tlx + (trx - tlx) * 0.38, tlx + (trx - tlx) * 0.62, tlx + (trx - tlx) * 0.95]) {
      if (Math.abs(tx - b.project(b.entrance + 0.5, 0).x) < b.tileW * 0.8) continue;
      roundRectPath(ctx, tx - 4, ty, 8, 20, 3);
      fillStroke(ctx, C.woodDark, 2);
      const g = ctx.createRadialGradient(tx, ty - 6, 2, tx, ty - 6, 46);
      g.addColorStop(0, 'rgba(255,180,60,0.45)');
      g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(tx - 50, ty - 56, 100, 100);
      const f = Math.sin(t * 13 + tx) * 2;
      ctx.beginPath();
      ctx.moveTo(tx - 7, ty);
      ctx.quadraticCurveTo(tx - 8, ty - 12, tx + f, ty - 22 - Math.abs(f) * 2);
      ctx.quadraticCurveTo(tx + 8, ty - 12, tx + 7, ty);
      ctx.closePath();
      fillStroke(ctx, C.fire, 2);
      ellipse(ctx, tx, ty - 6, 3.5, 6);
      ctx.fillStyle = C.fireHi;
      ctx.fill();
    }
  }

  private drawBlock(ctx: CanvasRenderingContext2D, w: World, c: number, r: number, tt: Tile, o: RenderOpts): void {
    const b = w.board;
    const pillar = tt === Tile.Pillar;
    const k = b.pxPerTile(r + 0.5) / REF_TILE;
    const h = (pillar ? 64 : 34) * k;
    const top = pillar ? C.pillarTop : C.wallTop;
    const front = pillar ? C.pillarFront : C.wallFront;
    const inset = pillar ? 0.12 : 0.03;
    // front face
    const [ax, ay] = this.corner(b, c + inset, r + 1 - inset);
    const [bx, by] = this.corner(b, c + 1 - inset, r + 1 - inset);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by - h);
    ctx.lineTo(ax, ay - h);
    ctx.closePath();
    fillStroke(ctx, front, 3);
    if (!pillar) {
      // bricks
      ctx.strokeStyle = shade(front, -0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay - h / 2);
      ctx.lineTo(bx, by - h / 2);
      const mx = (ax + bx) / 2;
      ctx.moveTo(mx, ay - h / 2);
      ctx.lineTo(mx, ay);
      ctx.moveTo(ax + (bx - ax) * 0.25, ay - h);
      ctx.lineTo(ax + (bx - ax) * 0.25, ay - h / 2);
      ctx.moveTo(ax + (bx - ax) * 0.75, ay - h);
      ctx.lineTo(ax + (bx - ax) * 0.75, ay - h / 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = shade(front, -0.3);
      ctx.lineWidth = 2;
      for (const f of [0.33, 0.66]) {
        ctx.beginPath();
        ctx.moveTo(ax + (bx - ax) * f, ay);
        ctx.lineTo(ax + (bx - ax) * f, ay - h);
        ctx.stroke();
      }
    }
    // top face
    this.quadPath(ctx, b, c + inset, r + inset, c + 1 - inset, r + 1 - inset, h);
    fillStroke(ctx, top, 3);
    this.quadPath(ctx, b, c + inset + 0.08, r + inset + 0.08, c + 1 - inset - 0.08, r + 0.45, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    // selected (sell / info)
    if (o.build && o.selectedTile === b.idx(c, r)) {
      this.quadPath(ctx, b, c, r, c + 1, r + 1, h);
      ctx.strokeStyle = C.goldHi;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  private drawTrapFloorAt(ctx: CanvasRenderingContext2D, w: World, trap: Trap, o: RenderOpts): void {
    const b = w.board;
    const p = b.project(trap.cx, trap.cy, this.pt);
    const k = b.pxPerTile(trap.cy) / REF_TILE;
    const sq = 1 + trap.squash.value * 0.05;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(k * sq, k / sq);
    if (!trap.active) ctx.globalAlpha = 0.55;
    drawTrapFloor(ctx, trap.kind, trap.level, trap.anim, o.t, { aim: trap.aim, chew: trap.chew, active: trap.active });
    ctx.globalAlpha = 1;
    if (trap.kind !== 'axe' && trap.kind !== 'mimic') drawTrapStatus(ctx, trap);
    ctx.restore();
    if (o.build && o.selectedTile === trap.tile) this.tileHighlight(ctx, b, trap.tile, C.goldHi);
  }

  private drawTrapTallAt(ctx: CanvasRenderingContext2D, w: World, trap: Trap, o: RenderOpts): void {
    const b = w.board;
    const p = b.project(trap.cx, trap.cy, this.pt);
    const k = b.pxPerTile(trap.cy) / REF_TILE;
    const sq = 1 + trap.squash.value * 0.05;
    ctx.save();
    ctx.translate(p.x, p.y + 8 * k);
    ctx.scale(k * sq, k / sq);
    if (!trap.active) ctx.globalAlpha = 0.55;
    drawTrapTall(ctx, trap, o.t);
    ctx.globalAlpha = 1;
    ctx.translate(0, -8);
    drawTrapStatus(ctx, trap);
    ctx.restore();
  }

  tileHighlight(ctx: CanvasRenderingContext2D, b: Board, tile: number, color: string, fill = false): void {
    const c = b.col(tile), r = b.row(tile);
    this.quadPath(ctx, b, c + 0.02, r + 0.02, c + 0.98, r + 0.98);
    if (fill) {
      ctx.fillStyle = withAlpha(color, 0.3);
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  private drawBuildOverlay(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts): void {
    const b = w.board;
    // animated hero route preview
    const path = b.shortestPath();
    if (path.length > 1) {
      ctx.save();
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = -o.t * 40;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,240,180,0.45)';
      ctx.beginPath();
      const e = b.project(b.entrance + 0.5, -0.2);
      ctx.moveTo(e.x, e.y);
      for (const i of path) {
        const p = b.project(b.col(i) + 0.5, b.row(i) + 0.5, this.pt);
        ctx.lineTo(p.x, p.y);
      }
      const x = b.project(b.exit + 0.5, ROWS + 0.3);
      ctx.lineTo(x.x, x.y);
      ctx.stroke();
      ctx.restore();
      text(ctx, tr('hud.tilesPath', { n: path.length }), b.cx, b.top - 14, { size: 18, color: '#ffe9b0', lw: 4 });
    }
    if (o.hoverTile >= 0 && o.hoverId) {
      this.tileHighlight(ctx, b, o.hoverTile, o.hoverOk ? C.uiGood : C.crimsonHi, true);
      if (o.hoverOk && o.hoverId in TRAPS) {
        const c = b.col(o.hoverTile) + 0.5, r = b.row(o.hoverTile) + 0.5;
        const p = b.project(c, r, this.pt);
        const k = b.pxPerTile(r) / REF_TILE;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.translate(p.x, p.y);
        ctx.scale(k, k);
        drawTrapFloor(ctx, o.hoverId as never, 1, 9, o.t);
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- zones
  private drawZones(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts, top: boolean): void {
    const b = w.board;
    for (const z of w.zones) {
      const p = b.project(z.x, z.y, this.pt);
      const R = z.r * b.pxPerTile(z.y);
      const life = clamp(1 - z.t / z.dur, 0, 1);
      if (!top && z.kind === 'gas') {
        const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, R);
        g.addColorStop(0, `rgba(156,255,79,${0.35 * Math.min(1, life * 3)})`);
        g.addColorStop(1, 'rgba(156,255,79,0)');
        ctx.fillStyle = g;
        ellipse(ctx, p.x, p.y, R, R * 0.75);
        ctx.fill();
      } else if (!top && z.kind === 'burn') {
        ellipse(ctx, p.x, p.y, R, R * 0.7);
        ctx.fillStyle = `rgba(255,110,30,${0.25 * life})`;
        ctx.fill();
      } else if (!top && z.kind === 'slimepool') {
        ellipse(ctx, p.x, p.y, R, R * 0.7);
        fillStroke(ctx, withAlpha(C.slime, 0.6 * Math.min(1, life * 4)), 2, '#14401c');
      } else if (top && z.kind === 'blackhole') {
        const spin = o.t * 5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, R * (0.9 - i * 0.25), R * 0.6 * (0.9 - i * 0.25), spin + i, 0, Math.PI * 1.4);
          ctx.strokeStyle = withAlpha(i % 2 ? '#d7b3ff' : C.dark, 0.8);
          ctx.lineWidth = 6 - i;
          ctx.stroke();
        }
        circle(ctx, p.x, p.y, R * 0.22);
        fillStroke(ctx, '#000000', 4, '#d7b3ff');
      } else if (top && z.kind === 'tentacle') {
        const k = b.pxPerTile(z.y) / REF_TILE;
        const rise = Math.sin(clamp(z.t / z.dur, 0, 1) * Math.PI);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(k, k);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(30 * rise, -60 * rise, -10, -110 * rise);
        ctx.lineWidth = 26;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        ctx.lineWidth = 19;
        ctx.strokeStyle = '#2f7fd8';
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------- entities
  private heroLook(h: Hero): HeroLook {
    return {
      cls: h.cls, mods: [...h.mods], superId: h.superId, tunic: h.spec.tunic, skin: h.spec.skin, hair: h.spec.hair,
      seed: h.spec.seed, gender: h.spec.gender, lives: h.lives, heads: h.heads.length ? h.heads.map((x) => x.alive) : undefined,
    };
  }

  heroSpriteKey(h: Hero): string {
    const expr = h.ally ? 'angry' : h.disabled ? 'scared' : h.expr;
    return ensureHeroSprite(this.heroLook(h), expr);
  }

  private drawHeroAt(ctx: CanvasRenderingContext2D, w: World, h: Hero, o: RenderOpts): void {
    const b = w.board;
    const p = b.project(h.x, h.y, this.pt);
    const px = b.pxPerTile(clamp(h.y, -1, ROWS + 1));
    let k = (px / REF_TILE) * h.scale * CHAR;
    let alpha = 1;
    let sinkY = 0;
    if (h.state === 'eaten') {
      k *= Math.max(0.05, 1 - h.stateT / 0.45);
      sinkY = h.stateT * 30;
    } else if (h.state === 'fall') {
      k *= Math.max(0.05, 1 - h.stateT / 0.45);
      sinkY = h.stateT * 40;
      alpha = 1 - h.stateT / 0.5;
    }
    let pop = 1;
    if (h.spawnPop > 0) pop = easeOutBack(clamp(1 - h.spawnPop / 0.35, 0, 1), 2.5);
    const moving = h.state === 'walk' || h.state === 'flee' || h.state === 'possessed' || (h.state === 'throne' && h.isSuper);
    const bob = moving && !h.disabled ? Math.abs(Math.sin(h.walkPhase)) * 5 * k : 0;
    const sq = h.squash.value + (moving ? Math.sin(h.walkPhase * 2) * 0.6 : 0);
    const sx = (1 + sq * 0.06) * pop * k;
    const sy = (1 - sq * 0.06) * pop * k;
    const z = h.z * px * 0.8;
    const baseY = p.y - z + sinkY;
    let rot = h.rot;
    // speedrunner backflips
    if (h.flip > 0 && h.state !== 'flung') rot = -(1 - h.flip) * TAU;
    if (h.state === 'argue') rot = Math.sin(o.t * 25) * 0.06;
    ctx.globalAlpha = alpha;
    // auras
    if (h.superId === 'chosen' && h.plotArmor) {
      const g = ctx.createRadialGradient(p.x, baseY - 30 * k, 4, p.x, baseY - 30 * k, 60 * k);
      g.addColorStop(0, 'rgba(255,236,140,0.55)');
      g.addColorStop(1, 'rgba(255,236,140,0)');
      ctx.fillStyle = g;
      circle(ctx, p.x, baseY - 30 * k, 60 * k);
      ctx.fill();
    }
    if (h.ally) {
      circle(ctx, p.x, baseY - 28 * k, 34 * k);
      ctx.fillStyle = 'rgba(163,92,255,0.25)';
      ctx.fill();
    }
    // legs
    ctx.save();
    ctx.translate(p.x, baseY - bob);
    ctx.scale(sx * h.facing, sy);
    if (rot) {
      ctx.translate(0, -24);
      ctx.rotate(rot * h.facing);
      ctx.translate(0, 24);
    }
    const sw = moving && !h.disabled ? Math.sin(h.walkPhase) * 5 : 0;
    const legCol = h.has('chicken') ? '#ffb31a' : '#2a1d3a';
    for (const s of [-1, 1]) {
      roundRectPath(ctx, s * 4.5 - 2.6 + sw * s, -8, 5.2, 9 + (s * sw > 0 ? -1 : 0), 2.4);
      fillStroke(ctx, legCol, 2);
    }
    ctx.restore();
    const key = this.heroSpriteKey(h);
    sprites.draw(ctx, key, p.x, baseY - bob, sx * h.facing, sy, rot);
    if (h.flash > 0) sprites.drawTinted(ctx, key, '#ffffff', p.x, baseY - bob, sx * h.facing, sy, rot, Math.min(1, h.flash * 9));
    else if (h.freezeT > 0) sprites.drawTinted(ctx, key, '#8fe8ff', p.x, baseY - bob, sx * h.facing, sy, rot, 0.45);
    else if (h.burnT > 0) sprites.drawTinted(ctx, key, '#ff6a1a', p.x, baseY - bob, sx * h.facing, sy, rot, 0.18 + Math.sin(o.t * 20) * 0.08);
    else if (h.poisonT > 0) sprites.drawTinted(ctx, key, '#9cff4f', p.x, baseY - bob, sx * h.facing, sy, rot, 0.22);
    else if (h.invuln > 0 && Math.floor(o.t * 20) % 2 === 0) sprites.drawTinted(ctx, key, '#fff4c2', p.x, baseY - bob, sx * h.facing, sy, rot, 0.6);
    ctx.globalAlpha = 1;

    // shield bubble
    if (h.shieldT > 0) {
      circle(ctx, p.x, baseY - 32 * k, 40 * k);
      ctx.fillStyle = 'rgba(77,184,255,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,220,255,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // freeze cube
    if (h.freezeT > 0) {
      roundRectPath(ctx, p.x - 24 * k, baseY - 62 * k, 48 * k, 64 * k, 8 * k);
      ctx.fillStyle = 'rgba(160,235,255,0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,250,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // streamer drone
    if (h.has('streamer')) {
      const dx = p.x + 22 * k + Math.sin(o.t * 2 + h.id) * 6, dy = baseY - 72 * k + Math.sin(o.t * 3.1) * 4;
      roundRectPath(ctx, dx - 9, dy - 5, 18, 10, 4);
      fillStroke(ctx, '#3a3a4a', 2);
      ctx.fillStyle = 'rgba(200,200,220,0.5)';
      ctx.fillRect(dx - 15, dy - 9, 10, 2);
      ctx.fillRect(dx + 5, dy - 9, 10, 2);
      circle(ctx, dx, dy + 1, 2.4);
      ctx.fillStyle = Math.floor(o.t * 3) % 2 ? '#ff3b3b' : '#771111';
      ctx.fill();
    }
    // stun stars
    if (h.stunT > 0 && h.alive) {
      for (let i = 0; i < 3; i++) {
        const a = o.t * 6 + (i * TAU) / 3;
        const sxp = p.x + Math.cos(a) * 14 * k, syp = baseY - 58 * k * h.scale / h.scale + Math.sin(a) * 4;
        ctx.fillStyle = C.goldHi;
        ctx.beginPath();
        ctx.arc(sxp, syp, 3.2, 0, TAU);
        ctx.fill();
      }
    }
    // HP bar
    if (h.alive && h.hp < h.maxHp && !h.isSuper && h.state !== 'flung') {
      const bw = 34 * Math.max(0.8, k), bh = 5;
      const bx = p.x - bw / 2, by = baseY - 62 * k - bob - 6;
      roundRectPath(ctx, bx - 1, by - 1, bw + 2, bh + 2, 3);
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.fillStyle = h.hp / h.maxHp > 0.35 ? '#7dff3a' : '#ff4d6d';
      ctx.fillRect(bx, by, bw * clamp(h.hp / h.maxHp, 0, 1), bh);
    }
  }

  private drawHeroTop(ctx: CanvasRenderingContext2D, w: World, h: Hero, o: RenderOpts): void {
    if (h.state === 'dead' || h.state === 'gone' || h.state === 'respawn') return;
    const b = w.board;
    const p = b.project(h.x, h.y, this.pt);
    const k = (b.pxPerTile(clamp(h.y, -1, ROWS + 1)) / REF_TILE) * h.scale * CHAR;
    const top = p.y - h.z * b.pxPerTile(h.y) * 0.8 - 66 * k;
    if (h.bubble) {
      const a = Math.min(1, h.bubble.t * 4);
      bubble(ctx, h.bubble.text, p.x, top - 4, a, 16, 190);
    } else if ((h.t < 2.6 && (h.mods.size > 0 || h.spec.returning)) || h.isSuper) {
      text(ctx, h.name, p.x, top - 6, { size: h.isSuper ? 18 : 14, color: h.isSuper ? C.goldHi : '#ffe9b0', lw: 3.5, maxWidth: 220 });
    }
    if (h.has('speedrunner') && h.alive && h.superId !== 'speedguild') {
      const tm = h.t;
      const s = `${Math.floor(tm / 60)}:${(tm % 60).toFixed(2).padStart(5, '0')}`;
      text(ctx, s, p.x, top + 10 + (h.bubble ? 0 : 12), { size: 12, color: '#7dff3a', lw: 3 });
    }
    if (h.superId === 'chosen' && h.plotArmor) {
      const types = ['phys', 'fire', 'poison', 'dark', 'fall'] as const;
      const got = [...h.dmgTypes];
      for (let i = 0; i < 3; i++) {
        const ix = p.x - 26 + i * 26, iy = top - 30;
        circle(ctx, ix, iy, 10);
        fillStroke(ctx, i < got.length ? C.gold : '#3a2a4a', 3);
        if (i < got.length) text(ctx, tr('dmg.' + got[i]).charAt(0), ix, iy + 1, { size: 13, color: C.ink, lw: 0, shadow: false });
      }
      void types;
    }
    if (h.superId === 'player') {
      // floating cursor
      const cx = p.x + 18, cy = top - 8 + Math.sin(o.t * 4) * 3;
      poly(ctx, [cx, cy, cx, cy + 18, cx + 5, cy + 13, cx + 9, cy + 21, cx + 12, cy + 19, cx + 8, cy + 12, cx + 14, cy + 12]);
      fillStroke(ctx, '#ffffff', 2);
    }
  }

  private drawMonsterAt(ctx: CanvasRenderingContext2D, w: World, m: Monster, o: RenderOpts): void {
    const b = w.board;
    const fly = m.kind === 'bats' ? 0.5 + Math.sin(o.t * 4 + m.t) * 0.1 : 0;
    const p = b.project(m.x, m.y, this.pt);
    const k = (b.pxPerTile(m.y) / REF_TILE) * CHAR * 0.92;
    const kind = m.minionKind === 'skeleton' ? 'skeleton' : m.minionKind === 'goblin' ? 'minigob' : m.minionKind === 'slimeling' ? 'slimeling' : m.kind;
    const frame = m.kind === 'bats' ? Math.floor(o.t * 10 + m.t) % 2 : 0;
    const lvl = m.den?.level ?? 1;
    const key = ensureMonster(kind, lvl, frame);
    const bob = Math.abs(Math.sin(m.walkPhase)) * 3 * k;
    const sq = m.squash.value;
    const sx = (1 + sq * 0.06) * k * m.facing;
    const sy = (1 - sq * 0.06) * k;
    const y = p.y - fly * b.pxPerTile(m.y) - bob;
    if (m.evolveFx > 0) {
      const g = ctx.createRadialGradient(p.x, y - 30 * k, 2, p.x, y - 30 * k, 60 * k);
      g.addColorStop(0, `rgba(125,255,58,${m.evolveFx * 0.5})`);
      g.addColorStop(1, 'rgba(125,255,58,0)');
      ctx.fillStyle = g;
      circle(ctx, p.x, y - 30 * k, 60 * k);
      ctx.fill();
    }
    const breathe = 1 + Math.sin(o.t * 3 + m.t) * 0.02;
    sprites.draw(ctx, key, p.x, y, sx, sy * breathe);
    if (m.flash > 0) sprites.drawTinted(ctx, key, '#ffffff', p.x, y, sx, sy * breathe, 0, 0.8);
    if (m.friendT > 0) {
      ctx.fillStyle = '#ff6fb5';
      text(ctx, '♥', p.x, y - 56 * k, { size: 20, color: '#ff6fb5', lw: 3 });
    }
    if (m.hp < m.maxHp) {
      const bw = 28 * k, by = y - 58 * k * (m.kind === 'ogre' ? 1.8 : 1);
      ctx.fillStyle = C.ink;
      ctx.fillRect(p.x - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#ff9db0';
      ctx.fillRect(p.x - bw / 2, by, bw * clamp(m.hp / m.maxHp, 0, 1), 4);
    }
    if (o.build && m.den && o.selectedTile === m.den.tile) this.tileHighlight(ctx, b, m.den.tile, C.goldHi);
  }

  // ---------------------------------------------------------- projectiles
  private drawProjectiles(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts): void {
    const b = w.board;
    for (const pr of w.projectiles) {
      const p = b.project(pr.x, pr.y, this.pt);
      const px = b.pxPerTile(clamp(pr.y, -1, ROWS + 2));
      const y = p.y - pr.z * px * 0.8;
      switch (pr.kind) {
        case 'fireball':
        case 'meteor': {
          const r = pr.kind === 'meteor' ? 16 : 18;
          const g = ctx.createRadialGradient(p.x, y, 2, p.x, y, r * 2.2);
          g.addColorStop(0, 'rgba(255,240,150,0.9)');
          g.addColorStop(1, 'rgba(255,120,30,0)');
          ctx.fillStyle = g;
          circle(ctx, p.x, y, r * 2.2);
          ctx.fill();
          circle(ctx, p.x, y, r);
          fillStroke(ctx, pr.kind === 'meteor' ? '#7a3a1a' : C.fire, 3);
          circle(ctx, p.x - 4, y - 4, r * 0.45);
          ctx.fillStyle = C.fireHi;
          ctx.fill();
          w.particles.spawn('fire', p.x, y, { life: 0.25, size: r * 0.8, size2: 2, color: C.fire, vy: -20 });
          break;
        }
        case 'arrow':
        case 'heroArrow': {
          const a = Math.atan2(pr.y1 - pr.y0, pr.x1 - pr.x0);
          ctx.save();
          ctx.translate(p.x, y);
          ctx.rotate(a);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(10, 0);
          ctx.stroke();
          ctx.strokeStyle = pr.kind === 'arrow' ? C.bone : C.wood;
          ctx.lineWidth = 2;
          ctx.stroke();
          poly(ctx, [10, -4, 16, 0, 10, 4]);
          fillStroke(ctx, C.steel, 1.5);
          ctx.restore();
          break;
        }
        case 'bolt':
        case 'heroBolt':
        case 'dark':
        case 'spit': {
          const col = pr.kind === 'dark' ? C.dark : pr.kind === 'spit' ? C.slime : '#7fe9ff';
          circle(ctx, p.x, y, 8);
          fillStroke(ctx, col, 2.5);
          circle(ctx, p.x, y, 3.5);
          ctx.fillStyle = '#fff';
          ctx.fill();
          break;
        }
      }
    }
    void o;
  }

  private drawSlashes(ctx: CanvasRenderingContext2D, w: World): void {
    const b = w.board;
    for (const s of w.slashes) {
      const k = s.t / 0.35;
      const a = b.project(s.ax, s.ay);
      const c = b.project(s.bx, s.by);
      const dx = c.x - a.x, dy = c.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const grow = Math.min(1, k * 4);
      for (let i = -1; i <= 1; i++) {
        const ox = nx * i * 16, oy = ny * i * 16;
        ctx.beginPath();
        ctx.moveTo(a.x + ox, a.y + oy);
        ctx.quadraticCurveTo((a.x + c.x) / 2 + ox + nx * 14, (a.y + c.y) / 2 + oy + ny * 14, a.x + dx * grow + ox, a.y + dy * grow + oy);
        ctx.lineCap = 'round';
        ctx.strokeStyle = withAlpha('#2a0010', 1 - k);
        ctx.lineWidth = 14 * (1 - k * 0.6);
        ctx.stroke();
        ctx.strokeStyle = withAlpha(i === 0 ? '#ffffff' : '#ff8fa0', 1 - k);
        ctx.lineWidth = 7 * (1 - k * 0.6);
        ctx.stroke();
      }
    }
  }

  private drawHoldReticle(ctx: CanvasRenderingContext2D, w: World, o: RenderOpts): void {
    const p = w.board.project(o.holdX!, o.holdY!);
    const ch = clamp(o.charge, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 46, -Math.PI / 2, -Math.PI / 2 + ch * TAU);
    ctx.lineWidth = 8;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = ch >= 1 ? C.goldHi : C.gold;
    ctx.stroke();
  }
}
