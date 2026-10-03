// Livello di modifica sopra la griglia della dashboard (fase 2 dell'editor: layout).
// - Tocco su un widget: lo seleziona (bordo pieno, maniglia nell'angolo, pulsante delle impostazioni).
// - Widget selezionato: trascinandolo si sposta, trascinando la maniglia si ridimensiona.
// - Si può rilasciare anche sopra altri widget: quelli che occupano il posto scendono (reflow, a cascata) e
//   durante il trascinamento la griglia mostra già il risultato (onPreview); un riquadro evidenziato indica dove
//   finirà il widget. Rosso solo se si esce dalle 8 colonne.
// - Al rilascio si chiama onLayout con la nuova posizione e i widget spinti (salvataggio con UPDATE_WIDGET).
// Le posizioni occupate non vengono rifiutate: per fare spazio non serve spostare un widget
// alla volta.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import type { Widget } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { withAlpha } from '@/widgets/color';
import { inBounds, reflow, sameGrid, sizeLimits, type Rect } from './layoutRules';
import { te } from './strings';

const INSET = 2;
const HANDLE = 28;
const INVALID = '#D3435C';

export type Moves = Map<number, Rect>;

interface Props {
  /** Widget della scheda come vanno mostrati (con l'anteprima della spinta). */
  widgets: Widget[];
  cellW: number;
  cellH: number;
  /** Prima riga visibile (1 con le schede: la riga 0 è del widget Tabs). */
  rowOffset: number;
  hasTabs: boolean;
  /** Tutti i widget della dashboard senza anteprima: base dei calcoli (non cambia durante il gesto). */
  allWidgets: Widget[];
  theme: DashboardTheme;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onSettings: (w: Widget) => void;
  onLayout: (w: Widget, rect: Rect, moves: Moves) => void;
  /** Anteprima durante il gesto: nuove posizioni dei widget spinti (null = nessuna). */
  onPreview: (moves: Moves | null) => void;
  lockScroll: (locked: boolean) => void;
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

/** Rettangolo di arrivo sulla griglia per uno spostamento o un ridimensionamento di (dx, dy) pixel. */
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
}: Props & { widget: Widget; box: (r: Rect) => { left: number; top: number; width: number; height: number } }) {
  const [gesture, setGesture] = useState<Gesture>(null);
  const [move] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const limits = sizeLimits(widget);
  const others = useMemo(() => sameGrid(allWidgets, widget, hasTabs), [allWidgets, widget, hasTabs]);

  // PanResponder (con il suo dx/dy interno) ricreato solo quando cambiano widget, griglia o callback: durante
  // il gesto cambiano soltanto lo stato `gesture` e l'anteprima, che non toccano queste dipendenze.
  const responders = useMemo(() => {
    const finish = () => {
      lockScroll(false);
      move.setValue({ x: 0, y: 0 });
      setGesture(null);
      onPreview(null);
    };
    const target = (mode: 'move' | 'resize', dx: number, dy: number) =>
      targetOf({ widget, limits: sizeLimits(widget), cellW, cellH }, { mode, dx, dy });
    const make = (mode: 'move' | 'resize') =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lockScroll(true);
          setGesture({ mode, dx: 0, dy: 0 });
        },
        onPanResponderMove: (_, g) => {
          if (mode === 'move') move.setValue({ x: g.dx, y: g.dy });
          setGesture({ mode, dx: g.dx, dy: g.dy });
          // Anteprima della spinta (la griglia la applica solo se le posizioni cambiano davvero).
          const t = target(mode, g.dx, g.dy);
          onPreview(inBounds(t, rowOffset) && !sameRect(t, widget) ? reflow(others, t) : null);
        },
        onPanResponderRelease: (_, g) => {
          finish();
          const t = target(mode, g.dx, g.dy);
          if (!sameRect(t, widget) && inBounds(t, rowOffset)) onLayout(widget, t, reflow(others, t));
        },
        onPanResponderTerminate: finish,
      });
    return { move: make('move'), resize: make('resize') };
  }, [widget, others, cellW, cellH, rowOffset, onLayout, onPreview, lockScroll, move]);

  const target = gesture ? targetOf({ widget, limits, cellW, cellH }, gesture) : null;
  const valid = target ? inBounds(target, rowOffset) : true;
  const current = box(widget);
  const resized = gesture?.mode === 'resize' && target ? box(target) : current;
  const dropColor = valid ? theme.accent : INVALID;

  return (
    <>
      {/* Dove finirà il widget al rilascio. */}
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
