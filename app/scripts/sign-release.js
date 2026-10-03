// Firma l'APK di release con la chiave in keys/ (esclusa da git) e lo copia in release/.
//
//   cd app/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
//   node app/scripts/sign-release.js
//
// La build di Expo firma la release con la chiave di debug: qui si rifà allineamento e firma con
// zipalign + apksigner dei build-tools dell'Android SDK, senza toccare android/ (generata da prebuild).
// La password si legge da keys/keystore.properties e non viene mai stampata.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const keysDir = path.join(root, 'keys');
const props = Object.fromEntries(
  fs
    .readFileSync(path.join(keysDir, 'keystore.properties'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const buildToolsDir = path.join(sdk, 'build-tools');
const version = fs.readdirSync(buildToolsDir).sort().pop();
const bt = path.join(buildToolsDir, version);
const exe = (name) => path.join(bt, process.platform === 'win32' ? `${name}${name === 'apksigner' ? '.bat' : '.exe'}` : name);

const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app', 'app.json'), 'utf8'));
const appVersion = appJson.expo.version;
const input = path.join(root, 'app', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const aligned = path.join(outDir, 'aligned.tmp.apk');
const output = path.join(outDir, `blynk-legacy-${appVersion}.apk`);

execFileSync(exe('zipalign'), ['-f', '-p', '4', input, aligned], { stdio: 'inherit' });
execFileSync(
  exe('apksigner'),
  [
    'sign',
    '--ks', path.join(keysDir, props.storeFile),
    '--ks-key-alias', props.keyAlias,
    '--ks-pass', 'env:BL_STORE_PASS',
    '--key-pass', 'env:BL_KEY_PASS',
    '--out', output,
    aligned,
  ],
  { stdio: 'inherit', env: { ...process.env, BL_STORE_PASS: props.storePassword, BL_KEY_PASS: props.keyPassword }, shell: process.platform === 'win32' },
);
fs.rmSync(aligned);
execFileSync(exe('apksigner'), ['verify', '--print-certs', output], { stdio: 'inherit', shell: process.platform === 'win32' });
console.log(`APK firmato: ${path.relative(root, output)} (${(fs.statSync(output).size / 1e6).toFixed(1)} MB)`);
