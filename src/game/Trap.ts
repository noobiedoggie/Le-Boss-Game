import { Spring, dist } from '../core/math';
import type { TrapId } from '../data/types';
import { TRAPS } from '../data/traps';
import type { World, DmgSource } from './World';
import type { Hero } from './Hero';
import { COLS } from './Board';

/**
 * A trap on a tile. Traps are walkable: heroes step over them.
 * Each type has its own trigger logic below; `fire()` is the effect so the
 * Echo pact can simply call it twice.
 */
export class Trap {
  kind: TrapId;
  tile: number;
  cx: number;
  cy: number;
  level = 1;
  invested: number;
  placedThisBuild = true;
  cd = 0;
  kills = 0;
  /** animation timer since last trigger */
  anim = 9;
  /** axe swing direction */
  swingDir = 1;
  /** fire jet aim (grid angle) */
  aim = Math.PI / 2;
  illegal = false;
  disarmed = false;
  echoT = -1;
  squash = new Spring(320, 12);
  src: DmgSource;
  pending: Hero | null = null;
  chew = 0;

  constructor(kind: TrapId, tile: number, cx: number, cy: number, invested: number) {
    this.kind = kind;
    this.tile = tile;
    this.cx = cx;
    this.cy = cy;
    this.invested = invested;
    this.src = { kind: 'trap', id: kind, trap: this };
  }

  get def() {
    return TRAPS[this.kind];
  }
  get stats() {
    return this.def.levels[this.level - 1];
  }
  get active(): boolean {
    return !this.illegal && !this.disarmed;
  }

  /** Heroes standing on this tile. */
  onTile(w: World): Hero[] {
    const out: Hero[] = [];
    for (const h of w.heroes) {
      if (!h.grounded || h.ally) continue;
      if (h.y >= 0 && h.x >= 0 && h.x < COLS && Math.floor(h.x) + Math.floor(h.y) * COLS === this.tile) out.push(h);
    }
    return out;
  }

  update(w: World, dt: number): void {
    this.anim += dt;
    this.squash.update(dt);
    if (this.chew > 0) this.chew -= dt;
    if (w.phase !== 'wave' || !this.active) return;
    if (this.cd > 0) this.cd -= dt;
    if (this.echoT >= 0) {
      this.echoT -= dt;
      if (this.echoT < 0) this.fire(w, true);
    }
    const s = this.stats;
    switch (this.kind) {
      case 'spikes':
      case 'trapdoor':
      case 'bounce':
        if (this.cd <= 0 && this.onTile(w).length) this.trigger(w);
        break;
      case 'slime': {
        for (const h of this.onTile(w)) {
          const f = Math.max(0.12, 1 - (1 - s.p) * w.mods.slowPower);
          h.slowF = Math.min(h.slowF, f);
          h.slowT = Math.max(h.slowT, 1.1);
          h.slimedT = 2.5;
        }
        if (s.dmg > 0 && this.cd <= 0 && this.onTile(w).length) this.trigger(w);
        break;
      }
      case 'firejet': {
        if (this.cd > 0) break;
        const h = w.nearestHero(this.cx, this.cy, s.p, (x) => x.grounded && !x.ally);
        if (h) {
          this.aim = Math.atan2(h.y - this.cy, h.x - this.cx);
          this.trigger(w);
        }
        break;
      }
      case 'axe': {
        if (this.cd > 0) break;
        const h = w.nearestHero(this.cx, this.cy, 1.25, (x) => x.grounded && !x.ally);
        if (h) this.trigger(w);
        break;
      }
      case 'gas': {
        if (this.cd > 0) break;
        const h = w.nearestHero(this.cx, this.cy, s.p + 0.6, (x) => x.grounded && !x.ally);
        if (h) this.trigger(w);
        break;
      }
      case 'mimic': {
        // Lure greedy heroes in range.
        for (const h of w.heroes) {
          if (!h.greedy || h.mimicTarget || h.visitedMimics.has(this) || h.state !== 'walk' || h.ally) continue;
          if (dist(h.x, h.y, this.cx, this.cy) < 3.2) {
            h.visitedMimics.add(this);
            if (w.mimicReachable(this)) {
              h.mimicTarget = this;
              h.curTile = -2;
              if (w.rng.chance(0.5)) h.say(w, w.pick('q.mimic'), 1.6);
            }
          }
        }
        break;
      }
    }
  }

  trigger(w: World): void {
    this.cd = this.cooldown(w);
    this.fire(w, false);
    if (w.mods.echo) this.echoT = 0.22;
  }

  cooldown(w: World): number {
    let cd = this.stats.cd * w.mods.trapCd;
    if (this.kind === 'bounce') cd *= w.mods.bounceCd;
    return Math.max(0.15, cd);
  }

  /** The actual effect. `echo` = repeat from the Echo pact. */
  fire(w: World, echo: boolean): void {
    const s = this.stats;
    this.anim = 0;
    this.squash.kick(echo ? 4 : 7);
    switch (this.kind) {
      case 'spikes': {
        const hs = this.onTile(w);
        for (const h of hs) w.damageHero(h, s.dmg * w.mods.spikeDmg, 'phys', this.src);
        if (hs.length) w.ev.sfx('spike');
        break;
      }
      case 'slime':
        for (const h of this.onTile(w)) w.damageHero(h, s.dmg, 'poison', this.src, { dot: true });
        break;
      case 'firejet':
        w.fireCone(this, this.cx, this.cy, this.aim, s.p, 0.6, s.dmg);
        break;
      case 'axe':
        this.swingDir *= -1;
        w.axeSwing(this, s.dmg, s.p);
        break;
      case 'gas':
        w.spawnZone({ kind: 'gas', x: this.cx, y: this.cy, r: s.p, dur: 2.6, dps: s.dmg, type: 'poison', src: this.src });
        w.ev.sfx('gas');
        break;
      case 'trapdoor': {
        const hs = this.onTile(w);
        for (const h of hs) w.trapdoor(this, h, s.dmg, s.p);
        if (hs.length) w.ev.sfx('trapdoor');
        break;
      }
      case 'bounce': {
        const hs = this.onTile(w);
        for (const h of hs) w.bounceHero(this, h);
        break;
      }
      case 'mimic':
        break;
    }
  }
}
