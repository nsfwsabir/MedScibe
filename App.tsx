import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/features/auth/authStore';
import { useProfileStore } from './src/features/profile/profileStore';
import { useSettingsStore } from './src/features/settings/settingsStore';

// Keep native splash visible until JS is ready (fonts + auth bootstrap).
// Without this, Android 12+ Theme.SplashScreen never hides and app appears frozen.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const loadProfile = useProfileStore((s) => s.loadProfile);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const initializing = useAuthStore((s) => s.initializing);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    void bootstrap();
    void loadProfile();
    void loadSettings();
  }, [bootstrap, loadProfile, loadSettings]);

  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && !initializing) {
      try {
        await SplashScreen.hideAsync();
      } catch {}
    }
  }, [fontsLoaded, fontError, initializing]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !initializing) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, initializing]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
