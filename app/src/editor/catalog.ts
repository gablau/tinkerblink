// Catalogo dei widget che si possono aggiungere (fase 3 dell'editor), il "Widget Box":
// gruppi, nomi, prezzo in Energy (Widget.getPrice del server), widget ammessi una sola volta per progetto
// e valori iniziali di ogni tipo, con i nomi dei campi del modello del server
// (cc.blynk.server.core.model.widgets: per esempio min / max).
// Esclusi: widget che la nuova app non disegna o non sa configurare (Eventor, Reports, Device Selector / Tiles)
// e quelli segnati "da non implementare" (BLE, Bluetooth, Twitter, Text, Switch).
import type { Dashboard, Widget } from '@/model/profile';
import type { DashboardTheme, WidgetGroup } from '@/ui/dashboardTheme';
import { cssToRgba } from './colors';
import { defaultSize, findFreeSpot, reflow, sameGrid, type Rect } from './layoutRules';
import { te } from './strings';

export interface CatalogItem {
  type: string;
  name: string;
  price: number;
}

export interface CatalogGroup {
  key: WidgetGroup;
  title: string;
  items: CatalogItem[];
}

export const CATALOG: CatalogGroup[] = [
  {
    key: 'controllers',
    title: te.groupControllers,
    items: [
      { type: 'BUTTON', name: 'Button', price: 200 },
      { type: 'STYLED_BUTTON', name: 'Styled Button', price: 300 },
      { type: 'SLIDER', name: 'Slider', price: 200 },
      { type: 'VERTICAL_SLIDER', name: 'Vertical Slider', price: 200 },
      { type: 'STEP', name: 'Step H', price: 500 },
      { type: 'VERTICAL_STEP', name: 'Step V', price: 500 },
      { type: 'TIMER', name: 'Timer', price: 200 },
      { type: 'TWO_AXIS_JOYSTICK', name: 'Joystick', price: 400 },
      { type: 'RGB', name: 'RGB', price: 400 },
    ],
  },
  {
    key: 'displays',
    title: te.groupDisplays,
    items: [
      { type: 'DIGIT4_DISPLAY', name: 'Value Display', price: 200 },
      { type: 'LABELED_VALUE_DISPLAY', name: 'Labeled Value', price: 400 },
      { type: 'LED', name: 'LED', price: 100 },
      { type: 'GAUGE', name: 'Gauge', price: 300 },
      { type: 'LEVEL_DISPLAY', name: 'Level H', price: 200 },
      { type: 'VERTICAL_LEVEL_DISPLAY', name: 'Level V', price: 200 },
      { type: 'LCD', name: 'LCD', price: 400 },
      { type: 'TERMINAL', name: 'Terminal', price: 200 },
      { type: 'ENHANCED_GRAPH', name: 'SuperChart', price: 900 },
      { type: 'VIDEO', name: 'Video Streaming', price: 500 },
      { type: 'IMAGE', name: 'Image Gallery', price: 600 },
    ],
  },
  {
    key: 'interface',
    title: te.groupInterface,
    items: [
      { type: 'TABS', name: 'Tabs', price: 0 },
      { type: 'MENU', name: 'Menu', price: 400 },
      { type: 'SEGMENTED_CONTROL', name: 'Segmented Switch', price: 400 },
      { type: 'TEXT_INPUT', name: 'Text Input', price: 400 },
      { type: 'NUMBER_INPUT', name: 'Numeric Input', price: 400 },
      { type: 'TIME_INPUT', name: 'Time Input', price: 200 },
      { type: 'TABLE', name: 'Table', price: 800 },
      { type: 'MAP', name: 'Map', price: 600 },
    ],
  },
  {
    key: 'notifications',
    title: te.groupNotifications,
    items: [
      { type: 'NOTIFICATION', name: 'Notification', price: 400 },
      { type: 'EMAIL', name: 'Email', price: 100 },
    ],
  },
  {
    key: 'other',
    title: te.groupOther,
    items: [
      { type: 'BRIDGE', name: 'Bridge', price: 100 },
      { type: 'RTC', name: 'Real-time clock', price: 100 },
      { type: 'WEBHOOK', name: 'WebHook', price: 500 },
      { type: 'LINK_BUTTON', name: 'WebPage Button', price: 500 },
      { type: 'PLAYER', name: 'Music Player', price: 400 },
    ],
  },
  {
    key: 'sensors',
    title: te.groupSensors,
    items: [
      { type: 'GPS_STREAMING', name: 'GPS Stream', price: 500 },
      { type: 'GPS_TRIGGER', name: 'GPS Trigger', price: 500 },
      { type: 'LIGHT', name: 'Light Sensor', price: 300 },
      { type: 'PROXIMITY', name: 'Proximity Sensor', price: 300 },
      { type: 'TEMPERATURE', name: 'Temperature Sensor', price: 300 },
      { type: 'BAROMETER', name: 'Barometer Sensor', price: 300 },
      { type: 'ACCELEROMETER', name: 'Accelerometer', price: 400 },
      { type: 'GRAVITY', name: 'Gravity Sensor', price: 300 },
      { type: 'HUMIDITY', name: 'Humidity Sensor', price: 300 },
    ],
  },
];

