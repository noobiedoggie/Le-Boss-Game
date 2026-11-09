import { fr } from './fr';
import { en } from './en';

/**
 * Tiny i18n layer: t('key', {param}) and tl('key') for random pools.
 * French is the reference; other languages fall back to it per key.
 */
export type Lang = 'fr' | 'en';
const DICTS: Record<Lang, Record<string, string | string[]>> = { fr, en };
let current: Lang = 'fr';

export function setLang(l: Lang): void {
  current = DICTS[l] ? l : 'fr';
  document.documentElement.lang = current;
}
export function getLang(): Lang {
  return current;
}

function raw(key: string): string | string[] | undefined {
  return DICTS[current][key] ?? fr[key];
}

export function t(key: string, params?: Record<string, string | number>): string {
  let v = raw(key);
  if (v === undefined) return key;
  if (Array.isArray(v)) v = v[0];
  if (params) for (const k in params) v = v.split(`{${k}}`).join(String(params[k]));
  return v;
}

/** Returns the list behind a key (or a single-element list). */
export function tl(key: string): string[] {
  const v = raw(key);
  if (v === undefined) return [key];
  return Array.isArray(v) ? v : [v];
}

/** Random entry of a pool. Pass an rng function for determinism. */
export function tr(key: string, rnd: () => number = Math.random): string {
  const l = tl(key);
  return l[Math.floor(rnd() * l.length)];
}

export function has(key: string): boolean {
  return raw(key) !== undefined;
}
