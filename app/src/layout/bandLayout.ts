// Layout of the widgets on the screen, starting from the 8-column grid (x, y, width, height on the server).
//
// Phone in portrait: a single column, with the grid as it is.
// Wide screens (landscape, tablet, web): the dashboard is split into horizontal "bands"
// (groups of rows that no widget crosses) and the bands are distributed over several
// side-by-side columns, each as wide as a phone. Inside each band the layout is identical
// to the grid; the data on the server does not change.

export const GRID_COLUMNS = 8;
export const CELL_ASPECT = 1.35;
/** Minimum width of a column: below this size the 8 cells become too narrow. */
export const MIN_COLUMN_WIDTH = 340;
/** Maximum width of a column: beyond it the widgets become needlessly large. */
export const MAX_COLUMN_WIDTH = 560;
/** Horizontal space between two side-by-side columns. */
export const COLUMN_GAP = 16;
/**
 * Vertical space between two bands, but only if they were separated by empty rows in the grid
 * (the user had set them apart on purpose). Adjacent bands stay attached.
 */
export const BAND_GAP = 12;

export interface GridItem {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placed<T extends GridItem> {
  item: T;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Layout<T extends GridItem> {
  placed: Placed<T>[];
  width: number;
  height: number;
  columns: number;
  bands: number;
}

interface Band<T> {
  top: number; // first row (in cells)
  rows: number; // height in rows
  items: T[];
  /** true if in the grid there were empty rows between this band and the previous one. */
  separated: boolean;
}

/** Splits the items into bands: row ranges [y, y+height) that overlap are merged. */
export function splitIntoBands<T extends GridItem>(items: T[]): Band<T>[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const bands: Band<T>[] = [];
  let current: Band<T> | undefined;
  for (const it of sorted) {
    if (current && it.y < current.top + current.rows) {
      current.rows = Math.max(current.rows, it.y + it.height - current.top);
      current.items.push(it);
    } else {
      const separated = current !== undefined && it.y > current.top + current.rows;
      current = { top: it.y, rows: it.height, items: [it], separated };
      bands.push(current);
    }
  }
  return bands;
}

/**
 * Computes the positions in pixels.
 * @param rowOffset rows to remove at the top (1 when the tab bar replaces row 0)
 * @param availableWidth available width in pixels
 */
export function computeLayout<T extends GridItem>(items: T[], rowOffset: number, availableWidth: number, singleColumn = false): Layout<T> {
  const shifted = items.map((it) => ({ it, y: it.y - rowOffset }));
  // singleColumn: 8-column grid also on wide screens (editor edit mode).
  const columns = singleColumn ? 1 : Math.max(1, Math.floor((availableWidth + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP)));

  // One column: 8-column grid, including the empty rows left on purpose by the user.
  if (columns === 1) {
    const colWidth = Math.min(availableWidth, MAX_COLUMN_WIDTH);
    const cellW = colWidth / GRID_COLUMNS;
    const cellH = cellW * CELL_ASPECT;
    const rows = shifted.reduce((m, s) => Math.max(m, s.y + s.it.height), 0);
    return {
      placed: shifted.map(({ it, y }) => ({
        item: it,
        left: it.x * cellW,
        top: y * cellH,
        width: it.width * cellW,
        height: it.height * cellH,
      })),
      width: colWidth,
      height: rows * cellH,
      columns: 1,
      bands: 1,
    };
  }

  // Several columns: bands distributed in reading order, column after column, balancing the heights.
  const colWidth = Math.min((availableWidth - COLUMN_GAP * (columns - 1)) / columns, MAX_COLUMN_WIDTH);
  const cellW = colWidth / GRID_COLUMNS;
  const cellH = cellW * CELL_ASPECT;
  const bands = splitIntoBands(shifted.map(({ it, y }) => ({ ...it, y, orig: it })));
  const bandHeight = (b: Band<unknown>) => b.rows * cellH;
  const total = bands.reduce((s, b) => s + bandHeight(b) + (b.separated ? BAND_GAP : 0), 0);
  const target = total / columns;

  const placed: Placed<T>[] = [];
  const colHeights: number[] = new Array(columns).fill(0);
  let col = 0;
  for (const band of bands) {
    const h = bandHeight(band);
    // Move to the next column if this band would exceed the target height by more than half
    // of its own height (and if there are still free columns).
    if (colHeights[col]! > 0 && col < columns - 1 && colHeights[col]! + h / 2 > target) col++;
    const top = colHeights[col]! + (colHeights[col]! > 0 && band.separated ? BAND_GAP : 0);
    const left = col * (colWidth + COLUMN_GAP);
    for (const it of band.items) {
      placed.push({
        item: it.orig,
        left: left + it.x * cellW,
        top: top + (it.y - band.top) * cellH,
        width: it.width * cellW,
        height: it.height * cellH,
      });
    }
    colHeights[col] = top + h;
  }

  const usedColumns = colHeights.filter((h) => h > 0).length || 1;
  return {
    placed,
    width: usedColumns * colWidth + (usedColumns - 1) * COLUMN_GAP,
    height: Math.max(...colHeights),
    columns: usedColumns,
    bands: bands.length,
  };
}
