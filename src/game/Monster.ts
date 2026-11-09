import { Spring, dist } from '../core/math';
import type { MonsterId } from '../data/types';
import { MONSTERS, MONSTER_LEVEL_MUL, MONSTER_XP } from '../data/monsters';
import type { World } from './World';
import type { Hero } from './Hero';

/** A placed monster lair occupying one tile. Owns 1+ bodies that respawn. */
export class Den {
  kind: MonsterId;
  tile: number;
  invested: number;
  placedThisBuild = true;
  kills = 0;
  bodies: Monster[] = [];
  constructor(kind: MonsterId, tile: number, invested: number) {
    this.kind = kind;
    this.tile = tile;
    this.invested = invested;
  }
  get level(): number {
    return this.kills >= MONSTER_XP[2] ? 3 : this.kills >= MONSTER_XP[1] ? 2 : 1;
  }
}

export type MonsterState = 'idle' | 'chase' | 'fight' | 'return' | 'dead' | 'minion';

/**
 * A monster body. Den monsters guard their post; minions (raised dead,
 * summons, Army of the Dead) march up the path towards the entrance.
 */
export class Monster {
  kind: MonsterId;
  den: Den | null;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  state: MonsterState = 'idle';
  target: Hero | null = null;
  holding: Hero[] = [];
  atkT = 0;
  respawnT = 0;
  friendT = 0;
  facing = 1;
  flash = 0;
  squash = new Spring(280, 12);
  walkPhase = 0;
  /** minion only */
  life = 0;
  minionKind: 'skeleton' | 'goblin' | 'slimeling' | null = null;
  minionDmg = 0;
  level = 1;
  evolveFx = 0;
  t = Math.random() * 10;
  /** offset for multi-body dens */
  ox = 0;
  oy = 0;

  constructor(kind: MonsterId, den: Den | null, x: number, y: number) {
    this.kind = kind;
    this.den = den;
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.maxHp = this.hp = MONSTERS[kind].hp;
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }
  get def() {
    return MONSTERS[this.kind];
  }
  get isMinion(): boolean {
    return this.minionKind !== null;
  }

  levelMul(): number {
    return MONSTER_LEVEL_MUL[(this.den?.level ?? 1) - 1];
  }

  refreshStats(w: World): void {
    const mul = this.levelMul();
    const newMax = Math.round(this.def.hp * mul * w.mods.monsterHp);
    if (newMax !== this.maxHp) {
      const ratio = this.hp / this.maxHp;
      this.maxHp = newMax;
      this.hp = Math.max(1, Math.round(newMax * ratio));
    }
  }

  damage(w: World): number {
    if (this.isMinion) return this.minionDmg;
    return this.def.dmg * this.levelMul() * w.mods.monsterDmg;
  }

