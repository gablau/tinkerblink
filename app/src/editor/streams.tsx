// SuperChart streams (dataStreams, GraphDataStream on the server):
// list of the streams with "Add stream" and, for each one, a screen with source (device and pin), style
// (LINE / FILLED_LINE / BAR / BINARY), color, Y axis (Auto, Min/Max, Height, Delta), suffix, decimals,
// missing points, smoothed curves, state labels for binary streams and formula.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type PanResponderInstance } from 'react-native';
import { useScrollLock } from '@/components/scrollLock';
import type { Dashboard, PinType, Widget } from '@/model/profile';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from '@/widgets/color';
import { pinKeyOf, pinsForWidget } from './boards/boards';
import { cssToRgba } from './colors';
import { BoolField, ChoiceField, ColorField, DeviceField, NumberField, PinButton, Row, TextField, type ControlTheme } from './controls';
import { usedPins } from './pinUsage';
import { te } from './strings';

interface PinRef {
  pin?: number;
  pinType?: PinType;
  [key: string]: unknown;
}

export interface GraphStream {
  title?: string;
  graphType?: string;
  color?: number;
  targetId?: number;
  pin?: PinRef;
  yAxisScale?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  delta?: number;
  [key: string]: unknown;
}

const MAX_STREAMS = 4;

/** New stream with the initial values (fields of GraphDataStream on the server). */
function newStream(dash: Dashboard, theme: ControlTheme['theme']): GraphStream {
  return {
    title: '',
    graphType: 'LINE',
    color: cssToRgba(theme.accent),
    targetId: dash.devices?.[0]?.id ?? 0,
    pin: { pin: -1, pwmMode: false, rangeMappingOn: false, min: 0, max: 255 },
    functionType: 'AVG',
    flip: 0,
    yAxisMin: 0,
    yAxisMax: 0,
    showYAxis: true,
    cubicSmoothingEnabled: false,
    connectMissingPointsEnabled: false,
    isPercentMaxMin: false,
    yAxisScale: 'AUTO',
    delta: 0,
    userDeltaModifyAllowed: false,
    maximumFractionDigits: 2,
  };
}

function pinName(s: GraphStream): string {
  const p = s.pin;
  return p && typeof p.pin === 'number' && p.pin >= 0 && p.pinType ? `${p.pinType.charAt(0)}${p.pin}` : te.noPin;
}

