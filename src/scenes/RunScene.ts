import type { Game } from '../core/Game';
import type { Pointer, Scene } from '../core/Scene';
import { clamp, dist, easeOutBack, easeOutElastic, fmt, TAU } from '../core/math';
import { fx } from '../core/Rng';
import { World, type DeathStyle, type KillInfo, type Phase, type WorldEvents } from '../game/World';
import type { Hero } from '../game/Hero';
import { castSwipe, castTap, holdBegin, holdCancel, holdRelease, holdUpdate, type HoldState } from '../game/Attacks';
import { ROWS } from '../game/Board';
import { WorldRenderer } from '../render/WorldRenderer';
import { C, CONFETTI } from '../render/palette';
import { circle, fillStroke, poly, roundRectPath, text, textBlock, withAlpha, wobblyRectPath } from '../render/draw';
import { sprites } from '../render/Sprites';
import { icon } from '../render/icons';
import { drawHat } from '../render/art/heroArt';
import { drawTrapIcon } from '../render/art/trapArt';
import { drawMonster } from '../render/art/monsterArt';
import { Button, UI } from '../ui/Button';
import { bar, dim, panel, toasts } from '../ui/widgets';
import { audio } from '../systems/Audio';
import { haptics } from '../systems/Haptics';
import { store } from '../systems/Save';
import { meta, runSetup } from '../game/Meta';
import { t, tr } from '../i18n';
import { ATTACKS, SLOT_ORDER } from '../data/attacks';
import { TRAPS, TRAP_ORDER } from '../data/traps';
import { MONSTER_ORDER } from '../data/monsters';
import type { AttackSlot, BuildId, MonsterId, TrapId } from '../data/types';
import type { PactDef } from '../data/pacts';
import { superFor } from '../game/Waves';
import { skinVariant } from '../data/unlocks';

export interface RunOpts {
  daily?: boolean;
  endless?: boolean;
  seed?: number;
}

interface Banner {
  text: string;
  sub?: string;
  color: string;
  t: number;
  dur: number;
}

interface CoinFx {
  x0: number;
  y0: number;
  t: number;
  dur: number;
  cx: number;
  cy: number;
}

interface Gesture {
  id: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  t0: number;
  mode: 'pending' | 'swipe' | 'hold' | 'ui' | 'build' | 'none';
  pts: { x: number; y: number; t: number }[];
  hold: HoldState | null;
}

const BUILD_ROW1: BuildId[] = ['wall', ...TRAP_ORDER];
const BUILD_ROW2: BuildId[] = [...MONSTER_ORDER];

export class RunScene implements Scene {
  game: Game;
  w!: World;
  wr = new WorldRenderer();
  ui = new UI();
  pauseUI = new UI();
  opts: RunOpts;
  t = 0;
  paused = false;
  // layout
  bossX = 360;
  bossY = 1200;
  bossScale = 0.8;
  hudTop = 0;
  // fx
  banners: Banner[] = [];
  coins: CoinFx[] = [];
  vignette = 0;
  ultFx = 0;
  ultName = '';
  streakFx: { label: string; n: number; t: number } | null = null;
  goldShown = 0;
  goldBump = 0;
  hpShake = 0;
  slotShake: Record<AttackSlot, number> = { tap: 0, swipe: 0, hold: 0 };
  pendingSnap: { x: number; y: number } | null = null;
  zoomTimer = 0;
  endT = 0;
  // input
  g: Gesture | null = null;
  trail: { x: number; y: number; t: number }[] = [];
  // build
  selBuild: BuildId | null = null;
  selTile = -1;
  hoverTile = -1;
  hoverOk = false;
  popup: { tile: number; upBtn: Button | null; sellBtn: Button } | null = null;
  fightBtn!: Button;
  // pact
  pactT = 0;
  pactPick = -1;
  pactPickT = 0;
  rerollBtn!: Button;
  // hints
  hint: { key: string; text: string } | null = null;
  confirmQuit = false;

  constructor(game: Game, opts: RunOpts = {}) {
    this.game = game;
    this.opts = opts;
  }

  // ================================================================ setup
  enter(): void {
    const setup = runSetup(!!this.opts.daily);
    // Debug/testing hooks: ?debug&wave=10&gold=500&unlockall&boss=dragon&build
    const q = new URLSearchParams(location.search);
    const debug = q.has('debug');
    if (debug) {
      if (q.has('unlockall')) {
        setup.unlocked = new Set(['wall', ...TRAP_ORDER, ...MONSTER_ORDER] as BuildId[]);
        if (q.get('tap')) setup.attacks.tap = q.get('tap') as never;
        if (q.get('swipe')) setup.attacks.swipe = q.get('swipe') as never;
        if (q.get('hold')) setup.attacks.hold = q.get('hold') as never;
      }
      if (q.get('boss')) setup.bossId = q.get('boss') as never;
      if (q.get('gold')) setup.startGold = Number(q.get('gold'));
      if (q.get('rage')) setup.rageStart = Number(q.get('rage'));
    }
    const seed = this.opts.seed ?? (debug && q.get('seed') ? Number(q.get('seed')) : (Math.random() * 2 ** 31) | 0);
    this.w = new World({ ...setup, seed, daily: this.opts.daily, endless: this.opts.endless, ev: this.events() });
    if (debug && q.get('wave')) this.w.wave = Number(q.get('wave'));
    this.goldShown = this.w.gold;
    this.layout();
    meta.startRun();
    this.buildUI();
    toasts.anchor = () => this.w.board.bottomY - 40;
    if (debug && q.has('build')) {
      this.w.phase = 'build';
      this.w.buildTime = 999;
      this.onPhase('build');
      return;
    }
    this.w.startWave();
    if (!store.data.hints.fireball) this.hint = { key: 'fireball', text: t('hint.fireball') };
    this.game.camera.intensity = store.data.settings.shake ? 1 : 0.15;
  }

  resize(): void {
    this.layout();
    this.buildUI();
  }

  private layout(): void {
    const g = this.game;
    const W = g.W, H = g.H;
    const st = g.safeTop + 6, sb = g.safeBottom;
    this.hudTop = st;
    const bossArea = clamp(H * 0.25, 250, 400);
    const bottom = H - sb - bossArea;
    const b = this.w.board;
    b.layout(W, st + 100 + 70 * 1.45, bottom);
    b.layout(W, st + 100 + b.tileH * 1.45, bottom);
    this.bossX = W / 2;
    this.bossY = H - sb + 8;
    this.bossScale = clamp((this.bossY - (b.bottomY + 18)) / 460, 0.45, 1.05);
    const mouth = b.unproject(this.bossX, this.bossY - 270 * this.bossScale);
    this.w.bossMouth = { x: mouth.gx, y: mouth.gy, z: 0 };
  }

