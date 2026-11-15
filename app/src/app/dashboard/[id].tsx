// Dashboard: tab bar (if any) and the widget grid.
// Colors: dashboard theme (Blynk / BlynkLight, server Theme enum) and colors of the Tabs widget.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DashboardGrid, type GridEdit } from '@/components/DashboardGrid';
import { DevicesButton, DevicesPanel } from '@/components/Devices';
import { StatusBanner } from '@/components/StatusBanner';
import { isEditableDash } from '@/editor/policy';
import { te } from '@/editor/strings';
import { WidgetBox } from '@/editor/WidgetBox';
import { tp } from '@/project/strings';
import type { TabsWidget } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { dashboardTheme } from '@/ui/dashboardTheme';
import { dashboardPalette } from '@/ui/theme';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { widgetColor } from '@/widgets/color';

export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, updateWidget, editableDashIds, setDashActive, showNotice } = useSession();
  const dash = profile?.dashBoards.find((d) => String(d.id) === id);
  const theme = dashboardTheme(dash?.theme);
  const [tab, setTab] = useState(0);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [editRequested, setEditing] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const router = useRouter();
  const editable = dash !== undefined && isEditableDash(dash.id, editableDashIds);
  // "Keep screen always on" of the project: while this dashboard is open (also under its settings).
  const keepOn = dash?.keepScreenOn === true;
  useEffect(() => {
    if (!keepOn) return;
    const tag = `dashboard-${id}`;
    void activateKeepAwakeAsync(tag).catch(() => undefined);
    return () => void deactivateKeepAwake(tag).catch(() => undefined);
  }, [keepOn, id]);
  // Editing only while the project is stopped. Starting it (also from the settings) ends editing.
  const stopped = dash?.isActive === false;
  const editing = editRequested && editable && stopped;
  // Stable during move gestures: the grid recreates its handlers when the callbacks change.
  // Stable callbacks during gestures: if the object changed on every render, the grid would recreate the
  // PanResponders mid-drag and the gesture would break. `editing` stays out of the dependencies.
  const editActions = useMemo<GridEdit>(
    () => ({
      onSettings: (w) => router.push(`/edit/${id}/${w.id}`),
      onLayout: (w, rect) => updateWidget(Number(id), { ...w, ...rect }),
    }),
    [id, router, updateWidget],
  );
  const gridEdit = editing ? editActions : undefined;

  if (!profile) return <Redirect href="/" />;
  if (!dash) return <Text style={{ padding: 16 }}>{t.dashboardNotFound}</Text>;

  const tabsWidget = dash.widgets.find((w): w is TabsWidget => w.type === 'TABS');
  const tabs = tabsWidget?.tabs ?? [];
  const tabBg = widgetColor(tabsWidget?.color, theme);
  const tabText = widgetColor(tabsWidget?.textColor, theme);
  const tabActive = widgetColor(tabsWidget?.activeTxtColor, theme);
  const tabUnderline = widgetColor(tabsWidget?.underlineColor, theme);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: dash.name,
          headerRight: () => (
            <View style={styles.headerRight}>
              {editing && (
                <Pressable onPress={() => router.push(`/project/${id}`)} hitSlop={10} accessibilityLabel={tp.projectSettings}>
                  <MaterialCommunityIcons name="cog-outline" size={24} color="#1D1E22" />
                </Pressable>
              )}
              {editing && (
                <Pressable onPress={() => setBoxOpen(true)} hitSlop={10} accessibilityLabel={te.addWidget}>
                  <MaterialCommunityIcons name="plus" size={26} color="#1D1E22" />
                </Pressable>
              )}
              {/* Pencil (or "done") only while the project is stopped; while running only start/stop and devices.
                  While editing start/stop disappears: "done" goes back to the normal view. */}
              {editable && stopped && (
                <Pressable onPress={() => setEditing(!editing)} hitSlop={10} accessibilityLabel={editing ? te.done : te.edit}>
                  <MaterialCommunityIcons name={editing ? 'check' : 'pencil'} size={24} color="#1D1E22" />
                </Pressable>
              )}
              {editable && !editing && (
                <Pressable
                  onPress={() => {
                    setDashActive(dash.id, stopped)
                      .then((devicesOnline) => {
                        if (!devicesOnline) showNotice(tp.noDeviceOnline);
                      })
                      .catch((e: unknown) => showNotice(e instanceof Error ? e.message : String(e)));
                  }}
                  hitSlop={10}
                  accessibilityLabel={stopped ? tp.play : tp.stop}
                >
                  <MaterialCommunityIcons name={stopped ? 'play' : 'stop'} size={26} color="#1D1E22" />
                </Pressable>
              )}
              <DevicesButton dash={dash} open={devicesOpen} onPress={() => setDevicesOpen((o) => !o)} />
            </View>
          ),
        }}
      />
      <StatusBanner color={dashboardPalette(dash?.theme).danger} />
      {editing && (
        <Text style={[styles.editHint, { color: theme.background, backgroundColor: theme.accent }]}>{te.editHint}</Text>
      )}
      {devicesOpen && <DevicesPanel dash={dash} theme={theme} />}
      {boxOpen && <WidgetBox dash={dash} tab={tabs.length > 0 ? tab : undefined} theme={theme} onClose={() => setBoxOpen(false)} />}
      {tabs.length > 0 && (
        <ScrollView horizontal style={{ flexGrow: 0, backgroundColor: tabBg }} contentContainerStyle={styles.tabs}>
          {/* In the JSON all tab ids are 0: the tabId of a widget is the position of its tab. */}
          {tabs.map((t, i) => (
            <Pressable key={i} onPress={() => setTab(i)} style={[styles.tab, i === tab && { borderBottomColor: tabUnderline }]}>
              <Text style={[styles.tabText, { color: i === tab ? tabActive : tabText }]}>{t.label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <DashboardGrid
        dash={dash}
        theme={theme}
        tab={tabs.length > 0 ? tab : undefined}
        edit={gridEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontFamily: FONT.medium, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  editHint: { textAlign: 'center', paddingVertical: 6, fontSize: 13, fontFamily: FONT.medium },
});
