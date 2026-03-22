import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.wynillo.echoesofsanguo',
  appName: 'Echoes of Sanguo',
  webDir:  'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
