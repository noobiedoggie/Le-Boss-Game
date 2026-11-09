/** Shared type definitions for game data tables. Text lives in i18n files. */

export type DamageType = 'phys' | 'fire' | 'poison' | 'dark' | 'fall';
export const DAMAGE_TYPES: DamageType[] = ['phys', 'fire', 'poison', 'dark', 'fall'];

export type TrapId = 'spikes' | 'firejet' | 'slime' | 'axe' | 'trapdoor' | 'mimic' | 'bounce' | 'gas';
export type MonsterId = 'goblin' | 'archer' | 'ogre' | 'bats' | 'necro';
export type BuildId = 'wall' | TrapId | MonsterId;
export type HeroClassId = 'knight' | 'rogue' | 'mage' | 'cleric' | 'archer' | 'bard';
export type ModId =
  | 'threeheads'
  | 'speedrunner'
  | 'giant'
  | 'tiny'
  | 'coward'
  | 'streamer'
  | 'influencer'
  | 'immortal'
  | 'lawyer'
  | 'pacifist'
  | 'chicken';
export type SuperId = 'chosen' | 'speedguild' | 'paladin3' | 'player';
export type AttackSlot = 'tap' | 'swipe' | 'hold';
export type AttackId = 'fireball' | 'meteor' | 'possess' | 'claw' | 'summon' | 'roar' | 'blackhole' | 'timefreeze';
export type BossId = 'demon' | 'dragon' | 'lich' | 'slime' | 'kraken';
export type Rarity = 'common' | 'rare' | 'legendary' | 'cursed';

export interface TrapLevel {
  dmg: number;
  cd: number;
  /** Generic extra parameter (radius, slow %, kill threshold...). */
  p: number;
}

export interface TrapDef {
  id: TrapId;
  cost: number;
  /** Cost to reach level 2 and level 3. */
  upgrade: [number, number];
  dmgType: DamageType | null;
  levels: [TrapLevel, TrapLevel, TrapLevel];
  /** Souls needed to unlock in the hub (0 = available from the start). */
  unlock: number;
  color: string;
}

export interface MonsterDef {
  id: MonsterId;
  cost: number;
  hp: number;
  dmg: number;
  atkCd: number;
  /** Attack reach in tiles. */
  range: number;
  /** How far from its post it will chase heroes. */
  aggro: number;
  speed: number;
  /** Max number of heroes it can hold in melee at once. */
  blocks: number;
  ranged: boolean;
  flying: boolean;
  /** Count of bodies spawned per placement. */
  count: number;
  dmgType: DamageType;
  unlock: number;
  respawn: number;
}

export interface HeroClassDef {
  id: HeroClassId;
  hp: number;
  speed: number;
  /** Fraction of physical damage ignored. */
  armor: number;
  bossDmg: number;
  dmg: number;
  atkCd: number;
  range: number;
  bounty: number;
  minWave: number;
  weight: number;
}

export interface ModDef {
  id: ModId;
  minWave: number;
  weight: number;
  hpMul: number;
  speedMul: number;
  scale: number;
  bountyMul: number;
  bossDmgMul: number;
  dmgMul: number;
}

export interface AttackDef {
  id: AttackId;
  slot: AttackSlot;
  cd: number;
  dmg: number;
  unlock: number;
  color: string;
}

export interface BossDef {
  id: BossId;
  hp: number;
  unlock: number;
  main: string;
  dark: string;
  accent: string;
  eye: string;
}
