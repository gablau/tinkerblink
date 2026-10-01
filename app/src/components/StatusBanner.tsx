import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/session/SessionContext';
import { usePalette } from '@/ui/theme';

const MESSAGES = {
  reconnecting: 'Connessione persa, riconnessione in corso…',
  paused: 'In pausa',
  connecting: 'Connessione…',
} as const;

/** Striscia in alto quando la connessione non è attiva. */
export function StatusBanner() {
  const { status, error } = useSession();
  const palette = usePalette();
  if (status !== 'reconnecting' && status !== 'paused' && status !== 'connecting') return null;
  return (
    <View style={[styles.banner, { backgroundColor: palette.danger }]}>
      <Text style={styles.text}>
        {MESSAGES[status]}
        {error && status === 'reconnecting' ? ` (${error})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, paddingHorizontal: 12 },
  text: { color: '#fff', fontSize: 13 },
});
