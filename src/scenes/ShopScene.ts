import { MenuScene } from './MenuScene';
import { C } from '../render/palette';
import { fillStroke, roundRectPath, text, textBlock, circle, star } from '../render/draw';
import { icon } from '../render/icons';
import { Button } from '../ui/Button';
import { panel, toasts } from '../ui/widgets';
import { store } from '../systems/Save';
import { audio } from '../systems/Audio';
import { t } from '../i18n';
import { shopItems, DEFAULT_COSMETICS, type ShopCat, type ShopItem } from '../data/unlocks';
import { drawTrapIcon } from '../render/art/trapArt';
import { drawMonster } from '../render/art/monsterArt';
import { drawBossPortrait, drawCrown, bossPalette } from '../render/art/bossArt';
import type { MonsterId, TrapId, BossId } from '../data/types';

const TABS: ShopCat[] = ['traps', 'monsters', 'attacks', 'bosses', 'upgrades', 'cosmetics'];
const ATTACK_ICON: Record<string, string> = { meteor: 'boom', possess: 'dark', summon: 'goblin', blackhole: 'dark', timefreeze: 'clock' };

/** L'Armurerie: spend souls on unlocks, upgrades and cosmetics. */
export class ShopScene extends MenuScene {
  tab: ShopCat = 'traps';
  rows: { item: ShopItem; y: number }[] = [];

  get top(): number {
    return this.game.safeTop + 210;
  }

  build(): void {
    this.title = t('shop.title');
    const st = this.game.safeTop;
    TABS.forEach((tab, i) => {
      const b = this.ui.add(new Button(12 + i * 117, st + 104, 112, 56, t(`shop.${tab}`), () => {
        this.tab = tab;
        this.scroll = 0;
        this.rebuild();
      }));
      b.size = 16;
      if (tab === this.tab) b.style(C.uiBtnAlt, C.uiBtnAltDark), (b.textColor = C.ink);
      else b.style(C.uiPanelHi, C.uiPanel);
    });
    this.layoutRows();
  }

  private items(): ShopItem[] {
    if (this.tab === 'cosmetics') {
      const base: ShopItem[] = DEFAULT_COSMETICS.map((c) => ({ id: c.id, cat: 'cosmetics' as ShopCat, cost: 0, slot: c.slot as ShopItem['slot'], nameKey: c.nameKey, descKey: `cosm.${c.slot}` }));
      return [...base, ...shopItems().filter((i) => i.cat === 'cosmetics')].sort((a, b) => (a.slot ?? '').localeCompare(b.slot ?? '') || a.cost - b.cost);
    }
    return shopItems().filter((i) => i.cat === this.tab);
  }

  private layoutRows(): void {
    this.rows = this.items().map((item, i) => ({ item, y: 10 + i * 132 }));
    this.contentH = this.rows.length * 132 + 30;
  }

  private owned(it: ShopItem): boolean {
    if (it.cat === 'cosmetics') return store.data.cosmetics.owned.includes(it.id);
    if (it.cat === 'upgrades') return store.upg(it.id) >= (it.maxLevel ?? 1);
    return store.has(it.id);
  }

  private price(it: ShopItem): number {
    if (it.cat === 'upgrades') return it.costs![Math.min(store.upg(it.id), it.costs!.length - 1)];
    return it.cost;
  }

  private equipped(it: ShopItem): boolean {
    const c = store.data.cosmetics;
    return (it.slot === 'crown' && c.crown === it.id) || (it.slot === 'skin' && c.skin === it.id) || (it.slot === 'death' && c.death === it.id);
  }

