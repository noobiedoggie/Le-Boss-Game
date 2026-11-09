import { Rng } from '../core/Rng';
import { clamp } from '../core/math';

export const COLS = 7;
export const ROWS = 12;
export const N_TILES = COLS * ROWS;

export const enum Tile {
  Floor = 0,
  Pillar = 1,
  Pit = 2,
  Lava = 3,
  Water = 4,
  Wall = 5,
}

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [-1, -1, SQRT2],
];

export interface FieldOpts {
  /** Extra cost when entering a tile (Infinity = blocked). */
  cost?: (i: number) => number;
  /** Treat player walls as walkable with this cost (speedrunner glitches). */
  wallCost?: number;
}

/**
 * The dungeon grid + the "tilted board game" projection.
 *
 * Gameplay lives in GRID space (1 unit = 1 tile, x right, y down).
 * The projection narrows the board towards the top (perspective) and
 * foreshortens rows so it reads as a 3/4 top-down board.
 */
export class Board {
  tiles = new Uint8Array(N_TILES);
  entrance = 3;
  exit = 3;
  version = 0;
  private fields = new Map<string, Float32Array>();

  // ---- projection params (logical px)
  top = 120;
  tileW = 92;
  tileH = 72;
  cx = 360;
  readonly sTop = 0.84;
  readonly sBot = 1.0;

  // =============================================================== layout
  /** Fit the board between `top` and `bottom` (logical px). */
  layout(W: number, top: number, bottom: number): void {
    this.cx = W / 2;
    this.top = top;
    const maxW = (W - 40) / COLS;
    const avgS = (this.sTop + this.sBot) / 2;
    const availH = bottom - top;
    this.tileW = Math.min(96, maxW);
    this.tileH = Math.min(this.tileW * 0.8, availH / (ROWS * avgS));
    if (this.tileH < this.tileW * 0.62) this.tileW = Math.min(this.tileW, this.tileH / 0.62);
  }

  get bottomY(): number {
    return this.rowY(ROWS);
  }

  scaleAt(gy: number): number {
    return this.sTop + (this.sBot - this.sTop) * clamp(gy / ROWS, -0.3, 1.4);
  }

  /** Screen Y of a grid row coordinate (integral of the row scale). */
  rowY(gy: number): number {
    const a = (this.sBot - this.sTop) / (2 * ROWS);
    return this.top + this.tileH * (this.sTop * gy + a * gy * gy);
  }

  /** Grid -> screen. Writes into `out` to avoid allocations in hot loops. */
  project(gx: number, gy: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
    out.y = this.rowY(gy);
    out.x = this.cx + (gx - COLS / 2) * this.tileW * this.scaleAt(gy);
    return out;
  }

  /** Screen -> grid (exact inverse of project). */
  unproject(sx: number, sy: number): { gx: number; gy: number } {
    const a = (this.sBot - this.sTop) / (2 * ROWS);
    const b = this.sTop;
    const Y = (sy - this.top) / this.tileH;
    const disc = Math.max(0, b * b + 4 * a * Y);
    const gy = (-b + Math.sqrt(disc)) / (2 * a);
    const gx = (sx - this.cx) / (this.tileW * this.scaleAt(gy)) + COLS / 2;
    return { gx, gy };
  }

  /** Screen size of one tile unit at a given row (for scaling sprites). */
  pxPerTile(gy: number): number {
    return this.tileW * this.scaleAt(gy);
  }

  // ================================================================ tiles
  idx(c: number, r: number): number {
    return r * COLS + c;
  }
  col(i: number): number {
    return i % COLS;
  }
  row(i: number): number {
    return (i / COLS) | 0;
  }
  inBounds(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }
  get(c: number, r: number): Tile {
    if (!this.inBounds(c, r)) return Tile.Pillar;
    return this.tiles[r * COLS + c] as Tile;
  }
  walkableT(t: Tile): boolean {
    return t === Tile.Floor || t === Tile.Water;
  }
  walkable(c: number, r: number): boolean {
    return this.inBounds(c, r) && this.walkableT(this.tiles[r * COLS + c] as Tile);
  }
  tileAtGrid(gx: number, gy: number): number {
    const c = Math.floor(gx), r = Math.floor(gy);
    if (!this.inBounds(c, r)) return -1;
    return r * COLS + c;
  }
  get entranceIdx(): number {
    return this.idx(this.entrance, 0);
  }
  get exitIdx(): number {
    return this.idx(this.exit, ROWS - 1);
  }

