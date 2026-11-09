import { Preferences } from '@capacitor/preferences';
import type { AttackId, AttackSlot, BossId, BuildId } from '../data/types';
import type { Lang } from '../i18n';

/**
 * Persistent meta save (Capacitor Preferences on device, localStorage on web).
 * The whole save is one JSON blob; writes are debounced.
 */
export interface DailyResult {
  date: string;
  wave: number;
  kills: number;
  boss: BossId;
  won: boolean;
}

export interface HallEntry {
  count: number;
  quote: string;
}

export interface SaveData {
  v: number;
  firstLaunch: boolean;
  souls: number;
  unlocked: string[];
  upgrades: Record<string, number>;
  cosmetics: { owned: string[]; crown: string; skin: string; death: string };
  selectedBoss: BossId;
  attacks: Record<AttackSlot, AttackId>;
  settings: { sfx: number; music: number; haptics: boolean; shake: boolean; lang: Lang };
  stats: Record<string, number>;
  hall: Record<string, HallEntry>;
  combos: string[];
  achievements: string[];
  daily: { last: string; results: DailyResult[] };
  hints: Record<string, boolean>;
  endless: boolean;
  seenNew: string[];
}

export const STARTER_UNLOCKS: (BuildId | AttackId | BossId)[] = [
  'wall', 'spikes', 'slime', 'firejet', 'bounce', 'goblin', 'archer', 'fireball', 'claw', 'roar', 'demon',
];

export function defaultSave(): SaveData {
  return {
    v: 1,
    firstLaunch: true,
    souls: 0,
    unlocked: [...STARTER_UNLOCKS],
    upgrades: {},
    cosmetics: { owned: ['gold', 'none', 'classic', 'confetti'], crown: 'gold', skin: 'classic', death: 'confetti' },
    selectedBoss: 'demon',
    attacks: { tap: 'fireball', swipe: 'claw', hold: 'roar' },
    settings: { sfx: 0.9, music: 0.6, haptics: true, shake: true, lang: 'fr' },
    stats: { runs: 0, wins: 0, bestWave: 0, totalKills: 0, totalSouls: 0 },
    hall: {},
    combos: [],
    achievements: [],
    daily: { last: '', results: [] },
    hints: {},
    endless: false,
    seenNew: [],
  };
}

const KEY = 'leboss.save.v1';

class SaveStore {
  data: SaveData = defaultSave();
  private timer: number | null = null;

  async load(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: KEY });
      if (value) this.data = this.migrate(JSON.parse(value));
    } catch {
      try {
        const v = localStorage.getItem(KEY);
        if (v) this.data = this.migrate(JSON.parse(v));
      } catch {
        /* fresh save */
      }
    }
  }

  private migrate(raw: Partial<SaveData>): SaveData {
    const d = defaultSave();
    const out = { ...d, ...raw } as SaveData;
    out.settings = { ...d.settings, ...(raw.settings ?? {}) };
    out.cosmetics = { ...d.cosmetics, ...(raw.cosmetics ?? {}) };
    out.stats = { ...d.stats, ...(raw.stats ?? {}) };
    out.daily = { ...d.daily, ...(raw.daily ?? {}) };
    out.attacks = { ...d.attacks, ...(raw.attacks ?? {}) };
    for (const u of STARTER_UNLOCKS) if (!out.unlocked.includes(u)) out.unlocked.push(u);
    return out;
  }

  /** Debounced persist. */
  save(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), 300);
  }

  async flush(): Promise<void> {
    this.timer = null;
    const json = JSON.stringify(this.data);
    try {
      await Preferences.set({ key: KEY, value: json });
    } catch {
      try {
        localStorage.setItem(KEY, json);
      } catch {
        /* storage full / unavailable */
      }
    }
  }

  async reset(): Promise<void> {
    const lang = this.data.settings.lang;
    this.data = defaultSave();
    this.data.settings.lang = lang;
    await this.flush();
  }

  has(id: string): boolean {
    return this.data.unlocked.includes(id);
  }

  stat(k: string, n = 1): number {
    this.data.stats[k] = (this.data.stats[k] ?? 0) + n;
    return this.data.stats[k];
  }

  upg(k: string): number {
    return this.data.upgrades[k] ?? 0;
  }
}

export const store = new SaveStore();
