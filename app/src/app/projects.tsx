// Project list. Projects can be pinned to the top and hidden; both are saved on this phone and changed in the organize
// mode (pencil in the top bar): pin and eye on each card, and the pinned ones are reordered by dragging them by their
// handle. Outside that mode the cards only open the projects; a label separates the pinned projects from the others
// and a row at the bottom shows or hides the hidden ones on the fly.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native';
import { ReorderList } from '@/components/ReorderList';
import { StatusBanner } from '@/components/StatusBanner';
import { t } from '@/i18n';
import { useProjectIds } from '@/project/listPrefs';
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
  /** Normal list: the card opens the project. */
  | { kind: 'normal' }
  /** Organize mode: eye (hide/show) and pin; pinned projects also have the drag handle. */
  | {
      kind: 'organize';
      pinned: boolean;
      hidden: boolean;
      onTogglePin: () => void;
      onToggleHidden: () => void;
      handle?: GestureResponderHandlers;
      dragging?: boolean;
    };

function ProjectRow({ dash, mode, palette }: { dash: Dashboard; mode: RowMode; palette: Palette }) {
  const lifted = mode.kind === 'organize' && mode.dragging === true;
  return (
    <Pressable
      disabled={mode.kind !== 'normal'}
      onPress={() => router.push({ pathname: '/dashboard/[id]', params: { id: String(dash.id) } })}
      style={[
        styles.row,
        { backgroundColor: palette.card, borderColor: lifted ? palette.accent : palette.border },
        lifted && styles.lifted,
      ]}
    >
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.name, { color: palette.text }]}>{dash.name}</Text>
          {dash.isActive === false && (
            <MaterialCommunityIcons name="stop-circle-outline" size={22} color={palette.danger} accessibilityLabel={t.notActive} />
          )}
          {mode.kind === 'organize' && (
            <Pressable onPress={mode.onToggleHidden} hitSlop={10} accessibilityLabel={mode.hidden ? t.showProject : t.hideProject}>
              <MaterialCommunityIcons
                name={mode.hidden ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={mode.hidden ? palette.muted : palette.text}
              />
            </Pressable>
          )}
          {mode.kind === 'organize' && (
            <Pressable onPress={mode.onTogglePin} hitSlop={10} accessibilityLabel={mode.pinned ? t.unpinProject : t.pinProject}>
              <MaterialCommunityIcons name={mode.pinned ? 'pin' : 'pin-outline'} size={22} color={mode.pinned ? palette.accent : palette.muted} />
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
      {/* Handle in its own column, centered vertically: the whole right side of the card can be grabbed. The cards
          that cannot be dragged keep the space empty, so the icons stay aligned. */}
      {mode.kind === 'organize' &&
        (mode.handle ? (
          <View {...mode.handle} hitSlop={12} accessibilityLabel={t.dragProject} style={styles.handle}>
            <MaterialCommunityIcons name="drag-vertical" size={32} color={palette.text} />
          </View>
        ) : (
          <View style={styles.handle} />
        ))}
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
  const [pinnedIds, setPinnedIds] = useProjectIds('pinned', account);
  const [hiddenIds, setHiddenIds] = useProjectIds('hidden', account);
  const [organizing, setOrganizing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  if (!profile) return <Redirect href="/" />;

  // Pinned projects first, in their order; then the others in the order of the server.
  const byId = new Map(profile.dashBoards.map((d) => [d.id, d]));
  const pinned = (pinnedIds ?? []).flatMap((id) => byId.get(id) ?? []);
  const pinnedSet = new Set(pinned.map((d) => d.id));
  const others = profile.dashBoards.filter((d) => !pinnedSet.has(d.id));
  const hiddenSet = new Set((hiddenIds ?? []).filter((id) => byId.has(id)));
  const hiddenList = [...pinned, ...others].filter((d) => hiddenSet.has(d.id));
  const toggle = (ids: Set<number>, id: number) => (ids.has(id) ? [...ids].filter((x) => x !== id) : [...ids, id]);
  const togglePin = (id: number) => setPinnedIds(toggle(pinnedSet, id));
  const toggleHidden = (id: number) => setHiddenIds(toggle(hiddenSet, id));
  const ready = !restoring && ((pinnedIds !== undefined && hiddenIds !== undefined) || account === undefined);

  const row = (d: Dashboard, mode: RowMode) => <ProjectRow key={d.id} dash={d} mode={mode} palette={palette} />;
  const organize = (d: Dashboard, handle?: GestureResponderHandlers, lifted?: boolean): RowMode => ({
    kind: 'organize',
    pinned: pinnedSet.has(d.id),
    hidden: hiddenSet.has(d.id),
    onTogglePin: () => togglePin(d.id),
    onToggleHidden: () => toggleHidden(d.id),
    handle,
    dragging: lifted,
  });
  /** Label between the pinned projects and the others, only when there are both. */
  const othersLabel = (pinnedCount: number, othersCount: number) =>
    pinnedCount > 0 && othersCount > 0 && <Text style={[styles.hint, styles.sectionLabel, { color: palette.muted }]}>{t.otherProjects}</Text>;
  const visiblePinned = pinned.filter((d) => !hiddenSet.has(d.id));
  const visibleOthers = others.filter((d) => !hiddenSet.has(d.id));

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
              <Pressable onPress={() => setOrganizing(!organizing)} hitSlop={8} accessibilityLabel={organizing ? t.organizeDone : t.organize}>
                <MaterialCommunityIcons name={organizing ? 'check' : 'pencil'} size={24} color="#1D1E22" />
              </Pressable>
              {!organizing && (
                <Pressable onPress={() => router.push('/project/new')} hitSlop={8} accessibilityLabel={tp.newProject}>
                  <MaterialCommunityIcons name="plus" size={26} color="#1D1E22" />
                </Pressable>
              )}
              {!organizing && (
                <Pressable onPress={() => router.push('/credits')} hitSlop={8} accessibilityLabel={t.credits}>
                  <MaterialCommunityIcons name="information-outline" size={24} color="#1D1E22" />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <StatusBanner />
      {ready && organizing && (
        // Every project, hidden ones included (dimmed): eye on each card, handle on the pinned ones.
        <ScrollView contentContainerStyle={styles.list} scrollEnabled={!dragging}>
          <Text style={[styles.hint, { color: palette.muted }]}>{t.organizeHint}</Text>
          <ReorderList
            items={pinned}
            keyOf={(d) => String(d.id)}
            gap={GAP}
            onDragChange={setDragging}
            onReorder={(list) => setPinnedIds(list.map((d) => d.id))}
            renderItem={(d, handle, lifted) => row(d, organize(d, handle, lifted))}
          />
          {othersLabel(pinned.length, others.length)}
          {others.map((d) => row(d, organize(d)))}
        </ScrollView>
      )}
      {ready && !organizing && (
        <ScrollView contentContainerStyle={styles.list}>
          {visiblePinned.map((d) => row(d, { kind: 'normal' }))}
          {othersLabel(visiblePinned.length, visibleOthers.length)}
          {visibleOthers.map((d) => row(d, { kind: 'normal' }))}
          {hiddenList.length > 0 && (
            <Pressable onPress={() => setShowHidden(!showHidden)} hitSlop={6} style={styles.hiddenToggle} accessibilityRole="button">
              <Text style={[styles.hint, { color: palette.muted }]}>{t.hiddenCount(hiddenList.length)}</Text>
              <MaterialCommunityIcons name={showHidden ? 'chevron-up' : 'chevron-down'} size={22} color={palette.muted} />
            </Pressable>
          )}
          {showHidden && hiddenList.map((d) => row(d, { kind: 'normal' }))}
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
  sectionLabel: { textAlign: 'center', paddingVertical: 8 },
  hiddenToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, flexDirection: 'row', gap: 12 },
  body: { flex: 1, gap: 4 },
  lifted: { elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 20, fontFamily: FONT.regular, flex: 1 },
  meta: { fontSize: 14, fontFamily: FONT.regular },
  headerLeft: { marginRight: 24 },
  handle: { alignSelf: 'stretch', justifyContent: 'center', marginVertical: -14, paddingLeft: 4, width: 36 },
  devices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
