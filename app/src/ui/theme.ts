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

// Colori dell'interfaccia, in tinta con i temi delle dashboard ("Blynk" scuro, "BlynkLight" chiaro).
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

/** Palette dell'app (segue il tema di sistema). */
export function usePalette(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}

/** Palette di una dashboard, in base al suo tema Blynk. */
export function dashboardPalette(theme: string | undefined): Palette {
  return theme === 'BlynkLight' ? light : dark;
}
