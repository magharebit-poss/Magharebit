import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'ma.magharebit.pos',
  appName: 'MAGHAREBIT POS',
  webDir:  'out',
  server: {
    // For development: point to local Next.js dev server.
    // Remove (or comment out) for production APK.
    // url: 'http://192.168.X.X:3003',
    // cleartext: true,
  },
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration:         2000,
      launchAutoHide:             true,
      backgroundColor:            '#0A2318',
      androidSplashResourceName:  'splash',
      showSpinner:                false,
    },
    StatusBar: {
      style:           'DARK',
      backgroundColor: '#0A2318',
    },
  },
};

export default config;
