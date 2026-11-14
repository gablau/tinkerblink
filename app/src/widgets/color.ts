// Widget colors, in the format stored by the server.
//
// - The JSON stores colors as RGBA (signed 32-bit int): 0xRRGGBBAA.
//   The server converts ARGB → RGBA (ByteUtils.convertARGBtoRGBA). Example: -308477697 = #ED9D00.
// - Four special values mean a gradient that depends on the value between min and max
//   (Integer.MAX_VALUE, MAX_VALUE − 1, MIN_VALUE, MIN_VALUE + 1).
// - setProperty("color", "#RRGGBB") arrives as a string.
import type { DashboardTheme } from '@/ui/dashboardTheme';

const WARM = 2147483647; // Integer.MAX_VALUE: green → yellow → red
const WARM_REVERSED = 2147483646; // red → yellow → green
const COLD = -2147483648; // Integer.MIN_VALUE: green → light blue → blue
const COLD_REVERSED = -2147483647;

export function isGradient(color: unknown): boolean {
  return color === WARM || color === WARM_REVERSED || color === COLD || color === COLD_REVERSED;
}

function gradientStops(color: number, theme: DashboardTheme): string[] {
  switch (color) {
    case WARM:
      return theme.warm;
    case WARM_REVERSED:
      return [...theme.warm].reverse();
    case COLD:
      return theme.cold;
    default:
      return [...theme.cold].reverse();
  }
}

/** Integer RGBA color → "#RRGGBB" or "#RRGGBBAA" (alpha 0 = transparent). */
function rgbaToCss(color: number): string {
  const u = color >>> 0;
  const rgb = (u >>> 8).toString(16).padStart(6, '0');
  const a = u & 0xff;
  return a === 0xff ? `#${rgb}` : `#${rgb}${a.toString(16).padStart(2, '0')}`;
}

/** true if the color is fully transparent (#RRGGBB00). */
export function isTransparent(css: string): boolean {
  return css.length === 9 && css.endsWith('00');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function blend(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}

/** Gradient color for a value: equal segments between min and max, blended between two neighbouring colors. */
function gradientColor(min: number, max: number, value: number, stops: string[]): string {
  const size = Math.abs(max - min);
  const pos = Math.abs(value - min);
  const n = stops.length;
  if (n < 2) return stops[0]!;
  if (pos <= 0) return stops[n - 1]!;
  if (pos >= size) return stops[0]!;
  const step = size / n;
  if (step === 0) return stops[n - 1]!;
  const idx = Math.floor(pos / step);
  if (idx === 0) return stops[n - 1]!;
  if (idx >= n - 1) return stops[0]!;
  const frac = (pos % step) / step;
  const i = n - idx;
  return blend(stops[i]!, stops[i - 1]!, frac);
}

/**
 * Actual color of a widget.
 * @param value current numeric value (only needed for gradients)
 */
export function widgetColor(
  color: unknown,
  theme: DashboardTheme,
  opts: { min?: number; max?: number; value?: number } = {},
): string {
  if (typeof color === 'string' && color.startsWith('#')) return color;
  if (typeof color !== 'number') return theme.accent;
  if (isGradient(color)) {
    const stops = gradientStops(color, theme);
    const { min = 0, max = 100, value } = opts;
    // Without a value the first gradient color is used.
    return value === undefined || !Number.isFinite(value) ? stops[0]! : gradientColor(min, max, value, stops);
  }
  return rgbaToCss(color);
}

/** Adds an opacity (0-1) to a "#RRGGBB" color. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
