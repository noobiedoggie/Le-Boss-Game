/**
 * Seeded pseudo random generator (mulberry32).
 * Every random decision of a run goes through an Rng so the Daily Dungeon
 * produces the same layout / waves / pacts for every player on the same day.
 */
export class Rng {
  private s: number;
  constructor(seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.s = seed >>> 0;
  }
  /** Float in [0,1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  /** Integer in [a, b] inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** Derive an independent child stream (stable for a given label). */
  fork(label: string): Rng {
    let h = this.s ^ 0x9e3779b9;
    for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x5bd1e995) >>> 0;
    return new Rng(h >>> 0);
  }
}

/** Seed for "today" (YYYYMMDD, local time). */
export function dailySeed(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function todayKey(date = new Date()): string {
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Non-deterministic helper for pure cosmetics (particles, wobble...). */
export const fx = {
  r: (a = 0, b = 1): number => a + (b - a) * Math.random(),
  i: (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1)),
  pick: <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)],
  chance: (p: number): boolean => Math.random() < p,
};
