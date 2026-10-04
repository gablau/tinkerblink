// Griglia della dashboard. Le regole di posizionamento stanno in src/layout/bandLayout.ts:
// - telefono in verticale: griglia a 8 colonne (x, y, width, height dei widget sul server; cella alta 1,35 × larghezza);
// - schermi larghi: fasce di righe distribuite su più colonne affiancate.
// Con le schede la riga 0 è occupata dal widget Tabs (sostituito dalla barra delle schede) e viene nascosta.
//
// Modalità modifica (editor, fase 2): sempre griglia a 8 colonne su una colonna, qualche riga vuota in fondo per
// poter spostare i widget più in basso, e sopra i widget il livello di modifica (EditLayer). Dopo uno
// spostamento la nuova posizione si mostra subito (override) finché il server non conferma.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { AutoScroller } from '@/editor/autoScroll';
import { EditLayer, type Moves } from '@/editor/EditLayer';
import type { Rect } from '@/editor/layoutRules';
import { te } from '@/editor/strings';
import { CELL_ASPECT, GRID_COLUMNS, MAX_COLUMN_WIDTH, computeLayout } from '@/layout/bandLayout';
import type { Dashboard, Widget } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { WidgetView } from '@/widgets/WidgetView';
import { ScrollLockContext } from './scrollLock';

const GRID_PADDING = 4;
/** Spazio tra un widget e l'altro (metà per lato). */
const GAP = 4;
/** Righe vuote aggiunte in fondo in modalità modifica. */
const EDIT_EXTRA_ROWS = 4;

export interface GridEdit {
  /** Apre le impostazioni del widget. */
  onSettings: (w: Widget) => void;
  /** Salva la nuova posizione / dimensione (UPDATE_WIDGET). */
  onLayout: (w: Widget, rect: Rect) => Promise<void>;
}

interface Props {
  dash: Dashboard;
  theme: DashboardTheme;
  /** Indice della scheda attiva, oppure undefined se la dashboard non ha schede. */
  tab?: number;
  /** Modalità modifica: i widget non rispondono, si selezionano, spostano e ridimensionano. */
  edit?: GridEdit;
}

function sameMoves(a: Moves | null, b: Moves | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const [id, r] of a) {
    const o = b.get(id);
    if (!o || o.x !== r.x || o.y !== r.y || o.width !== r.width || o.height !== r.height) return false;
  }
  return true;
}

export function DashboardGrid({ dash, theme, tab, edit }: Props) {
  const [width, setWidth] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Rect>>({});
  const [preview, setPreviewState] = useState<Moves | null>(null);
  // Durante il trascinamento arriva un'anteprima per ogni movimento del dito: si aggiorna solo se cambia.
  const setPreview = useCallback((next: Moves | null) => setPreviewState((prev) => (sameMoves(prev, next) ? prev : next)), []);
  const lockScroll = useCallback((locked: boolean) => setScrollEnabled(!locked), []);
  // Scorrimento automatico durante i trascinamenti dell'editor (riceve posizione e misure dello ScrollView).
  const scrollRef = useRef<ScrollView>(null);
  const [scroller] = useState(() => new AutoScroller());
  useEffect(() => {
    scroller.attach(scrollRef.current);
    return () => {
      scroller.end();
      scroller.attach(null);
    };
  }, [scroller]);
  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    scroller.setViewHeight(e.nativeEvent.layout.height);
  };

  const hasTabs = tab !== undefined;
  const rowOffset = hasTabs ? 1 : 0;
  // Base dei calcoli del layout: profilo + posizioni appena salvate in attesa di conferma.
  const allWidgets = useMemo(() => dash.widgets.map((w) => (overrides[w.id] ? { ...w, ...overrides[w.id] } : w)), [dash, overrides]);
  // Come si mostrano: in più l'anteprima dei widget spinti durante un trascinamento.
  const shown = useMemo(
    () =>
      preview
        ? allWidgets.map((w) => {
            const r = preview.get(w.id);
            return r ? { ...w, ...r } : w;
          })
        : allWidgets,
    [allWidgets, preview],
  );
  const widgets = useMemo<Widget[]>(
    () => shown.filter((w) => w.type !== 'TABS' && (!hasTabs || (w.tabId ?? 0) === tab)),
    [shown, hasTabs, tab],
  );
  const editing = edit !== undefined;
  const layout = useMemo(
    () => (width > 0 ? computeLayout(widgets, rowOffset, width - GRID_PADDING * 2, editing) : null),
    [widgets, rowOffset, width, editing],
  );
  const cellW = Math.min(width - GRID_PADDING * 2, MAX_COLUMN_WIDTH) / GRID_COLUMNS;
  const cellH = cellW * CELL_ASPECT;

  /** Salva il widget spostato e quelli spinti (uno alla volta, UPDATE_WIDGET); le nuove posizioni si vedono subito. */
  const saveLayout = useCallback(
    (w: Widget, rect: Rect, moves: Moves) => {
      if (!edit) return;
      const all: [number, Rect][] = [[w.id, rect], ...moves];
      setOverrides((o) => ({ ...o, ...Object.fromEntries(all) }));
      const run = async () => {
        for (const [id, r] of all) {
          const before = dash.widgets.find((x) => x.id === id);
          if (before) await edit.onLayout(before, r);
        }
      };
      run()
        .catch((e: unknown) => Alert.alert(te.saveError, e instanceof Error ? e.message : String(e)))
        .finally(() =>
          setOverrides((o) => {
            const next = { ...o };
            for (const [id] of all) delete next[id];
            return next;
          }),
        );
    },
    [edit, dash],
  );

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      onLayout={onLayout}
      scrollEnabled={scrollEnabled}
      ref={scrollRef}
      onScroll={(e) => scroller.setScrollY(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      onContentSizeChange={(_w, h) => scroller.setContentHeight(h)}
    >
      <ScrollLockContext.Provider value={lockScroll}>
        {layout && (
          <View style={{ width: layout.width, height: layout.height + (editing ? EDIT_EXTRA_ROWS * cellH : 0) }}>
            {editing && (
              // Tocco sullo sfondo: deseleziona.
              <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderRelease={() => setSelectedId(null)} />
            )}
            {layout.placed.map((p) => (
              <View
                key={p.item.id}
                pointerEvents={editing ? 'none' : 'auto'}
                style={{
                  position: 'absolute',
                  left: p.left + GAP / 2,
                  top: p.top + GAP / 2,
                  width: p.width - GAP,
                  height: p.height - GAP,
                }}
              >
                <WidgetView dashId={dash.id} widget={p.item} theme={theme} />
              </View>
            ))}
            {edit && (
              <EditLayer
                widgets={widgets}
                cellW={cellW}
                cellH={cellH}
                rowOffset={rowOffset}
                hasTabs={hasTabs}
                allWidgets={allWidgets}
                theme={theme}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onSettings={(w) => {
                  setSelectedId(null);
                  edit.onSettings(dash.widgets.find((x) => x.id === w.id) ?? w);
                }}
                onLayout={saveLayout}
                onPreview={setPreview}
                lockScroll={lockScroll}
                scroller={scroller}
              />
            )}
          </View>
        )}
      </ScrollLockContext.Provider>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { alignItems: 'center', paddingVertical: GRID_PADDING, paddingBottom: 24 },
});