/** Prezzo in Energy (anche per i widget fuori catalogo già presenti, restituito eliminandoli). */
export function priceOf(type: string): number {
  for (const g of CATALOG) for (const i of g.items) if (i.type === type) return i.price;
  return 0;
}

/** Ammessi una sola volta per progetto. */
const SINGLE = new Set([
  'TWITTER', 'NOTIFICATION', 'EMAIL', 'BRIDGE', 'RTC', 'BLUETOOTH', 'BLUETOOTH_SERIAL', 'EVENTOR', 'GPS_STREAMING', 'LIGHT',
  'PROXIMITY', 'TEMPERATURE', 'BAROMETER', 'ACCELEROMETER', 'GRAVITY', 'HUMIDITY', 'TABS', 'MAP', 'DEVICE_TILES', 'REPORT',
]);

export function isSingle(type: string): boolean {
  return SINGLE.has(type);
}

/** Widget con un solo pin (OnePinWidget del server). */
const ONE_PIN = new Set([
  'ACCELEROMETER', 'BAROMETER', 'BUTTON', 'GPS_STREAMING', 'GPS_TRIGGER', 'GRAVITY', 'HUMIDITY', 'IMAGE', 'LED', 'LIGHT', 'MAP',
  'MENU', 'NUMBER_INPUT', 'PLAYER', 'PROXIMITY', 'SEGMENTED_CONTROL', 'SLIDER', 'VERTICAL_SLIDER', 'STEP', 'VERTICAL_STEP',
  'STYLED_BUTTON', 'TABLE', 'TEMPERATURE', 'TERMINAL', 'TEXT_INPUT', 'TIME_INPUT', 'TIMER', 'VIDEO', 'WEBHOOK',
  'DIGIT4_DISPLAY', 'LABELED_VALUE_DISPLAY', 'GAUGE', 'LEVEL_DISPLAY', 'VERTICAL_LEVEL_DISPLAY',
]);

const emptyPin = (max: number) => ({ pin: -1, pwmMode: false, rangeMappingOn: false, min: 0, max });
const button = { textColor: undefined, backgroundColor: undefined };

