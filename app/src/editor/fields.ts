// Editable fields of each widget type (editor phase 1: settings of existing widgets).
// Pure function: from the widget JSON it builds the sections of the form. Field names are those of the server
// model (cc.blynk.server.core.model.widgets): a field unknown to the server would be dropped.
//
// Multi-pin widgets (LCD, Joystick, RGB): SPLIT / MERGE switch (SIMPLE / ADVANCED for the LCD);
// in MERGE the same pin goes in every position of the `pins` array; each pin has its own range.
// Left out: time zone of RTC and Time Input, WebHook headers, Eventor, Reports, Device Selector and Tiles.
import type { Widget } from '@/model/profile';
import { te } from './strings';

export type Option = { value: string | number | boolean; label: string };

/** Multiple pins: positions in the `pins` array and, if present, the switch between separate pins and one pin. */
export interface MultiPinConfig {
  slots: { label: string; color?: 'x' | 'y' | 'r' | 'g' | 'b' }[];
  mode?: { key: string; splitWhen: boolean; labels: [split: string, merge: string] };
  /** In single-pin mode the range of each position is still shown (Joystick, RGB; not the advanced LCD). */
  rangeInMerge: boolean;
  /** The single pin accepts only virtual pins (advanced LCD). */
  mergedVirtualOnly?: boolean;
}

type Base = { when?: (w: Widget) => boolean };

export type Field = Base &
  (
    | { kind: 'text'; key: string; label: string; secret?: boolean; multiline?: boolean }
    | { kind: 'number'; key: string; label: string; integer?: boolean }
    | { kind: 'bool'; key: string; label: string; invert?: boolean }
    | { kind: 'choice'; key: string; label: string; options: Option[] }
    | { kind: 'color'; key: string; label: string; gradients: boolean }
    | { kind: 'pin'; label: string }
    | { kind: 'multipin'; label: string; config: MultiPinConfig }
    | { kind: 'range'; label: string }
    | { kind: 'labels'; key: string; label: string }
    | { kind: 'time'; key: string; label: string }
    | { kind: 'periods'; key: string; label: string }
    | { kind: 'streams'; label: string }
    | { kind: 'tabs'; label: string }
  );

export interface Section {
  title?: string;
  fields: Field[];
}

/** Widgets that send values to the device ("Output" section); the others read ("Input"). */
const OUTPUT_TYPES = new Set([
  'BUTTON', 'STYLED_BUTTON', 'SLIDER', 'VERTICAL_SLIDER', 'STEP', 'VERTICAL_STEP', 'MENU', 'SEGMENTED_CONTROL',
  'TEXT_INPUT', 'NUMBER_INPUT', 'TERMINAL', 'TIMER', 'PLAYER', 'TABLE', 'TIME_INPUT',
  'ACCELEROMETER', 'GRAVITY', 'LIGHT', 'PROXIMITY', 'BAROMETER', 'HUMIDITY', 'TEMPERATURE', 'GPS_STREAMING', 'GPS_TRIGGER',
]);

/** Widgets with meaningful min/max. */
const RANGE_TYPES = new Set([
  'BUTTON', 'STYLED_BUTTON', 'SLIDER', 'VERTICAL_SLIDER', 'STEP', 'VERTICAL_STEP', 'NUMBER_INPUT',
  'GAUGE', 'LEVEL_DISPLAY', 'VERTICAL_LEVEL_DISPLAY',
]);

/** Widgets whose color can be a gradient tied to the value. */
const GRADIENT_TYPES = new Set(['GAUGE', 'LEVEL_DISPLAY', 'VERTICAL_LEVEL_DISPLAY', 'DIGIT4_DISPLAY', 'LABELED_VALUE_DISPLAY', 'LED']);

/** For these widgets the frequency is the minimum interval between two writes. */
const WRITE_FREQUENCY_TYPES = new Set([
  'SLIDER', 'VERTICAL_SLIDER', 'STEP', 'VERTICAL_STEP', 'TWO_AXIS_JOYSTICK',
  'ACCELEROMETER', 'GRAVITY', 'LIGHT', 'PROXIMITY', 'BAROMETER', 'HUMIDITY', 'TEMPERATURE',
]);

