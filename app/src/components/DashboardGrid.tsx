// Dashboard grid. The placement rules are in src/layout/bandLayout.ts:
// - phone in portrait: 8-column grid (x, y, width, height of the widgets on the server; cell height 1.35 × width);
// - wide screens: bands of rows spread over several side-by-side columns.
// With tabs, row 0 holds the Tabs widget (replaced by the tab bar) and is hidden.
//
// Edit mode (editor): always the 8-column grid in a single column, a few empty rows at the bottom to move
// widgets further down, and the edit layer (EditLayer) above the widgets. After a move the new position is
// shown at once (override) until the server confirms it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { AutoScroller } from '@/editor/autoScroll';
import { EditLayer, type Moves } from '@/editor/EditLayer';
import type { Rect } from '@/editor/layoutRules';
import { te } from '@/editor/strings';
import { CELL_ASPECT, GRID_COLUMNS, MAX_COLUMN_WIDTH, computeLayout } from '@/layout/bandLayout';
import { canControl, type Dashboard, type Widget } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { WidgetView } from '@/widgets/WidgetView';
import { ScrollLockContext } from './scrollLock';

const GRID_PADDING = 4;
/** Gap between widgets (half on each side). */
const GAP = 4;
/**
 * Widgets that send commands to the devices: in read-only assigned projects they are dimmed and do not respond
 * to touch (the server would reject the commands). Terminal and Table stay active for scrolling: their writes
 * are blocked by SessionManager.writePin.
 */
const CONTROL_TYPES = new Set([
  'BUTTON',
  'STYLED_BUTTON',
  'SLIDER',
  'VERTICAL_SLIDER',
  'STEP',
  'VERTICAL_STEP',
  'TIMER',
  'TWO_AXIS_JOYSTICK',
  'RGB',
  'MENU',
  'SEGMENTED_CONTROL',
  'TEXT_INPUT',
  'NUMBER_INPUT',
  'TIME_INPUT',
  'PLAYER',
]);
/** Empty rows added at the bottom in edit mode. */
const EDIT_EXTRA_ROWS = 4;

export interface GridEdit {
  /** Opens the widget settings. */
  onSettings: (w: Widget) => void;
  /** Saves the new position / size (UPDATE_WIDGET). */
  onLayout: (w: Widget, rect: Rect) => Promise<void>;
}

interface Props {
  dash: Dashboard;
  theme: DashboardTheme;
  /** Index of the active tab, or undefined if the dashboard has no tabs. */
  tab?: number;
  /** Edit mode: widgets do not respond; they are selected, moved and resized. */
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
  // While dragging, a preview arrives for every finger movement: update only when it changes.
  const setPreview = useCallback((next: Moves | null) => setPreviewState((prev) => (sameMoves(prev, next) ? prev : next)), []);
  const lockScroll = useCallback((locked: boolean) => setScrollEnabled(!locked), []);
  // Auto-scroll while dragging in the editor (receives the ScrollView position and size).
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
  // Base of the layout computations: profile + positions just saved and waiting for confirmation.
  const allWidgets = useMemo(() => dash.widgets.map((w) => (overrides[w.id] ? { ...w, ...overrides[w.id] } : w)), [dash, overrides]);
  // What is shown: in addition, the preview of the widgets pushed during a drag.
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
  const readOnly = !canControl(dash);
  const layout = useMemo(
    () => (width > 0 ? computeLayout(widgets, rowOffset, width - GRID_PADDING * 2, editing) : null),
    [widgets, rowOffset, width, editing],
  );
  const cellW = Math.min(width - GRID_PADDING * 2, MAX_COLUMN_WIDTH) / GRID_COLUMNS;
  const cellH = cellW * CELL_ASPECT;

  /** Saves the moved widget and the pushed ones (one at a time, UPDATE_WIDGET); the new positions show at once. */
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
              // Tap on the background: deselect.
              <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderRelease={() => setSelectedId(null)} />
            )}
            {layout.placed.map((p) => (
              <View
                key={p.item.id}
                pointerEvents={editing || (readOnly && CONTROL_TYPES.has(p.item.type)) ? 'none' : 'auto'}
                style={{
                  opacity: readOnly && CONTROL_TYPES.has(p.item.type) ? 0.45 : 1,
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
