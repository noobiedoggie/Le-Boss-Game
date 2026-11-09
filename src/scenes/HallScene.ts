import { MenuScene } from './MenuScene';
import { C } from '../render/palette';
import { text, textBlock } from '../render/draw';
import { sprites } from '../render/Sprites';
import { ensureHeroSprite, type HeroLook } from '../render/art/heroArt';
import { panel, bar } from '../ui/widgets';
import { store } from '../systems/Save';
import { t } from '../i18n';
import { CLASS_ORDER, MOD_ORDER } from '../data/heroes';
import { SUPER_ORDER, HALL_TOTAL, COMBO_TOTAL } from '../game/Meta';
import type { HeroClassId, ModId, SuperId } from '../data/types';

interface Entry {
  key: string;
  name: string;
  desc: string;
  look: HeroLook;
}

/** HALL DE LA HONTE — the collection book of humiliated heroes. */
export class HallScene extends MenuScene {
  sections: { title: string; entries: Entry[]; y: number }[] = [];

  get top(): number {
    return this.game.safeTop + 190;
  }

  build(): void {
    this.title = t('hall.title');
    const look = (cls: HeroClassId, mods: ModId[] = [], superId?: SuperId, tunic = '#3fa9f5'): HeroLook => ({
      cls, mods, superId, tunic, skin: '#ffd7b0', hair: '#8a4b1f', seed: 2, gender: 'm', lives: mods.includes('threeheads') ? 3 : 1,
      heads: superId === 'paladin3' ? [true, true, true] : undefined,
    });
    const supCls: Record<SuperId, HeroClassId> = { chosen: 'knight', speedguild: 'rogue', paladin3: 'knight', player: 'rogue' };
    const sec = [
      { title: t('hall.classes'), entries: CLASS_ORDER.map((c) => ({ key: 'cls:' + c, name: t(`cls.${c}.m`), desc: t(`cls.${c}.desc`), look: look(c) })) },
      { title: t('hall.mods'), entries: MOD_ORDER.map((m) => ({ key: 'mod:' + m, name: t(`mod.${m}.m`), desc: t(`mod.${m}.desc`), look: look('knight', [m], undefined, '#ff5fa2') })) },
      {
        title: t('hall.supers'),
        entries: SUPER_ORDER.map((s) => ({
          key: 'super:' + s, name: t(`super.${s}.name`), desc: t(`super.${s}.sub`),
          look: look(supCls[s], s === 'speedguild' ? ['speedrunner'] : [], s, s === 'chosen' ? '#fff3b0' : s === 'player' ? '#1f1f2e' : '#d9e4ff'),
        })),
      },
    ];
    let y = 80;
    this.sections = sec.map((s) => {
      const out = { ...s, y };
      y += 56 + Math.ceil(s.entries.length / 3) * 290;
      return out;
    });
    this.contentH = y + 20;
  }

  drawContent(ctx: CanvasRenderingContext2D, y0: number): void {
    const found = Object.keys(store.data.hall).length;
    text(ctx, t('hall.progress', { n: found, max: HALL_TOTAL }), 360, y0 + 20, { size: 22, color: C.goldHi });
    bar(ctx, 110, y0 + 38, 500, 18, found / HALL_TOTAL, C.gold);
    text(ctx, t('hall.combos', { n: store.data.combos.length, max: COMBO_TOTAL }), 360, y0 + 72, { size: 16, color: '#cbb8e8', lw: 3 });
    for (const s of this.sections) {
      const sy = y0 + s.y + 30;
      text(ctx, s.title, 30, sy, { size: 26, align: 'left', color: C.crimsonHi });
      s.entries.forEach((e, i) => {
        const x = 20 + (i % 3) * 230, y = sy + 26 + Math.floor(i / 3) * 290;
        if (y > this.game.H || y < -300) return;
        const h = store.data.hall[e.key];
        panel(ctx, x, y, 220, 276, h ? '#2f1d48' : '#1c1129', i + 1);
        const key = ensureHeroSprite(e.look, h ? 'smug' : 'dead');
        if (h) sprites.draw(ctx, key, x + 110, y + 124, 1.75, 1.75);
        else sprites.drawTinted(ctx, key, '#0c0614', x + 110, y + 124, 1.75, 1.75);
        text(ctx, h ? e.name : t('hall.unknown'), x + 110, y + 146, { size: 20, color: h ? C.goldHi : '#6a5a80', maxWidth: 200 });
        if (h) {
          text(ctx, t('hall.count', { n: h.count }), x + 110, y + 172, { size: 15, color: '#ff9db0', lw: 3 });
          textBlock(ctx, `« ${h.quote} »`, x + 110, y + 222, 196, { size: 14, color: '#e8dcff', lw: 2.5 });
        } else textBlock(ctx, e.desc, x + 110, y + 210, 196, { size: 13, color: '#8a7aa0', lw: 2.5 });
      });
    }
  }
}
