// Sensori del telefono (widget Accelerometer, Gravity, Light, Proximity, Barometer, Humidity, Temperature),
// gestiti così:
//
// - un sensore Android resta registrato finché c'è almeno un widget del suo tipo in una dashboard attiva
//   e la sessione è online (in background la connessione si chiude e i sensori si fermano);
// - formati: Accelerometer e Gravity "x\0y\0z" (float), Proximity "1" vicino / "0" lontano (soglia: metà di
//   maxRange), gli altri il valore intero; la Temperature si converte in °F se il widget non è in Celsius;
// - il valore si scrive sul pin del widget (se c'è) con HARDWARE, al massimo ogni `frequency` ms
//   (l'ultimo valore arrivato nell'intervallo si invia alla scadenza).
//
// I valori correnti, anche dei widget senza pin, si leggono con getValue / subscribe (useSensorValue).
import { Platform } from 'react-native';
import { canControl, type Dashboard, type Profile, type Widget } from '@/model/profile';
import TinkerBlinkSensors, { type SensorEvent } from '../../modules/tinkerblink-sensors';

/** Tipo del widget → costante di android.hardware.Sensor. */
export const SENSOR_TYPES: Record<string, number> = {
  ACCELEROMETER: 1,
  GRAVITY: 9,
  PROXIMITY: 8,
  BAROMETER: 6,
  HUMIDITY: 12,
  LIGHT: 5,
  TEMPERATURE: 13,
};

const DEFAULT_FREQUENCY_MS = 100;
/** Oltre questo valore assoluto una lettura è considerata non valida (nessun sensore supportato ci arriva). */
const MAX_VALID = 1e7;

type Write = (dashId: number, deviceId: number, pin: number, values: string[]) => void;

interface Target {
  dashId: number;
  widget: Widget;
  lastSent: number;
  pending?: string[];
  timer?: ReturnType<typeof setTimeout>;
}

export function sensorValueKey(dashId: number, widgetId: number): string {
  return `${dashId}-${widgetId}`;
}

function format(widget: Widget, e: SensorEvent): string[] {
  const v = e.values;
  switch (widget.type) {
    case 'ACCELEROMETER':
    case 'GRAVITY':
      return [String(v[0] ?? 0), String(v[1] ?? 0), String(v[2] ?? 0)];
    case 'PROXIMITY':
      return [(v[0] ?? 0) < e.maxRange / 2 ? '1' : '0'];
    case 'TEMPERATURE': {
      const c = Math.trunc(v[0] ?? 0);
      return [String(widget.isCelsius === false ? Math.round((c * 9) / 5 + 32) : c)];
    }
    default:
      return [String(Math.trunc(v[0] ?? 0))];
  }
}

export class SensorsWorker {
  private targets = new Map<number, Target[]>();
  private values = new Map<string, string[]>();
  private listeners = new Map<string, Set<() => void>>();
  private subscription: { remove(): void } | null = null;
  private profile: Profile | null = null;

  constructor(private readonly write: Write) {}

  /** Sensori disponibili sul telefono (sul web nessuno). */
  static isAvailable(widgetType: string): boolean {
    const type = SENSOR_TYPES[widgetType];
    if (type === undefined || Platform.OS !== 'android') return false;
    try {
      return TinkerBlinkSensors.isAvailable(type);
    } catch {
      return false;
    }
  }

  /** Registra i sensori delle dashboard attive del profilo; `null` li ferma tutti. */
  update(profile: Profile | null): void {
    if (profile === this.profile) return;
    this.profile = profile;
    const wanted = new Map<number, Target[]>();
    if (profile && Platform.OS === 'android') {
      for (const dash of profile.dashBoards) {
        if (dash.isActive === false || !canControl(dash)) continue;
        for (const widget of sensorWidgets(dash)) {
          const type = SENSOR_TYPES[widget.type]!;
          const list = wanted.get(type) ?? [];
          list.push({ dashId: dash.id, widget, lastSent: 0 });
          wanted.set(type, list);
        }
      }
    }
    for (const [type, list] of this.targets) {
      list.forEach((t) => t.timer && clearTimeout(t.timer));
      if (!wanted.has(type)) TinkerBlinkSensors.stop(type);
    }
    for (const type of wanted.keys()) {
      if (!this.targets.has(type)) TinkerBlinkSensors.start(type);
    }
    this.targets = wanted;
    if (wanted.size > 0 && !this.subscription) {
      this.subscription = TinkerBlinkSensors.addListener('onSensor', this.onSensor);
    } else if (wanted.size === 0 && this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  getValue = (key: string): string[] | undefined => this.values.get(key);

  subscribe = (key: string, listener: () => void): (() => void) => {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  };

  private onSensor = (e: SensorEvent): void => {
    // Valori non validi (l'emulatore manda -1e30 per la temperatura appena registrato): non si inviano.
    if (e.values.some((v) => !Number.isFinite(v) || Math.abs(v) > MAX_VALID)) return;
    for (const t of this.targets.get(e.type) ?? []) {
      const values = format(t.widget, e);
      const key = sensorValueKey(t.dashId, t.widget.id);
      const old = this.values.get(key);
      if (!old || old.join('\0') !== values.join('\0')) {
        this.values.set(key, values);
        this.listeners.get(key)?.forEach((l) => l());
      }
      this.send(t, values);
    }
  };

  private send(t: Target, values: string[]): void {
    const { widget } = t;
    if (widget.pin === undefined || widget.pin < 0 || widget.pinType !== 'VIRTUAL') return;
    const frequency = typeof widget.frequency === 'number' && widget.frequency > 0 ? widget.frequency : DEFAULT_FREQUENCY_MS;
    const elapsed = Date.now() - t.lastSent;
    if (elapsed >= frequency) {
      t.lastSent = Date.now();
      this.write(t.dashId, widget.deviceId ?? 0, widget.pin, values);
      return;
    }
    t.pending = values;
    t.timer ??= setTimeout(() => {
      t.timer = undefined;
      if (!t.pending || !this.targets.get(SENSOR_TYPES[widget.type]!)?.includes(t)) return;
      const v = t.pending;
      t.pending = undefined;
      t.lastSent = Date.now();
      this.write(t.dashId, widget.deviceId ?? 0, widget.pin!, v);
    }, frequency - elapsed);
  }
}

function sensorWidgets(dash: Dashboard): Widget[] {
  return dash.widgets.filter((w) => SENSOR_TYPES[w.type] !== undefined);
}
