import { Game } from './core/Game';
import { SplashScene } from './scenes/SplashScene';
import { store } from './systems/Save';
import { audio } from './systems/Audio';
import { haptics } from './systems/Haptics';
import { setLang } from './i18n';
import { sprites } from './render/Sprites';
import { defineHeroStatics } from './render/art/heroArt';
import { bindPlatform } from './systems/Platform';
import { toasts } from './ui/widgets';

/**
 * LE BOSS — entry point.
 * Boot: load save -> apply settings -> wait for the bundled font -> splash.
 */
async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  sprites.setResolution(game.scale);
  window.addEventListener('resize', () => sprites.setResolution(game.scale));
  defineHeroStatics();

  await store.load();
  const s = store.data.settings;
  setLang(s.lang);
  audio.setVolumes(s.sfx, s.music);
  haptics.enabled = s.haptics;
  game.camera.intensity = s.shake ? 1 : 0.15;

  // Wait (briefly) for Lilita One so the first frame already looks right.
  try {
    await Promise.race([document.fonts.load("40px 'Lilita One'"), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fallback fonts */
  }

  game.overlay = (ctx, rdt) => {
    toasts.update(rdt);
    toasts.draw(ctx, game.W, game.safeTop);
  };
  // Audio needs a user gesture: unlock on the very first touch anywhere.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: false, capture: true });

  bindPlatform(game);
  game.setScene(new SplashScene(game), true);
  game.start();
  (window as unknown as { __game: Game }).__game = game;
}

void boot();
