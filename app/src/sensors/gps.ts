// GPS Stream and GPS Trigger (server widgets GPS_STREAMING and GPS_TRIGGER), only with the app open: location
// updates start when the app comes to the foreground and stop when it goes to the background (no background
// location, which Google Play accepts only after a declaration that is often rejected). Values are written through
// the server HTTP API with the device token (GET https://<host>/<token>/update/V#?value=…); the server sends them
// back to the app with HARDWARE, so the widget updates by itself.
//
// - GPS Stream: "lat\0lon\0alt\0speed" at every update. Accuracy 0 high (the widget interval, if set),
//   1 balanced, 2 low power, with the intervals in INTERVALS.
// - GPS Trigger: circular region (lat, lon, radius) checked at every update (Android geofencing needs the background
//   permission): "1" on entering if triggerOnEnter, or on exiting otherwise; "0" in the opposite case. The first
//   position reports the current state, then only the changes.
import * as Location from 'expo-location';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';
import { canControl, type Profile, type Widget } from '@/model/profile';

/** Intervals for accuracy 0 / 1 / 2 (ms). */
const INTERVALS = [30000, 300000, 1800000];
const ACCURACY = [Location.Accuracy.High, Location.Accuracy.Balanced, Location.Accuracy.Low];

interface PinTarget {
  token: string;
  pin: string;
}

interface Trigger extends PinTarget {
  id: string;
  lat: number;
  lon: number;
  radius: number;
  onEnter: boolean;
}

/** What to watch: built from the profile at every sync. */
interface Plan {
  base: string;
  accuracy: Location.Accuracy;
  timeInterval: number;
  streams: PinTarget[];
  triggers: Trigger[];
}

const enabled = Platform.OS === 'android';

/** "example.com" o "wss://example.com/dashws" → "https://example.com". */
export function httpBase(host: string): string {
  const h = host.trim();
  if (!h.includes('://')) return `https://${h}`;
  const u = new URL(h);
  return `${u.protocol === 'ws:' || u.protocol === 'http:' ? 'http' : 'https'}://${u.host}`;
}

async function writePin(base: string, target: PinTarget, values: string[]): Promise<void> {
  const query = values.map((v) => `value=${encodeURIComponent(v)}`).join('&');
  try {
    await fetch(`${base}/${target.token}/update/${target.pin}?${query}`);
  } catch {
    // No network: the next update will try again.
  }
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

/** Location "while using the app": asks only if it is missing. */
async function ensurePermission(): Promise<boolean> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  return fg.granted;
}

// --- Location updates with the app in the foreground ---

let plan: Plan | null = null;
let subscription: Location.LocationSubscription | null = null;
let appState: NativeEventSubscription | null = null;
/** Last state of each trigger (inside the region or not): kept across syncs, so a sync does not report it again. */
const inside = new Map<string, boolean>();

function watch(next: Plan | null): void {
  plan = next;
  const ids = new Set(next?.triggers.map((tr) => tr.id));
  for (const id of [...inside.keys()]) if (!ids.has(id)) inside.delete(id);
  restart();
  if (next) appState ??= AppState.addEventListener('change', restart);
  else {
    appState?.remove();
    appState = null;
  }
}

function restart(): void {
  subscription?.remove();
  subscription = null;
  const p = plan;
  if (!p || AppState.currentState !== 'active') return;
  Location.watchPositionAsync({ accuracy: p.accuracy, timeInterval: p.timeInterval, distanceInterval: 0 }, (loc) => {
    if (plan === p) onPosition(p, loc.coords);
  })
    .then((s) => {
      // Another restart (or a stop) may have happened while this one was starting.
      if (plan === p && AppState.currentState === 'active' && !subscription) subscription = s;
      else s.remove();
    })
    .catch(() => undefined);
}

function onPosition(p: Plan, c: Location.LocationObjectCoords): void {
  const values = [c.latitude, c.longitude, c.altitude ?? 0, c.speed ?? 0].map(String);
  for (const s of p.streams) void writePin(p.base, s, values);
  for (const tr of p.triggers) {
    const now = distance(c.latitude, c.longitude, tr.lat, tr.lon) <= tr.radius;
    if (inside.get(tr.id) === now) continue;
    inside.set(tr.id, now);
    void writePin(p.base, tr, [now === tr.onEnter ? '1' : '0']);
  }
}

/** Distance in meters between two points (haversine). */
function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Aligns the location updates with the GPS Stream / GPS Trigger widgets of the active dashboards of the profile.
 * `null` (logout) stops everything.
 */
export function syncGps(profile: Profile | null, host: string): Promise<void> {
  if (!enabled) return Promise.resolve();
  syncing = syncing.then(() => doSync(profile, host)).catch(() => undefined);
  return syncing;
}

async function doSync(profile: Profile | null, host: string): Promise<void> {
  const streams: PinTarget[] = [];
  const triggers: Trigger[] = [];
  let accuracy = 2;
  let interval = 0;

  for (const dash of profile?.dashBoards ?? []) {
    if (dash.isActive === false || !canControl(dash)) continue;
    const tokens = new Map<number, string>();
    for (const d of dash.devices ?? []) if (typeof d.token === 'string') tokens.set(d.id, d.token);
    for (const w of dash.widgets) {
      if (w.type !== 'GPS_STREAMING' && w.type !== 'GPS_TRIGGER') continue;
      const target = pinTarget(w, tokens);
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
        triggers.push({ ...target, id: `${dash.id}-${w.id}`, lat, lon, radius, onEnter: w.triggerOnEnter === true });
      }
    }
  }

  if (streams.length === 0 && triggers.length === 0) {
    watch(null);
    setPermitted(false);
    return;
  }

  const allowed = await ensurePermission().catch(() => false);
  setPermitted(allowed);
  if (!allowed) return watch(null);
  watch({
    base: httpBase(host),
    accuracy: ACCURACY[accuracy]!,
    timeInterval: accuracy === 0 && interval > 0 ? interval : INTERVALS[accuracy]!,
    streams,
    triggers,
  });
}
