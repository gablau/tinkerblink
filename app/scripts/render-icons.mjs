// Renders the icon and splash PNGs from app/assets/icon-src/tiles.mjs with headless Microsoft Edge (or Chrome),
// already installed on the PC: no extra npm dependencies.
//   node app/scripts/render-icons.mjs
// On other systems: BROWSER=/path/to/chrome node app/scripts/render-icons.mjs
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
if (!browser) throw new Error('No Chromium browser found: set BROWSER');

const OUTPUTS = [
  // Generic icon (web, stores): square and filled, the system rounds it.
  ['icon.png', iconSvg('dark', { size: 1024, background: BACKGROUND.dark })],
  // Android adaptive icon: transparent foreground + background color in app.json; monochrome for themed icons.
  // Scaled to 0.82: the launcher crops to a circle (safe area 66 across out of 108) and the corners of the tiles
  // must stay inside it.
  ['android-icon-foreground.png', iconSvg('dark', { size: 1024, zoom: 0.82 })],
  ['android-icon-monochrome.png', iconSvg('mono', { size: 1024, zoom: 0.82 })],
  // Splash: the drawing only (the background is backgroundColor in app.json); K with the light theme, H with the dark.
  // Since Android 12 the splash image is cropped to a circle 2/3 of the width wide: same scaling as the adaptive
  // icon.
  ['splash-icon.png', iconSvg('light', { size: 1024, zoom: 0.82 })],
  ['splash-icon-dark.png', iconSvg('dark', { size: 1024, zoom: 0.82 })],
  // Favicon of the web version: K with rounded corners.
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
  // On Windows msedge.exe returns immediately and writes the screenshot shortly after: wait for the file.
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
    if (bytes > 0 && bytes === last) break; // stable size = writing finished
    if (Date.now() > deadline) throw new Error(`${name}: screenshot not created`);
    last = bytes;
    sleep(400);
  }
  console.log(`${name} (${size}×${size})`);
}
// The browser may keep the profile open for a moment: if the temporary folder is busy, leave it to the system.
try {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
} catch {
  // stays in %TEMP%
}
