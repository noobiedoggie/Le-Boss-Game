import { C } from '../render/palette';
import { fillStroke, shade, text, wobblyRectPath } from '../render/draw';
import { icon } from '../render/icons';
import { Spring } from '../core/math';
import { audio } from '../systems/Audio';
import { haptics } from '../systems/Haptics';

/** Chunky hand-drawn button with squash on press. */
export class Button {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub = '';
  color: string = C.uiBtn;
  dark: string = C.uiBtnDark;
  textColor: string = C.white;
  size = 30;
  iconName = '';
  iconSize = 30;
  enabled = true;
  visible = true;
  pressed = false;
  pulse = false;
  badge = '';
  seed = Math.random() * 100;
  sfx = 'click';
  private spring = new Spring(420, 16);
  onClick: () => void;
  custom: ((ctx: CanvasRenderingContext2D, b: Button, t: number) => void) | null = null;

  constructor(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.onClick = onClick;
  }

  style(color: string, dark: string): this {
    this.color = color;
    this.dark = dark;
    return this;
  }

  contains(px: number, py: number): boolean {
    return this.visible && px >= this.x - 6 && px <= this.x + this.w + 6 && py >= this.y - 6 && py <= this.y + this.h + 6;
  }

  press(): void {
    this.pressed = true;
    this.spring.kick(-6);
  }

  release(inside: boolean): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.spring.kick(8);
    if (inside) {
      if (this.enabled) {
        audio.play(this.sfx);
        haptics.impact('light');
        this.onClick();
      } else audio.play('error');
    }
  }

  update(dt: number): void {
    this.spring.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D, t: number): void {
    if (!this.visible) return;
    const s = this.spring.value;
    const pulse = this.pulse && this.enabled ? Math.sin(t * 6) * 0.03 : 0;
    const sx = 1 + s * 0.012 + pulse, sy = 1 - s * 0.012 + pulse;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.rotate(Math.sin(this.seed) * 0.012);
    const down = this.pressed ? 4 : 0;
    const col = this.enabled ? this.color : '#5a5068';
    const dk = this.enabled ? this.dark : '#3a3348';
    // drop shadow / 3D base
    wobblyRectPath(ctx, -this.w / 2, -this.h / 2 + 7, this.w, this.h, 18, this.seed, 1.6);
    fillStroke(ctx, dk, 4.5);
    wobblyRectPath(ctx, -this.w / 2, -this.h / 2 + down, this.w, this.h, 18, this.seed, 1.6);
    fillStroke(ctx, col, 4.5);
    // gloss
    wobblyRectPath(ctx, -this.w / 2 + 8, -this.h / 2 + 5 + down, this.w - 16, this.h * 0.34, 12, this.seed + 3, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    if (this.custom) this.custom(ctx, this, t);
    else {
      let tx = 0;
      if (this.iconName) {
        const ix = this.label ? -this.w / 2 + 14 + this.iconSize / 2 : 0;
        icon(ctx, this.iconName, ix, down + (this.sub ? -6 : 0), this.iconSize, t);
        tx = this.label ? this.iconSize / 2 + 4 : 0;
      }
      // dark text on light buttons: no heavy outline (readability)
      const darkText = this.enabled && this.textColor === C.ink;
      const o = darkText ? { lw: 0, shadow: false } : {};
      if (this.label) {
        text(ctx, this.label, tx, down + (this.sub ? -9 : 1), { size: this.size, color: this.enabled ? this.textColor : '#b8aec9', maxWidth: this.w - 24 - (this.iconName ? this.iconSize + 8 : 0), ...o });
      }
      if (this.sub) text(ctx, this.sub, tx, down + this.h * 0.24, { size: this.size * 0.55, color: shade(this.enabled ? this.textColor : '#b8aec9', -0.05), maxWidth: this.w - 20, ...o });
    }
    if (this.badge) {
      ctx.save();
      ctx.translate(this.w / 2 - 10, -this.h / 2 + 4);
      ctx.rotate(0.15);
      text(ctx, this.badge, 0, 0, { size: 16, color: C.goldHi, stroke: C.crimsonDark });
      ctx.restore();
    }
    ctx.restore();
  }
}

/** Minimal button group: routes pointer events and draws. */
export class UI {
  buttons: Button[] = [];
  private active: Button | null = null;

  add(b: Button): Button {
    this.buttons.push(b);
    return b;
  }
  clear(): void {
    this.buttons = [];
    this.active = null;
  }
  down(x: number, y: number): boolean {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (b.contains(x, y)) {
        this.active = b;
        b.press();
        return true;
      }
    }
    return false;
  }
  up(x: number, y: number): boolean {
    const b = this.active;
    this.active = null;
    if (!b) return false;
    b.release(b.contains(x, y));
    return true;
  }
  cancel(): void {
    if (this.active) this.active.release(false);
    this.active = null;
  }
  update(dt: number): void {
    for (const b of this.buttons) b.update(dt);
  }
  draw(ctx: CanvasRenderingContext2D, t: number): void {
    for (const b of this.buttons) b.draw(ctx, t);
  }
}
