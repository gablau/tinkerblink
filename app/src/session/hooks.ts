import { useCallback, useSyncExternalStore } from 'react';
import { deviceKey, widgetPinKey, type Widget } from '@/model/profile';
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
