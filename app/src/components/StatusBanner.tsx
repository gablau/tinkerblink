import { StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useSession } from '@/session/SessionContext';
import { FONT } from '@/ui/fonts';
import { usePalette } from '@/ui/theme';

const MESSAGES = {
  reconnecting: t.reconnecting,
  paused: t.paused,
  connecting: t.connecting,
} as const;

/** Striscia in alto quando la connessione non è attiva. */
export function StatusBanner() {
  const { status } = useSession();
  const palette = usePalette();
  if (status !== 'reconnecting' && status !== 'paused' && status !== 'connecting') return null;
  // Senza dettagli tecnici: durante la riconnessione l'errore è quasi sempre "rete o server non raggiungibili".
  return (
    <View style={[styles.banner, { backgroundColor: palette.danger }]}>
      <Text style={styles.text}>{MESSAGES[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, paddingHorizontal: 12 },
  text: { color: '#fff', fontSize: 14, fontFamily: FONT.regular },
});
