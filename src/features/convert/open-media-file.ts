import { requireOptionalNativeModule } from "expo-modules-core";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/**
 * Opens a converted file in an external OS app.
 *
 * The converter's audio output (M4A/WAV) is not a gallery asset type, so instead
 * of a Share sheet the user asked to hand the file to the operating system's
 * audio player. On Android that is the "Open with…" chooser (ACTION_VIEW); iOS
 * has no such system chooser, so there we fall back to the share sheet (whose
 * "Open in…" entries are the platform equivalent).
 *
 * CRITICAL (same lesson as app-lock-service / native-capabilities): never
 * top-level-import `expo-intent-launcher` to probe — evaluating its wrapper runs
 * `requireNativeModule("ExpoIntentLauncher")`, which throws (red box / release
 * crash) when the native side isn't compiled into the current build yet. Probe by
 * native-module NAME via `requireOptionalNativeModule` (returns null, never
 * throws) and only `import()` the wrapper after the probe passes. Until a native
 * rebuild ships the module, this transparently falls back to the share sheet.
 */

const FLAG_GRANT_READ_URI_PERMISSION = 1;

let intentLauncherAvailable: boolean | undefined;

function isIntentLauncherAvailable(): boolean {
  if (intentLauncherAvailable === undefined) {
    try {
      intentLauncherAvailable = requireOptionalNativeModule("ExpoIntentLauncher") != null;
    } catch {
      intentLauncherAvailable = false;
    }
  }
  return intentLauncherAvailable;
}

async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType, dialogTitle });
    return true;
  } catch {
    // User dismissed the sheet or it failed — nothing to recover.
    return false;
  }
}

async function toContentUri(uri: string): Promise<string> {
  // A content:// uri (e.g. a MediaStore asset) is already openable as-is. A file://
  // uri must be wrapped in Expo's FileProvider — ACTION_VIEW on a raw file:// throws
  // FileUriExposedException on Android 7+.
  if (uri.startsWith("content://")) return uri;
  const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
  return FS.getContentUriAsync(uri);
}

/**
 * Open `uri` in an external audio/media player. On Android launches the system
 * "Open with…" chooser; on iOS (or when the intent module/handler is unavailable)
 * falls back to the share sheet so the user can still hand the file to an app.
 */
export async function openMediaExternally(uri: string, mimeType: string, dialogTitle: string): Promise<boolean> {
  if (Platform.OS === "android" && isIntentLauncherAvailable()) {
    try {
      const IntentLauncher = await import("expo-intent-launcher");
      const contentUri = await toContentUri(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: mimeType,
        flags: FLAG_GRANT_READ_URI_PERMISSION
      });
      return true;
    } catch {
      // No app could open it, the FileProvider rejected the path, or the user
      // dismissed the chooser — fall back to sharing rather than failing silently.
      return shareFile(uri, mimeType, dialogTitle);
    }
  }
  return shareFile(uri, mimeType, dialogTitle);
}
