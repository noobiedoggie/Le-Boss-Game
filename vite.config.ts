import { defineConfig } from 'vite';

// Relative base so the bundle works from file:// and inside the Capacitor WebView.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173 },
});
