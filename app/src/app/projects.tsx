// Project list. Projects can be pinned to the top (pin on the card, saved on this phone); the order of the pinned ones
// changes only in the reorder mode (icon in the top bar), by dragging them by their handle.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native';
import { ReorderList } from '@/components/ReorderList';
import { StatusBanner } from '@/components/StatusBanner';
import { t } from '@/i18n';
import { usePinnedProjects } from '@/project/pinned';
import { tp } from '@/project/strings';
import { confirmAction } from '@/project/ui';
import type { Dashboard } from '@/model/profile';
import { useDeviceOnline } from '@/session/hooks';
import { loadLastDash, saveLastDash } from '@/session/lastDash';
import { useSession } from '@/session/SessionContext';
import { FONT } from '@/ui/fonts';
import { usePalette, type Palette } from '@/ui/theme';

function DeviceDot({ dashId, deviceId, palette }: { dashId: number; deviceId: number; palette: Palette }) {
  const online = useDeviceOnline(dashId, deviceId);
  return <View style={[styles.dot, { backgroundColor: online ? palette.accent : palette.muted }]} />;
}

type RowMode =
  /** Normal list: the pin toggles pinning. */
  | { kind: 'normal'; onTogglePin: () => void }
  /** Reorder mode, pinned project: drag handle. */
  | { kind: 'drag'; handle: GestureResponderHandlers; dragging: boolean }
  /** Reorder mode, project not pinned: dimmed and inert. */
  | { kind: 'inert' };

function ProjectRow({ dash, pinned, mode, palette }: { dash: Dashboard; pinned: boolean; mode: RowMode; palette: Palette }) {
  const lifted = mode.kind === 'drag' && mode.dragging;
  return (
    <Pressable
      disabled={mode.kind !== 'normal'}
      onPress={() => router.push({ pathname: '/dashboard/[id]', params: { id: String(dash.id) } })}
      style={[
        styles.row,
        { backgroundColor: palette.card, borderColor: lifted ? palette.accent : palette.border },
        mode.kind === 'inert' && { opacity: 0.4 },
        lifted && styles.lifted,
      ]}
    >
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.name, { color: palette.text }]}>{dash.name}</Text>
          {dash.isActive === false && (
            <MaterialCommunityIcons name="stop-circle-outline" size={22} color={palette.danger} accessibilityLabel={t.notActive} />
          )}
          {mode.kind === 'normal' && (
            <Pressable onPress={mode.onTogglePin} hitSlop={10} accessibilityLabel={pinned ? t.unpinProject : t.pinProject}>
              <MaterialCommunityIcons name={pinned ? 'pin' : 'pin-outline'} size={22} color={pinned ? palette.accent : palette.muted} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.meta, { color: palette.muted }]}>
          {t.widgetCount(dash.widgets.length)}
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
      </View>
      {/* Handle in its own column, centered vertically: the whole right side of the card can be grabbed. */}
      {mode.kind === 'drag' && (
        <View {...mode.handle} hitSlop={12} accessibilityLabel={t.dragProject} style={styles.handle}>
          <MaterialCommunityIcons name="drag-vertical" size={32} color={palette.text} />
        </View>
      )}
    </Pressable>
  );
}

/** Accounts ("host|email") whose last project has already been reopened since the app started: only once, not at
 * every reconnection (the session recreates the account object) nor when the screen is created again. */
const restoredAccounts = new Set<string>();
const accountKey = (a: { host: string; email: string }) => `${a.host}|${a.email}`;

