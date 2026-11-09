/**
 * Regenerates resources/android (launcher icons + splash) from the game's own
 * vector art. Requires Playwright + a running preview server:
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/gen-assets.cjs
 * The generated PNGs are committed, so this is only needed if the art changes.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'resources', 'android');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 2200 } });
  const shot = async (size, kind, file) => {
    await page.goto(`http://localhost:4173/?icon=${size}&kind=${kind}`);
    await page.waitForFunction(() => window.__iconReady);
    await page.waitForTimeout(250);
    const w = kind === 'splash' ? Math.round(size * 0.5625) : size;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: size }, omitBackground: kind === 'fg' });
  };
  for (const [d, k] of Object.entries(DENS)) {
    await shot(Math.round(48 * k), 'full', path.join(OUT, `mipmap-${d}`, 'ic_launcher.png'));
    await shot(Math.round(48 * k), 'full', path.join(OUT, `mipmap-${d}`, 'ic_launcher_round.png'));
    await shot(Math.round(108 * k), 'fg', path.join(OUT, `mipmap-${d}`, 'ic_launcher_foreground.png'));
  }
  await shot(1920, 'splash', path.join(OUT, 'splash.png'));
  await shot(512, 'full', path.join(OUT, 'icon-512.png'));
  await browser.close();
  console.log('assets written to', OUT);
})();