export function StreamsField({
  widget,
  draft,
  setDraft,
  dash,
  ct,
}: {
  widget: Widget;
  draft: Widget;
  setDraft: (update: (d: Widget) => Widget) => void;
  dash: Dashboard;
  ct: ControlTheme;
}) {
  const streams = Array.isArray(draft.dataStreams) ? (draft.dataStreams as GraphStream[]) : [];
  const [editing, setEditing] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const setStreams = (update: (s: GraphStream[]) => GraphStream[]) =>
    setDraft((d) => ({
      ...d,
      dataStreams: update(Array.isArray(d.dataStreams) ? (d.dataStreams as GraphStream[]) : []),
    }));

  const move = useCallback(
    (from: number, to: number) =>
      setDraft((d) => {
        const next = Array.isArray(d.dataStreams) ? [...(d.dataStreams as GraphStream[])] : [];
        const [item] = next.splice(from, 1);
        if (item) next.splice(to, 0, item);
        return { ...d, dataStreams: next };
      }),
    [setDraft],
  );

  return (
    <View style={styles.list}>
      {/* Dragging the handle changes the order of the streams. */}
      <View>
        {streams.map((s, i) => (
          <DraggableRow key={i} index={i} count={streams.length} drag={drag} setDrag={setDrag} onMove={move}>
            {(handle) => (
              <Pressable onPress={() => setEditing(i)} style={[styles.item, { backgroundColor: ct.theme.light ? '#EEF1F3' : '#2C2D32' }]}>
                <View {...handle} style={styles.handle} hitSlop={8} accessibilityLabel={te.reorder}>
                  <MaterialCommunityIcons name="drag" size={24} color={withAlpha(ct.theme.text, 0.6)} />
                </View>
                <View style={[styles.dot, { backgroundColor: widgetColor(s.color, ct.theme) }]} />
                <Text style={[styles.itemTitle, { color: ct.theme.text }]} numberOfLines={1}>
                  {s.title && s.title !== '' ? s.title : te.streamDefault}
                </Text>
                <Text style={[styles.itemPin, { color: withAlpha(ct.theme.text, 0.6) }]}>{pinName(s)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={ct.theme.text} />
              </Pressable>
            )}
          </DraggableRow>
        ))}
      </View>
      {streams.length < MAX_STREAMS && (
        <Pressable
          onPress={() => {
            setStreams((s) => [...s, newStream(dash, ct.theme)]);
            setEditing(streams.length);
          }}
          style={styles.add}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="plus" size={18} color={ct.accent} />
          <Text style={[styles.addText, { color: ct.accent }]}>{te.addStream.toUpperCase()}</Text>
        </Pressable>
      )}
      {editing !== null && streams[editing] && (
        <StreamEditor
          stream={streams[editing]}
          others={streams.filter((_, j) => j !== editing)}
          widget={widget}
          dash={dash}
          ct={ct}
          onChange={(next) => setStreams((all) => all.map((x, j) => (j === editing ? next : x)))}
          onDelete={() => {
            setStreams((all) => all.filter((_, j) => j !== editing));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

/** Height of a list row (row + gap), used to compute the position while dragging. */
const ROW_STEP = 56;

interface DragState {
  from: number;
  to: number;
}

/**
 * Draggable row: the handle (props passed to `children`) starts the drag, the row follows the finger and
 * the others shift by one position to make room; on release onMove(from, to) is called.
 * During the gesture scrolling of the screen is locked (on Android the native ScrollView would
 * take over the gesture).
 */
function DraggableRow({
  index,
  count,
  drag,
  setDrag,
  onMove,
  children,
}: {
  index: number;
  count: number;
  drag: DragState | null;
  setDrag: (d: DragState | null) => void;
  onMove: (from: number, to: number) => void;
  children: (handle: PanResponderInstance['panHandlers']) => ReactNode;
}) {
  const lock = useScrollLock();
  const [dy] = useState(() => new Animated.Value(0));
  const responder = useMemo(() => {
    const target = (offset: number) => Math.max(0, Math.min(count - 1, index + Math.round(offset / ROW_STEP)));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        lock(true);
        dy.setValue(0);
        setDrag({ from: index, to: index });
      },
      onPanResponderMove: (_, g) => {
        dy.setValue(g.dy);
        setDrag({ from: index, to: target(g.dy) });
      },
      onPanResponderRelease: (_, g) => {
        lock(false);
        const to = target(g.dy);
        dy.setValue(0);
        setDrag(null);
        if (to !== index) onMove(index, to);
      },
      onPanResponderTerminate: () => {
        lock(false);
        dy.setValue(0);
        setDrag(null);
      },
    });
  }, [index, count, onMove, lock, dy, setDrag]);

  const dragging = drag?.from === index;
  // The rows between the start and the target position shift by one place.
  let shift = 0;
  if (drag && !dragging) {
    if (drag.from < index && index <= drag.to) shift = -ROW_STEP;
    else if (drag.to <= index && index < drag.from) shift = ROW_STEP;
  }
  return (
    <Animated.View
      style={[
        styles.row,
        {
          transform: [{ translateY: dragging ? dy : shift }],
          zIndex: dragging ? 10 : 0,
          elevation: dragging ? 6 : 0,
          opacity: dragging ? 0.9 : 1,
        },
      ]}
    >
      {children(responder.panHandlers)}
    </Animated.View>
  );
}

function StreamEditor({
  stream,
  others,
  widget,
  dash,
  ct,
  onChange,
  onDelete,
  onClose,
}: {
  stream: GraphStream;
  others: GraphStream[];
  widget: Widget;
  dash: Dashboard;
  ct: ControlTheme;
  onChange: (s: GraphStream) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<GraphStream>) => onChange({ ...stream, ...patch });
  const deviceId = stream.targetId ?? 0;
  const board = dash.devices?.find((d) => d.id === deviceId)?.boardType;
  const pins = pinsForWidget(widget.type, board);
  const used = usedPins(dash, widget, deviceId);
  // Pins already used by the other streams of the same SuperChart on the same device: marked as used.
  for (const o of others) {
    if ((o.targetId ?? 0) !== deviceId || !o.pin || typeof o.pin.pin !== 'number' || o.pin.pin < 0 || !o.pin.pinType) continue;
    const key = pinKeyOf(o.pin.pinType, o.pin.pin);
    used.set(key, [...(used.get(key) ?? []), o.title && o.title !== '' ? o.title : te.streamDefault]);
  }
  const scale = stream.yAxisScale ?? 'AUTO';
  const bool = (key: string, label: string) => (
    <Row label={label} ct={ct}>
      <BoolField value={stream[key] === true} onChange={(v) => set({ [key]: v })} ct={ct} />
    </Row>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: ct.theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1D1E22" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {stream.title && stream.title !== '' ? stream.title : te.streamDefault}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Row label={te.title} ct={ct}>
            <TextField value={stream.title ?? ''} onChange={(v) => set({ title: v })} ct={ct} />
          </Row>
          <Text style={[styles.section, { color: ct.accent }]}>{te.source.toUpperCase()}</Text>
          <Row label={te.pin} ct={ct} column>
            <View style={styles.pinBox}>
              <DeviceField deviceId={deviceId} devices={dash.devices ?? []} onChange={(id) => set({ targetId: id })} ct={ct} />
              <PinButton
                pinType={stream.pin?.pinType}
                pin={stream.pin?.pin}
                pins={pins}
                used={used}
                onChange={({ pinType, pin }) => {
                  const next: PinRef = { ...(stream.pin ?? {}), pin };
                  if (pinType) next.pinType = pinType;
                  else delete next.pinType;
                  set({ pin: next });
                }}
                ct={ct}
              />
            </View>
          </Row>
          <Text style={[styles.section, { color: ct.accent }]}>{te.design.toUpperCase()}</Text>
          <Row label={te.style} ct={ct}>
            <ChoiceField
              title={te.style}
              value={stream.graphType ?? 'LINE'}
              options={[
                { value: 'LINE', label: te.line },
                { value: 'FILLED_LINE', label: te.area },
                { value: 'BAR', label: te.bar },
                { value: 'BINARY', label: te.binary },
              ]}
              onChange={(v) => set({ graphType: v as string })}
              ct={ct}
            />
          </Row>
          <Row label={te.color} ct={ct} column>
            <ColorField value={stream.color} gradients={false} onChange={(v) => set({ color: v })} ct={ct} />
          </Row>
          {stream.graphType === 'BINARY' && (
            <>
              <Row label={te.falseLabel} ct={ct}>
                <TextField value={typeof stream.low === 'string' ? stream.low : ''} onChange={(v) => set({ low: v })} ct={ct} />
              </Row>
              <Row label={te.trueLabel} ct={ct}>
                <TextField value={typeof stream.high === 'string' ? stream.high : ''} onChange={(v) => set({ high: v })} ct={ct} />
              </Row>
            </>
          )}
          <Text style={[styles.section, { color: ct.accent }]}>{te.yAxis.toUpperCase()}</Text>
          <Row label={te.axisScale} ct={ct} column>
            <ChoiceField
              title={te.yAxis}
              value={scale}
              options={[
                { value: 'AUTO', label: te.scaleAuto },
                { value: 'MINMAX', label: te.scaleMinMax },
                { value: 'HEIGHT', label: te.scaleHeight },
                { value: 'DELTA', label: te.scaleDelta },
              ]}
              onChange={(v) => set({ yAxisScale: v as string })}
              ct={ct}
            />
          </Row>
          {(scale === 'MINMAX' || scale === 'HEIGHT') && (
            <Row label={te.range} ct={ct}>
              <View style={styles.pair}>
                <NumberField key={`min${scale}`} value={stream.yAxisMin} onChange={(n) => set({ yAxisMin: n })} ct={ct} width={90} />
                <Text style={{ color: ct.theme.text }}>–</Text>
                <NumberField key={`max${scale}`} value={stream.yAxisMax} onChange={(n) => set({ yAxisMax: n })} ct={ct} width={90} />
              </View>
            </Row>
          )}
          {scale === 'DELTA' && (
            <Row label={te.delta} ct={ct}>
              <NumberField value={stream.delta} onChange={(n) => set({ delta: n })} ct={ct} />
            </Row>
          )}
          {bool('showYAxis', te.showYAxis)}
          <Row label={te.suffix} ct={ct}>
            <TextField
              value={typeof stream.suffix === 'string' ? stream.suffix : ''}
              onChange={(v) => set({ suffix: v })}
              ct={ct}
              placeholder="°C"
            />
          </Row>
          <Row label={te.decimals} ct={ct}>
            <ChoiceField
              title={te.decimals}
              value={stream.maximumFractionDigits ?? 2}
              options={[0, 1, 2, 3, 4, 5].map((n) => ({
                value: n,
                label: String(n),
              }))}
              onChange={(v) => set({ maximumFractionDigits: v })}
              ct={ct}
            />
          </Row>
          {bool('connectMissingPointsEnabled', te.connectMissing)}
          {bool('cubicSmoothingEnabled', te.smoothing)}
          <Row label={te.formula} ct={ct}>
            <TextField
              value={typeof stream.mathFormula === 'string' ? stream.mathFormula : ''}
              onChange={(v) => set({ mathFormula: v })}
              ct={ct}
              placeholder="(/pin/*2)/6"
            />
          </Row>
          <Pressable onPress={onDelete} style={styles.delete}>
            <MaterialCommunityIcons name="delete-outline" size={20} color="#D3435C" />
            <Text style={styles.deleteText}>{te.deleteStream.toUpperCase()}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { height: ROW_STEP, paddingBottom: 8 },
  handle: { paddingRight: 2, paddingVertical: 4 },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  itemTitle: { flex: 1, fontSize: 16, fontFamily: FONT.regular },
  itemPin: { fontSize: 14, fontFamily: FONT.medium },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  addText: { fontSize: 13, fontFamily: FONT.medium },
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
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: FONT.regular,
    color: '#1D1E22',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  section: {
    fontSize: 13,
    fontFamily: FONT.medium,
    letterSpacing: 1,
    marginTop: 16,
  },
  pinBox: { gap: 8 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    alignSelf: 'flex-start',
  },
  deleteText: { color: '#D3435C', fontSize: 13, fontFamily: FONT.medium },
});
