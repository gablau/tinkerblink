// Importa le pagine dei widget dalla documentazione utente di Blynk Legacy (fork gablau/blynk-legacy-docs,
// licenza MIT: reference/blynk-legacy-docs/License.md) e genera app/src/editor/widgetDocs.ts, mostrato nel
// popup informativo del Widget Box. Le immagini si tolgono (non sono incluse nell'app).
//
// Uso: node app/scripts/import-widget-docs.js [cartella mobile/ della documentazione]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = process.argv[2] ?? path.join(ROOT, 'reference', 'blynk-legacy-docs', 'mobile');
const DEST = path.join(ROOT, 'app', 'src', 'editor', 'widgetDocs.ts');

/** Tipo del widget → file della documentazione. */
const FILES = {
  BUTTON: 'button.md',
  STYLED_BUTTON: 'styled_button.md',
  SLIDER: 'slider.md',
  VERTICAL_SLIDER: 'slider.md',
  STEP: 'step.md',
  VERTICAL_STEP: 'step.md',
  TIMER: 'timer.md',
  TWO_AXIS_JOYSTICK: 'joystick.md',
  RGB: 'rgb.md',
  DIGIT4_DISPLAY: 'value_display.md',
  LABELED_VALUE_DISPLAY: 'labeled_value_display.md',
  LED: 'led.md',
  GAUGE: 'gauge.md',
  LEVEL_DISPLAY: 'level_display.md',
  VERTICAL_LEVEL_DISPLAY: 'level_display.md',
  LCD: 'lcd.md',
  TERMINAL: 'terminal.md',
  ENHANCED_GRAPH: 'super_chart.md',
  VIDEO: 'video.md',
  IMAGE: 'image.md',
  TABS: 'tabs.md',
  MENU: 'menu.md',
  SEGMENTED_CONTROL: 'segmented_control.md',
  TEXT_INPUT: 'text_input.md',
  NUMBER_INPUT: 'number_input.md',
  TIME_INPUT: 'time_input.md',
  TABLE: 'table.md',
  MAP: 'map.md',
  NOTIFICATION: 'notification.md',
  EMAIL: 'email.md',
  BRIDGE: 'bridge.md',
  RTC: 'rtc.md',
  WEBHOOK: 'webhook.md',
  PLAYER: 'music_player.md',
  GPS_STREAMING: 'gps_streaming.md',
  GPS_TRIGGER: 'gps_trigger.md',
  LIGHT: 'light.md',
  PROXIMITY: 'proximity.md',
  TEMPERATURE: 'temperature.md',
  BAROMETER: 'barometer.md',
  ACCELEROMETER: 'accelerometer.md',
  GRAVITY: 'gravity.md',
  HUMIDITY: 'humidity.md',
};

function clean(md) {
  return md
    .replace(/\r/g, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim()
    .replace(/^#+[^\n]*\n/, '') // il titolo lo mostra già il popup
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const docs = {};
for (const [type, file] of Object.entries(FILES)) {
  const p = path.join(SRC, file);
  if (fs.existsSync(p)) docs[type] = clean(fs.readFileSync(p, 'utf8'));
}

const lines = [
  '// Generato da app/scripts/import-widget-docs.js dalla documentazione utente di Blynk Legacy',
  '// (gablau/blynk-legacy-docs, licenza MIT). Non modificare a mano: rigenerare con lo script.',
  '',
  'export const WIDGET_DOCS: Record<string, string> = ' + JSON.stringify(docs, null, 2) + ';',
  '',
];
fs.writeFileSync(DEST, lines.join('\n'));
console.log(Object.keys(docs).length, 'widget documentati');
