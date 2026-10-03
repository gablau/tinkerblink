// Config plugin: sposta la cartella dei file intermedi C++ (CMake/ninja) dell'app Android in <disco>:\bl-cxx.
// Su Windows la build di release supera il limite di 260 caratteri dei percorsi: i file oggetto di
// react-native-gesture-handler hanno nomi lunghissimi, e la cartella predefinita
// (app/android/app/.cxx/RelWithDebInfo/<hash>/arm64-v8a) li allunga ancora. Con la cartella corta si
// recuperano circa 40 caratteri. Su macOS/Linux non serve, quindi il percorso cambia solo su Windows.
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
