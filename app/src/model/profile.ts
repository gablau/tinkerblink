// Model of the profile returned by LOAD_PROFILE_GZIPPED. Only the fields the app uses: the received JSON
// is kept intact (the editor needs the round-trip, so unknown fields are not lost).

export type PinType = 'VIRTUAL' | 'DIGITAL' | 'ANALOG';

export interface Widget {
  id: number;
  type: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tabId?: number;
  deviceId?: number;
  pin?: number;
  pinType?: PinType;
  value?: string;
  color?: number;
  min?: number;
  max?: number;
  labels?: string[];
  [key: string]: unknown;
}

export interface Device {
  id: number;
  name: string;
  boardType?: string;
  connectionType?: string;
  status?: 'ONLINE' | 'OFFLINE';
  /** Last connection / disconnection (ms); missing if the device has never been online. */
  connectTime?: number;
  disconnectTime?: number;
  /** Device token for the HTTP API: used by the background GPS, shown only in the project settings (never logged). */
  token?: string;
  [key: string]: unknown;
}

export interface Dashboard {
  id: number;
  name: string;
  isActive?: boolean;
  createdAt?: number;
  updatedAt?: number;
  theme?: string;
  keepScreenOn?: boolean;
  isAppConnectedOn?: boolean;
  isNotificationsOff?: boolean;
  isShared?: boolean;
  widgetBackgroundOn?: boolean;
  color?: number;
  isDefaultColor?: boolean;
  widgets: Widget[];
  devices?: Device[];
  /**
   * Another user's project assigned by the administrator (newer server, docs/APP-CLIENT.md of the fork):
   * never editable; with control false, device commands are forbidden too (the server replies NOT_ALLOWED).
   */
  assigned?: { owner: string; control: boolean };
}

/** Can commands be sent to the devices? False only for read-only assigned projects. */
export function canControl(dash: Dashboard): boolean {
  return dash.assigned ? dash.assigned.control === true : true;
}

export interface Profile {
  dashBoards: Dashboard[];
  /** "<dashId>-<deviceId>-v<pin>" → last value of the pins without a dedicated widget. */
  pinsStorage?: Record<string, string>;
}

export interface TabsWidget extends Widget {
  type: 'TABS';
  tabs?: { id: number; label: string }[];
}

const PIN_LETTER: Record<PinType, string> = { VIRTUAL: 'v', DIGITAL: 'd', ANALOG: 'a' };

/** Key of a pin, in the same format as `pinsStorage`: "<dashId>-<deviceId>-v<pin>". */
export function pinKey(dashId: number, deviceId: number, pinType: PinType, pin: number): string {
  return `${dashId}-${deviceId}-${PIN_LETTER[pinType]}${pin}`;
}

/** Key of a widget's pin, or null if the widget has no pin. */
export function widgetPinKey(dashId: number, w: Widget): string | null {
  if (w.pin === undefined || w.pin < 0 || !w.pinType) return null;
  return pinKey(dashId, w.deviceId ?? 0, w.pinType, w.pin);
}

export function deviceKey(dashId: number, deviceId: number): string {
  return `${dashId}-${deviceId}`;
}

/** Blynk color (signed ARGB int, or "#RRGGBB" from setProperty) → CSS color. */
export function toCssColor(color: unknown, fallback = '#23C48E'): string {
  if (typeof color === 'string' && color.startsWith('#')) return color;
  if (typeof color !== 'number') return fallback;
  const argb = color >>> 0;
  const a = (argb >>> 24) & 0xff;
  const rgb = (argb & 0xffffff).toString(16).padStart(6, '0');
  return a === 0xff ? `#${rgb}` : `#${rgb}${a.toString(16).padStart(2, '0')}`;
}
