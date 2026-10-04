// GPS Stream e GPS Trigger (widget GPS_STREAMING e GPS_TRIGGER del server): funzionano anche con
// l'app in background e scrivono il pin con l'API HTTP del server e il token del device
// (GET https://<host>/<token>/update/V#?value=…), senza login e quindi senza acon/adis. Il server
// rimanda il valore all'app con HARDWARE, perciò in primo piano il widget si aggiorna da solo.
//
// - GPS Stream: aggiornamenti di posizione (expo-location in un task in background con il servizio in
//   primo piano di Android) → "lat\0lon\0alt\0speed". Precisione 0 alta (intervallo del widget, se c'è),
//   1 bilanciata, 2 a basso consumo, con gli intervalli di INTERVALS.
// - GPS Trigger: geofence circolare (lat, lon, raggio) → "1" all'ingresso se triggerOnEnter, o all'uscita
//   se no; "0" nel caso opposto.
//
// La configurazione (host, token, pin) è salvata in SecureStore perché i task girano anche senza la UI.
// Si aggiorna a ogni caricamento del profilo e si cancella al logout.
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { t } from '@/i18n';
import { canControl, type Profile, type Widget } from '@/model/profile';

const STREAM_TASK = 'blynk-gps-stream';
const TRIGGER_TASK = 'blynk-gps-trigger';
const CONFIG_KEY = 'blynk.gps';

/** Intervalli per precisione 0 / 1 / 2 (ms). */
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
    // Rete assente: il prossimo aggiornamento riproverà.
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

// --- Permesso di posizione (per il colore dei widget: grigi se il GPS non può funzionare) ---

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

/** Posizione sempre consentita (prima "durante l'uso", poi "sempre"). Chiede i permessi solo se mancano. */
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
 * Allinea i task del GPS ai widget GPS Stream / GPS Trigger delle dashboard attive del profilo.
 * `null` (logout) ferma tutto e cancella la configurazione.
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

  // I task si (ri)avviano sempre: la sincronizzazione avviene al caricamento del profilo, quindi con l'app in
  // primo piano. Se il processo era stato riavviato, expo-location ripristina il task in background ma Android
  // non gli permette di avviare il servizio in primo piano: risulta "avviato" senza ricevere posizioni.
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
  // Per sicurezza: nessun task deve restare registrato (e quindi ripristinabile al riavvio) senza widget GPS.
  await TaskManager.unregisterAllTasksAsync().catch(() => undefined);
}
