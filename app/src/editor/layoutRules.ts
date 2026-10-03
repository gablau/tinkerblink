// Regole del layout della griglia (fase 2 dell'editor):
// griglia larga 8 celle, nessuna sovrapposizione tra widget della stessa scheda, dimensioni
// minime e massime per tipo. Funzioni pure.
import type { Widget } from '@/model/profile';

export const GRID_COLUMNS = 8;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Dimensione di default: per quasi tutti i tipi è anche la minima. */
const DEFAULT_SIZE: Record<string, [number, number]> = {
  BUTTON: [2, 2],
  SLIDER: [4, 1],
  VERTICAL_SLIDER: [1, 3],
  TIMER: [3, 1],
  TWO_AXIS_JOYSTICK: [5, 4],
  RGB: [4, 3],
  SWITCH: [3, 2],
  DIGIT4_DISPLAY: [2, 1],
  LABELED_VALUE_DISPLAY: [4, 1],
  LED: [1, 1],
  GAUGE: [4, 3],
  LCD: [8, 2],
  TERMINAL: [8, 3],
  VIDEO: [8, 4],
  TWITTER: [2, 1],
  NOTIFICATION: [2, 1],
  EMAIL: [2, 1],
  BRIDGE: [2, 1],
  RTC: [2, 1],
  BLUETOOTH: [2, 1],
  BLUETOOTH_SERIAL: [2, 1],
  EVENTOR: [2, 1],
  WEBHOOK: [2, 1],
  PLAYER: [8, 2],
  IMAGE: [2, 2],
  GPS_STREAMING: [2, 1],
  GPS_TRIGGER: [2, 1],
  LIGHT: [2, 1],
  PROXIMITY: [2, 1],
  TEMPERATURE: [2, 1],
  BAROMETER: [2, 1],
  ACCELEROMETER: [2, 1],
  GRAVITY: [2, 1],
  HUMIDITY: [2, 1],
  TABS: [8, 1],
  MENU: [4, 1],
  TABLE: [8, 5],
  TIME_INPUT: [4, 1],
  MAP: [8, 5],
  DEVICE_SELECTOR: [4, 1],
  LEVEL_DISPLAY: [3, 1],
  VERTICAL_LEVEL_DISPLAY: [1, 3],
  STEP: [4, 1],
  VERTICAL_STEP: [2, 2],
  ENHANCED_GRAPH: [8, 3],
  DEVICE_TILES: [8, 6],
  STYLED_BUTTON: [4, 1],
  TEXT_INPUT: [4, 1],
  NUMBER_INPUT: [4, 1],
  SEGMENTED_CONTROL: [8, 1],
  REPORT: [4, 1],
  LINK_BUTTON: [4, 1],
  TEXT: [4, 2],
};

/** Minime diverse dalla dimensione di default. */
const MIN_SIZE: Record<string, [number, number]> = {
  TWO_AXIS_JOYSTICK: [4, 3],
  SWITCH: [2, 1],
  LABELED_VALUE_DISPLAY: [2, 1],
  IMAGE: [2, 1],
  TABLE: [3, 3],
  MAP: [3, 3],
  VERTICAL_LEVEL_DISPLAY: [1, 2],
  STYLED_BUTTON: [2, 1],
  TERMINAL: [4, 2],
  VIDEO: [4, 3],
  LINK_BUTTON: [2, 1],
  TEXT: [2, 1],
};

/** Massime diverse da 8×9. */
const MAX_SIZE: Record<string, [number, number]> = {
  TIMER: [4, 1],
  SWITCH: [8, 4],
  LED: [4, 4],
  TEMPERATURE: [4, 1],
  BAROMETER: [4, 1],
  HUMIDITY: [4, 1],
  TABS: [8, 1],
};

export function defaultSize(type: string): [number, number] {
  return DEFAULT_SIZE[type] ?? [2, 2];
}

/** Dimensioni ammesse; un widget già più piccolo della minima (profili vecchi) può restare com'è. */
export function sizeLimits(w: Widget): { min: [number, number]; max: [number, number] } {
  const min = MIN_SIZE[w.type] ?? defaultSize(w.type);
  const max = MAX_SIZE[w.type] ?? [8, 9];
  return { min: [Math.min(min[0], w.width), Math.min(min[1], w.height)], max };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Widget che condividono la griglia con `w`: stessa scheda (se ci sono schede), escluso il widget Tabs. */
export function sameGrid(widgets: Widget[], w: Widget, hasTabs: boolean, tabId = w.tabId ?? 0): Widget[] {
  return widgets.filter((o) => o.id !== w.id && o.type !== 'TABS' && (!hasTabs || (o.tabId ?? 0) === tabId));
}

/** La posizione è valida: dentro le 8 colonne, sotto la riga minima (1 con le schede) e senza sovrapposizioni. */
export function canPlace(rect: Rect, others: Widget[], minRow: number): boolean {
  if (rect.x < 0 || rect.y < minRow || rect.width < 1 || rect.height < 1 || rect.x + rect.width > GRID_COLUMNS) return false;
  return !others.some((o) => overlaps(rect, o));
}

/** Dentro la griglia: 8 colonne, sotto la riga minima, dimensioni positive (le sovrapposizioni le risolve reflow). */
export function inBounds(rect: Rect, minRow: number): boolean {
  return rect.x >= 0 && rect.y >= minRow && rect.width >= 1 && rect.height >= 1 && rect.x + rect.width <= GRID_COLUMNS;
}

/**
 * Spinta verso il basso (come nelle griglie "a spinta"): il widget spostato occupa `placed` e gli altri widget
 * della stessa griglia che si sovrappongono scendono quanto basta, a cascata, in ordine di riga. Gli spazi vuoti
 * restano dove sono (niente compattazione verso l'alto: le righe vuote messe apposta non si perdono).
 * Restituisce le nuove posizioni dei soli widget che si spostano.
 */
export function reflow(others: Widget[], placed: Rect): Map<number, Rect> {
  const occupied: Rect[] = [placed];
  const moved = new Map<number, Rect>();
  const sorted = [...others].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const w of sorted) {
    let r: Rect = { x: w.x, y: w.y, width: w.width, height: w.height };
    for (;;) {
      const blocking = occupied.filter((o) => overlaps(r, o));
      if (blocking.length === 0) break;
      r = { ...r, y: Math.max(...blocking.map((o) => o.y + o.height)) };
    }
    if (r.y !== w.y) moved.set(w.id, r);
    occupied.push(r);
  }
  return moved;
}

/** Primo posto libero (per righe, da sinistra) per un widget di quelle dimensioni. */
export function findFreeSpot(width: number, height: number, others: Widget[], minRow: number): Rect {
  const w = Math.min(width, GRID_COLUMNS);
  const bottom = others.reduce((m, o) => Math.max(m, o.y + o.height), minRow);
  for (let y = minRow; y <= bottom; y++) {
    for (let x = 0; x + w <= GRID_COLUMNS; x++) {
      const rect = { x, y, width: w, height };
      if (canPlace(rect, others, minRow)) return rect;
    }
  }
  return { x: 0, y: bottom, width: w, height };
}
