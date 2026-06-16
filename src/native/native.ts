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
    // layout accounts for the system-bar insets (see MainActivity + --sa-*).
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // status bar is cosmetic — never let it break startup
  }
}

/**
 * Match the status-bar icon colour to the app background behind it: a light
 * background gets dark icons, a dark background gets light icons. No-op on web.
 */
export async function setBarStyleForBackground(color: string): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: isLight(color) ? Style.Light : Style.Dark });
  } catch {
    // best-effort
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

/** Perceived lightness of a #rgb / #rrggbb colour (sRGB luma, 0..1). */
function isLight(color: string): boolean {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return true;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}
