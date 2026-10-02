// Dati di un SuperChart: storico dal server (GET_ENHANCED_GRAPH_DATA) e, nel periodo LIVE, i valori che
// arrivano in tempo reale dai device.
//
// Funzionamento:
// - lo storico si ricarica ogni 60 s mentre il grafico è visibile e la sessione è connessa;
// - le pagine precedenti si chiedono con `page` (il server salta page × punti del periodo) quando si
//   scorre indietro; quando il server risponde NO_DATA non ce ne sono altre;
// - LIVE parte dagli ultimi 60 valori grezzi che il server tiene in memoria per ogni pin, poi aggiunge
//   ogni scrittura del pin. Se la scrittura ha un secondo valore che è un timestamp, si usa quello;
//   con yAxisScale MINMAX il valore è limitato a [yAxisMin, yAxisMax]. Al massimo 1000 punti per stream.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphPeriod, GraphPoint } from '@tinkerblink/protocol';
import { useSession } from '@/session/SessionContext';
import type { ChartStream } from './scale';

const REFRESH_MS = 60_000;
const LIVE_MAX_POINTS = 1000;
const LIVE_TRIM = 200;

export interface GraphState {
  /** Una serie per datastream, nell'ordine del widget, in ordine di tempo. */
  streams: GraphPoint[][];
  loading: boolean;
  /** Ora dell'ultima risposta: fine della finestra dei periodi storici. */
  loadedAt: number;
  /** Ultima pagina chiesta al server (0 = la più recente). */
  page: number;
  loadingOlder: boolean;
  /** Il server non ha dati più vecchi. */
  lastPage: boolean;
}

const EMPTY: GraphState = { streams: [], loading: true, loadedAt: 0, page: 0, loadingOlder: false, lastPage: false };

/** Timestamp in ms plausibile (dopo il 2001): il firmware può inviarlo come secondo valore. */
function parseTs(v: string | undefined): number | null {
  if (v === undefined || !/^\d{12,14}$/.test(v)) return null;
  return Number(v);
}

/** Unisce dati più vecchi (`older`) e più recenti (`newer`): dove si sovrappongono vincono i più recenti. */
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
  /** Cresce a ogni cambio di periodo: le risposte di un periodo precedente si ignorano. */
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

  // Caricamento dal server: al cambio di periodo, alla (ri)connessione e ogni 60 s per lo storico.
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
            // Il ricaricamento sostituisce la parte recente e tiene le pagine più vecchie già caricate.
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

  /** Chiede la pagina successiva (più vecchia) e la aggiunge in testa. */
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

  // LIVE: aggiunge le scritture dei pin dei datastream.
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
