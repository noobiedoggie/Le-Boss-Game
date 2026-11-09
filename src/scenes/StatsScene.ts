import type { Game } from '../core/Game';
import type { Pointer, Scene } from '../core/Scene';
import { clamp, easeOutBack, fmt } from '../core/math';
import { fx } from '../core/Rng';
import type { World } from '../game/World';
import { C } from '../render/palette';
import { roundRectPath, fillStroke, text, textBlock } from '../render/draw';
import { drawBossPortrait } from '../render/art/bossArt';
import { icon } from '../render/icons';
import { Button, UI } from '../ui/Button';
import { panel } from '../ui/widgets';
import { Particles } from '../systems/Particles';
import { drawParticles } from '../render/fxArt';
import { audio } from '../systems/Audio';
import { store } from '../systems/Save';
import { t } from '../i18n';
import { shareText } from '../systems/Platform';
import type { RunOpts } from './RunScene';
import { skinVariant } from '../data/unlocks';

/** End-of-run report: stats, MVP trap, most humiliating death, souls. */
export class StatsScene implements Scene {
  ui = new UI();
  t = 0;
  ps = new Particles();
  soulsShown = 0;
  constructor(private game: Game, private w: World, private won: boolean, private souls: number, private record: boolean, private opts: RunOpts) {}

  enter(): void {
    audio.setMusic('menu');
    const H = this.game.H, sb = this.game.safeBottom;
    const by = H - sb - 110;
    if (!this.opts.daily) {
      const again = this.ui.add(new Button(30, by - 96, 660, 82, t('stats.again'), () => this.again()));
      again.style(C.uiBtn, C.uiBtnDark);
      again.size = 40;
      again.pulse = true;
    }
    const cont = this.ui.add(new Button(30, by, 320, 76, t('stats.continue'), () => this.toHub()));
    cont.style(C.uiBlue, C.uiBlueDark);
    const share = this.ui.add(new Button(370, by, 320, 76, t('stats.share'), () => this.share()));
    share.style(C.uiBtnAlt, C.uiBtnAltDark);
    share.textColor = C.ink;
    if (this.won) for (let i = 0; i < 6; i++) this.ps.confetti(fx.r(100, 620), fx.r(100, 400), 30, 1.3);
  }

  private again(): void {
    void import('./RunScene').then(({ RunScene }) => this.game.setScene(new RunScene(this.game, { endless: this.opts.endless })));
  }
  private toHub(): void {
    void import('./HubScene').then(({ HubScene }) => this.game.setScene(new HubScene(this.game)));
  }
  private share(): void {
    void shareText(t('stats.shareText', { w: this.w.stats.wavesSurvived, k: this.w.stats.kills }));
  }

  update(dt: number, rdt: number): void {
    this.t += rdt;
    this.ui.update(rdt);
    this.ps.update(rdt);
    if (this.won && Math.random() < rdt * 2) this.ps.confetti(fx.r(60, 660), fx.r(80, 300), 16);
    const target = this.souls;
    if (this.t > 1.2 && this.soulsShown < target) {
      const before = Math.floor(this.soulsShown);
      this.soulsShown = Math.min(target, this.soulsShown + Math.max(1, target * rdt * 1.5));
      if (Math.floor(this.soulsShown) !== before && Math.floor(this.soulsShown) % 3 === 0) audio.play('coin', 1.3);
    }
    void dt;
  }

