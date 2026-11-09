import { drawBoss } from './render/art/bossArt';
import { text } from './render/draw';
import { C } from './render/palette';

/**
 * Asset generation helper (not used in-game): `?icon=<px>&kind=full|fg|splash`
 * renders the launcher icon / splash with the game's own art so
 * scripts/gen-assets.cjs can screenshot it into resources/android.
 */
export function renderIconMode(params: URLSearchParams): void {
  const size = Number(params.get('icon')) || 512;
  const kind = params.get('kind') ?? 'full';
  const w = kind === 'splash' ? Math.round(size * 0.5625) : size;
  const h = size;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px`;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    if (kind !== 'fg') {
      const g = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h * 0.45, Math.max(w, h) * 0.7);
      g.addColorStop(0, '#6b1530');
      g.addColorStop(0.55, '#2a1245');
      g.addColorStop(1, '#120a1c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    const pose = { t: 0.7, mood: 'idle' as const, hurt: 0, lookX: 0, lookY: 0.15, rage: 1, charge: 0, crown: 'gold', skin: 'classic' };
    if (kind === 'splash') {
      const k = w / 720;
      drawBoss(ctx, 'demon', w / 2, h * 0.62, 1.05 * k, pose);
      text(ctx, 'LE BOSS', w / 2, h * 0.74, { size: 130 * k, color: C.crimsonHi, stroke: '#12020a', lw: 20 * k });
      return;
    }
    // head close-up: the boss head centre is ~282 units above its base
    const zoom = (kind === 'fg' ? 0.62 : 0.86) * (size / 300);
    ctx.save();
    ctx.translate(w / 2, h / 2 + (kind === 'fg' ? 0.06 : 0.1) * h);
    ctx.scale(zoom, zoom);
    ctx.translate(0, 282 - 30);
    drawBoss(ctx, 'demon', 0, 0, 1, pose);
    ctx.restore();
  };
  void document.fonts.load("40px 'Lilita One'").then(draw, draw);
  draw();
  (window as unknown as { __iconReady: boolean }).__iconReady = true;
}
