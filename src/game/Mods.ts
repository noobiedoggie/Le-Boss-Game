/**
 * All the numbers a run can bend. Dark Pacts, boss passives and meta upgrades
 * only ever touch this object; systems read from it.
 */
export interface RunMods {
  // damage multipliers
  trapDmg: number;
  spikeDmg: number;
  fireDmg: number;
  poisonDmg: number;
  monsterDmg: number;
  monsterHp: number;
  bossAtkDmg: number;
  comboMul: number;
  // boss attacks
  fireballRadius: number;
  attackCd: number;
  clawWidth: number;
  rageGain: number;
  // traps
  trapCd: number;
  echo: boolean;
  slowPower: number;
  bounceCd: number;
  freeLevel: boolean;
  // economy
  goldMul: number;
  killGold: number;
  interest: number;
  costMul: number;
  wallCostMul: number;
  monsterCostMul: number;
  // heroes
  heroHp: number;
  heroSpeed: number;
  heroCount: number;
  // special
  lavaFloor: number;
  armyOfDead: boolean;
  posthumous: boolean;
  vampire: number;
  secondWind: boolean;
  cursedCrown: boolean;
  bossDmgTaken: number;
  necroChance: number;
  pactChoices: number;
  goldRain: boolean;
  thorns: number;
  cursedCount: number;
}

export function defaultMods(): RunMods {
  return {
    trapDmg: 1, spikeDmg: 1, fireDmg: 1, poisonDmg: 1, monsterDmg: 1, monsterHp: 1, bossAtkDmg: 1, comboMul: 1,
    fireballRadius: 1, attackCd: 1, clawWidth: 1, rageGain: 1,
    trapCd: 1, echo: false, slowPower: 1, bounceCd: 1, freeLevel: false,
    goldMul: 1, killGold: 0, interest: 0, costMul: 1, wallCostMul: 1, monsterCostMul: 1,
    heroHp: 1, heroSpeed: 1, heroCount: 1,
    lavaFloor: 0, armyOfDead: false, posthumous: false, vampire: 0, secondWind: false, cursedCrown: false,
    bossDmgTaken: 1, necroChance: 0, pactChoices: 3, goldRain: false, thorns: 0, cursedCount: 0,
  };
}
