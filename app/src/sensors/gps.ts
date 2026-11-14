// GPS Stream and GPS Trigger (server widgets GPS_STREAMING and GPS_TRIGGER): they also work with the
// app in the background and write the pin through the server HTTP API with the device token
// (GET https://<host>/<token>/update/V#?value=…), without a login and therefore without acon/adis. The server
// sends the value back to the app with HARDWARE, so in the foreground the widget updates by itself.
//
// - GPS Stream: location updates (expo-location in a background task with the Android foreground
//   service) → "lat\0lon\0alt\0speed". Accuracy 0 high (the widget interval, if set),
//   1 balanced, 2 low power, with the intervals in INTERVALS.
// - GPS Trigger: circular geofence (lat, lon, radius) → "1" on entering if triggerOnEnter, or on exiting
//   otherwise; "0" in the opposite case.
//
// The configuration (host, token, pins) is stored in SecureStore because the tasks also run without the UI.
// It is updated on every profile load and deleted on logout.
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { t } from '@/i18n';
import { canControl, type Profile, type Widget } from '@/model/profile';

const STREAM_TASK = 'blynk-gps-stream';
const TRIGGER_TASK = 'blynk-gps-trigger';
const CONFIG_KEY = 'blynk.gps';

/** Intervals for accuracy 0 / 1 / 2 (ms). */
const INTERVALS = [30000, 300000, 1800000];
const ACCURACY = [Location.Accuracy.High, Location.Accuracy.Balanced, Location.Accuracy.Low];

interface PinTarget {
  token: string;
  pin: string;
}

interface TriggerTarget extends PinTarget {
  onEnter: boolean;
}

interface GpsConfig {
  base: string;
  streams: PinTarget[];
  triggers: Record<string, TriggerTarget>;
}

const enabled = Platform.OS === 'android';

/** "example.com" o "wss://example.com/dashws" → "https://example.com". */
export function httpBase(host: string): string {
  const h = host.trim();
  if (!h.includes('://')) return `https://${h}`;
  const u = new URL(h);
  return `${u.protocol === 'ws:' || u.protocol === 'http:' ? 'http' : 'https'}://${u.host}`;
}

async function loadConfig(): Promise<GpsConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as GpsConfig) : null;
  } catch {
    return null;
  }
}

async function writePin(base: string, target: PinTarget, values: string[]): Promise<void> {
  const query = values.map((v) => `value=${encodeURIComponent(v)}`).join('&');
  try {
    await fetch(`${base}/${target.token}/update/${target.pin}?${query}`);
  } catch {
    // No network: the next update will try again.
  }
}

if (enabled) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(STREAM_TASK, async ({ data, error }) => {
    const loc = data?.locations?.at(-1);
    if (error || !loc) return;
    const config = await loadConfig();
    if (!config) return;
    const c = loc.coords;
    const values = [c.latitude, c.longitude, c.altitude ?? 0, c.speed ?? 0].map(String);
    await Promise.all(config.streams.map((s) => writePin(config.base, s, values)));
  });

  TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
    TRIGGER_TASK,
    async ({ data, error }) => {
      if (error || !data?.region?.identifier) return;
      const config = await loadConfig();
      const target = config?.triggers[data.region.identifier];
      if (!config || !target) return;
      const entered = data.eventType === Location.GeofencingEventType.Enter;
      await writePin(config.base, target, [entered === target.onEnter ? '1' : '0']);
    },
  );
}

const PIN_LETTER = { VIRTUAL: 'V', DIGITAL: 'D', ANALOG: 'A' } as const;

function pinTarget(widget: Widget, tokens: Map<number, string>): PinTarget | null {
  if (widget.pin === undefined || widget.pin < 0 || !widget.pinType) return null;
  const token = tokens.get(widget.deviceId ?? 0);
  return token ? { token, pin: `${PIN_LETTER[widget.pinType]}${widget.pin}` } : null;
}

// --- Location permission (for the widget color: grey if the GPS cannot work) ---

let permitted = false;
const permissionListeners = new Set<() => void>();

export const gpsPermission = {
  get: (): boolean => permitted,
  subscribe: (l: () => void): (() => void) => {
    permissionListeners.add(l);
    return () => permissionListeners.delete(l);
  },
};

function setPermitted(value: boolean): void {
  if (permitted === value) return;
  permitted = value;
  permissionListeners.forEach((l) => l());
}

