// Config plugin: removes the location foreground service that expo-location declares in its own manifest
// (LocationTaskService, foregroundServiceType="location"). The app reads the location only while it is open
// (src/sensors/gps.ts) and never starts that service; Google Play asks for a justification of every declared
// foreground service type, so it must not be in the merged manifest.
const { withAndroidManifest } = require('expo/config-plugins');

const SERVICE = 'expo.modules.location.services.LocationTaskService';

module.exports = function withoutLocationService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
    const app = manifest.application?.[0];
    if (!app) return cfg;
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE);
    app.service.push({ $: { 'android:name': SERVICE, 'tools:node': 'remove' } });
    return cfg;
  });
};
