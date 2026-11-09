import { Rng } from '../core/Rng';
import { clamp, dist } from '../core/math';
import { Board, COLS, N_TILES, ROWS, Tile, type FieldOpts } from './Board';
import { Hero } from './Hero';
import { Monster, Den } from './Monster';
import { Trap } from './Trap';
import { defaultMods, type RunMods } from './Mods';
import { planWave, WaveDirector, FINAL_WAVE, superFor, type Lessons } from './Waves';
import type { HeroSpec } from './HeroGen';
import { Particles } from '../systems/Particles';
import { FloatTexts } from '../systems/FloatText';
import type { AttackId, AttackSlot, BossId, BuildId, DamageType, MonsterId, TrapId } from '../data/types';
import { TRAPS, WALL_COST } from '../data/traps';
import { MONSTERS } from '../data/monsters';
import { BOSSES } from '../data/bosses';
import { PACTS, RARITY_WEIGHT, type PactDef } from '../data/pacts';
import { C } from '../render/palette';
import { t, tr } from '../i18n';
import { fx } from '../core/Rng';
import { ultimateEffect } from './Attacks';

// =====================================================================
// Types
// =====================================================================
export interface DmgSource {
  kind: 'trap' | 'monster' | 'attack' | 'env' | 'hero' | 'minion' | 'ult' | 'explosion';
  id: string;
  trap?: Trap;
  monster?: Monster;
  hero?: Hero;
}

export interface DmgOpts {
  dot?: boolean;
  combo?: string;
  comboMul?: number;
  noText?: boolean;
  style?: DeathStyle;
}

export type DeathStyle = 'pop' | 'fly' | 'eaten' | 'fall' | 'pit' | 'melt';

export interface Zone {
  kind: 'gas' | 'burn' | 'blackhole' | 'slimepool' | 'tentacle';
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  dps: number;
  type: DamageType;
  src: DmgSource;
  tick?: number;
  boomed?: boolean;
}

export interface Projectile {
  kind: 'arrow' | 'bolt' | 'dark' | 'heroArrow' | 'heroBolt' | 'fireball' | 'meteor' | 'spit';
  x0: number; y0: number; z0: number;
  x1: number; y1: number;
  x: number; y: number; z: number;
  t: number; dur: number; arc: number;
  target: Hero | Monster | null;
  onHit: (w: World, p: Projectile) => void;
  /** screen-space start for boss projectiles (from the boss mouth) */
  fromScreen?: { x: number; y: number };
}

export type Phase = 'wave' | 'cleared' | 'pact' | 'build' | 'over' | 'victory';
export type BossMood = 'idle' | 'laugh' | 'angry' | 'cast' | 'roar' | 'dead' | 'ult';

export interface BossState {
  id: BossId;
  hp: number;
  maxHp: number;
  rage: number;
  mood: BossMood;
  moodT: number;
  hurt: number;
  attacks: Record<AttackSlot, AttackId>;
  cd: Record<AttackSlot, number>;
  secondWindUsed: boolean;
  lookX: number;
  lookY: number;
  laughCd: number;
}

export interface KillInfo {
  cause: string;
  combo?: string;
  score: number;
  style: DeathStyle;
}

export interface Humiliation {
  score: number;
  name: string;
  cause: string;
  wave: number;
  snapshot: HTMLCanvasElement | null;
}

export interface RunStats {
  kills: number;
  leaks: number;
  bestStreak: number;
  combos: number;
  killsByCause: Record<string, number>;
  goldEarned: number;
  damageTaken: number;
  cursed: number;
  ultimates: number;
  attacksThisWave: number;
  cleanWaves: number;
  wavesSurvived: number;
  best: Humiliation | null;
  maxPath: number;
}

/** Hooks the scene implements (sound, haptics, camera, UI). No-ops in sims. */
export interface WorldEvents {
  sfx(name: string, pitch?: number): void;
  voice(h: Hero): void;
  shake(a: number): void;
  hitStop(ms: number): void;
  haptic(kind: 'light' | 'medium' | 'heavy'): void;
  slowMo(scale: number, dur: number, sx?: number, sy?: number, zoom?: number): void;
  banner(text: string, sub?: string, color?: string): void;
  heroDeathFx(h: Hero, style: DeathStyle, sx: number, sy: number): void;
  heroKilled(h: Hero, info: KillInfo): void;
  coins(sx: number, sy: number, n: number): void;
  combo(name: string, sx: number, sy: number): void;
  streak(n: number, label: string): void;
  bossHurt(n: number): void;
  track(event: string, n?: number): void;
  phase(p: Phase): void;
  snapshot(h: Hero, sx: number, sy: number): void;
  ultimate(kind: BossId): void;
}

export const NOOP_EVENTS: WorldEvents = {
  sfx() {}, voice() {}, shake() {}, hitStop() {}, haptic() {}, slowMo() {}, banner() {}, heroDeathFx() {},
  heroKilled() {}, coins() {}, combo() {}, streak() {}, bossHurt() {}, track() {}, phase() {}, snapshot() {}, ultimate() {},
};

export interface WorldOpts {
  bossId: BossId;
  attacks: Record<AttackSlot, AttackId>;
  seed: number;
  daily?: boolean;
  endless?: boolean;
  startGold: number;
  bossHpBonus: number;
  rageStart: number;
  rerolls: number;
  unlocked: Set<BuildId>;
  ev?: WorldEvents;
}

export interface PactOffer {
  pacts: PactDef[];
}

const STREAKS = [2, 3, 4, 6, 8, 12, 16];

// =====================================================================
// World
// =====================================================================
/**
 * The simulation of one run. Holds every entity and implements the rules.
 * Rendering-agnostic: talks to the outside only through `ev`.
 */
export class World {
  board = new Board();
  rng: Rng;
  layoutRng: Rng;
  pactRng: Rng;
  readonly rnd = (): number => this.rng.next();
  ev: WorldEvents;
  opts: WorldOpts;

  heroes: Hero[] = [];
  monsters: Monster[] = [];
  dens: Den[] = [];
  traps: Trap[] = [];
  trapAt: (Trap | null)[] = new Array(N_TILES).fill(null);
  denAt: (Den | null)[] = new Array(N_TILES).fill(null);
  /** walls placed by the player this run (tile -> placed this build) */
  walls = new Map<number, boolean>();
  zones: Zone[] = [];
  projectiles: Projectile[] = [];
  particles = new Particles();
  texts = new FloatTexts();

  mods: RunMods = defaultMods();
  pacts: PactDef[] = [];
  phase: Phase = 'wave';
  phaseT = 0;
  wave = 1;
  gold: number;
  boss: BossState;
  stats: RunStats;
  director = new WaveDirector();
  returning: HeroSpec[] = [];
  lessons: Lessons = { trapKills: 0, monsterKills: 0, wallCount: 0, pathStretch: 1, bossKills: 0 };
  baseLength = 12;
  streamMarks = new Set<number>();
  markVersion = 0;
  streak = 0;
  streakT = 0;
  time = 0;
  buildTime = 30;
  pactOffer: PactDef[] = [];
  rerolls: number;
  bossTookDamage = false;
  tentacleT = 4;
  ult: { t: number; kind: BossId; fired: boolean } | null = null;
  holdZone: Zone | null = null;
  /** claw slash marks for the renderer (grid coords) */
  slashes: { ax: number; ay: number; bx: number; by: number; t: number }[] = [];
  /** set by the renderer: where the boss mouth is (grid coords) */
  bossMouth = { x: 3.5, y: ROWS + 1.6, z: 1.5 };
  speakers = 0;
  learnedThisWave: string[] = [];
  waveKills = 0;
  /** After ~70s the heroes get impatient: faster and unblockable (no stalls). */
  enraged = false;
  private sp0 = { x: 0, y: 0 };

  constructor(opts: WorldOpts) {
    this.opts = opts;
    this.ev = opts.ev ?? NOOP_EVENTS;
    const root = new Rng(opts.seed);
    this.layoutRng = root.fork('layout');
    this.rng = root.fork('waves');
    this.pactRng = root.fork('pacts');
    this.gold = opts.startGold;
    this.rerolls = opts.rerolls;
    const bd = BOSSES[opts.bossId];
    const maxHp = bd.hp + opts.bossHpBonus;
    this.boss = {
      id: opts.bossId, hp: maxHp, maxHp, rage: opts.rageStart, mood: 'idle', moodT: 0, hurt: 0,
      attacks: { ...opts.attacks }, cd: { tap: 0, swipe: 0, hold: 0 }, secondWindUsed: false,
      lookX: 0, lookY: 0, laughCd: 0,
    };
    this.stats = {
      kills: 0, leaks: 0, bestStreak: 0, combos: 0, killsByCause: {}, goldEarned: 0, damageTaken: 0, cursed: 0,
      ultimates: 0, attacksThisWave: 0, cleanWaves: 0, wavesSurvived: 0, best: null, maxPath: 0,
    };
    this.applyBossPassive();
    this.board.generate(this.layoutRng, { water: opts.bossId === 'kraken' });
    this.baseLength = this.board.pathLength();
    this.placeStarterTraps();
  }

