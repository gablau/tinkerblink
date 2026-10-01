// Dashboard: barra delle schede (se presenti) e griglia a 8 colonne.
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatusBanner } from '@/components/StatusBanner';
import type { TabsWidget } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { dashboardPalette } from '@/ui/theme';

export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const dash = profile?.dashBoards.find((d) => String(d.id) === id);
  const palette = dashboardPalette(dash?.theme);
  const [tab, setTab] = useState(0);

  if (!profile) return <Redirect href="/" />;
  if (!dash) return <Text style={{ padding: 16 }}>Dashboard non trovata</Text>;

  const tabsWidget = dash.widgets.find((w): w is TabsWidget => w.type === 'TABS');
  const tabs = tabsWidget?.tabs ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen options={{ title: dash.name }} />
      <StatusBanner />
      {tabs.length > 0 && (
        <ScrollView horizontal style={{ flexGrow: 0, backgroundColor: palette.card }} contentContainerStyle={styles.tabs}>
          {/* Nel JSON gli id delle schede valgono tutti 0: il tabId dei widget è la posizione della scheda. */}
          {tabs.map((t, i) => (
            <Pressable key={i} onPress={() => setTab(i)} style={[styles.tab, i === tab && { borderBottomColor: palette.accent }]}>
              <Text style={{ color: i === tab ? palette.text : palette.muted, fontWeight: '600' }}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <DashboardGrid dash={dash} palette={palette} tab={tabs.length > 0 ? tab : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
});
