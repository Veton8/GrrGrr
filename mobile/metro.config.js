const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const REANIMATED_SHIM = path.resolve(__dirname, 'src', 'utils', 'reanimated-web-shim.js');

const nativeOnlyModules = [
  'expo-camera',
  'expo-image-picker',
  'react-native-vision-camera',
  '@react-native-ml-kit/face-detection',
  '@shopify/react-native-skia',
  'react-native-worklets',
  'react-native-worklets-core',
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Shim reanimated on all platforms (package uninstalled, provide stub)
  if (moduleName === 'react-native-reanimated' || moduleName.startsWith('react-native-reanimated/')) {
    return { filePath: REANIMATED_SHIM, type: 'sourceFile' };
  }

  if (platform === 'web') {
    for (const mod of nativeOnlyModules) {
      if (moduleName === mod || moduleName.startsWith(mod + '/')) {
        return { type: 'empty' };
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Remove .mjs from source extensions to force CJS builds
// (zustand's .mjs uses import.meta which breaks Metro's hermes transform)
config.resolver.sourceExts = (config.resolver.sourceExts || []).filter(ext => ext !== 'mjs');

module.exports = config;
