import { Spring, clamp, dist, lerp } from '../core/math';
import type { DamageType, HeroClassId, ModId, SuperId } from '../data/types';
import { HERO_CLASSES, MODS } from '../data/heroes';
import type { HeroSpec } from './HeroGen';
import { COLS, ROWS, Tile } from './Board';
import type { World, DmgSource } from './World';
import type { Monster } from './Monster';
import type { Trap } from './Trap';
import { tr } from '../i18n';

export type HeroState =
  | 'walk' | 'fight' | 'air' | 'throne' | 'flung' | 'flee' | 'eaten' | 'fall' | 'respawn' | 'cast' | 'dead' | 'gone' | 'possessed' | 'argue';

export type Expr = 'smug' | 'scared' | 'hurt' | 'dead' | 'angry';

export interface PaladinHead {
  hp: number;
  max: number;
  alive: boolean;
}

let NEXT_ID = 1;

/** Per-wave stat scaling of heroes. */
export function heroHpScale(wave: number): number {
  const w = wave - 1;
  return 1 + 0.5 * w + 0.07 * w * w;
}

export class Hero {
  readonly id = NEXT_ID++;
  spec: HeroSpec;
  cls: HeroClassId;
  mods: Set<ModId>;
  superId: SuperId | undefined;
  name: string;

  x: number;
  y: number;
  /** height above floor, in tiles (bounce, flung...) */
  z = 0;
  vx = 0;
  vy = 0;
  tx: number;
  ty: number;
  lane: number;
  bias: number;
  curTile = -1;

  hp: number;
  maxHp: number;
  armor: number;
  speed: number;
  bossDmg: number;
  dmg: number;
  atkCd: number;
  range: number;
  bounty: number;
  scale: number;

  state: HeroState = 'walk';
  stateT = 0;
  t = 0;
  // statuses
  slowT = 0;
  slowF = 1;
  burnT = 0;
  burnDps = 0;
  poisonT = 0;
  poisonDps = 0;
  stunT = 0;
  freezeT = 0;
  slimedT = 0;
  buffT = 0;
  invuln = 0;
  private dotTimer = 0;
  burnSrc: DmgSource | null = null;
  poisonSrc: DmgSource | null = null;

  // visuals
  squash = new Spring(300, 13);
  flash = 0;
  facing = 1;
  walkPhase = 0;
  expr: Expr = 'smug';
  exprT = 0;
  rot = 0;
  spin = 0;
  /** backflip progress 1 -> 0 (speedrunners) */
  flip = 0;
  bubble: { text: string; t: number } | null = null;
  quoteCd = 0;
  spawnPop = 0.35;

