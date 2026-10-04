import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NoticeToast } from '@/components/NoticeToast';
import { t } from '@/i18n';
import { tp } from '@/project/strings';
import { SessionProvider } from '@/session/SessionContext';
// I task del GPS in background vanno definiti all'avvio, prima che Android li richiami.
import '@/sensors/gps';
import { FONT, useAppFonts } from '@/ui/fonts';
import { usePalette } from '@/ui/theme';

// Lo splash nativo resta finché la schermata di login non sa se entrare da sola (app/index.tsx): con le credenziali
// salvate si passa direttamente dallo splash ai progetti, senza vedere il login per un attimo.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 200 });
/** Rete di sicurezza: dopo questo tempo lo splash si chiude comunque (server lento, link diretto a un'altra schermata). */
const SPLASH_MAX_MS = 8000;

/** Barra in alto: verde Blynk con titolo e icone scuri. */
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
