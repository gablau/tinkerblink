// Local SuperChart preferences: chosen period and streams hidden from the legend, per dashboard and widget.
// They stay
// on the phone and are not sent to the server: the profile `period` is only the initial one set in the editor.
// AsyncStorage: a local database on Android, localStorage on the web.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GraphPeriod } from '@tinkerblink/protocol';

const KEY = 'blynk.superchart';

export interface ChartPrefs {
  period?: GraphPeriod;
  /** Indexes of the hidden datastreams. */
  hidden?: number[];
}

let cache: Record<string, ChartPrefs> | null = null;
let loading: Promise<Record<string, ChartPrefs>> | null = null;

const keyOf = (dashId: number, widgetId: number) => `${dashId}-${widgetId}`;

/** Loads the preferences only once (later calls reuse the same promise). */
export function loadChartPrefs(): Promise<Record<string, ChartPrefs>> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as Record<string, ChartPrefs>) : {}))
    .catch(() => ({}))
    .then((prefs) => (cache = prefs));
  return loading;
}

/** Preferences already loaded, or undefined if loading has not finished yet. */
export function cachedChartPrefs(dashId: number, widgetId: number): ChartPrefs | undefined {
  return cache ? (cache[keyOf(dashId, widgetId)] ?? {}) : undefined;
}

export function saveChartPrefs(dashId: number, widgetId: number, patch: ChartPrefs): void {
  void loadChartPrefs().then((prefs) => {
    const key = keyOf(dashId, widgetId);
    prefs[key] = { ...prefs[key], ...patch };
    return AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => undefined);
  });
}
