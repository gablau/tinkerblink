// Builds the signed release into dist/<version>/ (not versioned; the folders of earlier releases stay).
//
//   npm run build:apk   one APK per ABI (arm64-v8a, armeabi-v7a, x86_64) + universal, and SHA256SUMS.txt: for GitHub
//   npm run build:aab   tinkerblink-<version>.aab, signed with the upload key: for Google Play
//   add -- --prebuild   regenerates app/android first even if app.json and the plugins did not change
//
// Steps: checks the signing key in keys/, runs `expo prebuild` if app.json or a config plugin changed since the
// last prebuild of this script, then runs Gradle. The APKs are signed afterwards by sign-release.js
// (zipalign + apksigner); the AAB is signed by Gradle itself through the android.injected.signing.* properties (as Android Studio does),
// given as ORG_GRADLE_PROJECT_* environment variables so that the passwords never appear on a command line.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { exec, loadKeys, signAll, appVersions, releaseDir, apkDir, root } = require('./sign-release');

const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];
const appDir = path.join(root, 'app');
const androidDir = path.join(appDir, 'android');
const win = process.platform === 'win32';
// Absolute path: cmd.exe does not look in the current folder when NoDefaultCurrentDirectoryInExePath is set.
const gradlew = path.join(androidDir, win ? 'gradlew.bat' : 'gradlew');

function run(cmd, args, cwd, env = process.env) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  exec(cmd, args, { cwd, env, stdio: 'inherit' });
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

/**
 * app.json and the config plugins (versions, permissions, ABI splits, certificates…) reach android/ only with
 * prebuild: it runs when one of them is newer than the stamp written after the last prebuild of this script.
 */
function prebuildIfNeeded() {
  const stamp = path.join(androidDir, '.release-prebuild');
  const sources = [path.join(appDir, 'app.json'), ...listFiles(path.join(appDir, 'plugins'))];
  const doneAt = fs.existsSync(stamp) ? fs.statSync(stamp).mtimeMs : 0;
  if (process.argv.includes('--prebuild') || sources.some((f) => fs.statSync(f).mtimeMs > doneAt)) {
    // Inside app/: from the root prebuild creates a wrong android/ and app.json.
    run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], appDir);
    fs.writeFileSync(stamp, `${new Date().toISOString()}\n`);
  }
}

function buildApks(keys) {
  // Leftovers of an earlier build (for example app-release.apk without splits) must not be signed.
  fs.rmSync(apkDir, { recursive: true, force: true });
  run(gradlew, ['assembleRelease', '-PtinkerblinkAbiSplits', `-PreactNativeArchitectures=${ABIS.join(',')}`], androidDir);
  signAll(keys);
}

function buildAab(keys) {
  const bundleDir = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release');
  fs.rmSync(bundleDir, { recursive: true, force: true });
  const p = 'ORG_GRADLE_PROJECT_android.injected.signing.';
  const env = {
    ...process.env,
    [`${p}store.file`]: keys.storeFile,
    [`${p}store.password`]: keys.storePassword,
    [`${p}key.alias`]: keys.keyAlias,
    [`${p}key.password`]: keys.keyPassword,
  };
  run(gradlew, ['bundleRelease', `-PreactNativeArchitectures=${ABIS.join(',')}`], androidDir, env);

  const input = path.join(bundleDir, 'app-release.aab');
  if (!fs.existsSync(input)) throw new Error(`No AAB in ${path.relative(root, bundleDir)}`);
  const { version, versionCode } = appVersions();
  const output = path.join(releaseDir(version), `tinkerblink-${version}.aab`);
  fs.copyFileSync(input, output);

  // The certificate must be the upload key, not the debug key of the Expo template.
  const certs = execFileSync('keytool', ['-printcert', '-jarfile', output], { encoding: 'utf8' });
  if (/CN=Android Debug/i.test(certs)) throw new Error('The AAB is signed with the debug key: the injected signing was ignored');
  const sha256 = certs.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1];
  console.log(`\nSigned AAB: ${path.relative(root, output)} (${(fs.statSync(output).size / 1e6).toFixed(1)} MB)`);
  console.log(`version ${version}, versionCode ${versionCode}, certificate SHA-256 ${sha256 ?? '?'}`);
}

function main() {
  // Before the build, which takes minutes: no key, no release.
  const keys = loadKeys();
  prebuildIfNeeded();
  if (process.argv.includes('--aab')) buildAab(keys);
  else buildApks(keys);
}

try {
  main();
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