  private applyBossPassive(): void {
    const m = this.mods;
    switch (this.opts.bossId) {
      case 'demon': m.rageGain += 0.25; break;
      case 'dragon': m.fireDmg += 0.5; break;
      case 'lich': m.necroChance = 0.3; break;
      case 'slime': break;
      case 'kraken': break;
    }
  }

  /** Two free spike traps on the hero route so wave 1 is instant fun. */
  private placeStarterTraps(): void {
    const path = this.board.shortestPath();
    const picks = [Math.floor(path.length * 0.35), Math.floor(path.length * 0.62)];
    for (const k of picks) {
      const tile = path[k];
      if (tile === undefined || tile === this.board.entranceIdx || tile === this.board.exitIdx) continue;
      this.addTrap('spikes', tile, 0);
    }
    for (const tr of this.traps) tr.placedThisBuild = false;
  }

  // =================================================================
  // helpers
  // =================================================================
  sp(gx: number, gy: number, gz = 0): { x: number; y: number } {
    const p = this.board.project(gx, gy, this.sp0);
    return { x: p.x, y: p.y - gz * this.board.pxPerTile(gy) * 0.8 };
  }

  fxFire(gx: number, gy: number, n: number): void {
    const p = this.sp(gx, gy, 0.5);
    this.particles.fire(p.x, p.y, n, 8, 9);
  }

  fxMagic(gx: number, gy: number): void {
    const p = this.sp(gx, gy, 1.1);
    this.particles.spawn('spark', p.x + fx.r(-12, 12), p.y + fx.r(-12, 12), { vx: fx.r(-40, 40), vy: fx.r(-80, -20), life: 0.4, size: 3, color: fx.pick(['#8fe8ff', '#b388ff', '#ffffff']) });
  }

  pick(key: string): string {
    return tr(key, this.rnd);
  }

  get isSuperWave(): boolean {
    return superFor(this.wave) !== null;
  }
  get finalWave(): number {
    return FINAL_WAVE;
  }
  /** Boss attacks get stronger every wave. */
  get bossScale(): number {
    return (1 + 0.065 * (this.wave - 1)) * this.mods.bossAtkDmg;
  }

  canSpeak(h: Hero): boolean {
    if (h.bubble) return false;
    let n = 0;
    for (const x of this.heroes) if (x.bubble) n++;
    return n < 3;
  }

