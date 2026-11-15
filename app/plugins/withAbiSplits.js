// Config plugin: one APK per ABI plus a universal APK, for the release published on GitHub.
// The splits are on only with -PtinkerblinkAbiSplits (passed by scripts/build-release.js): the development
// build and `npx expo run:android` keep the single APK they expect.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// tinkerblink: abi splits';
const BLOCK = `
${MARKER}
if (project.hasProperty('tinkerblinkAbiSplits')) {
    android {
        splits {
            abi {
                enable true
                reset()
                include 'arm64-v8a', 'armeabi-v7a', 'x86_64'
                universalApk true
            }
        }
    }
}
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += BLOCK;
    return cfg;
  });
};
