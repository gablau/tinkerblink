// Vertical list whose items can be dragged to a new position by a handle (pinned projects). Items may have different
// heights: their positions come from onLayout. While dragging, the item follows the finger and the others move aside
// to show where it will land; the new order is applied when the finger lifts.
// The PanResponders depend only on the number of items and read the rest from a Session object updated after every
// render: recreating them mid-drag (every render) would break the gesture.
import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { PanResponder, View, type GestureResponderHandlers } from 'react-native';

/** from → to: positions in the list; dy: finger movement; h: height of the dragged item. */
type Drag = { from: number; to: number; dy: number; h: number };
type Layout = { y: number; h: number };

/** Position where the dragged item lands: past every item whose middle its middle has crossed. */
function landing(layouts: readonly (Layout | undefined)[], from: number, dy: number): number {
  const me = layouts[from];
  if (!me) return from;
  const middle = me.y + me.h / 2 + dy;
  const crossed = (j: number, after: boolean) => {
    const l = layouts[j];
    return l !== undefined && (after ? middle > l.y + l.h / 2 : middle < l.y + l.h / 2);
  };
  let to = from;
  for (let j = from + 1; j < layouts.length; j++) if (crossed(j, true)) to = j;
  for (let j = from - 1; j >= 0; j--) if (crossed(j, false)) to = j;
  return to;
}

/** Mutable part of the list, read by the gesture handlers (outside render). */
class Session<T> {
  layouts: (Layout | undefined)[] = [];
  items: readonly T[] = [];
  drag: Drag | null = null;
  onReorder: (items: T[]) => void = () => {};
  onDragChange?: (dragging: boolean) => void;

  sync(items: readonly T[], drag: Drag | null, onReorder: (items: T[]) => void, onDragChange?: (dragging: boolean) => void) {
    this.items = items;
    this.drag = drag;
    this.onReorder = onReorder;
    this.onDragChange = onDragChange;
  }

  measured(index: number, layout: Layout) {
    this.layouts[index] = layout;
  }

  /** Applies the new order at the end of a drag. */
  finish() {
    const d = this.drag;
    this.onDragChange?.(false);
    if (!d || d.to === d.from) return;
    const next = [...this.items];
    const [moved] = next.splice(d.from, 1);
    next.splice(d.to, 0, moved!);
    this.onReorder(next);
  }
}

export function ReorderList<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
  onDragChange,
  gap = 0,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** handle: to spread on the view used to drag the item; dragging: this item is being dragged. */
  renderItem: (item: T, handle: GestureResponderHandlers, dragging: boolean) => ReactNode;
  onReorder: (items: T[]) => void;
  /** True while an item is dragged (to lock the scrolling of the container). */
  onDragChange?: (dragging: boolean) => void;
  gap?: number;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [session] = useState(() => new Session<T>());
  useLayoutEffect(() => session.sync(items, drag, onReorder, onDragChange));

  const count = items.length;
  const handles = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const finish = () => {
          session.finish();
          setDrag(null);
        };
        return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onShouldBlockNativeResponder: () => true,
          onPanResponderGrant: () => {
            session.onDragChange?.(true);
            setDrag({ from: index, to: index, dy: 0, h: session.layouts[index]?.h ?? 0 });
          },
          onPanResponderMove: (_, g) =>
            setDrag((d) => d && { ...d, to: landing(session.layouts.slice(0, count), index, g.dy), dy: g.dy }),
          onPanResponderRelease: finish,
          onPanResponderTerminate: finish,
        }).panHandlers;
      }),
    [session, count],
  );

  /** Vertical shift of an item while another one is dragged. */
  const shift = (index: number) => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    const space = drag.h + gap;
    if (drag.to > drag.from && index > drag.from && index <= drag.to) return -space;
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return space;
    return 0;
  };

  return (
    <View style={{ gap }}>
      {items.map((item, index) => {
        const dragging = drag?.from === index;
        return (
          <View
            key={keyOf(item)}
            onLayout={(e) => session.measured(index, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
            style={{ transform: [{ translateY: shift(index) }], zIndex: dragging ? 1 : 0 }}
          >
            {handles[index] && renderItem(item, handles[index], dragging)}
          </View>
        );
      })}
    </View>
  );
}
