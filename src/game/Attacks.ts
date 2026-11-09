import { clamp, dist, distToSegment } from '../core/math';
import { fx } from '../core/Rng';
import { ATTACKS } from '../data/attacks';
import type { AttackId, BossId } from '../data/types';
import { C } from '../render/palette';
import { t } from '../i18n';
import { COLS, ROWS, Tile } from './Board';
import type { Hero } from './Hero';
import { setTimeout0, type DmgSource, type World, type Zone } from './World';

/**
 * BOSS ATTACKS (player controlled) + ULTIMATES.
 * Coordinates are in grid units. Each cast returns false if it could not fire.
 */

const src = (id: AttackId): DmgSource => ({ kind: 'attack', id });

function cdFor(w: World, id: AttackId): number {
  return ATTACKS[id].cd * w.mods.attackCd;
}

function began(w: World, slot: 'tap' | 'swipe' | 'hold', id: AttackId, gx: number, gy: number): void {
  w.boss.cd[slot] = cdFor(w, id);
  w.stats.attacksThisWave++;
  w.setMood('cast', 0.35);
  w.boss.lookX = gx;
  w.boss.lookY = gy;
}

/** Le Joueur dodges anything aimed at him (with a cooldown you can bait). */
function dodge(w: World, test: (h: Hero) => boolean, awayX: number, awayY: number): void {
  for (const h of w.heroes) {
    if (h.superId !== 'player' || !h.targetable || h.dodgeCd > 0 || !test(h)) continue;
    h.dodgeCd = 2.6;
    let dx = h.x - awayX, dy = h.y - awayY;
    if (Math.abs(dx) + Math.abs(dy) < 0.05) dx = h.x < COLS / 2 ? 1 : -1;
    const d = Math.hypot(dx, dy) || 1;
    // stay inside the board
    if (h.x + (dx / d) * 1.2 < 0.3 || h.x + (dx / d) * 1.2 > COLS - 0.3) dx = -dx;
    h.vx += (dx / d) * 9;
    h.vy += (dy / d) * 4;
    h.say(w, w.pick('super.player.dodge'), 1.2);
    const p = w.sp(h.x, h.y, 1);
    w.texts.add(t('hud.dodge'), p.x, p.y, 'info', C.uiBlue, 24);
    w.particles.smoke(p.x, p.y + 20, 4, '#ffffff', 10);
  }
}

// ======================================================================= TAP
export function castTap(w: World, gx: number, gy: number): boolean {
  const id = w.boss.attacks.tap;
  if (w.boss.cd.tap > 0 || w.phase !== 'wave') return false;
  if (id === 'fireball') return fireball(w, gx, gy);
  if (id === 'meteor') return meteor(w, gx, gy);
  if (id === 'possess') return possess(w, gx, gy);
  return false;
}

function fireball(w: World, gx: number, gy: number): boolean {
  began(w, 'tap', 'fireball', gx, gy);
  const r = 1.0 * w.mods.fireballRadius * (w.opts.bossId === 'dragon' ? 1.15 : 1);
  dodge(w, (h) => dist(h.x, h.y, gx, gy) < r + 0.5, gx, gy);
  const m = w.bossMouth;
  w.projectiles.push({
    kind: 'fireball', x0: m.x, y0: m.y, z0: m.z, x1: gx, y1: gy, x: m.x, y: m.y, z: m.z, t: 0, dur: 0.16, arc: 0.6, target: null,
    onHit: (ww) => fireballImpact(ww, gx, gy, r, ATTACKS.fireball.dmg, 'fireball'),
  });
  w.ev.sfx('whoosh');
  w.ev.haptic('light');
  return true;
}

