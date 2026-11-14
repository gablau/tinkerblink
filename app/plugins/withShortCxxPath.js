// Config plugin: moves the folder of the intermediate C++ files (CMake/ninja) of the Android app to <drive>:\bl-cxx.
// On Windows the release build exceeds the 260-character path limit: the object files of
// react-native-gesture-handler have very long names, and the default folder
// (app/android/app/.cxx/RelWithDebInfo/<hash>/arm64-v8a) makes them even longer. The short folder saves
// about 40 characters. macOS/Linux do not need it, so the path changes only on Windows.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// blynk: short cxx path';
const BLOCK = `
${MARKER}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    android {
        externalNativeBuild {
            cmake {
                buildStagingDirectory = new File(rootDir.toPath().getRoot().toFile(), 'bl-cxx')
            }
        }
    }
}
`;

module.exports = function withShortCxxPath(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += BLOCK;
    return cfg;
  });
};
