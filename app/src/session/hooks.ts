import { useCallback, useSyncExternalStore } from 'react';
import { deviceKey, widgetPinKey, type Widget } from '@/model/profile';
import { gpsPermission } from '@/sensors/gps';
import { sensorValueKey } from '@/sensors/sensorsWorker';
import type { DeviceState, MapPoint, TableState } from './liveStore';
import { useSession } from './SessionContext';

const EMPTY: Record<string, string> = {};

/** Current value of a widget's pin (updated live). */
export function useWidgetValue(dashId: number, widget: Widget): string[] | undefined {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getValue(key) : undefined));
}

/** Properties set by the firmware with setProperty (label, color, labels…). */
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

/** Lines received by a Terminal widget (history kept by the LiveStore). */
export function useTerminalLog(dashId: number, widget: Widget): string[] {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getTerminalLog(key) : undefined)) ?? NO_LINES;
}

/** Points of a Map widget (updated live; "clr" clears them). */
export function useMapPoints(dashId: number, widget: Widget): MapPoint[] {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getMapPoints(key) : NO_POINTS));
}

const NO_POINTS: MapPoint[] = [];

/** Function that writes a widget's pin (values as strings). No-op if the widget has no pin. */
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

/** Full status of a device (online, connection and disconnection times). */
export function useDeviceState(dashId: number, deviceId: number): DeviceState {
  const { store } = useSession();
  const key = deviceKey(dashId, deviceId);
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key]);
  return useSyncExternalStore(subscribe, () => store.getDevice(key));
}

/** Number of offline devices of a dashboard (header badge). */
export function useOfflineCount(dashId: number, deviceIds: number[]): number {
  const { store } = useSession();
  useSyncExternalStore(store.subscribeDevices, store.getDevicesVersion);
  return deviceIds.filter((id) => !store.isDeviceOnline(deviceKey(dashId, id))).length;
}

/** Current values of several pins (LiveStore keys; null = pin not set), for multi-pin widgets. */
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

/** Commands of an LCD in advanced mode since the last "clr" (key of its pin). */
export function useLcdCommands(key: string | null): string[][] {
  const { store } = useSession();
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getLcdCommands(key) : NO_COMMANDS));
}

const NO_COMMANDS: string[][] = [];

/** Rows and current row of a Table widget. */
export function useTable(dashId: number, widget: Widget): TableState {
  const { store } = useSession();
  const key = widgetPinKey(dashId, widget);
  const subscribe = useCallback((cb: () => void) => (key ? store.subscribe(key, cb) : () => {}), [store, key]);
  return useSyncExternalStore(subscribe, () => (key ? store.getTable(key) : NO_TABLE));
}

const NO_TABLE: TableState = { rows: [], current: -1 };

/** Last value read by a phone sensor for a widget (even without a pin). */
export function useSensorValue(dashId: number, widget: Widget): string[] | undefined {
  const { sensors } = useSession();
  const key = sensorValueKey(dashId, widget.id);
  const subscribe = useCallback((cb: () => void) => sensors.subscribe(key, cb), [sensors, key]);
  return useSyncExternalStore(subscribe, () => sensors.getValue(key));
}

/** True if the GPS can also work in the background ("always" permission granted). */
export function useGpsPermission(): boolean {
  return useSyncExternalStore(gpsPermission.subscribe, gpsPermission.get);
}