function fireballImpact(w: World, gx: number, gy: number, r: number, dmg: number, id: AttackId): void {
  const p = w.sp(gx, gy, 0.2);
  const R = r * w.board.pxPerTile(gy);
  w.particles.flash(p.x, p.y, R * 1.1, '#fff6c8', 0.1);
  w.particles.ring(p.x, p.y, R * 0.3, R * 1.25, C.fireHi, 0.28, 10);
  w.particles.fire(p.x, p.y, 22, R * 0.6, 20);
  w.particles.sparks(p.x, p.y, 14, C.fireHi, 420);
  w.particles.smoke(p.x, p.y - 10, 5, '#4a3256', 24);
  w.ev.sfx('explosion');
  // gas + fire = BOOM
  for (const z of w.zones) {
    if (z.kind === 'gas' && !z.boomed && dist(z.x, z.y, gx, gy) < z.r + r) {
      z.boomed = true;
      z.t = z.dur;
      setTimeout0(w, 0.05, () => w.explode(z.x, z.y, z.r + 0.4, 40 + w.wave * 3, 'gasBoom'));
    }
  }
  let hits = 0;
  for (const h of w.heroesIn(gx, gy, r)) {
    const combo = h.slimedT > 0 ? 'burningSlime' : undefined;
    if (w.damageHero(h, dmg, 'fire', src(id), { combo, comboMul: 1.8 }) > 0) hits++;
    if (h.alive) {
      h.burnT = Math.max(h.burnT, combo ? 4 : 2);
      h.burnDps = Math.max(h.burnDps, dmg * 0.15 * w.bossScale);
      h.burnSrc = src(id);
      h.knock(h.x - gx + 0.001, h.y - gy, 0.25);
    }
  }
  w.ev.shake(0.22 + Math.min(0.4, hits * 0.08));
  if (hits) w.ev.hitStop(hits >= 3 ? 70 : 40);
  w.ev.haptic(hits >= 2 ? 'medium' : 'light');
  if (w.opts.bossId === 'dragon') w.spawnZone({ kind: 'burn', x: gx, y: gy, r: r * 0.8, dur: 2.2, dps: 10 * w.bossScale, type: 'fire', src: src(id) });
}

function meteor(w: World, gx: number, gy: number): boolean {
  began(w, 'tap', 'meteor', gx, gy);
  w.ev.sfx('rumble');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + w.rng.range(-0.4, 0.4);
    const d = i === 0 ? 0 : w.rng.range(0.5, 1.6);
    const x = clamp(gx + Math.cos(a) * d, 0.2, COLS - 0.2);
    const y = clamp(gy + Math.sin(a) * d, 0.2, ROWS - 0.2);
    setTimeout0(w, i * 0.11, () => {
      w.projectiles.push({
        kind: 'meteor', x0: x + 1.2, y0: y - 1.5, z0: 7, x1: x, y1: y, x, y, z: 7, t: 0, dur: 0.32, arc: 0, target: null,
        onHit: (ww) => {
          fireballImpact(ww, x, y, 0.75, ATTACKS.meteor.dmg, 'meteor');
          const p = ww.sp(x, y);
          ww.particles.debris(p.x, p.y, 6, '#5a3a2a', p.y + 6);
        },
      });
    });
  }
  return true;
}

function possess(w: World, gx: number, gy: number): boolean {
  const h = w.nearestHero(gx, gy, 1.1, (x) => x.targetable && !x.ally && !x.isSuper && x.state !== 'air');
  if (!h) {
    const p = w.sp(gx, gy);
    w.texts.add('?', p.x, p.y, 'info', C.dark, 30);
    return false;
  }
  began(w, 'tap', 'possess', gx, gy);
  h.possess(w, 9);
  const p = w.sp(h.x, h.y, 0.8);
  w.particles.ring(p.x, p.y, 40, 6, C.dark, 0.4, 6);
  w.particles.sparks(p.x, p.y, 16, C.dark);
  w.texts.add(t('hud.possessed'), p.x, p.y - 30, 'big', C.dark, 28);
  w.ev.sfx('possess');
  w.ev.haptic('medium');
  return true;
}

