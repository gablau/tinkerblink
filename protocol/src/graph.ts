// Dati storici dei SuperChart (GET_ENHANCED_GRAPH_DATA, comando 60).
//
// Richiesta: `<dashId>[-<deviceId>]\0<widgetId>\0<period>[\0<page>]` (MobileGetEnhancedGraphDataLogic).
// Pagina N = salta N × punti del periodo.
//
// Risposta: messaggio binario compresso zlib (DeflaterOutputStream, ByteUtils.compress(dashId, data)):
//   int32 dashId
//   per ogni datastream del widget, nell'ordine del widget:
//     int32 numero di record
//     record da 16 byte: float64 valore + int64 timestamp in ms (big-endian)

/** Periodi del server (GraphPeriod.java): punti e granularità. */
export const GRAPH_PERIODS = {
  LIVE: { points: 60, granularity: 'MINUTE' },
  FIFTEEN_MINUTES: { points: 15, granularity: 'MINUTE' },
  THIRTY_MINUTES: { points: 30, granularity: 'MINUTE' },
  ONE_HOUR: { points: 60, granularity: 'MINUTE' },
  THREE_HOURS: { points: 180, granularity: 'MINUTE' },
  SIX_HOURS: { points: 360, granularity: 'MINUTE' },
  TWELVE_HOURS: { points: 720, granularity: 'MINUTE' },
  DAY: { points: 1440, granularity: 'MINUTE' },
  THREE_DAYS: { points: 72, granularity: 'HOURLY' },
  WEEK: { points: 168, granularity: 'HOURLY' },
  TWO_WEEKS: { points: 336, granularity: 'HOURLY' },
  MONTH: { points: 720, granularity: 'HOURLY' },
  THREE_MONTHS: { points: 2160, granularity: 'HOURLY' },
  ALL: { points: 8640, granularity: 'HOURLY' },
  N_DAY: { points: 24, granularity: 'HOURLY' },
  TWO_DAYS: { points: 48, granularity: 'HOURLY' },
  N_THREE_DAYS: { points: 72, granularity: 'HOURLY' },
  N_WEEK: { points: 7, granularity: 'DAILY' },
  N_TWO_WEEKS: { points: 14, granularity: 'DAILY' },
  N_MONTH: { points: 30, granularity: 'DAILY' },
  N_THREE_MONTHS: { points: 90, granularity: 'DAILY' },
  SIX_MONTHS: { points: 180, granularity: 'DAILY' },
  ONE_YEAR: { points: 360, granularity: 'DAILY' },
} as const;

export type GraphPeriod = keyof typeof GRAPH_PERIODS;

export interface GraphPoint {
  ts: number;
  value: number;
}

export interface GraphData {
  dashId: number;
  /** Una serie per datastream, nell'ordine di `dataStreams` del widget. */
  streams: GraphPoint[][];
}

const RECORD_SIZE = 16;

export function parseGraphData(raw: Uint8Array): GraphData {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let off = 0;
  const need = (n: number) => {
    if (off + n > raw.byteLength) throw new Error(`Dati del grafico troncati all'offset ${off}`);
  };
  need(4);
  const dashId = view.getInt32(off);
  off += 4;
  const streams: GraphPoint[][] = [];
  while (off < raw.byteLength) {
    need(4);
    const count = view.getInt32(off);
    off += 4;
    need(count * RECORD_SIZE);
    const points: GraphPoint[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const value = view.getFloat64(off);
      const ts = Number(view.getBigInt64(off + 8));
      points[i] = { ts, value };
      off += RECORD_SIZE;
    }
    streams.push(points);
  }
  return { dashId, streams };
}