  private buildUI(): void {
    const H = this.game.H, sb = this.game.safeBottom;
    this.ui.clear();
    const panelTop = H - sb - 262;
    this.fightBtn = this.ui.add(new Button(470, panelTop + 12, 236, 64, t('hud.fight'), () => this.startFight()));
    this.fightBtn.style(C.uiGood, C.uiGoodDark);
    this.fightBtn.size = 32;
    this.fightBtn.pulse = true;
    this.fightBtn.sfx = 'fanfare';
    this.rerollBtn = new Button(260, 0, 200, 58, t('pact.reroll'), () => {
      if (this.pactPick < 0 && this.w.reroll()) {
        this.pactT = 0;
        audio.play('card');
      }
    });
    this.rerollBtn.style(C.uiBlue, C.uiBlueDark);
    this.rerollBtn.size = 24;
    this.rerollBtn.iconName = 'echo';
    // pause menu
    this.pauseUI.clear();
    const cx = 360, y0 = H * 0.3;
    const mk = (y: number, label: string, fn: () => void, col: string = C.uiBtn, dk: string = C.uiBtnDark) => {
      const b = this.pauseUI.add(new Button(cx - 190, y, 380, 70, label, fn));
      b.style(col, dk);
      return b;
    };
    mk(y0, t('pause.resume'), () => this.setPaused(false), C.uiGood, C.uiGoodDark);
    const sfx = mk(y0 + 90, '', () => {
      store.data.settings.sfx = store.data.settings.sfx > 0 ? 0 : 0.9;
      this.applySettings();
    }, C.uiPanelHi, C.uiPanel);
    sfx.custom = (ctx, b) => this.toggleLabel(ctx, b, t('set.sfx'), store.data.settings.sfx > 0);
    const mus = mk(y0 + 175, '', () => {
      store.data.settings.music = store.data.settings.music > 0 ? 0 : 0.6;
      this.applySettings();
    }, C.uiPanelHi, C.uiPanel);
    mus.custom = (ctx, b) => this.toggleLabel(ctx, b, t('set.music'), store.data.settings.music > 0);
    const hap = mk(y0 + 260, '', () => {
      store.data.settings.haptics = !store.data.settings.haptics;
      this.applySettings();
    }, C.uiPanelHi, C.uiPanel);
    hap.custom = (ctx, b) => this.toggleLabel(ctx, b, t('set.haptics'), store.data.settings.haptics);
    const quit = mk(y0 + 360, t('pause.quit'), () => {
      if (!this.confirmQuit) {
        this.confirmQuit = true;
        quit.label = t('pause.quitConfirm');
        return;
      }
      this.setPaused(false);
      this.finish(false);
    });
    quit.size = 26;
  }

  private toggleLabel(ctx: CanvasRenderingContext2D, b: Button, label: string, on: boolean): void {
    text(ctx, label, -b.w / 2 + 24, 0, { size: 26, align: 'left' });
    roundRectPath(ctx, b.w / 2 - 110, -18, 90, 36, 18);
    fillStroke(ctx, on ? C.uiGood : '#5a5068', 3.5);
    text(ctx, on ? t('common.on') : t('common.off'), b.w / 2 - 65, 1, { size: 15 });
  }

  private applySettings(): void {
    const s = store.data.settings;
    audio.setVolumes(s.sfx, s.music);
    haptics.enabled = s.haptics;
    this.game.camera.intensity = s.shake ? 1 : 0.15;
    store.save();
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.confirmQuit = false;
    const q = this.pauseUI.buttons[this.pauseUI.buttons.length - 1];
    if (q) q.label = t('pause.quit');
    if (this.g?.hold) holdCancel(this.w, this.g.hold);
    this.g = null;
  }

  // =============================================================== events
  private events(): WorldEvents {
    const g = this.game;
    return {
      sfx: (n, p) => audio.play(n, p),
      voice: (h) => this.voice(h),
      shake: (a) => g.camera.shake(a),
      hitStop: (ms) => g.hitStop(ms),
      haptic: (k) => haptics.impact(k),
      slowMo: (s, d, x, y, z) => {
        g.slowMo(s, d);
        if (x !== undefined && y !== undefined && z) {
          g.camera.zoomTo(z, x, y);
          this.zoomTimer = d;
        }
      },
      banner: (txt, sub, col) => this.banner(txt, sub, col),
      heroDeathFx: (h, style, x, y) => this.deathFx(h, style, x, y),
      heroKilled: (h, info) => this.onKill(h, info),
      coins: (x, y, n) => this.coinFx(x, y, n),
      combo: (name, x, y) => {
        this.w.texts.add(t('combo.title'), x, y - 34, 'big', C.goldHi, 24);
        this.w.texts.add(name + ' !', x, y, 'combo', '#ff9a3d', 34);
        audio.play('combo');
        haptics.impact('medium');
      },
      streak: (n, label) => {
        this.streakFx = { label, n, t: 0 };
        audio.play('streak', 1 + n * 0.08);
        g.camera.shake(0.15 + Math.min(0.4, n * 0.03));
      },
      bossHurt: () => {
        this.vignette = 1;
        this.hpShake = 0.5;
      },
      track: (e, n) => meta.track(e, n),
      phase: (p) => this.onPhase(p),
      snapshot: (_h, x, y) => (this.pendingSnap = { x, y }),
      ultimate: (kind) => {
        this.ultFx = 1;
        this.ultName = t(`boss.${kind}.ult`);
        audio.play('ultimate');
        haptics.impact('heavy');
        g.slowMo(0.3, 0.9);
        g.camera.zoomTo(1.25, this.bossX, this.bossY - 300 * this.bossScale);
        this.zoomTimer = 0.7;
      },
    };
  }

  private voice(h: Hero): void {
    let base = h.spec.gender === 'f' ? 340 : 230;
    let kind: 'normal' | 'chicken' | 'deep' | 'squeak' | 'robot' = 'normal';
    if (h.has('giant') || h.superId === 'paladin3') { base *= 0.55; kind = 'deep'; }
    if (h.has('tiny') || h.superId === 'speedguild') base *= 1.7;
    if (h.has('chicken')) kind = 'chicken';
    if (h.superId === 'player') kind = 'robot';
    audio.voice(base, kind);
  }

  banner(txt: string, sub?: string, color: string = C.white): void {
    if (this.banners.length > 2) this.banners.splice(1, this.banners.length - 2);
    this.banners.push({ text: txt, sub, color, t: 0, dur: 1.7 });
  }

  private onPhase(p: Phase): void {
    const w = this.w;
    if (p === 'wave') {
      audio.setMusic(superFor(w.wave) ? 'boss' : 'wave');
      this.selBuild = null;
      this.selTile = -1;
      this.popup = null;
      if (w.learnedThisWave.length) {
        const what = w.learnedThisWave.map((k) => t(`hud.learned.${k}`)).join(', ');
        this.banner(t('hud.learned', { what: '' }).replace(/ : $/, ''), what, C.crimsonHi);
      }
      if (superFor(w.wave) === 'chosen') this.banner(t('super.chosen.name'), t('hud.superHint'), C.gold);
    } else if (p === 'cleared') {
      audio.play('waveClear');
      if (this.hint?.key === 'fireball') this.hint = null;
    } else if (p === 'pact') {
      audio.setMusic('build');
      this.pactT = 0;
      this.pactPick = -1;
      audio.play('pact');
      if (!store.data.hints.pact) this.hint = { key: 'pact', text: t('hint.pact') };
    } else if (p === 'build') {
      this.selBuild = null;
      this.selTile = -1;
      if (!store.data.hints.trap) this.hint = { key: 'trap', text: t('hint.trap') };
    } else if (p === 'over') {
      audio.setMusic('off');
      audio.play('defeat');
      this.endT = 0;
    } else if (p === 'victory') {
      audio.setMusic('off');
      audio.play('victory');
      this.endT = 0;
    }
  }

  private onKill(h: Hero, info: KillInfo): void {
    audio.cutFanfare();
    const quote = h.bubble?.text ?? tr('q.death');
    meta.heroKilled(h, quote);
    (h as Hero & { deathQuote?: string }).deathQuote = quote;
    void info;
  }

