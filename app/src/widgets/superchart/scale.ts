// SuperChart datastreams and vertical scales (dataStreams of the server Superchart.java).
// Pure functions, no React.
//
// Each stream has a value range [lo, hi] drawn in a band [b0, b1] of the chart
// height (0 = bottom, 1 = top):
// - overrideYAxis = true: one axis shared by all streams, rounded to "round" values;
// - otherwise each stream has its own scale, according to yAxisScale:
//   AUTO   = data min and max, over the whole height;
//   MINMAX = fixed yAxisMin and yAxisMax, over the whole height;
//   HEIGHT = data min and max, in a band from yAxisMin% to yAxisMax% of the height;
//   DELTA  = like AUTO, but the range is at least `delta` wide, centered on the data.
// BINARY streams are pin.min or pin.max depending on whether the value exceeds the `flip` threshold.
import type { GraphPoint } from '@tinkerblink/protocol';
import { pinKey, type PinType, type Widget } from '@/model/profile';

export type GraphType = 'LINE' | 'FILLED_LINE' | 'BAR' | 'BINARY';
export type YAxisScale = 'AUTO' | 'MINMAX' | 'HEIGHT' | 'DELTA';

export interface ChartStream {
  title: string;
  color: unknown;
  graphType: GraphType;
  yAxisScale: YAxisScale;
  yAxisMin: number;
  yAxisMax: number;
  delta: number;
  showYAxis: boolean;
  /** The datastream has a pin (without a pin the server has no data and the axis is not shown). */
  hasPin: boolean;
  /** Pin key in the LiveStore, for the LIVE period updates; null if not applicable. */
  pinKey: string | null;
  suffix: string;
  fractionDigits: number;
  low: string;
  high: string;
  flip: number;
  pinMin: number;
  pinMax: number;
  connectMissing: boolean;
}

interface RawStream {
  title?: string;
  color?: unknown;
  graphType?: string;
  yAxisScale?: string;
  isPercentMaxMin?: boolean;
  yAxisMin?: number;
  yAxisMax?: number;
  delta?: number;
  showYAxis?: boolean;
  suffix?: string;
  maximumFractionDigits?: number;
  low?: string;
  high?: string;
  flip?: number;
  targetId?: number;
  connectMissingPointsEnabled?: boolean;
  pin?: { pin?: number; pinType?: PinType; min?: number; max?: number };
}

const GRAPH_TYPES: GraphType[] = ['LINE', 'FILLED_LINE', 'BAR', 'BINARY'];
const SCALES: YAxisScale[] = ['AUTO', 'MINMAX', 'HEIGHT', 'DELTA'];
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Widget datastreams (fields of the server GraphDataStream), with defaults and invalid values fixed. */
export function parseStreams(dashId: number, widget: Widget): ChartStream[] {
  const raw = Array.isArray(widget.dataStreams) ? (widget.dataStreams as RawStream[]) : [];
  return raw.map((s) => {
    const pin = s.pin ?? {};
    const hasPin = typeof pin.pin === 'number' && pin.pin >= 0 && !!pin.pinType;
    const targetId = num(s.targetId, 0);
    // targetId < 100000 is a device; 100000-199999 a tag (no LIVE); >= 200000 a Device Selector.
    const liveKey = hasPin && targetId < 100000 ? pinKey(dashId, targetId, pin.pinType!, pin.pin!) : null;
    const scale = SCALES.includes(s.yAxisScale as YAxisScale)
      ? (s.yAxisScale as YAxisScale)
      : s.isPercentMaxMin !== false
        ? 'HEIGHT'
        : 'MINMAX';
    return {
      title: s.title ?? '',
      color: s.color,
      graphType: GRAPH_TYPES.includes(s.graphType as GraphType) ? (s.graphType as GraphType) : 'LINE',
      yAxisScale: scale,
      yAxisMin: num(s.yAxisMin, 0),
      yAxisMax: num(s.yAxisMax, 100),
      delta: num(s.delta, 0),
      showYAxis: s.showYAxis !== false,
      hasPin,
      pinKey: liveKey,
      suffix: s.suffix ?? '',
      fractionDigits: num(s.maximumFractionDigits, 1),
      low: s.low ?? '',
      high: s.high ?? '',
      flip: num(s.flip, 127),
      pinMin: num(pin.min, 0),
      pinMax: num(pin.max, 255),
      connectMissing: s.connectMissingPointsEnabled !== false,
    };
  });
}

/** Drawn value: for BINARY streams it is pin.min or pin.max. */
export function plotValue(s: ChartStream, v: number): number {
  if (s.graphType !== 'BINARY') return v;
  return v > s.flip ? s.pinMax : s.pinMin;
}

export interface StreamScale {
  lo: number;
  hi: number;
  /** Vertical band (0 = bottom, 1 = top). */
  b0: number;
  b1: number;
  binary: boolean;
  hasData: boolean;
  /** Whether it has its own Y axis to draw, and on which side. */
  axis: 'left' | 'right' | null;
  /** Decimals of the axis labels: those set in the datastream (maximumFractionDigits). */
  axisDecimals: number;
}

export interface ChartScales {
  streams: StreamScale[];
  /** With overrideYAxis: shared range and decimals of the single axis (on the left). */
  shared: { lo: number; hi: number; decimals: number } | null;
}

