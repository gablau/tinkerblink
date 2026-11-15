// Config plugin: faster Gradle builds (gradle.properties of the generated android/).
// - more memory than the 2 GB of the template: the release build (Kotlin, Hermes, minification) spends less time in GC;
// - build cache: the outputs of Java/Kotlin/resource tasks are reused after a prebuild and between the APK and
//   AAB builds of scripts/build-release.js. The C++ objects are reused anyway through the CMake folder.
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  'kotlin.daemon.jvmargs': '-Xmx2g',
  'org.gradle.caching': 'true',
};

module.exports = function withGradleTuning(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const item = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (item) item.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