// ===================================================================== SWIPE
export function castSwipe(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  const id = w.boss.attacks.swipe;
  if (w.boss.cd.swipe > 0 || w.phase !== 'wave') return false;
  if (id === 'claw') return claw(w, ax, ay, bx, by);
  if (id === 'summon') return summon(w, ax, ay, bx, by);
  return false;
}

function claw(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  began(w, 'swipe', 'claw', (ax + bx) / 2, (ay + by) / 2);
  // extend short swipes a bit
  let dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const want = Math.max(len, 2.2);
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  dx /= len;
  dy /= len;
  ax = mx - (dx * want) / 2;
  ay = my - (dy * want) / 2;
  bx = mx + (dx * want) / 2;
  by = my + (dy * want) / 2;
  const width = 0.45 * w.mods.clawWidth;
  dodge(w, (h) => distToSegment(h.x, h.y, ax, ay, bx, by) < width + 0.5, mx, my);
  w.slashes.push({ ax, ay, bx, by, t: 0 });
  w.ev.sfx('claw');
  let hits = 0;
  for (const h of w.heroes) {
    if (!h.targetable || h.ally) continue;
    if (distToSegment(h.x, h.y, ax, ay, bx, by) > width + 0.15 * h.scale) continue;
    if (w.damageHero(h, ATTACKS.claw.dmg, 'phys', src('claw')) > 0) hits++;
    if (h.alive) h.knock(dx + (h.x - mx) * 0.2, dy + (h.y - my) * 0.2, 0.55);
    const p = w.sp(h.x, h.y, 0.5);
    w.particles.sparks(p.x, p.y, 6, '#ffffff', 300);
  }
  w.ev.shake(0.3 + Math.min(0.4, hits * 0.1));
  if (hits) w.ev.hitStop(hits >= 2 ? 80 : 55);
  w.ev.haptic(hits ? 'heavy' : 'medium');
  return true;
}

function summon(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  began(w, 'swipe', 'summon', (ax + bx) / 2, (ay + by) / 2);
  const pts = [0, 0.5, 1].map((k) => ({ x: ax + (bx - ax) * k, y: ay + (by - ay) * k }));
  for (const p of pts) {
    let x = clamp(p.x, 0.3, COLS - 0.3), y = clamp(p.y, 0.3, ROWS - 0.3);
    if (!w.board.walkable(Math.floor(x), Math.floor(y))) {
      x = Math.floor(x) + 0.5;
      y = Math.floor(y) + 0.5;
      if (!w.board.walkable(Math.floor(x), Math.floor(y))) continue;
    }
    w.spawnMinion('goblin', x, y, 45 * (1 + w.wave * 0.15), 9 * w.bossScale);
    const s = w.sp(x, y);
    w.particles.ring(s.x, s.y, 4, 40, C.toxic, 0.35, 5);
  }
  w.ev.sfx('summon');
  w.ev.haptic('medium');
  return true;
}

// ====================================================================== HOLD
export interface HoldState {
  id: AttackId;
  t: number;
  x: number;
  y: number;
  zone: Zone | null;
}

export function holdBegin(w: World, gx: number, gy: number): HoldState | null {
  const id = w.boss.attacks.hold;
  if (w.boss.cd.hold > 0 || w.phase !== 'wave') return null;
  const hs: HoldState = { id, t: 0, x: gx, y: gy, zone: null };
  if (id === 'blackhole') {
    hs.zone = w.spawnZone({ kind: 'blackhole', x: gx, y: gy, r: 1.7, dur: 3.2, dps: ATTACKS.blackhole.dmg * w.bossScale, type: 'dark', src: src('blackhole') });
    w.ev.sfx('blackhole');
    w.setMood('cast', 3);
  } else {
    w.ev.sfx('charge');
    w.setMood('roar', 3);
  }
  return hs;
}

