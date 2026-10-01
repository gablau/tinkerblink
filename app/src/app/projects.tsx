import { Redirect, Stack, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBanner } from '@/components/StatusBanner';
import { t } from '@/i18n';
import type { Dashboard } from '@/model/profile';
import { useDeviceOnline } from '@/session/hooks';
import { useSession } from '@/session/SessionContext';
import { FONT } from '@/ui/fonts';
import { usePalette, type Palette } from '@/ui/theme';

function DeviceDot({ dashId, deviceId, palette }: { dashId: number; deviceId: number; palette: Palette }) {
  const online = useDeviceOnline(dashId, deviceId);
  return <View style={[styles.dot, { backgroundColor: online ? palette.accent : palette.muted }]} />;
}

function ProjectRow({ dash, palette }: { dash: Dashboard; palette: Palette }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/dashboard/[id]', params: { id: String(dash.id) } })}
      style={[styles.row, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <Text style={[styles.name, { color: palette.text }]}>{dash.name}</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>
        {t.widgetCount(dash.widgets.length)}
        {dash.isActive === false ? ` · ${t.notActive}` : ''}
      </Text>
      <View style={styles.devices}>
        {(dash.devices ?? []).map((d) => (
          <View key={d.id} style={styles.device}>
            <DeviceDot dashId={dash.id} deviceId={d.id} palette={palette} />
            <Text style={[styles.meta, { color: palette.muted, fontSize: 13 }]}>{d.name}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export default function ProjectsScreen() {
  const { profile, logout } = useSession();
  const palette = usePalette();
  if (!profile) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => void logout()} hitSlop={8}>
              <Text style={styles.logout}>{t.logOut}</Text>
            </Pressable>
          ),
        }}
      />
      <StatusBanner />
      <FlatList
        contentContainerStyle={styles.list}
        data={profile.dashBoards}
        keyExtractor={(d) => String(d.id)}
        renderItem={({ item }) => <ProjectRow dash={item} palette={palette} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 10 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, gap: 4 },
  name: { fontSize: 20, fontFamily: FONT.regular },
  meta: { fontSize: 14, fontFamily: FONT.regular },
  logout: { color: '#1D1E22', fontSize: 16, fontFamily: FONT.medium },
  devices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
