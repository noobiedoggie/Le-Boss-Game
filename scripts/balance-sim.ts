/**
 * Headless balance simulation: runs the real World code with bot players.
 *   npm run sim            (bundles with esbuild and runs in node)
 * Bots:
 *   novice  — taps fireballs slowly, places traps on the path, no walls/claw.
 *   decent  — uses all 3 attacks + ultimate, builds a maze with walls, upgrades.
 */
import { World } from '../src/game/World';
import { castTap, castSwipe, holdBegin, holdRelease } from '../src/game/Attacks';
import type { BuildId } from '../src/data/types';
import { Tile, COLS, ROWS } from '../src/game/Board';

type Bot = 'novice' | 'decent' | 'veteran';

function runOnce(seed: number, bot: Bot, maxWave = 20) {
  const unlocked = new Set<BuildId>(['wall', 'spikes', 'slime', 'firejet', 'bounce', 'goblin', 'archer']);
  if (bot !== 'novice') for (const id of ['axe', 'trapdoor', 'gas', 'ogre'] as BuildId[]) unlocked.add(id);
  if (bot === 'veteran') for (const id of ['mimic', 'bats', 'necro'] as BuildId[]) unlocked.add(id);
  const vet = bot === 'veteran';
  const w = new World({
    bossId: 'demon', attacks: { tap: 'fireball', swipe: 'claw', hold: 'roar' }, seed,
    startGold: vet ? 220 : 100, bossHpBonus: vet ? 15 : 0, rageStart: vet ? 40 : 0, rerolls: vet ? 1 : 0, unlocked,
  });
  w.startWave();
  const dt = 1 / 60;
  let think = 0;
  let guard = 0;
  const leaks: number[] = [];
  const supers: Record<string, { hp: number; t0: number; life?: number; dmg: number }> = {};
  let lastHp = w.boss.hp, lastWave = 1;
  const reaction = bot === 'novice' ? 0.9 : 0.3;
  const smart = bot !== 'novice';
  while (w.phase !== 'over' && w.phase !== 'victory' && guard++ < 60 * 60 * 60) {
    if (w.phase === 'pact') {
      const offer = w.pactOffer;
      const p = smart ? offer.find((x) => x.rarity !== 'cursed') ?? offer[0] : offer[Math.floor(Math.random() * offer.length)];
      w.choosePact(p);
      build(w, bot);
      w.startWave();
      if (w.wave > maxWave) break;
    }
    if (w.phase === 'wave') {
      think -= dt;
      if (think <= 0) {
        think = reaction * (0.7 + Math.random() * 0.6);
        // densest hero
        let best = null as null | { x: number; y: number; n: number };
        for (const h of w.heroes) {
          if (!h.targetable || h.ally || h.y < -0.8) continue;
          const n = w.heroesIn(h.x, h.y, 1).length + (h.y > ROWS - 3 ? 2 : 0);
          if (!best || n > best.n) best = { x: h.x, y: h.y, n };
        }
        if (best) {
          // aim error
          const err = smart ? 0.3 : 0.9;
          castTap(w, best.x + (Math.random() - 0.5) * err, best.y + (Math.random() - 0.5) * err);
          const sup = w.heroes.some((h) => h.isSuper && h.alive);
          const swipeP = smart || sup ? 1 : 0.35;
          if (w.boss.cd.swipe <= 0 && best.n >= 2 && Math.random() < swipeP) castSwipe(w, best.x - 1.2, best.y - 0.3, best.x + 1.2, best.y + 0.3);
          const armored = w.heroes.some((h) => h.plotArmor && h.alive && h.y > 0);
          if (w.boss.cd.hold <= 0 && (armored || ((smart || Math.random() < 0.15) && w.heroes.filter((h) => h.alive && h.y > ROWS - 4).length >= 3))) {
            const hs = holdBegin(w, 3.5, 8);
            if (hs) { hs.t = 1.1; holdRelease(w, hs); }
          }
        }
        if (w.canUltimate() && w.heroes.filter((h) => h.alive).length >= (smart ? 5 : 2)) w.ultimate();
      }
    }
    const hpBefore = w.boss.hp;
    w.update(dt);
    for (const h of w.heroes) if (h.isSuper && !supers[h.superId! + w.wave]) supers[h.superId! + w.wave] = { hp: h.maxHp, t0: w.time, dmg: 0 };
    for (const [k, v] of Object.entries(supers)) {
      const h = w.heroes.find((x) => x.isSuper && x.superId + w.wave === k);
      if (h && h.state === 'throne') v.dmg += Math.max(0, hpBefore - w.boss.hp);
      if (!h && v.life === undefined) v.life = w.time - v.t0;
    }
    if (w.wave !== lastWave) { leaks[lastWave] = lastHp - w.boss.hp; lastHp = w.boss.hp; lastWave = w.wave; }
  }
  leaks[lastWave] = lastHp - w.boss.hp;
  return { supers, causes: w.stats.killsByCause, phase: w.phase, alive: w.heroes.filter((h) => !h.done).map((h) => `${h.superId ?? h.cls}:${h.state}:${h.x.toFixed(1)},${h.y.toFixed(1)}:${Math.round(h.hp)}`).join(' '), traps: w.traps.length, lv: w.traps.reduce((s, t) => s + t.level, 0), leaks, wave: w.phase === 'victory' ? 21 : w.wave, kills: w.stats.kills, gold: w.stats.goldEarned, hp: w.boss.hp, path: w.stats.maxPath };
}

