// Builds the signed release into dist/<version>/ (not versioned; the folders of earlier releases stay).
//
//   npm run build:apk   one APK per ABI (arm64-v8a, armeabi-v7a, x86_64) + universal, and SHA256SUMS.txt: for GitHub
//   npm run build:aab   tinkerblink-<version>.aab, signed with the upload key: for Google Play
//   add -- --prebuild   regenerates app/android first (e.g. after changing app.json or a config plugin)
//
// Steps: checks the signing key in keys/, runs `expo prebuild` if app/android is missing or predates the
// withAbiSplits plugin, then runs Gradle. The APKs are signed afterwards by sign-release.js (zipalign + apksigner);
// the AAB is signed by Gradle itself through the android.injected.signing.* properties (as Android Studio does),
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

function prebuildIfNeeded() {
  const gradleFile = path.join(androidDir, 'app', 'build.gradle');
  const gradle = fs.existsSync(gradleFile) ? fs.readFileSync(gradleFile, 'utf8') : '';
  const propsFile = path.join(androidDir, 'gradle.properties');
  const props = fs.existsSync(propsFile) ? fs.readFileSync(propsFile, 'utf8') : '';
  const { version, versionCode } = appVersions();
  // Plugins and versions changed in app.json reach android/ only with prebuild.
  const stale =
    !gradle.includes('tinkerblinkAbiSplits') ||
    !/^org\.gradle\.caching=true$/m.test(props) ||
    gradle.match(/versionCode\s+(\d+)/)?.[1] !== String(versionCode) ||
    gradle.match(/versionName\s+"([^"]*)"/)?.[1] !== version;
  if (process.argv.includes('--prebuild') || stale) {
    // Inside app/: from the root prebuild creates a wrong android/ and app.json.
    run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], appDir);
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
