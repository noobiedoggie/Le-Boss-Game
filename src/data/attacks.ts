import type { AttackDef, AttackId, AttackSlot } from './types';
import { C } from '../render/palette';

/**
 * Boss attacks. Each attack belongs to a gesture slot:
 *   TAP   -> tap a spot on the dungeon
 *   SWIPE -> swipe across the dungeon
 *   HOLD  -> press & hold (charge), release to unleash
 * The player equips one attack per slot before a run.
 */
export const ATTACKS: Record<AttackId, AttackDef> = {
  fireball: { id: 'fireball', slot: 'tap', cd: 1.0, dmg: 22, unlock: 0, color: C.fire },
  meteor: { id: 'meteor', slot: 'tap', cd: 6.5, dmg: 34, unlock: 140, color: C.lava },
  possess: { id: 'possess', slot: 'tap', cd: 14, dmg: 0, unlock: 220, color: C.dark },
  claw: { id: 'claw', slot: 'swipe', cd: 3.6, dmg: 40, unlock: 0, color: C.crimsonHi },
  summon: { id: 'summon', slot: 'swipe', cd: 12, dmg: 0, unlock: 120, color: C.toxic },
  roar: { id: 'roar', slot: 'hold', cd: 11, dmg: 6, unlock: 0, color: C.gold },
  blackhole: { id: 'blackhole', slot: 'hold', cd: 13, dmg: 16, unlock: 180, color: C.dark },
  timefreeze: { id: 'timefreeze', slot: 'hold', cd: 18, dmg: 0, unlock: 200, color: C.ice },
};

export const ATTACKS_BY_SLOT: Record<AttackSlot, AttackId[]> = {
  tap: ['fireball', 'meteor', 'possess'],
  swipe: ['claw', 'summon'],
  hold: ['roar', 'blackhole', 'timefreeze'],
};

export const SLOT_ORDER: AttackSlot[] = ['tap', 'swipe', 'hold'];
