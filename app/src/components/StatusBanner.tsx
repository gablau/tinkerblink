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

/** Bar at the top when the connection is down. */
export function StatusBanner() {
  const { status } = useSession();
  const palette = usePalette();
  if (status !== 'reconnecting' && status !== 'paused' && status !== 'connecting') return null;
  // No technical details: while reconnecting the error is almost always "network or server unreachable".
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
