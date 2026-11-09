import type { Rng } from '../core/Rng';
import type { HeroClassId, SuperId } from '../data/types';
import { generateHero, type HeroSpec } from './HeroGen';
import { t } from '../i18n';

export interface SpawnEntry {
  spec: HeroSpec;
  delay: number;
}

export const FINAL_WAVE = 20;

/** Super-hero wave every 5 waves (cycles in endless mode). */
export function superFor(wave: number): SuperId | null {
  if (wave % 5 !== 0) return null;
  const order: SuperId[] = ['chosen', 'speedguild', 'paladin3', 'player'];
  return order[(wave / 5 - 1) % 4];
}

/** Learning memory: what the heroes noticed during the run. */
export interface Lessons {
  trapKills: number;
  monsterKills: number;
  wallCount: number;
  pathStretch: number;
  bossKills: number;
}

/**
 * Builds the list of heroes for a wave: count & HP scale with the wave
 * number, modifiers escalate, super-heroes every 5 waves, and the heroes
 * LEARN: they bring counters to whatever killed them the most.
 */
export function planWave(rng: Rng, wave: number, countMul: number, lessons: Lessons, returning: HeroSpec[]): { entries: SpawnEntry[]; learned: string[] } {
  const entries: SpawnEntry[] = [];
  const learned: string[] = [];
  const bias: Partial<Record<HeroClassId, number>> = {};

  if (wave >= 3) {
    const total = lessons.trapKills + lessons.monsterKills + lessons.bossKills + 1;
    if (lessons.trapKills / total > 0.45 && lessons.trapKills > 10) {
      bias.rogue = 1.6;
      learned.push('rogue');
    }
    if (lessons.wallCount >= 5 && lessons.pathStretch > 1.5) {
      bias.mage = 1.6;
      learned.push('mage');
    }
    if (lessons.monsterKills / total > 0.35 && lessons.monsterKills > 8) {
      bias.archer = 1.4;
      learned.push('archer');
    }
    if (wave >= 6 && rng.chance(0.3)) {
      bias.cleric = 1;
      learned.push('cleric');
    }
  }

  const sup = superFor(wave);
  let n = Math.round((4 + wave * 1.15) * countMul);
  if (wave === 1) n = 5;
  if (sup) n = Math.round(n * 0.6);
  const interval = Math.max(0.5, 1.75 - wave * 0.06);

  // Returning cowards come first, angrier.
  let delay = 0.6;
  for (const r of returning) {
    entries.push({ spec: { ...r, hpBonus: 1.5, returning: true }, delay });
    delay += 0.5;
  }

  for (let i = 0; i < n; i++) {
    const spec = generateHero(rng, {
      wave,
      classBias: bias,
      forceClass: wave === 1 ? (i % 2 === 0 ? 'knight' : 'rogue') : undefined,
      forceMods: wave === 1 ? [] : undefined,
    });
    entries.push({ spec, delay });
    // Squads: sometimes heroes arrive in tight groups.
    delay += rng.chance(0.3) ? 0.3 : interval * rng.range(0.8, 1.2);
  }

  if (sup === 'speedguild') {
    for (let i = 0; i < 10; i++) {
      const s = generateHero(rng, { wave, forceMods: ['speedrunner', 'tiny'] });
      s.superId = 'speedguild';
      s.name = t('super.speedguild.name') + ' #' + (i + 1);
      entries.push({ spec: s, delay: 3 + i * 0.35 });
    }
  } else if (sup) {
    const s = generateHero(rng, { wave, forceClass: sup === 'chosen' ? 'knight' : sup === 'paladin3' ? 'knight' : 'rogue', forceMods: [] });
    s.superId = sup;
    s.name = t(`super.${sup}.name`);
    if (sup === 'chosen') { s.tunic = '#fff3b0'; s.hair = '#ffd23f'; }
    if (sup === 'paladin3') { s.tunic = '#d9e4ff'; }
    if (sup === 'player') { s.tunic = '#1f1f2e'; s.hair = '#3ac1ff'; }
    entries.push({ spec: s, delay: Math.max(2.5, delay * 0.35) });
  }
  entries.sort((a, b) => a.delay - b.delay);
  return { entries, learned };
}

export class WaveDirector {
  entries: SpawnEntry[] = [];
  t = 0;
  next = 0;
  get done(): boolean {
    return this.next >= this.entries.length;
  }
  get remainingToSpawn(): number {
    return this.entries.length - this.next;
  }
  start(entries: SpawnEntry[]): void {
    this.entries = entries;
    this.t = 0;
    this.next = 0;
  }
  /** Returns specs to spawn this frame. */
  update(dt: number): HeroSpec[] {
    this.t += dt;
    const out: HeroSpec[] = [];
    while (this.next < this.entries.length && this.entries[this.next].delay <= this.t) {
      out.push(this.entries[this.next].spec);
      this.next++;
    }
    return out;
  }
}
