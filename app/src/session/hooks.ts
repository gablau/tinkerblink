import { useCallback, useSyncExternalStore } from 'react';
import { deviceKey, widgetPinKey, type Widget } from '@/model/profile';
import type { DeviceState, MapPoint, TableState } from './liveStore';
import { useSession } from './SessionContext';

const EMPTY: Record<string, string> = {};

/** Valore corrente del pin di un widget (aggiornato in tempo reale). */
export function useWidgetValue(dashId: number, widget: Widget): string[] | undefined {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getValue(key) : undefined));
}

/** Proprietà impostate dal firmware con setProperty (label, color, labels…). */
export function useWidgetProps(dashId: number, widget: Widget): Record<string, string> {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getProps(key) : undefined)) ?? EMPTY;
}

export function useDeviceOnline(dashId: number, deviceId: number): boolean {
  const { store } = useSession();
  const key = deviceKey(dashId, deviceId);
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key]);
  return useSyncExternalStore(subscribe, () => store.isDeviceOnline(key));
}

const NO_LINES: string[] = [];

/** Righe ricevute da un widget Terminal (cronologia tenuta dal LiveStore). */
export function useTerminalLog(dashId: number, widget: Widget): string[] {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getTerminalLog(key) : undefined)) ?? NO_LINES;
}

/** Punti di un widget Map (aggiornati in tempo reale; "clr" li cancella). */
export function useMapPoints(dashId: number, widget: Widget): MapPoint[] {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getMapPoints(key) : NO_POINTS));
}

const NO_POINTS: MapPoint[] = [];

/** Funzione per scrivere il pin di un widget (valori come stringhe). No-op se il widget non ha un pin. */
export function useWritePin(dashId: number, widget: Widget): (values: (string | number)[]) => void {
  const { writePin } = useSession();
  return useCallback(
    (values: (string | number)[]) => {
      if (widget.pin === undefined || widget.pin < 0 || widget.pinType !== 'VIRTUAL') return;
      writePin(dashId, widget.deviceId ?? 0, widget.pin, values.map(String));
    },
    [writePin, dashId, widget],
  );
}

/** Stato completo di un device (online, orari di connessione e disconnessione). */
export function useDeviceState(dashId: number, deviceId: number): DeviceState {
  const { store } = useSession();
  const key = deviceKey(dashId, deviceId);
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key]);
  return useSyncExternalStore(subscribe, () => store.getDevice(key));
}

/** Numero di device offline di una dashboard (badge dell'intestazione). */
export function useOfflineCount(dashId: number, deviceIds: number[]): number {
  const { store } = useSession();
  useSyncExternalStore(store.subscribeDevices, store.getDevicesVersion);
  return deviceIds.filter((id) => !store.isDeviceOnline(deviceKey(dashId, id))).length;
}

/** Valori correnti di più pin (chiavi del LiveStore; null = pin non impostato), per i widget a più pin. */
export function usePinValues(keys: (string | null)[]): (string[] | undefined)[] {
  const { store } = useSession();
  const joined = keys.join('|');
  const subscribe = useCallback(
    (cb: () => void) => {
      const subs = joined.split('|').filter((k) => k !== '').map((k) => store.subscribe(k, cb));
      return () => subs.forEach((u) => u());
    },
    [store, joined],
  );
  const snapshot = () => keys.map((k) => (k ? store.getValue(k)?.join('\0') : undefined)).join('|');
  const raw = useSyncExternalStore(subscribe, snapshot);
  return raw.split('|').map((v) => (v === '' ? undefined : v.split('\0')));
}

/** Comandi di un LCD in modalità avanzata dall'ultimo "clr" (chiave del suo pin). */
export function useLcdCommands(key: string | null): string[][] {
  const { store } = useSession();
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getLcdCommands(key) : NO_COMMANDS));
}

const NO_COMMANDS: string[][] = [];

/** Righe e riga corrente di un widget Table. */
export function useTable(dashId: number, widget: Widget): TableState {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getTable(key) : NO_TABLE));
}

const NO_TABLE: TableState = { rows: [], current: -1 };
