import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient, queryPersister, resumeOfflineMutations } from '../src/data/queryClient';
import { AuthGate } from '../src/features/auth/AuthGate';
import { fontAssets } from '../src/theme/fonts';
import { installRestAlert } from '../src/features/workout/restAlert';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
installRestAlert();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              buster: Constants.expoConfig?.version ?? '1',
            }}
            onSuccess={() => {
              void resumeOfflineMutations();
            }}
          >
            <AuthGate>
              <RootStack />
            </AuthGate>
          </PersistQueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="workout/active" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="workout/[id]" />
        {/* No formSheet: on iOS react-native-screens stretches a formSheet's nested ScrollView over
            the whole sheet, covering the header and its close button. */}
        <Stack.Screen name="cardio/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cardio/[id]" />
        <Stack.Screen name="exercise/picker" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exercise/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]" />
        <Stack.Screen name="templates" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tutorial" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </>
  );
}
