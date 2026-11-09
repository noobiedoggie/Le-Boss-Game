/**
 * Achievements: id + the tracked counter and threshold that unlocks it.
 * Counters live in save.stats (lifetime) or the run (prefix "run:").
 * Names/descriptions: i18n ach.<id>.name / ach.<id>.desc
 */
export interface AchDef {
  id: string;
  stat: string;
  need: number;
  icon: string;
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'firstBlood', stat: 'totalKills', need: 1, icon: 'skull' },
  { id: 'chicken', stat: 'kill:chicken', need: 1, icon: 'chicken' },
  { id: 'kevin', stat: 'kevinImmortal', need: 1, icon: 'skull' },
  { id: 'boing', stat: 'bounce', need: 50, icon: 'bounce' },
  { id: 'juggler', stat: 'juggle', need: 10, icon: 'combo' },
  { id: 'objection', stat: 'kill:lawyer', need: 1, icon: 'lawyer' },
  { id: 'unsub', stat: 'kill:streamer', need: 1, icon: 'streamer' },
  { id: 'chosen', stat: 'super:chosen', need: 1, icon: 'crown' },
  { id: 'anyPercent', stat: 'super:speedguild', need: 1, icon: 'clock' },
  { id: 'threeHeads', stat: 'super:paladin3', need: 1, icon: 'crown' },
  { id: 'gg', stat: 'wins', need: 1, icon: 'crown' },
  { id: 'inhuman', stat: 'inhuman', need: 1, icon: 'rage' },
  { id: 'devil', stat: 'devil', need: 1, icon: 'skull' },
  { id: 'architect', stat: 'path40', need: 1, icon: 'wall' },
  { id: 'emptyChest', stat: 'mimicEat', need: 25, icon: 'mimic' },
  { id: 'handsFree', stat: 'handsFree', need: 1, icon: 'up' },
  { id: 'untouchable', stat: 'untouchable', need: 1, icon: 'heart' },
  { id: 'collector', stat: 'hallComplete', need: 1, icon: 'book' },
  { id: 'earlyBird', stat: 'dailyDone', need: 1, icon: 'clock' },
  { id: 'ultimate', stat: 'ultimate', need: 10, icon: 'rage' },
  { id: 'subcontract', stat: 'necroRaise', need: 20, icon: 'skull' },
  { id: 'hundred', stat: 'run:kills', need: 100, icon: 'skull' },
  { id: 'ratio', stat: 'ratio', need: 1, icon: 'heart' },
  { id: 'traitor', stat: 'traitor', need: 1, icon: 'dark' },
];

/** Souls reward per achievement. */
export const ACH_SOULS = 25;
