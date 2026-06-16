// Thin wrapper around Capacitor native plugins. Every call is guarded so the
// web build (and any non-native platform) is completely unaffected: on the web
// `isNativePlatform()` is false and these become no-ops.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

const isNative = Capacitor.isNativePlatform();

/** One-time native chrome setup. Safe to call on web (no-op). */
export async function initNative(): Promise<void> {
  if (!isNative) return;
  try {
    // Draw the WebView edge-to-edge behind a transparent status bar; the web
    // layout already accounts for safe-area insets.
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // status bar is cosmetic — never let it break startup
  }
}

/** A short tactile bump when a roll settles. No-op on web. */
export async function hapticRollSettled(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // haptics are best-effort
  }
}
