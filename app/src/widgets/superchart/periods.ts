// Periodi del SuperChart: etichette e formati delle date mostrati nel widget.
//
// Attenzione ai nomi: nel profilo e nelle richieste al server si usano i nomi del SERVER (GraphPeriod), che
// non sono intuitivi. Per esempio il server chiama "DAY" il giorno al minuto (1440 punti) e "N_DAY" il
// giorno orario (24 punti). Qui tutto è indicizzato con i nomi del server.
import { GRAPH_PERIODS, type GraphPeriod } from '@tinkerblink/protocol';
import { language, t } from '@/i18n';

const GRANULARITY_MS = { MINUTE: 60_000, HOURLY: 3_600_000, DAILY: 86_400_000 } as const;

/**
 * Formati delle date (pattern in stile LDML: HH:mm, MMM d…, sempre a 24 ore):
 * - axis: etichette dell'asse X;
 * - full: ora del punto selezionato col dito.
 */
interface PeriodInfo {
  label: string;
  axis: string;
  full: string;
}

const HOURS = 'HH:mm';
const DAY_TIME = 'HH:mm, MMM dd';
const DATE = 'MMM dd, yyyy';

const INFO: Record<GraphPeriod, PeriodInfo> = {
  LIVE: { label: 'Live', axis: 'HH:mm:ss', full: 'HH:mm:ss' },
  FIFTEEN_MINUTES: { label: '15m', axis: HOURS, full: HOURS },
  THIRTY_MINUTES: { label: '30m', axis: HOURS, full: HOURS },
  ONE_HOUR: { label: '1h', axis: HOURS, full: HOURS },
  THREE_HOURS: { label: '3h', axis: HOURS, full: HOURS },
  SIX_HOURS: { label: '6h', axis: 'HH', full: HOURS },
  TWELVE_HOURS: { label: '12h', axis: 'HH', full: HOURS },
  DAY: { label: '1d', axis: 'HH', full: HOURS },
  N_DAY: { label: '1d', axis: 'HH', full: HOURS },
  TWO_DAYS: { label: '2d', axis: 'HH', full: HOURS },
  THREE_DAYS: { label: '3d', axis: 'EEE, HH:mm', full: DAY_TIME },
  N_THREE_DAYS: { label: '3d', axis: 'EEE, HH:mm', full: DAY_TIME },
  WEEK: { label: '1w', axis: 'EEE dd', full: DAY_TIME },
  N_WEEK: { label: '1w', axis: 'EEE dd', full: DAY_TIME },
  TWO_WEEKS: { label: '2w', axis: 'EEE dd', full: DAY_TIME },
  N_TWO_WEEKS: { label: '2w', axis: 'EEE dd', full: DAY_TIME },
  MONTH: { label: '1M', axis: 'MMM dd', full: DATE },
  N_MONTH: { label: '1M', axis: 'MMM dd', full: DATE },
  THREE_MONTHS: { label: '3M', axis: 'MMM dd', full: DATE },
  N_THREE_MONTHS: { label: '3M', axis: 'MMM dd', full: DATE },
  SIX_MONTHS: { label: '6M', axis: 'MMM dd', full: DATE },
  ONE_YEAR: { label: '1Y', axis: DATE, full: DATE },
  ALL: { label: 'all', axis: DATE, full: DATE },
};

/** Periodi di default di un SuperChart nuovo (Superchart.java del server). */
export const DEFAULT_PERIODS: GraphPeriod[] = ['LIVE', 'ONE_HOUR', 'SIX_HOURS', 'N_DAY', 'N_WEEK', 'N_MONTH', 'N_THREE_MONTHS'];

const ORDER = Object.keys(INFO) as GraphPeriod[];

export function isGraphPeriod(p: unknown): p is GraphPeriod {
  return typeof p === 'string' && p in INFO;
}

/** Periodi selezionabili del widget (selectedPeriods di Superchart.java del server), dal più breve al più lungo. */
export function selectablePeriods(selected: unknown): GraphPeriod[] {
  const list = Array.isArray(selected) ? selected.filter(isGraphPeriod) : [];
  return (list.length > 0 ? list : DEFAULT_PERIODS).slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

export function periodLabel(p: GraphPeriod): string {
  return INFO[p].label;
}

/** Larghezza della finestra di un periodo storico, in ms (punti × granularità). */
export function periodSpanMs(p: GraphPeriod): number {
  const { points, granularity } = GRAPH_PERIODS[p];
  return points * GRANULARITY_MS[granularity];
}

/** Durata di un punto (ms). Serve per riconoscere i buchi nei dati e per la larghezza delle barre. */
export function periodStepMs(p: GraphPeriod): number {
  return p === 'LIVE' ? 1000 : GRANULARITY_MS[GRAPH_PERIODS[p].granularity];
}

/** Numero di etichette dell'asse X: 5, oppure 7 per le settimane. */
export function xLabelCount(p: GraphPeriod): number {
  return p === 'WEEK' || p === 'N_WEEK' ? 7 : 5;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Formatta un timestamp con i pochi token usati sopra, con i nomi di mesi e giorni della lingua dell'app. */
/** In italiano il giorno va prima del mese: "01 ott", "01 ott 2026". */
function localize(pattern: string): string {
  if (language !== 'it') return pattern;
  return pattern.replace('MMM dd, yyyy', 'dd MMM yyyy').replace('MMM dd', 'dd MMM');
}

function format(ts: number, raw: string): string {
  const pattern = localize(raw);
  const d = new Date(ts);
  // getDay(): 0 = domenica; t.days parte dal lunedì.
  const weekday = t.days[(d.getDay() + 6) % 7]!;
  return pattern.replace(/yyyy|MMM|EEE|HH|mm|ss|dd/g, (tok) => {
    switch (tok) {
      case 'yyyy':
        return String(d.getFullYear());
      case 'MMM':
        return t.months[d.getMonth()]!;
      case 'EEE':
        return weekday;
      case 'HH':
        return pad(d.getHours());
      case 'mm':
        return pad(d.getMinutes());
      case 'ss':
        return pad(d.getSeconds());
      default:
        return pad(d.getDate());
    }
  });
}

export function formatAxisTime(ts: number, p: GraphPeriod): string {
  return format(ts, INFO[p].axis);
}

/**
 * Ora del punto selezionato col dito: se il
 * formato del periodo non ha la data e il punto non è di oggi, si aggiungono giorno e mese. Nel LIVE mai.
 */
export function formatFullTime(ts: number, p: GraphPeriod): string {
  const pattern = INFO[p].full;
  if (p !== 'LIVE' && !pattern.includes('MMM')) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (ts < today.getTime()) return format(ts, DAY_TIME);
  }
  return format(ts, pattern);
}