  set(i: number, t: Tile): void {
    this.tiles[i] = t;
    this.changed();
  }

  changed(): void {
    this.version++;
    this.fields.clear();
  }

  // ========================================================== generation
  /**
   * Procedural layout: pillars, pits, a meandering lava river with bridges,
   * and (for the Kraken) flooded water tiles. Always leaves a valid path.
   */
  generate(rng: Rng, opts: { water?: boolean } = {}): void {
    for (let attempt = 0; attempt < 200; attempt++) {
      this.tiles.fill(Tile.Floor);
      this.entrance = rng.int(1, COLS - 2);
      this.exit = 3;
      const protectedTile = (c: number, r: number) =>
        (r <= 1 && Math.abs(c - this.entrance) <= 1) || (r >= ROWS - 2 && Math.abs(c - this.exit) <= 1) || r === 0 || r === ROWS - 1;

      // Lava river (55%): wavy horizontal band with 1-2 bridges.
      if (rng.chance(0.55)) {
        let r = rng.int(4, 7);
        const bridges = new Set<number>();
        bridges.add(rng.int(0, COLS - 1));
        if (rng.chance(0.6)) bridges.add(rng.int(0, COLS - 1));
        for (let c = 0; c < COLS; c++) {
          if (!bridges.has(c)) this.tiles[this.idx(c, r)] = Tile.Lava;
          if (rng.chance(0.25) && c < COLS - 1) {
            const nr = clamp(r + (rng.chance(0.5) ? 1 : -1), 3, 8);
            if (!bridges.has(c)) this.tiles[this.idx(c, nr)] = Tile.Lava;
            r = nr;
          }
        }
      }
      // Pillars (sometimes in pairs).
      const pillars = rng.int(2, 5);
      for (let k = 0; k < pillars; k++) {
        const c = rng.int(0, COLS - 1), r = rng.int(2, ROWS - 3);
        if (protectedTile(c, r)) continue;
        this.tiles[this.idx(c, r)] = Tile.Pillar;
        if (rng.chance(0.35)) {
          const c2 = clamp(c + (rng.chance(0.5) ? 1 : -1), 0, COLS - 1);
          if (!protectedTile(c2, r)) this.tiles[this.idx(c2, r)] = Tile.Pillar;
        }
      }
      // Pits.
      const pits = rng.int(1, 3);
      for (let k = 0; k < pits; k++) {
        const c = rng.int(0, COLS - 1), r = rng.int(2, ROWS - 3);
        if (protectedTile(c, r)) continue;
        if (this.tiles[this.idx(c, r)] === Tile.Floor) this.tiles[this.idx(c, r)] = Tile.Pit;
      }
      // Water ponds (Kraken).
      if (opts.water) {
        const ponds = 3;
        for (let k = 0; k < ponds; k++) {
          let c = rng.int(0, COLS - 1), r = rng.int(1, ROWS - 2);
          const size = rng.int(3, 6);
          for (let s = 0; s < size; s++) {
            if (this.inBounds(c, r) && this.tiles[this.idx(c, r)] === Tile.Floor) this.tiles[this.idx(c, r)] = Tile.Water;
            if (rng.chance(0.5)) c = clamp(c + (rng.chance(0.5) ? 1 : -1), 0, COLS - 1);
            else r = clamp(r + (rng.chance(0.5) ? 1 : -1), 1, ROWS - 2);
          }
        }
      }
      let floors = 0;
      for (let i = 0; i < N_TILES; i++) if (this.walkableT(this.tiles[i] as Tile)) floors++;
      this.changed();
      if (floors >= 56 && this.pathExists()) return;
    }
    // Fallback: empty board.
    this.tiles.fill(Tile.Floor);
    this.changed();
  }

