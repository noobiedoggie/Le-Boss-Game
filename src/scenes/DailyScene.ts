import { MenuScene } from './MenuScene';
import { C } from '../render/palette';
import { roundRectPath, fillStroke, text, textBlock } from '../render/draw';
import { icon } from '../render/icons';
import { drawBossPortrait } from '../render/art/bossArt';
import { Button } from '../ui/Button';
import { panel } from '../ui/widgets';
import { store } from '../systems/Save';
import { t } from '../i18n';
import { dailySeed, todayKey } from '../core/Rng';
import { shareText } from '../systems/Platform';

/** Daily Dungeon: same seed for everyone today, one attempt, local board. */
export class DailyScene extends MenuScene {
  build(): void {
    this.title = t('daily.title');
    const played = store.data.daily.last === todayKey();
    const H = this.game.H, sb = this.game.safeBottom;
    if (!played) {
      const b = this.ui.add(new Button(60, H - sb - 120, 600, 96, t('daily.play'), () => this.play()));
      b.size = 38;
      b.pulse = true;
      b.style(C.uiBtnAlt, C.uiBtnAltDark);
      b.textColor = C.ink;
    } else {
      const b = this.ui.add(new Button(60, H - sb - 110, 600, 80, t('stats.share'), () => this.share()));
      b.style(C.uiBlue, C.uiBlueDark);
    }
    this.contentH = 900;
  }

  get bottom(): number {
    return this.game.H - this.game.safeBottom - 140;
  }

  private today() {
    return store.data.daily.results.find((r) => r.date === todayKey());
  }

  private play(): void {
    store.data.daily.last = todayKey();
    store.save();
    void import('./RunScene').then(({ RunScene }) => this.game.setScene(new RunScene(this.game, { daily: true, seed: dailySeed() })));
  }

  private share(): void {
    const r = this.today();
    if (r) void shareText(t('daily.date', { d: r.date }) + ' — ' + t('daily.card', { w: r.wave, k: r.kills }) + ' 😈 #LeBoss');
  }

  drawContent(ctx: CanvasRenderingContext2D, y0: number): void {
    textBlock(ctx, t('daily.sub'), 360, y0 + 26, 620, { size: 20, color: '#e8dcff' });
    text(ctx, t('daily.date', { d: todayKey() }), 360, y0 + 70, { size: 26, color: C.goldHi });
    const r = this.today();
    let y = y0 + 100;
    if (r) {
      // screenshot-ready result card
      ctx.save();
      ctx.translate(360, y + 150);
      ctx.rotate(-0.025);
      roundRectPath(ctx, -300, -140, 600, 280, 26);
      const g = ctx.createLinearGradient(0, -140, 0, 140);
      g.addColorStop(0, '#5a1530');
      g.addColorStop(1, '#1d0b2b');
      fillStroke(ctx, g, 6, C.gold);
      text(ctx, t('game.title'), -150, -96, { size: 44, color: C.crimsonHi, lw: 8 });
      text(ctx, t('daily.date', { d: r.date }), -150, -54, { size: 18, color: C.goldHi });
      textBlock(ctx, t('daily.card', { w: r.wave, k: r.kills }), -130, 30, 300, { size: 30, color: C.white });
      drawBossPortrait(ctx, r.boss, 170, -10, 190, this.t, store.data.cosmetics.crown, 'classic', 'laugh');
      ctx.restore();
      y += 320;
    } else {
      panel(ctx, 60, y, 600, 150, '#2b1840', 3);
      icon(ctx, 'calendar', 140, y + 75, 70);
      textBlock(ctx, t('daily.sub'), 400, y + 75, 400, { size: 20 });
      y += 180;
    }
    text(ctx, t('daily.board'), 360, y + 20, { size: 26, color: C.crimsonHi });
    y += 50;
    const res = store.data.daily.results.slice(0, 10);
    if (!res.length) text(ctx, t('daily.empty'), 360, y + 20, { size: 18, color: '#9a8ab0' });
    res.forEach((e, i) => {
      const ry = y + i * 54;
      panel(ctx, 40, ry, 640, 46, e.date === todayKey() ? '#3a2456' : '#24163a', i);
      text(ctx, `#${i + 1}`, 76, ry + 23, { size: 20, color: i === 0 ? C.goldHi : C.white });
      text(ctx, e.date, 120, ry + 23, { size: 18, align: 'left', lw: 3 });
      text(ctx, `${e.wave} ${t('stats.waves').toLowerCase()} • ${e.kills} ☠`, 660, ry + 23, { size: 18, align: 'right', color: C.goldHi });
    });
    this.contentH = y - y0 + res.length * 54 + 40;
  }
}
