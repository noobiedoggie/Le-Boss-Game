import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import type { Game } from '../core/Game';
import { audio } from './Audio';

/** Native glue: back button, pause on background, share. */
export function bindPlatform(game: Game): void {
  const onHidden = () => {
    game.scene?.pause?.();
    audio.suspend();
  };
  const onVisible = () => audio.resume();
  document.addEventListener('visibilitychange', () => (document.hidden ? onHidden() : onVisible()));
  if (Capacitor.isNativePlatform()) {
    void App.addListener('backButton', () => {
      const handled = game.scene?.back?.();
      if (!handled) void App.minimizeApp();
    });
    void App.addListener('pause', onHidden);
    void App.addListener('resume', onVisible);
  } else {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') game.scene?.back?.();
    });
  }
}

export async function shareText(text: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ text, dialogTitle: 'LE BOSS' });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard?.writeText(text);
  } catch {
    /* user cancelled */
  }
}
