import type { TrapDef, TrapId } from './types';
import { C } from '../render/palette';

/**
 * Trap table. `p` meaning per trap:
 *  spikes: unused | firejet: cone length (tiles) | slime: slow factor
 *  axe: knockback | trapdoor: instakill HP threshold | mimic: eat HP threshold
 *  bounce: landing dmg | gas: cloud radius
 */
export const TRAPS: Record<TrapId, TrapDef> = {
  spikes: {
    id: 'spikes', cost: 30, upgrade: [30, 55], dmgType: 'phys', unlock: 0, color: C.steel,
    levels: [
      { dmg: 6, cd: 0.5, p: 0 },
      { dmg: 11, cd: 0.45, p: 0 },
      { dmg: 19, cd: 0.4, p: 0 },
    ],
  },
  firejet: {
    id: 'firejet', cost: 55, upgrade: [50, 90], dmgType: 'fire', unlock: 0, color: C.fire,
    levels: [
      { dmg: 14, cd: 2.0, p: 2.1 },
      { dmg: 24, cd: 1.8, p: 2.5 },
      { dmg: 40, cd: 1.6, p: 2.9 },
    ],
  },
  slime: {
    id: 'slime', cost: 25, upgrade: [25, 45], dmgType: null, unlock: 0, color: C.slime,
    levels: [
      { dmg: 1, cd: 0.5, p: 0.5 },
      { dmg: 2, cd: 0.5, p: 0.38 },
      { dmg: 4, cd: 0.5, p: 0.26 },
    ],
  },
  bounce: {
    id: 'bounce', cost: 50, upgrade: [45, 80], dmgType: 'fall', unlock: 0, color: C.uiBlue,
    levels: [
      { dmg: 6, cd: 3.2, p: 0 },
      { dmg: 12, cd: 2.6, p: 0 },
      { dmg: 22, cd: 2.0, p: 0 },
    ],
  },
  axe: {
    id: 'axe', cost: 75, upgrade: [65, 110], dmgType: 'phys', unlock: 60, color: C.steelDark,
    levels: [
      { dmg: 42, cd: 2.6, p: 0.9 },
      { dmg: 70, cd: 2.4, p: 1.1 },
      { dmg: 115, cd: 2.1, p: 1.3 },
    ],
  },
  trapdoor: {
    id: 'trapdoor', cost: 70, upgrade: [60, 100], dmgType: 'fall', unlock: 80, color: C.wood,
    levels: [
      { dmg: 18, cd: 6, p: 45 },
      { dmg: 30, cd: 5, p: 110 },
      { dmg: 50, cd: 4, p: 240 },
    ],
  },
  mimic: {
    id: 'mimic', cost: 90, upgrade: [70, 120], dmgType: 'phys', unlock: 120, color: C.gold,
    levels: [
      { dmg: 35, cd: 5, p: 70 },
      { dmg: 60, cd: 4.2, p: 160 },
      { dmg: 100, cd: 3.4, p: 330 },
    ],
  },
  gas: {
    id: 'gas', cost: 60, upgrade: [50, 90], dmgType: 'poison', unlock: 100, color: C.poison,
    levels: [
      { dmg: 7, cd: 3.0, p: 1.25 },
      { dmg: 12, cd: 2.7, p: 1.45 },
      { dmg: 20, cd: 2.4, p: 1.7 },
    ],
  },
};

export const TRAP_ORDER: TrapId[] = ['spikes', 'slime', 'firejet', 'bounce', 'axe', 'trapdoor', 'mimic', 'gas'];

export const WALL_COST = 8;
