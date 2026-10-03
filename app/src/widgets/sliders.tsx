// Controlli che scrivono valori numerici: Slider, Vertical Slider, Step (H e V) e zeRGBa (modelli
// Slider, VerticalSlider, Step, VerticalStep e RGB del server). Regole in docs/widgets.md.
//
// - Gli slider e lo zeRGBa con sendOnReleaseOn scrivono solo al rilascio; altrimenti anche durante il
//   trascinamento, al massimo una volta ogni `frequency` ms.
// - Mentre il dito è sul controllo la dashboard non scorre (scrollLock).
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useScrollLock } from '@/components/scrollLock';
import { pinKey, type PinType } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { usePinValues, useWidgetProps, useWidgetValue, useWritePin } from '@/session/hooks';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from './color';
import { formatMaxDigits, parseFloatValue } from './format';
import { useLabel, type WidgetViewProps } from './WidgetFrame';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Dimensioni della maniglia degli slider. */
const HANDLE_LONG = 64;
const HANDLE_SHORT = 28;
const STRIP_LONG = 10;
const STRIP_SHORT = 3;
/** Spessore della traccia (8 dp) e della linea di sfondo (2 dp, cioè 8 dp meno 3 dp per lato). */
const TRACK = 8;
const TRACK_LINE = 2;

