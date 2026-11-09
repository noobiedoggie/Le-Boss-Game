import { MenuScene } from './MenuScene';
import { C } from '../render/palette';
import { fillStroke, roundRectPath, text, textBlock } from '../render/draw';
import { Button } from '../ui/Button';
import { store } from '../systems/Save';
import { audio } from '../systems/Audio';
import { haptics } from '../systems/Haptics';
import { setLang, t, type Lang } from '../i18n';

export class SettingsScene extends MenuScene {
  confirm = false;

  build(): void {
    this.title = t('set.title');
    this.showSouls = false;
    const s = store.data.settings;
    let y = this.top + 10;
    const toggle = (label: () => string, get: () => boolean, set: () => void) => {
      const b = this.ui.add(new Button(40, y, 640, 76, '', () => {
        set();
        this.apply();
      }));
      b.style(C.uiPanelHi, C.uiPanel);
      b.custom = (ctx, bb) => {
        text(ctx, label(), -bb.w / 2 + 24, 0, { size: 26, align: 'left' });
        roundRectPath(ctx, bb.w / 2 - 120, -20, 100, 40, 20);
        fillStroke(ctx, get() ? C.uiGood : '#5a5068', 3.5);
        text(ctx, get() ? t('common.on') : t('common.off'), bb.w / 2 - 70, 1, { size: 16 });
      };
      y += 92;
    };
    toggle(() => t('set.sfx'), () => s.sfx > 0, () => (s.sfx = s.sfx > 0 ? 0 : 0.9));
    toggle(() => t('set.music'), () => s.music > 0, () => (s.music = s.music > 0 ? 0 : 0.6));
    toggle(() => t('set.haptics'), () => s.haptics, () => (s.haptics = !s.haptics));
    toggle(() => t('set.shake'), () => s.shake, () => (s.shake = !s.shake));
    const lang = this.ui.add(new Button(40, y, 640, 76, '', () => {
      const next: Lang = s.lang === 'fr' ? 'en' : 'fr';
      s.lang = next;
      setLang(next);
      this.apply();
      this.rebuild();
    }));
    lang.style(C.uiPanelHi, C.uiPanel);
    lang.custom = (ctx, bb) => {
      text(ctx, t('set.lang'), -bb.w / 2 + 24, 0, { size: 26, align: 'left' });
      text(ctx, t(`lang.${s.lang}`), bb.w / 2 - 30, 0, { size: 24, align: 'right', color: C.goldHi });
    };
    y += 110;
    const reset = this.ui.add(new Button(40, y, 640, 70, t('set.reset'), () => {
      if (!this.confirm) {
        this.confirm = true;
        reset.label = t('set.resetConfirm');
        return;
      }
      void store.reset().then(() => {
        this.confirm = false;
        this.rebuild();
      });
    }));
    reset.size = 22;
    this.contentH = 0;
  }

  private apply(): void {
    const s = store.data.settings;
    audio.setVolumes(s.sfx, s.music);
    haptics.enabled = s.haptics;
    this.game.camera.intensity = s.shake ? 1 : 0.15;
    store.save();
  }

  drawContent(ctx: CanvasRenderingContext2D, _y0: number): void {
    textBlock(ctx, t('set.credits'), 360, this.game.H - this.game.safeBottom - 60, 600, { size: 16, color: '#9a8ab0', lw: 3 });
  }
}
