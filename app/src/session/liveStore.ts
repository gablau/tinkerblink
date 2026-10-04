// Stato "vivo" della sessione: valori dei pin, proprietà impostate dal firmware e stato dei device.
// Ogni componente si iscrive solo alla sua chiave (useSyncExternalStore), così un aggiornamento
// di un pin ridisegna solo il widget interessato.
import { Command, splitBody, SYNC_MESSAGE_ID, type Message } from '@tinkerblink/protocol';
import { deviceKey, pinKey, widgetPinKey, type PinType, type Profile } from '@/model/profile';

type Listener = () => void;
/** Scrittura di un pin ricevuta dal server (per i grafici LIVE): chiave del pin, valori, ora di arrivo. */
export type PinWriteListener = (key: string, values: string[], ts: number) => void;

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

/** Punto del widget Map: il firmware scrive "<indice>\0<lat>\0<lon>\0<nome>" (WidgetMap.h). */
export interface MapPoint {
  index: number;
  lat: number;
  lon: number;
  label: string;
}

/** Riga del widget Table (Table.Row del server). */
export interface TableRow {
  id: number;
  name: string;
  value: string;
  isSelected: boolean;
}

export interface TableState {
  rows: TableRow[];
  /** Riga corrente impostata dal firmware con "pick" (indice, -1 = nessuna). */
  current: number;
}

const EMPTY_TABLE: TableState = { rows: [], current: -1 };

/**
 * Applica un comando della Table come il server (Table.updateIfSame): add, update, pick, select, deselect, clr,
 * più "order da a" (riordino fatto dall'app). Una sincronizzazione manda tutte le righe come gruppi di 5 valori
 * "add\0id\0nome\0valore\0selezionata": in quel caso le righe si sostituiscono.
 */
function applyTableCommand(state: TableState, values: string[], isSync: boolean): TableState {
  if (isSync && values[0] === 'add' && values.length % 5 === 0) {
    const rows: TableRow[] = [];
    for (let i = 0; i < values.length; i += 5) {
      rows.push({ id: Number(values[i + 1]), name: values[i + 2] ?? '', value: values[i + 3] ?? '', isSelected: values[i + 4] === 'true' });
    }
    return { ...state, rows };
  }
  const [cmd, a, b, c] = values;
  const id = Number(a);
  switch (cmd) {
    case 'clr':
      return { rows: [], current: 0 };
    case 'add': {
      if (values.length < 4 || !Number.isFinite(id)) return state;
      const exists = state.rows.some((r) => r.id === id);
      return {
        ...state,
        rows: exists
          ? state.rows.map((r) => (r.id === id ? { ...r, name: b ?? '', value: c ?? '' } : r))
          : [...state.rows, { id, name: b ?? '', value: c ?? '', isSelected: true }].slice(-100),
      };
    }
    case 'update':
      if (values.length < 4) return state;
      return { ...state, rows: state.rows.map((r) => (r.id === id ? { ...r, name: b ?? '', value: c ?? '' } : r)) };
    case 'pick':
      return Number.isFinite(id) ? { ...state, current: id } : state;
    case 'select':
    case 'deselect':
      return { ...state, rows: state.rows.map((r) => (r.id === id ? { ...r, isSelected: cmd === 'select' } : r)) };
    case 'order': {
      const from = id;
      const to = Number(b);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= state.rows.length) return state;
      const rows = [...state.rows];
      const [moved] = rows.splice(from, 1);
      rows.splice(Math.min(to, rows.length), 0, moved!);
      return { ...state, rows };
    }
    default:
      return state;
  }
}

const NO_POINTS: MapPoint[] = [];
const NO_COMMANDS: string[][] = [];

/** "<indice>\0<lat>\0<lon>[\0<nome>]" → punto; null se non valido. */
function parseMapPoint(values: string[]): MapPoint | null {
  const [i, lat, lon, ...name] = values;
  const p = { index: Number(i), lat: Number(lat), lon: Number(lon), label: name.join(' ') };
  return Number.isFinite(p.index) && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null;
}

export class LiveStore {
  private values = new Map<string, string[]>();
  private props = new Map<string, Record<string, string>>();
  private devices = new Map<string, DeviceState>();
  /** Cresce a ogni cambio di stato dei device: è lo "snapshot" per chi osserva tutti i device. */
  private devicesVersion = 0;
  /** Cronologia dei pin collegati a un widget Terminal (le chiavi vengono registrate in load). */
  private terminalLogs = new Map<string, string[]>();
  /**
   * Punti dei widget Map, per indice (lo stesso indice sostituisce il punto). Il server tiene in memoria gli
   * ultimi comandi (Map.lastCommands) e li rimanda uno per uno con APP_SYNC; "clr" li cancella.
   */
  private mapPoints = new Map<string, MapPoint[]>();
  /**
   * Comandi degli LCD in modalità avanzata dall'ultimo "clr" ("p\0x\0y\0testo"): il componente li riapplica
   * per ricostruire il display 16×2. Il server li tiene in memoria (LCD.lastCommands) e li rimanda con APP_SYNC.
   */
  private lcdCommands = new Map<string, string[][]>();
  /** Righe dei widget Table: il server le tiene nel profilo (rows) e le rimanda con APP_SYNC. */
  private tables = new Map<string, TableState>();
  private listeners = new Map<string, Set<Listener>>();
  private writeListeners = new Set<PinWriteListener>();

