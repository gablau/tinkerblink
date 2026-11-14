// Phone sensors (Accelerometer, Gravity, Light, Proximity, Barometer, Humidity, Temperature widgets),
// handled like this:
//
// - an Android sensor stays registered while at least one widget of its type is in an active dashboard
//   and the session is online (in the background the connection closes and the sensors stop);
// - formats: Accelerometer and Gravity "x\0y\0z" (float), Proximity "1" near / "0" far (threshold: half of
//   maxRange), the others the integer value; Temperature is converted to °F if the widget is not in Celsius;
// - the value is written to the widget pin (if any) with HARDWARE, at most every `frequency` ms
//   (the last value received in the interval is sent when it expires).
//
// Current values, also of widgets without a pin, are read with getValue / subscribe (useSensorValue).
import { Platform } from 'react-native';
import { canControl, type Dashboard, type Profile, type Widget } from '@/model/profile';
import TinkerBlinkSensors, { type SensorEvent } from '../../modules/tinkerblink-sensors';

/** Widget type → android.hardware.Sensor constant. */
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
/** Readings above this absolute value are invalid (no supported sensor gets there). */
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

  /** Sensors available on the phone (none on the web). */
  static isAvailable(widgetType: string): boolean {
    const type = SENSOR_TYPES[widgetType];
    if (type === undefined || Platform.OS !== 'android') return false;
    try {
      return TinkerBlinkSensors.isAvailable(type);
    } catch {
      return false;
    }
  }

  /** Registers the sensors of the active dashboards of the profile; `null` stops them all. */
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
    // Invalid values (the emulator sends -1e30 for the temperature right after registering): not sent.
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