export default function ProjectsScreen() {
  const { profile, account, logout } = useSession();
  const palette = usePalette();
  // Last project opened: the first time the list appears after the login it opens that project straight away (the
  // list stays empty meanwhile, so it does not flash). Every later return to the list forgets it.
  const [restoring, setRestoring] = useState(account !== undefined && !restoredAccounts.has(accountKey(account)));
  useFocusEffect(
    useCallback(() => {
      if (!profile || !account) return;
      if (restoredAccounts.has(accountKey(account))) return void saveLastDash(account, undefined);
      restoredAccounts.add(accountKey(account));
      void loadLastDash(account).then((id) => {
        if (id !== undefined && profile.dashBoards.some((d) => d.id === id)) {
          router.push({ pathname: '/dashboard/[id]', params: { id: String(id) } });
        }
        setRestoring(false);
      });
    }, [profile, account]),
  );
  const [pinnedIds, setPinnedIds] = usePinnedProjects(account);
  const [reordering, setReordering] = useState(false);
  const [dragging, setDragging] = useState(false);
  if (!profile) return <Redirect href="/" />;

  // Pinned projects first, in their order; then the others in the order of the server.
  const byId = new Map(profile.dashBoards.map((d) => [d.id, d]));
  const pinned = (pinnedIds ?? []).flatMap((id) => byId.get(id) ?? []);
  const pinnedSet = new Set(pinned.map((d) => d.id));
  const others = profile.dashBoards.filter((d) => !pinnedSet.has(d.id));
  const togglePin = (id: number) =>
    setPinnedIds(pinnedSet.has(id) ? pinned.map((d) => d.id).filter((p) => p !== id) : [...pinned.map((d) => d.id), id]);
  // The reorder icon appears only when there is something to reorder.
  const canReorder = pinned.length >= 2;
  const inReorder = reordering && canReorder;
  const ready = !restoring && (pinnedIds !== undefined || account === undefined);

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
              {canReorder && (
                <Pressable onPress={() => setReordering(!inReorder)} hitSlop={8} accessibilityLabel={inReorder ? t.reorderDone : t.reorderPinned}>
                  <MaterialCommunityIcons name={inReorder ? 'check' : 'swap-vertical'} size={24} color="#1D1E22" />
                </Pressable>
              )}
              {!inReorder && (
                <Pressable onPress={() => router.push('/project/new')} hitSlop={8} accessibilityLabel={tp.newProject}>
                  <MaterialCommunityIcons name="plus" size={26} color="#1D1E22" />
                </Pressable>
              )}
              {!inReorder && (
                <Pressable onPress={() => router.push('/credits')} hitSlop={8} accessibilityLabel={t.credits}>
                  <MaterialCommunityIcons name="information-outline" size={24} color="#1D1E22" />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <StatusBanner />
      {ready && (
        <ScrollView contentContainerStyle={styles.list} scrollEnabled={!dragging}>
          {inReorder && <Text style={[styles.hint, { color: palette.muted }]}>{t.reorderHint}</Text>}
          {inReorder ? (
            <ReorderList
              items={pinned}
              keyOf={(d) => String(d.id)}
              gap={GAP}
              onDragChange={setDragging}
              onReorder={(list) => setPinnedIds(list.map((d) => d.id))}
              renderItem={(d, handle, lifted) => (
                <ProjectRow dash={d} pinned mode={{ kind: 'drag', handle, dragging: lifted }} palette={palette} />
              )}
            />
          ) : (
            pinned.map((d) => <ProjectRow key={d.id} dash={d} pinned mode={{ kind: 'normal', onTogglePin: () => togglePin(d.id) }} palette={palette} />)
          )}
          {others.map((d) => (
            <ProjectRow
              key={d.id}
              dash={d}
              pinned={false}
              mode={inReorder ? { kind: 'inert' } : { kind: 'normal', onTogglePin: () => togglePin(d.id) }}
              palette={palette}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const GAP = 10;

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  list: { padding: 12, gap: GAP },
  hint: { fontSize: 14, fontFamily: FONT.regular, paddingHorizontal: 4 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, flexDirection: 'row', gap: 12 },
  body: { flex: 1, gap: 4 },
  lifted: { elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 20, fontFamily: FONT.regular, flex: 1 },
  meta: { fontSize: 14, fontFamily: FONT.regular },
  headerLeft: { marginRight: 24 },
  handle: { alignSelf: 'stretch', justifyContent: 'center', marginVertical: -14, paddingLeft: 4 },
  devices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
