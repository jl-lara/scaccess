const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

// Resuelve el monorepo para que Metro pueda empaquetar `@scaccess/shared`
// sin observar junctions circulares (`node_modules/@scaccess/mobile`) ni `.expo/`.
const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/shared'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : []

config.resolver.blockList = [
  ...defaultBlockList,
  /[\\/]node_modules[\\/]@scaccess[\\/](?:mobile|admin|api)(?:[\\/]|$)/,
  /[\\/]\.expo[\\/]/,
]

// En Expo SDK 53+, `unstable_enablePackageExports` viene activo por defecto y
// hace que paquetes como `ws` (importado por `@supabase/realtime-js`) ignoren
// el campo `"browser": "browser.js"` a favor de `exports["."].require` (`index.js`),
// intentando cargar módulos nativos de Node (`stream`, `http`, `net`) en Hermes.
// Priorizar la condición `"browser"` asegura que Metro use los entrypoints web/RN.
config.resolver.unstable_conditionNames = [
  'react-native',
  'browser',
  'require',
  'import',
]

module.exports = config
