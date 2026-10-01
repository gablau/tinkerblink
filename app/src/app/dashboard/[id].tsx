// Dashboard (scheletro): widget in elenco, raggruppati per scheda, con valori in tempo reale.
// La griglia a 8 colonne arriva con l'MVP.
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBanner } from '@/components/StatusBanner';
import { WidgetCard } from '@/components/WidgetCard';
import type { TabsWidget, Widget } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { dashboardPalette } from '@/ui/theme';

export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const dash = profile?.dashBoards.find((d) => String(d.id) === id);
  const palette = dashboardPalette(dash?.theme);
  const [tab, setTab] = useState(0);

  const tabsWidget = dash?.widgets.find((w): w is TabsWidget => w.type === 'TABS');
  const tabs = tabsWidget?.tabs ?? [];
  const widgets = useMemo<Widget[]>(() => {
    if (!dash) return [];
    return dash.widgets
      .filter((w) => w.type !== 'TABS' && (tabs.length === 0 || (w.tabId ?? 0) === tab))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }, [dash, tab, tabs.length]);

  if (!profile) return <Redirect href="/" />;
  if (!dash) return <Text style={{ padding: 16 }}>Dashboard non trovata</Text>;

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
      <FlatList
        contentContainerStyle={styles.list}
        data={widgets}
        keyExtractor={(w) => String(w.id)}
        renderItem={({ item }) => <WidgetCard dashId={dash.id} widget={item} palette={palette} />}
        ListEmptyComponent={<Text style={{ color: palette.muted, padding: 16 }}>Nessun widget</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  list: { padding: 12, gap: 8 },
});
