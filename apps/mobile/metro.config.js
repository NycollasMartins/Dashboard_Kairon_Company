// Metro configurado para monorepo (npm workspaces).
// Faz o Metro observar a raiz do monorepo e resolver tanto o node_modules do app
// quanto o da raiz, para que `@kairon/core` (workspace) e suas deps sejam encontrados.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Observa a raiz do monorepo (para mudancas em packages/core).
config.watchFolders = [monorepoRoot];

// 2. Resolve modulos primeiro do app, depois da raiz (mantem 1 copia de React/RN).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Habilita o campo "exports" do package.json (necessario para o subpath
//    wildcard `./api/*` exportado por @kairon/core).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
