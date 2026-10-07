/**
 * Root aplikasi: font, tema, jaringan, sesi, cache query, toast. Rute:
 *   /login          → layar masuk
 *   /(app)/...      → area setelah login (dijaga sesi + kunci aplikasi)
 */
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme';
import { NetworkProvider } from '@/store/network';
import { AuthProvider } from '@/store/auth';
import { usePrefs } from '@/store/prefs';
import { ToastHost } from '@/components/ui/Toast';
import { ensureChannels } from '@/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, gcTime: 10 * 60_000 } },
});

function Navigator() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Font juga ditanam lewat plugin expo-font saat build; useFonts memastikan tersedia di Expo Go.
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-SemiBold': require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans-Bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
  });
  const hydrate = usePrefs((s) => s.hydrate);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    hydrate().finally(() => setPrefsReady(true));
    ensureChannels().catch(() => {});
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && prefsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, prefsReady]);

  if (!fontsLoaded || !prefsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <NetworkProvider>
              <AuthProvider>
                <Navigator />
                <ToastHost />
              </AuthProvider>
            </NetworkProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
