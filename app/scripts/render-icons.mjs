// Genera i PNG dell'icona e dello splash da app/assets/icon-src/tiles.js usando Microsoft Edge (o Chrome) in
// modalità headless, già presente sul PC: niente dipendenze npm in più.
//   node app/scripts/render-icons.mjs
// Su un altro sistema: BROWSER=/percorso/chrome node app/scripts/render-icons.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BACKGROUND, iconSvg } from '../assets/icon-src/tiles.mjs';

const ASSETS = path.join(import.meta.dirname, '..', 'assets');
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const browser = BROWSERS.find((b) => fs.existsSync(b));
if (!browser) throw new Error('Nessun browser Chromium trovato: impostare BROWSER');

const OUTPUTS = [
  // Icona generica (web, store): quadrata e piena, il sistema arrotonda da sé.
  ['icon.png', iconSvg('dark', { size: 1024, background: BACKGROUND.dark })],
  // Icona adattiva Android: primo piano trasparente + colore di fondo in app.json; monocromatica per i temi.
  // Ridotte a 0,82: il launcher ritaglia a cerchio (area sicura di diametro 66 su 108) e gli angoli dei riquadri
  // devono restarci dentro.
  ['android-icon-foreground.png', iconSvg('dark', { size: 1024, zoom: 0.82 })],
  ['android-icon-monochrome.png', iconSvg('mono', { size: 1024, zoom: 0.82 })],
  // Splash: solo il disegno (lo sfondo è il backgroundColor in app.json); K con il tema chiaro, H con lo scuro.
  // Da Android 12 l'immagine dello splash viene ritagliata in un cerchio di 2/3 della larghezza: stessa riduzione
  // dell'icona adattiva.
  ['splash-icon.png', iconSvg('light', { size: 1024, zoom: 0.82 })],
  ['splash-icon-dark.png', iconSvg('dark', { size: 1024, zoom: 0.82 })],
  // Favicon della versione web: K con gli angoli arrotondati.
  ['favicon.png', iconSvg('light', { size: 192, background: BACKGROUND.light, round: true, zoom: 108 / 76 })],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tinkerblink-icons-'));
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (const [name, svg] of OUTPUTS) {
  const size = Number(svg.match(/width="(\d+)"/)[1]);
  const src = path.join(tmp, name.replace('.png', '.svg'));
  fs.writeFileSync(src, svg);
  const out = path.join(ASSETS, name);
  fs.rmSync(out, { force: true });
  // Su Windows msedge.exe restituisce subito il controllo e scrive lo screenshot poco dopo: si aspetta il file.
  execFileSync(
    browser,
    [
      '--headless=new',
      `--user-data-dir=${path.join(tmp, 'profile')}`,
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${out}`,
      pathToFileURL(src).href,
    ],
    { stdio: 'ignore' },
  );
  const deadline = Date.now() + 30000;
  let last = -1;
  for (;;) {
    const bytes = fs.existsSync(out) ? fs.statSync(out).size : -1;
    if (bytes > 0 && bytes === last) break; // dimensione stabile = scrittura finita
    if (Date.now() > deadline) throw new Error(`${name}: screenshot non creato`);
    last = bytes;
    sleep(400);
  }
  console.log(`${name} (${size}×${size})`);
}
// Il browser può tenere aperto il profilo per qualche istante: la cartella temporanea si lascia al sistema se occupata.
try {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
} catch {
  // resta in %TEMP%
}
