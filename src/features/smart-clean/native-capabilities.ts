import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Runtime capability probes for native modules that are present in node_modules
 * (so Metro bundles them) but whose NATIVE side only exists after a gradle
 * rebuild of the dev client. On the current APK these probes return false and
 * the dependent detectors degrade to "not_available" — the app never crashes.
 *
 * CRITICAL: we probe via expo-modules-core's `requireOptionalNativeModule`,
 * which returns null (never throws) when a native module is absent. We must NOT
 * `import("expo-image-manipulator")` / `import("expo-file-system")` to probe —
 * evaluating those wrappers runs their top-level `requireNativeModule(...)`,
 * which throws "Cannot find native module" and Metro surfaces that as an
 * uncaught error (a dev red box, a crash in release) even when the import
 * promise is caught. The detector modules only import those wrappers AFTER the
 * matching probe returns true, so on the current APK they are never evaluated.
 */
export type NativeCapability = "fileHashing" | "imageManipulator" | "videoThumbnail";

const NATIVE_MODULE_NAMES: Record<NativeCapability, string[]> = {
  // expo-file-system/legacy getInfoAsync({md5}) is backed by ExponentFileSystem;
  // the new API uses ExpoFileSystem. Either present ⇒ hashing is available.
  fileHashing: ["ExponentFileSystem", "ExpoFileSystem"],
  imageManipulator: ["ExpoImageManipulator"],
  // react-native-compressor (createVideoThumbnail) is a statically-linked
  // dependency already loaded at startup via compression-service, so the
  // real gate for duplicate-videos is imageManipulator (used to hash the frame).
  videoThumbnail: []
};

const cache = new Map<NativeCapability, boolean>();

export function probeCapability(cap: NativeCapability): boolean {
  const cached = cache.get(cap);
  if (cached !== undefined) return cached;
  const available = runProbe(cap);
  cache.set(cap, available);
  return available;
}

/** For tests / after a native rebuild within a session. */
export function resetCapabilityCache() {
  cache.clear();
}

function runProbe(cap: NativeCapability): boolean {
  const names = NATIVE_MODULE_NAMES[cap];
  if (cap === "videoThumbnail") return true; // react-native-compressor is always linked here
  try {
    return names.some((name) => requireOptionalNativeModule(name) != null);
  } catch {
    return false;
  }
}
