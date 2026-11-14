// Edit layer on top of the dashboard grid (editor phase 2: layout).
// - Tapping a widget selects it (solid border, corner handle, settings button).
// - Selected widget: dragging it moves it, dragging the handle resizes it.
// - It can also be dropped over other widgets: the ones in the way move down (cascading reflow), and
//   while dragging the grid already shows the result (onPreview); a highlighted box shows where the widget
//   will land. It turns red only when it goes outside the 8 columns.
// - On release onLayout is called with the new position and the pushed widgets (saved with UPDATE_WIDGET).
// - With the finger near the top or bottom edge the dashboard scrolls by itself (autoScroll.ts) and the widget
//   follows it.
// Occupied positions are not rejected: making room does not require moving one widget
// at a time.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import type { Widget } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { withAlpha } from '@/widgets/color';
import { inBounds, reflow, sameGrid, sizeLimits, type Rect } from './layoutRules';
import type { AutoScroller } from './autoScroll';
import { te } from './strings';

const INSET = 2;
const HANDLE = 28;
const INVALID = '#D3435C';

export type Moves = Map<number, Rect>;

interface Props {
  /** Widgets of the tab as they should be shown (with the push preview). */
  widgets: Widget[];
  cellW: number;
  cellH: number;
  /** First visible row (1 with tabs: row 0 belongs to the Tabs widget). */
  rowOffset: number;
  hasTabs: boolean;
  /** All widgets of the dashboard without preview: base of the calculations (unchanged during the gesture). */
  allWidgets: Widget[];
  theme: DashboardTheme;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onSettings: (w: Widget) => void;
  onLayout: (w: Widget, rect: Rect, moves: Moves) => void;
  /** Preview during the gesture: new positions of the pushed widgets (null = none). */
  onPreview: (moves: Moves | null) => void;
  lockScroll: (locked: boolean) => void;
  /** Automatic scrolling near the edges during the gesture. */
  scroller: AutoScroller;
}

export function EditLayer(props: Props) {
  const { widgets, allWidgets, cellW, cellH, rowOffset, theme, selectedId, onSelect } = props;
  const box = (r: Rect) => ({
    left: r.x * cellW + INSET,
    top: (r.y - rowOffset) * cellH + INSET,
    width: r.width * cellW - INSET * 2,
    height: r.height * cellH - INSET * 2,
  });
  const selected = selectedId === null ? undefined : allWidgets.find((w) => w.id === selectedId);
  return (
    <>
      {widgets.map((w) =>
        w.id === selectedId ? null : (
          <Pressable
            key={w.id}
            onPress={() => onSelect(w.id)}
            style={({ pressed }) => [
              styles.box,
              box(w),
              { borderColor: theme.accent, backgroundColor: pressed ? withAlpha(theme.accent, 0.25) : withAlpha(theme.background, 0.35) },
            ]}
          />
        ),
      )}
      {selected && widgets.some((w) => w.id === selected.id) && <SelectedBox key={selected.id} widget={selected} box={box} {...props} />}
    </>
  );
}

/** Target rectangle on the grid for a move or a resize by (dx, dy) pixels. */
function targetOf(
  l: { widget: Widget; limits: { min: [number, number]; max: [number, number] }; cellW: number; cellH: number },
  g: { mode: 'move' | 'resize'; dx: number; dy: number },
): Rect {
  const { widget, limits, cellW, cellH } = l;
  if (g.mode === 'move') {
    return { x: widget.x + Math.round(g.dx / cellW), y: widget.y + Math.round(g.dy / cellH), width: widget.width, height: widget.height };
  }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    x: widget.x,
    y: widget.y,
    width: clamp(widget.width + Math.round(g.dx / cellW), limits.min[0], limits.max[0]),
    height: clamp(widget.height + Math.round(g.dy / cellH), limits.min[1], limits.max[1]),
  };
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

type Gesture = { mode: 'move' | 'resize'; dx: number; dy: number } | null;

