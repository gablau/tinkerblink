// Stato "vivo" della sessione: valori dei pin, proprietà impostate dal firmware e stato dei device.
// Ogni componente si iscrive solo alla sua chiave (useSyncExternalStore), così un aggiornamento
// di un pin ridisegna solo il widget interessato.
import { Command, splitBody, SYNC_MESSAGE_ID, type Message } from '@tinkerblink/protocol';
import { deviceKey, pinKey, widgetPinKey, type Profile } from '@/model/profile';

type Listener = () => void;

/** Righe tenute in memoria per ogni Terminal. */
const TERMINAL_MAX_LINES = 200;

// "vw" = scrittura; "vm" = valori multipli, usato dal server nelle sincronizzazioni dei widget a più
// valori, come la cronologia dei Terminal (Widget.makeMultiValueHardwareBody).
const OP_PIN_TYPE = {
  vw: 'VIRTUAL',
  dw: 'DIGITAL',
  aw: 'ANALOG',
  vm: 'VIRTUAL',
  dm: 'DIGITAL',
  am: 'ANALOG',
} as const;

/** Canale di notifica per qualsiasi cambio di stato dei device (badge e pannello dei device). */
const DEVICES_CHANNEL = '__devices__';

export interface DeviceState {
  online: boolean;
  /** Ultima connessione / disconnessione (ms), come nel profilo; 0 = mai. */
  connectTime: number;
  disconnectTime: number;
}

const OFFLINE: DeviceState = { online: false, connectTime: 0, disconnectTime: 0 };

export class LiveStore {
  private values = new Map<string, string[]>();
  private props = new Map<string, Record<string, string>>();
  private devices = new Map<string, DeviceState>();
  /** Cresce a ogni cambio di stato dei device: è lo "snapshot" per chi osserva tutti i device. */
  private devicesVersion = 0;
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
        // Il server rimanda la cronologia con la sincronizzazione; fino ad allora si tiene quella che c'era.
        if (key && w.type === 'TERMINAL') this.terminalLogs.set(key, previousLogs.get(key) ?? []);
      }
      for (const d of dash.devices ?? []) {
        this.devices.set(deviceKey(dash.id, d.id), {
          online: d.status === 'ONLINE',
          connectTime: d.connectTime ?? 0,
          disconnectTime: d.disconnectTime ?? 0,
        });
      }
    }
    this.devicesVersion++;
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
      // HARDWARE: scrittura del firmware. APP_SYNC: risposta a una sincronizzazione (msgId SYNC_MESSAGE_ID)
      // oppure scrittura fatta da un'altra app dello stesso account (MobileHardwareLogic).
      case Command.HARDWARE:
      case Command.APP_SYNC: {
        // <dash>-<dev>\0vw\0<pin>\0<v1>[\0<v2>…]
        const pinType = OP_PIN_TYPE[parts[1] as keyof typeof OP_PIN_TYPE];
        const pin = Number(parts[2]);
        if (!pinType || !Number.isFinite(pin)) return false;
        const key = pinKey(dashId, deviceId, pinType, pin);
        const values = parts.slice(3);
        const isSync = m.command === Command.APP_SYNC && m.msgId === SYNC_MESSAGE_ID;
        if (isSync && this.terminalLogs.has(key)) {
          // Sincronizzazione di un Terminal: i valori sono le ultime righe tenute dal server.
          this.terminalLogs.set(key, values.flatMap((v) => v.split('\n')).slice(-TERMINAL_MAX_LINES));
          this.set(this.values, key, values.slice(-1));
        } else {
          this.appendTerminal(key, values);
          this.set(this.values, key, values);
        }
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
        this.setDevice(deviceKey(dashId, deviceId), { online: true, connectTime: Date.now() });
        return true;
      case Command.DEVICE_OFFLINE:
        this.setDevice(deviceKey(dashId, deviceId), { online: false, disconnectTime: Date.now() });
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

  getValue = (key: string): string[] | undefined => this.values.get(key);
  getTerminalLog = (key: string): string[] | undefined => this.terminalLogs.get(key);
  getProps = (key: string): Record<string, string> | undefined => this.props.get(key);
  getDevice = (key: string): DeviceState => this.devices.get(key) ?? OFFLINE;
  isDeviceOnline = (key: string): boolean => this.getDevice(key).online;
  getDevicesVersion = (): number => this.devicesVersion;

  subscribe = (key: string, listener: Listener): (() => void) => {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  };

  /** Notifica per qualsiasi cambio di stato dei device. */
  subscribeDevices = (listener: Listener): (() => void) => this.subscribe(DEVICES_CHANNEL, listener);

  /** Aggiunge le righe alla cronologia se il pin è di un Terminal; "clr" la svuota. */
  private appendTerminal(key: string, values: string[]): void {
    const log = this.terminalLogs.get(key);
    if (!log) return;
    const text = values.join(' ');
    const next = text === 'clr' ? [] : [...log, ...text.split('\n')].slice(-TERMINAL_MAX_LINES);
    this.terminalLogs.set(key, next);
  }

  private setDevice(key: string, patch: Partial<DeviceState>): void {
    this.set(this.devices, key, { ...this.getDevice(key), ...patch });
    this.devicesVersion++;
    this.listeners.get(DEVICES_CHANNEL)?.forEach((l) => l());
  }

  private set<T>(map: Map<string, T>, key: string, value: T): void {
    map.set(key, value);
    this.listeners.get(key)?.forEach((l) => l());
  }

  private notifyAll(): void {
    this.listeners.forEach((set) => set.forEach((l) => l()));
  }
}
