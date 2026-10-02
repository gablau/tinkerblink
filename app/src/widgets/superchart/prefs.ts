// Preferenze locali dei SuperChart: periodo scelto e stream nascosti dalla legenda, per dashboard e widget.
// Restano
// sul telefono e non vanno al server: il `period` del profilo è solo quello iniziale impostato nell'editor.
// AsyncStorage: su Android un database locale, sul web localStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GraphPeriod } from '@tinkerblink/protocol';

const KEY = 'blynk.superchart';

export interface ChartPrefs {
  period?: GraphPeriod;
  /** Indici dei datastream nascosti. */
  hidden?: number[];
}

let cache: Record<string, ChartPrefs> | null = null;
let loading: Promise<Record<string, ChartPrefs>> | null = null;

const keyOf = (dashId: number, widgetId: number) => `${dashId}-${widgetId}`;

/** Carica le preferenze una volta sola (le chiamate successive riusano la stessa promessa). */
export function loadChartPrefs(): Promise<Record<string, ChartPrefs>> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as Record<string, ChartPrefs>) : {}))
    .catch(() => ({}))
    .then((prefs) => (cache = prefs));
  return loading;
}

/** Preferenze già caricate, oppure undefined se il caricamento non è ancora finito. */
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
