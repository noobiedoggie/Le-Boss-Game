import type { Game } from '../core/Game';
import type { Pointer, Scene } from '../core/Scene';
import { C } from '../render/palette';
import { fillStroke, roundRectPath, text, textBlock } from '../render/draw';
import { icon } from '../render/icons';
import { drawBoss } from '../render/art/bossArt';
import { Button, UI } from '../ui/Button';
import { glow, panel } from '../ui/widgets';
import { store } from '../systems/Save';
import { audio } from '../systems/Audio';
import { t } from '../i18n';
import { BOSSES, BOSS_ORDER } from '../data/bosses';
import { ATTACKS, ATTACKS_BY_SLOT, SLOT_ORDER } from '../data/attacks';
import type { AttackSlot, BossId } from '../data/types';
import { skinVariant } from '../data/unlocks';

const ATTACK_ICON: Record<string, string> = {
  fireball: 'fire', meteor: 'boom', possess: 'dark', claw: 'claw', summon: 'goblin', roar: 'rage', blackhole: 'dark', timefreeze: 'clock',
};

/** Choose the boss + the 3 attacks (one per gesture slot) + mode. */
export class BossSelectScene implements Scene {
  ui = new UI();
  t = 0;
  idx: number;
  endless = false;
  startBtn!: Button;

  constructor(private game: Game) {
    this.idx = Math.max(0, BOSS_ORDER.indexOf(store.data.selectedBoss));
  }

  get boss(): BossId {
    return BOSS_ORDER[this.idx];
  }

  enter(): void {
    audio.setMusic('menu');
    this.build();
  }
  resize(): void {
    this.build();
  }

  private build(): void {
    this.ui.clear();
    const st = this.game.safeTop, H = this.game.H, sb = this.game.safeBottom;
    const back = this.ui.add(new Button(16, st + 14, 150, 62, t('common.back'), () => this.goBack()));
    back.style(C.uiPanelHi, C.uiPanel);
    back.size = 24;
    back.sfx = 'back';
    const ay = st + 300;
    const prev = this.ui.add(new Button(14, ay - 40, 70, 80, '<', () => this.cycle(-1)));
    prev.style(C.uiPanelHi, C.uiPanel);
    prev.size = 44;
    const next = this.ui.add(new Button(636, ay - 40, 70, 80, '>', () => this.cycle(1)));
    next.style(C.uiPanelHi, C.uiPanel);
    next.size = 44;
    // attack chips
    let y = st + 620;
    for (const slot of SLOT_ORDER) {
      const ids = ATTACKS_BY_SLOT[slot];
      ids.forEach((id, i) => {
        const b = this.ui.add(new Button(170 + i * 180, y, 170, 70, t(`attack.${id}.name`), () => this.pick(slot, id)));
        b.size = 17;
        b.iconName = ATTACK_ICON[id];
        b.iconSize = 26;
        b.custom = null;
        (b as Button & { slot: AttackSlot; aid: string }).slot = slot;
        (b as Button & { slot: AttackSlot; aid: string }).aid = id;
      });
      y += 86;
    }
    if (store.data.endless) {
      const mode = this.ui.add(new Button(40, H - sb - 196, 640, 64, '', () => (this.endless = !this.endless)));
      mode.style(C.uiPanelHi, C.uiPanel);
      mode.custom = (ctx, b) => {
        text(ctx, t('hub.endless'), -b.w / 2 + 24, 0, { size: 24, align: 'left' });
        roundRectPath(ctx, b.w / 2 - 110, -18, 90, 36, 18);
        fillStroke(ctx, this.endless ? C.uiGood : '#5a5068', 3.5);
        text(ctx, this.endless ? t('common.on') : t('common.off'), b.w / 2 - 65, 1, { size: 15 });
      };
    }
    this.startBtn = this.ui.add(new Button(40, H - sb - 116, 640, 96, t('select.start'), () => this.start()));
    this.startBtn.size = 46;
    this.startBtn.pulse = true;
    this.startBtn.sfx = 'fanfare';
    this.refresh();
  }

