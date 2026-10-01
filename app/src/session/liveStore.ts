// Stato "vivo" della sessione: valori dei pin, proprietà impostate dal firmware e stato dei device.
// Ogni componente si iscrive solo alla sua chiave (useSyncExternalStore), così un aggiornamento
// di un pin ridisegna solo il widget interessato.
import { Command, splitBody, type Message } from '@tinkerblink/protocol';
import { deviceKey, pinKey, widgetPinKey, type Profile } from '@/model/profile';

type Listener = () => void;

/** Righe tenute in memoria per ogni Terminal. */
const TERMINAL_MAX_LINES = 200;

const OP_PIN_TYPE = { vw: 'VIRTUAL', dw: 'DIGITAL', aw: 'ANALOG' } as const;

export class LiveStore {
  private values = new Map<string, string[]>();
  private props = new Map<string, Record<string, string>>();
  private devices = new Map<string, boolean>();
  /** Cronologia dei pin collegati a un widget Terminal (le chiavi vengono registrate in load). */
  private terminalLogs = new Map<string, string[]>();
  private listeners = new Map<string, Set<Listener>>();

  /** Stato iniziale dal profilo: `value` dei widget, `pinsStorage`, stato dei device. */
  load(profile: Profile): void {
    this.values.clear();
    this.props.clear();
    this.devices.clear();
    const previousLogs = this.terminalLogs;
    this.terminalLogs = new Map();
    for (const [key, value] of Object.entries(profile.pinsStorage ?? {})) {
      this.values.set(key, splitBody(value));
    }
    for (const dash of profile.dashBoards) {
      for (const w of dash.widgets) {
        const key = widgetPinKey(dash.id, w);
        if (key && w.value !== undefined && w.value !== null) this.values.set(key, splitBody(String(w.value)));
        // Dopo una riconnessione il profilo viene ricaricato: la cronologia del Terminal si conserva.
        if (key && w.type === 'TERMINAL') this.terminalLogs.set(key, previousLogs.get(key) ?? []);
      }
      for (const d of dash.devices ?? []) this.devices.set(deviceKey(dash.id, d.id), d.status === 'ONLINE');
    }
    this.notifyAll();
  }

  /** Applica un messaggio spontaneo del server. Restituisce true se l'ha riconosciuto. */
  apply(m: Message): boolean {
    if (m.kind !== 'text') return false;
    const parts = splitBody(m.body);
    const target = parts[0] ?? '';
    const [dash, dev = '0'] = target.split('-');
    const dashId = Number(dash);
    const deviceId = Number(dev);
    if (!Number.isFinite(dashId)) return false;

    switch (m.command) {
      // HARDWARE: scrittura del firmware. APP_SYNC: scrittura fatta da un'altra app dello stesso account
      // (il server la rimanda alle altre app con lo stesso body, MobileHardwareLogic).
      case Command.HARDWARE:
      case Command.APP_SYNC: {
        // <dash>-<dev>\0vw\0<pin>\0<v1>[\0<v2>…]
        const pinType = OP_PIN_TYPE[parts[1] as keyof typeof OP_PIN_TYPE];
        const pin = Number(parts[2]);
        if (!pinType || !Number.isFinite(pin)) return false;
        const key = pinKey(dashId, deviceId, pinType, pin);
        const values = parts.slice(3);
        this.appendTerminal(key, values);
        this.set(this.values, key, values);
        return true;
      }
      case Command.SET_WIDGET_PROPERTY: {
        // <dash>-<dev>\0<pin>\0<proprietà>\0<valore>[\0…]  (pin virtuale, eventualmente "V12")
        const pin = Number(String(parts[1] ?? '').replace(/^[vV]/, ''));
        const prop = parts[2];
        if (!Number.isFinite(pin) || !prop) return false;
        const key = pinKey(dashId, deviceId, 'VIRTUAL', pin);
        const current = { ...(this.props.get(key) ?? {}) };
        current[prop] = parts.slice(3).join('\0');
        this.set(this.props, key, current);
        return true;
      }
      case Command.HARDWARE_CONNECTED:
        this.set(this.devices, deviceKey(dashId, deviceId), true);
        return true;
      case Command.DEVICE_OFFLINE:
        this.set(this.devices, deviceKey(dashId, deviceId), false);
        return true;
      default:
        return false;
    }
  }

  /** Aggiornamento locale dopo una scrittura dell'app: il server non rimanda il valore a chi lo ha inviato. */
  setLocal(key: string, values: string[]): void {
    // Il Terminal mostra anche le righe inviate dall'app.
    this.appendTerminal(key, values);
    this.set(this.values, key, values);
  }

  /** Aggiunge le righe alla cronologia se il pin è di un Terminal; "clr" la svuota. */
  private appendTerminal(key: string, values: string[]): void {
    const log = this.terminalLogs.get(key);
    if (!log) return;
    const text = values.join(' ');
    const next = text === 'clr' ? [] : [...log, ...text.split('\n')].slice(-TERMINAL_MAX_LINES);
    this.terminalLogs.set(key, next);
  }

  getValue = (key: string): string[] | undefined => this.values.get(key);
  getTerminalLog = (key: string): string[] | undefined => this.terminalLogs.get(key);
  getProps = (key: string): Record<string, string> | undefined => this.props.get(key);
  isDeviceOnline = (key: string): boolean => this.devices.get(key) ?? false;

  subscribe = (key: string, listener: Listener): (() => void) => {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  };

  private set<T>(map: Map<string, T>, key: string, value: T): void {
    map.set(key, value);
    this.listeners.get(key)?.forEach((l) => l());
  }

  private notifyAll(): void {
    this.listeners.forEach((set) => set.forEach((l) => l()));
  }
}
