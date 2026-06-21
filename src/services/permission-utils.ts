import { PermissionResult } from "@/models/photo";

export type AndroidVisualMediaGrants = {
  images: boolean;
  videos: boolean;
  selected: boolean;
};

/**
 * Resolves Android 14+ media scope from the platform grants themselves.
 * This is a fallback for installed native builds that return a stale or missing
 * `accessPrivileges` value from expo-media-library.
 */
export function resolveAndroidVisualMediaPermission(
  reported: PermissionResult,
  grants: AndroidVisualMediaGrants
): PermissionResult {
  if (reported.status === "error") return reported;
  if (grants.images && grants.videos) {
    return { ...reported, status: "granted" };
  }
  if (grants.selected || grants.images || grants.videos) {
    return { ...reported, status: "limited" };
  }
  // No readable visual-media grant remains. Never trust a stale native
  // `granted` response here because it would expose the old persisted index.
  return { ...reported, status: reported.status === "not-requested" ? "not-requested" : "denied" };
}
