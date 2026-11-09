import type { Game } from '../core/Game';
import type { Pointer, Scene } from '../core/Scene';
import { fmt } from '../core/math';
import { C } from '../render/palette';
import { text } from '../render/draw';
import { icon } from '../render/icons';
import { drawBoss } from '../render/art/bossArt';
import { Button, UI } from '../ui/Button';
import { glow } from '../ui/widgets';
import { store } from '../systems/Save';
import { audio } from '../systems/Audio';
import { t, tr } from '../i18n';
import { todayKey } from '../core/Rng';
import { skinVariant } from '../data/unlocks';
import { Particles } from '../systems/Particles';
import { drawParticles } from '../render/fxArt';

/** "Le Trône" — the hub. Big PLAY button, the boss on its throne, menus. */
export class HubScene implements Scene {
  ui = new UI();
  t = 0;
  laughT = 0;
  tagline = tr('hub.tagline');
  ps = new Particles();

  constructor(private game: Game) {}

  enter(): void {
    audio.setMusic('menu');
    this.build();
  }
  resize(): void {
    this.build();
  }

  private go(name: string): void {
    const g = this.game;
    switch (name) {
      case 'play': void import('./BossSelectScene').then(({ BossSelectScene }) => g.setScene(new BossSelectScene(g))); break;
      case 'daily': void import('./DailyScene').then(({ DailyScene }) => g.setScene(new DailyScene(g))); break;
      case 'shop': void import('./ShopScene').then(({ ShopScene }) => g.setScene(new ShopScene(g))); break;
      case 'hall': void import('./HallScene').then(({ HallScene }) => g.setScene(new HallScene(g))); break;
      case 'ach': void import('./AchievementsScene').then(({ AchievementsScene }) => g.setScene(new AchievementsScene(g))); break;
      case 'settings': void import('./SettingsScene').then(({ SettingsScene }) => g.setScene(new SettingsScene(g))); break;
    }
  }

  private build(): void {
    this.ui.clear();
    const H = this.game.H, sb = this.game.safeBottom;
    const by = H - sb - 330;
    const play = this.ui.add(new Button(60, by, 600, 104, t('hub.play'), () => this.go('play')));
    play.size = 56;
    play.pulse = true;
    const played = store.data.daily.last === todayKey();
    const daily = this.ui.add(new Button(60, by + 124, 290, 76, t('hub.daily'), () => this.go('daily')));
    daily.style(C.uiBtnAlt, C.uiBtnAltDark);
    daily.textColor = C.ink;
    daily.size = 22;
    daily.iconName = 'calendar';
    daily.badge = played ? '' : '!';
    const shop = this.ui.add(new Button(370, by + 124, 290, 76, t('hub.shop'), () => this.go('shop')));
    shop.style(C.uiBlue, C.uiBlueDark);
    shop.size = 24;
    shop.iconName = 'soul';
    const row = by + 218;
    const items: [string, string, string][] = [['hall', t('hub.hall'), 'book'], ['ach', t('hub.achievements'), 'trophy'], ['settings', t('hub.settings'), 'gear']];
    items.forEach(([id, label, ic], i) => {
      const b = this.ui.add(new Button(60 + i * 204, row, 192, 70, label, () => this.go(id)));
      b.style(C.uiPanelHi, C.uiPanel);
      b.size = 17;
      b.iconName = ic;
      b.iconSize = 26;
    });
  }

  update(dt: number, rdt: number): void {
    this.t += rdt;
    this.ui.update(rdt);
    this.ps.update(rdt);
    if (this.laughT > 0) this.laughT -= rdt;
    void dt;
  }

  back(): boolean {
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H, st = this.game.safeTop, sb = this.game.safeBottom;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a1240');
    g.addColorStop(0.6, '#150a22');
    g.addColorStop(1, '#0b0612');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // pillars
    for (const x of [70, 650]) {
      ctx.fillStyle = '#1d1030';
      ctx.fillRect(x - 40, st + 120, 80, H);
      ctx.fillStyle = '#2a1745';
      ctx.fillRect(x - 40, st + 120, 18, H);
    }
    // throne-room glow
    glow(ctx, W / 2, H * 0.4, 380, '#ff3b5c', 0.18 + Math.sin(this.t * 1.5) * 0.04);
    // title
    text(ctx, t('game.title'), W / 2, st + 70, { size: 84, color: C.crimsonHi, stroke: '#12020a', lw: 14 });
    text(ctx, t('hub.title'), W / 2, st + 128, { size: 26, color: C.goldHi });
    icon(ctx, 'soul', 580, st + 30, 28);
    text(ctx, fmt(store.data.souls), 600, st + 31, { size: 24, color: '#8fe8ff', align: 'left' });
    // boss
    const by = H - sb - 350;
    const scale = Math.min(0.95, (by - (st + 180)) / 470);
    drawBoss(ctx, store.data.selectedBoss, W / 2, by - 10, scale, {
      t: this.t, mood: this.laughT > 0 ? 'laugh' : 'idle', hurt: 0, lookX: Math.sin(this.t * 0.6) * 0.4, lookY: 0.2, rage: 0.5, charge: 0,
      crown: store.data.cosmetics.crown, skin: skinVariant(store.data.cosmetics.skin),
    });
    text(ctx, t(`boss.${store.data.selectedBoss}.name`), W / 2, by + 6, { size: 26, color: C.white });
    const s = store.data.stats;
    text(ctx, t('hub.best', { n: s.bestWave ?? 0 }) + '   •   ' + t('hub.runs', { n: s.runs ?? 0, w: s.wins ?? 0 }), W / 2, by + 40, { size: 18, color: '#cbb8e8', lw: 3 });
    text(ctx, this.tagline, W / 2, st + 165, { size: 20, color: '#e8dcff', lw: 4 });
    drawParticles(ctx, this.ps);
    this.ui.draw(ctx, this.t);
  }

  pointerDown(p: Pointer): void {
    audio.unlock();
    if (this.ui.down(p.x, p.y)) return;
    // poke the boss: he laughs
    if (p.y > this.game.safeTop + 180 && p.y < this.game.H - this.game.safeBottom - 340) {
      this.laughT = 1.2;
      audio.play('laugh');
      this.ps.confetti(p.x, p.y, 12, 0.6);
    }
  }
  pointerUp(p: Pointer): void {
    this.ui.up(p.x, p.y);
  }
}