  // ========================================================= pathfinding
  /**
   * Dijkstra distance field towards `goal` (8-dir, no corner cutting).
   * Cached until the board changes. Cheap: 84 nodes.
   */
  field(goal: number, key = 'main', opts: FieldOpts = {}): Float32Array {
    const k = `${key}:${goal}`;
    const cached = this.fields.get(k);
    if (cached) return cached;
    const f = this.computeField(goal, opts);
    this.fields.set(k, f);
    return f;
  }

  passable(i: number, opts: FieldOpts): number {
    const t = this.tiles[i] as Tile;
    if (t === Tile.Floor) return 0;
    if (t === Tile.Water) return 0.5;
    if (t === Tile.Wall && opts.wallCost !== undefined) return opts.wallCost;
    return Infinity;
  }

  private computeField(goal: number, opts: FieldOpts): Float32Array {
    const dist = new Float32Array(N_TILES).fill(Infinity);
    const done = new Uint8Array(N_TILES);
    dist[goal] = 0;
    for (;;) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < N_TILES; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; best = i; }
      if (best < 0) break;
      done[best] = 1;
      const c = best % COLS, r = (best / COLS) | 0;
      for (const [dc, dr, w] of DIRS) {
        const nc = c + dc, nr = r + dr;
        if (!this.inBounds(nc, nr)) continue;
        const ni = nr * COLS + nc;
        if (done[ni]) continue;
        const pc = this.passable(ni, opts);
        if (pc === Infinity) continue;
        if (dc !== 0 && dr !== 0) {
          // no corner cutting
          if (this.passable(r * COLS + nc, opts) === Infinity || this.passable(nr * COLS + c, opts) === Infinity) continue;
        }
        const extra = opts.cost ? opts.cost(ni) : 0;
        if (extra === Infinity) continue;
        const nd = bd + w + pc + extra;
        if (nd < dist[ni]) dist[ni] = nd;
      }
    }
    return dist;
  }

  /** Best neighbour to step to from tile i following a field (or -1). */
  nextStep(i: number, f: Float32Array, opts: FieldOpts = {}, bias = 0): number {
    const c = i % COLS, r = (i / COLS) | 0;
    let best = -1, bd = f[i];
    for (const [dc, dr, w] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!this.inBounds(nc, nr)) continue;
      const ni = nr * COLS + nc;
      if (this.passable(ni, opts) === Infinity) continue;
      if (dc !== 0 && dr !== 0) {
        if (this.passable(r * COLS + nc, opts) === Infinity || this.passable(nr * COLS + c, opts) === Infinity) continue;
      }
      // small per-hero bias spreads crowds between equal routes
      const d = f[ni] + (dc !== 0 && dr !== 0 ? 0.001 : 0) + bias * dc * 0.01 + (w - 1) * 0.0;
      if (d < bd - 1e-4) {
        bd = d;
        best = ni;
      }
    }
    return best;
  }

  /** Is there a walkable path from the entrance to the exit? */
  pathExists(): boolean {
    const f = this.computeField(this.exitIdx, {});
    return f[this.entranceIdx] < Infinity;
  }

  /** Length (in tiles) of the shortest hero route. */
  pathLength(): number {
    const f = this.field(this.exitIdx);
    const d = f[this.entranceIdx];
    return d === Infinity ? 0 : d + 1;
  }

  /** Tiles on the current shortest path (for UI previews). */
  shortestPath(): number[] {
    const f = this.field(this.exitIdx);
    const path: number[] = [];
    let i = this.entranceIdx;
    if (f[i] === Infinity) return path;
    path.push(i);
    for (let guard = 0; guard < N_TILES && i !== this.exitIdx; guard++) {
      const n = this.nextStep(i, f);
      if (n < 0) break;
      path.push(n);
      i = n;
    }
    return path;
  }
}
