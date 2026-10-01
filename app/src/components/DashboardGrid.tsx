// Griglia della dashboard. Le regole di posizionamento stanno in src/layout/bandLayout.ts:
// - telefono in verticale: griglia a 8 colonne (x, y, width, height dei widget sul server; cella alta 1,35 × larghezza);
// - schermi larghi: fasce di righe distribuite su più colonne affiancate.
// Con le schede la riga 0 è occupata dal widget Tabs (sostituito dalla barra delle schede) e viene nascosta.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { computeLayout } from '@/layout/bandLayout';
import type { Dashboard, Widget } from '@/model/profile';
import type { Palette } from '@/ui/theme';
import { WidgetCard } from './WidgetCard';

const GRID_PADDING = 4;
/** Spazio tra un widget e l'altro (metà per lato). */
const GAP = 4;

interface Props {
  dash: Dashboard;
  palette: Palette;
  /** Indice della scheda attiva, oppure undefined se la dashboard non ha schede. */
  tab?: number;
}

export function DashboardGrid({ dash, palette, tab }: Props) {
  const [width, setWidth] = useState(0);
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} onLayout={onLayout}>
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
              <WidgetCard dashId={dash.id} widget={p.item} palette={palette} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { alignItems: 'center', paddingVertical: GRID_PADDING, paddingBottom: 24 },
});
