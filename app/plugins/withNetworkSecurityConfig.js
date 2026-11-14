// Config plugin: Android network configuration (network_security_config), different for release and debug.
// - release (src/main): system certificates only and no cleartext traffic, like the Android default.
// - debug (src/debug, replaces the main resource in debug builds): also cleartext traffic (Metro on
//   http://localhost:8081) and user-installed certificates, so the dev build can reach a local blynk-server
//   with a certificate signed by a test CA installed on the device (Settings → Security →
//   Install a certificate → CA certificate).
// With a network_security_config Android ignores android:usesCleartextTraffic, so cleartext is enabled here.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const RELEASE = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const DEBUG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

function writeXml(projectRoot, sourceSet, contents) {
  const dir = path.join(projectRoot, 'android', 'app', 'src', sourceSet, 'res', 'xml');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'network_security_config.xml'), contents);
}

module.exports = function withNetworkSecurityConfig(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
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