  // AI
  atkTimer = 0;
  engagedBy: Monster[] = [];
  mimicTarget: Trap | null = null;
  visitedMimics = new Set<Trap>();
  greedy: boolean;
  lives = 1;
  respawned = false;
  fled = false;
  befriended = false;
  hitBoss = false;
  lastSrc: DmgSource | null = null;
  lastType: DamageType = 'phys';
  dmgTypes = new Set<DamageType>();
  plotArmor = false;
  air: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; h: number; trap: Trap | null } | null = null;
  castT = 0;
  castWall = -1;
  wallCd = 0;
  healCd = 1;
  abilityCd = 0;
  dodgeCd = 0;
  potion = true;
  possessedT = 0;
  ally = false;
  heads: PaladinHead[] = [];
  shieldT = 0;
  argueT = 6;
  activeHead = 0;
  waveSpawned: number;
  /** For "most humiliating death" scoring. */
  humiliation = 0;
  bounced = 0;
  /** true once dead / leaked / escaped: no longer counts for the wave */
  done = false;

  constructor(spec: HeroSpec, w: World, x: number, y: number) {
    this.spec = spec;
    this.cls = spec.cls;
    this.mods = new Set(spec.mods);
    this.superId = spec.superId;
    this.name = spec.name;
    this.waveSpawned = w.wave;
    const c = HERO_CLASSES[spec.cls];
    let hpMul = heroHpScale(w.wave) * w.mods.heroHp * (spec.hpBonus ?? 1);
    let spd = c.speed * w.mods.heroSpeed;
    let scale = 1, bossDmg = c.bossDmg, dmg = c.dmg * (1 + w.wave * 0.06), bounty = c.bounty;
    for (const m of spec.mods) {
      const d = MODS[m];
      hpMul *= d.hpMul;
      spd *= d.speedMul;
      scale *= d.scale;
      bossDmg *= d.bossDmgMul;
      dmg *= d.dmgMul;
      bounty *= d.bountyMul;
    }
    this.maxHp = this.hp = Math.round(c.hp * hpMul);
    this.armor = c.armor;
    this.speed = spd;
    this.bossDmg = Math.max(1, Math.round(bossDmg * (1 + (w.wave - 1) * 0.07)));
    this.dmg = dmg;
    this.atkCd = c.atkCd;
    this.range = c.range;
    this.bounty = Math.max(1, Math.round(bounty * (1 + w.wave * 0.02)));
    this.scale = scale;
    this.x = x;
    this.y = y;
    this.tx = x;
    this.ty = y;
    this.lane = w.rng.range(-0.2, 0.2);
    this.bias = w.rng.range(-1, 1);
    this.greedy = !this.mods.has('speedrunner') && (this.cls === 'rogue' || w.rng.chance(0.55));
    if (this.mods.has('threeheads')) this.lives = 3;
    if (spec.returning) this.fled = true; // already ran away once: no second chance
    this.atkTimer = w.rng.range(0, 1);
    this.quoteCd = w.rng.range(0.5, 4);
    this.applySuper(w);
  }

  private applySuper(w: World): void {
    switch (this.superId) {
      case 'chosen':
        this.plotArmor = true;
        this.maxHp = this.hp = Math.round(this.maxHp * 6);
        this.scale = 1.35;
        this.bossDmg = 3;
        this.speed = 0.7 * w.mods.heroSpeed;
        this.bounty = 120;
        break;
      case 'speedguild':
        this.speed *= 1.0;
        this.bounty = 14;
        break;
      case 'paladin3': {
        this.scale = 1.7;
        const per = Math.round(this.maxHp * 1.8);
        this.heads = [0, 1, 2].map(() => ({ hp: per, max: per, alive: true }));
        this.maxHp = this.hp = per * 3;
        this.bossDmg = 4;
        this.speed = 0.62 * w.mods.heroSpeed;
        this.bounty = 200;
        this.lives = 1;
        break;
      }
      case 'player':
        this.maxHp = this.hp = Math.round(this.maxHp * 9);
        this.scale = 1.3;
        this.bossDmg = 5;
        this.speed = 1.25 * w.mods.heroSpeed;
        this.bounty = 400;
        this.greedy = false;
        break;
    }
  }

  has(m: ModId): boolean {
    return this.mods.has(m);
  }
  get alive(): boolean {
    return this.state !== 'dead' && this.state !== 'gone' && this.state !== 'respawn';
  }
  /** Can be hit by traps / ground effects. */
  get grounded(): boolean {
    return this.alive && this.state !== 'air' && this.state !== 'flung' && this.state !== 'eaten' && this.state !== 'fall' && this.z < 0.05;
  }
  get targetable(): boolean {
    return this.alive && this.state !== 'flung' && this.state !== 'eaten' && this.state !== 'fall';
  }
  get isSuper(): boolean {
    return this.superId === 'chosen' || this.superId === 'paladin3' || this.superId === 'player';
  }
  get disabled(): boolean {
    return this.stunT > 0 || this.freezeT > 0;
  }

  say(w: World, text: string, dur = 2.2): void {
    if (!w.canSpeak(this)) return;
    this.bubble = { text, t: dur };
    this.quoteCd = w.rng.range(5, 10);
    w.ev.voice(this);
  }

  setExpr(e: Expr, t = 0.5): void {
    this.expr = e;
    this.exprT = t;
  }

  // ===================================================================
  update(w: World, dt: number): void {
    this.t += dt;
    this.stateT += dt;
    this.squash.update(dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.spawnPop > 0) this.spawnPop -= dt;
    if (this.flip > 0) this.flip = Math.max(0, this.flip - dt * 1.6);
    else if (this.mods.has('speedrunner') && this.state === 'walk' && Math.random() < dt * 0.25) this.flip = 1;
    if (this.bubble) {
      this.bubble.t -= dt;
      if (this.bubble.t <= 0) this.bubble = null;
    }
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = this.hp < this.maxHp * 0.3 ? 'scared' : 'smug';
    }
    if (this.state === 'dead' || this.state === 'gone') return;
    if (this.state === 'respawn') {
      if (this.stateT > 1.3) this.doRespawn(w);
      return;
    }
    if (this.state === 'flung') {
      this.updateFlung(dt);
      return;
    }
    if (this.state === 'eaten' || this.state === 'fall') {
      if (this.stateT > 0.45) w.finishDeath(this);
      return;
    }

    this.updateStatus(w, dt);
    if (!this.alive) return;

    if (this.knockUpdate(w, dt)) return;

    if (this.state === 'air') {
      this.updateAir(w, dt);
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      return;
    }
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      return;
    }
    this.quoteCd -= dt;
    if (this.quoteCd <= 0 && w.rng.chance(0.25)) this.idleQuote(w);
    else if (this.quoteCd <= 0) this.quoteCd = w.rng.range(3, 7);

    this.updateAbilities(w, dt);

    switch (this.state) {
      case 'walk':
      case 'flee':
        if (this.engagedBy.length && this.state === 'walk') {
          this.state = 'fight';
          this.stateT = 0;
          break;
        }
        this.walk(w, dt);
        break;
      case 'fight':
        this.fight(w, dt);
        break;
      case 'cast':
        this.updateCast(w, dt);
        break;
      case 'argue':
        if (this.stateT > 1.8) {
          this.state = 'walk';
          this.stateT = 0;
        }
        break;
      case 'throne':
        this.updateThrone(w, dt);
        break;
      case 'possessed':
        this.updatePossessed(w, dt);
        break;
    }
  }

  // ------------------------------------------------------------ statuses
  private updateStatus(w: World, dt: number): void {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slowF = 1;
    }
    if (this.slimedT > 0) this.slimedT -= dt;
    if (this.buffT > 0) this.buffT -= dt;
    if (this.shieldT > 0) this.shieldT -= dt;
    this.dotTimer -= dt;
    if (this.dotTimer <= 0) {
      this.dotTimer = 0.5;
      if (this.burnT > 0 && this.burnSrc) w.damageHero(this, this.burnDps * 0.5, 'fire', this.burnSrc, { dot: true });
      if (this.alive && this.poisonT > 0 && this.poisonSrc) w.damageHero(this, this.poisonDps * 0.5, 'poison', this.poisonSrc, { dot: true });
      if (this.alive && w.mods.lavaFloor > 0 && this.grounded && this.y > 0 && this.y < ROWS)
        w.damageHero(this, w.mods.lavaFloor * 0.5, 'fire', { kind: 'env', id: 'lava' }, { dot: true });
    }
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (w.rng.chance(dt * 10)) w.fxFire(this.x, this.y, 1);
    }
    if (this.poisonT > 0) this.poisonT -= dt;
  }

  /** Physical knockback. Returns true while being pushed. */
  private knockUpdate(w: World, dt: number): boolean {
    if (Math.abs(this.vx) + Math.abs(this.vy) < 0.05) {
      this.vx = this.vy = 0;
      return false;
    }
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    const c = Math.floor(nx), r = Math.floor(ny);
    const t = w.board.get(c, r);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      if (t === Tile.Pit && !this.isSuper) {
        this.x = nx;
        this.y = ny;
        w.heroFellInPit(this);
        return true;
      }
      if (t === Tile.Lava && !this.isSuper) {
        this.x = nx;
        this.y = ny;
        w.heroFellInLava(this);
        return true;
      }
      if (t === Tile.Pillar || t === Tile.Wall) {
        if (Math.hypot(this.vx, this.vy) > 2.5) w.bonk(this);
        this.vx = this.vy = 0;
        return false;
      }
    }
    if (c < 0 || c >= COLS) {
      this.vx = 0;
    } else this.x = nx;
    if (r >= -1 && r < ROWS) this.y = ny;
    else this.vy = 0;
    const k = Math.exp(-6 * dt);
    this.vx *= k;
    this.vy *= k;
    this.curTile = -2; // force re-path
    this.tx = this.x;
    this.ty = this.y;
    return true;
  }

  knock(dx: number, dy: number, power: number): void {
    if (this.isSuper) power *= 0.25;
    if (this.has('giant')) power *= 0.4;
    const d = Math.hypot(dx, dy) || 1;
    this.vx += (dx / d) * power * 7;
    this.vy += (dy / d) * power * 7;
  }

  // -------------------------------------------------------------- moving
  moveSpeed(w: World): number {
    let s = this.speed * this.slowF;
    if (this.buffT > 0) s *= 1.3;
    if (w.enraged) s *= 1.6;
    if (this.state === 'flee') s *= 1.35;
    const t = w.board.get(Math.floor(this.x), Math.floor(this.y));
    if (t === Tile.Water && !this.isSuper) s *= 0.65;
    return s;
  }

  private walk(w: World, dt: number): void {
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const tile = w.board.tileAtGrid(this.x, this.y);
    if (tile !== this.curTile) {
      this.curTile = tile;
      if (tile >= 0) w.heroEnteredTile(this, tile);
      if (!this.alive || this.state === 'air') return;
    }
    if (d < 0.06 || this.stateT === 0) {
      this.pickNext(w);
      if (this.state !== 'walk' && this.state !== 'flee') return;
    }
    const step = Math.min(d, this.moveSpeed(w) * dt);
    if (d > 0.0001) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      if (dx > 0.02) this.facing = 1;
      else if (dx < -0.02) this.facing = -1;
    }
    this.walkPhase += step * 8.5;
    if (this.state === 'flee' && this.y < -0.6) w.heroEscaped(this);
    // Thrown out of the grid into the throne zone?
    if (this.state === 'walk' && this.y > ROWS + 0.35) {
      this.state = 'throne';
      this.stateT = 0;
    }
  }

  /** Choose the next waypoint from the flow field. */
  pickNext(w: World): void {
    const b = w.board;
    const tile = b.tileAtGrid(this.x, this.y);
    const fleeing = this.state === 'flee';
    if (this.y < 0) {
      // still entering from above
      if (fleeing) {
        this.tx = this.x;
        this.ty = -1;
        return;
      }
      this.tx = b.entrance + 0.5 + this.lane;
      this.ty = 0.5;
      return;
    }
    if (this.y >= ROWS - 0.02 || tile < 0) {
      if (!fleeing) {
        this.tx = b.exit + 0.5 + this.lane * 2;
        this.ty = ROWS + 0.6;
        return;
      }
    }
    if (fleeing && tile === b.entranceIdx) {
      this.tx = b.entrance + 0.5;
      this.ty = -1;
      return;
    }
    if (!fleeing && this.mimicTarget && tile === this.mimicTarget.tile) {
      w.heroReachedMimic(this, this.mimicTarget);
      if (!this.alive) return;
      this.mimicTarget = null;
    }
    if (!fleeing && tile === b.exitIdx) {
      this.tx = b.exit + 0.5 + this.lane * 2;
      this.ty = ROWS + 0.6;
      return;
    }
    const { field, opts } = w.fieldFor(this);
    let next = b.nextStep(tile, field, opts, this.bias);
    if (next < 0) {
      const main = w.mainField();
      next = b.nextStep(tile, main, {}, this.bias);
      if (next < 0) {
        // stranded on a blocked tile (after knockback): head to nearest tile center
        this.tx = Math.floor(this.x) + 0.5;
        this.ty = Math.floor(this.y) + 0.5 + 0.3;
        if (w.board.get(Math.floor(this.x), Math.floor(this.y)) !== Tile.Floor) w.unstick(this);
        return;
      }
    }
    const ncx = b.col(next) + 0.5, ncy = b.row(next) + 0.5;
    let ddx = ncx - this.x, ddy = ncy - this.y;
    const dl = Math.hypot(ddx, ddy) || 1;
    ddx /= dl;
    ddy /= dl;
    const lane = b.get(b.col(next), b.row(next)) === Tile.Wall ? 0 : this.lane;
    this.tx = ncx - ddy * lane;
    this.ty = ncy + ddx * lane;
  }

  // ------------------------------------------------------------ fighting
  private fight(w: World, dt: number): void {
    this.engagedBy = this.engagedBy.filter((m) => m.alive && m.holding.includes(this));
    if (w.enraged) this.engagedBy.length = 0;
    if (!this.engagedBy.length) {
      this.state = 'walk';
      this.stateT = 0;
      return;
    }
    const m = this.engagedBy[0];
    this.facing = m.x > this.x ? 1 : -1;
    this.atkTimer -= dt;
    if (this.atkTimer <= 0 && this.dmg > 0) {
      this.atkTimer = this.atkCd;
      this.squash.kick(-3);
      w.damageMonster(m, this.dmg, this);
    }
  }

  // ----------------------------------------------------------- abilities
  private updateAbilities(w: World, dt: number): void {
    this.atkTimer -= this.state === 'fight' ? 0 : dt;
    this.wallCd -= dt;
    this.healCd -= dt;
    this.abilityCd -= dt;
    this.dodgeCd -= dt;
    const st = this.state;
    const active = st === 'walk' || st === 'fight';

    // Ranged classes shoot monsters while walking.
    if (this.range > 0 && st === 'walk' && this.atkTimer <= 0) {
      const m = w.nearestMonster(this.x, this.y, this.range, true);
      if (m) {
        this.atkTimer = this.atkCd;
        w.heroShoots(this, m);
      }
    }
    // Mages break walls that lengthen the path.
    if ((this.cls === 'mage' || (this.superId === 'paladin3' && this.heads[2]?.alive)) && st === 'walk' && this.wallCd <= 0) {
      this.wallCd = 1.5;
      const wi = w.wallToBreak(this);
      if (wi >= 0 && w.rng.chance(0.45)) {
        this.state = 'cast';
        this.stateT = 0;
        this.castWall = wi;
        this.castT = this.superId ? 1.0 : 1.7;
        this.wallCd = 9;
        if (w.rng.chance(0.6)) this.say(w, tr('q.cls.mage', w.rnd));
      }
    }
    // Cleric heals around.
    const healer = this.cls === 'cleric' || (this.superId === 'paladin3' && this.heads[0]?.alive);
    if (healer && this.healCd <= 0 && active) {
      this.healCd = this.superId ? 3 : 2.2;
      w.healPulse(this, 1.9, this.superId ? 0.06 : 0.12);
    }
    // Bard buffs allies.
    if (this.cls === 'bard' && active) w.bardAura(this, dt);
    // Influencer heals from attention.
    if (this.has('influencer') && active) w.influencerHeal(this, dt);
    // Paladin: Jean-Kévin's shield, arguing heads.
    if (this.superId === 'paladin3') {
      if (this.heads[1]?.alive && this.abilityCd <= 0) {
        this.abilityCd = 7;
        this.shieldT = 1.8;
        w.ev.sfx('shield');
      }
      this.argueT -= dt;
      if (this.argueT <= 0 && st === 'walk' && this.heads.filter((h) => h.alive).length >= 2) {
        this.argueT = w.rng.range(6, 9);
        this.state = 'argue';
        this.stateT = 0;
        this.say(w, tr('super.paladin3.argue', w.rnd), 2.2);
      }
      if (this.heads[2]?.alive && this.atkTimer <= 0 && st === 'walk') {
        const m = w.nearestMonster(this.x, this.y, 3, true);
        if (m) {
          this.atkTimer = 1.6;
          w.heroShoots(this, m);
        }
      }
    }
    // Le Joueur: potion + chat.
    if (this.superId === 'player') {
      if (this.potion && this.hp < this.maxHp * 0.35) {
        this.potion = false;
        w.heal(this, this.maxHp * 0.4);
        this.say(w, 'POTION !', 1.5);
      }
    }
  }

  private updateCast(w: World, dt: number): void {
    this.castT -= dt;
    if (w.rng.chance(dt * 12)) w.fxMagic(this.x, this.y);
    if (this.castT <= 0) {
      w.breakWall(this.castWall, this);
      this.state = 'walk';
      this.stateT = 0;
    }
  }

  // -------------------------------------------------------------- bounce
  launch(w: World, x1: number, y1: number, trap: Trap | null): void {
    this.state = 'air';
    this.stateT = 0;
    this.engagedBy.length = 0;
    this.air = { x0: this.x, y0: this.y, x1, y1, t: 0, dur: 0.95, h: 2.4, trap };
    this.bounced++;
    this.squash.kick(6);
    this.vx = this.vy = 0;
  }

  private updateAir(w: World, dt: number): void {
    const a = this.air!;
    a.t += dt;
    const p = clamp(a.t / a.dur, 0, 1);
    this.x = lerp(a.x0, a.x1, p);
    this.y = lerp(a.y0, a.y1, p);
    this.z = Math.sin(Math.PI * p) * a.h;
    this.rot += dt * 9 * this.facing;
    if (p >= 1) {
      this.z = 0;
      this.rot = 0;
      this.state = 'walk';
      this.stateT = 0;
      this.curTile = -2;
      this.air = null;
      this.squash.kick(-8);
      w.heroLanded(this, a.trap);
    }
  }

  private updateFlung(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 3 * dt;
    this.z += 6 * dt;
    this.rot += this.spin * dt;
    if (this.stateT > 1.6) this.state = 'gone';
  }

  fling(dirX: number): void {
    this.state = 'flung';
    this.stateT = 0;
    this.vx = dirX * 5;
    this.vy = -3;
    this.spin = dirX * 14;
    this.setExpr('scared', 3);
  }

  // -------------------------------------------------------------- throne
  private updateThrone(w: World, dt: number): void {
    if (!this.hitBoss) {
      this.hitBoss = true;
      w.heroHitsBoss(this);
      if (!this.isSuper && this.alive) {
        this.fling(this.x < w.board.exit + 0.5 ? -1 : 1);
      }
      this.atkTimer = 1.3;
      return;
    }
    // Super heroes stay and keep hitting.
    this.atkTimer -= dt;
    this.walkPhase += dt * 3;
    if (this.atkTimer <= 0) {
      this.atkTimer = 1.6;
      this.squash.kick(-4);
      w.heroHitsBoss(this);
    }
  }

  // ---------------------------------------------------------- possession
  possess(w: World, dur: number): void {
    this.state = 'possessed';
    this.stateT = 0;
    this.ally = true;
    this.possessedT = dur;
    this.engagedBy.length = 0;
    this.setExpr('angry', dur);
    this.say(w, tr('q.possessed', w.rnd), 2);
  }

  private updatePossessed(w: World, dt: number): void {
    this.possessedT -= dt;
    if (this.possessedT <= 0) {
      w.possessionEnds(this);
      return;
    }
    const target = w.nearestEnemyHero(this, 4);
    if (!target) {
      // wander up the path
      this.y -= this.speed * 0.5 * dt;
      this.walkPhase += dt * 5;
      if (this.y < 0.5) this.y = 0.5;
      return;
    }
    const d = dist(this.x, this.y, target.x, target.y);
    if (d > 0.45) {
      const s = this.speed * 1.4 * dt;
      this.x += ((target.x - this.x) / d) * s;
      this.y += ((target.y - this.y) / d) * s;
      this.facing = target.x > this.x ? 1 : -1;
      this.walkPhase += s * 8;
    } else {
      this.atkTimer -= dt;
      if (this.atkTimer <= 0) {
        this.atkTimer = 0.7;
        this.squash.kick(-4);
        w.damageHero(target, Math.max(12, this.dmg * 3), 'phys', { kind: 'hero', id: 'possess', hero: this });
      }
    }
  }

  // ---------------------------------------------------------------- misc
  private idleQuote(w: World): void {
    let pool = 'q.spawn';
    const r = w.rng.next();
    if (this.superId === 'chosen') pool = 'super.chosen.q';
    else if (this.superId === 'player') pool = 'super.player.q';
    else if (this.superId === 'speedguild') pool = 'super.speedguild.q';
    else if (this.superId === 'paladin3') pool = 'super.paladin3.argue';
    else if (this.mods.size && r < 0.5) pool = `q.mod.${w.rng.pick([...this.mods])}`;
    else if (r < 0.75) pool = `q.cls.${this.cls}`;
    if (this.hp < this.maxHp * 0.3) pool = 'q.low';
    this.say(w, tr(pool, w.rnd));
  }

  startRespawn(): void {
    this.state = 'respawn';
    this.stateT = 0;
    this.engagedBy.length = 0;
  }

  private doRespawn(w: World): void {
    this.state = 'walk';
    this.stateT = 0;
    this.hp = Math.round(this.maxHp * 0.6);
    this.invuln = 0.8;
    this.burnT = this.poisonT = 0;
    this.spawnPop = 0.35;
    this.curTile = -2;
    w.heroRespawned(this);
  }
}
