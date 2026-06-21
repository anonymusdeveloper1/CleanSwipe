import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library";
import { PermissionsAndroid, Platform } from "react-native";
import { PermissionResult } from "@/models/photo";
import { resolveAndroidVisualMediaPermission } from "@/services/permission-utils";

export const PermissionService = {
  async getMediaPermission(): Promise<PermissionResult> {
    try {
      const permission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
      return refineAndroidVisualMediaPermission(mapMediaPermission(permission));
    } catch (error) {
      return { status: "error", message: getErrorMessage(error) };
    }
  },

  async requestMediaPermission(): Promise<PermissionResult> {
    try {
      const currentPermission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
      const current = await refineAndroidVisualMediaPermission(mapMediaPermission(currentPermission));
      if (current.status === "granted" || current.status === "limited") {
        return current;
      }

      // Always attempt the in-app OS dialog. When the user has permanently
      // denied (Android `canAskAgain === false` after repeated denials, or iOS
      // after the first denial), this resolves immediately as denied WITHOUT a
      // dialog — no crash. We do NOT navigate to Settings here: a "request"
      // must never have the hidden side effect of leaving the app. The UI
      // decides when to offer Settings, based on `canAskAgain`.
      const permission = await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
      const result = await refineAndroidVisualMediaPermission(mapMediaPermission(permission));
      if (result.status === "denied" && result.canAskAgain === false) {
        return {
          ...result,
          message: "Media access was denied. Enable Photos and Videos from Settings."
        };
      }
      return result;
    } catch (error) {
      return { status: "error", message: getErrorMessage(error) };
    }
  },

  async openSettings() {
    await Linking.openSettings();
  },

  // Lets a "selected photos" (limited) user change which assets the app can
  // read, in-app, without a trip to system Settings. The system modal only
  // shows when access is currently limited (otherwise it's a no-op). Available
  // on iOS and Android 14+; on older OSes the call rejects, so we fall back to
  // Settings. It does NOT report whether the selection changed — callers must
  // refresh the media index afterward.
  async presentLimitedPicker() {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(["photo", "video"]);
    } catch {
      await PermissionService.openSettings();
    }
  }
};

async function refineAndroidVisualMediaPermission(reported: PermissionResult): Promise<PermissionResult> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 34) return reported;
  try {
    const [images, videos, selected] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED)
    ]);
    return resolveAndroidVisualMediaPermission(reported, { images, videos, selected });
  } catch {
    return reported;
  }
}

function mapMediaPermission(permission: MediaLibrary.PermissionResponse): PermissionResult {
  if (permission.granted) {
    const accessPrivileges = "accessPrivileges" in permission ? permission.accessPrivileges : undefined;
    return { status: accessPrivileges === "limited" ? "limited" : "granted", canAskAgain: permission.canAskAgain };
  }
  if (permission.status === "granted") {
    const accessPrivileges = "accessPrivileges" in permission ? permission.accessPrivileges : undefined;
    return { status: accessPrivileges === "limited" ? "limited" : "granted", canAskAgain: permission.canAskAgain };
  }
  if (permission.status === "denied") {
    return { status: "denied", canAskAgain: permission.canAskAgain };
  }
  return { status: "not-requested", canAskAgain: permission.canAskAgain };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Permission could not be checked.";
}
