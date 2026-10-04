// Dashboard: barra delle schede (se presenti) e griglia con i widget.
// Colori: tema della dashboard (Blynk / BlynkLight, enum Theme del server) e colori del widget Tabs.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DashboardGrid, type GridEdit } from '@/components/DashboardGrid';
import { DevicesButton, DevicesPanel } from '@/components/Devices';
import { StatusBanner } from '@/components/StatusBanner';
import { isEditableDash } from '@/editor/policy';
import { te } from '@/editor/strings';
import { WidgetBox } from '@/editor/WidgetBox';
import type { TabsWidget } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { dashboardTheme } from '@/ui/dashboardTheme';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { widgetColor } from '@/widgets/color';

export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, updateWidget } = useSession();
  const dash = profile?.dashBoards.find((d) => String(d.id) === id);
  const theme = dashboardTheme(dash?.theme);
  const [tab, setTab] = useState(0);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const router = useRouter();
  const editable = dash !== undefined && isEditableDash(dash.id);
  // Stabile durante i gesti di spostamento: la griglia ricrea i gestori quando cambiano le callback.
  const gridEdit = useMemo<GridEdit | undefined>(
    () =>
      editing
        ? {
            onSettings: (w) => router.push(`/edit/${id}/${w.id}`),
            onLayout: (w, rect) => updateWidget(Number(id), { ...w, ...rect }),
          }
        : undefined,
    [editing, id, router, updateWidget],
  );

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
                <Pressable onPress={() => setBoxOpen(true)} hitSlop={10} accessibilityLabel={te.addWidget}>
                  <MaterialCommunityIcons name="plus" size={26} color="#1D1E22" />
                </Pressable>
              )}
              {editable && (
                <Pressable onPress={() => setEditing((e) => !e)} hitSlop={10} accessibilityLabel={editing ? te.done : te.edit}>
                  <MaterialCommunityIcons name={editing ? 'check' : 'pencil'} size={24} color="#1D1E22" />
                </Pressable>
              )}
              <DevicesButton dash={dash} open={devicesOpen} onPress={() => setDevicesOpen((o) => !o)} />
            </View>
          ),
        }}
      />
      <StatusBanner />
      {editing && (
        <Text style={[styles.editHint, { color: theme.background, backgroundColor: theme.accent }]}>{te.editHint}</Text>
      )}
      {devicesOpen && <DevicesPanel dash={dash} theme={theme} />}
      {boxOpen && <WidgetBox dash={dash} tab={tabs.length > 0 ? tab : undefined} theme={theme} onClose={() => setBoxOpen(false)} />}
      {tabs.length > 0 && (
        <ScrollView horizontal style={{ flexGrow: 0, backgroundColor: tabBg }} contentContainerStyle={styles.tabs}>
          {/* Nel JSON gli id delle schede valgono tutti 0: il tabId dei widget è la posizione della scheda. */}
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
