import type { BossDef, BossId } from './types';

/**
 * Playable bosses. Each one has a passive (see game/Run.ts applyBossPassive)
 * and a unique ULTIMATE (see game/Ultimate.ts).
 */
export const BOSSES: Record<BossId, BossDef> = {
  demon: { id: 'demon', hp: 30, unlock: 0, main: '#d41f3f', dark: '#8e0f2a', accent: '#ffc83a', eye: '#fff07a' },
  dragon: { id: 'dragon', hp: 28, unlock: 250, main: '#e8562a', dark: '#8f2410', accent: '#ffd23f', eye: '#7dff3a' },
  lich: { id: 'lich', hp: 24, unlock: 300, main: '#6b4fa8', dark: '#35225e', accent: '#7dff3a', eye: '#9cff4f' },
  slime: { id: 'slime', hp: 40, unlock: 350, main: '#4fd65b', dark: '#1f7f35', accent: '#ffc83a', eye: '#ffffff' },
  kraken: { id: 'kraken', hp: 34, unlock: 400, main: '#2f7fd8', dark: '#173f80', accent: '#ff6fb5', eye: '#ffe14a' },
};

export const BOSS_ORDER: BossId[] = ['demon', 'dragon', 'lich', 'slime', 'kraken'];
