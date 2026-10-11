import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Setwise',
  slug: 'setwise',
  owner: 'setwise-sixtus',
  scheme: 'setwise',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  // `exposdk:57.0.0`, the runtime Expo Go reports, so published updates open in Expo Go.
  runtimeVersion: { policy: 'sdkVersion' },
  updates: {
    url: 'https://u.expo.dev/9f62af10-cf36-463d-b0f5-0a2f7ea15a04',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.sixtus.setwise',
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.sixtus.setwise',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#F4F2EE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F4F2EE',
        image: './assets/splash-icon.png',
        imageWidth: 180,
      },
    ],
    'expo-status-bar',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-notifications',
  ],
  extra: {
    eas: { projectId: '9f62af10-cf36-463d-b0f5-0a2f7ea15a04' },
  },
};

export default config;