const ORDER: BuildId[] = ['spikes', 'firejet', 'slime', 'spikes', 'bounce', 'goblin', 'firejet', 'archer', 'axe', 'gas', 'trapdoor', 'mimic', 'spikes', 'ogre', 'necro', 'bats'];

function build(w: World, bot: Bot) {
  const b = w.board;
  // decent bot: build a serpentine maze with walls (alternating gaps)
  if (bot !== 'novice' && w.wave >= 3) {
    for (const r of [3, 6, 9]) {
      const gapLeft = (r / 3) % 2 === 1;
      for (let c = 0; c < COLS; c++) {
        if ((gapLeft && c === 0) || (!gapLeft && c === COLS - 1)) continue;
        const i = b.idx(c, r);
        if (w.gold < w.costOf('wall') + 20) break;
        if (!w.canPlace('wall', i)) w.place('wall', i);
      }
    }
  }
  let k = w.traps.length;
  for (let guard = 0; guard < 40; guard++) {
    const path = b.shortestPath();
    // upgrade first when rich
    const up = w.traps.find((t) => t.level < 3 && w.upgradeCost(t) <= w.gold * (bot !== 'novice' ? 0.6 : 0.3));
    if (up && Math.random() < 0.5) { w.upgrade(up.tile); continue; }
    const id = ORDER[k % ORDER.length];
    if (!w.isUnlocked(id)) { k++; continue; }
    if (w.costOf(id) > w.gold) break;
    let placed = false;
    const isMonster = id === 'goblin' || id === 'archer' || id === 'ogre' || id === 'necro' || id === 'bats';
    const cands = isMonster
      ? path.flatMap((p) => [p - 1, p + 1]).filter((i) => i >= 0 && i < COLS * ROWS && b.tiles[i] === Tile.Floor && !path.includes(i))
      : path.slice(1, -1);
    for (const tile of cands) {
      if (!w.canPlace(id, tile)) { w.place(id, tile); placed = true; break; }
    }
    k++;
    if (!placed && k > ORDER.length * 3) break;
  }
}

const N = Number(process.argv[2] ?? 12);
for (const bot of ['novice', 'decent', 'veteran'] as Bot[]) {
  const res = [];
  for (let i = 0; i < N; i++) res.push(runOnce(1000 + i * 77, bot));
  for (const r of res) if (r.phase !== 'over' && r.phase !== 'victory') console.log('  STUCK', r.wave, r.phase, r.alive);
  const waves = res.map((r) => r.wave).sort((a, b) => a - b);
  const avg = waves.reduce((s, x) => s + x, 0) / waves.length;
  const wins = res.filter((r) => r.wave > 20).length;
  const curve: string[] = [];
  for (let wv = 1; wv <= 20; wv++) {
    const v = res.map((r) => r.leaks[wv]).filter((x) => x !== undefined);
    if (v.length) curve.push(`${wv}:${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1)}`);
  }
  console.log('  hp lost/wave ' + curve.join(' '));
  const agg: Record<string, { n: number; life: number; dmg: number; hp: number }> = {};
  for (const r of res) for (const [k, v] of Object.entries(r.supers)) {
    const a = (agg[k] ??= { n: 0, life: 0, dmg: 0, hp: 0 });
    a.n++; a.life += v.life ?? 99; a.dmg += v.dmg; a.hp += v.hp;
  }
  console.log('  supers ' + Object.entries(agg).map(([k, a]) => `${k}: hp ${(a.hp / a.n).toFixed(0)} life ${(a.life / a.n).toFixed(1)}s bossDmg ${(a.dmg / a.n).toFixed(1)}`).join(' | '));
  const causes: Record<string, number> = {};
  for (const r of res) for (const [k, v] of Object.entries(r.causes)) causes[k] = (causes[k] ?? 0) + v / N;
  console.log('  causes ' + Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(' '));
  console.log(`${bot.padEnd(7)} avg wave ${avg.toFixed(1)} | median ${waves[waves.length >> 1]} | wins ${wins}/${N} | waves ${waves.join(',')} | avg kills ${(res.reduce((s, r) => s + r.kills, 0) / N).toFixed(0)} | maxPath ${Math.max(...res.map((r) => r.path)).toFixed(0)} | traps ${(res.reduce((s, r) => s + r.traps, 0) / N).toFixed(1)} lv ${(res.reduce((s, r) => s + r.lv, 0) / N).toFixed(1)} gold ${(res.reduce((s, r) => s + r.gold, 0) / N).toFixed(0)}`);
}