  release(): void {
    for (const h of this.holding) h.engagedBy = h.engagedBy.filter((m) => m !== this);
    this.holding.length = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.squash.update(dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.evolveFx > 0) this.evolveFx -= dt;
    if (this.state === 'dead') {
      if (this.den) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) w.respawnMonster(this);
      }
      return;
    }
    if (this.den) {
      const lvl = this.den.level;
      if (lvl !== this.level) {
        this.level = lvl;
        this.refreshStats(w);
        this.hp = this.maxHp;
        this.evolveFx = 1.2;
        w.monsterEvolved(this);
      }
    }
    // Lava floors pact also hurts our own monsters.
    if (w.mods.lavaFloor > 0 && !this.def.flying) {
      this.hp -= w.mods.lavaFloor * 0.5 * dt;
      if (this.hp <= 0) {
        w.killMonster(this);
        return;
      }
    }
    if (this.friendT > 0) {
      this.friendT -= dt;
      this.release();
      return;
    }
    if (w.phase !== 'wave') {
      this.release();
      this.target = null;
      this.goHome(dt);
      return;
    }
    if (this.isMinion) {
      this.updateMinion(w, dt);
      return;
    }
    if (this.def.ranged) this.updateRanged(w, dt);
    else this.updateMelee(w, dt);
  }

  private goHome(dt: number): void {
    const hx = this.homeX + this.ox, hy = this.homeY + this.oy;
    const d = dist(this.x, this.y, hx, hy);
    if (d > 0.05) {
      const s = Math.min(d, Math.max(1.5, this.def.speed) * dt);
      this.x += ((hx - this.x) / d) * s;
      this.y += ((hy - this.y) / d) * s;
      this.walkPhase += s * 8;
      this.facing = hx > this.x ? 1 : -1;
    }
  }

  private updateRanged(w: World, dt: number): void {
    this.atkT -= dt;
    if (this.atkT > 0) return;
    const h = w.nearestHero(this.homeX, this.homeY, this.def.range, (x) => x.targetable && !x.ally);
    if (!h) return;
    this.atkT = this.def.atkCd;
    this.facing = h.x > this.x ? 1 : -1;
    this.squash.kick(-3);
    w.monsterShoots(this, h);
  }

  private updateMelee(w: World, dt: number): void {
    const def = this.def;
    // drop dead / escaped targets
    this.holding = this.holding.filter((h) => h.alive && h.state === 'fight' && h.engagedBy.includes(this));
    if (this.target && (!this.target.targetable || this.target.ally || this.target.state === 'air')) this.target = null;
    const leash = def.aggro + 1.2;
    if (this.target && dist(this.target.x, this.target.y, this.homeX, this.homeY) > leash) {
      this.release();
      this.target = null;
    }
    if (!this.target) {
      this.target = w.nearestHero(this.homeX, this.homeY, def.aggro, (h) => h.targetable && !h.ally && h.state !== 'air' && h.z < 0.1, this.x, this.y);
      if (!this.target) {
        this.goHome(dt);
        return;
      }
    }
    const h = this.target;
    const d = dist(this.x, this.y, h.x, h.y);
    const reach = def.range + 0.15 * h.scale;
    if (d > reach) {
      const s = Math.min(d - reach * 0.8, def.speed * dt);
      this.x += ((h.x - this.x) / d) * s;
      this.y += ((h.y - this.y) / d) * s;
      this.walkPhase += s * 8;
      this.facing = h.x > this.x ? 1 : -1;
      return;
    }
    // Engage / block.
    this.facing = h.x > this.x ? 1 : -1;
    if (def.blocks > 0 && !w.enraged && !this.holding.includes(h) && this.holding.length < def.blocks && !h.has('speedrunner') && h.superId !== 'speedguild') {
      if (h.has('pacifist') && !h.befriended) {
        h.befriended = true;
        this.friendT = 10;
        this.target = null;
        w.befriend(h, this);
        return;
      }
      this.holding.push(h);
      if (!h.engagedBy.includes(this)) h.engagedBy.push(this);
    }
    this.atkT -= dt;
    if (this.atkT <= 0) {
      this.atkT = def.atkCd;
      this.squash.kick(-4);
      w.monsterHits(this, h);
      // Ogre club splashes around.
      if (this.kind === 'ogre') w.splash(this, h);
    }
    // grab extra heroes if we can block more
    if (w.enraged) this.release();
    else if (this.holding.length < def.blocks) {
      const extra = w.nearestHero(this.x, this.y, 0.9, (x) => x !== h && x.targetable && !x.ally && x.state === 'walk' && !x.has('speedrunner'));
      if (extra && !extra.has('pacifist')) {
        this.holding.push(extra);
        extra.engagedBy.push(this);
      }
    }
  }

  /** Minions walk toward the entrance and brawl with any hero they meet. */
  private updateMinion(w: World, dt: number): void {
    this.life -= dt;
    if (this.life <= 0) {
      w.killMonster(this, true);
      return;
    }
    this.holding = this.holding.filter((h) => h.alive && h.engagedBy.includes(this));
    if (this.target && !this.target.targetable) this.target = null;
    if (!this.target) this.target = w.nearestHero(this.x, this.y, 2.2, (h) => h.targetable && !h.ally && h.state !== 'air');
    if (this.target) {
      const h = this.target;
      const d = dist(this.x, this.y, h.x, h.y);
      if (d > 0.5) {
        const s = 2.2 * dt;
        this.x += ((h.x - this.x) / d) * s;
        this.y += ((h.y - this.y) / d) * s;
        this.walkPhase += s * 8;
        this.facing = h.x > this.x ? 1 : -1;
      } else {
        if (!this.holding.includes(h) && this.holding.length < 1 && !h.has('speedrunner')) {
          this.holding.push(h);
          h.engagedBy.push(this);
        }
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 0.75;
          this.squash.kick(-4);
          w.monsterHits(this, h);
        }
      }
      return;
    }
    // march up the path
    const f = w.board.field(w.board.entranceIdx, 'toEntrance');
    const tile = w.board.tileAtGrid(this.x, this.y);
    if (tile < 0) return;
    const next = w.board.nextStep(tile, f);
    if (next < 0) return;
    const tx = w.board.col(next) + 0.5, ty = w.board.row(next) + 0.5;
    const d = dist(this.x, this.y, tx, ty);
    if (d > 0.01) {
      const s = Math.min(d, 1.6 * dt);
      this.x += ((tx - this.x) / d) * s;
      this.y += ((ty - this.y) / d) * s;
      this.walkPhase += s * 8;
      this.facing = tx > this.x ? 1 : -1;
    }
  }
}
