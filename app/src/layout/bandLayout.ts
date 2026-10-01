// Disposizione dei widget sullo schermo, a partire dalla griglia a 8 colonne (x, y, width, height sul server).
//
// Telefono in verticale: una sola colonna, con la griglia così com'è.
// Schermi larghi (orizzontale, tablet, web): la dashboard viene divisa in "fasce" orizzontali
// (gruppi di righe che nessun widget attraversa) e le fasce vengono distribuite su più colonne
// affiancate, ognuna larga come un telefono. Dentro ogni fascia la disposizione resta identica
// alla griglia; i dati sul server non cambiano.

export const GRID_COLUMNS = 8;
export const CELL_ASPECT = 1.35;
/** Larghezza minima di una colonna: sotto questa misura le 8 celle diventano troppo strette. */
export const MIN_COLUMN_WIDTH = 340;
/** Larghezza massima di una colonna: oltre, i widget diventano inutilmente grandi. */
export const MAX_COLUMN_WIDTH = 560;
/** Spazio orizzontale tra due colonne affiancate. */
export const COLUMN_GAP = 16;
/**
 * Spazio verticale tra due fasce, ma solo se nella griglia erano separate da righe vuote
 * (l'utente le aveva staccate apposta). Le fasce adiacenti restano attaccate.
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
  top: number; // prima riga (in celle)
  rows: number; // altezza in righe
  items: T[];
  /** true se nella griglia c'erano righe vuote tra questa fascia e la precedente. */
  separated: boolean;
}

/** Divide gli elementi in fasce: intervalli di righe [y, y+height) che si sovrappongono vengono uniti. */
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
 * Calcola le posizioni in pixel.
 * @param rowOffset righe da togliere in alto (1 quando c'è la barra delle schede al posto della riga 0)
 * @param availableWidth larghezza disponibile in pixel
 */
export function computeLayout<T extends GridItem>(items: T[], rowOffset: number, availableWidth: number): Layout<T> {
  const shifted = items.map((it) => ({ it, y: it.y - rowOffset }));
  const columns = Math.max(1, Math.floor((availableWidth + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP)));

  // Una colonna: griglia a 8 colonne, comprese le righe vuote lasciate apposta dall'utente.
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

  // Più colonne: fasce distribuite in ordine di lettura, colonna dopo colonna, bilanciando le altezze.
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
    // Si passa alla colonna successiva se questa fascia sforerebbe l'altezza obiettivo di più di metà
    // della sua altezza (e se ci sono ancora colonne libere).
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
