// Griglia della dashboard. Le regole di posizionamento stanno in src/layout/bandLayout.ts:
// - telefono in verticale: griglia a 8 colonne (x, y, width, height dei widget sul server; cella alta 1,35 × larghezza);
// - schermi larghi: fasce di righe distribuite su più colonne affiancate.
// Con le schede la riga 0 è occupata dal widget Tabs (sostituito dalla barra delle schede) e viene nascosta.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { computeLayout } from '@/layout/bandLayout';
import type { Dashboard, Widget } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { withAlpha } from '@/widgets/color';
import { WidgetView } from '@/widgets/WidgetView';
import { ScrollLockContext } from './scrollLock';

const GRID_PADDING = 4;
/** Spazio tra un widget e l'altro (metà per lato). */
const GAP = 4;

interface Props {
  dash: Dashboard;
  theme: DashboardTheme;
  /** Indice della scheda attiva, oppure undefined se la dashboard non ha schede. */
  tab?: number;
  /** Modalità modifica: i widget non rispondono e un tocco apre le loro impostazioni. */
  onWidgetPress?: (w: Widget) => void;
}

export function DashboardGrid({ dash, theme, tab, onWidgetPress }: Props) {
  const [width, setWidth] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const lockScroll = useCallback((locked: boolean) => setScrollEnabled(!locked), []);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const hasTabs = tab !== undefined;
  const widgets = useMemo<Widget[]>(
    () => dash.widgets.filter((w) => w.type !== 'TABS' && (!hasTabs || (w.tabId ?? 0) === tab)),
    [dash, hasTabs, tab],
  );
  const layout = useMemo(
    () => (width > 0 ? computeLayout(widgets, hasTabs ? 1 : 0, width - GRID_PADDING * 2) : null),
    [widgets, hasTabs, width],
  );

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      onLayout={onLayout}
      scrollEnabled={scrollEnabled}
    >
      <ScrollLockContext.Provider value={lockScroll}>
      {layout && (
        <View style={{ width: layout.width, height: layout.height }}>
          {layout.placed.map((p) => (
            <View
              key={p.item.id}
              style={{
                position: 'absolute',
                left: p.left + GAP / 2,
                top: p.top + GAP / 2,
                width: p.width - GAP,
                height: p.height - GAP,
              }}
            >
              <WidgetView dashId={dash.id} widget={p.item} theme={theme} />
              {onWidgetPress && (
                <Pressable
                  onPress={() => onWidgetPress(p.item)}
                  style={({ pressed }) => [
                    StyleSheet.absoluteFill,
                    styles.editOverlay,
                    { borderColor: theme.accent, backgroundColor: pressed ? withAlpha(theme.accent, 0.25) : withAlpha(theme.background, 0.35) },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      )}
      </ScrollLockContext.Provider>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { alignItems: 'center', paddingVertical: GRID_PADDING, paddingBottom: 24 },
  editOverlay: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 2 },
});
