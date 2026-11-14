// Colors in the editor color picker: one palette per theme
// plus, for the widgets that support them, the four gradients.
// In the JSON colors are signed RGBA integers (see widgets/color.ts).
import type { DashboardTheme } from '@/ui/dashboardTheme';

const DARK_PALETTE = ['#23C48E', '#5F7CD8', '#04C0F8', '#ED9D00', '#D3435C', '#FFFFFF'];
const LIGHT_PALETTE = ['#23C48E', '#000000', '#04C0F8', '#ED9D00', '#D3435C', '#FFFFFF'];

/** Special gradient values, in the same order as widgets/color.ts: warm, warm reversed, cold, cold reversed. */
export const GRADIENTS = [2147483647, 2147483646, -2147483648, -2147483647];

export function palette(theme: DashboardTheme): string[] {
  return theme.light ? LIGHT_PALETTE : DARK_PALETTE;
}

/** "#RRGGBB" → signed RGBA integer, opaque. */
export function cssToRgba(css: string): number {
  const h = css.replace('#', '');
  const rgb = parseInt(h.slice(0, 6), 16);
  return ((rgb << 8) | 0xff) | 0;
}

/** RGBA integer → "#RRGGBB" (alpha ignored), to compare it with the palette. */
export function rgbaToHex(color: number): string {
  return `#${((color >>> 8) & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}
