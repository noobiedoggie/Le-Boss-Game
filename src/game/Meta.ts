import { store, type DailyResult } from '../systems/Save';
import { ACHIEVEMENTS, ACH_SOULS } from '../data/achievements';
import { CLASS_ORDER, MOD_ORDER } from '../data/heroes';
import type { SuperId, BossId, AttackId, AttackSlot, BuildId } from '../data/types';
import type { Hero } from './Hero';
import type { World } from './World';
import { toasts } from '../ui/widgets';
import { t } from '../i18n';
import { audio } from '../systems/Audio';
import { todayKey } from '../core/Rng';

export const SUPER_ORDER: SuperId[] = ['chosen', 'speedguild', 'paladin3', 'player'];

/** Total collectible entries in the Hall of Shame. */
export const HALL_TOTAL = CLASS_ORDER.length + MOD_ORDER.length + SUPER_ORDER.length;
export const COMBO_TOTAL = CLASS_ORDER.length * MOD_ORDER.length;

/**
 * Meta progression: lifetime stats, Hall of Shame, achievements, souls.
 * The RunScene forwards World events here.
 */
export class Meta {
  runKills = 0;

  startRun(): void {
    this.runKills = 0;
    store.data.firstLaunch = false;
    store.stat('runs');
    store.save();
  }

  track(event: string, n = 1): void {
    if (event.startsWith('run:')) return;
    store.stat(event, n);
    this.check();
  }

  heroKilled(h: Hero, quote: string): void {
    this.runKills++;
    store.stat('totalKills');
    const keys: string[] = [];
    if (h.superId) keys.push('super:' + h.superId);
    if (h.superId !== 'speedguild' && h.superId !== 'chosen' && h.superId !== 'paladin3' && h.superId !== 'player') {
      keys.push('cls:' + h.cls);
      for (const m of h.mods) keys.push('mod:' + m);
    }
    for (const k of keys) {
      const e = (store.data.hall[k] ??= { count: 0, quote: '' });
      e.count++;
      if (!e.quote || Math.random() < 0.08) e.quote = quote;
      if (e.count === 1) toasts.push(t('hall.title'), t('common.new') + ' ' + this.hallName(k), 'book');
    }
    for (const m of h.mods) {
      const c = `${h.cls}+${m}`;
      if (!store.data.combos.includes(c)) store.data.combos.push(c);
      store.stat('kill:' + m);
    }
    if (h.spec.first === 'Kevin' && h.has('immortal')) store.stat('kevinImmortal');
    const complete = CLASS_ORDER.every((c) => store.data.hall['cls:' + c]) && MOD_ORDER.every((m) => store.data.hall['mod:' + m]) && SUPER_ORDER.every((s) => store.data.hall['super:' + s]);
    if (complete) store.data.stats.hallComplete = 1;
    this.check();
    store.save();
  }

  hallName(k: string): string {
    const [kind, id] = k.split(':');
    if (kind === 'cls') return t(`cls.${id}.m`);
    if (kind === 'mod') return t(`mod.${id}.m`);
    return t(`super.${id}.name`);
  }

  private check(): void {
    for (const a of ACHIEVEMENTS) {
      if (store.data.achievements.includes(a.id)) continue;
      const v = a.stat.startsWith('run:') ? (a.stat === 'run:kills' ? this.runKills : 0) : store.data.stats[a.stat] ?? 0;
      if (v >= a.need) {
        store.data.achievements.push(a.id);
        store.data.souls += ACH_SOULS;
        toasts.push(t('ach.unlocked'), t(`ach.${a.id}.name`) + `  +${ACH_SOULS}`, 'trophy');
        audio.play('victory');
      }
    }
  }

  /** Souls earned at the end of a run. */
  souls(w: World, won: boolean): number {
    let s = Math.floor(w.stats.kills / 3) + w.stats.wavesSurvived * 5 + (won ? 150 : 0) + Math.floor(w.stats.bestStreak / 2);
    s = Math.round(s * (1 + store.upg('soulGain') * 0.1));
    if (w.opts.daily) s = Math.round(s * 1.5);
    return Math.max(5, s);
  }

  endRun(w: World, won: boolean): { souls: number; record: boolean } {
    const souls = this.souls(w, won);
    const d = store.data;
    d.souls += souls;
    store.stat('totalSouls', souls);
    const reached = w.stats.wavesSurvived;
    const record = reached > (d.stats.bestWave ?? 0);
    if (record) d.stats.bestWave = reached;
    if (won) {
      store.stat('wins');
      if (!d.endless) d.endless = true;
    }
    if (w.opts.daily) {
      const r: DailyResult = { date: todayKey(), wave: reached, kills: w.stats.kills, boss: w.opts.bossId, won };
      d.daily.results.push(r);
      d.daily.results.sort((a, b) => b.wave - a.wave || b.kills - a.kills);
      d.daily.results = d.daily.results.slice(0, 30);
      store.stat('dailyDone');
    }
    this.check();
    store.save();
    return { souls, record };
  }
}

export const meta = new Meta();

/** Build the World options from the save (unlocks + upgrades). */
export function runSetup(daily: boolean): {
  bossId: BossId;
  attacks: Record<AttackSlot, AttackId>;
  startGold: number;
  bossHpBonus: number;
  rageStart: number;
  rerolls: number;
  unlocked: Set<BuildId>;
} {
  const d = store.data;
  const unlocked = new Set<BuildId>(d.unlocked.filter((x) => !x.includes(':')) as BuildId[]);
  return {
    bossId: daily ? 'demon' : d.selectedBoss,
    attacks: daily ? { tap: 'fireball', swipe: 'claw', hold: 'roar' } : { ...d.attacks },
    startGold: 100 + (daily ? 0 : store.upg('startGold') * 40),
    bossHpBonus: daily ? 0 : store.upg('bossHp') * 5,
    rageStart: daily ? 0 : store.upg('rage') * 20,
    rerolls: daily ? 1 : store.upg('pactReroll'),
    unlocked,
  };
}
