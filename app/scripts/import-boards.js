// Importa le definizioni delle schede dal repo gablau/tinkerblink-boards (fork di blynkkk/boards, licenza MIT)
// in app/src/editor/boards/data/ e rigenera l'indice app/src/editor/boards/index.ts.
// I JSON si salvano minificati, con gli spazi del nome del file sostituiti da "_"; la cartella debug/ del repo
// (schede di prova) non si importa.
//
// Con il sorgente del server rigenera anche l'elenco dei modelli in app/src/project/boardTypes.ts (il blocco tra
// "// <boards>" e "// </boards>"), che deve coincidere con l'enum BoardType: il server trasforma ogni nome che
// non conosce in "Generic Board". Segnala le schede con i pin ma senza nome nell'enum (non selezionabili) e i
// nomi dell'enum senza pin (usano i pin della scheda generica).
//
// Uso:
//   git clone https://github.com/gablau/tinkerblink-boards
//   git clone https://github.com/gablau/blynk-server
//   node app/scripts/import-boards.js <clone delle schede> [<clone del server oppure BoardType.java>]
const fs = require('fs');
const path = require('path');

const ENUM_PATH = 'server/core/src/main/java/cc/blynk/server/core/model/device/BoardType.java';

const [src, server] = process.argv.slice(2);
if (!src || !fs.existsSync(path.join(src, 'LICENSE'))) {
  console.error(
    'Uso: node app/scripts/import-boards.js <clone di https://github.com/gablau/tinkerblink-boards> ' +
      '[<clone di https://github.com/gablau/blynk-server oppure BoardType.java>]',
  );
  process.exit(1);
}
const appDir = path.join(__dirname, '..');
const boardsDir = path.join(appDir, 'src', 'editor', 'boards');
const dataDir = path.join(boardsDir, 'data');

// ——— Pin delle schede ———

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(dataDir, 'LICENSE'));

const names = [];
const entries = [];
for (const file of fs.readdirSync(src).filter((f) => f.endsWith('.json')).sort()) {
  const board = JSON.parse(fs.readFileSync(path.join(src, file), 'utf8'));
  const dest = file.replace(/ /g, '_');
  fs.writeFileSync(path.join(dataDir, dest), JSON.stringify(board) + '\n');
  names.push(board.name);
  entries.push(`  ${JSON.stringify(board.name)}: require('./data/${dest}'),`);
}

fs.writeFileSync(
  path.join(boardsDir, 'index.ts'),
  [
    '// Indice delle definizioni delle schede Blynk (licenza MIT, vedi data/LICENSE).',
    '// Chiave = nome della scheda come nel campo boardType dei device.',
    "import type { BoardJson } from './types';",
    '',
    'export const BOARD_FILES: Record<string, BoardJson> = {',
    ...entries,
    '};',
    '',
  ].join('\n'),
);
console.log(`${entries.length} schede importate da ${src}`);

// ——— Modelli del server ———

if (!server) {
  console.log('Server non indicato: elenco dei modelli in boardTypes.ts non aggiornato.');
  process.exit(0);
}
const enumFile = fs.statSync(server).isDirectory() ? path.join(server, ENUM_PATH) : server;
const labels = [...fs.readFileSync(enumFile, 'utf8').matchAll(/^\s+\w+\("([^"]+)"\)\s*[,;]/gm)].map((m) => m[1]);
if (!labels.includes('Generic Board')) {
  console.error(`Enum BoardType non riconosciuto in ${enumFile}`);
  process.exit(1);
}

/** Etichette tra apici, a capo prima dei 115 caratteri, come il resto del codice. */
function wrap(items, indent) {
  const lines = [];
  let line = indent;
  for (const item of items) {
    const piece = `${JSON.stringify(item).replace(/^"|"$/g, "'")},`;
    if (line.length + piece.length + 1 > 115 && line.trim()) {
      lines.push(line.trimEnd());
      line = indent;
    }
    line += `${piece} `;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

const typesFile = path.join(appDir, 'src', 'project', 'boardTypes.ts');
const text = fs.readFileSync(typesFile, 'utf8');
const start = text.indexOf('// <boards>\n');
const end = text.indexOf('// </boards>');
if (start < 0 || end < start) {
  console.error(`Marcatori "// <boards>" e "// </boards>" non trovati in ${typesFile}`);
  process.exit(1);
}
const block = [
  '// <boards>',
  `// Generato da app/scripts/import-boards.js dall'enum BoardType del server (${labels.length} modelli): non modificare.`,
  'const SERVER_BOARD_TYPES = [',
  ...wrap(labels, '  '),
  '];',
  '',
].join('\n');
fs.writeFileSync(typesFile, text.slice(0, start) + block + text.slice(end));
console.log(`${labels.length} modelli del server scritti in ${path.relative(path.join(appDir, '..'), typesFile)}`);

const noEnum = names.filter((n) => !labels.includes(n));
const noPins = labels.filter((l) => !names.includes(l));
if (noEnum.length) console.log(`Schede con i pin ma assenti dall'enum (non selezionabili): ${noEnum.join(', ')}`);
if (noPins.length) console.log(`Modelli dell'enum senza pin (usano la scheda generica): ${noPins.join(', ')}`);
