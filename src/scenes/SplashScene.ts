import type { Game } from '../core/Game';
import type { Pointer, Scene } from '../core/Scene';
import { clamp, easeOutBack, easeOutElastic } from '../core/math';
import { C } from '../render/palette';
import { text } from '../render/draw';
import { glow } from '../ui/widgets';
import { store } from '../systems/Save';
import { audio } from '../systems/Audio';
import { t } from '../i18n';

/**
 * 1.6s splash: glowing eyes in the dark, the title slams in, then
 * straight into the action (first launch) or the hub.
 */
export class SplashScene implements Scene {
  t = 0;
  private slammed = false;
  private left = false;
  constructor(private game: Game) {}

  update(dt: number, rdt: number): void {
    this.t += rdt;
    if (!this.slammed && this.t > 0.6) {
      this.slammed = true;
      this.game.camera.shake(0.6);
      audio.play('explosion');
    }
    if (this.t > 1.7) this.leave();
    void dt;
  }

  private leave(): void {
    if (this.left) return;
    this.left = true;
    if (store.data.firstLaunch) {
      // No menus first: drop the player straight into wave 1.
      void import('./RunScene').then(({ RunScene }) => this.game.setScene(new RunScene(this.game)));
    } else {
      void import('./HubScene').then(({ HubScene }) => this.game.setScene(new HubScene(this.game)));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H;
    ctx.save();
    this.game.camera.apply(ctx, W, H);
    ctx.fillStyle = '#07030c';
    ctx.fillRect(-50, -50, W + 100, H + 100);
    // eyes opening in the dark
    const open = clamp((this.t - 0.1) / 0.4, 0, 1);
    glow(ctx, W / 2, H * 0.42, 260, C.crimson, 0.35 * open);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(W / 2 + s * 70, H * 0.42);
      ctx.rotate(s * 0.25);
      ctx.scale(1, Math.max(0.05, open));
      glow(ctx, 0, 0, 80, C.goldHi, 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 20, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.goldHi;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.restore();
    }
    if (this.t > 0.6) {
      const k = easeOutElastic(clamp((this.t - 0.6) / 0.5, 0, 1));
      ctx.save();
      ctx.translate(W / 2, H * 0.62);
      ctx.scale(k, k);
      ctx.rotate(-0.04);
      text(ctx, t('game.title'), 0, 0, { size: 120, color: C.crimsonHi, stroke: '#12020a', lw: 18 });
      ctx.restore();
      const k2 = easeOutBack(clamp((this.t - 0.9) / 0.4, 0, 1));
      ctx.globalAlpha = k2;
      text(ctx, t('game.subtitle'), W / 2, H * 0.62 + 90, { size: 24, color: C.goldHi });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  pointerDown(_p: Pointer): void {
    audio.unlock();
    if (this.t > 0.8) this.leave();
  }
}
