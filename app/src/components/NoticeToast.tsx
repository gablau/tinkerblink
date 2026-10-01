// Avviso temporaneo in basso (per esempio "Dispositivo offline" dopo un comando).
// Il testo arriva da SessionState.notice, che il SessionManager azzera dopo qualche secondo.
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/session/SessionContext';
import { FONT } from '@/ui/fonts';

export function NoticeToast() {
  const { notice } = useSession();
  const insets = useSafeAreaInsets();
  if (!notice) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 24 }]}>
      <View style={styles.toast}>
        <Text style={styles.text}>{notice}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { backgroundColor: '#1D1E22EE', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  text: { color: '#FFFFFF', fontFamily: FONT.regular, fontSize: 15 },
});
