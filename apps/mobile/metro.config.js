// Expo resolves modules differently inside a monorepo. Without this, Metro
// cannot see the shared @correnthian/* packages.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// The lockfile lives at the workspace root, not in the app.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
