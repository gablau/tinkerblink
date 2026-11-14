// App fonts: Barlow, a free DIN-style font (OFL, Google Fonts). The Terminal uses the system
// monospace font.
import {
  Barlow_300Light,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  useFonts,
} from '@expo-google-fonts/barlow';
import { VT323_400Regular } from '@expo-google-fonts/vt323';

export const FONT = {
  /** Widget values and labels. */
  light: 'Barlow_300Light',
  regular: 'Barlow_400Regular',
  /** Tab titles. */
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  mono: 'monospace',
  /** LCD: VT323 (OFL), pixel display style. */
  lcd: 'VT323_400Regular',
} as const;

/** Loads the fonts; returns true when they are ready (or when loading failed: the system font is used). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({ Barlow_300Light, Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, VT323_400Regular });
  return loaded || error !== null;
}
