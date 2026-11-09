import type { Rarity } from './types';
import type { RunMods } from '../game/Mods';

/**
 * DARK PACTS — roguelite upgrades picked after each wave (1 of 3).
 * `apply` mutates the run mods. `instant` runs once on pick with access to
 * the run (gold, boss hp...). Text: i18n keys pact.<id>.name / pact.<id>.desc
 */
export interface PactContext {
  mods: RunMods;
  addGold(n: number): void;
  healBoss(n: number): void;
  addMaxHp(n: number): void;
  upgradeAllTraps(): void;
}

export interface PactDef {
  id: string;
  rarity: Rarity;
  /** Can be picked several times. */
  stack: boolean;
  minWave?: number;
  icon: string;
  apply(c: PactContext): void;
}

export const PACTS: PactDef[] = [
  // ------------------------------------------------------------- COMMON
  { id: 'sharpSpikes', rarity: 'common', stack: true, icon: 'spikes', apply: (c) => (c.mods.spikeDmg += 0.4) },
  { id: 'hotAshes', rarity: 'common', stack: true, icon: 'fire', apply: (c) => (c.mods.fireDmg += 0.3) },
  { id: 'fatPurse', rarity: 'common', stack: true, icon: 'gold', apply: (c) => c.addGold(70) },
  { id: 'thickSkin', rarity: 'common', stack: true, icon: 'heart', apply: (c) => { c.addMaxHp(5); c.healBoss(8); } },
  { id: 'unionGoblins', rarity: 'common', stack: true, icon: 'goblin', apply: (c) => (c.mods.monsterCostMul *= 0.8) },
  { id: 'bricks', rarity: 'common', stack: false, icon: 'wall', apply: (c) => (c.mods.wallCostMul *= 0.4) },
  { id: 'longClaws', rarity: 'common', stack: true, icon: 'claw', apply: (c) => { c.mods.clawWidth += 0.4; c.mods.bossAtkDmg += 0.1; } },
  { id: 'shortFuse', rarity: 'common', stack: true, icon: 'clock', apply: (c) => (c.mods.attackCd *= 0.82) },
  { id: 'easyRage', rarity: 'common', stack: true, icon: 'rage', apply: (c) => (c.mods.rageGain += 0.35) },
  { id: 'interest', rarity: 'common', stack: true, icon: 'gold', apply: (c) => (c.mods.interest += 0.12) },
  { id: 'toxicLove', rarity: 'common', stack: true, icon: 'gas', apply: (c) => (c.mods.poisonDmg += 0.4) },
  { id: 'gymRats', rarity: 'common', stack: true, icon: 'goblin', apply: (c) => { c.mods.monsterHp += 0.3; c.mods.monsterDmg += 0.15; } },
  { id: 'stickier', rarity: 'common', stack: true, icon: 'slime', apply: (c) => (c.mods.slowPower += 0.35) },
  // --------------------------------------------------------------- RARE
  { id: 'echo', rarity: 'rare', stack: false, icon: 'echo', minWave: 2, apply: (c) => (c.mods.echo = true) },
  { id: 'lavaFloors', rarity: 'rare', stack: true, icon: 'lava', apply: (c) => (c.mods.lavaFloor += 3) },
  { id: 'holeyPockets', rarity: 'rare', stack: true, icon: 'gold', apply: (c) => (c.mods.killGold += 2) },
  { id: 'vampire', rarity: 'rare', stack: true, icon: 'heart', apply: (c) => (c.mods.vampire += 1) },
  { id: 'newSprings', rarity: 'rare', stack: false, icon: 'bounce', apply: (c) => (c.mods.bounceCd *= 0.35) },
  { id: 'comboFiend', rarity: 'rare', stack: true, icon: 'combo', apply: (c) => (c.mods.comboMul += 0.75) },
  { id: 'overclock', rarity: 'rare', stack: true, icon: 'clock', apply: (c) => (c.mods.trapCd *= 0.78) },
  { id: 'fertile', rarity: 'rare', stack: false, icon: 'up', apply: (c) => { c.mods.freeLevel = true; c.upgradeAllTraps(); } },
  { id: 'thorns', rarity: 'rare', stack: true, icon: 'spikes', apply: (c) => (c.mods.thorns += 25) },
  { id: 'megaball', rarity: 'rare', stack: true, icon: 'fire', apply: (c) => { c.mods.fireballRadius += 0.45; } },
  // ---------------------------------------------------------- LEGENDARY
  { id: 'armyOfDead', rarity: 'legendary', stack: false, icon: 'skull', minWave: 3, apply: (c) => (c.mods.armyOfDead = true) },
  { id: 'posthumous', rarity: 'legendary', stack: false, icon: 'boom', minWave: 3, apply: (c) => (c.mods.posthumous = true) },
  { id: 'secondWind', rarity: 'legendary', stack: false, icon: 'heart', apply: (c) => (c.mods.secondWind = true) },
  { id: 'apocalypse', rarity: 'legendary', stack: false, icon: 'rage', apply: (c) => { c.mods.rageGain += 1; c.mods.bossAtkDmg += 0.5; } },
  { id: 'goldRain', rarity: 'legendary', stack: false, icon: 'gold', apply: (c) => { c.mods.goldRain = true; c.mods.goldMul += 0.5; } },
  { id: 'masterTrapper', rarity: 'legendary', stack: false, icon: 'up', apply: (c) => { c.mods.trapDmg += 0.6; c.mods.trapCd *= 0.85; } },
  // ------------------------------------------------------------- CURSED
  { id: 'cursedCrown', rarity: 'cursed', stack: false, icon: 'crown', apply: (c) => { c.mods.cursedCrown = true; c.mods.bossAtkDmg *= 3; } },
  { id: 'greed', rarity: 'cursed', stack: false, icon: 'gold', apply: (c) => { c.mods.goldMul += 1; c.mods.heroHp *= 1.5; } },
  { id: 'bloodPact', rarity: 'cursed', stack: false, icon: 'skull', apply: (c) => { c.mods.trapDmg += 1; c.addMaxHp(-10); } },
  { id: 'glassCannon', rarity: 'cursed', stack: false, icon: 'boom', apply: (c) => { c.mods.bossAtkDmg *= 2.5; c.mods.bossDmgTaken *= 2; } },
  { id: 'horde', rarity: 'cursed', stack: false, icon: 'skull', apply: (c) => { c.mods.heroCount *= 1.5; c.mods.goldMul += 0.8; c.mods.rageGain += 0.5; } },
  { id: 'blackMarket', rarity: 'cursed', stack: false, icon: 'gold', apply: (c) => { c.mods.costMul *= 0.6; c.mods.heroSpeed *= 1.3; } },
  { id: 'hellfire', rarity: 'cursed', stack: false, icon: 'lava', apply: (c) => { c.mods.lavaFloor += 8; c.mods.fireDmg += 0.5; c.mods.monsterHp *= 0.6; } },
];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 27, legendary: 6, cursed: 10 };
