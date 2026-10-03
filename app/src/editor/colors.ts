// Colori nel selettore dell'editor: una tavolozza per tema
// più, per i widget che li supportano, i quattro gradienti.
// Nel JSON i colori sono interi RGBA con segno (vedi widgets/color.ts).
import type { DashboardTheme } from '@/ui/dashboardTheme';

const DARK_PALETTE = ['#23C48E', '#5F7CD8', '#04C0F8', '#ED9D00', '#D3435C', '#FFFFFF'];
const LIGHT_PALETTE = ['#23C48E', '#000000', '#04C0F8', '#ED9D00', '#D3435C', '#FFFFFF'];

/** Valori speciali dei gradienti, nello stesso ordine di widgets/color.ts: caldo, caldo invertito, freddo, freddo invertito. */
export const GRADIENTS = [2147483647, 2147483646, -2147483648, -2147483647];

export function palette(theme: DashboardTheme): string[] {
  return theme.light ? LIGHT_PALETTE : DARK_PALETTE;
}

/** "#RRGGBB" → intero RGBA con segno, opaco. */
export function cssToRgba(css: string): number {
  const h = css.replace('#', '');
  const rgb = parseInt(h.slice(0, 6), 16);
  return ((rgb << 8) | 0xff) | 0;
}

/** Intero RGBA → "#RRGGBB" (ignora l'alfa), per confrontarlo con la tavolozza. */
export function rgbaToHex(color: number): string {
  return `#${((color >>> 8) & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}
