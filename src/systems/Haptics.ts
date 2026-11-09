import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/** Throttled haptic feedback (Capacitor on device, navigator.vibrate on web). */
class HapticsEngine {
  enabled = true;
  private last = 0;
  private native = Capacitor.isNativePlatform();

  impact(kind: 'light' | 'medium' | 'heavy'): void {
    if (!this.enabled) return;
    const now = performance.now();
    const gap = kind === 'heavy' ? 90 : kind === 'medium' ? 70 : 55;
    if (now - this.last < gap) return;
    this.last = now;
    if (this.native) {
      const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
      void Haptics.impact({ style }).catch(() => {});
    } else if (navigator.vibrate) {
      try {
        navigator.vibrate(kind === 'heavy' ? 30 : kind === 'medium' ? 18 : 8);
      } catch {
        /* not allowed */
      }
    }
  }
}

export const haptics = new HapticsEngine();
