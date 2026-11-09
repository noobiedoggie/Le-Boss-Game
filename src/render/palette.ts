/**
 * "Dark cartoon" palette: deep purple dungeon, lava orange, toxic green,
 * crimson + gold boss, naive bright heroes. Everything visual pulls from here.
 */
export const C = {
  ink: '#140b1d', // outlines (near-black purple)
  bg0: '#120a1c',
  bg1: '#1d1030',
  bg2: '#2a1745',
  floorA: '#3b2560',
  floorB: '#342055',
  floorEdge: '#251540',
  floorFront: '#1a0e2c',
  wallTop: '#6d4c9a',
  wallTopHi: '#8b67bd',
  wallFront: '#432a68',
  pillarTop: '#5e5a7a',
  pillarFront: '#3c3856',
  lava: '#ff6a1a',
  lavaHi: '#ffc23d',
  lavaDeep: '#c2300f',
  toxic: '#7dff3a',
  toxicDeep: '#3fae1e',
  slime: '#58e06a',
  water: '#2f8fd8',
  waterHi: '#7fd4ff',
  pit: '#06030a',
  crimson: '#d41f3f',
  crimsonDark: '#8e0f2a',
  crimsonHi: '#ff5b6e',
  gold: '#ffc83a',
  goldDark: '#c98a12',
  goldHi: '#fff07a',
  white: '#fff8ee',
  bone: '#efe6cf',
  steel: '#c9d3e0',
  steelDark: '#7c8799',
  wood: '#9a5a2c',
  woodDark: '#653512',
  fire: '#ff8a1f',
  fireHi: '#ffe14a',
  poison: '#9cff4f',
  dark: '#a35cff',
  ice: '#8fe8ff',
  heal: '#5dff8f',
  uiPanel: '#2b1840',
  uiPanelHi: '#43275f',
  uiBtn: '#ff4d6d',
  uiBtnDark: '#a8173a',
  uiBtnAlt: '#ffc83a',
  uiBtnAltDark: '#b97a00',
  uiGood: '#5fe26b',
  uiGoodDark: '#1f8f3a',
  uiBlue: '#4db8ff',
  uiBlueDark: '#1d6cb3',
  grey: '#8f86a3',
  rarity: {
    common: '#d9d2e6',
    rare: '#4db8ff',
    legendary: '#ffc83a',
    cursed: '#9cff4f',
  } as Record<string, string>,
} as const;

/** Bright, naive colors for heroes. */
export const HERO_TUNICS = ['#3fa9f5', '#ff5fa2', '#ffd23f', '#7be36b', '#ff8c42', '#b388ff', '#4fe0d4', '#ff5b5b', '#f5f5f5'];
export const HERO_SKINS = ['#ffd7b0', '#f2b98c', '#d99366', '#a86c45', '#7a4b2e', '#ffe3c9'];
export const HERO_HAIR = ['#f7d34a', '#8a4b1f', '#2b1a12', '#e3622c', '#f0f0f0', '#ff6fb5', '#3ac1ff', '#141414'];

export const CONFETTI = ['#ff4d6d', '#ffc83a', '#4db8ff', '#7dff3a', '#b388ff', '#ffffff', '#ff8c42', '#4fe0d4'];