  private coinFx(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.coins.push({ x0: x + fx.r(-14, 14), y0: y + fx.r(-10, 10), t: -i * 0.04, dur: fx.r(0.45, 0.7), cx: x + fx.r(-120, 120), cy: y - fx.r(60, 180) });
    }
  }

  /** Cosmetic death: confetti/fireworks/ducks..., bouncing helmet, annoyed soul. */
  private deathFx(h: Hero, style: DeathStyle, x: number, y: number): void {
    const ps = this.w.particles;
    const floor = y + 18;
    const cos = store.data.cosmetics.death;
    if (cos === 'fireworks') {
      for (let i = 0; i < 3; i++) {
        const col = fx.pick(CONFETTI);
        ps.sparks(x + fx.r(-20, 20), y - 30 - i * 20, 14, col, 420);
        ps.ring(x, y - 30 - i * 20, 4, 40, col, 0.4, 4);
      }
    } else if (cos === 'ducks') {
      ensureDuck();
      for (let i = 0; i < 6; i++) ps.spawn('duck', x, y - 10, { key: 'duck', vx: fx.r(-260, 260), vy: fx.r(-520, -260), g: 900, floor: floor + fx.r(-4, 8), bounce: 0.55, life: 1.6, sx: fx.r(0.6, 1), vr: fx.r(-6, 6) });
    } else if (cos === 'bubbles') {
      for (let i = 0; i < 12; i++) ps.spawn('bubble', x + fx.r(-20, 20), y - fx.r(0, 30), { vx: fx.r(-30, 30), vy: fx.r(-120, -40), life: fx.r(0.8, 1.6), size: fx.r(5, 12), color: fx.pick(['#bff4ff', '#ffd1f0', '#ffffff']) });
    } else if (cos === 'pixels') {
      for (let i = 0; i < 22; i++) ps.spawn('pixel', x + fx.r(-16, 16), y - fx.r(0, 40), { vx: fx.r(-200, 200), vy: fx.r(-400, -100), g: 800, floor, life: fx.r(0.7, 1.3), size: 6, color: fx.pick([h.spec.tunic, h.spec.skin, h.spec.hair, '#ffffff']) });
    } else {
      ps.confetti(x, y - 20, style === 'fly' ? 18 : 30, 1, floor);
    }
    ps.smoke(x, y - 10, 5, '#efe4ff', 16);
    // helmet bounce
    const hatKey = ensureHat(h.cls, h.spec.tunic);
    if (!h.has('chicken')) ps.spawn('sprite', x, y - 40, { key: hatKey, vx: fx.r(-200, 200), vy: fx.r(-560, -380), g: 1300, floor: floor + fx.r(0, 10), bounce: 0.55, life: 1.8, vr: fx.r(-14, 14), sx: (this.w.board.pxPerTile(h.y) / 92) * h.scale * 1.3 });
    // the hero itself flies off screen
    if (style === 'fly') {
      const key = this.wr.heroSpriteKey(h);
      const dir = h.x < 3.5 ? -1 : 1;
      ps.spawn('sprite', x, y - 20, { key, vx: dir * fx.r(500, 800), vy: fx.r(-900, -600), g: 1200, life: 1.4, vr: dir * fx.r(10, 18), sx: (this.w.board.pxPerTile(h.y) / 92) * h.scale * 1.3 });
      this.w.texts.add(fx.pick(['OUCH !', 'BYE !', 'AÏE !', 'BONK !']), x, y - 50, 'big', '#ffffff', 26);
    }
    // annoyed soul
    const quote = (h as Hero & { deathQuote?: string }).deathQuote ?? tr('q.death');
    const showQuote = h.isSuper || fx.chance(0.35);
    ps.spawn('soul', x, y - 30, { vy: -48, life: showQuote ? 2.4 : 1.6, sx: 0.9 * h.scale, text: showQuote ? quote : '' });
  }

  // =============================================================== update
  update(dt: number, rdt: number): void {
    this.t += rdt;
    this.ui.update(rdt);
    this.pauseUI.update(rdt);
    if (this.paused) return;
    const w = this.w;
    w.update(dt);
    // gesture hold tracking
    if (this.g?.mode === 'hold' && this.g.hold) {
      const gp = this.toGrid(this.g.x, this.g.y);
      if (!holdUpdate(w, this.g.hold, gp.gx, gp.gy, dt)) {
        this.g.hold = null;
        this.g.mode = 'none';
      }
    } else if (this.g?.mode === 'pending' && w.phase === 'wave') {
      const held = (performance.now() - this.g.t0) / 1000;
      if (held > 0.22 && dist(this.g.x, this.g.y, this.g.sx, this.g.sy) < 28) {
        const gp = this.toGrid(this.g.sx, this.g.sy);
        const hs = holdBegin(w, gp.gx, gp.gy);
        if (hs) {
          this.g.mode = 'hold';
          this.g.hold = hs;
          haptics.impact('light');
        } else {
          this.g.mode = 'none';
          this.notReady('hold', this.g.x, this.g.y);
        }
      }
    }
    // fx timers
    this.vignette = Math.max(0, this.vignette - rdt * 2.2);
    this.hpShake = Math.max(0, this.hpShake - rdt);
    this.ultFx = Math.max(0, this.ultFx - rdt * 0.55);
    for (const s of SLOT_ORDER) this.slotShake[s] = Math.max(0, this.slotShake[s] - rdt * 3);
    if (this.zoomTimer > 0) {
      this.zoomTimer -= rdt;
      if (this.zoomTimer <= 0) this.game.camera.reset(this.game.W, this.game.H);
    }
    for (const b of this.banners.slice(0, 1)) b.t += rdt;
    if (this.banners.length && this.banners[0].t > this.banners[0].dur) this.banners.shift();
    if (this.streakFx) {
      this.streakFx.t += rdt;
      if (this.streakFx.t > 1.2) this.streakFx = null;
    }
    // coins to HUD
    for (const c of this.coins) c.t += rdt;
    const arrived = this.coins.filter((c) => c.t >= c.dur);
    if (arrived.length) {
      this.goldBump = 1;
      audio.play('coin', 0.9 + Math.random() * 0.3);
    }
    this.coins = this.coins.filter((c) => c.t < c.dur);
    this.goldBump = Math.max(0, this.goldBump - rdt * 4);
    if (this.coins.length === 0 || w.gold < this.goldShown) this.goldShown += (w.gold - this.goldShown) * Math.min(1, rdt * 10);
    if (Math.abs(this.goldShown - w.gold) < 0.5) this.goldShown = w.gold;
    this.trail = this.trail.filter((p) => this.t - p.t < 0.25);
    // pact
    if (w.phase === 'pact') {
      this.pactT += rdt;
      if (this.pactPick >= 0) {
        this.pactPickT += rdt;
        if (this.pactPickT > 0.75) {
          const p = w.pactOffer[this.pactPick];
          this.pactPick = -1;
          if (p) w.choosePact(p);
        }
      }
    }
    // build button state
    if (w.phase === 'build') {
      this.fightBtn.sub = t('build.time', { n: Math.ceil(w.buildTime) });
      if (w.buildTime < 5 && Math.ceil(w.buildTime) !== Math.ceil(w.buildTime + dt)) audio.play('tick');
    }
    // end of run
    if (w.phase === 'over' || w.phase === 'victory') {
      this.endT += rdt;
      if (w.phase === 'victory' && Math.random() < rdt * 8) w.particles.confetti(fx.r(60, 660), fx.r(200, 600), 20, 1.2);
      if (this.endT > 3.2) this.finish(w.phase === 'victory');
    }
  }

  exit(): void {
    toasts.anchor = null;
  }

  private finished = false;
  private finish(won: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const res = meta.endRun(this.w, won);
    void import('./StatsScene').then(({ StatsScene }) => this.game.setScene(new StatsScene(this.game, this.w, won, res.souls, res.record, this.opts)));
  }

  // ================================================================ input
  private toGrid(x: number, y: number): { gx: number; gy: number } {
    const p = this.game.camera.toWorld(x, y, this.game.W, this.game.H);
    return this.w.board.unproject(p.x, p.y);
  }

  private bossHit(x: number, y: number): boolean {
    const s = this.bossScale;
    return Math.abs(x - this.bossX) < 190 * s && y > this.bossY - 440 * s && y < this.bossY - 120 * s;
  }

  private slotPos(s: AttackSlot | 'ult'): { x: number; y: number } {
    const H = this.game.H - this.game.safeBottom;
    if (s === 'tap') return { x: 62, y: H - 72 };
    if (s === 'swipe') return { x: 62, y: H - 172 };
    if (s === 'hold') return { x: 658, y: H - 72 };
    return { x: 658, y: H - 178 };
  }

  pointerDown(p: Pointer): void {
    audio.unlock();
    const w = this.w;
    if (this.paused) {
      this.pauseUI.down(p.x, p.y);
      return;
    }
    // pause button
    if (p.x > 640 && p.y < this.hudTop + 80) {
      this.setPaused(true);
      audio.play('click');
      return;
    }
    if (w.phase === 'pact') {
      if (this.rerollBtn.visible && this.rerollBtn.contains(p.x, p.y)) {
        this.rerollBtn.press();
        this.g = this.mkG(p, 'ui');
      } else this.pactTap(p.x, p.y);
      return;
    }
    if (w.phase === 'build') {
      if (this.popup) {
        if (this.popup.upBtn?.contains(p.x, p.y)) { this.popup.upBtn.press(); this.g = this.mkG(p, 'ui'); return; }
        if (this.popup.sellBtn.contains(p.x, p.y)) { this.popup.sellBtn.press(); this.g = this.mkG(p, 'ui'); return; }
      }
      if (this.ui.down(p.x, p.y)) {
        this.g = this.mkG(p, 'ui');
        return;
      }
      const card = this.cardAt(p.x, p.y);
      if (card) {
        this.tapCard(card);
        this.g = this.mkG(p, 'none');
        return;
      }
      this.g = this.mkG(p, 'build');
      this.updateHover(p.x, p.y);
      return;
    }
    if (w.phase !== 'wave') return;
    // ultimate: tap the boss or the ULT slot when rage is full
    const up = this.slotPos('ult');
    if (w.canUltimate() && (this.bossHit(p.x, p.y) || dist(p.x, p.y, up.x, up.y) < 50)) {
      w.ultimate();
      this.g = this.mkG(p, 'none');
      return;
    }
    this.g = this.mkG(p, 'pending');
    this.trail = [{ x: p.x, y: p.y, t: this.t }];
  }

  private mkG(p: Pointer, mode: Gesture['mode']): Gesture {
    return { id: p.id, sx: p.x, sy: p.y, x: p.x, y: p.y, t0: performance.now(), mode, pts: [{ x: p.x, y: p.y, t: this.t }], hold: null };
  }

  pointerMove(p: Pointer): void {
    const g = this.g;
    if (!g || g.id !== p.id) return;
    g.x = p.x;
    g.y = p.y;
    if (g.mode === 'build') {
      this.updateHover(p.x, p.y);
      return;
    }
    if (g.mode === 'pending' || g.mode === 'swipe') {
      g.pts.push({ x: p.x, y: p.y, t: this.t });
      this.trail.push({ x: p.x, y: p.y, t: this.t });
      if (g.mode === 'pending' && dist(p.x, p.y, g.sx, g.sy) > 34) g.mode = 'swipe';
    }
  }

  pointerUp(p: Pointer): void {
    const w = this.w;
    if (this.paused) {
      this.pauseUI.up(p.x, p.y);
      return;
    }
    const g = this.g;
    this.g = null;
    if (!g || g.id !== p.id) {
      this.ui.cancel();
      return;
    }
    if (g.mode === 'ui') {
      if (w.phase === 'pact') this.rerollBtn.release(this.rerollBtn.contains(p.x, p.y));
      else if (this.popup && (this.popup.upBtn?.pressed || this.popup.sellBtn.pressed)) {
        this.popup.upBtn?.release(this.popup.upBtn.contains(p.x, p.y));
        this.popup.sellBtn.release(this.popup.sellBtn.contains(p.x, p.y));
      } else this.ui.up(p.x, p.y);
      return;
    }
    if (w.phase === 'pact') return;
    if (g.mode === 'build') {
      this.buildRelease(p.x, p.y);
      return;
    }
    if (w.phase !== 'wave') return;
    if (g.mode === 'hold' && g.hold) {
      holdRelease(w, g.hold);
      return;
    }
    if (g.mode === 'swipe') {
      const a = this.toGrid(g.sx, g.sy);
      const b = this.toGrid(p.x, p.y);
      if (!castSwipe(w, a.gx, a.gy, b.gx, b.gy)) this.notReady('swipe', p.x, p.y);
      return;
    }
    if (g.mode === 'pending') {
      const gp = this.toGrid(p.x, p.y);
      if (gp.gy > ROWS + 0.6) return; // tapped the boss area
      if (castTap(w, gp.gx, gp.gy)) {
        w.particles.ring(p.x, p.y, 6, 34, C.fireHi, 0.25, 4);
        if (this.hint?.key === 'fireball') this.doneHint('fireball');
      } else this.notReady('tap', p.x, p.y);
    }
  }

  private notReady(slot: AttackSlot, x: number, y: number): void {
    this.slotShake[slot] = 1;
    if (this.w.boss.cd[slot] > 0) {
      this.w.texts.add(t('hud.notReady'), x, y - 30, 'info', '#ffb3c0', 20);
      audio.play('error');
    }
  }

  back(): boolean {
    if (this.w.phase === 'over' || this.w.phase === 'victory') return true;
    this.setPaused(!this.paused);
    return true;
  }

  pause(): void {
    if (this.w.phase === 'wave' || this.w.phase === 'build') this.setPaused(true);
  }

  private doneHint(key: string): void {
    store.data.hints[key] = true;
    store.save();
    if (this.hint?.key === key) this.hint = null;
  }

  // ---------------------------------------------------------------- build
  private startFight(): void {
    const w = this.w;
    if (w.phase !== 'build') return;
    const bonus = Math.floor(Math.max(0, w.buildTime) / 3);
    if (bonus > 0) {
      w.addGold(bonus);
      this.banner(t('hud.fightBonus', { n: bonus }), undefined, C.gold);
    }
    this.popup = null;
    this.selTile = -1;
    this.selBuild = null;
    w.startWave();
  }

  private cardRect(id: BuildId): { x: number; y: number; w: number; h: number } | null {
    const H = this.game.H, sb = this.game.safeBottom;
    const top = H - sb - 262;
    let i = BUILD_ROW1.indexOf(id);
    if (i >= 0) return { x: 6 + i * 79, y: top + 88, w: 76, h: 80 };
    i = BUILD_ROW2.indexOf(id);
    if (i >= 0) return { x: 6 + i * 79, y: top + 174, w: 76, h: 80 };
    return null;
  }

  private cardAt(x: number, y: number): BuildId | null {
    for (const id of [...BUILD_ROW1, ...BUILD_ROW2]) {
      const r = this.cardRect(id)!;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    }
    return null;
  }

  private tapCard(id: BuildId): void {
    const w = this.w;
    this.popup = null;
    this.selTile = -1;
    if (!w.isUnlocked(id)) {
      this.banner(t('common.locked'), t('select.locked'), C.grey);
      audio.play('error');
      return;
    }
    this.selBuild = this.selBuild === id ? null : id;
    audio.play('card');
    haptics.impact('light');
  }

  private updateHover(x: number, y: number): void {
    const w = this.w;
    const gp = this.toGrid(x, y - (this.selBuild ? 40 : 0));
    const tile = w.board.tileAtGrid(gp.gx, gp.gy);
    this.hoverTile = this.selBuild ? tile : -1;
    this.hoverOk = this.selBuild ? w.canPlace(this.selBuild, tile) === null : false;
  }

  private buildRelease(x: number, y: number): void {
    const w = this.w;
    if (this.selBuild) {
      const gp = this.toGrid(x, y - 40);
      const tile = w.board.tileAtGrid(gp.gx, gp.gy);
      this.hoverTile = -1;
      if (tile < 0) return;
      const why = w.canPlace(this.selBuild, tile);
      if (why) {
        const p = w.sp(w.board.col(tile) + 0.5, w.board.row(tile) + 0.5);
        w.texts.add(t(why), p.x, p.y - 30, 'info', C.crimsonHi, 22);
        audio.play('error');
        haptics.impact('light');
        // tapping an existing structure with a card selected selects it instead
        if (w.trapAt[tile] || w.denAt[tile] || w.walls.has(tile)) {
          this.selBuild = null;
          this.selectPlaced(tile);
        }
        return;
      }
      const cost = w.costOf(this.selBuild);
      w.place(this.selBuild, tile);
      const c = w.board.col(tile) + 0.5, r = w.board.row(tile) + 0.5;
      const p = w.sp(c, r);
      w.particles.smoke(p.x, p.y, 6, '#d9c8ff', 14);
      w.particles.ring(p.x, p.y, 8, 50, C.goldHi, 0.3, 5);
      if (cost > 0) w.texts.add('-' + cost, p.x, p.y - 30, 'gold', C.gold, 22);
      audio.play('place');
      haptics.impact('medium');
      this.game.camera.shake(0.08);
      if (this.hint?.key === 'trap') this.doneHint('trap');
      // keep the card selected for quick multi-placement if affordable
      if (w.gold < w.costOf(this.selBuild)) this.selBuild = null;
      return;
    }
    // no card: select a placed thing
    const gp = this.toGrid(x, y);
    const tile = w.board.tileAtGrid(gp.gx, gp.gy);
    this.selectPlaced(tile);
  }

  private selectPlaced(tile: number): void {
    const w = this.w;
    if (tile < 0 || !(w.trapAt[tile] || w.denAt[tile] || w.walls.has(tile))) {
      this.selTile = -1;
      this.popup = null;
      return;
    }
    this.selTile = tile;
    audio.play('click');
    const p = w.sp(w.board.col(tile) + 0.5, w.board.row(tile) + 0.5);
    const above = p.y > 420;
    const py = above ? p.y - 170 : p.y + 50;
    const px = clamp(p.x - 150, 10, 410);
    const tr = w.trapAt[tile];
    let upBtn: Button | null = null;
    if (tr && tr.level < 3) {
      const cost = w.upgradeCost(tr);
      upBtn = new Button(px + 10, py + 64, 140, 50, t('build.upgradeBtn'), () => {
        if (w.upgrade(tile)) {
          audio.play('upgrade');
          const q = w.sp(tr.cx, tr.cy);
          w.particles.sparks(q.x, q.y, 14, C.goldHi);
          w.texts.add(t('build.level', { n: tr.level }), q.x, q.y - 30, 'big', C.goldHi, 26);
          this.selectPlaced(tile);
        }
      });
      upBtn.sub = `${cost} or`;
      upBtn.size = 20;
      upBtn.enabled = w.gold >= cost;
      upBtn.style(C.uiGood, C.uiGoodDark);
    }
    const sellBtn = new Button(px + 158, py + 64, 132, 50, t('build.sellBtn'), () => {
      const v = w.sell(tile);
      const q = w.sp(w.board.col(tile) + 0.5, w.board.row(tile) + 0.5);
      w.texts.add('+' + v, q.x, q.y - 20, 'gold', C.gold, 24);
      w.particles.smoke(q.x, q.y, 6, '#b9a6d6', 14);
      audio.play('sell');
      this.popup = null;
      this.selTile = -1;
    });
    sellBtn.sub = `+${w.sellValue(tile)}`;
    sellBtn.size = 20;
    sellBtn.style(C.uiBtnAlt, C.uiBtnAltDark);
    sellBtn.textColor = C.ink;
    this.popup = { tile, upBtn, sellBtn };
  }

  // ================================================================ render
  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const w = this.w;
    const W = g.W, H = g.H;
    // ---- world layer (camera)
    ctx.save();
    g.camera.apply(ctx, W, H);
    const b = w.boss;
    const look = this.bossLook();
    const holding = this.g?.mode === 'hold' && this.g.hold;
    const charge = holding ? clamp(this.g!.hold!.t / 1.1, 0, 1) : 0;
    const gp = holding ? { gx: this.g!.hold!.x, gy: this.g!.hold!.y } : null;
    this.wr.render(ctx, w, {
      t: this.t, W, H, res: g.scale, build: w.phase === 'build', hoverTile: this.hoverTile, hoverId: this.selBuild, hoverOk: this.hoverOk,
      selectedTile: this.selTile, crown: store.data.cosmetics.crown, skin: skinVariant(store.data.cosmetics.skin), charge,
      holdX: gp && w.boss.attacks.hold !== 'blackhole' ? gp.gx : undefined, holdY: gp && w.boss.attacks.hold !== 'blackhole' ? gp.gy : undefined,
      bossX: this.bossX, bossY: this.bossY, bossScale: this.bossScale, drawBoss: true,
    }, {
      t: this.t, mood: b.mood, hurt: b.hurt, lookX: look.x, lookY: look.y, rage: b.rage / 100, charge,
      crown: store.data.cosmetics.crown, skin: skinVariant(store.data.cosmetics.skin),
    });
    // rage-full glow on the boss
    if (w.canUltimate()) {
      const a = 0.25 + Math.sin(this.t * 6) * 0.12;
      const gr = ctx.createRadialGradient(this.bossX, this.bossY - 300 * this.bossScale, 10, this.bossX, this.bossY - 300 * this.bossScale, 260 * this.bossScale);
      gr.addColorStop(0, `rgba(255,90,40,${a})`);
      gr.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(this.bossX - 300, this.bossY - 600 * this.bossScale, 600, 600 * this.bossScale);
    }
    ctx.restore();
    if (this.pendingSnap) this.captureSnapshot();

    // swipe trail
    if (this.trail.length > 1 && this.g?.mode === 'swipe') {
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], c = this.trail[i];
        const k = 1 - (this.t - c.t) / 0.25;
        ctx.strokeStyle = withAlpha('#ffd0d8', k * 0.9);
        ctx.lineWidth = 14 * k;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }
    // hurt vignette
    if (this.vignette > 0) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      gr.addColorStop(0, 'rgba(255,0,40,0)');
      gr.addColorStop(1, `rgba(255,0,40,${0.45 * this.vignette})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.ultFx > 0) this.drawUltimateFx(ctx);

    this.drawHUD(ctx);
    if (w.phase === 'wave' || w.phase === 'cleared') this.drawSlots(ctx);
    if (w.phase === 'build') this.drawBuild(ctx);
    if (w.phase === 'pact') this.drawPact(ctx);
    this.drawBanners(ctx);
    this.drawCoins(ctx);
    this.drawHint(ctx);
    if (w.phase === 'over' || w.phase === 'victory') this.drawEnd(ctx);
    if (this.paused) this.drawPause(ctx);
  }

  private bossLook(): { x: number; y: number } {
    const w = this.w;
    let tx = 3.5, ty = ROWS - 2;
    let best: Hero | null = null;
    for (const h of w.heroes) if (h.targetable && (!best || h.y > best.y)) best = h;
    if (w.boss.mood === 'cast') {
      tx = w.boss.lookX;
      ty = w.boss.lookY;
    } else if (best) {
      tx = best.x;
      ty = best.y;
    }
    return { x: clamp((tx - 3.5) / 3.5, -1, 1), y: clamp((ty - ROWS) / 8, -1, 1) };
  }

  private captureSnapshot(): void {
    const snap = this.pendingSnap!;
    this.pendingSnap = null;
    const best = this.w.stats.best;
    if (!best) return;
    const g = this.game;
    const size = 240;
    const c = best.snapshot ?? document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d')!;
    const src = 200 * g.scale;
    const sx = clamp(snap.x * g.scale - src / 2, 0, g.canvas.width - src);
    const sy = clamp((snap.y - 30) * g.scale - src / 2, 0, g.canvas.height - src);
    try {
      cx.drawImage(g.canvas, sx, sy, src, src, 0, 0, size, size);
      best.snapshot = c;
    } catch {
      /* tainted / unavailable */
    }
  }

  // ------------------------------------------------------------------- HUD
  private drawHUD(ctx: CanvasRenderingContext2D): void {
    const w = this.w;
    const top = this.hudTop;
    // wave pill
    const sup = superFor(w.wave);
    roundRectPath(ctx, 12, top + 8, 196, 50, 25);
    fillStroke(ctx, sup ? '#5a1f2a' : '#2b1840', 4);
    const label = this.opts.endless && w.wave > 20 ? t('hud.endless', { n: w.wave }) : t('hud.waveOf', { n: w.wave, max: w.finalWave });
    text(ctx, label, 110, top + 34, { size: 26, color: sup ? C.goldHi : C.white, maxWidth: 176 });
    const left = w.director.remainingToSpawn + w.heroes.filter((h) => !h.done).length;
    if (w.phase === 'wave') text(ctx, t('hud.heroesLeft', { n: left }), 110, top + 74, { size: 16, color: '#d8c8ef', lw: 3 });
    // boss hp
    const shake = this.hpShake > 0 ? Math.sin(this.t * 80) * 6 * this.hpShake : 0;
    const hx = 222 + shake, hy = top + 12;
    icon(ctx, 'heart', hx + 16, hy + 20, 34);
    bar(ctx, hx + 36, hy + 6, 220, 30, w.boss.hp / w.boss.maxHp, w.boss.hp / w.boss.maxHp > 0.3 ? C.crimsonHi : '#ff2a2a');
    text(ctx, `${Math.max(0, Math.ceil(w.boss.hp))}/${w.boss.maxHp}`, hx + 146, hy + 22, { size: 18, lw: 3.5 });
    // rage
    const rage = w.boss.rage / 100;
    icon(ctx, 'rage', hx + 16, hy + 58, 28, this.t);
    bar(ctx, hx + 36, hy + 48, 220, 20, rage, rage >= 1 ? (Math.floor(this.t * 8) % 2 ? C.lavaHi : C.lava) : C.lava);
    if (rage >= 1) text(ctx, t('hud.ultimate'), hx + 146, hy + 58, { size: 14, color: C.white, lw: 3 });
    // gold
    const gb = 1 + this.goldBump * 0.25;
    ctx.save();
    ctx.translate(560, top + 34);
    ctx.scale(gb, gb);
    icon(ctx, 'gold', -40, 0, 32);
    text(ctx, fmt(this.goldShown), 4, 1, { size: 28, color: C.goldHi, align: 'left' });
    ctx.restore();
    // pause
    roundRectPath(ctx, 664, top + 10, 46, 46, 12);
    fillStroke(ctx, '#2b1840', 3.5);
    icon(ctx, 'pause', 687, top + 33, 26);
    // super hero bar
    const sh = w.heroes.find((h) => h.isSuper && !h.done);
    if (sh && w.phase === 'wave') {
      const y = top + 92;
      text(ctx, sh.name, 360, y, { size: 20, color: C.goldHi, lw: 4 });
      bar(ctx, 120, y + 14, 480, 18, sh.hp / sh.maxHp, sh.plotArmor ? C.gold : '#ff6a3d');
      if (sh.plotArmor) text(ctx, t('hud.immune'), 360, y + 23, { size: 13, lw: 3 });
    }
    // streak
    if (this.streakFx) {
      const s = this.streakFx;
      const k = s.t < 0.35 ? easeOutElastic(s.t / 0.35) : 1;
      const a = s.t > 0.9 ? 1 - (s.t - 0.9) / 0.3 : 1;
      const col = s.n >= 12 ? '#ff3bd4' : s.n >= 8 ? C.crimsonHi : s.n >= 4 ? C.lava : C.goldHi;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(360, top + 170);
      ctx.rotate(Math.sin(this.t * 20) * 0.03 * Math.min(1, s.n / 6));
      ctx.scale(k, k);
      text(ctx, s.label, 0, 0, { size: 46 + Math.min(20, s.n * 2), color: col, stroke: '#1a0008', lw: 10 });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  private drawSlots(ctx: CanvasRenderingContext2D): void {
    const w = this.w;
    for (const s of SLOT_ORDER) {
      const id = w.boss.attacks[s];
      const def = ATTACKS[id];
      const p = this.slotPos(s);
      const sh = this.slotShake[s] > 0 ? Math.sin(this.t * 60) * 6 * this.slotShake[s] : 0;
      const cd = w.boss.cd[s];
      const max = def.cd * w.mods.attackCd;
      const ready = cd <= 0;
      const x = p.x + sh;
      circle(ctx, x, p.y, 40);
      fillStroke(ctx, ready ? def.color : '#3a2a4a', 4.5);
      if (!ready) {
        ctx.beginPath();
        ctx.moveTo(x, p.y);
        ctx.arc(x, p.y, 36, -Math.PI / 2, -Math.PI / 2 + (1 - cd / max) * TAU);
        ctx.closePath();
        ctx.fillStyle = withAlpha(def.color, 0.55);
        ctx.fill();
      }
      icon(ctx, s, x, p.y - 4, 34, this.t);
      text(ctx, t(s === 'tap' ? 'hud.tapHold' : s === 'swipe' ? 'hud.swipe' : 'hud.hold'), x, p.y + 30, { size: 14, lw: 3 });
      if (!ready && max > 2) text(ctx, cd.toFixed(cd < 10 ? 1 : 0), x, p.y - 2, { size: 18, lw: 3.5 });
    }
    // ultimate
    const p = this.slotPos('ult');
    const full = w.canUltimate();
    const r = 40 + (full ? Math.sin(this.t * 8) * 4 : 0);
    circle(ctx, p.x, p.y, r);
    fillStroke(ctx, full ? C.lava : '#3a2a4a', 4.5);
    if (!full) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, 36, -Math.PI / 2, -Math.PI / 2 + (w.boss.rage / 100) * TAU);
      ctx.closePath();
      ctx.fillStyle = withAlpha(C.lava, 0.5);
      ctx.fill();
    }
    icon(ctx, 'rage', p.x, p.y - 2, 38, this.t);
    text(ctx, t('hud.ultimate'), p.x, p.y + 30, { size: 14, lw: 3 });
    if (full) text(ctx, t('hud.rageReady'), 360, this.game.H - this.game.safeBottom - 24, { size: 22, color: C.lavaHi, lw: 5 });
  }

  // ----------------------------------------------------------------- build
  private drawBuild(ctx: CanvasRenderingContext2D): void {
    const H = this.game.H, sb = this.game.safeBottom;
    const top = H - sb - 262;
    panel(ctx, -10, top, 740, 300 + sb, '#22123a', 11);
    text(ctx, t('hud.build'), 24, top + 32, { size: 28, color: C.goldHi, align: 'left' });
    text(ctx, t('build.tabTraps') + ' / ' + t('build.tabMonsters'), 24, top + 62, { size: 15, color: '#bfaedc', align: 'left', lw: 3 });
    this.ui.draw(ctx, this.t);
    for (const id of [...BUILD_ROW1, ...BUILD_ROW2]) this.drawCard(ctx, id);
    if (this.popup) this.drawPopup(ctx);
  }

  private drawCard(ctx: CanvasRenderingContext2D, id: BuildId): void {
    const w = this.w;
    const r = this.cardRect(id)!;
    const unlocked = w.isUnlocked(id);
    const sel = this.selBuild === id;
    const cost = w.costOf(id);
    const afford = w.gold >= cost;
    const lift = sel ? -8 : 0;
    wobblyRectPath(ctx, r.x, r.y + lift, r.w, r.h, 12, r.x, 1.2);
    fillStroke(ctx, !unlocked ? '#2a2236' : sel ? '#5b2f86' : '#3a2456', sel ? 5 : 3.5, sel ? C.goldHi : C.ink);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y + lift, r.w, r.h);
    ctx.clip();
    ctx.translate(r.x + r.w / 2, r.y + lift + 34);
    if (!unlocked) ctx.globalAlpha = 0.35;
    if (id === 'wall') icon(ctx, 'wall', 0, 0, 40);
    else if (id in TRAPS) {
      ctx.scale(0.62, 0.62);
      drawTrapIcon(ctx, id as TrapId, this.t);
    } else {
      ctx.translate(0, 26);
      ctx.scale(id === 'ogre' ? 0.42 : 0.7, id === 'ogre' ? 0.42 : 0.7);
      drawMonster(ctx, id as MonsterId, 1, Math.floor(this.t * 6) % 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (!unlocked) {
      icon(ctx, 'lock', r.x + r.w / 2, r.y + r.h / 2 - 6, 28);
      return;
    }
    icon(ctx, 'gold', r.x + 16, r.y + r.h - 14 + lift, 16);
    text(ctx, String(cost), r.x + 28, r.y + r.h - 13 + lift, { size: 17, align: 'left', color: afford ? C.goldHi : '#ff6b7f', lw: 3 });
    if (sel) {
      const name = id === 'wall' ? t('build.wall.name') : id in TRAPS ? t(`trap.${id}.name`) : t(`monster.${id}.name`);
      const desc = id === 'wall' ? t('build.wall.desc') : id in TRAPS ? t(`trap.${id}.desc`) : t(`monster.${id}.desc`);
      const H = this.game.H, sb = this.game.safeBottom;
      const ty = H - sb - 262 - 70;
      panel(ctx, 20, ty, 680, 62, '#2b1840', 4);
      text(ctx, name, 40, ty + 20, { size: 20, color: C.goldHi, align: 'left' });
      text(ctx, desc, 40, ty + 44, { size: 15, align: 'left', maxWidth: 640, lw: 3 });
    }
  }

  private drawPopup(ctx: CanvasRenderingContext2D): void {
    const w = this.w;
    const pp = this.popup!;
    const sb = pp.sellBtn;
    const x = (pp.upBtn?.x ?? sb.x - 148) - 10, y = sb.y - 64;
    panel(ctx, x, y, 300, 128, '#3a2456', 9);
    const tr = w.trapAt[pp.tile];
    const den = w.denAt[pp.tile];
    let name = t('build.wall.name'), info = '';
    if (tr) {
      name = t(`trap.${tr.kind}.name`) + ' • ' + t('build.level', { n: tr.level });
      info = t('build.kills', { n: tr.kills });
    } else if (den) {
      name = t(`monster.${den.kind}.name`) + ' • ' + t('build.level', { n: den.level });
      info = t('build.kills', { n: den.kills });
    }
    text(ctx, name, x + 150, y + 22, { size: 18, color: C.goldHi, maxWidth: 280 });
    if (info) text(ctx, info, x + 150, y + 46, { size: 15, lw: 3 });
    pp.upBtn?.draw(ctx, this.t);
    sb.draw(ctx, this.t);
  }

  // ------------------------------------------------------------------ pact
  private drawPact(ctx: CanvasRenderingContext2D): void {
    const w = this.w;
    const W = this.game.W, H = this.game.H;
    dim(ctx, W, H, Math.min(0.78, this.pactT * 2));
    const ty = H * 0.2;
    const tk = Math.min(1, this.pactT / 0.4);
    ctx.save();
    ctx.translate(W / 2, ty);
    ctx.scale(easeOutBack(tk), easeOutBack(tk));
    text(ctx, t('pact.title'), 0, 0, { size: 46, color: C.crimsonHi, stroke: '#1a0008', lw: 10 });
    text(ctx, t('pact.choose'), 0, 46, { size: 22, color: '#e8dcff' });
    ctx.restore();
    const n = w.pactOffer.length;
    const cw = 214, ch = 340, gap = 14;
    const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
    const cy = H * 0.5;
    for (let i = 0; i < n; i++) {
      const p = w.pactOffer[i];
      const appear = clamp((this.pactT - 0.15 - i * 0.12) / 0.35, 0, 1);
      if (appear <= 0) continue;
      let sx = easeOutBack(appear), sy = 1, a = 1, dy = 0;
      if (this.pactPick >= 0) {
        if (i === this.pactPick) {
          const k = Math.min(1, this.pactPickT / 0.25);
          sx = sy = 1 + 0.15 * k;
        } else {
          dy = this.pactPickT * 900;
          a = Math.max(0, 1 - this.pactPickT * 3);
        }
      }
      const x = x0 + i * (cw + gap) + cw / 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, cy + dy + Math.sin(this.t * 2 + i) * 4);
      ctx.scale(sx, sy);
      this.drawPactCard(ctx, p, cw, ch, i);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.rerollBtn.visible = w.rerolls > 0 && this.pactPick < 0;
    this.rerollBtn.y = cy + ch / 2 + 30;
    this.rerollBtn.label = `${t('pact.reroll')} (${w.rerolls})`;
    this.rerollBtn.draw(ctx, this.t);
  }

  private drawPactCard(ctx: CanvasRenderingContext2D, p: PactDef, cw: number, ch: number, i: number): void {
    const col = C.rarity[p.rarity];
    const cursed = p.rarity === 'cursed';
    if (cursed) {
      // wobbly green flames around cursed cards
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + this.t;
        const fx0 = Math.cos(a) * cw * 0.52, fy = Math.sin(a) * ch * 0.52;
        circle(ctx, fx0, fy, 18 + Math.sin(this.t * 6 + k) * 6);
        ctx.fillStyle = withAlpha(C.toxic, 0.25);
        ctx.fill();
      }
    }
    if (p.rarity === 'legendary') {
      ctx.save();
      ctx.rotate(this.t * 0.5);
      for (let k = 0; k < 10; k++) {
        ctx.rotate(TAU / 10);
        poly(ctx, [0, 0, -18, -ch * 0.75, 18, -ch * 0.75]);
        ctx.fillStyle = 'rgba(255,200,58,0.08)';
        ctx.fill();
      }
      ctx.restore();
    }
    wobblyRectPath(ctx, -cw / 2, -ch / 2, cw, ch, 20, i + 3, 2);
    fillStroke(ctx, cursed ? '#1f2a14' : '#2b1840', 6, col);
    wobblyRectPath(ctx, -cw / 2 + 10, -ch / 2 + 10, cw - 20, 120, 14, i + 5, 1.5);
    fillStroke(ctx, cursed ? '#2f4a1a' : '#3b2260', 3, withAlpha(col, 0.7));
    icon(ctx, p.icon, 0, -ch / 2 + 70, 72, this.t);
    textBlock(ctx, t(`pact.${p.id}.name`), 0, -ch / 2 + 168, cw - 24, { size: 24, color: col });
    textBlock(ctx, t(`pact.${p.id}.desc`), 0, 30, cw - 30, { size: 17, color: C.white, lw: 3 });
    roundRectPath(ctx, -70, ch / 2 - 50, 140, 32, 16);
    fillStroke(ctx, col, 3);
    text(ctx, t(`rarity.${p.rarity}`), 0, ch / 2 - 33, { size: 16, color: C.ink, lw: 0, shadow: false });
    if (cursed) icon(ctx, 'skull', cw / 2 - 26, -ch / 2 + 26, 26);
  }

  pactTap(x: number, y: number): void {
    const w = this.w;
    if (w.phase !== 'pact' || this.pactPick >= 0 || this.pactT < 0.5) return;
    const W = this.game.W, H = this.game.H;
    const n = w.pactOffer.length;
    const cw = 214, ch = 340, gap = 14;
    const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
    const cy = H * 0.5;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cw + gap);
      if (x >= cx && x <= cx + cw && y >= cy - ch / 2 && y <= cy + ch / 2) {
        this.pactPick = i;
        this.pactPickT = 0;
        const p = w.pactOffer[i];
        audio.play(p.rarity === 'cursed' ? 'cursed' : 'pact');
        haptics.impact('heavy');
        this.game.camera.shake(0.3);
        w.particles.sparks(cx + cw / 2, cy, 30, C.rarity[p.rarity], 600);
        if (this.hint?.key === 'pact') this.doneHint('pact');
        return;
      }
    }
  }

  // ---------------------------------------------------------- banners etc
  private drawBanners(ctx: CanvasRenderingContext2D): void {
    const b = this.banners[0];
    if (!b) return;
    const W = this.game.W, H = this.game.H;
    const k = b.t < 0.4 ? easeOutElastic(b.t / 0.4) : 1;
    const a = b.t > b.dur - 0.3 ? (b.dur - b.t) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.translate(W / 2, H * 0.34);
    ctx.scale(k, k);
    ctx.rotate(-0.03);
    text(ctx, b.text, 0, 0, { size: 46, color: b.color, stroke: '#14061f', lw: 10, maxWidth: 660 });
    if (b.sub) text(ctx, b.sub, 0, 46, { size: 22, color: '#f1e8ff', lw: 5, maxWidth: 640 });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawCoins(ctx: CanvasRenderingContext2D): void {
    const tx = 520, ty = this.hudTop + 34;
    for (const c of this.coins) {
      if (c.t < 0) continue;
      const k = clamp(c.t / c.dur, 0, 1);
      const e = k * k;
      const x = (1 - e) * (1 - e) * c.x0 + 2 * (1 - e) * e * c.cx + e * e * tx;
      const y = (1 - e) * (1 - e) * c.y0 + 2 * (1 - e) * e * c.cy + e * e * ty;
      icon(ctx, 'gold', x, y, 20 - k * 6);
    }
  }

  private drawHint(ctx: CanvasRenderingContext2D): void {
    const h = this.hint;
    const w = this.w;
    if (!h) return;
    if (h.key === 'fireball' && w.phase !== 'wave') return;
    if (h.key === 'pact' && w.phase !== 'pact') return;
    if (h.key === 'trap' && w.phase !== 'build') return;
    const W = this.game.W;
    let fxp = 0, fyp = 0;
    let ty = w.board.bottomY + 40;
    if (h.key === 'fireball') {
      const target = w.heroes.find((x) => x.targetable && x.y > 0.5);
      if (!target) return;
      const p = w.sp(target.x, target.y, 0.4);
      fxp = p.x;
      fyp = p.y;
    } else if (h.key === 'pact') {
      fxp = W / 2;
      fyp = this.game.H * 0.5 + 60;
      ty = this.game.H * 0.5 + 220;
    } else {
      if (!this.selBuild) {
        const r = this.cardRect('spikes')!;
        fxp = r.x + r.w / 2;
        fyp = r.y + 30;
      } else {
        const path = w.board.shortestPath();
        const tile = path.find((i) => w.canPlace(this.selBuild!, i) === null) ?? path[3];
        const p = w.sp(w.board.col(tile) + 0.5, w.board.row(tile) + 0.5);
        fxp = p.x;
        fyp = p.y;
      }
      ty = this.game.H - this.game.safeBottom - 340;
    }
    // speech-box
    panel(ctx, 40, ty - 34, W - 80, 64, '#ffe9b0', 2);
    text(ctx, h.text, W / 2, ty, { size: 22, color: C.ink, lw: 0, shadow: false, maxWidth: W - 110 });
    // tapping finger
    const tap = (this.t * 1.6) % 1;
    const press = tap < 0.25 ? tap / 0.25 : tap < 0.5 ? 1 - (tap - 0.25) / 0.25 : 0;
    if (tap < 0.4) {
      circle(ctx, fxp, fyp, 12 + tap * 50);
      ctx.strokeStyle = withAlpha('#ffffff', 1 - tap / 0.4);
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(fxp + 10, fyp + 18 - press * 10);
    ctx.rotate(-0.4);
    roundRectPath(ctx, -10, 0, 20, 46, 10);
    fillStroke(ctx, '#ffd7b0', 4);
    roundRectPath(ctx, -16, 30, 34, 40, 12);
    fillStroke(ctx, '#ffd7b0', 4);
    ctx.restore();
  }

  private drawUltimateFx(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H;
    const k = this.ultFx;
    ctx.fillStyle = `rgba(40,0,10,${0.45 * k})`;
    ctx.fillRect(0, 0, W, H);
    // cinematic bars
    const bh = 90 * Math.min(1, k * 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bh);
    ctx.fillRect(0, H - bh, W, bh);
    const age = 1 - k;
    const s = age < 0.25 ? easeOutElastic(age / 0.25) : 1;
    ctx.save();
    ctx.translate(W / 2, H * 0.4);
    ctx.scale(s, s);
    ctx.rotate(-0.05);
    text(ctx, this.ultName, 0, 0, { size: 60, color: C.lavaHi, stroke: '#2a0004', lw: 12, maxWidth: 680 });
    ctx.restore();
  }

  private drawEnd(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H;
    const k = clamp(this.endT / 0.6, 0, 1);
    const won = this.w.phase === 'victory';
    dim(ctx, W, H, 0.35 * k);
    ctx.save();
    ctx.translate(W / 2, H * 0.38);
    const s = easeOutBack(k);
    ctx.scale(s, s);
    text(ctx, won ? t('stats.victory') : t('stats.defeat'), 0, 0, { size: won ? 72 : 52, color: won ? C.goldHi : C.crimsonHi, stroke: '#12020a', lw: 12, maxWidth: 680 });
    ctx.restore();
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    const W = this.game.W, H = this.game.H;
    dim(ctx, W, H, 0.7);
    text(ctx, t('pause.title'), W / 2, H * 0.3 - 70, { size: 60, color: C.goldHi, lw: 10 });
    this.pauseUI.draw(ctx, this.t);
  }
}

// ---------------------------------------------------------- small sprites
function ensureHat(cls: string, color: string): string {
  const key = `hat|${cls}|${color}`;
  sprites.ensure(key, 40, 40, 20, 24, (ctx) => drawHat(ctx, cls as never, color));
  return key;
}

function ensureDuck(): void {
  sprites.ensure('duck', 34, 30, 17, 18, (ctx) => {
    circle(ctx, 0, 4, 11);
    fillStroke(ctx, '#ffe14a', 3);
    circle(ctx, 6, -6, 7);
    fillStroke(ctx, '#ffe14a', 3);
    poly(ctx, [11, -6, 17, -4, 11, -2]);
    fillStroke(ctx, '#ff8c42', 2);
    circle(ctx, 7, -8, 1.6);
    ctx.fillStyle = C.ink;
    ctx.fill();
  });
}

