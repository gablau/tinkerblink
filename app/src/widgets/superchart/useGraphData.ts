// SuperChart data: history from the server (GET_ENHANCED_GRAPH_DATA) and, in the LIVE period, the values
// arriving in real time from the devices.
//
// How it works:
// - history is reloaded every 60 s while the chart is visible and the session is connected;
// - previous pages are requested with `page` (the server skips page × points of the period) when
//   scrolling back; when the server answers NO_DATA there are no more;
// - LIVE starts from the last 60 raw values the server keeps in memory for each pin, then appends
//   every write of the pin. If the write has a second value that is a timestamp, that is used;
//   with yAxisScale MINMAX the value is clamped to [yAxisMin, yAxisMax]. At most 1000 points per stream.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphPeriod, GraphPoint } from '@tinkerblink/protocol';
import { useSession } from '@/session/SessionContext';
import type { ChartStream } from './scale';

const REFRESH_MS = 60_000;
const LIVE_MAX_POINTS = 1000;
const LIVE_TRIM = 200;

export interface GraphState {
  /** One series per datastream, in widget order, sorted by time. */
  streams: GraphPoint[][];
  loading: boolean;
  /** Time of the last answer: end of the window for history periods. */
  loadedAt: number;
  /** Last page requested from the server (0 = the latest). */
  page: number;
  loadingOlder: boolean;
  /** The server has no older data. */
  lastPage: boolean;
}

const EMPTY: GraphState = { streams: [], loading: true, loadedAt: 0, page: 0, loadingOlder: false, lastPage: false };

/** Plausible timestamp in ms (after 2001): the firmware can send it as a second value. */
function parseTs(v: string | undefined): number | null {
  if (v === undefined || !/^\d{12,14}$/.test(v)) return null;
  return Number(v);
}

/** Merges older (`older`) and newer (`newer`) data: where they overlap the newer ones win. */
function merge(older: GraphPoint[], newer: GraphPoint[]): GraphPoint[] {
  if (newer.length === 0) return older;
  const first = newer[0]!.ts;
  return [...older.filter((p) => p.ts < first), ...newer];
}

export function useGraphData(
  dashId: number,
  widgetId: number,
  streams: ChartStream[],
  period: GraphPeriod | null,
): GraphState & { loadOlder: () => void } {
  const { status, store, getGraphData } = useSession();
  const [state, setState] = useState<GraphState>(EMPTY);
  const streamsRef = useRef(streams);
  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);
  /** Grows at every period change: answers for a previous period are ignored. */
  const generation = useRef(0);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const online = status === 'online';

  const fetchPage = useCallback(
    (p: GraphPeriod, page: number) =>
      getGraphData({ dashId, widgetId, period: p, page }).then((data) =>
        data ? streamsRef.current.map((_, i) => data.streams[i] ?? []) : null,
      ),
    [getGraphData, dashId, widgetId],
  );

  // Loading from the server: on period change, on (re)connection and every 60 s for history.
  useEffect(() => {
    if (!online || !period) return;
    const gen = ++generation.current;
    let first = true;
    const load = () => {
      if (first) setState({ ...EMPTY, loading: true });
      const fresh = first;
      first = false;
      fetchPage(period, 0)
        .then((fetched) => {
          if (gen !== generation.current) return;
          const now = Date.now();
          setState((s) => {
            const list = fetched ?? streamsRef.current.map(() => []);
            // A reload replaces the recent part and keeps the older pages already loaded.
            const merged = fresh ? list : list.map((pts, i) => merge(s.streams[i] ?? [], pts));
            return { ...s, streams: merged, loading: false, loadedAt: now };
          });
        })
        .catch(() => {
          if (gen === generation.current) setState((s) => ({ ...s, loading: false }));
        });
    };
    load();
    const timer = period === 'LIVE' ? undefined : setInterval(load, REFRESH_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [online, period, fetchPage]);

  /** Requests the next (older) page and prepends it. */
  const loadOlder = useCallback(() => {
    const s = stateRef.current;
    if (!online || !period || period === 'LIVE' || s.loading || s.loadingOlder || s.lastPage) return;
    const gen = generation.current;
    const page = s.page + 1;
    setState((prev) => ({ ...prev, loadingOlder: true }));
    fetchPage(period, page)
      .then((fetched) => {
        if (gen !== generation.current) return;
        const empty = !fetched || fetched.every((pts) => pts.length === 0);
        setState((prev) => ({
          ...prev,
          loadingOlder: false,
          lastPage: empty,
          page: empty ? prev.page : page,
          streams: empty ? prev.streams : fetched.map((pts, i) => merge(pts, prev.streams[i] ?? [])),
        }));
      })
      .catch(() => {
        if (gen === generation.current) setState((prev) => ({ ...prev, loadingOlder: false }));
      });
  }, [online, period, fetchPage]);

  // LIVE: appends the writes to the datastream pins.
  useEffect(() => {
    if (period !== 'LIVE') return;
    return store.subscribePinWrites((key, values, now) => {
      const list = streamsRef.current;
      if (!list.some((s) => s.pinKey === key)) return;
      const value = Number(values[0]);
      if (!Number.isFinite(value)) return;
      const ts = parseTs(values[1]) ?? now;
      setState((prev) => {
        const next = list.map((s, i) => {
          const points = prev.streams[i] ?? [];
          if (s.pinKey !== key) return points;
          const last = points[points.length - 1];
          if (last && last.ts >= ts) return points;
          const v = s.yAxisScale === 'MINMAX' ? Math.min(Math.max(value, s.yAxisMin), s.yAxisMax) : value;
          const grown = [...points, { ts, value: v }];
          return grown.length > LIVE_MAX_POINTS ? grown.slice(LIVE_TRIM) : grown;
        });
        return { ...prev, streams: next, loadedAt: now };
      });
    });
  }, [period, store]);

  return { ...state, loadOlder };
}
