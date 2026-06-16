import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mykrosr.dicer',
  appName: 'Dicer',
  webDir: 'dist',
  // Dark table aesthetic; keep the WebView content behind a transparent,
  // overlaid status bar (the web app already handles safe-area insets).
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
