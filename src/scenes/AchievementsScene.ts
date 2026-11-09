import { MenuScene } from './MenuScene';
import { C } from '../render/palette';
import { text } from '../render/draw';
import { icon } from '../render/icons';
import { panel } from '../ui/widgets';
import { store } from '../systems/Save';
import { t } from '../i18n';
import { ACHIEVEMENTS, ACH_SOULS } from '../data/achievements';

export class AchievementsScene extends MenuScene {
  build(): void {
    this.title = t('ach.title');
    this.contentH = ACHIEVEMENTS.length * 104 + 70;
  }

  drawContent(ctx: CanvasRenderingContext2D, y0: number): void {
    const got = store.data.achievements.length;
    text(ctx, `${got}/${ACHIEVEMENTS.length}`, 360, y0 + 24, { size: 26, color: C.goldHi });
    ACHIEVEMENTS.forEach((a, i) => {
      const y = y0 + 54 + i * 104;
      if (y > this.game.H || y < -110) return;
      const done = store.data.achievements.includes(a.id);
      panel(ctx, 20, y, 680, 92, done ? '#3a2456' : '#1f142e', i);
      icon(ctx, done ? 'trophy' : 'lock', 70, y + 46, 44, this.t);
      text(ctx, t(`ach.${a.id}.name`), 110, y + 30, { size: 22, align: 'left', color: done ? C.goldHi : '#9a8ab0', maxWidth: 440 });
      text(ctx, t(`ach.${a.id}.desc`), 110, y + 62, { size: 16, align: 'left', color: done ? C.white : '#7a6a90', lw: 3, maxWidth: 440 });
      const v = a.stat.startsWith('run:') ? 0 : store.data.stats[a.stat] ?? 0;
      text(ctx, done ? `+${ACH_SOULS}` : `${Math.min(v, a.need)}/${a.need}`, 672, y + 46, { size: 20, align: 'right', color: done ? '#8fe8ff' : '#9a8ab0' });
    });
  }
}
