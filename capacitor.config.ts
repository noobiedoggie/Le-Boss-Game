import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leboss.game',
  appName: 'LE BOSS',
  webDir: 'dist',
  backgroundColor: '#120a1c',
  android: {
    // Keep the WebView fast: no mixed content, no debugging overlays in release.
    allowMixedContent: false,
    backgroundColor: '#120a1c',
  },
};

export default config;