/** Widgets whose color cannot be changed (no color picker). */
const NO_COLOR_TYPES = new Set(['TABS', 'IMAGE', 'VIDEO', 'GPS_STREAMING', 'GPS_TRIGGER', 'NOTIFICATION', 'EMAIL', 'WEBHOOK', 'RTC', 'BRIDGE']);

function duration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${ms / 1000} s`;
  if (ms < 3600000) return `${ms / 60000} min`;
  return `${ms / 3600000} h`;
}

/** Reading frequencies (widget frequency on the server): Push, then from 1 s to 24 h. */
const READ_FREQUENCIES: Option[] = [
  { value: 0, label: te.pushRate },
  ...[1, 2, 5, 10, 15, 30].map((s) => s * 1000),
  ...[1, 2, 5, 10, 15, 30].map((m) => m * 60000),
  ...[1, 2, 4, 8, 12, 24].map((h) => h * 3600000),
].map((v) => (typeof v === 'number' ? { value: v, label: duration(v) } : v));

/** Write intervals: from 100 ms to 1 s. */
const WRITE_FREQUENCIES: Option[] = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((v) => ({ value: v, label: duration(v) }));

const FONT_SIZES: Option[] = [
  { value: 'SMALL', label: te.small },
  { value: 'MEDIUM', label: te.medium },
  { value: 'LARGE', label: te.large },
];

const has = (w: Widget, key: string) => key in w;

/** True if the widget has a single pin (OnePinWidget on the server). */
export function isOnePin(w: Widget): boolean {
  return has(w, 'pin') && !has(w, 'pins');
}

function specificFields(w: Widget): Field[] {
  switch (w.type) {
    case 'BUTTON':
    case 'STYLED_BUTTON':
      return [
        { kind: 'choice', key: 'pushMode', label: te.mode, options: [{ value: true, label: te.push }, { value: false, label: te.switchMode }] },
        { kind: 'text', key: 'offLabel', label: te.offLabel },
        { kind: 'text', key: 'onLabel', label: te.onLabel },
      ];
    case 'MENU':
      return [{ kind: 'labels', key: 'labels', label: te.labels }, { kind: 'text', key: 'hint', label: te.hint }];
    case 'SEGMENTED_CONTROL':
      return [{ kind: 'labels', key: 'labels', label: te.labels }];
    case 'LABELED_VALUE_DISPLAY':
      return [
        { kind: 'text', key: 'valueFormatting', label: te.valueFormatting },
        { kind: 'choice', key: 'textAlignment', label: te.alignment, options: [{ value: 'LEFT', label: te.left }, { value: 'MIDDLE', label: te.center }, { value: 'RIGHT', label: te.right }] },
      ];
    case 'GAUGE':
      return [{ kind: 'text', key: 'valueFormatting', label: te.valueFormatting }];
    case 'TERMINAL':
      return [
        { kind: 'bool', key: 'terminalInputOn', label: te.inputLine },
        { kind: 'bool', key: 'autoScrollOn', label: te.autoScroll },
        { kind: 'bool', key: 'attachNewLine', label: te.newLine },
        { kind: 'bool', key: 'textLightOn', label: te.lightText },
      ];
    case 'SLIDER':
    case 'VERTICAL_SLIDER':
      return [
        { kind: 'bool', key: 'sendOnReleaseOn', label: te.sendOnRelease },
        { kind: 'bool', key: 'showValueOn', label: te.showValue },
        { kind: 'choice', key: 'maximumFractionDigits', label: te.decimals, options: [0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })) },
      ];
    case 'STEP':
    case 'VERTICAL_STEP':
      return [
        { kind: 'number', key: 'step', label: te.step },
        // In the JSON isArrowsOn = true means + / − buttons (the name is misleading: see StepWidget).
        { kind: 'bool', key: 'isArrowsOn', label: te.plusMinus },
        { kind: 'bool', key: 'isLoopOn', label: te.loop },
        { kind: 'bool', key: 'isSendStep', label: te.sendStep },
        { kind: 'bool', key: 'showValueOn', label: te.showValue },
      ];
    case 'NUMBER_INPUT':
      return [
        { kind: 'number', key: 'step', label: te.step },
        { kind: 'text', key: 'suffix', label: te.suffix },
        { kind: 'bool', key: 'isLoopOn', label: te.loop },
      ];
    case 'TEXT_INPUT':
      return [
        { kind: 'text', key: 'hint', label: te.hint },
        { kind: 'number', key: 'limit', label: te.limit, integer: true },
      ];
    case 'LEVEL_DISPLAY':
    case 'VERTICAL_LEVEL_DISPLAY':
      return [
        { kind: 'bool', key: 'isAxisFlipOn', label: te.flipAxis },
        { kind: 'bool', key: 'showValueOn', label: te.showValue },
      ];
    case 'TEMPERATURE':
      return [{ kind: 'bool', key: 'isCelsius', label: te.celsius }];
    case 'GPS_TRIGGER':
      return [
        { kind: 'bool', key: 'triggerOnEnter', label: te.triggerOnEnter },
        { kind: 'number', key: 'triggerLat', label: te.latitude },
        { kind: 'number', key: 'triggerLon', label: te.longitude },
        { kind: 'number', key: 'triggerRadius', label: te.radius, integer: true },
      ];
    case 'GPS_STREAMING':
      return [
        { kind: 'choice', key: 'accuracy', label: te.accuracy, options: [{ value: 0, label: te.high }, { value: 1, label: te.balanced }, { value: 2, label: te.low }] },
      ];
    case 'LINK_BUTTON':
      return [{ kind: 'text', key: 'url', label: te.url }];
    case 'TABLE':
      return [
        { kind: 'bool', key: 'isClickableRows', label: te.clickableRows },
        { kind: 'bool', key: 'isReoderingAllowed', label: te.reordering },
      ];
    case 'TWO_AXIS_JOYSTICK':
      return [
        { kind: 'bool', key: 'autoReturnOn', label: te.autoReturn },
        // ROTATE ON TILT = !portraitLocked (TwoAxisJoystick on the server).
        { kind: 'bool', key: 'portraitLocked', label: te.rotateOnTilt, invert: true },
      ];
    case 'RGB':
      return [{ kind: 'bool', key: 'sendOnReleaseOn', label: te.sendOnRelease }];
    case 'LCD':
      return [
        { kind: 'text', key: 'textFormatLine1', label: te.lcdLine1, when: (x) => x.advancedMode !== true },
        { kind: 'text', key: 'textFormatLine2', label: te.lcdLine2, when: (x) => x.advancedMode !== true },
        { kind: 'bool', key: 'textLight', label: te.lightText },
      ];
    case 'TIMER':
      return [
        { kind: 'time', key: 'startTime', label: te.startTime },
        { kind: 'text', key: 'startValue', label: te.startValue },
        { kind: 'time', key: 'stopTime', label: te.stopTime },
        { kind: 'text', key: 'stopValue', label: te.stopValue },
      ];
    case 'ENHANCED_GRAPH':
      return [
        { kind: 'streams', label: te.datastreams },
        { kind: 'periods', key: 'selectedPeriods', label: te.periods },
        { kind: 'bool', key: 'showTitle', label: te.showTitle },
        { kind: 'bool', key: 'showLegend', label: te.legend },
        { kind: 'bool', key: 'xAxisValues', label: te.xAxisValues },
        { kind: 'bool', key: 'allowFullScreen', label: te.allowFullScreen },
      ];
    case 'VIDEO':
      // The URL contains the camera credentials: hidden field.
      return [
        { kind: 'text', key: 'url', label: te.url, secret: true },
        { kind: 'bool', key: 'forceTCP', label: te.forceTcp },
      ];
    case 'TABS':
      return [{ kind: 'tabs', label: te.tabs }];
    case 'MAP':
      return [
        { kind: 'bool', key: 'isPinToLatestPoint', label: te.pinToLatest },
        { kind: 'bool', key: 'isMyLocationSupported', label: te.myLocation },
        { kind: 'bool', key: 'isSatelliteMode', label: te.satellite },
        { kind: 'text', key: 'labelFormat', label: te.labelFormat },
      ];
    case 'IMAGE':
      return [
        { kind: 'labels', key: 'urls', label: te.imageUrls },
        { kind: 'choice', key: 'scaling', label: te.scaling, options: [{ value: 'NONE', label: te.scaleNone }, { value: 'FIT', label: te.scaleFit }, { value: 'FILL', label: te.scaleFill }] },
        { kind: 'number', key: 'opacity', label: te.opacity, integer: true },
        { kind: 'number', key: 'scale', label: te.scale, integer: true },
        { kind: 'number', key: 'rotation', label: te.rotation, integer: true },
      ];
    case 'TIME_INPUT':
      return [
        { kind: 'bool', key: 'isStartStopAllowed', label: te.allowStartStop },
        { kind: 'bool', key: 'isDayOfWeekAllowed', label: te.allowDays },
        { kind: 'bool', key: 'isSunsetSunriseAllowed', label: te.allowSun },
        { kind: 'bool', key: 'isTimezoneAllowed', label: te.allowTimezone },
      ];
    case 'NOTIFICATION':
      return [
        { kind: 'bool', key: 'notifyWhenOffline', label: te.notifyOffline },
        { kind: 'choice', key: 'priority', label: te.priority, options: [{ value: 'normal', label: te.priorityNormal }, { value: 'high', label: te.priorityHigh }] },
      ];
    case 'EMAIL':
      return [
        { kind: 'text', key: 'to', label: te.emailTo },
        { kind: 'choice', key: 'contentType', label: te.contentType, options: [{ value: 'TEXT_HTML', label: 'HTML' }, { value: 'TEXT_PLAIN', label: te.plainText }] },
      ];
    case 'WEBHOOK':
      return [
        { kind: 'text', key: 'url', label: te.url },
        { kind: 'choice', key: 'method', label: te.method, options: ['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({ value: m, label: m })) },
        { kind: 'text', key: 'body', label: te.body, multiline: true },
      ];
    default:
      return [];
  }
}

export function editorSections(w: Widget): Section[] {
  const head: Field[] = [{ kind: 'text', key: 'label', label: te.title }];
  if (has(w, 'color') && !NO_COLOR_TYPES.has(w.type)) {
    head.push({ kind: 'color', key: 'color', label: te.color, gradients: GRADIENT_TYPES.has(w.type) });
  }
  const sections: Section[] = [{ fields: head }];

  const io: Field[] = [];
  const multi = multiPinConfig(w);
  if (multi) io.push({ kind: 'multipin', label: te.pin, config: multi });
  else if (isOnePin(w)) io.push({ kind: 'pin', label: te.pin });
  if (RANGE_TYPES.has(w.type)) io.push({ kind: 'range', label: w.type === 'BUTTON' || w.type === 'STYLED_BUTTON' ? te.offOn : te.range });
  if (has(w, 'frequency')) {
    const write = WRITE_FREQUENCY_TYPES.has(w.type);
    io.push({ kind: 'choice', key: 'frequency', label: write ? te.writeInterval : te.readingRate, options: write ? WRITE_FREQUENCIES : READ_FREQUENCIES });
  }
  if (io.length > 0) sections.push({ title: OUTPUT_TYPES.has(w.type) ? te.output : te.input, fields: io });

  const extra = specificFields(w);
  if (has(w, 'fontSize')) extra.push({ kind: 'choice', key: 'fontSize', label: te.fontSize, options: FONT_SIZES });
  if (extra.length > 0) sections.push({ fields: extra });
  return sections;
}

/** Configuration of multi-pin widgets (Joystick, RGB, LCD). */
export function multiPinConfig(w: Widget): MultiPinConfig | null {
  switch (w.type) {
    case 'TWO_AXIS_JOYSTICK':
      return {
        slots: [{ label: 'X', color: 'x' }, { label: 'Y', color: 'y' }],
        mode: { key: 'split', splitWhen: true, labels: [te.split, te.merge] },
        rangeInMerge: true,
      };
    case 'RGB':
      return {
        slots: [{ label: 'R', color: 'r' }, { label: 'G', color: 'g' }, { label: 'B', color: 'b' }],
        mode: { key: 'splitMode', splitWhen: true, labels: [te.split, te.merge] },
        rangeInMerge: true,
      };
    case 'LCD':
      return {
        slots: [{ label: '/pin0/' }, { label: '/pin1/' }],
        mode: { key: 'advancedMode', splitWhen: false, labels: [te.simple, te.advanced] },
        rangeInMerge: false,
        mergedVirtualOnly: true,
      };
    default:
      return null;
  }
}

/** Current value of a frequency missing from the list: it is added so that it is not lost. */
export function withCurrent(options: Option[], current: unknown): Option[] {
  if (current === undefined || options.some((o) => o.value === current)) return options;
  const label = typeof current === 'number' ? duration(current) : String(current);
  return [...options, { value: current as Option['value'], label }];
}