/** Titolo a sinistra e valore a destra (oppure centrato sotto). */
function Header({ label, value, theme, centered }: { label: string; value?: string; theme: DashboardTheme; centered?: boolean }) {
  if (centered) {
    return (
      <>
        {label !== '' && (
          <Text style={[styles.label, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
        )}
        {value !== undefined && <Text style={[styles.pin, styles.pinCentered, { color: theme.pinLabel }]}>{value}</Text>}
      </>
    );
  }
  return (
    <View style={styles.header}>
      <Text style={[styles.label, styles.labelFlex, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      {value !== undefined && <Text style={[styles.pin, { color: theme.pinLabel }]}>{value}</Text>}
    </View>
  );
}

/**
 * Trascinamento su un'area: chiama onMove con la posizione del dito relativa all'area (i figli hanno
 * pointerEvents="none", quindi locationX/Y sono sempre relative al contenitore) e onEnd al rilascio.
 */
function useDrag(onMove: (x: number, y: number) => void, onEnd: () => void) {
  const lock = useScrollLock();
  const finish = () => {
    lock(false);
    onEnd();
  };
  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      lock(true);
      onMove(e.nativeEvent.locationX, e.nativeEvent.locationY);
    },
    onResponderMove: (e: GestureResponderEvent) => onMove(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onResponderRelease: finish,
    onResponderTerminate: finish,
  };
}

/** Invio durante il trascinamento: al massimo uno ogni `ms`. */
function useThrottle(ms: number) {
  const last = useRef(0);
  return (fn: () => void) => {
    const now = Date.now();
    if (now - last.current < Math.max(ms, 50)) return;
    last.current = now;
    fn();
  };
}

function useSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return [size, onLayout] as const;
}

/** Maniglia: pillola del colore di sfondo, bordo e tre righine nel colore del widget. */
function Handle({ color, theme, vertical, width, height }: { color: string; theme: DashboardTheme; vertical: boolean; width: number; height: number }) {
  const strip = vertical ? { width: STRIP_LONG, height: STRIP_SHORT } : { width: STRIP_SHORT, height: STRIP_LONG };
  return (
    <View
      style={[
        styles.handle,
        { width, height, borderRadius: Math.min(width, height) / 2, backgroundColor: theme.background, borderColor: color },
        vertical ? styles.column : styles.row,
      ]}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={[strip, { borderRadius: STRIP_SHORT / 2, backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Logica comune di Slider e Vertical Slider. */
function useSlider(dashId: number, widget: WidgetViewProps['widget'], theme: DashboardTheme) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const write = useWritePin(dashId, widget);
  const throttle = useThrottle(num(widget.frequency, 100));
  const min = num(props.min !== undefined ? Number(props.min) : widget.min, 0);
  const max = num(props.max !== undefined ? Number(props.max) : widget.max, 255);
  const digits = num(widget.maximumFractionDigits, 0);
  const sendOnRelease = widget.sendOnReleaseOn !== false;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const current = Math.min(Math.max(parseFloatValue(value?.[0] ?? '') ?? min, lo), hi);
  const [drag, setDragState] = useState<number | null>(null);
  // Copia nel ref: al rilascio si scrive il valore senza effetti dentro setState.
  const dragRef = useRef<number | null>(null);
  const setDrag = (v: number | null) => {
    dragRef.current = v;
    setDragState(v);
  };
  const shown = drag ?? current;
  const fraction = max === min ? 0 : (shown - min) / (max - min);
  const color = widgetColor(props.color ?? widget.color, theme, { min, max, value: shown });

  /** Nuova posizione (0-1): valore arrotondato ai decimali del widget. */
  const moveTo = (f: number) => {
    const clamped = Math.min(Math.max(f, 0), 1);
    const v = Number(formatMaxDigits(min + clamped * (max - min), digits));
    setDrag(v);
    if (!sendOnRelease) throttle(() => write([formatMaxDigits(v, digits)]));
  };
  const release = () => {
    const v = dragRef.current;
    if (v !== null) write([formatMaxDigits(v, digits)]);
    setDrag(null);
  };
  const text = widget.showValueOn !== false ? formatMaxDigits(shown, digits) : undefined;
  return { fraction, color, moveTo, release, text };
}

/** Slider orizzontale: traccia da 8 dp centrata, maniglia 64 × 28 dp. */
export function SliderWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const s = useSlider(dashId, widget, theme);
  const [size, onLayout] = useSize();
  const handleW = Math.min(HANDLE_LONG, size.w / 2);
  const travel = Math.max(1, size.w - handleW);
  const drag = useDrag((x) => s.moveTo((x - handleW / 2) / travel), s.release);
  const left = s.fraction * travel;
  return (
    <View style={styles.frame}>
      <Header label={label} value={s.text} theme={theme} />
      <View style={styles.area} onLayout={onLayout} {...drag}>
        {size.w > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[styles.hTrackLine, { top: (size.h - TRACK_LINE) / 2, backgroundColor: withAlpha(s.color, 0.3) }]} />
            <View style={[styles.hTrackFill, { top: (size.h - TRACK) / 2, width: left + handleW / 2, backgroundColor: s.color }]} />
            <View style={{ position: 'absolute', left, top: (size.h - HANDLE_SHORT) / 2 }}>
              <Handle color={s.color} theme={theme} vertical={false} width={handleW} height={HANDLE_SHORT} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/** Slider verticale: titolo, valore centrato, traccia verticale; il minimo in basso. */
export function VerticalSliderWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const s = useSlider(dashId, widget, theme);
  const [size, onLayout] = useSize();
  const handleW = Math.min(HANDLE_LONG, size.w);
  const handleH = Math.min(HANDLE_SHORT, size.h / 3);
  const travel = Math.max(1, size.h - handleH);
  const drag = useDrag((_, y) => s.moveTo(1 - (y - handleH / 2) / travel), s.release);
  const top = (1 - s.fraction) * travel;
  return (
    <View style={styles.frame}>
      <Header label={label} value={s.text} theme={theme} centered />
      <View style={styles.area} onLayout={onLayout} {...drag}>
        {size.h > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[styles.vTrackLine, { left: (size.w - TRACK_LINE) / 2, backgroundColor: withAlpha(s.color, 0.3) }]} />
            <View style={[styles.vTrackFill, { left: (size.w - TRACK) / 2, top: top + handleH / 2, backgroundColor: s.color }]} />
            <View style={{ position: 'absolute', top, left: (size.w - handleW) / 2 }}>
              <Handle color={s.color} theme={theme} vertical width={handleW} height={handleH} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Step H e V: due pulsanti che tolgono o aggiungono `step`. Con isLoopOn oltre il massimo
 * si riparte dal minimo e viceversa; altrimenti ci si ferma ai limiti. Si invia il nuovo valore (#.#####),
 * oppure solo il passo (+step / −step) con isSendStep. Il valore mostrato ha al massimo 2 decimali.
 */
export function StepWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const write = useWritePin(dashId, widget);
  const min = num(props.min !== undefined ? Number(props.min) : widget.min, 0);
  const max = num(props.max !== undefined ? Number(props.max) : widget.max, 255);
  const step = num(props.step !== undefined ? Number(props.step) : widget.step, 1);
  const current = parseFloatValue(value?.[0] ?? '') ?? min;
  const color = widgetColor(props.color ?? widget.color, theme, { min, max, value: current });
  const vertical = widget.type === 'VERTICAL_STEP';
  // Attenzione al nome: isArrowsOn = true mostra + e −, false le frecce
  // (comportamento atteso dai progetti creati con l'app Blynk Legacy).
  const arrows = widget.isArrowsOn !== true;

  const press = (dir: 1 | -1) => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    let next = current + step * dir;
    if (widget.isLoopOn === true) {
      if (next > hi) next = lo;
      if (next < lo) next = hi;
    } else {
      next = Math.min(Math.max(next, lo), hi);
    }
    if (widget.isSendStep === true) write([formatMaxDigits(step * dir, 5)]);
    else write([formatMaxDigits(next, 5)]);
  };

  const icon = (dir: 1 | -1): keyof typeof MaterialCommunityIcons.glyphMap =>
    arrows ? (vertical ? (dir > 0 ? 'chevron-up' : 'chevron-down') : dir > 0 ? 'chevron-right' : 'chevron-left') : dir > 0 ? 'plus' : 'minus';
  const button = (dir: 1 | -1) => (
    <Pressable onPress={() => press(dir)} style={({ pressed }) => [styles.stepButton, { opacity: pressed ? 0.5 : 1 }]} hitSlop={4}>
      <MaterialCommunityIcons name={icon(dir)} size={36} color={color} />
    </Pressable>
  );
  const divider = <View style={[vertical ? styles.dividerH : styles.dividerV, { backgroundColor: withAlpha(theme.text, 0.15) }]} />;
  return (
    <View style={styles.frame}>
      <Header label={label} value={widget.showValueOn !== false ? formatMaxDigits(current) : undefined} theme={theme} />
      <View style={[styles.area, vertical ? styles.column : styles.row]}>
        {vertical ? (
          <>
            {button(1)}
            {divider}
            {button(-1)}
          </>
        ) : (
          <>
            {button(-1)}
            {divider}
            {button(1)}
          </>
        )}
      </View>
    </View>
  );
}

// ——— zeRGBa ———

/** HSV (h 0-360, s e v 0-1) → [r, g, b] 0-255. */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r / 255) h = 60 * (((g - b) / 255 / d) % 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else h = 60 * ((r - g) / 255 / d + 4);
  }
  return [(h + 360) % 360, max === 0 ? 0 : d / max, max];
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

interface RgbPin {
  pin?: number;
  pinType?: PinType;
  min?: number;
  max?: number;
}


/**
 * RGB (zeRGBa): tavolozza con la tinta in orizzontale e la luminosità in verticale
 * (saturazione piena) su un rettangolo arrotondato, più un pallino bianco in alto a sinistra; maniglia rotonda del
 * colore scelto con bordo bianco. Il colore dipende solo dalla posizione del dito. Ogni componente
 * 0-255 si converte nell'intervallo min-max del suo pin. Modalità unita: "r\0g\0b" sul primo pin;
 * splitMode: un valore per pin.
 */
export function RgbWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const { writePin } = useSession();
  const throttle = useThrottle(num(widget.frequency, 100));
  const pins = (Array.isArray(widget.pins) ? (widget.pins as RgbPin[]) : []).slice(0, 3);
  const split = widget.splitMode === true;
  const deviceId = widget.deviceId ?? 0;
  const keyOf = (p?: RgbPin) => (p && p.pin !== undefined && p.pin >= 0 && p.pinType ? pinKey(dashId, deviceId, p.pinType, p.pin) : null);
  const keys = split ? pins.map(keyOf) : [keyOf(pins[0])];
  const values = usePinValues(keys);
  const range = (i: number) => ({ min: num(pins[i]?.min, 0), max: num(pins[i]?.max, 255) });
  /** Valore del pin → 0-255. */
  const to255 = (i: number, v: number) => {
    const { min, max } = range(i);
    return max === min ? 0 : ((v - min) * 255) / (max - min);
  };
  const raw = split ? [0, 1, 2].map((i) => Number(values[i]?.[0])) : [0, 1, 2].map((i) => Number(values[0]?.[i]));
  const fromServer: [number, number, number] = [0, 1, 2].map((i) => (Number.isFinite(raw[i]) ? Math.round(to255(i, raw[i]!)) : 0)) as [number, number, number];
  const [drag, setDragState] = useState<[number, number, number] | null>(null);
  const dragRef = useRef<[number, number, number] | null>(null);
  const setDrag = (c: [number, number, number] | null) => {
    dragRef.current = c;
    setDragState(c);
  };
  const rgb = drag ?? fromServer;

  const send = (c: [number, number, number]) => {
    // 0-255 → intervallo del pin, numero intero.
    const out = c.map((v, i) => {
      const { min, max } = range(i);
      return String(Math.round((v * (max - min)) / 255 + min));
    });
    if (split) {
      pins.forEach((p, i) => {
        if (p.pin !== undefined && p.pin >= 0) writePin(dashId, deviceId, p.pin, [out[i]!]);
      });
    } else if (pins[0]?.pin !== undefined && pins[0].pin >= 0) {
      writePin(dashId, deviceId, pins[0].pin, out);
    }
  };

  const [size, onLayout] = useSize();
  const handleR = Math.max(8, Math.min(24, size.w / 6, size.h / 6));
  const dotR = Math.min(8, handleR / 2);
  // Tavolozza: tutta l'area, rientrata del raggio della maniglia.
  const gx = handleR;
  const gy = handleR;
  const gw = Math.max(1, size.w - handleR * 2);
  const gh = Math.max(1, size.h - handleR * 2);
  const dotX = gx + dotR;
  const dotY = gy + dotR;

  const pick = (x: number, y: number): [number, number, number] => {
    if ((x - dotX) ** 2 + (y - dotY) ** 2 <= dotR ** 2) return [255, 255, 255];
    const fx = Math.min(Math.max((x - gx) / gw, 0), 1);
    const fy = Math.min(Math.max((y - gy) / gh, 0), 1);
    return hsvToRgb(Math.round(fx * 360), 1, 1 - fy);
  };
  const dragHandlers = useDrag(
    (x, y) => {
      const c = pick(x, y);
      setDrag(c);
      if (widget.sendOnReleaseOn === false) throttle(() => send(c));
    },
    () => {
      const c = dragRef.current;
      if (c) send(c);
      setDrag(null);
    },
  );

  // Posizione della maniglia dal colore corrente.
  const isWhite = rgb[0] >= 250 && rgb[1] >= 250 && rgb[2] >= 250;
  const [h, , v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  const hx = isWhite ? dotX : gx + (h / 360) * gw;
  const hy = isWhite ? dotY : gy + (1 - v) * gh;
  const css = `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
  const RGB_COLORS = [theme.rgbRed, theme.rgbGreen, theme.rgbBlue];

  return (
    <View style={styles.frame}>
      {label !== '' && (
        <Text style={[styles.label, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      )}
      {/* Riga dei valori: spazi uguali, due prima del primo numero e uno dopo gli altri. */}
      <View style={styles.rgbRow}>
        <View style={styles.rgbGap2} />
        {rgb.flatMap((c, i) => [
          <Text key={'v' + i} style={[styles.pin, styles.rgbValue, { color: RGB_COLORS[i] }]}>
            {Math.round(c * ((range(i).max - range(i).min) / 255) + range(i).min)}
          </Text>,
          <View key={'g' + i} style={styles.rgbGap1} />,
        ])}
      </View>
      <View style={styles.area} onLayout={onLayout} {...dragHandlers}>
        {size.w > 0 && (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                {['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'].map((c, i) => (
                  <Stop key={i} offset={i / 6} stopColor={c} />
                ))}
              </LinearGradient>
              <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={gx - dotR} y={gy - dotR} width={gw + dotR * 2} height={gh + dotR * 2} rx={6} fill="url(#hue)" />
            <Rect x={gx - dotR} y={gy - dotR} width={gw + dotR * 2} height={gh + dotR * 2} rx={6} fill="url(#shade)" />
            <Circle cx={dotX} cy={dotY} r={dotR} fill="#FFFFFF" stroke={withAlpha('#000000', 0.25)} strokeWidth={1} />
            <Circle cx={hx} cy={hy} r={handleR} fill={css} stroke="#FFFFFF" strokeWidth={2} />
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  label: { fontSize: 11, fontFamily: FONT.regular },
  labelFlex: { flex: 1 },
  pin: { fontSize: 10, fontFamily: FONT.regular, marginLeft: 2 },
  pinCentered: { textAlign: 'center', marginLeft: 0, marginBottom: 2 },
  rgbRow: { flexDirection: 'row', marginBottom: 2 },
  rgbValue: { marginLeft: 0 },
  rgbGap2: { flex: 2 },
  rgbGap1: { flex: 1 },
  area: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: STRIP_LONG / 2 },
  column: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: STRIP_SHORT },
  handle: { borderWidth: 1 },
  hTrackLine: { position: 'absolute', left: 0, right: 0, height: TRACK_LINE, borderRadius: 1 },
  hTrackFill: { position: 'absolute', left: 0, height: TRACK, borderRadius: TRACK / 2 },
  vTrackLine: { position: 'absolute', top: 0, bottom: 0, width: TRACK_LINE, borderRadius: 1 },
  vTrackFill: { position: 'absolute', bottom: 0, width: TRACK, borderRadius: TRACK / 2 },
  stepButton: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  dividerH: { height: 1, alignSelf: 'stretch', marginHorizontal: 4 },
  dividerV: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
});

