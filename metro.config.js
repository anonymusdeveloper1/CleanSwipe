const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// --- Expo Go demo mode --------------------------------------------------------
// `react-native-compressor` and `react-native-background-actions` are third-party
// NATIVE modules that are NOT present in the Expo Go runtime, so importing them
// there crashes the app on launch. When EXPO_PUBLIC_EXPO_GO_DEMO=1 (set only by
// the `npm run start:demo` tunnel for showing the app in Expo Go) we alias those
// two packages to JS stubs that degrade gracefully, so the core UI runs in Expo
// Go. Every other path — normal dev, `expo run`, and all EAS/gradle native builds
// — does NOT set the flag and therefore uses the real native modules unchanged.
if (process.env.EXPO_PUBLIC_EXPO_GO_DEMO === "1") {
  const stubs = {
    "react-native-compressor": path.resolve(__dirname, "demo/stubs/react-native-compressor.js"),
    "react-native-background-actions": path.resolve(__dirname, "demo/stubs/react-native-background-actions.js")
  };

  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const stub = stubs[moduleName];
    if (stub) {
      return { type: "sourceFile", filePath: stub };
    }
    return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
