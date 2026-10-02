// SuperChart (ENHANCED_GRAPH, modello Superchart del server):
// titolo, legenda, grafico, selettore dei periodi in basso.
//
// - Tenendo premuto sul grafico compaiono una linea verticale, l'ora e i valori di ogni stream al posto
//   della legenda; trascinando si sposta il cursore. Toccando una voce della legenda si nasconde o mostra
//   lo stream.
// - Trascinando in orizzontale (periodi storici) si scorre indietro nel tempo; quando si arriva ai dati più
//   vecchi già caricati si chiede la pagina precedente al server.
// - Periodo scelto e stream nascosti si salvano sul telefono (prefs.ts).
// - Non ancora fatti: schermo intero, linea obiettivo, curve smussate.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { GraphPeriod, GraphPoint } from '@tinkerblink/protocol';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { t } from '@/i18n';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { isGradient, isTransparent, widgetColor, withAlpha } from '../color';
import { useLabel, type WidgetViewProps } from '../WidgetFrame';
import { formatAxisTime, formatFullTime, isGraphPeriod, periodLabel, periodSpanMs, periodStepMs, selectablePeriods, xLabelCount } from './periods';
import {
  computeScales,
  formatFixed,
  formatStreamValue,
  fromFrac,
  hasValues,
  parseStreams,
  plotValue,
  toFrac,
  yLabelCount,
  type ChartStream,
  type GraphType,
  type StreamScale,
} from './scale';
import { cachedChartPrefs, loadChartPrefs, saveChartPrefs } from './prefs';
import { useGraphData } from './useGraphData';

// Le preferenze si caricano subito, così di solito sono pronte quando si apre una dashboard.
void loadChartPrefs();

/** Dimensione del titolo per FontSize. */
const TITLE_SIZE = { SMALL: 12, MEDIUM: 16, LARGE: 20 } as const;
const AXIS_FONT = 10;
/** Stile dei riempimenti. */
const AREA_ALPHA = 0.8;
const BAR_ALPHA = 0.8;
const BINARY_FILL_ALPHA = 0.2;
const GRADIENT_FILL_ALPHA = [0.2, 0.1, 0] as const;
/** Pressione prolungata che attiva il cursore (ms). */
const HOLD_MS = 250;
/** Nel LIVE si mostrano gli ultimi punti: almeno 30 s. */
const LIVE_POINTS = 60;
const LIVE_MIN_SPAN_MS = 30_000;

const TYPE_ICON: Record<GraphType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  LINE: 'chart-line-variant',
  FILLED_LINE: 'chart-areaspline-variant',
  BAR: 'chart-bar',
  BINARY: 'square-wave',
};

const ALIGN = { LEFT: 'left', MIDDLE: 'center', RIGHT: 'right' } as const;