  private refresh(): void {
    for (const b of this.ui.buttons) {
      const x = b as Button & { slot?: AttackSlot; aid?: string };
      if (!x.slot || !x.aid) continue;
      const owned = store.has(x.aid);
      const sel = store.data.attacks[x.slot] === x.aid;
      b.enabled = owned;
      b.style(sel ? ATTACKS[x.aid as keyof typeof ATTACKS].color : C.uiPanelHi, sel ? C.crimsonDark : C.uiPanel);
      b.textColor = sel ? C.ink : C.white;
      b.iconName = owned ? ATTACK_ICON[x.aid] : 'lock';
    }
    const owned = store.has(this.boss);
    this.startBtn.enabled = owned;
    this.startBtn.label = owned ? t('select.start') : t('common.locked');
  }

  private cycle(d: number): void {
    this.idx = (this.idx + d + BOSS_ORDER.length) % BOSS_ORDER.length;
    if (store.has(this.boss)) {
      store.data.selectedBoss = this.boss;
      store.save();
    }
    audio.play('laugh');
    this.refresh();
  }

  private pick(slot: AttackSlot, id: string): void {
    store.data.attacks[slot] = id as never;
    store.save();
    this.refresh();
  }

  private start(): void {
    if (!store.has(this.boss)) return;
    store.data.selectedBoss = this.boss;
    store.save();
    void import('./RunScene').then(({ RunScene }) => this.game.setScene(new RunScene(this.game, { endless: this.endless })));
  }

  private goBack(): void {
    void import('./HubScene').then(({ HubScene }) => this.game.setScene(new HubScene(this.game)));
  }

  back(): boolean {
    this.goBack();
    return true;
  }

  update(dt: number, rdt: number): void {
    this.t += rdt;
    this.ui.update(rdt);
    void dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H, st = this.game.safeTop;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241036');
    g.addColorStop(1, '#0b0612');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    text(ctx, t('select.title'), W / 2 + 60, st + 46, { size: 32, color: C.goldHi });
    const def = BOSSES[this.boss];
    const owned = store.has(this.boss);
    glow(ctx, W / 2, st + 300, 260, def.main, 0.3);
    drawBoss(ctx, this.boss, W / 2, st + 440, 0.62, {
      t: this.t, mood: 'idle', hurt: 0, lookX: Math.sin(this.t) * 0.3, lookY: 0.3, rage: 0.4, charge: 0,
      crown: store.data.cosmetics.crown, skin: skinVariant(store.data.cosmetics.skin),
    });
    if (!owned) {
      ctx.fillStyle = 'rgba(10,4,18,0.65)';
      ctx.fillRect(100, st + 120, 520, 330);
      icon(ctx, 'lock', W / 2, st + 270, 70);
      text(ctx, t('select.locked'), W / 2, st + 330, { size: 22 });
      icon(ctx, 'soul', W / 2 - 40, st + 372, 28);
      text(ctx, String(def.unlock), W / 2, st + 373, { size: 26, color: '#8fe8ff', align: 'left' });
    }
    panel(ctx, 30, st + 458, 660, 136, '#2b1840', 4);
    text(ctx, t(`boss.${this.boss}.name`), W / 2, st + 486, { size: 30, color: def.accent });
    textBlock(ctx, t(`boss.${this.boss}.desc`), W / 2, st + 530, 600, { size: 18, lw: 3 });
    icon(ctx, 'heart', 250, st + 572, 22);
    text(ctx, `${def.hp + store.upg('bossHp') * 4} PV`, 270, st + 573, { size: 18, align: 'left' });
    icon(ctx, 'rage', 400, st + 572, 22);
    text(ctx, t(`boss.${this.boss}.ult`), 420, st + 573, { size: 18, align: 'left', color: C.lavaHi });
    // slot labels
    let y = st + 655;
    for (const slot of SLOT_ORDER) {
      icon(ctx, slot, 60, y, 34, this.t);
      text(ctx, t(slot === 'tap' ? 'hud.tapHold' : slot === 'swipe' ? 'hud.swipe' : 'hud.hold'), 108, y, { size: 18, align: 'left' });
      y += 86;
    }
    this.ui.draw(ctx, this.t);
  }

  pointerDown(p: Pointer): void {
    this.ui.down(p.x, p.y);
  }
  pointerUp(p: Pointer): void {
    this.ui.up(p.x, p.y);
  }
}
