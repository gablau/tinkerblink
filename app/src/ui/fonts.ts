// Font dell'app: Barlow, un font libero (OFL, Google Fonts) in stile DIN. Per il Terminal il monospace
// di sistema.
import {
  Barlow_300Light,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  useFonts,
} from '@expo-google-fonts/barlow';
import { VT323_400Regular } from '@expo-google-fonts/vt323';

export const FONT = {
  /** Valori ed etichette dei widget. */
  light: 'Barlow_300Light',
  regular: 'Barlow_400Regular',
  /** Titoli delle schede. */
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  mono: 'monospace',
  /** LCD: VT323 (OFL), stile display a pixel. */
  lcd: 'VT323_400Regular',
} as const;

/** Carica i font; restituisce true quando sono pronti (o se il caricamento è fallito: si usa quello di sistema). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({ Barlow_300Light, Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, VT323_400Regular });
  return loaded || error !== null;
}