/** Campi propri di ogni tipo, con i valori iniziali. */
function typeDefaults(type: string): Record<string, unknown> {
  switch (type) {
    case 'BUTTON':
      return { pushMode: true, min: 0, max: 1, fontSize: 'MEDIUM' };
    case 'STYLED_BUTTON':
      return { pushMode: true, min: 0, max: 1, fontSize: 'MEDIUM', onButtonState: { ...button }, offButtonState: { ...button }, edge: 'ROUNDED', buttonStyle: 'SOLID', lockSize: false };
    case 'SLIDER':
    case 'VERTICAL_SLIDER':
      return { max: 1023, sendOnReleaseOn: true, frequency: 100, maximumFractionDigits: 0, showValueOn: true };
    case 'STEP':
    case 'VERTICAL_STEP':
      return { max: 1023, step: 1, isArrowsOn: false, isLoopOn: false, isSendStep: false, showValueOn: true };
    case 'TIMER':
      return { startTime: -1, stopTime: -1, min: 0, max: 1, fontSize: 'MEDIUM' };
    case 'TWO_AXIS_JOYSTICK':
      return { autoReturnOn: true, portraitLocked: false, split: true, frequency: 100, pins: [emptyPin(255), emptyPin(255)] };
    case 'RGB':
      return { splitMode: true, sendOnReleaseOn: true, frequency: 100, isDefaultColor: false, pins: [emptyPin(255), emptyPin(255), emptyPin(255)] };
    case 'DIGIT4_DISPLAY':
    case 'GAUGE':
      return { max: 1023, frequency: 1000, fontSize: 'MEDIUM' };
    case 'LABELED_VALUE_DISPLAY':
      return { max: 1023, frequency: 1000, fontSize: 'MEDIUM', textAlignment: 'LEFT' };
    case 'LED':
      return { max: 255 };
    case 'LEVEL_DISPLAY':
    case 'VERTICAL_LEVEL_DISPLAY':
      return { max: 1023, frequency: 1000, isAxisFlipOn: false, showValueOn: true };
    case 'LCD':
      return { advancedMode: false, frequency: 1000, textLight: false, pins: [emptyPin(1023), emptyPin(1023)] };
    case 'TERMINAL':
      return { autoScrollOn: true, terminalInputOn: true, attachNewLine: false, textLightOn: false };
    case 'ENHANCED_GRAPH':
      return {
        dataStreams: [], selectedPeriods: ['LIVE', 'ONE_HOUR', 'SIX_HOURS', 'N_DAY', 'N_WEEK', 'N_MONTH', 'N_THREE_MONTHS'],
        period: 'ONE_HOUR', textAlignment: 'LEFT', fontSize: 'MEDIUM', stacking: 'NO_STACKING', showTitle: true, showLegend: true,
        xAxisValues: false, allowFullScreen: true, overrideYAxis: false, goalLine: 'GOAL',
      };
    case 'VIDEO':
      return { url: '' };
    case 'IMAGE':
      return { source: 'URL', scaling: 'FIT', urls: [], opacity: 100, scale: 100, rotation: 0 };
    case 'TABS':
      return { tabId: -1, tabs: [{ id: 0, label: 'Tab 1' }, { id: 0, label: 'Tab 2' }] };
    case 'MENU':
      return { fontSize: 'MEDIUM', labels: ['Item 1', 'Item 2'] };
    case 'SEGMENTED_CONTROL':
      return { labels: ['Option 1', 'Option 2'] };
    case 'TEXT_INPUT':
      return { limit: 5, fontSize: 'MEDIUM' };
    case 'NUMBER_INPUT':
      return { max: 100, step: 1, isLoopOn: false, fontSize: 'MEDIUM' };
    case 'TIME_INPUT':
      return { days: [], startAt: -1, stopAt: -1, format: 'HH:mm', tzName: Intl.DateTimeFormat().resolvedOptions().timeZone };
    case 'TABLE':
      return { columns: [{ name: 'icon' }, { name: 'name' }, { name: 'value' }], rows: [], currentRowIndex: -1, isClickableRows: false, isReoderingAllowed: false };
    case 'MAP':
      return { isMyLocationSupported: true, isPinToLatestPoint: false, isSatelliteMode: false };
    case 'LINK_BUTTON':
      return { url: '', onButtonState: { ...button }, offButtonState: { ...button }, fontSize: 'MEDIUM', edge: 'ROUNDED', buttonStyle: 'SOLID', lockSize: false, showAddressBar: false, showNavigationBar: true, allowInBrowser: false };
    case 'NOTIFICATION':
      return { priority: 'normal', notifyWhenOffline: false };
    case 'EMAIL':
      return { contentType: 'TEXT_HTML' };
    case 'WEBHOOK':
      return { method: 'GET', headers: [] };
    case 'RTC':
      return { tzName: Intl.DateTimeFormat().resolvedOptions().timeZone };
    case 'GPS_STREAMING':
      return { accuracy: 1, interval: 30000 };
    case 'GPS_TRIGGER':
      // 100 / 200 = coordinate non valide: zona da impostare.
      return { triggerOnEnter: true, triggerLat: 100, triggerLon: 200, triggerRadius: 500 };
    case 'TEMPERATURE':
      return { isCelsius: true, frequency: 100 };
    case 'ACCELEROMETER':
    case 'GRAVITY':
    case 'LIGHT':
    case 'PROXIMITY':
    case 'BAROMETER':
    case 'HUMIDITY':
      return { frequency: 100 };
    default:
      return {};
  }
}

