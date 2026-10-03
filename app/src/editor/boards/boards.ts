// Pin disponibili per scheda e per tipo di widget, dalle definizioni delle schede Blynk (licenza MIT, vedi
// data/LICENSE). Nomi: chiavi del file della scheda per digitali e analogici ("gp2", "adc0"),
// "V<n>" per i virtuali.
import type { PinType } from '@/model/profile';
import { BOARD_FILES } from './index';

export interface BoardPin {
  type: PinType;
  index: number;
  name: string;
  pwm: boolean;
}

const GENERIC = 'Generic Board';
const cache = new Map<string, BoardPin[]>();

/** Pin di una scheda (ordinati per indice); schede sconosciute = Generic Board (BoardType del server). */
export function boardPins(boardType: string | undefined): BoardPin[] {
  const key = boardType && BOARD_FILES[boardType] ? boardType : GENERIC;
  const cached = cache.get(key);
  if (cached) return cached;
  const map = BOARD_FILES[key]!.map;
  const pwm = new Set(map.pwm?.pins ?? []);
  const pins: BoardPin[] = [];
  for (const [name, index] of Object.entries(map.digital?.pins ?? {})) pins.push({ type: 'DIGITAL', index, name, pwm: pwm.has(name) });
  for (const [name, index] of Object.entries(map.analog?.pins ?? {})) pins.push({ type: 'ANALOG', index, name, pwm: pwm.has(name) });
  if (map.virtual) {
    const [from, to] = map.virtual.pinsRange;
    for (let i = from; i <= to; i++) pins.push({ type: 'VIRTUAL', index: i, name: `V${i}`, pwm: false });
  }
  pins.sort((a, b) => a.index - b.index);
  cache.set(key, pins);
  return pins;
}

type PinSupport = 'ALL' | 'VIRTUAL' | 'VIRTUAL_N_ANALOG' | 'VIRTUAL_N_PWM';

/** Tipi di pin accettati da ogni widget; gli altri = tutti. */
const SUPPORT: Record<string, PinSupport> = {
  SLIDER: 'VIRTUAL_N_PWM', VERTICAL_SLIDER: 'VIRTUAL_N_PWM', TWO_AXIS_JOYSTICK: 'VIRTUAL_N_PWM', RGB: 'VIRTUAL_N_PWM',
  STEP: 'VIRTUAL_N_PWM', VERTICAL_STEP: 'VIRTUAL_N_PWM',
  LED: 'VIRTUAL', TERMINAL: 'VIRTUAL', VIDEO: 'VIRTUAL', RTC: 'VIRTUAL', EVENTOR: 'VIRTUAL', PLAYER: 'VIRTUAL',
  WEBHOOK: 'VIRTUAL', GPS_STREAMING: 'VIRTUAL', ACCELEROMETER: 'VIRTUAL', GRAVITY: 'VIRTUAL', MENU: 'VIRTUAL',
  TABLE: 'VIRTUAL', TIME_INPUT: 'VIRTUAL', MAP: 'VIRTUAL', DEVICE_TILES: 'VIRTUAL', TEXT_INPUT: 'VIRTUAL',
  NUMBER_INPUT: 'VIRTUAL', SEGMENTED_CONTROL: 'VIRTUAL',
  GAUGE: 'VIRTUAL_N_ANALOG', LCD: 'VIRTUAL_N_ANALOG', IMAGE: 'VIRTUAL_N_ANALOG', LIGHT: 'VIRTUAL_N_ANALOG',
  TEMPERATURE: 'VIRTUAL_N_ANALOG', BAROMETER: 'VIRTUAL_N_ANALOG', LEVEL_DISPLAY: 'VIRTUAL_N_ANALOG',
  VERTICAL_LEVEL_DISPLAY: 'VIRTUAL_N_ANALOG',
};

/** Pin della scheda che il widget può usare. */
export function pinsForWidget(widgetType: string, boardType: string | undefined): BoardPin[] {
  const pins = boardPins(boardType);
  switch (SUPPORT[widgetType] ?? 'ALL') {
    case 'VIRTUAL':
      return pins.filter((p) => p.type === 'VIRTUAL');
    case 'VIRTUAL_N_ANALOG':
      return pins.filter((p) => p.type !== 'DIGITAL');
    case 'VIRTUAL_N_PWM':
      return pins.filter((p) => p.type === 'VIRTUAL' || p.pwm);
    default:
      return pins;
  }
}

export const pinKeyOf = (type: PinType, index: number) => `${type}:${index}`;
