// Config plugin: configurazione di rete Android (network_security_config) diversa per release e debug.
// - release (src/main): solo certificati di sistema e niente traffico in chiaro, come il default di Android.
// - debug (src/debug, sostituisce la risorsa di main nelle build di debug): anche traffico in chiaro (Metro su
//   http://localhost:8081) e certificati installati dall'utente, così la dev build si collega a un blynk-server
//   locale con un certificato firmato da una CA di prova installata sul dispositivo (Impostazioni → Sicurezza →
//   Installa un certificato → Certificato CA).
// Con una network_security_config Android ignora android:usesCleartextTraffic, per questo il chiaro va qui.
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