export function holdUpdate(w: World, hs: HoldState, gx: number, gy: number, dt: number): boolean {
  hs.t += dt;
  if (hs.zone) {
    hs.zone.x += (gx - hs.zone.x) * Math.min(1, dt * 6);
    hs.zone.y += (gy - hs.zone.y) * Math.min(1, dt * 6);
    hs.x = hs.zone.x;
    hs.y = hs.zone.y;
    if (hs.zone.t >= hs.zone.dur - 0.05) {
      holdRelease(w, hs);
      return false;
    }
  }
  // Roar / freeze auto-release at full charge.
  if (!hs.zone && hs.t >= 1.1) {
    holdRelease(w, hs);
    return false;
  }
  return true;
}

export function holdRelease(w: World, hs: HoldState): void {
  if (w.boss.cd.hold > 0) return;
  const charge = clamp(hs.t / 1.1, 0.25, 1);
  began(w, 'hold', hs.id, hs.x, hs.y);
  if (hs.id === 'roar') {
    w.setMood('roar', 0.9);
    const stun = 1.1 + charge * 1.8;
    const bp = w.sp(w.bossMouth.x, w.bossMouth.y, w.bossMouth.z);
    for (let i = 0; i < 3; i++) w.particles.ring(bp.x, bp.y, 30 + i * 40, 900, C.gold, 0.55 + i * 0.12, 14 - i * 3);
    for (const h of w.heroes) {
      if (!h.targetable || h.ally) continue;
      w.damageHero(h, ATTACKS.roar.dmg * charge, 'dark', src('roar'), { noText: true });
      if (!h.alive) continue;
      h.stunT = Math.max(h.stunT, h.isSuper ? stun * 0.4 : stun);
      h.setExpr('scared', stun);
      const p = w.sp(h.x, h.y, 1.2);
      w.particles.spawn('star', p.x, p.y, { life: stun, size: 8, color: C.gold, vy: 0 });
    }
    w.ev.sfx('roar');
    w.ev.shake(0.5 + charge * 0.3);
    w.ev.haptic('heavy');
  } else if (hs.id === 'blackhole') {
    const z = hs.zone!;
    z.t = z.dur;
    const p = w.sp(z.x, z.y);
    w.particles.flash(p.x, p.y, 90, '#d7b3ff', 0.15);
    w.particles.ring(p.x, p.y, 120, 6, C.dark, 0.3, 10);
    w.particles.sparks(p.x, p.y, 24, C.dark, 500);
    let hits = 0;
    for (const h of w.heroesIn(z.x, z.y, 1.3)) {
      if (w.damageHero(h, ATTACKS.blackhole.dmg * 2.6, 'dark', src('blackhole')) > 0) hits++;
      if (h.alive) h.knock(h.x - z.x + 0.01, h.y - z.y, 0.6);
    }
    w.ev.sfx('implode');
    w.ev.shake(0.45);
    if (hits) w.ev.hitStop(70);
    w.ev.haptic('heavy');
  } else if (hs.id === 'timefreeze') {
    const dur = 2 + charge * 2;
    for (const h of w.heroes) {
      if (!h.targetable || h.ally) continue;
      h.freezeT = Math.max(h.freezeT, h.isSuper ? dur * 0.5 : dur);
    }
    w.particles.flash(360 / 1, 0, 2000, '#bff4ff', 0.25);
    w.ev.sfx('freeze');
    w.ev.shake(0.2);
    w.ev.haptic('medium');
  }
}

export function holdCancel(w: World, hs: HoldState): void {
  if (hs.zone) hs.zone.t = hs.zone.dur;
  w.setMood('idle', 0);
}

