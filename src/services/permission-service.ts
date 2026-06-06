import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library";
import { PermissionResult } from "@/models/photo";

export const PermissionService = {
  async getMediaPermission(): Promise<PermissionResult> {
    try {
      const permission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
      return mapMediaPermission(permission);
    } catch (error) {
      return { status: "error", message: getErrorMessage(error) };
    }
  },

  async requestMediaPermission(): Promise<PermissionResult> {
    try {
      const currentPermission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
      const current = mapMediaPermission(currentPermission);
      if (current.status === "granted" || current.status === "limited") {
        return current;
      }
      if (current.status === "denied" && current.canAskAgain === false) {
        await this.openSettings();
        return {
          ...current,
          message: "Photo access was denied. Enable Photos and Videos from Android settings."
        };
      }

      const permission = await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
      const result = mapMediaPermission(permission);
      if (result.status === "denied" && result.canAskAgain === false) {
        return {
          ...result,
          message: "Photo access was denied. Enable Photos and Videos from Android settings."
        };
      }
      return result;
    } catch (error) {
      return { status: "error", message: getErrorMessage(error) };
    }
  },

  async openSettings() {
    await Linking.openSettings();
  }
};

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