function SelectedBox({
  widget,
  box,
  cellW,
  cellH,
  rowOffset,
  hasTabs,
  allWidgets,
  theme,
  onSettings,
  onLayout,
  onPreview,
  lockScroll,
  scroller,
}: Props & { widget: Widget; box: (r: Rect) => { left: number; top: number; width: number; height: number } }) {
  const [gesture, setGesture] = useState<Gesture>(null);
  const [move] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const limits = sizeLimits(widget);
  const others = useMemo(() => sameGrid(allWidgets, widget, hasTabs), [allWidgets, widget, hasTabs]);

  // PanResponder (with its internal dx/dy) is recreated only when widgets, grid or callbacks change: during
  // the gesture only the `gesture` state and the preview change, and they are not among these dependencies.
  const responders = useMemo(() => {
    const target = (mode: 'move' | 'resize', dx: number, dy: number) =>
      targetOf({ widget, limits: sizeLimits(widget), cellW, cellH }, { mode, dx, dy });
    const make = (mode: 'move' | 'resize') => {
      // Last movement of the finger on the screen; automatic scrolling is added vertically.
      let fingerDx = 0;
      let fingerDy = 0;
      let stopTicks: (() => void) | null = null;
      const update = () => {
        const dy = fingerDy + scroller.offset();
        if (mode === 'move') move.setValue({ x: fingerDx, y: dy });
        setGesture({ mode, dx: fingerDx, dy });
        // Push preview (the grid applies it only if the positions really change).
        const t = target(mode, fingerDx, dy);
        onPreview(inBounds(t, rowOffset) && !sameRect(t, widget) ? reflow(others, t) : null);
      };
      const finish = () => {
        stopTicks?.();
        stopTicks = null;
        scroller.end();
        lockScroll(false);
        move.setValue({ x: 0, y: 0 });
        setGesture(null);
        onPreview(null);
      };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          fingerDx = 0;
          fingerDy = 0;
          lockScroll(true);
          scroller.begin();
          stopTicks = scroller.onTick(update);
          setGesture({ mode, dx: 0, dy: 0 });
        },
        onPanResponderMove: (_, g) => {
          fingerDx = g.dx;
          fingerDy = g.dy;
          scroller.drag(g.moveY);
          update();
        },
        onPanResponderRelease: (_, g) => {
          const dy = g.dy + scroller.offset();
          finish();
          const t = target(mode, g.dx, dy);
          if (!sameRect(t, widget) && inBounds(t, rowOffset)) onLayout(widget, t, reflow(others, t));
        },
        onPanResponderTerminate: finish,
      });
    };
    return { move: make('move'), resize: make('resize') };
  }, [widget, others, cellW, cellH, rowOffset, onLayout, onPreview, lockScroll, move, scroller]);

  const target = gesture ? targetOf({ widget, limits, cellW, cellH }, gesture) : null;
  const valid = target ? inBounds(target, rowOffset) : true;
  const current = box(widget);
  const resized = gesture?.mode === 'resize' && target ? box(target) : current;
  const dropColor = valid ? theme.accent : INVALID;

  return (
    <>
      {/* Where the widget will land on release. */}
      {target && !sameRect(target, widget) && (
        <View
          pointerEvents="none"
          style={[styles.drop, box(target), { borderColor: dropColor, backgroundColor: withAlpha(dropColor, 0.3) }]}
        />
      )}
      <Animated.View
        {...responders.move.panHandlers}
        style={[
          styles.box,
          styles.selected,
          { left: current.left, top: current.top, width: resized.width, height: resized.height, borderColor: theme.accent },
          gesture?.mode === 'move' && { backgroundColor: withAlpha(theme.background, 0.6) },
          { transform: move.getTranslateTransform() },
        ]}
      >
        <Pressable
          onPress={() => onSettings(widget)}
          hitSlop={8}
          style={[styles.settings, { backgroundColor: theme.accent }]}
          accessibilityLabel={te.settings}
        >
          <MaterialCommunityIcons name="cog" size={18} color={theme.background} />
        </Pressable>
        <View {...responders.resize.panHandlers} style={[styles.handle, { backgroundColor: theme.accent }]} accessibilityLabel={te.resize}>
          <MaterialCommunityIcons name="resize-bottom-right" size={18} color={theme.background} />
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed', borderRadius: 2 },
  selected: { borderWidth: 2, borderStyle: 'solid', zIndex: 10 },
  drop: { position: 'absolute', borderWidth: 2, borderRadius: 4, zIndex: 5 },
  settings: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