  nearestHero(x: number, y: number, r: number, filter: (h: Hero) => boolean = (h) => h.targetable, fromX = x, fromY = y): Hero | null {
    let best: Hero | null = null, bd = Infinity;
    for (const h of this.heroes) {
      if (!filter(h)) continue;
      if (dist(h.x, h.y, x, y) > r) continue;
      const d = dist(h.x, h.y, fromX, fromY);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  heroesIn(x: number, y: number, r: number, filter: (h: Hero) => boolean = (h) => h.targetable && !h.ally): Hero[] {
    const out: Hero[] = [];
    for (const h of this.heroes) if (filter(h) && dist(h.x, h.y, x, y) <= r + 0.18 * h.scale) out.push(h);
    return out;
  }

  nearestEnemyHero(me: Hero, r: number): Hero | null {
    return this.nearestHero(me.x, me.y, r, (h) => h !== me && h.targetable && !h.ally && h.state !== 'air');
  }

  nearestMonster(x: number, y: number, r: number, aliveOnly = true): Monster | null {
    let best: Monster | null = null, bd = r;
    for (const m of this.monsters) {
      if (aliveOnly && !m.alive) continue;
      if (m.friendT > 0) continue;
      const d = dist(m.x, m.y, x, y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  mainField(): Float32Array {
    return this.board.field(this.board.exitIdx, 'main');
  }

  /** The flow field + options a given hero follows. */
  fieldFor(h: Hero): { field: Float32Array; opts: FieldOpts } {
    const b = this.board;
    if (h.state === 'flee') return { field: b.field(b.entranceIdx, 'flee'), opts: {} };
    if (h.mimicTarget) return { field: b.field(h.mimicTarget.tile, 'mimic'), opts: {} };
    if (h.superId === 'speedguild') {
      const opts: FieldOpts = { wallCost: 2.5 };
      return { field: b.field(b.exitIdx, 'glitch', opts), opts };
    }
    if (h.superId === 'player') {
      const opts: FieldOpts = { cost: (i) => (this.trapAt[i]?.active ? 3 : 0) };
      return { field: b.field(b.exitIdx, 'player:' + this.trapVersion, opts), opts: {} };
    }
    if (this.streamMarks.size && !h.has('streamer')) {
      const opts: FieldOpts = { cost: (i) => (this.streamMarks.has(i) ? 3.5 : 0) };
      return { field: b.field(b.exitIdx, 'stream:' + this.markVersion, opts), opts: {} };
    }
    return { field: this.mainField(), opts: {} };
  }

  trapVersion = 0;

  // =================================================================
  // main update
  // =================================================================
  update(dt: number): void {
    this.time += dt;
    this.phaseT += dt;
    runTimers(this);
    if (this.slashes.length) {
      for (const s of this.slashes) s.t += dt;
      this.slashes = this.slashes.filter((s) => s.t < 0.35);
    }
    if (this.streakT > 0) {
      this.streakT -= dt;
      if (this.streakT <= 0) this.streak = 0;
    }
    this.updateBoss(dt);

    if (this.phase === 'wave') {
      for (const spec of this.director.update(dt)) this.spawnHero(spec);
      if (!this.enraged && this.phaseT > 70) {
        this.enraged = true;
        for (const h of this.heroes) h.engagedBy.length = 0;
        this.ev.banner(t('hud.enraged'), t('hud.enragedSub'), C.crimsonHi);
        this.ev.sfx('fanfare');
      }
      this.updatePassives(dt);
      if (this.ult) this.updateUltimate(dt);
    }
    for (const h of this.heroes) h.update(this, dt);
    for (const m of this.monsters) m.update(this, dt);
    for (const tr of this.traps) tr.update(this, dt);
    this.updateZones(dt);
    this.updateProjectiles(dt);
    this.particles.update(dt);
    this.texts.update(dt);

    // cleanup
    if (this.heroes.some((h) => h.state === 'gone')) this.heroes = this.heroes.filter((h) => h.state !== 'gone');
    if (this.monsters.some((m) => !m.alive && !m.den)) this.monsters = this.monsters.filter((m) => m.alive || m.den);

    if (this.phase === 'wave') this.checkWaveEnd();
    else if (this.phase === 'cleared' && this.phaseT > 1.7) this.toPact();
    else if (this.phase === 'build') {
      this.buildTime -= dt;
      if (this.buildTime <= 0) this.startWave();
    }
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
    this.ev.phase(p);
  }

  // =================================================================
  // waves
  // =================================================================
  /** Begin the current wave (called at run start and from the build phase). */
  startWave(): void {
    for (const tr of this.traps) {
      tr.placedThisBuild = false;
      tr.disarmed = false;
      tr.illegal = false;
    }
    for (const d of this.dens) d.placedThisBuild = false;
    for (const k of this.walls.keys()) this.walls.set(k, false);
    this.lessons.wallCount = this.walls.size;
    const len = this.board.pathLength();
    this.lessons.pathStretch = len / Math.max(1, this.baseLength);
    this.stats.maxPath = Math.max(this.stats.maxPath, len);
    if (len >= 40) this.ev.track('path40');
    const plan = planWave(this.rng, this.wave, this.mods.heroCount, this.lessons, this.returning);
    this.returning = [];
    this.director.start(plan.entries);
    this.learnedThisWave = plan.learned;
    this.stats.attacksThisWave = 0;
    this.bossTookDamage = false;
    this.waveKills = 0;
    this.enraged = false;
    this.streamMarks.clear();
    this.markVersion++;
    this.setPhase('wave');
    this.boss.cd.tap = 0;
    const sup = superFor(this.wave);
    if (sup) this.ev.banner(t(`super.${sup}.name`), t(`super.${sup}.sub`), C.gold);
    else this.ev.banner(t('hud.waveStart', { n: this.wave }));
    this.ev.sfx('fanfare');
  }

  private checkWaveEnd(): void {
    if (!this.director.done) return;
    for (const h of this.heroes) if (!h.done) return;
    // Wave cleared!
    this.stats.wavesSurvived = this.wave;
    const bonus = Math.round((15 + this.wave * 3) * this.mods.goldMul);
    let interest = 0;
    if (this.mods.interest > 0) interest = Math.min(120, Math.round(this.gold * this.mods.interest));
    this.addGold(bonus + interest);
    this.ev.banner(t('hud.waveClear'), t('hud.waveBonus', { n: bonus }) + (interest ? '  •  ' + t('hud.interest', { n: interest }) : ''), C.uiGood);
    if (!this.bossTookDamage) {
      this.stats.cleanWaves++;
      if (this.stats.cleanWaves >= 5) this.ev.track('untouchable');
    } else this.stats.cleanWaves = 0;
    if (this.stats.attacksThisWave === 0 && this.wave >= 5) this.ev.track('handsFree');
    if (this.mods.cursedCrown) {
      this.boss.maxHp = Math.max(1, this.boss.maxHp - 1);
      this.boss.hp = Math.min(this.boss.hp, this.boss.maxHp);
    }
    this.zones = this.zones.filter((z) => z.kind === 'slimepool');
    this.ult = null;
    this.boss.mood = 'laugh';
    this.boss.moodT = 1.6;
    this.ev.sfx('laugh');
    if (this.wave >= FINAL_WAVE && !this.opts.endless) {
      this.setPhase('victory');
      return;
    }
    this.setPhase('cleared');
  }

  private toPact(): void {
    this.rollPacts();
    this.setPhase('pact');
  }

  rollPacts(): void {
    const owned = new Set(this.pacts.map((p) => p.id));
    const pool = PACTS.filter((p) => (p.stack || !owned.has(p.id)) && (p.minWave ?? 0) <= this.wave);
    const offer: PactDef[] = [];
    const n = this.mods.pactChoices;
    for (let i = 0; i < n && pool.length; i++) {
      const legendBoost = 1 + this.wave * 0.08;
      const p = this.pactRng.weighted(pool, (x) =>
        offer.includes(x) ? 0 : RARITY_WEIGHT[x.rarity] * (x.rarity === 'legendary' ? legendBoost : 1) * (x.rarity === 'cursed' && this.wave < 3 ? 0.3 : 1),
      );
      if (!offer.includes(p)) offer.push(p);
    }
    this.pactOffer = offer;
  }

  reroll(): boolean {
    if (this.rerolls <= 0) return false;
    this.rerolls--;
    this.rollPacts();
    return true;
  }

  choosePact(p: PactDef): void {
    this.pacts.push(p);
    if (p.rarity === 'cursed') {
      this.stats.cursed++;
      this.mods.cursedCount++;
      if (this.stats.cursed >= 3) this.ev.track('devil');
    }
    p.apply({
      mods: this.mods,
      addGold: (n) => this.addGold(n),
      healBoss: (n) => (this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + n)),
      addMaxHp: (n) => {
        this.boss.maxHp = Math.max(1, this.boss.maxHp + n);
        this.boss.hp = clamp(this.boss.hp + Math.max(0, n), 1, this.boss.maxHp);
      },
      upgradeAllTraps: () => {
        for (const tr of this.traps) if (tr.level < 3) tr.level++;
      },
    });
    for (const m of this.monsters) m.refreshStats(this);
    this.wave++;
    this.buildTime = 30;
    this.setPhase('build');
  }

  // =================================================================
  // spawning
  // =================================================================
  spawnHero(spec: HeroSpec): Hero {
    const b = this.board;
    const h = new Hero(spec, this, b.entrance + 0.5 + this.rng.range(-0.2, 0.2), -1.0);
    this.heroes.push(h);
    if (spec.returning) {
      this.ev.banner(t('hud.returning', { name: spec.name }), undefined, C.crimsonHi);
    }
    if (h.superId === 'player') {
      this.ev.banner(t('super.player.join'), undefined, C.uiBlue);
      h.say(this, this.pick('super.player.q'), 2.5);
    } else if (h.superId === 'chosen' || h.superId === 'paladin3') {
      h.say(this, this.pick(h.superId === 'chosen' ? 'super.chosen.q' : 'super.paladin3.argue'), 2.5);
      this.ev.sfx('fanfare');
    } else if (this.rng.chance(0.35)) {
      h.say(this, this.pick(h.has('chicken') ? 'q.mod.chicken' : 'q.spawn'));
    }
    if (h.has('speedrunner')) h.flip = 1; // backflip on spawn
    if (h.has('lawyer')) this.lawyerObjection(h);
    return h;
  }

  /** The lawyer declares the deadliest trap ILLEGAL for this wave. */
  private lawyerObjection(h: Hero): void {
    const cand = this.traps.filter((tr) => !tr.illegal && tr.active);
    if (!cand.length) return;
    cand.sort((a, b) => b.kills * 10 + b.level * 5 + b.def.cost / 10 - (a.kills * 10 + a.level * 5 + a.def.cost / 10));
    const tr = cand[0];
    tr.illegal = true;
    (h as Hero & { illegalTrap?: Trap }).illegalTrap = tr;
    h.say(this, this.pick('q.illegal'), 2.6);
    const p = this.sp(tr.cx, tr.cy);
    this.texts.add(t('hud.illegal'), p.x, p.y - 20, 'big', C.crimsonHi, 30);
    this.ev.sfx('stamp');
  }

  // =================================================================
  // boss
  // =================================================================
  private updateBoss(dt: number): void {
    const b = this.boss;
    for (const s of ['tap', 'swipe', 'hold'] as AttackSlot[]) if (b.cd[s] > 0) b.cd[s] = Math.max(0, b.cd[s] - dt);
    if (b.moodT > 0) {
      b.moodT -= dt;
      if (b.moodT <= 0 && b.mood !== 'dead') b.mood = 'idle';
    }
    if (b.hurt > 0) b.hurt -= dt;
    if (b.laughCd > 0) b.laughCd -= dt;
  }

  setMood(m: BossMood, t: number): void {
    if (this.boss.mood === 'dead') return;
    if (this.boss.mood === 'ult' && this.boss.moodT > 0) return;
    this.boss.mood = m;
    this.boss.moodT = t;
  }

  addRage(n: number): void {
    const before = this.boss.rage;
    this.boss.rage = clamp(this.boss.rage + n * this.mods.rageGain, 0, 100);
    if (before < 100 && this.boss.rage >= 100) {
      this.ev.sfx('rageReady');
      this.ev.track('rageFull');
    }
  }

  heroHitsBoss(h: Hero): void {
    const dmg = Math.max(1, Math.round(h.bossDmg * this.mods.bossDmgTaken));
    const b = this.boss;
    b.hp -= dmg;
    b.hurt = 0.35;
    this.bossTookDamage = true;
    this.stats.damageTaken += dmg;
    if (!h.isSuper) {
      this.stats.leaks++;
      h.done = true;
    }
    this.setMood('angry', 1.0);
    this.ev.bossHurt(dmg);
    this.ev.shake(0.45);
    this.ev.haptic('heavy');
    this.ev.sfx('bossHit');
    const p = this.sp(h.x, h.y);
    this.texts.add(t('hud.bossHit', { n: dmg }), p.x, p.y - 40, 'bad', C.crimsonHi, 38);
    if (this.rng.chance(0.5)) h.say(this, this.pick('q.boss'), 1.4);
    if (this.mods.thorns > 0) this.damageHero(h, this.mods.thorns, 'phys', { kind: 'env', id: 'thorns' });
    if (this.opts.bossId === 'slime') {
      for (let i = 0; i < 2; i++) this.spawnMinion('slimeling', this.board.exit + 0.5 + this.rng.range(-1, 1), ROWS - 0.6, 10, 20);
    }
    if (b.hp <= 0) {
      if (this.mods.secondWind && !b.secondWindUsed) {
        b.secondWindUsed = true;
        b.hp = Math.ceil(b.maxHp * 0.5);
        this.ev.banner(t('hud.revive'), undefined, C.gold);
        this.ev.sfx('laugh');
        this.ev.shake(0.8);
      } else {
        b.hp = 0;
        b.mood = 'dead';
        this.setPhase('over');
        this.ev.sfx('bossDeath');
        this.ev.slowMo(0.3, 1.2);
        for (const x of this.heroes) if (x.alive) x.say(this, this.rng.chance(0.5) ? 'GG EZ' : this.pick('q.boss'), 3);
      }
    }
  }

  // =================================================================
  // damage
  // =================================================================
  damageHero(h: Hero, amount: number, type: DamageType, src: DmgSource, o: DmgOpts = {}): number {
    if (!h.alive || h.invuln > 0 || h.state === 'eaten' || h.state === 'fall') return 0;
    if (h.ally && src.kind !== 'hero') return 0;
    if (amount <= 0) return 0;
    h.dmgTypes.add(type);

    // Plot armour: needs 3 different damage types.
    if (h.plotArmor) {
      if (h.dmgTypes.size >= 3) {
        h.plotArmor = false;
        const p = this.sp(h.x, h.y, 1);
        this.ev.banner(t('hud.plotArmorBroken'), undefined, C.gold);
        this.particles.sparks(p.x, p.y, 30, C.gold, 520);
        this.ev.shake(0.6);
        this.ev.sfx('glass');
      } else {
        if (!o.dot && this.rng.chance(0.4)) {
          const p = this.sp(h.x, h.y, 1.2);
          this.texts.add(t('hud.immune') + ` ${h.dmgTypes.size}/3`, p.x, p.y, 'info', C.gold, 22);
        }
        h.squash.kick(2);
        return 0;
      }
    }
    if (h.shieldT > 0) {
      if (!o.dot) {
        const p = this.sp(h.x, h.y, 1);
        this.particles.ring(p.x, p.y, 10, 40, C.uiBlue, 0.25, 5);
      }
      return 0;
    }
    // Tiny heroes dodge traps.
    if (src.kind === 'trap' && h.has('tiny') && !o.dot && this.rng.chance(0.4)) {
      const p = this.sp(h.x, h.y, 0.8);
      this.texts.add(t('hud.dodge'), p.x, p.y, 'info', C.white, 20);
      return 0;
    }

    let dmg = amount;
    if (type === 'fire') dmg *= this.mods.fireDmg;
    if (type === 'poison') dmg *= this.mods.poisonDmg;
    if (type === 'phys') dmg *= 1 - h.armor;
    if (src.kind === 'trap') dmg *= this.mods.trapDmg;
    if (src.kind === 'monster' || src.kind === 'minion') dmg *= this.mods.monsterDmg;
    let combo = o.combo;
    if (src.kind === 'attack') {
      dmg *= this.bossScale;
      if (h.stunT > 0 && !combo && !o.dot) combo = 'helpless';
    }
    if (h.freezeT > 0 && !o.dot) {
      dmg *= 1.3;
      if (!combo && src.kind === 'attack') combo = 'frozen';
    }
    if (combo) {
      dmg *= (o.comboMul ?? 1.6) * this.mods.comboMul;
      this.registerCombo(combo, h);
    }
    dmg = Math.max(1, Math.round(dmg));
    if (h.superId === 'paladin3') this.paladinDamage(h, dmg);
    else h.hp -= dmg;

    h.lastSrc = src;
    h.lastType = type;
    if (!o.dot) {
      h.flash = 0.12;
      h.squash.kick(dmg > h.maxHp * 0.25 ? 9 : 5);
      h.setExpr('hurt', 0.4);
      if (h.quoteCd < 2 && this.rng.chance(0.12)) h.say(this, this.pick('q.hit'), 1.2);
    }
    if (!o.noText) {
      const p = this.sp(h.x, h.y, 0.9 * h.scale);
      const big = dmg >= 40 || combo;
      this.texts.add(String(dmg), p.x, p.y, big ? 'crit' : 'dmg', type === 'fire' ? C.fireHi : type === 'poison' ? C.poison : type === 'dark' ? C.dark : C.white, o.dot ? 18 : big ? 34 : 24);
    }
    if (h.has('streamer') && src.trap) {
      if (!this.streamMarks.has(src.trap.tile)) {
        this.streamMarks.add(src.trap.tile);
        this.markVersion++;
      }
    }
    // Coward runs away at low HP.
    if (h.hp > 0 && h.has('coward') && !h.fled && h.hp < h.maxHp * 0.3 && h.state !== 'air') {
      h.fled = true;
      h.state = 'flee';
      h.stateT = 0;
      h.engagedBy.length = 0;
      h.curTile = -2;
      h.say(this, this.pick('q.flee'), 2);
    }
    if (h.hp <= 0) {
      let style: DeathStyle = o.style ?? 'pop';
      if (style === 'pop' && (dmg > h.maxHp * 0.6 || src.kind === 'explosion') && !o.dot) style = 'fly';
      this.killHero(h, src, style, combo);
    }
    return dmg;
  }

  private paladinDamage(h: Hero, dmg: number): void {
    const alive = h.heads.map((x, i) => (x.alive ? i : -1)).filter((i) => i >= 0);
    if (!alive.length) {
      h.hp = 0;
      return;
    }
    const idx = alive.includes(h.activeHead) ? h.activeHead : alive[0];
    const head = h.heads[idx];
    head.hp -= dmg;
    if (head.hp <= 0) {
      head.alive = false;
      head.hp = 0;
      const p = this.sp(h.x, h.y, 1.4);
      this.particles.confetti(p.x, p.y, 20);
      this.texts.add(t(`super.paladin3.head${idx}`) + ' K.O. !', p.x, p.y - 20, 'big', C.gold, 30);
      this.ev.sfx('pop');
      h.activeHead = (idx + 1) % 3;
    }
    if (this.rng.chance(0.15)) h.activeHead = alive[this.rng.int(0, alive.length - 1)];
    h.hp = h.heads.reduce((s, x) => s + x.hp, 0);
  }

  damageMonster(m: Monster, amount: number, by: Hero | null): void {
    if (!m.alive) return;
    m.hp -= amount;
    m.flash = 0.1;
    m.squash.kick(5);
    const p = this.sp(m.x, m.y, 0.7);
    this.texts.add(String(Math.round(amount)), p.x, p.y, 'dmg', '#ff9db0', 18);
    if (m.hp <= 0) this.killMonster(m);
    void by;
  }

  killMonster(m: Monster, quiet = false): void {
    m.release();
    m.state = 'dead';
    m.target = null;
    const p = this.sp(m.x, m.y, 0.4);
    if (!quiet) {
      this.particles.smoke(p.x, p.y, 6, '#b9a6d6');
      this.particles.debris(p.x, p.y, 6, m.kind === 'archer' ? C.bone : '#6a8f3a', p.y + 10);
      this.ev.sfx('monsterDie');
    } else this.particles.smoke(p.x, p.y, 4, '#b9a6d6', 12);
    if (m.den) m.respawnT = m.def.respawn;
  }

  respawnMonster(m: Monster): void {
    m.state = 'idle';
    m.hp = m.maxHp;
    m.x = m.homeX + m.ox;
    m.y = m.homeY + m.oy;
    m.squash.set(-0.5);
    const p = this.sp(m.x, m.y);
    this.particles.smoke(p.x, p.y, 5, '#9a7bd1', 14);
  }

  heal(h: Hero, n: number): void {
    if (!h.alive || h.superId === 'chosen') {
      if (h.superId !== 'chosen') return;
    }
    const before = h.hp;
    if (h.superId === 'paladin3') {
      for (const hd of h.heads) if (hd.alive) hd.hp = Math.min(hd.max, hd.hp + n / 3);
      h.hp = h.heads.reduce((s, x) => s + x.hp, 0);
    } else h.hp = Math.min(h.maxHp, h.hp + n);
    const got = Math.round(h.hp - before);
    if (got > 0) {
      const p = this.sp(h.x, h.y, 1);
      this.texts.add('+' + got, p.x, p.y, 'heal', C.heal, 18);
    }
  }

  // =================================================================
  // death
  // =================================================================
  causeOf(src: DmgSource): string {
    switch (src.kind) {
      case 'trap': return src.id;
      case 'monster': return src.id;
      case 'attack': return src.id;
      case 'env': return src.id;
      case 'hero': return 'possess';
      case 'minion': return 'minion';
      case 'ult': return 'ultimate';
      case 'explosion': return 'explosion';
    }
  }

  killHero(h: Hero, src: DmgSource, style: DeathStyle, combo?: string): void {
    const p = this.sp(h.x, h.y, 0.5);
    // Three-headed: lose a head instead.
    if (h.lives > 1) {
      h.lives--;
      h.hp = h.maxHp;
      h.invuln = 0.6;
      this.particles.confetti(p.x, p.y - 20, 14);
      this.texts.add('-1 TÊTE !', p.x, p.y - 30, 'big', C.gold, 28);
      this.ev.sfx('pop');
      h.say(this, this.pick('q.mod.threeheads'), 1.6);
      return;
    }
    if (h.has('immortal') && !h.respawned) {
      h.respawned = true;
      this.particles.smoke(p.x, p.y, 10, '#fff4c2', 22);
      this.ev.sfx('poof');
      h.startRespawn();
      return;
    }
    if (h.plotArmor) {
      h.hp = 1;
      return;
    }
    h.done = true;
    h.hp = 0;
    h.engagedBy.length = 0;
    h.setExpr('dead', 99);
    const cause = this.causeOf(src);

    // ---- humiliation score
    let score = 1 + (combo ? 4 : 0) + h.bounced * 2 + (style === 'eaten' ? 3 : 0) + (style === 'pit' || style === 'melt' ? 4 : 0);
    if (cause === 'bounce') score += 3;
    if (cause === 'possess') score += 4;
    if (h.has('chicken')) score += 3;
    if (h.has('giant')) score += 2;
    if (h.isSuper) score += 6;
    if (h.t < 2.5) score += 2;
    if (h.mods.size >= 2) score += h.mods.size;
    const info: KillInfo = { cause, combo, score, style };

    // ---- rewards
    const gold = Math.max(1, Math.round(h.bounty * this.mods.goldMul + this.mods.killGold));
    this.addGold(gold);
    this.ev.coins(p.x, p.y, this.mods.goldRain ? gold : Math.min(gold, 6));
    this.addRage(h.isSuper ? 25 : 3.2 + (combo ? 2.5 : 0));
    this.stats.kills++;
    this.waveKills++;
    this.stats.killsByCause[cause] = (this.stats.killsByCause[cause] ?? 0) + 1;
    if (src.trap) {
      src.trap.kills++;
      this.lessons.trapKills++;
    } else if (src.monster) {
      if (src.monster.den) src.monster.den.kills++;
      this.lessons.monsterKills++;
    } else if (src.kind === 'attack') this.lessons.bossKills++;
    if (src.kind === 'hero') this.ev.track('traitor');
    if (this.mods.vampire > 0 && this.stats.kills % Math.max(1, Math.round(12 / this.mods.vampire)) === 0) {
      this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + 1);
    }
    // ---- streaks
    this.streak++;
    this.streakT = 1.5;
    if (this.streak > this.stats.bestStreak) this.stats.bestStreak = this.streak;
    if (STREAKS.includes(this.streak)) {
      this.ev.streak(this.streak, t(`streak.${this.streak}`));
      if (this.streak >= 8) this.ev.track('inhuman');
      this.addRage(this.streak);
    }
    // ---- boss laughs
    if (this.boss.laughCd <= 0 && this.rng.chance(0.35)) {
      this.setMood('laugh', 1.1);
      this.boss.laughCd = 3;
      if (this.rng.chance(0.4)) this.ev.sfx('laugh');
    }
    // ---- special hero types
    const lawyerTrap = (h as Hero & { illegalTrap?: Trap }).illegalTrap;
    if (lawyerTrap) lawyerTrap.illegal = false;
    if (h.has('streamer')) {
      this.streamMarks.clear();
      this.markVersion++;
    }
    if (h.has('influencer') && this.heroesIn(h.x, h.y, 2.2).length >= 3) this.ev.track('ratio');
    if (h.superId === 'speedguild' && !this.heroes.some((x) => x.superId === 'speedguild' && !x.done) && this.director.done) this.ev.track('super:speedguild');
    else if (h.superId && h.superId !== 'speedguild') {
      this.ev.track('super:' + h.superId);
      this.ev.banner(t(`super.${h.superId}.name`), 'K.O. !', C.gold);
      this.ev.slowMo(0.2, 1.2, p.x, p.y, 1.5);
    }

    this.ev.heroKilled(h, info);
    if (!this.stats.best || score > this.stats.best.score) {
      this.stats.best = { score, name: h.name, cause, wave: this.wave, snapshot: null };
      this.ev.snapshot(h, p.x, p.y);
    }

    // ---- raise dead
    const raiseBy = this.monsters.find((m) => m.kind === 'necro' && m.alive && dist(m.x, m.y, h.x, h.y) < 3.2);
    const raised = this.monsters.filter((m) => m.minionKind === 'skeleton').length;
    if (!h.isSuper && raised < 8) {
      if (this.mods.armyOfDead || (raiseBy && raised < 5 && this.rng.chance(0.7)) || (this.mods.necroChance > 0 && this.rng.chance(this.mods.necroChance))) {
        const hx = h.x, hy = h.y;
        const mhp = Math.max(25, h.maxHp * 0.4);
        setTimeout0(this, 0.5, () => {
          this.spawnMinion('skeleton', hx, hy, mhp, 12 + this.wave * 1.5);
          if (raiseBy) this.ev.track('necroRaise');
        });
      }
    }
    if (this.mods.posthumous) {
      const hx = h.x, hy = h.y, r = h.maxHp;
      setTimeout0(this, 0.15, () => this.explode(hx, hy, 1.25, 18 + r * 0.35, 'chain'));
    }

    // ---- visuals
    if (style === 'eaten' || style === 'fall' || style === 'pit' || style === 'melt') {
      h.state = style === 'eaten' ? 'eaten' : 'fall';
      h.stateT = 0;
    } else {
      this.finishDeath(h, style);
    }

    // ---- wave-ending kill: slow-mo + zoom
    if (this.director.done && this.heroes.every((x) => x.done)) {
      this.ev.slowMo(0.22, 0.9, p.x, p.y, 1.35);
      this.ev.hitStop(90);
    } else if (h.isSuper || combo) this.ev.hitStop(50);
  }

  /** Final death visuals (after eaten / fall animations). */
  finishDeath(h: Hero, style: DeathStyle = 'pop'): void {
    const p = this.sp(h.x, h.y, 0.4);
    h.state = 'dead';
    h.stateT = 0;
    this.ev.heroDeathFx(h, style, p.x, p.y);
    this.ev.haptic('light');
    this.ev.sfx(style === 'fly' ? 'bigDeath' : 'death', 0.9 + Math.random() * 0.3);
    if (style === 'fly') this.ev.shake(0.22);
    h.state = 'gone';
  }

  // =================================================================
  // combos & explosions
  // =================================================================
  registerCombo(name: string, h: Hero): void {
    const now = this.time;
    const last = (h as Hero & { lastCombo?: number }).lastCombo ?? -9;
    if (now - last < 0.6) return;
    (h as Hero & { lastCombo?: number }).lastCombo = now;
    this.stats.combos++;
    const p = this.sp(h.x, h.y, 1.6);
    this.ev.combo(t(`combo.${name}`), p.x, p.y);
    this.ev.track('combo:' + name);
    this.addRage(3);
  }

  explode(x: number, y: number, r: number, dmg: number, combo?: string): void {
    const p = this.sp(x, y, 0.3);
    this.particles.flash(p.x, p.y, 60 * r, '#fff3c4', 0.12);
    this.particles.fire(p.x, p.y, 16, 26 * r, 18);
    this.particles.smoke(p.x, p.y, 8, '#3b2a4a', 22);
    this.particles.ring(p.x, p.y, 10, 70 * r, C.fireHi, 0.3, 10);
    this.ev.shake(0.3);
    this.ev.sfx('explosion');
    for (const h of this.heroesIn(x, y, r)) {
      this.damageHero(h, dmg, 'fire', { kind: 'explosion', id: 'explosion' }, { combo, comboMul: 1.2 });
      if (h.alive) h.knock(h.x - x, h.y - y, 0.6);
    }
  }

  // =================================================================
  // events from heroes
  // =================================================================
  heroEnteredTile(h: Hero, tile: number): void {
    const tr = this.trapAt[tile];
    // Rogues (and Le Joueur) disarm traps they walk over.
    if (tr && tr.active && h.state === 'walk' && (h.cls === 'rogue' || h.superId === 'player') && !h.ally) {
      const chance = h.superId === 'player' ? 0.7 : 0.33;
      if (this.rng.chance(chance)) {
        tr.disarmed = true;
        const p = this.sp(tr.cx, tr.cy);
        this.texts.add(t('hud.disarmed'), p.x, p.y - 10, 'info', C.gold, 22);
        this.ev.sfx('disarm');
        if (this.rng.chance(0.5)) h.say(this, this.pick('q.cls.rogue'), 1.5);
      }
    }
    // Speedrunner guild glitching through walls.
    if (this.board.tiles[tile] === Tile.Wall) {
      const p = this.sp(h.x, h.y, 0.5);
      this.particles.spawn('glitch', p.x, p.y, { life: 0.35, size: 26, color: '#ff00ff' });
      if (this.rng.chance(0.3)) this.texts.add(t('hud.speedrunSkip'), p.x, p.y - 20, 'info', '#ff6bff', 20);
      this.ev.sfx('glitch');
    }
  }

  heroEscaped(h: Hero): void {
    h.done = true;
    h.state = 'gone';
    this.returning.push(h.spec);
  }

  heroRespawned(h: Hero): void {
    const p = this.sp(h.x, h.y, 0.5);
    this.particles.ring(p.x, p.y, 10, 60, C.gold, 0.4, 6);
    this.particles.sparks(p.x, p.y, 12, C.gold);
    h.say(this, this.pick('q.respawn'), 1.6);
    this.ev.sfx('respawn');
  }

  heroReachedMimic(h: Hero, tr: Trap): void {
    if (!tr.active || tr.chew > 0) return;
    const s = tr.stats;
    tr.anim = 0;
    tr.chew = s.cd * this.mods.trapCd;
    this.ev.sfx('chomp');
    this.ev.shake(0.25);
    if (h.hp <= s.p * (1 + (this.wave - 1) * 0.1) && !h.has('giant') && !h.isSuper) {
      this.ev.track('mimicEat');
      h.x = tr.cx;
      h.y = tr.cy - 0.05;
      this.damageHero(h, h.hp + 999, 'phys', tr.src, { style: 'eaten', noText: true });
      const p = this.sp(tr.cx, tr.cy, 0.5);
      this.texts.add('MIAM !', p.x, p.y - 20, 'big', C.gold, 32);
    } else {
      this.damageHero(h, s.dmg, 'phys', tr.src);
      if (tr.kind === 'mimic' && this.mods.echo) setTimeout0(this, 0.2, () => h.alive && this.damageHero(h, s.dmg, 'phys', tr.src));
    }
  }

  mimicReachable(tr: Trap): boolean {
    const f = this.board.field(tr.tile, 'mimic');
    return f[this.board.entranceIdx] < Infinity;
  }

  heroLanded(h: Hero, from: Trap | null): void {
    const p = this.sp(h.x, h.y);
    this.particles.smoke(p.x, p.y, 5, '#cbb8e8', 14);
    this.ev.sfx('land');
    const dmg = from ? from.stats.dmg : 5;
    const tr = this.trapAt[this.board.tileAtGrid(h.x, h.y)];
    if (tr && tr.active && tr.kind !== 'bounce') {
      // JUGGLE: landing on a trap triggers it with bonus.
      this.damageHero(h, dmg + 10, 'fall', from?.src ?? { kind: 'env', id: 'pit' }, { combo: 'juggle', comboMul: 1.5 });
      if (h.alive) {
        tr.cd = 0;
        if (tr.kind === 'trapdoor' || tr.kind === 'spikes') tr.trigger(this);
      }
      this.ev.track('juggle');
    } else {
      this.damageHero(h, dmg, 'fall', from?.src ?? { kind: 'env', id: 'pit' });
    }
  }

  heroFellInPit(h: Hero): void {
    this.registerCombo('pit', h);
    this.ev.sfx('whistle');
    this.damageHero(h, h.hp + 9999, 'fall', { kind: 'env', id: 'pit' }, { style: 'pit', noText: true });
  }

  heroFellInLava(h: Hero): void {
    this.registerCombo('lava', h);
    const p = this.sp(h.x, h.y);
    this.particles.fire(p.x, p.y, 20, 18, 16);
    this.ev.sfx('sizzle');
    this.damageHero(h, h.hp + 9999, 'fire', { kind: 'env', id: 'lava' }, { style: 'melt', noText: true });
  }

  bonk(h: Hero): void {
    const p = this.sp(h.x, h.y, 0.8);
    this.particles.spawn('star', p.x, p.y - 10, { life: 0.8, size: 10, color: C.gold, vy: -40 });
    h.stunT = Math.max(h.stunT, 0.8);
    this.damageHero(h, 8, 'phys', { kind: 'env', id: 'pit' });
    this.ev.sfx('bonk');
  }

  unstick(h: Hero): void {
    // Teleport to the nearest walkable tile (rare: after knockback onto a wall tile).
    let best = -1, bd = Infinity;
    for (let i = 0; i < N_TILES; i++) {
      if (!this.board.walkableT(this.board.tiles[i] as Tile)) continue;
      const d = dist(h.x, h.y, this.board.col(i) + 0.5, this.board.row(i) + 0.5);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) {
      h.x = this.board.col(best) + 0.5;
      h.y = this.board.row(best) + 0.5;
      h.curTile = -2;
    }
  }

  befriend(h: Hero, m: Monster): void {
    const p = this.sp(m.x, m.y, 1);
    for (let i = 0; i < 5; i++) this.particles.spawn('heart', p.x + fx.r(-14, 14), p.y, { vy: -60, life: 1.2, size: 10, color: '#ff6fb5' });
    this.texts.add(t('hud.friend'), p.x, p.y - 20, 'info', '#ff9ed2', 22);
    h.say(this, this.pick('q.befriend'), 1.8);
    this.ev.sfx('aww');
  }

  possessionEnds(h: Hero): void {
    this.damageHero(h, h.hp + 999, 'dark', { kind: 'attack', id: 'possess' }, { noText: true });
    if (h.alive) {
      h.ally = false;
      h.state = 'walk';
    }
  }

  monsterEvolved(m: Monster): void {
    const p = this.sp(m.x, m.y, 1);
    this.texts.add(t('hud.evolve'), p.x, p.y - 20, 'big', C.toxic, 28);
    this.particles.sparks(p.x, p.y, 16, C.toxic);
    this.particles.ring(p.x, p.y, 10, 50, C.toxic, 0.4, 6);
    this.ev.sfx('evolve');
  }

  // =================================================================
  // class abilities
  // =================================================================
  healPulse(h: Hero, r: number, frac: number): void {
    const p = this.sp(h.x, h.y, 0.5);
    this.particles.ring(p.x, p.y, 8, r * this.board.tileW, C.heal, 0.45, 4);
    for (const o of this.heroesIn(h.x, h.y, r)) if (o.hp < o.maxHp) this.heal(o, o.maxHp * frac);
  }

  bardAura(h: Hero, dt: number): void {
    for (const o of this.heroesIn(h.x, h.y, 2)) o.buffT = Math.max(o.buffT, 0.3);
    if (this.rng.chance(dt * 3)) {
      const p = this.sp(h.x, h.y, 1.2);
      this.particles.spawn('note', p.x + fx.r(-10, 10), p.y, { vx: fx.r(-20, 20), vy: -50, life: 1.1, size: 12, color: fx.pick(['#ffe14a', '#ff8fd0', '#8fe8ff']) });
    }
  }

  influencerHeal(h: Hero, dt: number): void {
    const fans = this.heroesIn(h.x, h.y, 2.2).length - 1;
    if (fans <= 0) return;
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.02 * fans * dt);
    if (this.rng.chance(dt * fans)) {
      const p = this.sp(h.x, h.y, 1.3);
      this.particles.spawn('like', p.x + fx.r(-10, 10), p.y, { vy: -50, life: 1, size: 11, color: '#ff4d6d' });
    }
  }

  wallToBreak(h: Hero): number {
    if (this.walls.size === 0) return -1;
    if (this.board.pathLength() < this.baseLength + 3) return -1;
    let best = -1, bd = 1.6;
    for (const tile of this.walls.keys()) {
      const d = dist(h.x, h.y, this.board.col(tile) + 0.5, this.board.row(tile) + 0.5);
      if (d < bd) { bd = d; best = tile; }
    }
    return best;
  }

  breakWall(tile: number, h: Hero): void {
    if (!this.walls.has(tile) || !h.alive) return;
    this.walls.delete(tile);
    this.board.set(tile, Tile.Floor);
    for (const x of this.heroes) x.curTile = -2;
    const c = this.board.col(tile) + 0.5, r = this.board.row(tile) + 0.5;
    const p = this.sp(c, r, 0.4);
    this.particles.debris(p.x, p.y, 14, C.wallTop, p.y + 16);
    this.particles.smoke(p.x, p.y, 8, '#8b67bd', 20);
    this.texts.add(t('hud.wallBroken'), p.x, p.y - 20, 'info', C.crimsonHi, 24);
    this.ev.shake(0.3);
    this.ev.sfx('crumble');
  }

  heroShoots(h: Hero, m: Monster): void {
    const mage = h.cls === 'mage' || h.superId === 'paladin3';
    this.shoot(mage ? 'heroBolt' : 'heroArrow', h.x, h.y, 0.7 * h.scale, m, mage ? 0.35 : 0.4, mage ? 0.3 : 0.8, (w) => w.damageMonster(m, h.dmg, h));
    this.ev.sfx(mage ? 'zap' : 'bow', 1.2);
  }

  monsterShoots(m: Monster, h: Hero): void {
    const dmg = m.damage(this);
    const src: DmgSource = { kind: 'monster', id: m.kind, monster: m };
    if (m.kind === 'necro') {
      this.shoot('dark', m.x, m.y, 0.9, h, 0.4, 0.3, (w) => w.damageHero(h, dmg, 'dark', src));
      this.ev.sfx('zap', 0.7);
    } else {
      this.shoot('arrow', m.x, m.y, 0.7, h, 0.38, 0.8, (w) => w.damageHero(h, dmg, 'phys', src));
      this.ev.sfx('bow');
    }
  }

  monsterHits(m: Monster, h: Hero): void {
    const src: DmgSource = { kind: m.isMinion ? 'minion' : 'monster', id: m.isMinion ? 'minion' : m.kind, monster: m };
    this.damageHero(h, m.damage(this), 'phys', src);
    this.ev.sfx(m.kind === 'ogre' ? 'thud' : 'hit', 0.9 + Math.random() * 0.3);
  }

  splash(m: Monster, main: Hero): void {
    for (const h of this.heroesIn(main.x, main.y, 0.8)) {
      if (h === main) continue;
      this.damageHero(h, m.damage(this) * 0.5, 'phys', { kind: 'monster', id: m.kind, monster: m });
    }
    this.ev.shake(0.12);
  }

  // =================================================================
  // traps effects
  // =================================================================
  fireCone(tr: Trap, x: number, y: number, ang: number, len: number, half: number, dmg: number): void {
    // visual flames along the cone
    for (let i = 0; i < 14; i++) {
      const d = fx.r(0.2, len);
      const a = ang + fx.r(-half, half);
      const p = this.sp(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.3);
      this.particles.spawn('fire', p.x, p.y, { vx: Math.cos(a) * 80, vy: Math.sin(a) * 40 - 40, life: fx.r(0.3, 0.55), size: fx.r(10, 18), size2: 3, color: fx.pick(['#ffe14a', '#ff8a1f', '#ff5a1a']) });
    }
    this.ev.sfx('flame');
    for (const h of this.heroes) {
      if (!h.grounded || h.ally) continue;
      const dx = h.x - x, dy = h.y - y;
      const d = Math.hypot(dx, dy);
      if (d > len + 0.2) continue;
      let da = Math.atan2(dy, dx) - ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > half + 0.25 && d > 0.45) continue;
      let combo: string | undefined;
      if (h.slimedT > 0) combo = 'burningSlime';
      const inGas = this.zones.find((z) => z.kind === 'gas' && !z.boomed && dist(z.x, z.y, h.x, h.y) < z.r);
      if (inGas) {
        inGas.boomed = true;
        inGas.t = inGas.dur;
        this.explode(inGas.x, inGas.y, inGas.r + 0.3, 30 + dmg, 'gasBoom');
      }
      this.damageHero(h, dmg, 'fire', tr.src, { combo, comboMul: 2 });
      if (h.alive) {
        h.burnT = combo ? 5 : 3;
        h.burnDps = Math.max(h.burnDps, dmg * (combo ? 0.5 : 0.25));
        h.burnSrc = tr.src;
      }
    }
  }

  axeSwing(tr: Trap, dmg: number, knock: number): void {
    this.ev.sfx('axe');
    for (const h of this.heroes) {
      if (!h.grounded || h.ally) continue;
      if (Math.abs(h.x - tr.cx) > 1.05 || Math.abs(h.y - tr.cy) > 0.5) continue;
      const combo = h.slowT > 0 ? 'strike' : h.bounced > 0 && h.t - (h.stateT) < 0.5 ? 'homeRun' : undefined;
      const done = this.damageHero(h, dmg, 'phys', tr.src, { combo, comboMul: 2 });
      if (done > 0) {
        this.ev.hitStop(45);
        this.ev.shake(0.2);
      }
      if (h.alive) h.knock(tr.swingDir, 0.15, knock);
    }
  }

  trapdoor(tr: Trap, h: Hero, dmg: number, threshold: number): void {
    const th = threshold * (1 + (this.wave - 1) * 0.12);
    if (h.hp <= th && !h.has('giant') && !h.isSuper) {
      h.x = tr.cx;
      h.y = tr.cy;
      this.ev.sfx('whistle');
      this.damageHero(h, h.hp + 999, 'fall', tr.src, { style: 'fall', noText: true });
      const p = this.sp(tr.cx, tr.cy, 0.4);
      this.texts.add('BYE !', p.x, p.y - 20, 'big', C.gold, 28);
    } else {
      this.damageHero(h, dmg, 'fall', tr.src);
      if (h.alive) h.stunT = Math.max(h.stunT, 1.0);
    }
  }

  bounceHero(tr: Trap, h: Hero): void {
    if (h.isSuper && h.superId !== 'speedguild') {
      // too heavy to launch: a painful hop instead
      h.squash.kick(8);
      this.damageHero(h, tr.stats.dmg + 4, 'fall', tr.src);
      this.ev.sfx('boing', 0.7);
      return;
    }
    // Prefer landing on a trap near the entrance (JUGGLE combo).
    const b = this.board;
    const cands: number[] = [];
    const trapped: number[] = [];
    for (let r = 0; r <= 3; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = b.idx(c, r);
        if (!b.walkable(c, r) || this.denAt[i]) continue;
        if (b.field(b.exitIdx, 'main')[i] === Infinity) continue;
        cands.push(i);
        const tt = this.trapAt[i];
        if (tt && tt.active && tt.kind !== 'bounce' && tt.kind !== 'mimic') trapped.push(i);
      }
    }
    const pool = trapped.length && this.rng.chance(0.75) ? trapped : cands;
    if (!pool.length) return;
    const dest = this.rng.pick(pool);
    h.launch(this, b.col(dest) + 0.5 + this.rng.range(-0.15, 0.15), b.row(dest) + 0.5, tr);
    this.ev.sfx('boing');
    this.ev.track('bounce');
    if (this.rng.chance(0.5)) h.say(this, this.pick('q.bounce'), 1.2);
  }

