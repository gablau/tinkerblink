import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  danger: string;
}

// User interface colors, matching the dashboard themes ("Blynk" dark, "BlynkLight" light).
const dark: Palette = {
  background: '#212227',
  card: '#2C2D33',
  text: '#F2F2F2',
  muted: '#9A9CA5',
  border: '#3A3B42',
  accent: '#23C48E',
  danger: '#D3435C',
};

const light: Palette = {
  background: '#F2F3F5',
  card: '#FFFFFF',
  text: '#1D1E22',
  muted: '#6B6E78',
  border: '#DADCE0',
  accent: '#1AA37A',
  danger: '#C62C46',
};

/** App palette (follows the system theme). */
export function usePalette(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}

/** Palette of a dashboard, from its Blynk theme. */
export function dashboardPalette(theme: string | undefined): Palette {
  return theme === 'BlynkLight' ? light : dark;
}