  back(): boolean {
    this.toHub();
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H, st = this.game.safeTop;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.won ? '#3a1f10' : '#1a0b22');
    g.addColorStop(1, '#0d0614');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const k = easeOutBack(clamp(this.t / 0.5, 0, 1));
    ctx.save();
    ctx.translate(W / 2, st + 70);
    ctx.scale(k, k);
    text(ctx, this.won ? t('stats.victory') : t('stats.defeat'), 0, 0, { size: this.won ? 64 : 46, color: this.won ? C.goldHi : C.crimsonHi, lw: 10, maxWidth: 680 });
    ctx.restore();
    text(ctx, this.won ? t('stats.victorySub') : t('stats.defeatSub'), W / 2, st + 122, { size: 20, color: '#d9c8ef' });
    drawBossPortrait(ctx, this.w.opts.bossId, W / 2, st + 250, 210, this.t, store.data.cosmetics.crown, skinVariant(store.data.cosmetics.skin), this.won ? 'laugh' : 'dead');
    const s = this.w.stats;
    const rows: [string, string, string][] = [
      ['skull', t('stats.waves'), String(s.wavesSurvived)],
      ['crown', t('stats.kills'), fmt(s.kills)],
      ['combo', t('stats.bestCombo'), s.bestStreak >= 2 ? `${s.bestStreak}x` : t('stats.none')],
      ['spikes', t('stats.mvp'), this.mvp()],
    ];
    let y = st + 380;
    panel(ctx, 30, y - 20, 660, rows.length * 52 + 26, '#2b1840', 5);
    rows.forEach(([ic, label, val], i) => {
      const ry = y + 10 + i * 52;
      const a = clamp((this.t - 0.3 - i * 0.12) / 0.3, 0, 1);
      ctx.globalAlpha = a;
      icon(ctx, ic, 70, ry, 30);
      text(ctx, label, 100, ry, { size: 22, align: 'left' });
      text(ctx, val, 660, ry, { size: 26, align: 'right', color: C.goldHi, maxWidth: 300 });
      ctx.globalAlpha = 1;
    });
    y += rows.length * 52 + 30;
    // most humiliating death polaroid
    const best = s.best;
    if (best) {
      const a = clamp((this.t - 0.8) / 0.4, 0, 1);
      ctx.globalAlpha = a;
      text(ctx, t('stats.humiliating'), W / 2, y + 6, { size: 22, color: C.crimsonHi });
      ctx.save();
      ctx.translate(150, y + 110);
      ctx.rotate(-0.06);
      roundRectPath(ctx, -80, -80, 160, 180, 6);
      fillStroke(ctx, '#fffdf6', 4);
      if (best.snapshot) ctx.drawImage(best.snapshot, -70, -70, 140, 140);
      else {
        ctx.fillStyle = '#2b1840';
        ctx.fillRect(-70, -70, 140, 140);
        icon(ctx, 'skull', 0, 0, 60);
      }
      ctx.restore();
      textBlock(ctx, best.name, 450, y + 80, 380, { size: 22, color: C.white });
      textBlock(ctx, t(`cause.${best.cause}`) + ` (${t('hud.wave', { n: best.wave })})`, 450, y + 140, 380, { size: 18, color: '#d9c8ef', lw: 3 });
      ctx.globalAlpha = 1;
      y += 230;
    }
    // souls
    const sk = clamp((this.t - 1.1) / 0.4, 0, 1);
    ctx.globalAlpha = sk;
    icon(ctx, 'soul', W / 2 - 110, y + 10, 40);
    text(ctx, `+${Math.floor(this.soulsShown)} ${t('common.souls')}`, W / 2 + 20, y + 12, { size: 34, color: '#8fe8ff' });
    if (this.record) text(ctx, t('stats.newRecord'), W / 2, y + 52, { size: 24, color: C.goldHi });
    if (this.won && store.data.endless && !this.opts.endless) text(ctx, t('stats.endless'), W / 2, y + 82, { size: 20, color: C.toxic });
    ctx.globalAlpha = 1;
    drawParticles(ctx, this.ps);
    this.ui.draw(ctx, this.t);
  }

  private mvp(): string {
    let best = { name: t('stats.none'), kills: 0 };
    for (const tr of this.w.traps) if (tr.kills > best.kills) best = { name: `${t(`trap.${tr.kind}.name`)} ${t('common.level', { n: tr.level })}`, kills: tr.kills };
    for (const d of this.w.dens) if (d.kills > best.kills) best = { name: `${t(`monster.${d.kind}.name`)} ${t('common.level', { n: d.level })}`, kills: d.kills };
    return best.kills > 0 ? `${best.name} (${best.kills})` : best.name;
  }

  pointerDown(p: Pointer): void {
    this.ui.down(p.x, p.y);
  }
  pointerUp(p: Pointer): void {
    this.ui.up(p.x, p.y);
  }
}
