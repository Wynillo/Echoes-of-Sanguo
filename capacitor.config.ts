import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.wynillo.echoesofsanguo',
  appName: 'Echoes of Sanguo',
  webDir:  'dist',
  server: {
    androidScheme: 'https',
    // CSP for Android WebView - allows loading .tcg mods from GitHub raw
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  },
};

export default config;
