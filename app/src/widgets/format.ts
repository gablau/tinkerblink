// Formattazione dei valori dei widget (Value Display, Labeled Value, formati "#.##" e "/pin/",
// orari). La mappatura degli intervalli (rangeMappingOn) non è ancora implementata: nei progetti
// provati finora nessun widget la usa.

/** Intero (segno opzionale, solo cifre). */
export function parseLong(s: string): number | null {
  return /^[+-]?\d+$/.test(s.trim()) ? Number(s) : null;
}

/** Numero decimale (accetta anche la virgola come separatore). */
export function parseFloatValue(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Arrotondamento half-up (0,5 verso l'alto), senza separatore delle migliaia. */
function roundHalfUp(n: number, digits: number): number {
  const f = 10 ** digits;
  // toPrecision corregge gli errori di rappresentazione (1.005 * 100 = 100.49999…).
  const scaled = Number((Math.abs(n) * f).toPrecision(15));
  return (Math.sign(n) * Math.round(scaled)) / f;
}

/** Pattern "#.##": al massimo `maxDigits` decimali, senza zeri finali. */
export function formatMaxDigits(n: number, maxDigits = 2): string {
  const r = roundHalfUp(n, maxDigits);
  return String(r === 0 ? 0 : r);
}

/** Esattamente `digits` decimali. */
export function formatFixedDigits(n: number, digits: number): string {
  return roundHalfUp(n, digits).toFixed(digits);
}

/** Testo del Value Display: interi così come sono, decimali con "#.##", altrimenti il testo. */
export function formatValueDisplay(raw: string | undefined): { text: string; number?: number } {
  if (raw === undefined || raw === '') return { text: '' };
  const asLong = parseLong(raw);
  if (asLong !== null) return { text: String(asLong), number: asLong };
  const asFloat = parseFloatValue(raw);
  if (asFloat !== null) return { text: formatMaxDigits(asFloat), number: asFloat };
  return { text: raw };
}

const PIN_PATTERN = /\/pin\.?#*\//i;

/**
 * Testo del Labeled Value. Formato di default "/pin/".
 * "/pin/" = valore così com'è; "/pin./" = 0 decimali; "/pin.#/" = 1 decimale fisso; "/pin.##/" = 2…
 */
export function formatLabeled(raw: string | undefined, formatting: string | undefined): { text: string; number?: number } {
  const fmt = formatting && formatting.length > 0 ? formatting : '/pin/';
  const match = PIN_PATTERN.exec(fmt);
  if (raw === undefined || raw === '') {
    return { text: match ? fmt.replace(PIN_PATTERN, '').trim() : fmt };
  }
  if (!match) return { text: fmt };

  const token = match[0];
  const dot = token.indexOf('.');
  const digits = dot < 0 ? null : token.length - dot - 2; // numero di "#" dopo il punto
  let formatted: string;
  const asLong = parseLong(raw);
  const asFloat = asLong === null ? parseFloatValue(raw) : null;
  if (asLong !== null) {
    formatted = digits === null ? String(asLong) : digits === 0 ? String(asLong) : formatFixedDigits(asLong, digits);
  } else if (asFloat !== null) {
    formatted = digits === null ? raw.replace(',', '.') : digits === 0 ? formatFixedDigits(asFloat, 0) : formatFixedDigits(asFloat, digits);
  } else {
    formatted = raw;
  }
  const number = parseFloatValue(formatted) ?? undefined;
  return { text: fmt.replace(PIN_PATTERN, formatted), number };
}

/** Testi usati dalla formattazione di orari e giorni (dalla lingua dell'app, vedi src/i18n.ts). */
export interface TimeTexts {
  everyday: string;
  weekdays: string;
  weekends: string;
  sunrise: string;
  sunset: string;
  /** Lunedì … domenica. */
  days: string[];
}

/** "18000" → "05:00"; "sr"/"ss" → alba/tramonto. */
export function formatTimeOfDay(raw: string | undefined, format: string, texts: TimeTexts): string {
  if (raw === 'sr') return texts.sunrise;
  if (raw === 'ss') return texts.sunset;
  const s = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(s) || s < 0) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  if (/h/.test(format) && /a/i.test(format)) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  }
  const hh = String(h).padStart(2, '0');
  return /ss/.test(format) ? `${hh}:${mm}:${String(sec).padStart(2, '0')}` : `${hh}:${mm}`;
}

/** Giorni del Time Input (1 = lunedì … 7 = domenica). */
export function formatDays(days: number[], texts: TimeTexts): string {
  const set = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort();
  if (set.length === 0 || set.length === 7) return texts.everyday;
  if (set.join() === '1,2,3,4,5') return texts.weekdays;
  if (set.join() === '6,7') return texts.weekends;
  return set.map((d) => texts.days[d - 1]).join(', ');
}
