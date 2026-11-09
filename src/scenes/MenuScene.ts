import type { Game } from '../core/Game';
import type { Pointer, Scene } from '../core/Scene';
import { clamp } from '../core/math';
import { C } from '../render/palette';
import { text } from '../render/draw';
import { icon } from '../render/icons';
import { Button, UI } from '../ui/Button';
import { store } from '../systems/Save';
import { t } from '../i18n';
import { audio } from '../systems/Audio';
import { fmt } from '../core/math';

/**
 * Base for hub sub-screens: background, title, back button, souls counter
 * and an optional vertically scrolling content area.
 */
export abstract class MenuScene implements Scene {
  ui = new UI();
  t = 0;
  scroll = 0;
  vel = 0;
  contentH = 0;
  private drag: { y: number; last: number; moved: number; t: number } | null = null;
  title = '';
  showSouls = true;

  constructor(protected game: Game) {}

  get top(): number {
    return this.game.safeTop + 120;
  }
  get bottom(): number {
    return this.game.H - this.game.safeBottom - 20;
  }

  enter(): void {
    audio.setMusic('menu');
    this.rebuild();
  }

  resize(): void {
    this.rebuild();
  }

  rebuild(): void {
    this.ui.clear();
    const back = this.ui.add(new Button(16, this.game.safeTop + 14, 150, 62, t('common.back'), () => this.goBack()));
    back.style(C.uiPanelHi, C.uiPanel);
    back.size = 24;
    back.sfx = 'back';
    this.build();
  }

  abstract build(): void;
  abstract drawContent(ctx: CanvasRenderingContext2D, y0: number): void;
  tapContent(_x: number, _y: number): void {}

  goBack(): void {
    void import('./HubScene').then(({ HubScene }) => this.game.setScene(new HubScene(this.game)));
  }

  back(): boolean {
    this.goBack();
    return true;
  }

  update(dt: number, rdt: number): void {
    this.t += rdt;
    this.ui.update(rdt);
    if (!this.drag) {
      this.scroll += this.vel * rdt;
      this.vel *= Math.exp(-4 * rdt);
    }
    const max = Math.max(0, this.contentH - (this.bottom - this.top));
    if (this.scroll < 0) this.scroll += (0 - this.scroll) * Math.min(1, rdt * 12);
    if (this.scroll > max) this.scroll += (max - this.scroll) * Math.min(1, rdt * 12);
    void dt;
  }

  drawBg(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d0f30');
    g.addColorStop(1, '#0b0612');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // floating embers
    for (let i = 0; i < 18; i++) {
      const x = (i * 97.3 + this.t * 14 * ((i % 3) + 1)) % W;
      const y = H - ((i * 211.7 + this.t * 30 * ((i % 4) + 1)) % H);
      ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},40,${0.15 + (i % 3) * 0.08})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBg(ctx);
    const W = this.game.W;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.top - 10, W, this.bottom - this.top + 10);
    ctx.clip();
    this.drawContent(ctx, this.top - this.scroll);
    ctx.restore();
    // header
    const st = this.game.safeTop;
    ctx.fillStyle = 'rgba(16,8,26,0.92)';
    ctx.fillRect(0, 0, W, this.top - 12);
    text(ctx, this.title, W / 2 + 60, st + 46, { size: 34, color: C.goldHi, maxWidth: 380 });
    if (this.showSouls) {
      icon(ctx, 'soul', 600, st + 46, 30);
      text(ctx, fmt(store.data.souls), 622, st + 47, { size: 26, color: '#8fe8ff', align: 'left' });
    }
    this.ui.draw(ctx, this.t);
  }

  pointerDown(p: Pointer): void {
    if (this.ui.down(p.x, p.y)) return;
    if (p.y > this.top - 10) this.drag = { y: p.y, last: p.y, moved: 0, t: performance.now() };
  }

  pointerMove(p: Pointer): void {
    if (!this.drag) return;
    const dy = p.y - this.drag.last;
    this.drag.last = p.y;
    this.drag.moved += Math.abs(dy);
    this.scroll -= dy;
    this.vel = -dy * 60;
  }

  pointerUp(p: Pointer): void {
    if (this.ui.up(p.x, p.y)) return;
    const d = this.drag;
    this.drag = null;
    if (d && d.moved < 12) {
      this.vel = 0;
      this.tapContent(p.x, p.y - (this.top - this.scroll));
    }
  }

  clampScroll(): void {
    this.scroll = clamp(this.scroll, 0, Math.max(0, this.contentH - (this.bottom - this.top)));
  }
}
