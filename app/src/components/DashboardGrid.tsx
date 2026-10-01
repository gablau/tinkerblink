// Griglia della dashboard:
// - 8 colonne (x, y, width, height dei widget sul server): larghezza cella = larghezza disponibile / 8;
// - dashboard che scorre in verticale: altezza cella = larghezza cella × 1,35;
// - con le schede la riga 0 è occupata dal widget Tabs (sostituito dalla barra delle schede),
//   quindi la si nasconde spostando tutto su di una riga.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { Dashboard, Widget } from '@/model/profile';
import type { Palette } from '@/ui/theme';
import { WidgetCard } from './WidgetCard';

export const GRID_COLUMNS = 8;
export const CELL_ASPECT = 1.35;
/** Sul web/tablet la griglia non si allarga oltre questa misura, come su un telefono grande. */
const MAX_GRID_WIDTH = 640;
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
  const rowOffset = hasTabs ? 1 : 0;

  const widgets = useMemo<Widget[]>(
    () => dash.widgets.filter((w) => w.type !== 'TABS' && (!hasTabs || (w.tabId ?? 0) === tab)),
    [dash, hasTabs, tab],
  );

  const gridWidth = Math.min(width, MAX_GRID_WIDTH) - GRID_PADDING * 2;
  const cellW = gridWidth / GRID_COLUMNS;
  const cellH = cellW * CELL_ASPECT;
  const rows = widgets.reduce((max, w) => Math.max(max, w.y + w.height - rowOffset), 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} onLayout={onLayout}>
      {width > 0 && (
        <View style={{ width: gridWidth, height: rows * cellH }}>
          {widgets.map((w) => (
            <View
              key={w.id}
              style={{
                position: 'absolute',
                left: w.x * cellW + GAP / 2,
                top: (w.y - rowOffset) * cellH + GAP / 2,
                width: w.width * cellW - GAP,
                height: w.height * cellH - GAP,
              }}
            >
              <WidgetCard dashId={dash.id} widget={w} palette={palette} />
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
