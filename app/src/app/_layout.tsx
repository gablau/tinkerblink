import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NoticeToast } from '@/components/NoticeToast';
import { t } from '@/i18n';
import { tp } from '@/project/strings';
import { SessionProvider } from '@/session/SessionContext';
// The background GPS tasks must be defined at startup, before Android calls them.
import '@/sensors/gps';
import { FONT, useAppFonts } from '@/ui/fonts';
import { usePalette } from '@/ui/theme';

// The native splash stays until the login screen knows whether it can log in by itself (app/index.tsx): with saved
// credentials the app goes straight from the splash to the projects, without flashing the login.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 200 });
/** Safety net: after this time the splash closes anyway (slow server, deep link to another screen). */
const SPLASH_MAX_MS = 8000;

/** Top bar: Blynk green with dark title and icons. */
const HEADER_GREEN = '#23C48E';
const HEADER_TEXT = '#1D1E22';

function RootStack() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: HEADER_GREEN },
        headerTintColor: HEADER_TEXT,
        headerTitleStyle: { fontFamily: FONT.regular, fontSize: 22 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t.appTitle, headerShown: false }} />
      <Stack.Screen name="projects" options={{ title: t.projects }} />
      <Stack.Screen name="dashboard/[id]" options={{ title: '' }} />
      <Stack.Screen name="project/new" options={{ title: tp.newProject, presentation: 'modal' }} />
      <Stack.Screen name="project/[dashId]/index" options={{ title: tp.projectSettings }} />
      <Stack.Screen name="project/[dashId]/device/[deviceId]" options={{ title: tp.device }} />
      <Stack.Screen name="certificate" options={{ title: t.certTitle, presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const fontsReady = useAppFonts();
  useEffect(() => {
    const timer = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootStack />
        <NoticeToast />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
