// Disegno dell'icona TinkerBlink (proposta "H"): griglia 2×2 di widget su area 108×108 (icona adattiva Android,
// contenuto dentro l'area sicura centrale di 66). Usato da app/scripts/render-icons.mjs per generare i PNG.
// Varianti: dark (H, icona dell'app e splash scuro), light (K, web e splash chiaro), mono (icone a tema).

const GREEN = '#23c48e';
const GREEN_DARK = '#0e6e4f';
const CYAN = '#04c0f8';
const ORANGE = '#ed9d00';
const RED = '#d3435c';

export const BACKGROUND = { dark: '#12202a', light: '#eef2f0' };

/** Elementi in primo piano; `gauge` = colori del riquadro col manometro (chiaro su H, scuro su K). */
function tiles(gauge) {
  return `
  <rect x="23" y="23" width="30" height="30" rx="6" fill="${GREEN}"/>
  <rect x="28" y="33" width="20" height="10" rx="5" fill="${GREEN_DARK}"/>
  <circle cx="43" cy="38" r="4.2" fill="#ffffff"/>
  <rect x="57" y="23" width="28" height="30" rx="6" fill="${gauge.tile}"/>
  <path d="M62.5 46 A9 9 0 1 1 79.5 46" fill="none" stroke="${gauge.track}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M62.5 46 A9 9 0 0 1 74 32.6" fill="none" stroke="${GREEN}" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="71" y1="42" x2="76" y2="35" stroke="${gauge.needle}" stroke-width="2.4" stroke-linecap="round"/>
  <rect x="23" y="57" width="30" height="28" rx="6" fill="${CYAN}"/>
  <path d="M27 80 L27 75 L33 69 L39 73 L48 63 L48 80 Z" fill="#ffffff" fill-opacity="0.28"/>
  <polyline points="27,75 33,69 39,73 48,63" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="48" cy="63" r="2.6" fill="#ffffff"/>
  <rect x="57" y="57" width="28" height="12" rx="6" fill="${ORANGE}"/>
  <rect x="57" y="73" width="28" height="12" rx="6" fill="${RED}"/>`;
}

const GAUGE = {
  dark: { tile: '#f1f4f2', track: '#d3dad6', needle: '#1d1e22' },
  light: { tile: '#1d1e22', track: '#3b4048', needle: '#ffffff' },
};

/** Monocromatica: riquadri pieni con i dettagli ritagliati (Android la colora con il tema). */
const MONO = `
  <defs>
    <mask id="cut">
      <rect width="108" height="108" fill="#000"/>
      <rect x="23" y="23" width="30" height="30" rx="6" fill="#fff"/>
      <rect x="28" y="33" width="20" height="10" rx="5" fill="#000"/>
      <circle cx="43" cy="38" r="3.2" fill="#fff"/>
      <rect x="57" y="23" width="28" height="30" rx="6" fill="#fff"/>
      <path d="M62.5 46 A9 9 0 1 1 79.5 46" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="71" y1="42" x2="76" y2="35" stroke="#000" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="23" y="57" width="30" height="28" rx="6" fill="#fff"/>
      <polyline points="27,75 33,69 39,73 48,63" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="48" cy="63" r="2.6" fill="#000"/>
      <rect x="57" y="57" width="28" height="12" rx="6" fill="#fff"/>
      <rect x="57" y="73" width="28" height="12" rx="6" fill="#fff"/>
    </mask>
  </defs>
  <rect width="108" height="108" fill="#ffffff" mask="url(#cut)"/>`;

/**
 * SVG completo. `background`: colore di fondo (omesso = trasparente); `round`: angoli arrotondati come un
 * launcher (per favicon e anteprime); `zoom`: ingrandimento del contenuto (lo splash mostra solo il disegno).
 */
export function iconSvg(variant, { size, background, round = false, zoom = 1 }) {
  const body = variant === 'mono' ? MONO : tiles(GAUGE[variant]);
  const half = 54;
  const view = 108 / zoom;
  const origin = half - view / 2;
  const bg = background ? `<rect x="${origin}" y="${origin}" width="${view}" height="${view}" ${round ? `rx="${view * 0.22}"` : ''} fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${origin} ${origin} ${view} ${view}">${bg}${body}</svg>`;
}