/** "Round" steps of the shared axis. */
function roundUnit(abs: number, up: boolean): number {
  if (up) return abs < 1 ? 1 : abs < 5 ? 5 : 10;
  return abs > 5 ? 5 : 0;
}
function roundTens(abs: number, up: boolean): number {
  return Math.trunc(abs / 10) * 10 + roundUnit(abs % 10, up);
}
function roundHundreds(abs: number, up: boolean): number {
  return Math.trunc(abs / 100) * 100 + roundTens(abs % 100, up);
}
export function niceRound(value: number, up: boolean): number {
  const abs = Math.abs(value);
  const negative = value < 0;
  const dir = negative ? !up : up;
  let r: number;
  if (abs < 10) r = roundUnit(abs, dir);
  else if (abs < 100) r = roundTens(abs, dir);
  else if (abs < 1000) r = roundHundreds(abs, dir);
  else r = Math.trunc(abs / 1000) * 1000 + roundHundreds(abs % 1000, dir);
  return negative ? -r : r;
}

/** Number of Y axis labels based on the widget height in cells. */
export function yLabelCount(widgetHeight: number): number {
  return (widgetHeight - 3) * 2 + 5;
}

/** A stream is drawn only with at least 2 points (1 is enough for bars). */
export function hasValues(s: ChartStream, points: GraphPoint[] | undefined): boolean {
  const n = points?.length ?? 0;
  return n > 1 || (n === 1 && s.graphType === 'BAR');
}

function minMax(s: ChartStream, points: GraphPoint[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const v = plotValue(s, p.value);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

export function computeScales(
  streams: ChartStream[],
  data: (GraphPoint[] | undefined)[],
  visible: boolean[],
  overrideYAxis: boolean,
): ChartScales {
  const withData = streams.map((s, i) => hasValues(s, data[i]));

  if (overrideYAxis) {
    // Shared axis: min and max of all visible streams with data.
    let lo = Infinity;
    let hi = -Infinity;
    streams.forEach((s, i) => {
      if (!withData[i] || !visible[i]) return;
      const [a, b] = s.graphType === 'BINARY' ? [s.pinMin, s.pinMax] : minMax(s, data[i]!);
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    });
    if (lo === Infinity) {
      lo = 0;
      hi = 0;
    } else {
      if (lo === hi) hi += 10;
      if (Math.abs(hi - lo) < 10) {
        lo = Math.floor(lo);
        hi = Math.floor(hi + 1);
      } else {
        lo = niceRound(lo, false);
        hi = niceRound(hi, true);
      }
    }
    // Shared axis: the highest decimals among the visible streams.
    const decimals = Math.max(0, ...streams.filter((_, i) => visible[i] && withData[i]).map((s) => s.fractionDigits));
    return {
      shared: { lo, hi, decimals },
      streams: streams.map((s, i) => ({
        lo,
        hi,
        b0: 0,
        b1: 1,
        binary: s.graphType === 'BINARY',
        hasData: withData[i]!,
        axis: null,
        axisDecimals: decimals,
      })),
    };
  }

  const scales: StreamScale[] = streams.map((s, i) => {
    let lo = 0;
    let hi = 0;
    if (withData[i]) {
      if (s.graphType === 'BINARY') [lo, hi] = [s.pinMin, s.pinMax];
      else if (s.yAxisScale === 'MINMAX') [lo, hi] = [s.yAxisMin, s.yAxisMax];
      else {
        [lo, hi] = minMax(s, data[i]!);
        if (lo === hi) hi += 10;
      }
      if (s.graphType !== 'BINARY' && s.yAxisScale === 'DELTA' && hi - lo < s.delta) {
        const mid = (lo + hi) / 2;
        lo = mid - s.delta / 2;
        hi = lo + s.delta;
      }
    }
    const height = s.yAxisScale === 'HEIGHT';
    return {
      lo,
      hi,
      b0: height ? s.yAxisMin / 100 : 0,
      b1: height ? s.yAxisMax / 100 : 1,
      binary: s.graphType === 'BINARY',
      hasData: withData[i]!,
      axis: null,
      axisDecimals: s.fractionDigits,
    };
  });

  // Axis sides: with 2 axes one left and one right; with an even number
  // above 2 the first two on the left and the others on the right; with an odd number all on the left.
  const withAxis = streams.map((s, i) => s.showYAxis && s.hasPin && withData[i]!);
  const count = withAxis.filter(Boolean).length;
  let side: 'left' | 'right' = 'left';
  streams.forEach((_, i) => {
    if (!withAxis[i]) return;
    scales[i]!.axis = side;
    if (count % 2 === 0) {
      if (count === 2) side = side === 'left' ? 'right' : 'left';
      else if (i === 1) side = 'right';
    }
  });
  return { shared: null, streams: scales };
}

/** Value → vertical position in the stream band (0 = bottom, 1 = top). */
export function toFrac(sc: StreamScale, v: number): number {
  const span = sc.hi - sc.lo;
  if (span === 0) return sc.b0;
  return sc.b0 + ((v - sc.lo) / span) * (sc.b1 - sc.b0);
}

/** Vertical position → value (inverse of toFrac). */
export function fromFrac(sc: StreamScale, f: number): number {
  const band = sc.b1 - sc.b0;
  if (band === 0) return sc.lo;
  return sc.lo + ((f - sc.b0) / band) * (sc.hi - sc.lo);
}

/** Number with a fixed number of decimals. */
export function formatFixed(v: number, decimals: number): string {
  return v.toFixed(Math.max(0, Math.min(10, decimals)));
}

/** Value of the selected point: stream decimals plus the suffix; low/high for BINARY streams. */
export function formatStreamValue(s: ChartStream, v: number): string {
  if (s.graphType === 'BINARY') return plotValue(s, v) === s.pinMin ? s.low || 'OFF' : s.high || 'ON';
  return `${formatFixed(v, s.fractionDigits)}${s.suffix}`;
}
