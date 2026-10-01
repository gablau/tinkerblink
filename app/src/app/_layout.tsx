import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { SessionProvider } from '@/session/SessionContext';
import { FONT, useAppFonts } from '@/ui/fonts';
import { usePalette } from '@/ui/theme';

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
    </Stack>
  );
}

export default function RootLayout() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootStack />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