  /** Stato iniziale dal profilo: `value` dei widget, `pinsStorage`, stato dei device. */
  load(profile: Profile): void {
    this.values.clear();
    this.props.clear();
    this.devices.clear();
    const previousLogs = this.terminalLogs;
    this.terminalLogs = new Map();
    const previousPoints = this.mapPoints;
    this.mapPoints = new Map();
    const previousLcd = this.lcdCommands;
    this.lcdCommands = new Map();
    this.tables = new Map();
    for (const [key, value] of Object.entries(profile.pinsStorage ?? {})) {
      this.values.set(key, splitBody(value));
    }
    for (const dash of profile.dashBoards) {
      for (const w of dash.widgets) {
        const key = widgetPinKey(dash.id, w);
        if (key && w.value !== undefined && w.value !== null) this.values.set(key, splitBody(String(w.value)));
        // Il server rimanda la cronologia con la sincronizzazione; fino ad allora si tiene quella che c'era.
        if (key && w.type === 'TERMINAL') this.terminalLogs.set(key, previousLogs.get(key) ?? []);
        if (key && w.type === 'MAP') {
          const last = w.value ? parseMapPoint(splitBody(String(w.value))) : null;
          this.mapPoints.set(key, previousPoints.get(key) ?? (last ? [last] : []));
        }
        if (key && w.type === 'TABLE') {
          const rows = Array.isArray(w.rows) ? (w.rows as Partial<TableRow>[]) : [];
          this.tables.set(key, {
            rows: rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? ''), value: String(r.value ?? ''), isSelected: r.isSelected === true })),
            current: typeof w.currentRowIndex === 'number' ? w.currentRowIndex : -1,
          });
        }
        if (w.type === 'LCD' && w.advancedMode === true && Array.isArray(w.pins)) {
          const p = (w.pins as { pin?: number; pinType?: PinType; value?: string }[])[0];
          if (p && p.pin !== undefined && p.pin >= 0 && p.pinType) {
            const lcdKey = pinKey(dash.id, w.deviceId ?? 0, p.pinType, p.pin);
            const last = p.value ? splitBody(String(p.value)) : null;
            this.lcdCommands.set(lcdKey, previousLcd.get(lcdKey) ?? (last && last[0] !== 'clr' ? [last] : []));
          }
        }
        // Widget a più pin (zeRGBa): ogni pin ha il suo valore in pins[i].value.
        if (Array.isArray(w.pins)) {
          for (const p of w.pins as { pin?: number; pinType?: PinType; value?: string }[]) {
            if (p.pin === undefined || p.pin < 0 || !p.pinType || p.value === undefined || p.value === null) continue;
            this.values.set(pinKey(dash.id, w.deviceId ?? 0, p.pinType, p.pin), splitBody(String(p.value)));
          }
        }
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
        this.updateMap(key, values);
        this.updateLcd(key, values);
        this.updateTable(key, values, isSync);
        if (isSync && this.terminalLogs.has(key)) {
          // Sincronizzazione di un Terminal: i valori sono le ultime righe tenute dal server.
          this.terminalLogs.set(key, values.flatMap((v) => v.split('\n')).slice(-TERMINAL_MAX_LINES));
          this.set(this.values, key, values.slice(-1));
        } else {
          this.appendTerminal(key, values);
          this.set(this.values, key, values);
          const now = Date.now();
          this.writeListeners.forEach((l) => l(key, values, now));
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
    // Selezione o riordino delle righe di una Table fatti dall'app.
    this.updateTable(key, values, false);
    this.set(this.values, key, values);
  }

  /** Rimette il valore di prima di una scrittura rifiutata dal server (senza toccare Terminal e Table). */
  restoreValue(key: string, values: string[] | undefined): void {
    this.set(this.values, key, values ?? []);
  }

  getValue = (key: string): string[] | undefined => this.values.get(key);
  getTerminalLog = (key: string): string[] | undefined => this.terminalLogs.get(key);
  getMapPoints = (key: string): MapPoint[] => this.mapPoints.get(key) ?? NO_POINTS;
  getLcdCommands = (key: string): string[][] => this.lcdCommands.get(key) ?? NO_COMMANDS;
  getTable = (key: string): TableState => this.tables.get(key) ?? EMPTY_TABLE;
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

  /** Notifica per ogni scrittura di un pin che arriva dal server (non per le sincronizzazioni). */
  subscribePinWrites = (listener: PinWriteListener): (() => void) => {
    this.writeListeners.add(listener);
    return () => this.writeListeners.delete(listener);
  };

  /** Notifica per qualsiasi cambio di stato dei device. */
  subscribeDevices = (listener: Listener): (() => void) => this.subscribe(DEVICES_CHANNEL, listener);

  /** Aggiorna i punti se il pin è di un widget Map (la notifica arriva con l'aggiornamento del valore). */
  private updateMap(key: string, values: string[]): void {
    const points = this.mapPoints.get(key);
    if (!points) return;
    if (values[0] === 'clr') {
      this.mapPoints.set(key, []);
      return;
    }
    const p = parseMapPoint(values);
    if (p) this.mapPoints.set(key, [...points.filter((q) => q.index !== p.index), p]);
  }

  /** Applica il comando se il pin è di una Table (la notifica arriva con l'aggiornamento del valore). */
  private updateTable(key: string, values: string[], isSync: boolean): void {
    const state = this.tables.get(key);
    if (state) this.tables.set(key, applyTableCommand(state, values, isSync));
  }

  /** Registra il comando se il pin è di un LCD avanzato: "clr" svuota, "p" si aggiunge (al massimo 100). */
  private updateLcd(key: string, values: string[]): void {
    const commands = this.lcdCommands.get(key);
    if (!commands) return;
    if (values[0] === 'clr') this.lcdCommands.set(key, []);
    else if (values[0] === 'p') this.lcdCommands.set(key, [...commands, values].slice(-100));
  }

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
