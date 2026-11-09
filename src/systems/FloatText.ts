import { fx } from '../core/Rng';

/** Bouncy floating texts: damage numbers, combo callouts, gold gains... */
export type FTKind = 'dmg' | 'crit' | 'heal' | 'gold' | 'info' | 'combo' | 'big' | 'bad';

export interface FloatText {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: FTKind;
  rot: number;
}

const MAX = 70;

export class FloatTexts {
  list: FloatText[] = [];

  add(text: string, x: number, y: number, kind: FTKind = 'dmg', color = '#fff', size = 26): void {
    if (this.list.length >= MAX) {
      // drop the oldest small number first
      const i = this.list.findIndex((f) => f.kind === 'dmg');
      this.list.splice(i >= 0 ? i : 0, 1);
    }
    const big = kind === 'combo' || kind === 'big';
    this.list.push({
      text, x: x + (big ? 0 : fx.r(-8, 8)), y,
      vx: big ? 0 : fx.r(-30, 30),
      vy: big ? -40 : kind === 'dmg' || kind === 'crit' ? -220 : -90,
      life: big ? 1.4 : kind === 'info' ? 1.3 : 0.85,
      max: big ? 1.4 : kind === 'info' ? 1.3 : 0.85,
      size, color, kind,
      rot: big ? fx.r(-0.12, 0.12) : fx.r(-0.15, 0.15),
    });
  }

  update(dt: number): void {
    let w = 0;
    for (const f of this.list) {
      f.life -= dt;
      if (f.life <= 0) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'dmg' || f.kind === 'crit') f.vy += 520 * dt; // arc
      else f.vy *= Math.exp(-3 * dt);
      this.list[w++] = f;
    }
    this.list.length = w;
  }
}
