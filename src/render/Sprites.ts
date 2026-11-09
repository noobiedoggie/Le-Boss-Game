/**
 * SPRITE LAYER
 * ------------
 * Every visual "thing" in the game is requested by a string key (e.g.
 * "trap.spikes.up.2", "hero|<look>|smug"). By default a key is backed by a
 * procedural drawing function rendered once into an offscreen canvas.
 *
 * To swap in real art later, call `sprites.loadAtlas(image, frames)` with a
 * sprite sheet: any key present in the atlas overrides the procedural version
 * without touching gameplay code.
 */

export type DrawFn = (ctx: CanvasRenderingContext2D) => void;

interface Definition {
  w: number;
  h: number;
  /** Anchor (pivot) in logical px from the top-left of the sprite box. */
  ax: number;
  ay: number;
  draw: DrawFn;
  dynamic: boolean;
}

export interface Frame {
  img: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  ax?: number;
  ay?: number;
  /** logical size to draw at (defaults to w/h). */
  lw?: number;
  lh?: number;
}

class SpriteLibrary {
  private defs = new Map<string, Definition>();
  private cache = new Map<string, Frame>();
  private atlas = new Map<string, Frame>();
  private dynamicCount = 0;
  /** Bitmap pixels per logical unit (set from the device scale). */
  res = 2;

  setResolution(r: number): void {
    const nr = Math.max(1, Math.min(3, r));
    if (Math.abs(nr - this.res) > 0.01) {
      this.res = nr;
      this.cache.clear();
      this.dynamicCount = 0;
    }
  }

  /** Register a procedural sprite. Rendered lazily on first use. */
  define(key: string, w: number, h: number, ax: number, ay: number, draw: DrawFn): void {
    this.defs.set(key, { w, h, ax, ay, draw, dynamic: false });
    this.cache.delete(key);
  }

  /** Define-if-missing, for keys generated at runtime (unique hero looks...). */
  ensure(key: string, w: number, h: number, ax: number, ay: number, draw: DrawFn): void {
    if (this.defs.has(key) || this.atlas.has(key)) return;
    this.defs.set(key, { w, h, ax, ay, draw, dynamic: true });
    this.dynamicCount++;
    if (this.dynamicCount > 600) this.flushDynamic();
  }

  private flushDynamic(): void {
    for (const [k, d] of this.defs) {
      if (d.dynamic) {
        this.defs.delete(k);
        this.cache.delete(k);
      }
    }
    for (const k of [...this.cache.keys()]) if (k.includes('#')) this.cache.delete(k);
    this.dynamicCount = 0;
  }

  has(key: string): boolean {
    return this.atlas.has(key) || this.defs.has(key);
  }

  get(key: string): Frame | null {
    const a = this.atlas.get(key);
    if (a) return a;
    const c = this.cache.get(key);
    if (c) return c;
    const d = this.defs.get(key);
    if (!d) return null;
    const cw = Math.max(1, Math.ceil(d.w * this.res));
    const ch = Math.max(1, Math.ceil(d.h * this.res));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.res, this.res);
    ctx.translate(d.ax, d.ay);
    d.draw(ctx);
    const f: Frame = { img: canvas, sx: 0, sy: 0, sw: cw, sh: ch, w: d.w, h: d.h, ax: d.ax, ay: d.ay };
    this.cache.set(key, f);
    return f;
  }

  /** Draw a sprite with its anchor at (x,y). */
  draw(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, sx = 1, sy = sx, rot = 0, alpha = 1): void {
    const f = this.get(key);
    if (!f) return;
    if (alpha <= 0) return;
    const pa = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = pa * alpha;
    if (rot === 0 && sx === 1 && sy === 1) {
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, x - f.ax, y - f.ay, f.w, f.h);
    } else {
      ctx.save();
      ctx.translate(x, y);
      if (rot !== 0) ctx.rotate(rot);
      ctx.scale(sx, sy);
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.ax, -f.ay, f.w, f.h);
      ctx.restore();
    }
    if (alpha < 1) ctx.globalAlpha = pa;
  }

  /** Silhouette of a sprite filled with one colour (hit flash, freeze tint). */
  drawTinted(ctx: CanvasRenderingContext2D, key: string, color: string, x: number, y: number, sx = 1, sy = sx, rot = 0, alpha = 1): void {
    const tk = key + '#' + color;
    let f = this.cache.get(tk);
    if (!f) {
      const base = this.get(key);
      if (!base) return;
      const c = document.createElement('canvas');
      c.width = base.sw;
      c.height = base.sh;
      const cx = c.getContext('2d')!;
      cx.drawImage(base.img, base.sx, base.sy, base.sw, base.sh, 0, 0, base.sw, base.sh);
      cx.globalCompositeOperation = 'source-atop';
      cx.fillStyle = color;
      cx.fillRect(0, 0, c.width, c.height);
      f = { ...base, img: c, sx: 0, sy: 0 };
      this.cache.set(tk, f);
      if (this.defs.get(key)?.dynamic) this.dynamicCount++;
    }
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * alpha;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.drawImage(f.img, 0, 0, f.sw, f.sh, -f.ax, -f.ay, f.w, f.h);
    ctx.restore();
    ctx.globalAlpha = pa;
  }

  /**
   * Hook for real art: provide a loaded sprite sheet and a frame map.
   * Keys found here take precedence over procedural drawings.
   */
  loadAtlas(image: CanvasImageSource, frames: Record<string, AtlasFrame>): void {
    for (const [key, fr] of Object.entries(frames)) {
      const lw = fr.lw ?? fr.w;
      const lh = fr.lh ?? fr.h;
      this.atlas.set(key, {
        img: image,
        sx: fr.x,
        sy: fr.y,
        sw: fr.w,
        sh: fr.h,
        w: lw,
        h: lh,
        ax: fr.ax ?? lw / 2,
        ay: fr.ay ?? lh,
      });
    }
  }
}

export const sprites = new SpriteLibrary();
