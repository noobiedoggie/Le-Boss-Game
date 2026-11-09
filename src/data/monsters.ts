import type { MonsterDef, MonsterId } from './types';

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  goblin: {
    id: 'goblin', cost: 35, hp: 34, dmg: 5, atkCd: 0.8, range: 0.55, aggro: 1.7, speed: 2.2,
    blocks: 1, ranged: false, flying: false, count: 2, dmgType: 'phys', unlock: 0, respawn: 7,
  },
  archer: {
    id: 'archer', cost: 45, hp: 26, dmg: 9, atkCd: 1.1, range: 3.2, aggro: 3.2, speed: 0,
    blocks: 0, ranged: true, flying: false, count: 1, dmgType: 'phys', unlock: 0, respawn: 8,
  },
  ogre: {
    id: 'ogre', cost: 80, hp: 200, dmg: 16, atkCd: 1.5, range: 0.7, aggro: 1.5, speed: 1.3,
    blocks: 3, ranged: false, flying: false, count: 1, dmgType: 'phys', unlock: 80, respawn: 12,
  },
  bats: {
    id: 'bats', cost: 50, hp: 40, dmg: 3.5, atkCd: 0.35, range: 0.45, aggro: 3.0, speed: 4.0,
    blocks: 0, ranged: false, flying: true, count: 1, dmgType: 'phys', unlock: 70, respawn: 6,
  },
  necro: {
    id: 'necro', cost: 100, hp: 45, dmg: 10, atkCd: 1.4, range: 2.7, aggro: 2.7, speed: 0,
    blocks: 0, ranged: true, flying: false, count: 1, dmgType: 'dark', unlock: 150, respawn: 10,
  },
};

export const MONSTER_ORDER: MonsterId[] = ['goblin', 'archer', 'ogre', 'bats', 'necro'];

/** Kills needed to reach level 2 and 3. Each level: +45% hp/dmg, visible evolution. */
export const MONSTER_XP = [0, 4, 11];
export const MONSTER_LEVEL_MUL = [1, 1.5, 2.25];