export function SuperChartWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const streams = useMemo(() => parseStreams(dashId, widget), [dashId, widget]);
  const periods = useMemo(() => selectablePeriods(widget.selectedPeriods), [widget.selectedPeriods]);
  // Preferenze salvate: finché non sono caricate il periodo è null e non si chiede nulla al server.
  const [prefs, setPrefs] = useState(() => cachedChartPrefs(dashId, widget.id));
  useEffect(() => {
    if (prefs) return;
    let alive = true;
    void loadChartPrefs().then(() => {
      if (alive) setPrefs(cachedChartPrefs(dashId, widget.id));
    });
    return () => {
      alive = false;
    };
  }, [prefs, dashId, widget.id]);
  const [chosen, setChosen] = useState<GraphPeriod | null>(null);
  const saved = prefs?.period;
  const fallback = isGraphPeriod(widget.period) && periods.includes(widget.period) ? widget.period : periods[0]!;
  const period: GraphPeriod | null = chosen ?? (prefs ? (saved && periods.includes(saved) ? saved : fallback) : null);
  const shownPeriod = period ?? fallback;
  /** Fine della finestra quando si è scorso indietro; null = segue i dati più recenti. */
  const [viewEnd, setViewEnd] = useState<number | null>(null);
  const setPeriod = (p: GraphPeriod) => {
    setChosen(p);
    setViewEnd(null);
    saveChartPrefs(dashId, widget.id, { period: p });
  };
  const [hiddenState, setHidden] = useState<boolean[] | null>(null);
  const hidden = hiddenState ?? streams.map((_, i) => prefs?.hidden?.includes(i) ?? false);
  const visible = streams.map((_, i) => !hidden[i]);
  const data = useGraphData(dashId, widget.id, streams, period);
  const [cursor, setCursor] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const align = ALIGN[(widget.textAlignment as keyof typeof ALIGN) ?? 'LEFT'] ?? 'left';
  const titleSize = TITLE_SIZE[(widget.fontSize as keyof typeof TITLE_SIZE) ?? 'MEDIUM'] ?? 16;
  const titleColor = widgetColor(widget.color, theme);
  const showTitle = widget.showTitle !== false && label !== '' && !isTransparent(titleColor);

  // Finestra temporale: storico = un periodo che finisce all'ultimo caricamento, oppure a viewEnd se si è
  // scorso indietro; LIVE = ultimi punti ricevuti.
  const [start, end] = useMemo(
    () => timeWindow(shownPeriod, data.streams, data.loadedAt, viewEnd),
    [shownPeriod, data.streams, data.loadedAt, viewEnd],
  );
  const shown = useMemo(
    () => data.streams.map((pts) => pts.filter((p) => p.ts >= start - periodStepMs(shownPeriod) && p.ts <= end)),
    [data.streams, start, end, shownPeriod],
  );
  const labels = yLabelCount(widget.height);
  // La scala dello storico usa tutti i dati caricati: non cambia mentre si scorre.
  const scaleData = shownPeriod === 'LIVE' ? shown : data.streams;
  const hiddenKey = hidden.join();
  const scales = useMemo(
    () => computeScales(streams, scaleData, visible, widget.overrideYAxis === true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streams, scaleData, hiddenKey, widget.overrideYAxis],
  );
  const empty = !streams.some((s, i) => hasValues(s, shown[i]));
  const loadedEmpty = !streams.some((s, i) => hasValues(s, data.streams[i]));

  /** Scorrimento: dx in pixel, positivo = dito verso destra = indietro nel tempo. */
  const pan = (dx: number) => {
    if (shownPeriod === 'LIVE' || size.width === 0 || data.loadedAt === 0) return;
    const span = periodSpanMs(shownPeriod);
    let oldest = Infinity;
    for (const pts of data.streams) if (pts.length > 0) oldest = Math.min(oldest, pts[0]!.ts);
    if (oldest === Infinity) return;
    const latest = data.loadedAt;
    const wanted = (viewEnd ?? latest) - (dx / size.width) * span;
    const next = Math.max(Math.min(wanted, latest), Math.min(latest, oldest + span));
    setViewEnd(next >= latest ? null : next);
    // Vicino ai dati più vecchi già caricati: si chiede la pagina precedente.
    if (wanted - span < oldest + span / 2) data.loadOlder();
  };
  const gesture = useChartGesture(setCursor, pan, size.width, !loadedEmpty, shownPeriod !== 'LIVE');
  const message = !loadedEmpty ? null : data.loading ? t.graphLoading : shownPeriod === 'LIVE' ? null : t.graphNoData;

  const toggle = (i: number) => {
    const next = streams.map((_, j) => (j === i ? !hidden[j] : !!hidden[j]));
    setHidden(next);
    saveChartPrefs(dashId, widget.id, { hidden: next.flatMap((h, j) => (h ? [j] : [])) });
  };

  const cursorTs = cursor === null || size.width === 0 ? null : start + (cursor / size.width) * (end - start);

  return (
    <View style={styles.frame}>
      {/* Col cursore attivo, titolo e legenda diventano invisibili (lo spazio resta, così il grafico non si
          sposta) e al loro posto compaiono i valori. */}
      <View style={styles.header}>
        <View style={{ opacity: cursorTs !== null ? 0 : 1 }}>
          {showTitle && (
            <Text style={[styles.title, { color: titleColor, fontSize: titleSize, textAlign: align }]} numberOfLines={1}>
              {label}
            </Text>
          )}
          {widget.showLegend !== false && (
            <Legend streams={streams} visible={visible} theme={theme} align={align} onToggle={toggle} />
          )}
        </View>
        {cursorTs !== null && (
          <CursorValues streams={streams} shown={shown} visible={visible} ts={cursorTs} theme={theme} align={align} />
        )}
      </View>
      <View
        style={styles.chart}
        onLayout={(e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        {...gesture}
      >
        {size.width > 0 && size.height > 0 && !loadedEmpty && (
          <ChartSvg
            width={size.width}
            height={size.height}
            streams={streams}
            shown={shown}
            visible={visible}
            scales={scales}
            start={start}
            end={end}
            period={shownPeriod}
            theme={theme}
            labels={labels}
            xAxis={widget.xAxisValues === true}
            cursorX={cursor}
            cursorTs={cursorTs}
          />
        )}
        {data.loadingOlder && (
          <View style={styles.older} pointerEvents="none">
            <Text style={[styles.messageText, { color: theme.text }]}>{t.graphLoading}</Text>
          </View>
        )}
        {!empty || loadedEmpty ? null : (
          <View style={styles.message} pointerEvents="none">
            <Text style={[styles.messageText, { color: theme.text }]}>{t.graphNoData}</Text>
          </View>
        )}
        {message && (
          <View style={styles.message} pointerEvents="none">
            <Text style={[styles.messageText, { color: theme.text }]}>{message}</Text>
          </View>
        )}
      </View>
      <PeriodPicker periods={periods} period={shownPeriod} theme={theme} onSelect={setPeriod} />
    </View>
  );
}

function timeWindow(period: GraphPeriod, streams: GraphPoint[][], loadedAt: number, viewEnd: number | null): [number, number] {
  const now = loadedAt || Date.now();
  if (period !== 'LIVE') {
    const span = periodSpanMs(period);
    let endTs = viewEnd ?? now;
    // Dopo una riconnessione i dati ripartono dalla pagina più recente: la finestra scorsa indietro non
    // deve finire oltre i dati caricati, altrimenti il grafico resta vuoto.
    let oldest = Infinity;
    for (const pts of streams) if (pts.length > 0) oldest = Math.min(oldest, pts[0]!.ts);
    if (viewEnd !== null && oldest !== Infinity) endTs = Math.min(now, Math.max(endTs, oldest + span));
    return [endTs - span, endTs];
  }
  let first = Infinity;
  let last = -Infinity;
  for (const pts of streams) {
    if (pts.length === 0) continue;
    first = Math.min(first, pts[Math.max(0, pts.length - LIVE_POINTS)]!.ts);
    last = Math.max(last, pts[pts.length - 1]!.ts);
  }
  if (first === Infinity) return [now - LIVE_MIN_SPAN_MS, now];
  const endTs = Math.max(last, now);
  return [Math.min(first, endTs - LIVE_MIN_SPAN_MS), endTs];
}

/**
 * Gesti sul grafico:
 * - pressione prolungata → cursore, che segue il dito;
 * - trascinamento orizzontale (se `canPan`) → scorrimento nel tempo.
 * Finché nessuno dei due è partito, il gesto si cede allo scorrimento verticale della dashboard.
 */
function useChartGesture(
  setCursor: (x: number | null) => void,
  pan: (dx: number) => void,
  width: number,
  enabled: boolean,
  canPan: boolean,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = useRef<'idle' | 'cursor' | 'pan'>('idle');
  const startX = useRef(0);
  const startY = useRef(0);
  const lastPageX = useRef(0);
  const clamp = (x: number) => Math.max(0, Math.min(width, x));
  const cancelTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const end = () => {
    cancelTimer();
    mode.current = 'idle';
    setCursor(null);
  };
  return {
    onStartShouldSetResponder: () => enabled,
    onResponderGrant: (e: GestureResponderEvent) => {
      const { locationX, pageX, pageY } = e.nativeEvent;
      startX.current = pageX;
      startY.current = pageY;
      lastPageX.current = pageX;
      mode.current = 'idle';
      timer.current = setTimeout(() => {
        timer.current = null;
        if (mode.current !== 'idle') return;
        mode.current = 'cursor';
        setCursor(clamp(locationX));
      }, HOLD_MS);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const { locationX, pageX, pageY } = e.nativeEvent;
      if (mode.current === 'cursor') {
        setCursor(clamp(locationX));
        return;
      }
      if (mode.current === 'pan') {
        pan(pageX - lastPageX.current);
        lastPageX.current = pageX;
        return;
      }
      const dx = Math.abs(pageX - startX.current);
      const dy = Math.abs(pageY - startY.current);
      if (dx > 10 || dy > 10) {
        cancelTimer();
        if (canPan && dx > dy) {
          mode.current = 'pan';
          lastPageX.current = pageX;
        }
      }
    },
    onResponderTerminationRequest: () => mode.current === 'idle',
    onResponderRelease: end,
    onResponderTerminate: end,
  };
}

function Legend({
  streams,
  visible,
  theme,
  align,
  onToggle,
}: {
  streams: ChartStream[];
  visible: boolean[];
  theme: DashboardTheme;
  align: 'left' | 'center' | 'right';
  onToggle: (i: number) => void;
}) {
  return (
    <View style={[styles.legend, { justifyContent: JUSTIFY[align] }]}>
      {streams.map((s, i) =>
        s.title === '' && !s.hasPin ? null : (
          <Pressable key={i} onPress={() => onToggle(i)} style={[styles.legendItem, { opacity: visible[i] ? 1 : 0.5 }]} hitSlop={6}>
            <MaterialCommunityIcons name={TYPE_ICON[s.graphType]} size={12} color={widgetColor(s.color, theme)} />
            <Text style={[styles.legendText, { color: theme.text }]} numberOfLines={1}>
              {s.title.toUpperCase()}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}

/** Punto più vicino a `ts` (per tempo). */
function nearest(points: GraphPoint[], ts: number): GraphPoint | undefined {
  let best: GraphPoint | undefined;
  let bestDist = Infinity;
  for (const p of points) {
    const d = Math.abs(p.ts - ts);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

function CursorValues({
  streams,
  shown,
  visible,
  ts,
  theme,
  align,
}: {
  streams: ChartStream[];
  shown: GraphPoint[][];
  visible: boolean[];
  ts: number;
  theme: DashboardTheme;
  align: 'left' | 'center' | 'right';
}) {
  // Sovrapposto a titolo e legenda (e, se serve più spazio, alla parte alta del grafico): per ogni stream
  // il nome e sotto il valore.
  return (
    <View
      style={[styles.legend, styles.values, { justifyContent: JUSTIFY[align], backgroundColor: withAlpha(theme.background, 0.75) }]}
      pointerEvents="none"
    >
      {streams.map((s, i) => {
        if (!visible[i] || !s.hasPin) return null;
        const p = nearest(shown[i] ?? [], ts);
        const color = widgetColor(s.color, theme);
        return (
          <View key={i} style={styles.valueItem}>
            <View style={styles.legendItem}>
              <MaterialCommunityIcons name={TYPE_ICON[s.graphType]} size={12} color={color} />
              <Text style={[styles.legendText, { color: theme.text }]} numberOfLines={1}>
                {s.title.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.valueText, { color }]}>{p ? formatStreamValue(s, p.value) : '--'}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PeriodPicker({
  periods,
  period,
  theme,
  onSelect,
}: {
  periods: GraphPeriod[];
  period: GraphPeriod;
  theme: DashboardTheme;
  onSelect: (p: GraphPeriod) => void;
}) {
  return (
    <View style={styles.periods}>
      {periods.map((p) => (
        <Pressable key={p} onPress={() => onSelect(p)} hitSlop={8} style={styles.periodItem}>
          <Text style={[styles.periodText, { color: p === period ? theme.accent : theme.periodText }]}>{periodLabel(p)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

// ——— Disegno ———

interface ChartSvgProps {
  width: number;
  height: number;
  streams: ChartStream[];
  shown: GraphPoint[][];
  visible: boolean[];
  scales: ReturnType<typeof computeScales>;
  start: number;
  end: number;
  period: GraphPeriod;
  theme: DashboardTheme;
  labels: number;
  xAxis: boolean;
  cursorX: number | null;
  cursorTs: number | null;
}

function ChartSvg(p: ChartSvgProps) {
  const { width, height, streams, shown, visible, scales, start, end, period, theme } = p;
  // Margini verticali: metà testo sopra; sotto anche le etichette dell'asse X.
  const top = AXIS_FONT / 2;
  const bottom = p.xAxis ? AXIS_FONT + 8 : AXIS_FONT / 2;
  const plotH = Math.max(1, height - top - bottom);
  const span = Math.max(1, end - start);
  const xOf = (ts: number) => ((ts - start) / span) * width;
  const yOf = (sc: StreamScale, v: number) => top + (1 - toFrac(sc, v)) * plotH;
  const yOfFrac = (f: number) => top + (1 - f) * plotH;
  const step = periodStepMs(period);

  const series = streams.map((s, i) => {
    const sc = scales.streams[i]!;
    if (!visible[i] || !sc.hasData) return null;
    return { s, sc, i, pts: shown[i]! };
  });

  return (
    <Svg width={width} height={height}>
      <Defs>
        {series.map((d) => d && <StreamGradients key={d.i} id={d.i} s={d.s} sc={d.sc} theme={theme} y0={yOfFrac(d.sc.b0)} y1={yOfFrac(d.sc.b1)} />)}
      </Defs>
      {series.map(
        (d) =>
          d && (
            <G key={d.i}>
              {renderSeries(d.s, d.sc, d.pts, d.i, { xOf, yOf, step, stepPx: (step / span) * width, theme })}
            </G>
          ),
      )}
      <YAxes {...p} top={top} plotH={plotH} />
      {p.xAxis && <XAxis {...p} />}
      {p.cursorX !== null && p.cursorTs !== null && (
        <Cursor x={p.cursorX} ts={p.cursorTs} height={height} width={width} period={period} theme={theme} />
      )}
    </Svg>
  );
}

function StreamGradients({ id, s, sc, theme, y0, y1 }: { id: number; s: ChartStream; sc: StreamScale; theme: DashboardTheme; y0: number; y1: number }) {
  const at = (v: number) => widgetColor(s.color, theme, { min: sc.lo, max: sc.hi, value: v });
  const mid = (sc.lo + sc.hi) / 2;
  // In alto il colore del valore massimo, in basso quello del minimo. Il riempimento sfuma verso il basso.
  const top = isGradient(s.color) ? at(sc.hi) : widgetColor(s.color, theme);
  const middle = isGradient(s.color) ? at(mid) : top;
  const low = isGradient(s.color) ? at(sc.lo) : top;
  return (
    <>
      <LinearGradient id={`line${id}`} x1="0" y1={y1} x2="0" y2={y0} gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={top} />
        <Stop offset="0.5" stopColor={middle} />
        <Stop offset="1" stopColor={low} />
      </LinearGradient>
      <LinearGradient id={`fill${id}`} x1="0" y1={y1} x2="0" y2={y0} gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={top} stopOpacity={GRADIENT_FILL_ALPHA[0]} />
        <Stop offset="0.5" stopColor={middle} stopOpacity={GRADIENT_FILL_ALPHA[1]} />
        <Stop offset="1" stopColor={low} stopOpacity={GRADIENT_FILL_ALPHA[2]} />
      </LinearGradient>
    </>
  );
}

interface Geometry {
  xOf: (ts: number) => number;
  yOf: (sc: StreamScale, v: number) => number;
  step: number;
  stepPx: number;
  theme: DashboardTheme;
}

function renderSeries(s: ChartStream, sc: StreamScale, pts: GraphPoint[], id: number, g: Geometry) {
  const color = widgetColor(s.color, g.theme);
  // Colori a gradiente: linea con gradiente verticale dal colore del minimo a quello del massimo.
  const line = isGradient(s.color) ? `url(#line${id})` : color;
  const baseY = g.yOf(sc, sc.lo);

  if (s.graphType === 'BAR') {
    const w = Math.max(1, g.stepPx * 0.8);
    return pts.map((pt, k) => {
      const y = g.yOf(sc, pt.value);
      return <Rect key={k} x={g.xOf(pt.ts) - w / 2} y={Math.min(y, baseY)} width={w} height={Math.abs(baseY - y)} fill={line} fillOpacity={BAR_ALPHA} />;
    });
  }

  // Segmenti continui: senza connectMissingPointsEnabled la linea si interrompe dove mancano punti.
  const segments: GraphPoint[][] = [];
  let current: GraphPoint[] = [];
  for (const pt of pts) {
    const prev = current[current.length - 1];
    if (prev && !s.connectMissing && pt.ts - prev.ts > g.step * 1.5) {
      segments.push(current);
      current = [];
    }
    current.push(pt);
  }
  if (current.length > 0) segments.push(current);

  const stepped = s.graphType === 'BINARY';
  const linePath = (seg: GraphPoint[]) =>
    seg
      .map((pt, k) => {
        const x = g.xOf(pt.ts).toFixed(1);
        const y = g.yOf(sc, plotValue(s, pt.value)).toFixed(1);
        if (k === 0) return `M${x},${y}`;
        if (stepped) {
          const prevY = g.yOf(sc, plotValue(s, seg[k - 1]!.value)).toFixed(1);
          return `L${x},${prevY}L${x},${y}`;
        }
        return `L${x},${y}`;
      })
      .join('');

  return segments.map((seg, k) => {
    const path = linePath(seg);
    const x0 = g.xOf(seg[0]!.ts).toFixed(1);
    const x1 = g.xOf(seg[seg.length - 1]!.ts).toFixed(1);
    const area = `${path}L${x1},${baseY.toFixed(1)}L${x0},${baseY.toFixed(1)}Z`;
    let fill: string;
    let fillOpacity = 1;
    if (stepped) {
      fill = line;
      fillOpacity = BINARY_FILL_ALPHA;
    } else if (s.graphType === 'FILLED_LINE') {
      fill = line;
      fillOpacity = AREA_ALPHA;
    } else {
      fill = `url(#fill${id})`;
    }
    return (
      <G key={k}>
        <Path d={area} fill={fill} fillOpacity={fillOpacity} />
        <Path d={path} stroke={line} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      </G>
    );
  });
}

/** Testo con alone del colore di sfondo, per le etichette degli assi. */
function HaloText({ x, y, text, color, anchor, theme }: { x: number; y: number; text: string; color: string; anchor: 'start' | 'middle' | 'end'; theme: DashboardTheme }) {
  return (
    <>
      <SvgText x={x} y={y} fontSize={AXIS_FONT} fontFamily={FONT.regular} textAnchor={anchor} stroke={theme.background} strokeWidth={3} fill={theme.background}>
        {text}
      </SvgText>
      <SvgText x={x} y={y} fontSize={AXIS_FONT} fontFamily={FONT.regular} textAnchor={anchor} fill={color}>
        {text}
      </SvgText>
    </>
  );
}

/** Larghezza approssimata di un'etichetta (le cifre del font sono larghe circa 0,55 em). */
const textWidth = (s: string) => s.length * AXIS_FONT * 0.55;

function YAxes(p: ChartSvgProps & { top: number; plotH: number }) {
  const { scales, streams, theme, labels, width, top, plotH } = p;
  const ys = Array.from({ length: labels }, (_, k) => top + plotH - (k / (labels - 1)) * plotH);
  const baseline = AXIS_FONT / 2.5;
  const axisColor = withAlpha(theme.text, 0.4);

  if (scales.shared) {
    const { lo, hi, decimals } = scales.shared;
    if (!scales.streams.some((sc) => sc.hasData)) return null;
    return (
      <>
        {ys.map((y, k) => (
          <HaloText key={k} x={4} y={y + baseline} text={formatFixed(lo + (k / (labels - 1)) * (hi - lo), decimals)} color={axisColor} anchor="start" theme={theme} />
        ))}
      </>
    );
  }

  // Una colonna di etichette per stream, affiancate dal bordo verso l'interno.
  const out: ReactElement[] = [];
  const offset = { left: 4, right: width - 4 };
  // Con 4 assi si disegna nell'ordine 0, 1, 3, 2: a destra il quarto stream sta sul bordo.
  const order = streams.map((_, i) => i);
  if (scales.streams.filter((sc) => sc.axis).length === 4 && streams.length === 4) order.splice(2, 2, 3, 2);
  order.forEach((i) => {
    const s = streams[i]!;
    const sc = scales.streams[i]!;
    if (!sc.axis || !p.visible[i]) return;
    const side = sc.axis;
    const x = offset[side];
    const anchor = side === 'left' ? 'start' : 'end';
    const colorAt = (v: number) => widgetColor(s.color, theme, { min: sc.lo, max: sc.hi, value: v });
    let entries: { y: number; text: string; color: string }[];
    if (sc.binary) {
      entries = [
        { y: top + (1 - sc.b0) * plotH, text: s.low || 'OFF', color: colorAt(sc.lo) },
        { y: top + (1 - sc.b1) * plotH, text: s.high || 'ON', color: colorAt(sc.hi) },
      ];
    } else if (sc.b0 === 0 && sc.b1 === 1) {
      entries = ys.map((y, k) => {
        const v = fromFrac(sc, k / (labels - 1));
        return { y, text: formatFixed(v, sc.axisDecimals), color: colorAt(v) };
      });
    } else {
      // HEIGHT: etichette solo nella fascia dello stream, quante ce ne stanno.
      const bandPx = (sc.b1 - sc.b0) * plotH;
      const n = Math.max(1, Math.min(Math.floor(labels * (sc.b1 - sc.b0)), Math.floor(bandPx / (AXIS_FONT * 1.2))));
      entries = Array.from({ length: n + 1 }, (_, k) => {
        const f = sc.b0 + (k / n) * (sc.b1 - sc.b0);
        const v = fromFrac(sc, f);
        return { y: top + (1 - f) * plotH, text: formatFixed(v, sc.axisDecimals), color: colorAt(v) };
      });
    }
    const colWidth = Math.max(...entries.map((e) => textWidth(e.text)));
    entries.forEach((e, k) => out.push(<HaloText key={`${i}-${k}`} x={x} y={e.y + baseline} text={e.text} color={e.color} anchor={anchor} theme={theme} />));
    offset[side] += side === 'left' ? colWidth + 4 : -(colWidth + 4);
  });
  return <>{out}</>;
}

function XAxis({ start, end, period, width, height, theme }: ChartSvgProps) {
  const n = xLabelCount(period);
  const color = withAlpha(theme.text, 0.4);
  return (
    <>
      {Array.from({ length: n }, (_, k) => {
        const f = k / (n - 1);
        const anchor = k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle';
        return (
          <SvgText key={k} x={f * width} y={height - 3} fontSize={AXIS_FONT} fontFamily={FONT.regular} textAnchor={anchor} fill={color}>
            {formatAxisTime(start + f * (end - start), period)}
          </SvgText>
        );
      })}
    </>
  );
}

function Cursor({ x, ts, height, width, period, theme }: { x: number; ts: number; height: number; width: number; period: GraphPeriod; theme: DashboardTheme }) {
  const text = formatFullTime(ts, period);
  const w = text.length * 7 + 12;
  const left = Math.max(0, Math.min(width - w, x - w / 2));
  return (
    <>
      <Line x1={x} y1={0} x2={x} y2={height} stroke={theme.text} strokeWidth={1} />
      <Rect x={left} y={2} width={w} height={18} rx={9} fill={theme.text} />
      <SvgText x={left + w / 2} y={15} fontSize={12} fontFamily={FONT.medium} textAnchor="middle" fill={theme.background}>
        {text.toUpperCase()}
      </SvgText>
    </>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, paddingTop: 4, paddingBottom: 2 },
  title: { fontFamily: FONT.regular, paddingHorizontal: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingVertical: 4, columnGap: 10, rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, fontFamily: FONT.regular },
  valueText: { fontSize: 16, fontFamily: FONT.regular },
  header: { zIndex: 1 },
  values: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, columnGap: 16 },
  valueItem: { alignItems: 'flex-start' },
  chart: { flex: 1, minHeight: 20 },
  message: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  messageText: { fontSize: 12, fontFamily: FONT.regular },
  older: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  periods: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingTop: 2 },
  periodItem: { paddingVertical: 4, paddingHorizontal: 2 },
  periodText: { fontSize: 14, fontFamily: FONT.light },
});
