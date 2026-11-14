// Dashboard themes: colors, sizes and opacities for the two values of the dashboard `theme` field
// (server Theme enum: Blynk dark, BlynkLight light).

/** Widget groups (editor Widget Box), each with its own color. */
export type WidgetGroup = 'controllers' | 'displays' | 'interface' | 'notifications' | 'other' | 'sensors';

export interface DashboardTheme {
  name: 'Blynk' | 'BlynkLight';
  light: boolean;
  /** Background of the running dashboard and of the widgets (they are the same). */
  background: string;
  /** Main text color (labels, values without their own color). */
  text: string;
  /** Opacity of the widget labels. */
  labelAlpha: number;
  /** Border of the LED circle. */
  ledStroke: string;
  /** Text of Buttons that are on. */
  buttonSelectedText: string;
  /** Terminal background. */
  terminalBackground: string;
  /** Gradients: warm = green → yellow → red, cold = green → light blue → blue (palette indexes). */
  warm: string[];
  cold: string[];
  /** Default widget color (Blynk green). */
  accent: string;
  /** Unselected SuperChart periods. */
  periodText: string;
  /** Background arc of the Gauge (alpha 0.3). */
  gaugeTrack: string;
  /** Value next to the title, for example in the Level. */
  pinLabel: string;
  /** R, G, B values of the zeRGBa. */
  rgbRed: string;
  rgbGreen: string;
  rgbBlue: string;
  /** Markers and buttons of the Map widget. */
  mapMarker: string;
  /** Light and dark LCD text. */
  lcdLight: string;
  lcdDark: string;
  /** Joystick base and color of the y value. */
  joystickBase: string;
  joystickY: string;
  /** Color of each widget group: Widget Box icons and color of new widgets. */
  groupColors: Record<WidgetGroup, string>;
}

const DARK_COLORS = ['#FFFFFF', '#23C48E', '#5F7CD8', '#04C0F8', '#ED9D00', '#D3435C', '#1D1E22', '#212227', '#B3B3B3', '#000000', '#131319', '#0a0a0d', '#535353', '#757575', '#898989', '#D8D8D8', '#191A1F', '#F5F5F5', '#3C464D', '#7D918B', '#2C2D32'];
const LIGHT_COLORS = ['#FFFFFF', '#23C48E', '#000000', '#04C0F8', '#ED9D00', '#D3435C', '#3C464D', '#D2D8DC', '#7D918B', '#9EA3A6', '#E3DCCC', '#A4B2AE', '#F2AF59', '#E6ECF0', '#5F7CD8', '#F5F5F5', '#1D1E22', '#EAEAEA', '#212227'];

const pick = (colors: string[], idx: number[]) => idx.map((i) => colors[i]!);

export const DARK_THEME: DashboardTheme = {
  name: 'Blynk',
  light: false,
  background: DARK_COLORS[7]!,
  text: DARK_COLORS[0]!,
  labelAlpha: 0.7,
  ledStroke: DARK_COLORS[10]!,
  buttonSelectedText: DARK_COLORS[7]!,
  terminalBackground: DARK_COLORS[9]!,
  warm: pick(DARK_COLORS, [1, 4, 5]),
  cold: pick(DARK_COLORS, [1, 3, 2]),
  accent: DARK_COLORS[1]!,
  periodText: DARK_COLORS[8]!,
  gaugeTrack: `${DARK_COLORS[9]!}4D`,
  pinLabel: DARK_COLORS[8]!,
  rgbRed: DARK_COLORS[5]!,
  rgbGreen: DARK_COLORS[1]!,
  rgbBlue: DARK_COLORS[3]!,
  mapMarker: DARK_COLORS[10]!,
  lcdLight: DARK_COLORS[0]!,
  lcdDark: DARK_COLORS[9]!,
  joystickBase: DARK_COLORS[9]!,
  joystickY: DARK_COLORS[2]!,
  groupColors: { controllers: DARK_COLORS[1]!, displays: DARK_COLORS[3]!, interface: DARK_COLORS[0]!, notifications: DARK_COLORS[4]!, other: DARK_COLORS[2]!, sensors: DARK_COLORS[5]! },
};

export const LIGHT_THEME: DashboardTheme = {
  name: 'BlynkLight',
  light: true,
  background: LIGHT_COLORS[0]!,
  text: LIGHT_COLORS[2]!,
  labelAlpha: 0.7,
  ledStroke: LIGHT_COLORS[6]!,
  buttonSelectedText: LIGHT_COLORS[0]!,
  terminalBackground: LIGHT_COLORS[2]!,
  warm: pick(LIGHT_COLORS, [1, 4, 5]),
  cold: pick(LIGHT_COLORS, [1, 3, 14]),
  accent: LIGHT_COLORS[1]!,
  periodText: LIGHT_COLORS[2]!,
  gaugeTrack: `${LIGHT_COLORS[9]!}4D`,
  pinLabel: LIGHT_COLORS[8]!,
  rgbRed: LIGHT_COLORS[5]!,
  rgbGreen: LIGHT_COLORS[1]!,
  rgbBlue: LIGHT_COLORS[3]!,
  mapMarker: LIGHT_COLORS[2]!,
  lcdLight: LIGHT_COLORS[0]!,
  lcdDark: LIGHT_COLORS[2]!,
  joystickBase: LIGHT_COLORS[9]!,
  joystickY: LIGHT_COLORS[2]!,
  groupColors: { controllers: LIGHT_COLORS[1]!, displays: LIGHT_COLORS[3]!, interface: LIGHT_COLORS[14]!, notifications: LIGHT_COLORS[2]!, other: LIGHT_COLORS[4]!, sensors: LIGHT_COLORS[5]! },
};

export function dashboardTheme(theme: string | undefined): DashboardTheme {
  return theme === 'BlynkLight' ? LIGHT_THEME : DARK_THEME;
}

/** Value text sizes per FontSize (Value Display and Labeled Value). */
export const VALUE_FONT_SIZE = { SMALL: 16, MEDIUM: 27, LARGE: 33 } as const;
/** Text sizes of Styled Button and Time Input. */
export const SMALL_FONT_SIZE = { SMALL: 12, MEDIUM: 16, LARGE: 20 } as const;
export type FontSize = keyof typeof VALUE_FONT_SIZE;

export function fontSizeOf(table: Record<FontSize, number>, size: unknown, fallback: FontSize = 'MEDIUM'): number {
  return table[(size as FontSize) in table ? (size as FontSize) : fallback];
}
