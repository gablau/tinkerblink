// Dashboard: barra delle schede (se presenti) e griglia con i widget.
// Colori: tema della dashboard (Blynk / BlynkLight, enum Theme del server) e colori del widget Tabs.
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DashboardGrid } from '@/components/DashboardGrid';
import { DevicesButton, DevicesPanel } from '@/components/Devices';
import { StatusBanner } from '@/components/StatusBanner';
import type { TabsWidget } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { dashboardTheme } from '@/ui/dashboardTheme';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { widgetColor } from '@/widgets/color';

export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const dash = profile?.dashBoards.find((d) => String(d.id) === id);
  const theme = dashboardTheme(dash?.theme);
  const [tab, setTab] = useState(0);
  const [devicesOpen, setDevicesOpen] = useState(false);

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
          headerRight: () => <DevicesButton dash={dash} open={devicesOpen} onPress={() => setDevicesOpen((o) => !o)} />,
        }}
      />
      <StatusBanner />
      {devicesOpen && <DevicesPanel dash={dash} theme={theme} />}
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
      <DashboardGrid dash={dash} theme={theme} tab={tabs.length > 0 ? tab : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontFamily: FONT.medium, letterSpacing: 0.5 },
});
