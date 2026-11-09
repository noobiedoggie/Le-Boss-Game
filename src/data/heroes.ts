import type { HeroClassDef, HeroClassId, ModDef, ModId } from './types';

export const HERO_CLASSES: Record<HeroClassId, HeroClassDef> = {
  knight: { id: 'knight', hp: 46, speed: 0.95, armor: 0.3, bossDmg: 2, dmg: 6, atkCd: 1.0, range: 0, bounty: 4, minWave: 1, weight: 10 },
  rogue: { id: 'rogue', hp: 22, speed: 1.55, armor: 0, bossDmg: 1, dmg: 5, atkCd: 0.6, range: 0, bounty: 3, minWave: 1, weight: 9 },
  mage: { id: 'mage', hp: 20, speed: 1.0, armor: 0, bossDmg: 2, dmg: 8, atkCd: 1.4, range: 2.6, bounty: 4, minWave: 2, weight: 7 },
  cleric: { id: 'cleric', hp: 30, speed: 1.0, armor: 0.1, bossDmg: 1, dmg: 4, atkCd: 1.0, range: 0, bounty: 4, minWave: 3, weight: 6 },
  archer: { id: 'archer', hp: 24, speed: 1.1, armor: 0, bossDmg: 1, dmg: 6, atkCd: 1.1, range: 3.0, bounty: 3, minWave: 2, weight: 7 },
  bard: { id: 'bard', hp: 26, speed: 1.0, armor: 0, bossDmg: 1, dmg: 3, atkCd: 1.0, range: 0, bounty: 4, minWave: 4, weight: 5 },
};

export const CLASS_ORDER: HeroClassId[] = ['knight', 'rogue', 'mage', 'cleric', 'archer', 'bard'];

export const MODS: Record<ModId, ModDef> = {
  threeheads: { id: 'threeheads', minWave: 4, weight: 5, hpMul: 0.8, speedMul: 1, scale: 1.05, bountyMul: 1.8, bossDmgMul: 1, dmgMul: 1 },
  speedrunner: { id: 'speedrunner', minWave: 2, weight: 7, hpMul: 0.7, speedMul: 2.0, scale: 0.95, bountyMul: 1.4, bossDmgMul: 1, dmgMul: 1 },
  giant: { id: 'giant', minWave: 3, weight: 6, hpMul: 2.6, speedMul: 0.7, scale: 1.6, bountyMul: 2, bossDmgMul: 2, dmgMul: 1.6 },
  tiny: { id: 'tiny', minWave: 2, weight: 6, hpMul: 0.6, speedMul: 1.25, scale: 0.62, bountyMul: 1.1, bossDmgMul: 0.5, dmgMul: 0.6 },
  coward: { id: 'coward', minWave: 2, weight: 6, hpMul: 1, speedMul: 1.05, scale: 1, bountyMul: 1.3, bossDmgMul: 1, dmgMul: 0.8 },
  streamer: { id: 'streamer', minWave: 5, weight: 4, hpMul: 1.2, speedMul: 1, scale: 1, bountyMul: 2, bossDmgMul: 1, dmgMul: 1 },
  influencer: { id: 'influencer', minWave: 4, weight: 4, hpMul: 1.1, speedMul: 0.95, scale: 1, bountyMul: 1.8, bossDmgMul: 1, dmgMul: 0.8 },
  immortal: { id: 'immortal', minWave: 6, weight: 4, hpMul: 1, speedMul: 1, scale: 1, bountyMul: 2, bossDmgMul: 1, dmgMul: 1 },
  lawyer: { id: 'lawyer', minWave: 4, weight: 4, hpMul: 1.1, speedMul: 0.9, scale: 1, bountyMul: 2, bossDmgMul: 1, dmgMul: 0.7 },
  pacifist: { id: 'pacifist', minWave: 3, weight: 4, hpMul: 1.1, speedMul: 1, scale: 1, bountyMul: 1.5, bossDmgMul: 1, dmgMul: 0 },
  chicken: { id: 'chicken', minWave: 7, weight: 1.6, hpMul: 3.0, speedMul: 1.3, scale: 0.9, bountyMul: 3, bossDmgMul: 3, dmgMul: 3 },
};

export const MOD_ORDER: ModId[] = [
  'threeheads', 'speedrunner', 'giant', 'tiny', 'coward', 'streamer', 'influencer', 'immortal', 'lawyer', 'pacifist', 'chicken',
];

/** Mods that cannot appear together. */
export const MOD_CONFLICTS: [ModId, ModId][] = [
  ['giant', 'tiny'],
  ['chicken', 'threeheads'],
  ['chicken', 'giant'],
  ['chicken', 'tiny'],
  ['pacifist', 'chicken'],
];
