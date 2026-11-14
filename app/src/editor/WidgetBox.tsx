// "Widget Box" (editor phase 3): every widget that can be added, on one screen, split by group
// (Controllers, Displays, …), in a 3-column grid with icon and name. The "i" button opens the widget information,
// taken from the Blynk Legacy user documentation (MIT license, editor/widgetDocs.ts). Widgets allowed only once
// that are already present cannot be selected. The new widget goes in the first free spot of the active tab of
// the dashboard (the Tabs widget in row 0, pushing the others down) and is saved with CREATE_WIDGET. Energy is
// not shown: the server charges it anyway and, if there is not enough, replies with an error.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Dashboard } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';
import { CATALOG, isSingle, planNewWidget, type CatalogItem } from './catalog';
import { MiniMarkdown } from './MiniMarkdown';
import { te } from './strings';
import { WIDGET_DOCS } from './widgetDocs';
import { WidgetIcon } from './widgetIcons';

export function WidgetBox({
  dash,
  tab,
  theme,
  onClose,
}: {
  dash: Dashboard;
  tab: number | undefined;
  theme: DashboardTheme;
  onClose: () => void;
}) {
  const { createWidget, updateWidget } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<CatalogItem | null>(null);

  const add = async (type: string) => {
    setBusy(type);
    setError(null);
    try {
      const plan = planNewWidget(type, dash, tab, theme);
      // First make room (Tabs only), then create the widget.
      for (const [id, rect] of plan.moves) {
        const w = dash.widgets.find((x) => x.id === id);
        if (w) await updateWidget(dash.id, { ...w, ...rect });
      }
      await createWidget(dash.id, plan.widget);
      onClose();
    } catch (e) {
      setError(`${te.addError}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const card = theme.light ? '#FFFFFF' : '#2C2D32';
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color="#1D1E22" />
          </Pressable>
          <Text style={styles.headerTitle}>{te.widgetBox}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}
          {CATALOG.map((g) => (
            <View key={g.title} style={styles.group}>
              <Text style={[styles.groupTitle, { color: theme.accent }]}>{g.title.toUpperCase()}</Text>
              <View style={styles.grid}>
                {g.items.map((item) => {
                  const present = isSingle(item.type) && dash.widgets.some((w) => w.type === item.type);
                  const disabled = present || busy !== null;
                  return (
                    <Pressable
                      key={item.type}
                      disabled={disabled}
                      onPress={() => void add(item.type)}
                      style={({ pressed }) => [styles.item, { backgroundColor: card, opacity: present ? 0.45 : pressed ? 0.7 : 1 }]}
                    >
                      {busy === item.type ? (
                        <ActivityIndicator color={theme.accent} style={styles.icon} />
                      ) : (
                        <WidgetIcon type={item.type} size={34} color={theme.groupColors[g.key]} />
                      )}
                      <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {present && <Text style={[styles.reason, { color: withAlpha(theme.text, 0.6) }]}>{te.alreadyPresent}</Text>}
                      {WIDGET_DOCS[item.type] && (
                        <Pressable onPress={() => setInfo(item)} hitSlop={10} style={styles.infoButton} accessibilityLabel={te.info}>
                          <MaterialCommunityIcons name="information-outline" size={20} color={withAlpha(theme.text, 0.7)} />
                        </Pressable>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      {info && <InfoSheet item={info} theme={theme} onClose={() => setInfo(null)} />}
    </Modal>
  );
}

/** Widget information (Blynk Legacy user documentation, in English). */
function InfoSheet({ item, theme, onClose }: { item: CatalogItem; theme: DashboardTheme; onClose: () => void }) {
  const bg = theme.light ? '#FFFFFF' : '#2C2D32';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: bg }]} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <WidgetIcon type={item.type} size={36} color={theme.text} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{item.name}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <MiniMarkdown text={WIDGET_DOCS[item.type] ?? ''} color={theme.text} accent={theme.accent} />
            <Text style={[styles.source, { color: withAlpha(theme.text, 0.5) }]}>{te.docsSource}</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 14,
    backgroundColor: '#23C48E',
  },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: FONT.regular, color: '#1D1E22' },
  group: { marginBottom: 18, gap: 8 },
  groupTitle: { fontSize: 13, fontFamily: FONT.medium, letterSpacing: 1 },
  content: { padding: 12, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    width: '31.5%',
    minHeight: 96,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  icon: { height: 40 },
  name: { fontSize: 13, fontFamily: FONT.regular, textAlign: 'center' },
  reason: { fontSize: 12, fontFamily: FONT.regular },
  infoButton: { position: 'absolute', top: 4, right: 4 },
  error: { color: '#D3435C', fontFamily: FONT.regular, marginBottom: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 8, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center', overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  sheetTitle: { flex: 1, fontSize: 19, fontFamily: FONT.medium },
  sheetContent: { padding: 16, paddingTop: 4, paddingBottom: 24 },
  source: { fontSize: 11, fontFamily: FONT.regular, marginTop: 16 },
});
