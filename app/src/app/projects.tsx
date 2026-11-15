import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Stack, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBanner } from '@/components/StatusBanner';
import { t } from '@/i18n';
import { tp } from '@/project/strings';
import { confirmAction } from '@/project/ui';
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
        {dash.assigned ? ` · ${t.sharedBy(dash.assigned.owner)}` : ''}
        {dash.assigned && !dash.assigned.control ? ` · ${t.readOnly}` : ''}
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
          // Log out on the left, before the title (this is the first screen after the login: no back arrow), after a
          // confirmation: it also forgets the saved password.
          headerLeft: () => (
            <Pressable onPress={() => confirmAction(t.logOut, t.logOutConfirm, t.logOut, () => void logout())} hitSlop={8} accessibilityLabel={t.logOut} style={styles.headerLeft}>
              <MaterialCommunityIcons name="logout" size={24} color="#1D1E22" />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <Pressable onPress={() => router.push('/project/new')} hitSlop={8} accessibilityLabel={tp.newProject}>
                <MaterialCommunityIcons name="plus" size={26} color="#1D1E22" />
              </Pressable>
              <Pressable onPress={() => router.push('/credits')} hitSlop={8} accessibilityLabel={t.credits}>
                <MaterialCommunityIcons name="information-outline" size={24} color="#1D1E22" />
              </Pressable>
            </View>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  list: { padding: 12, gap: 10 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, gap: 4 },
  name: { fontSize: 20, fontFamily: FONT.regular },
  meta: { fontSize: 14, fontFamily: FONT.regular },
  headerLeft: { marginRight: 24 },
  devices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