/** Id nuovo: casuale sotto 200000 e non usato nella dashboard. */
function newId(dash: Dashboard): number {
  const used = new Set(dash.widgets.map((w) => w.id));
  for (;;) {
    const id = 1 + Math.floor(Math.random() * 199999);
    if (!used.has(id)) return id;
  }
}

/** Pin azzerato (come un widget appena creato): pin -1, niente pinType né valore; restano intervallo e opzioni. */
function clearPin<T extends Record<string, unknown>>(p: T): T {
  const next: Record<string, unknown> = { ...p, pin: -1 };
  delete next.pinType;
  delete next.value;
  return next as T;
}

/**
 * Copia di un widget ("duplica"): tutte le proprietà tranne i pin, che restano da scegliere
 * (anche quelli dei widget a più pin e degli stream del SuperChart); nuovo id, primo posto libero nella stessa
 * scheda, senza valore.
 */
export function duplicateOf(w: Widget, dash: Dashboard): Widget {
  const hasTabs = dash.widgets.some((x) => x.type === 'TABS');
  let copy = JSON.parse(JSON.stringify(w)) as Widget;
  delete copy.value;
  if ('pin' in copy) copy = clearPin(copy);
  if (Array.isArray(copy.pins)) copy.pins = (copy.pins as Record<string, unknown>[]).map(clearPin);
  if (Array.isArray(copy.dataStreams)) {
    copy.dataStreams = (copy.dataStreams as { pin?: Record<string, unknown> }[]).map((s) => (s.pin ? { ...s, pin: clearPin(s.pin) } : s));
  }
  copy.id = newId(dash);
  const tabId = hasTabs ? (w.tabId ?? 0) : 0;
  const spot = findFreeSpot(w.width, w.height, sameGrid(dash.widgets, copy, hasTabs, tabId), hasTabs ? 1 : 0);
  return { ...copy, ...spot, tabId };
}

export interface NewWidgetPlan {
  widget: Widget;
  /** Widget da spingere per fare posto (solo per il Tabs, che deve stare nella riga 0). */
  moves: Map<number, Rect>;
}

/**
 * Widget nuovo con i valori iniziali, nel primo posto libero della scheda attiva. Il Tabs va nella riga 0
 * larga 8 colonne: gli altri widget scendono di quanto serve (reflow).
 */
export function planNewWidget(type: string, dash: Dashboard, tab: number | undefined, theme: DashboardTheme): NewWidgetPlan {
  const [width, height] = defaultSize(type);
  const hasTabs = dash.widgets.some((w) => w.type === 'TABS');
  const group = CATALOG.find((g) => g.items.some((i) => i.type === type))?.key ?? 'controllers';
  const base: Widget = { id: newId(dash), type, x: 0, y: 0, width, height, color: cssToRgba(theme.groupColors[group]), isDefaultColor: true };
  if (ONE_PIN.has(type)) Object.assign(base, { deviceId: dash.devices?.[0]?.id ?? 0, ...emptyPin(1023), min: 0 });
  else if (type === 'LCD' || type === 'RGB' || type === 'TWO_AXIS_JOYSTICK') base.deviceId = dash.devices?.[0]?.id ?? 0;
  Object.assign(base, typeDefaults(type));

  if (type === 'TABS') {
    const tabsRect = { x: 0, y: 0, width: 8, height: 1 };
    const others = dash.widgets.filter((w) => w.type !== 'TABS');
    return { widget: { ...base, ...tabsRect }, moves: reflow(others, tabsRect) };
  }
  const tabId = hasTabs ? (tab ?? 0) : 0;
  const minRow = hasTabs ? 1 : 0;
  const spot = findFreeSpot(width, height, sameGrid(dash.widgets, base, hasTabs, tabId), minRow);
  return { widget: { ...base, ...spot, tabId }, moves: new Map() };
}
