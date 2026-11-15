// Config plugin: Android network configuration (network_security_config), different for release and debug.
// - release (src/main): system certificates plus the Let's Encrypt roots below, no cleartext traffic.
// - debug (src/debug, replaces the main resource in debug builds): also cleartext traffic (Metro on
//   http://localhost:8081) and user-installed certificates, so the dev build can reach a local blynk-server
//   with a certificate signed by a test CA installed on the device (Settings → Security →
//   Install a certificate → CA certificate).
// With a network_security_config Android ignores android:usesCleartextTraffic, so cleartext is enabled here.
//
// Let's Encrypt roots (plugins/certs, copied to res/raw): Android 7.0 does not have ISRG Root X1 (added in
// 7.1.1), and since Let's Encrypt dropped the chain cross-signed by DST Root CA X3, servers with a Let's Encrypt
// certificate fail there with a generic WebSocket error. X2 is the ECDSA root; Root YR / Root YE are the
// newer roots, today sent cross-signed by X1 / X2, for when servers send them alone. They are public roots,
// already trusted by recent Android versions: trusting them in the app does not widen what is accepted there.
// Source: https://letsencrypt.org/certificates/ (X1 and X2 match the Android 14 system store).
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const ROOTS = ['isrg_root_x1', 'isrg_root_x2', 'isrg_root_yr', 'isrg_root_ye'];
const ANCHORS = ['<certificates src="system" />', ...ROOTS.map((r) => `<certificates src="@raw/${r}" />`)];

const networkConfig = (cleartext, extraAnchors = []) => `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="${cleartext}">
        <trust-anchors>
${[...ANCHORS, ...extraAnchors].map((a) => `            ${a}`).join('\n')}
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const RELEASE = networkConfig(false);
const DEBUG = networkConfig(true, ['<certificates src="user" />']);

function writeXml(projectRoot, sourceSet, contents) {
  const dir = path.join(projectRoot, 'android', 'app', 'src', sourceSet, 'res', 'xml');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'network_security_config.xml'), contents);
}

function copyRoots(projectRoot) {
  const dir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');
  fs.mkdirSync(dir, { recursive: true });
  for (const r of ROOTS) fs.copyFileSync(path.join(__dirname, 'certs', `${r}.pem`), path.join(dir, `${r}.pem`));
}

module.exports = function withNetworkSecurityConfig(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      copyRoots(cfg.modRequest.projectRoot);
      writeXml(cfg.modRequest.projectRoot, 'main', RELEASE);
      writeXml(cfg.modRequest.projectRoot, 'debug', DEBUG);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
};
