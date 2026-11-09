import type { Rng } from '../core/Rng';
import type { HeroClassId, ModId, SuperId } from '../data/types';
import { CLASS_ORDER, HERO_CLASSES, MODS, MOD_CONFLICTS, MOD_ORDER } from '../data/heroes';
import { HERO_HAIR, HERO_SKINS, HERO_TUNICS } from '../render/palette';
import { t, tl } from '../i18n';

/** Everything needed to (re)create a hero: class, modifiers, name, look. */
export interface HeroSpec {
  cls: HeroClassId;
  mods: ModId[];
  gender: 'm' | 'f';
  first: string;
  name: string;
  skin: string;
  tunic: string;
  hair: string;
  /** Visual seed for small variations (beard, eyebrows...). */
  seed: number;
  superId?: SuperId;
  /** Extra HP multiplier (returning cowards...). */
  hpBonus?: number;
  returning?: boolean;
}

/** Mods that can act as the "title" noun in a name. */
const NOUN_MODS: ModId[] = ['speedrunner', 'giant', 'streamer', 'influencer', 'lawyer', 'chicken'];

export function heroName(spec: Pick<HeroSpec, 'cls' | 'mods' | 'gender' | 'first'>, rng: Rng): string {
  const g = spec.gender;
  let title = t(`cls.${spec.cls}.${g}`);
  let adjMods = [...spec.mods];
  // Sometimes a mod becomes the title: "Brenda, Speedrunneuse à 3 Têtes".
  const nounMod = adjMods.find((m) => NOUN_MODS.includes(m));
  if (nounMod && (nounMod === 'chicken' || rng.chance(0.45))) {
    title = t(`mod.${nounMod}.${g}`);
    adjMods = adjMods.filter((m) => m !== nounMod);
  }
  const adjs = adjMods.map((m) => ' ' + t(`mod.${m}.${g}`)).join('');
  const fmt = rng.chance(0.55) ? 'hero.fmt.a' : 'hero.fmt.b';
  return t(fmt, { first: spec.first, art: t(`hero.art.${g}`), title, adjs }).replace(/\s+/g, ' ').trim();
}

export interface GenOpts {
  wave: number;
  /** Extra weights per class from the "heroes learn" director. */
  classBias?: Partial<Record<HeroClassId, number>>;
  forceClass?: HeroClassId;
  forceMods?: ModId[];
  /** Probability multiplier for modifiers. */
  modChance?: number;
}

export function generateHero(rng: Rng, o: GenOpts): HeroSpec {
  const w = o.wave;
  const classes = CLASS_ORDER.filter((c) => HERO_CLASSES[c].minWave <= w);
  const cls =
    o.forceClass ??
    rng.weighted(classes, (c) => HERO_CLASSES[c].weight * (1 + (o.classBias?.[c] ?? 0)));

  // Number of modifiers escalates with waves (0-3).
  let mods: ModId[] = o.forceMods ? [...o.forceMods] : [];
  if (!o.forceMods) {
    const mc = o.modChance ?? 1;
    const p1 = Math.min(0.85, (0.12 + w * 0.06) * mc);
    const p2 = Math.min(0.55, Math.max(0, (w - 5) * 0.045) * mc);
    const p3 = Math.min(0.3, Math.max(0, (w - 11) * 0.03) * mc);
    let count = 0;
    if (w >= 2 && rng.chance(p1)) count++;
    if (count && rng.chance(p2)) count++;
    if (count > 1 && rng.chance(p3)) count++;
    const avail = MOD_ORDER.filter((m) => MODS[m].minWave <= w);
    for (let k = 0; k < count && avail.length; k++) {
      const m = rng.weighted(avail, (x) => (mods.includes(x) ? 0 : MODS[x].weight));
      if (mods.includes(m)) continue;
      if (MOD_CONFLICTS.some(([a, b]) => (a === m && mods.includes(b)) || (b === m && mods.includes(a)))) continue;
      mods.push(m);
    }
  }
  mods = MOD_ORDER.filter((m) => mods.includes(m)); // stable order for names
  const gender: 'm' | 'f' = rng.chance(0.5) ? 'm' : 'f';
  const first = rng.pick(tl(`hero.first.${gender}`));
  const spec: HeroSpec = {
    cls, mods, gender, first, name: '',
    skin: rng.pick(HERO_SKINS),
    tunic: rng.pick(HERO_TUNICS),
    hair: rng.pick(HERO_HAIR),
    seed: rng.int(0, 9999),
  };
  spec.name = heroName(spec, rng);
  return spec;
}