  // =================================================================
  // zones & projectiles
  // =================================================================
  spawnZone(z: Omit<Zone, 't'>): Zone {
    const zone: Zone = { ...z, t: 0 };
    this.zones.push(zone);
    return zone;
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      z.t += dt;
      z.tick = (z.tick ?? 0) - dt;
      const p = this.sp(z.x, z.y);
      switch (z.kind) {
        case 'gas':
          if (this.rng.chance(dt * 14)) {
            const a = fx.r(0, Math.PI * 2), d = fx.r(0, z.r);
            const q = this.sp(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d * 0.9, 0.2);
            this.particles.spawn('gas', q.x, q.y, { vx: fx.r(-15, 15), vy: fx.r(-25, -5), life: fx.r(0.8, 1.3), size: fx.r(14, 22), size2: fx.r(26, 36), color: fx.pick(['#9cff4f', '#6fd13a', '#b8ff7a']), alpha: 0.5 });
          }
          for (const h of this.heroesIn(z.x, z.y, z.r)) {
            if (!h.grounded) continue;
            h.poisonT = Math.max(h.poisonT, 1.2);
            h.poisonDps = Math.max(h.poisonDps, z.dps);
            h.poisonSrc = z.src;
          }
          break;
        case 'burn':
          if (this.rng.chance(dt * 10)) this.particles.fire(p.x + fx.r(-20, 20), p.y, 1, 6, 10);
          if (z.tick <= 0) {
            z.tick = 0.5;
            for (const h of this.heroesIn(z.x, z.y, z.r)) if (h.grounded) this.damageHero(h, z.dps * 0.5, 'fire', z.src, { dot: true });
          }
          break;
        case 'slimepool':
          for (const h of this.heroesIn(z.x, z.y, z.r)) {
            if (!h.grounded) continue;
            h.slowF = Math.min(h.slowF, 0.35);
            h.slowT = Math.max(h.slowT, 0.6);
            h.slimedT = 2;
          }
          break;
        case 'blackhole': {
          for (const h of this.heroesIn(z.x, z.y, z.r)) {
            if (!h.targetable || h.state === 'air') continue;
            const dx = z.x - h.x, dy = z.y - h.y;
            const d = Math.hypot(dx, dy) || 1;
            const pull = (h.isSuper ? 0.4 : 1.6) * dt * (1.2 - d / z.r);
            if (d > 0.12) {
              const nx = h.x + (dx / d) * pull, ny = h.y + (dy / d) * pull;
              const tt = this.board.get(Math.floor(nx), Math.floor(ny));
              if (tt !== Tile.Pillar && tt !== Tile.Wall) {
                h.x = nx;
                h.y = ny;
                h.curTile = -2;
              }
            }
            h.rot += dt * 6;
          }
          if (z.tick <= 0) {
            z.tick = 0.4;
            for (const h of this.heroesIn(z.x, z.y, z.r * 0.6)) this.damageHero(h, z.dps * 0.4, 'dark', z.src, { dot: true });
          }
          if (this.rng.chance(dt * 30)) {
            const a = fx.r(0, Math.PI * 2);
            const R = z.r * this.board.tileW;
            this.particles.spawn('spark', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.7, { vx: -Math.cos(a) * R * 2, vy: -Math.sin(a) * R * 1.4, life: 0.45, size: 3, color: C.dark });
          }
          break;
        }
        case 'tentacle':
          break;
      }
    }
    if (this.zones.some((z) => z.t >= z.dur)) this.zones = this.zones.filter((z) => z.t < z.dur);
  }

  shoot(kind: Projectile['kind'], x: number, y: number, z: number, target: Hero | Monster, dur: number, arc: number, onHit: (w: World, p: Projectile) => void): Projectile {
    const p: Projectile = { kind, x0: x, y0: y, z0: z, x1: target.x, y1: target.y, x, y, z, t: 0, dur, arc, target, onHit };
    this.projectiles.push(p);
    return p;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.target) {
        const alive = p.target instanceof Hero ? p.target.targetable : p.target.alive;
        if (alive) {
          p.x1 = p.target.x;
          p.y1 = p.target.y;
        }
      }
      const k = clamp(p.t / p.dur, 0, 1);
      p.x = p.x0 + (p.x1 - p.x0) * k;
      p.y = p.y0 + (p.y1 - p.y0) * k;
      p.z = p.z0 * (1 - k) + 0.5 * k + Math.sin(Math.PI * k) * p.arc;
      if (k >= 1) {
        const alive = !p.target || (p.target instanceof Hero ? p.target.targetable : p.target.alive);
        if (alive) p.onHit(this, p);
      }
    }
    if (this.projectiles.some((p) => p.t >= p.dur)) this.projectiles = this.projectiles.filter((p) => p.t < p.dur);
  }

  // =================================================================
  // minions
  // =================================================================
  spawnMinion(kind: 'skeleton' | 'goblin' | 'slimeling', x: number, y: number, hp: number, dmg: number): Monster {
    const base: MonsterId = kind === 'skeleton' ? 'archer' : 'goblin';
    const m = new Monster(base, null, x, y);
    m.minionKind = kind;
    m.state = 'minion';
    m.maxHp = m.hp = Math.round(hp * this.mods.monsterHp);
    m.minionDmg = dmg * this.mods.monsterDmg;
    m.life = kind === 'slimeling' ? 10 : 16;
    m.squash.set(-0.6);
    this.monsters.push(m);
    const p = this.sp(x, y);
    this.particles.smoke(p.x, p.y, 6, kind === 'skeleton' ? '#a35cff' : kind === 'slimeling' ? '#58e06a' : '#7dff3a', 14);
    if (kind === 'skeleton') this.ev.sfx('raise');
    return m;
  }

  // =================================================================
  // boss passives (dragon fire, kraken tentacles)
  // =================================================================
  private updatePassives(dt: number): void {
    if (this.opts.bossId === 'kraken') {
      this.tentacleT -= dt;
      if (this.tentacleT <= 0) {
        this.tentacleT = Math.max(2.2, 4.2 - this.wave * 0.08);
        const cands = this.heroes.filter((h) => h.grounded && !h.ally && this.nearWater(h.x, h.y));
        if (cands.length) {
          const h = this.rng.pick(cands);
          const z = this.spawnZone({ kind: 'tentacle', x: h.x, y: h.y, r: 0.8, dur: 0.9, dps: 0, type: 'phys', src: { kind: 'env', id: 'tentacle' } });
          setTimeout0(this, 0.35, () => {
            this.ev.sfx('splash');
            this.ev.shake(0.2);
            for (const o of this.heroesIn(z.x, z.y, z.r)) {
              this.damageHero(o, 26 * (1 + this.wave * 0.12), 'phys', z.src);
              if (o.alive) o.knock(o.x - z.x + 0.01, o.y - z.y, 0.7);
            }
          });
        }
      }
    }
  }

  nearWater(x: number, y: number): boolean {
    const c = Math.floor(x), r = Math.floor(y);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (this.board.get(c + dc, r + dr) === Tile.Water) return true;
    return false;
  }

  // =================================================================
  // ultimate
  // =================================================================
  canUltimate(): boolean {
    return this.phase === 'wave' && this.boss.rage >= 100 && !this.ult;
  }

  ultimate(): boolean {
    if (!this.canUltimate()) return false;
    this.boss.rage = 0;
    this.ult = { t: 0, kind: this.opts.bossId, fired: false };
    this.boss.mood = 'ult';
    this.boss.moodT = 2.2;
    this.stats.ultimates++;
    this.ev.track('ultimate');
    this.ev.ultimate(this.opts.bossId);
    return true;
  }

  private updateUltimate(dt: number): void {
    const u = this.ult!;
    u.t += dt;
    if (!u.fired && u.t > 0.5) {
      u.fired = true;
      ultimateEffect(this, u.kind);
    }
    if (u.t > 2.5) this.ult = null;
  }

  // =================================================================
  // economy & building
  // =================================================================
  addGold(n: number): void {
    this.gold += n;
    this.stats.goldEarned += n;
  }

  costOf(id: BuildId): number {
    let c: number;
    if (id === 'wall') c = WALL_COST * this.mods.wallCostMul;
    else if (id in TRAPS) c = TRAPS[id as TrapId].cost;
    else c = MONSTERS[id as MonsterId].cost * this.mods.monsterCostMul;
    if (id === 'slime' && this.opts.bossId === 'slime') return 0;
    return Math.max(0, Math.round(c * this.mods.costMul));
  }

  upgradeCost(tr: Trap): number {
    if (tr.level >= 3) return 0;
    return Math.round(tr.def.upgrade[tr.level - 1] * this.mods.costMul);
  }

  isUnlocked(id: BuildId): boolean {
    return this.opts.unlocked.has(id);
  }

  /** Returns null if allowed or an i18n key explaining why not. */
  canPlace(id: BuildId, tile: number): string | null {
    const b = this.board;
    if (tile < 0) return 'hud.cantPlace';
    const tt = b.tiles[tile] as Tile;
    const occupied = this.trapAt[tile] || this.denAt[tile];
    if (id === 'bats') {
      if (occupied) return 'hud.cantPlace';
      if (tt === Tile.Pit || tt === Tile.Lava || tt === Tile.Water) return 'hud.cantPlace';
    } else {
      if (tt !== Tile.Floor || occupied) return 'hud.cantPlace';
    }
    if (id === 'wall') {
      if (tile === b.entranceIdx || tile === b.exitIdx) return 'hud.cantPlace';
      b.tiles[tile] = Tile.Wall;
      const ok = b.pathExists() && this.allMimicsReachable();
      b.tiles[tile] = Tile.Floor;
      if (!ok) return 'hud.blocked';
    }
    if (this.gold < this.costOf(id)) return 'hud.noGold';
    return null;
  }

  private allMimicsReachable(): boolean {
    for (const tr of this.traps) {
      if (tr.kind !== 'mimic') continue;
      const f = new Board();
      f.tiles = this.board.tiles;
      f.entrance = this.board.entrance;
      f.exit = this.board.exit;
      if (f.field(tr.tile, 'm')[this.board.entranceIdx] === Infinity) return false;
    }
    return true;
  }

  place(id: BuildId, tile: number): boolean {
    if (this.canPlace(id, tile)) return false;
    const cost = this.costOf(id);
    this.gold -= cost;
    if (id === 'wall') {
      this.walls.set(tile, true);
      this.board.set(tile, Tile.Wall);
      (this.wallInvest ??= new Map()).set(tile, cost);
    } else if (id in TRAPS) {
      const tr = this.addTrap(id as TrapId, tile, cost);
      if (this.mods.freeLevel && tr.level < 3) tr.level++;
    } else {
      this.addDen(id as MonsterId, tile, cost);
    }
    this.trapVersion++;
    return true;
  }

  wallInvest?: Map<number, number>;

  addTrap(kind: TrapId, tile: number, invested: number): Trap {
    const tr = new Trap(kind, tile, this.board.col(tile) + 0.5, this.board.row(tile) + 0.5, invested);
    this.traps.push(tr);
    this.trapAt[tile] = tr;
    this.trapVersion++;
    return tr;
  }

  addDen(kind: MonsterId, tile: number, invested: number): Den {
    const den = new Den(kind, tile, invested);
    const def = MONSTERS[kind];
    const cx = this.board.col(tile) + 0.5, cy = this.board.row(tile) + 0.5;
    for (let i = 0; i < def.count; i++) {
      const m = new Monster(kind, den, cx, cy);
      if (def.count > 1) {
        m.ox = (i - (def.count - 1) / 2) * 0.32;
        m.oy = i % 2 ? 0.1 : -0.1;
        m.x += m.ox;
        m.y += m.oy;
      }
      m.refreshStats(this);
      m.hp = m.maxHp;
      m.squash.set(-0.6);
      den.bodies.push(m);
      this.monsters.push(m);
    }
    this.dens.push(den);
    this.denAt[tile] = den;
    return den;
  }

  sellValue(tile: number): number {
    const tr = this.trapAt[tile];
    const den = this.denAt[tile];
    if (tr) return tr.placedThisBuild ? tr.invested : Math.floor(tr.invested * 0.6);
    if (den) return den.placedThisBuild ? den.invested : Math.floor(den.invested * 0.6);
    if (this.walls.has(tile)) {
      const inv = this.wallInvest?.get(tile) ?? 0;
      return this.walls.get(tile) ? inv : Math.floor(inv * 0.5);
    }
    return 0;
  }

  sell(tile: number): number {
    const v = this.sellValue(tile);
    const tr = this.trapAt[tile];
    const den = this.denAt[tile];
    if (tr) {
      this.traps = this.traps.filter((x) => x !== tr);
      this.trapAt[tile] = null;
    } else if (den) {
      for (const m of den.bodies) m.release();
      this.monsters = this.monsters.filter((m) => m.den !== den);
      this.dens = this.dens.filter((d) => d !== den);
      this.denAt[tile] = null;
    } else if (this.walls.has(tile)) {
      this.walls.delete(tile);
      this.board.set(tile, Tile.Floor);
    } else return 0;
    this.gold += v;
    this.trapVersion++;
    return v;
  }

  upgrade(tile: number): boolean {
    const tr = this.trapAt[tile];
    if (!tr || tr.level >= 3) return false;
    const c = this.upgradeCost(tr);
    if (this.gold < c) return false;
    this.gold -= c;
    tr.invested += c;
    tr.level++;
    tr.squash.kick(10);
    return true;
  }
}

// =====================================================================
// tiny deterministic timer (runs on simulation time)
// =====================================================================
interface Timer { at: number; fn: () => void }
const timers = new WeakMap<World, Timer[]>();
export function setTimeout0(w: World, delay: number, fn: () => void): void {
  let l = timers.get(w);
  if (!l) {
    l = [];
    timers.set(w, l);
  }
  l.push({ at: w.time + delay, fn });
}
export function runTimers(w: World): void {
  const l = timers.get(w);
  if (!l || !l.length) return;
  const due = l.filter((x) => x.at <= w.time);
  if (!due.length) return;
  timers.set(w, l.filter((x) => x.at > w.time));
  for (const d of due) d.fn();
}

