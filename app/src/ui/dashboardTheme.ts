// Temi delle dashboard: colori, dimensioni e opacità per i due valori del campo `theme` della dashboard
// (enum Theme del server: Blynk scuro, BlynkLight chiaro).

export interface DashboardTheme {
  name: 'Blynk' | 'BlynkLight';
  light: boolean;
  /** Sfondo della dashboard in esecuzione e dei widget (coincidono). */
  background: string;
  /** Colore del testo principale (etichette, valori senza colore proprio). */
  text: string;
  /** Opacità delle etichette dei widget. */
  labelAlpha: number;
  /** Bordo del cerchio dei LED. */
  ledStroke: string;
  /** Testo dei Button accesi. */
  buttonSelectedText: string;
  /** Sfondo del Terminal. */
  terminalBackground: string;
  /** Gradienti: warm = verde → giallo → rosso, cold = verde → azzurro → blu (indici della palette). */
  warm: string[];
  cold: string[];
  /** Colore di default dei widget (verde Blynk). */
  accent: string;
  /** Periodi non selezionati del SuperChart. */
  periodText: string;
  /** Arco di sfondo del Gauge (alfa 0,3). */
  gaugeTrack: string;
  /** Valore accanto al titolo, per esempio nel Level. */
  pinLabel: string;
  /** Valori R, G, B dello zeRGBa. */
  rgbRed: string;
  rgbGreen: string;
  rgbBlue: string;
  /** Marker e pulsanti del widget Map. */
  mapMarker: string;
  /** Testo dell'LCD chiaro e scuro. */
  lcdLight: string;
  lcdDark: string;
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
};

export function dashboardTheme(theme: string | undefined): DashboardTheme {
  return theme === 'BlynkLight' ? LIGHT_THEME : DARK_THEME;
}

/** Dimensioni del testo dei valori per FontSize (Value Display e Labeled Value). */
export const VALUE_FONT_SIZE = { SMALL: 16, MEDIUM: 27, LARGE: 33 } as const;
/** Dimensioni dei testi di Styled Button e Time Input. */
export const SMALL_FONT_SIZE = { SMALL: 12, MEDIUM: 16, LARGE: 20 } as const;
export type FontSize = keyof typeof VALUE_FONT_SIZE;

export function fontSizeOf(table: Record<FontSize, number>, size: unknown, fallback: FontSize = 'MEDIUM'): number {
  return table[(size as FontSize) in table ? (size as FontSize) : fallback];
}
