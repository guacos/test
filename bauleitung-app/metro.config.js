// Metro-Konfiguration (Bündelung für Android und Web)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdf-lib nutzt "tslib". Dessen Standard-Einstieg für ES-Module funktioniert mit Metro nicht
// (Laufzeitfehler "Cannot destructure property '__extends'"). Deshalb fest auf die ES6-Datei zeigen.
const standard = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const ziel = moduleName === 'tslib' ? 'tslib/tslib.es6.js' : moduleName;
  return standard ? standard(context, ziel, platform) : context.resolveRequest(context, ziel, platform);
};

module.exports = config;