/** Location always allowed (first "while using the app", then "always"). Asks only for missing permissions. */
async function ensureBackgroundPermission(): Promise<boolean> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;
  let bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted;
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Aligns the GPS tasks with the GPS Stream / GPS Trigger widgets of the active dashboards of the profile.
 * `null` (logout) stops everything and deletes the configuration.
 */
export function syncGps(profile: Profile | null, host: string): Promise<void> {
  if (!enabled) return Promise.resolve();
  syncing = syncing.then(() => doSync(profile, host)).catch(() => undefined);
  return syncing;
}

async function doSync(profile: Profile | null, host: string): Promise<void> {
  const streams: PinTarget[] = [];
  const triggers: Record<string, TriggerTarget> = {};
  const regions: Location.LocationRegion[] = [];
  let accuracy = 2;
  let interval = 0;

  for (const dash of profile?.dashBoards ?? []) {
    if (dash.isActive === false || !canControl(dash)) continue;
    const tokens = new Map<number, string>();
    for (const d of dash.devices ?? []) if (typeof d.token === 'string') tokens.set(d.id, d.token);
    for (const w of dash.widgets) {
      if (w.type !== 'GPS_STREAMING' && w.type !== 'GPS_TRIGGER') continue;      const target = pinTarget(w, tokens);
      if (!target) continue;
      if (w.type === 'GPS_STREAMING') {
        streams.push(target);
        const acc = typeof w.accuracy === 'number' ? Math.max(0, Math.min(2, w.accuracy)) : 0;
        if (acc < accuracy) accuracy = acc;
        if (acc === 0 && typeof w.interval === 'number' && w.interval > 0) {
          interval = interval > 0 ? Math.min(interval, w.interval) : w.interval;
        }
      } else {
        const lat = Number(w.triggerLat);
        const lon = Number(w.triggerLon);
        const radius = Number(w.triggerRadius);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(radius > 0) || (lat === 0 && lon === 0)) continue;
        const id = `${dash.id}-${w.id}`;
        triggers[id] = { ...target, onEnter: w.triggerOnEnter === true };
        regions.push({ identifier: id, latitude: lat, longitude: lon, radius, notifyOnEnter: true, notifyOnExit: true });
      }
    }
  }

  const timeInterval = accuracy === 0 && interval > 0 ? interval : INTERVALS[accuracy]!;
  const base = httpBase(host);

  if (streams.length === 0 && regions.length === 0) {
    await stopTasks();
    await SecureStore.deleteItemAsync(CONFIG_KEY).catch(() => undefined);
    setPermitted(false);
    return;
  }

  const config: GpsConfig = { base, streams, triggers };
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(config));

  const allowed = await ensureBackgroundPermission().catch(() => false);
  setPermitted(allowed);
  if (!allowed) return;

  // The tasks are always (re)started: syncing happens when the profile loads, so with the app in the
  // foreground. If the process was restarted, expo-location restores the task in the background but Android
  // does not let it start the foreground service: it looks "started" without receiving locations.
  const streamRunning = await Location.hasStartedLocationUpdatesAsync(STREAM_TASK).catch(() => false);
  if (streams.length === 0) {
    if (streamRunning) await Location.stopLocationUpdatesAsync(STREAM_TASK);
  } else {
    await Location.startLocationUpdatesAsync(STREAM_TASK, {
      accuracy: ACCURACY[accuracy],
      timeInterval,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: t.gpsNotificationTitle,
        notificationBody: t.gpsNotificationBody,
        killServiceOnDestroy: false,
      },
    });
  }

  const triggerRunning = await Location.hasStartedGeofencingAsync(TRIGGER_TASK).catch(() => false);
  if (regions.length === 0) {
    if (triggerRunning) await Location.stopGeofencingAsync(TRIGGER_TASK);
  } else {
    await Location.startGeofencingAsync(TRIGGER_TASK, regions);
  }
}

async function stopTasks(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(STREAM_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(STREAM_TASK).catch(() => undefined);
  }
  if (await Location.hasStartedGeofencingAsync(TRIGGER_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(TRIGGER_TASK).catch(() => undefined);
  }
  // To be safe: no task must stay registered (and so restorable on restart) without a GPS widget.
  await TaskManager.unregisterAllTasksAsync().catch(() => undefined);
}
