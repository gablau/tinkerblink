// Modello del profilo restituito da LOAD_PROFILE_GZIPPED. Solo i campi che l'app usa: il JSON ricevuto
// resta intatto (serve all'editor per il round-trip: i campi sconosciuti non si perdono).

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
  /** Ultima connessione / disconnessione (ms); assenti se il device non è mai stato online. */
  connectTime?: number;
  disconnectTime?: number;
  /** Token del device per l'API HTTP (usato solo dal GPS in background; non va mai mostrato). */
  token?: string;
}

export interface Dashboard {
  id: number;
  name: string;
  isActive?: boolean;
  theme?: string;
  widgets: Widget[];
  devices?: Device[];
}

export interface Profile {
  dashBoards: Dashboard[];
  /** "<dashId>-<deviceId>-v<pin>" → ultimo valore dei pin senza widget dedicato. */
  pinsStorage?: Record<string, string>;
}

export interface TabsWidget extends Widget {
  type: 'TABS';
  tabs?: { id: number; label: string }[];
}

const PIN_LETTER: Record<PinType, string> = { VIRTUAL: 'v', DIGITAL: 'd', ANALOG: 'a' };

/** Chiave di un pin, nello stesso formato di `pinsStorage`: "<dashId>-<deviceId>-v<pin>". */
export function pinKey(dashId: number, deviceId: number, pinType: PinType, pin: number): string {
  return `${dashId}-${deviceId}-${PIN_LETTER[pinType]}${pin}`;
}

/** Chiave del pin di un widget, oppure null se il widget non ha un pin. */
export function widgetPinKey(dashId: number, w: Widget): string | null {
  if (w.pin === undefined || w.pin < 0 || !w.pinType) return null;
  return pinKey(dashId, w.deviceId ?? 0, w.pinType, w.pin);
}

export function deviceKey(dashId: number, deviceId: number): string {
  return `${dashId}-${deviceId}`;
}

/** Colore Blynk (int ARGB con segno, oppure "#RRGGBB" da setProperty) → colore CSS. */
export function toCssColor(color: unknown, fallback = '#23C48E'): string {
  if (typeof color === 'string' && color.startsWith('#')) return color;
  if (typeof color !== 'number') return fallback;
  const argb = color >>> 0;
  const a = (argb >>> 24) & 0xff;
  const rgb = (argb & 0xffffff).toString(16).padStart(6, '0');
  return a === 0xff ? `#${rgb}` : `#${rgb}${a.toString(16).padStart(2, '0')}`;
}
