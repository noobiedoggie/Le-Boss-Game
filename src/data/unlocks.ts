import { TRAPS, TRAP_ORDER } from './traps';
import { MONSTERS, MONSTER_ORDER } from './monsters';
import { ATTACKS } from './attacks';
import { BOSSES, BOSS_ORDER } from './bosses';
import type { AttackId } from './types';

/**
 * The hub shop ("Armurerie"): everything purchasable with SOULS.
 */
export type ShopCat = 'traps' | 'monsters' | 'attacks' | 'bosses' | 'upgrades' | 'cosmetics';

export interface ShopItem {
  id: string;
  cat: ShopCat;
  cost: number;
  /** for leveled upgrades */
  maxLevel?: number;
  costs?: number[];
  nameKey: string;
  descKey: string;
  /** cosmetic slot */
  slot?: 'crown' | 'skin' | 'death';
}

const ATTACK_ORDER: AttackId[] = ['meteor', 'possess', 'summon', 'blackhole', 'timefreeze'];

export const UPGRADES: ShopItem[] = [
  { id: 'startGold', cat: 'upgrades', cost: 0, maxLevel: 5, costs: [40, 80, 140, 220, 320], nameKey: 'upg.startGold.name', descKey: 'upg.startGold.desc' },
  { id: 'bossHp', cat: 'upgrades', cost: 0, maxLevel: 5, costs: [50, 100, 170, 260, 380], nameKey: 'upg.bossHp.name', descKey: 'upg.bossHp.desc' },
  { id: 'rage', cat: 'upgrades', cost: 0, maxLevel: 3, costs: [60, 140, 260], nameKey: 'upg.rage.name', descKey: 'upg.rage.desc' },
  { id: 'pactReroll', cat: 'upgrades', cost: 0, maxLevel: 3, costs: [80, 180, 320], nameKey: 'upg.pactReroll.name', descKey: 'upg.pactReroll.desc' },
  { id: 'soulGain', cat: 'upgrades', cost: 0, maxLevel: 5, costs: [60, 120, 200, 300, 450], nameKey: 'upg.soulGain.name', descKey: 'upg.soulGain.desc' },
];

export const COSMETICS: ShopItem[] = [
  { id: 'party', cat: 'cosmetics', slot: 'crown', cost: 60, nameKey: 'crown.party.name', descKey: 'cosm.crown' },
  { id: 'flowers', cat: 'cosmetics', slot: 'crown', cost: 80, nameKey: 'crown.flowers.name', descKey: 'cosm.crown' },
  { id: 'viking', cat: 'cosmetics', slot: 'crown', cost: 110, nameKey: 'crown.viking.name', descKey: 'cosm.crown' },
  { id: 'halo', cat: 'cosmetics', slot: 'crown', cost: 150, nameKey: 'crown.halo.name', descKey: 'cosm.crown' },
  { id: 'neon', cat: 'cosmetics', slot: 'skin', cost: 120, nameKey: 'skin.neon.name', descKey: 'cosm.skin' },
  { id: 'shadow', cat: 'cosmetics', slot: 'skin', cost: 160, nameKey: 'skin.shadow.name', descKey: 'cosm.skin' },
  { id: 'goldskin', cat: 'cosmetics', slot: 'skin', cost: 260, nameKey: 'skin.gold.name', descKey: 'cosm.skin' },
  { id: 'fireworks', cat: 'cosmetics', slot: 'death', cost: 90, nameKey: 'death.fireworks.name', descKey: 'cosm.death' },
  { id: 'ducks', cat: 'cosmetics', slot: 'death', cost: 120, nameKey: 'death.ducks.name', descKey: 'cosm.death' },
  { id: 'bubbles', cat: 'cosmetics', slot: 'death', cost: 100, nameKey: 'death.bubbles.name', descKey: 'cosm.death' },
  { id: 'pixels', cat: 'cosmetics', slot: 'death', cost: 140, nameKey: 'death.pixels.name', descKey: 'cosm.death' },
];

export const DEFAULT_COSMETICS = [
  { id: 'gold', slot: 'crown', nameKey: 'crown.gold.name' },
  { id: 'none', slot: 'crown', nameKey: 'crown.none.name' },
  { id: 'classic', slot: 'skin', nameKey: 'skin.classic.name' },
  { id: 'confetti', slot: 'death', nameKey: 'death.confetti.name' },
];

export function shopItems(): ShopItem[] {
  const items: ShopItem[] = [];
  for (const id of TRAP_ORDER) if (TRAPS[id].unlock > 0) items.push({ id, cat: 'traps', cost: TRAPS[id].unlock, nameKey: `trap.${id}.name`, descKey: `trap.${id}.desc` });
  for (const id of MONSTER_ORDER) if (MONSTERS[id].unlock > 0) items.push({ id, cat: 'monsters', cost: MONSTERS[id].unlock, nameKey: `monster.${id}.name`, descKey: `monster.${id}.desc` });
  for (const id of ATTACK_ORDER) items.push({ id, cat: 'attacks', cost: ATTACKS[id].unlock, nameKey: `attack.${id}.name`, descKey: `attack.${id}.desc` });
  for (const id of BOSS_ORDER) if (BOSSES[id].unlock > 0) items.push({ id, cat: 'bosses', cost: BOSSES[id].unlock, nameKey: `boss.${id}.name`, descKey: `boss.${id}.desc` });
  items.push(...UPGRADES, ...COSMETICS);
  return items;
}

/** Skin ids map to boss palette variants. */
export function skinVariant(id: string): string {
  return id === 'goldskin' ? 'gold' : id;
}
