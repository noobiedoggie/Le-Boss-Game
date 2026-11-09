/**
 * Post-sync patch for the generated Android project (idempotent).
 * Runs automatically after `npx cap add android` / `npx cap sync`
 * (npm script hooks capacitor:add:after / capacitor:sync:after).
 *
 *  - locks the game to PORTRAIT, keeps the screen on
 *  - immersive fullscreen (hides status + navigation bars)
 *  - dark window background (no white flash)
 *  - copies launcher icons + splash from resources/android
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(app)) {
  console.log('[patch-android] android/ not found, skipping (run "npx cap add android" first).');
  process.exit(0);
}

const log = (m) => console.log('[patch-android] ' + m);
const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// 1. Manifest: portrait + hardware acceleration
const manifestPath = path.join(app, 'AndroidManifest.xml');
let manifest = read(manifestPath);
if (!manifest.includes('android:screenOrientation')) {
  manifest = manifest.replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
  log('portrait orientation locked');
}
if (!manifest.includes('android:hardwareAccelerated')) {
  manifest = manifest.replace(/<application\b/, '<application\n        android:hardwareAccelerated="true"');
}
write(manifestPath, manifest);

// 2. Styles: fullscreen + dark background
const stylesPath = path.join(app, 'res', 'values', 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = read(stylesPath);
  const extra =
    '        <item name="android:windowFullscreen">true</item>\n' +
    '        <item name="android:windowBackground">@color/leboss_bg</item>\n';
  styles = styles.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>\n)(?![\s\S]*?leboss_bg[\s\S]*?<\/style>)/, `$1${extra}`);
  write(stylesPath, styles);
}
const colorsPath = path.join(app, 'res', 'values', 'leboss_colors.xml');
write(colorsPath, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="leboss_bg">#120a1c</color>\n</resources>\n');
const icBgPath = path.join(app, 'res', 'values', 'ic_launcher_background.xml');
if (fs.existsSync(icBgPath)) write(icBgPath, read(icBgPath).replace(/#[0-9A-Fa-f]{6}/, '#120a1c'));

// 3. MainActivity: immersive fullscreen + keep screen on
const javaDir = path.join(app, 'java');
const findMain = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      const r = findMain(p);
      if (r) return r;
    } else if (f.name === 'MainActivity.java') return p;
  }
  return null;
};
const mainPath = fs.existsSync(javaDir) ? findMain(javaDir) : null;
if (mainPath) {
  const src = read(mainPath);
  if (!src.includes('hideSystemBars')) {
    const pkg = (src.match(/package\s+([\w.]+);/) || [])[1] || 'com.leboss.game';
    write(
      mainPath,
      `package ${pkg};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/** LE BOSS: portrait, immersive fullscreen, screen always on while playing. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`,
    );
    log('MainActivity patched (immersive fullscreen)');
  }
}

// 4. Icons + splash
const res = path.join(root, 'resources', 'android');
if (fs.existsSync(res)) {
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const from = path.join(res, `mipmap-${d}`);
    const to = path.join(app, 'res', `mipmap-${d}`);
    if (!fs.existsSync(from) || !fs.existsSync(to)) continue;
    for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
  }
  const splash = path.join(res, 'splash.png');
  if (fs.existsSync(splash)) {
    for (const dir of fs.readdirSync(path.join(app, 'res'))) {
      if (!dir.startsWith('drawable')) continue;
      const target = path.join(app, 'res', dir, 'splash.png');
      if (fs.existsSync(target)) fs.copyFileSync(splash, target);
    }
  }
  log('icons + splash copied');
}
log('done');
