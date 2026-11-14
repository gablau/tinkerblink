// Live state of the session: pin values, properties set by the firmware and device status.
// Each component subscribes only to its own key (useSyncExternalStore), so a pin update
// re-renders only the widget concerned.
import { Command, splitBody, SYNC_MESSAGE_ID, type Message } from '@tinkerblink/protocol';
import { deviceKey, pinKey, widgetPinKey, type PinType, type Profile } from '@/model/profile';

type Listener = () => void;
/** Pin write received from the server (for LIVE charts): pin key, values, arrival time. */
export type PinWriteListener = (key: string, values: string[], ts: number) => void;

/** Lines kept in memory for each Terminal. */
const TERMINAL_MAX_LINES = 200;

// "vw" = write; "vm" = multiple values, used by the server when syncing widgets with several values,
// such as the Terminal history (Widget.makeMultiValueHardwareBody).
const OP_PIN_TYPE = {
  vw: 'VIRTUAL',
  dw: 'DIGITAL',
  aw: 'ANALOG',
  vm: 'VIRTUAL',
  dm: 'DIGITAL',
  am: 'ANALOG',
} as const;

/** Notification channel for any device status change (badge and device panel). */
const DEVICES_CHANNEL = '__devices__';

export interface DeviceState {
  online: boolean;
  /** Last connection / disconnection (ms), as in the profile; 0 = never. */
  connectTime: number;
  disconnectTime: number;
}

const OFFLINE: DeviceState = { online: false, connectTime: 0, disconnectTime: 0 };

/** Map widget point: the firmware writes "<index>\0<lat>\0<lon>\0<name>" (WidgetMap.h). */
export interface MapPoint {
  index: number;
  lat: number;
  lon: number;
  label: string;
}

/** Table widget row (server Table.Row). */
export interface TableRow {
  id: number;
  name: string;
  value: string;
  isSelected: boolean;
}

export interface TableState {
  rows: TableRow[];
  /** Current row set by the firmware with "pick" (index, -1 = none). */
  current: number;
}

const EMPTY_TABLE: TableState = { rows: [], current: -1 };

/**
 * Applies a Table command like the server does (Table.updateIfSame): add, update, pick, select, deselect, clr,
 * plus "order from to" (reordering done by the app). A sync sends all the rows as groups of 5 values
 * "add\0id\0name\0value\0selected": in that case the rows are replaced.
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

/** "<index>\0<lat>\0<lon>[\0<name>]" → point; null if not valid. */
function parseMapPoint(values: string[]): MapPoint | null {
  const [i, lat, lon, ...name] = values;
  const p = { index: Number(i), lat: Number(lat), lon: Number(lon), label: name.join(' ') };
  return Number.isFinite(p.index) && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null;
}

export class LiveStore {
  private values = new Map<string, string[]>();
  private props = new Map<string, Record<string, string>>();
  private devices = new Map<string, DeviceState>();
  /** Grows at every device status change: it is the "snapshot" for whoever observes all devices. */
  private devicesVersion = 0;
  /** History of the pins bound to a Terminal widget (the keys are registered in load). */
  private terminalLogs = new Map<string, string[]>();
  /**
   * Points of the Map widgets, by index (the same index replaces the point). The server keeps the last
   * commands in memory (Map.lastCommands) and resends them one by one with APP_SYNC; "clr" clears them.
   */
  private mapPoints = new Map<string, MapPoint[]>();
  /**
   * Commands of the LCDs in advanced mode since the last "clr" ("p\0x\0y\0text"): the component replays them
   * to rebuild the 16×2 display. The server keeps them in memory (LCD.lastCommands) and resends them with APP_SYNC.
   */
  private lcdCommands = new Map<string, string[][]>();
  /** Rows of the Table widgets: the server keeps them in the profile (rows) and resends them with APP_SYNC. */
  private tables = new Map<string, TableState>();
  private listeners = new Map<string, Set<Listener>>();
  private writeListeners = new Set<PinWriteListener>();

  /** Initial state from the profile: widget `value`, `pinsStorage`, device status. */
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
        // The server resends the history with the sync; until then the previous one is kept.
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
        // Multi-pin widgets (zeRGBa): each pin has its value in pins[i].value.
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

  /** Applies a message the server sent on its own. Returns true if it was recognized. */
  apply(m: Message): boolean {
    if (m.kind !== 'text') return false;
    const parts = splitBody(m.body);
    const target = parts[0] ?? '';
    const [dash, dev = '0'] = target.split('-');
    const dashId = Number(dash);
    const deviceId = Number(dev);
    if (!Number.isFinite(dashId)) return false;

    switch (m.command) {
      // HARDWARE: firmware write. APP_SYNC: reply to a sync (msgId SYNC_MESSAGE_ID) or a write made by
      // another app of the same account (MobileHardwareLogic).
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
          // Terminal sync: the values are the last lines kept by the server.
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
        // <dash>-<dev>\0<pin>\0<property>\0<value>[\0…]  (virtual pin, possibly "V12")
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

  /** Local update after a write by the app: the server does not send the value back to the sender. */
  setLocal(key: string, values: string[]): void {
    // The Terminal also shows the lines sent by the app.
    this.appendTerminal(key, values);
    // Row selection or reordering of a Table done by the app.
    this.updateTable(key, values, false);
    this.set(this.values, key, values);
  }

  /** Restores the value from before a write rejected by the server (Terminal and Table are left alone). */
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

  /** Notified for every pin write that comes from the server (not for syncs). */
  subscribePinWrites = (listener: PinWriteListener): (() => void) => {
    this.writeListeners.add(listener);
    return () => this.writeListeners.delete(listener);
  };

  /** Notified for any device status change. */
  subscribeDevices = (listener: Listener): (() => void) => this.subscribe(DEVICES_CHANNEL, listener);

  /** Updates the points if the pin belongs to a Map widget (the notification comes with the value update). */
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

  /** Applies the command if the pin belongs to a Table (the notification comes with the value update). */
  private updateTable(key: string, values: string[], isSync: boolean): void {
    const state = this.tables.get(key);
    if (state) this.tables.set(key, applyTableCommand(state, values, isSync));
  }

  /** Records the command if the pin belongs to an advanced LCD: "clr" empties, "p" is appended (at most 100). */
  private updateLcd(key: string, values: string[]): void {
    const commands = this.lcdCommands.get(key);
    if (!commands) return;
    if (values[0] === 'clr') this.lcdCommands.set(key, []);
    else if (values[0] === 'p') this.lcdCommands.set(key, [...commands, values].slice(-100));
  }

  /** Appends the lines to the history if the pin belongs to a Terminal; "clr" empties it. */
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