// ================================================================== ULTIMATE
/** Full-screen ultimate, unique per boss. Called mid-cinematic. */
export function ultimateEffect(w: World, kind: BossId): void {
  const s = 1 + 0.1 * (w.wave - 1);
  const usrc: DmgSource = { kind: 'ult', id: 'ultimate' };
  const hitAll = (dmg: number, type: 'fire' | 'dark' | 'phys' | 'poison') => {
    for (const h of [...w.heroes]) {
      if (!h.targetable || h.ally) continue;
      const d = h.isSuper ? Math.max(dmg, h.maxHp * 0.12) : dmg;
      w.damageHero(h, d, type, usrc);
    }
  };
  w.ev.shake(1);
  w.ev.haptic('heavy');
  switch (kind) {
    case 'demon': {
      // APOCALYPSE: meteor storm over the whole dungeon
      for (let i = 0; i < 22; i++) {
        const x = fx.r(0.3, COLS - 0.3), y = fx.r(0.3, ROWS - 0.3);
        setTimeout0(w, i * 0.05, () => {
          w.projectiles.push({
            kind: 'meteor', x0: x + 1, y0: y - 2, z0: 8, x1: x, y1: y, x, y, z: 8, t: 0, dur: 0.3, arc: 0, target: null,
            onHit: (ww) => fireballImpact(ww, x, y, 0.9, 0, 'meteor'),
          });
        });
      }
      setTimeout0(w, 0.5, () => hitAll(70 * s, 'fire'));
      break;
    }
    case 'dragon': {
      // DRAGON BREATH: a wall of fire sweeping up the board
      for (let r = ROWS; r >= 0; r--) {
        setTimeout0(w, (ROWS - r) * 0.04, () => {
          for (let c = 0; c < COLS; c++) {
            const p = w.sp(c + 0.5, r + 0.5, 0.2);
            w.particles.fire(p.x, p.y, 3, 30, 22);
          }
        });
      }
      for (const h of w.heroes) {
        if (h.targetable && !h.ally) {
          h.burnT = 4;
          h.burnDps = 12 * s;
          h.burnSrc = usrc;
        }
      }
      setTimeout0(w, 0.3, () => hitAll(65 * s, 'fire'));
      break;
    }
    case 'lich': {
      // ARMY OF THE DEAD: everyone dies a little, the dead rise
      const before = w.mods.armyOfDead;
      w.mods.armyOfDead = true;
      hitAll(55 * s, 'dark');
      setTimeout0(w, 1.0, () => (w.mods.armyOfDead = before));
      for (let i = 0; i < 4; i++) w.spawnMinion('skeleton', w.board.entrance + 0.5 + fx.r(-1, 1), 1 + i * 0.6, 60 * s, 14 * s);
      break;
    }
    case 'slime': {
      // SLIME DELUGE: puddles everywhere, slowed and sticky
      for (let i = 0; i < 9; i++) {
        const x = fx.r(0.5, COLS - 0.5), y = fx.r(0.5, ROWS - 0.5);
        if (w.board.get(Math.floor(x), Math.floor(y)) !== Tile.Floor) continue;
        w.spawnZone({ kind: 'slimepool', x, y, r: 0.9, dur: 7, dps: 0, type: 'poison', src: usrc });
      }
      for (const h of w.heroes) {
        h.slowF = 0.25;
        h.slowT = 6;
        h.slimedT = 6;
      }
      hitAll(45 * s, 'poison');
      break;
    }
    case 'kraken': {
      // TSUNAMI: push everyone back to the entrance
      for (const h of w.heroes) {
        if (!h.targetable || h.ally) continue;
        h.knock(0, -1, h.isSuper ? 2 : 3.2);
        h.setExpr('scared', 2);
      }
      for (let c = 0; c < COLS; c++) {
        const p = w.sp(c + 0.5, ROWS - 0.5);
        for (let i = 0; i < 4; i++) w.particles.spawn('drop', p.x, p.y, { vx: fx.r(-40, 40), vy: fx.r(-900, -500), g: 900, life: 1.2, size: fx.r(6, 12), color: fx.pick([C.water, C.waterHi]) });
      }
      setTimeout0(w, 0.4, () => hitAll(50 * s, 'phys'));
      break;
    }
  }
}
