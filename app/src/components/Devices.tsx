// Stato dei device di una dashboard:
// - nell'intestazione l'icona della scheda con un badge rosso = numero di device offline;
// - toccandola si apre sotto l'intestazione l'elenco dei device con "Online since…", "Offline since…"
//   oppure "Wasn't online yet" e un pallino verde (online) o grigio (offline).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import type { Dashboard, Device } from '@/model/profile';
import { useDeviceState, useOfflineCount } from '@/session/hooks';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';

const RED = '#D3435C';
const GREEN = '#23C48E';
const HEADER_TEXT = '#1D1E22';

const CONNECTION_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  WI_FI: 'wifi',
  ETHERNET: 'ethernet',
  BLUETOOTH: 'bluetooth',
  BLE: 'bluetooth',
  USB: 'usb',
  GSM: 'signal-cellular-3',
};

/** Pulsante dell'intestazione con il badge dei device offline. */
export function DevicesButton({ dash, open, onPress }: { dash: Dashboard; open: boolean; onPress: () => void }) {
  const ids = (dash.devices ?? []).map((d) => d.id);
  const offline = useOfflineCount(dash.id, ids);
  if (ids.length === 0) return null;
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.button}>
      <MaterialCommunityIcons name="developer-board" size={30} color={HEADER_TEXT} style={{ opacity: open ? 0.6 : 1 }} />
      {offline > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{offline}</Text>
        </View>
      )}
    </Pressable>
  );
}

function DeviceRow({ dashId, device, theme }: { dashId: number; device: Device; theme: DashboardTheme }) {
  const state = useDeviceState(dashId, device.id);
  const status = state.online
    ? state.connectTime > 0
      ? t.onlineSince(t.formatDateTime(new Date(state.connectTime)))
      : t.onlineSince('')
    : state.disconnectTime > 0
      ? t.offlineSince(t.formatDateTime(new Date(state.disconnectTime)))
      : t.neverOnline;
  const muted = theme.light ? '#00000099' : '#FFFFFF99';
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={CONNECTION_ICON[device.connectionType ?? ''] ?? 'chip'} size={30} color={muted} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: theme.text, opacity: state.online ? 1 : 0.6 }]} numberOfLines={1}>
          {device.name}
        </Text>
        <Text style={[styles.status, { color: muted }]} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: state.online ? GREEN : muted }]} />
    </View>
  );
}

/** Elenco dei device sotto l'intestazione. */
export function DevicesPanel({ dash, theme }: { dash: Dashboard; theme: DashboardTheme }) {
  const bg = theme.light ? '#E6ECF0' : '#191A1F';
  return (
    <View style={[styles.panel, { backgroundColor: bg }]}>
      {(dash.devices ?? []).map((d) => (
        <DeviceRow key={d.id} dashId={dash.id} device={d} theme={theme} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Spazio a destra e in basso: il badge sporge dall'icona e altrimenti verrebbe tagliato dall'intestazione.
  button: { paddingLeft: 4, paddingRight: 12, paddingBottom: 6 },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: RED,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: FONT.medium },
  panel: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  rowText: { flex: 1 },
  name: { fontFamily: FONT.regular, fontSize: 22 },
  status: { fontFamily: FONT.light, fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
