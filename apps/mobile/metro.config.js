const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

// Resuelve el monorepo para que Metro pueda empaquetar `@scaccess/shared`
// (symlink de npm workspaces) y otros paquetes de la raiz.
const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = config