  drawContent(ctx: CanvasRenderingContext2D, y0: number): void {
    for (const r of this.rows) {
      const y = y0 + r.y;
      if (y > this.game.H || y < -140) continue;
      const it = r.item;
      const owned = this.owned(it);
      panel(ctx, 20, y, 680, 118, owned ? '#2f1d48' : '#26163a', r.y);
      // preview
      ctx.save();
      ctx.translate(90, y + 60);
      ctx.scale(1.3, 1.3);
      this.drawPreview(ctx, it);
      ctx.restore();
      text(ctx, t(it.nameKey), 170, y + 32, { size: 24, align: 'left', color: C.goldHi, maxWidth: 330 });
      textBlock(ctx, t(it.descKey), 170 + 165, y + 76, 330, { size: 15, lw: 3 });
      if (it.cat === 'upgrades') {
        for (let i = 0; i < (it.maxLevel ?? 1); i++) {
          star(ctx, 520 + i * 24 - 120, y + 30, 9, 4);
          fillStroke(ctx, i < store.upg(it.id) ? C.goldHi : '#4a3a5a', 2);
        }
      }
      // action pill
      const bx = 530, by = y + 30, bw = 150, bh = 58;
      roundRectPath(ctx, bx, by, bw, bh, 18);
      let label = '';
      let col: string = C.uiBlue;
      if (it.cat === 'cosmetics' && owned) {
        const eq = this.equipped(it);
        label = eq ? t('common.equipped') : t('common.equip');
        col = eq ? C.uiGood : C.uiPanelHi;
      } else if (owned) {
        label = t('shop.owned');
        col = '#4a3a5a';
      } else {
        col = store.data.souls >= this.price(it) ? C.uiBlue : '#4a3a5a';
      }
      fillStroke(ctx, col, 4);
      if (label) text(ctx, label, bx + bw / 2, by + bh / 2 + 1, { size: 18 });
      else {
        icon(ctx, 'soul', bx + 34, by + bh / 2, 26);
        text(ctx, String(this.price(it)), bx + 54, by + bh / 2 + 1, { size: 24, align: 'left', color: '#e8fbff' });
      }
    }
  }

  private drawPreview(ctx: CanvasRenderingContext2D, it: ShopItem): void {
    switch (it.cat) {
      case 'traps':
        ctx.scale(0.85, 0.85);
        drawTrapIcon(ctx, it.id as TrapId, this.t);
        break;
      case 'monsters':
        ctx.translate(0, 34);
        ctx.scale(it.id === 'ogre' ? 0.55 : 0.9, it.id === 'ogre' ? 0.55 : 0.9);
        drawMonster(ctx, it.id as MonsterId, 1, Math.floor(this.t * 6) % 2);
        break;
      case 'attacks':
        icon(ctx, ATTACK_ICON[it.id] ?? 'fire', 0, 0, 60, this.t);
        break;
      case 'bosses':
        drawBossPortrait(ctx, it.id as BossId, 0, -10, 120, this.t);
        break;
      case 'upgrades':
        icon(ctx, it.id === 'startGold' ? 'gold' : it.id === 'bossHp' ? 'heart' : it.id === 'rage' ? 'rage' : it.id === 'pactReroll' ? 'echo' : 'soul', 0, 0, 56, this.t);
        break;
      case 'cosmetics':
        if (it.slot === 'crown') drawCrown(ctx, it.id, 0, 22, 0.75, this.t);
        else if (it.slot === 'skin') {
          const pal = bossPalette(store.data.selectedBoss, it.id === 'goldskin' ? 'gold' : it.id);
          circle(ctx, -14, 0, 24);
          fillStroke(ctx, pal.main, 4);
          circle(ctx, 18, 6, 18);
          fillStroke(ctx, pal.accent, 4);
          circle(ctx, 4, -18, 10);
          fillStroke(ctx, pal.eye, 3);
        } else icon(ctx, it.id === 'ducks' ? 'chicken' : it.id === 'bubbles' ? 'soul' : it.id === 'pixels' ? 'gear' : it.id === 'fireworks' ? 'boom' : 'combo', 0, 0, 56, this.t);
        break;
    }
  }

  tapContent(x: number, y: number): void {
    for (const r of this.rows) {
      if (y < r.y || y > r.y + 118) continue;
      if (x < 520) return;
      this.act(r.item);
      return;
    }
  }

  private act(it: ShopItem): void {
    const d = store.data;
    if (it.cat === 'cosmetics' && this.owned(it)) {
      if (it.slot === 'crown') d.cosmetics.crown = it.id;
      if (it.slot === 'skin') d.cosmetics.skin = it.id;
      if (it.slot === 'death') d.cosmetics.death = it.id;
      audio.play('click');
      store.save();
      return;
    }
    if (this.owned(it)) return;
    const price = this.price(it);
    if (d.souls < price) {
      audio.play('error');
      toasts.push(t('shop.notEnough'), `${price - d.souls} ${t('common.souls')}`, 'soul');
      return;
    }
    d.souls -= price;
    if (it.cat === 'upgrades') d.upgrades[it.id] = store.upg(it.id) + 1;
    else if (it.cat === 'cosmetics') d.cosmetics.owned.push(it.id);
    else d.unlocked.push(it.id);
    if (it.cat === 'bosses') d.selectedBoss = it.id as BossId;
    audio.play('buy');
    toasts.push(t('shop.unlocked', { name: t(it.nameKey) }), '', 'soul');
    store.save();
  }
}
