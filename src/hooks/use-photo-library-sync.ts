import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useSmartCleanFeatureCache } from "@/features/smart-clean/feature-cache-store";
import { useSmartCleanReviewStore } from "@/features/smart-clean/smart-clean-review-store";
import { useSmartCleanStore } from "@/features/smart-clean/smart-clean-store";
import { PermissionStatus } from "@/models/photo";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";
import { useMediaIndexStore } from "@/store/media-index-store";
import { useSubscriptionStore } from "@/store/subscription-store";

const POLL_INTERVAL_MS = 45_000;

// Permission, AppState, and media-library events often arrive together. Never
// drop a later event while a reconcile is running: queue one more pass so a
// permission value that settles just after the first read is still observed.
let refreshRunning = false;
let refreshQueued = false;
let forceSmartCleanRescanQueued = false;
let lastReconciledPermission: PermissionStatus | undefined;

function hasSmartCleanHistory() {
  const state = useSmartCleanStore.getState();
  return state.lastRunAt !== undefined || state.phase !== "idle" || state.restoredCompact !== null || Object.keys(state.resultsByKey).length > 0;
}

function invalidateSmartCleanMediaSnapshot() {
  // Review groups are snapshots and may contain assets the OS just revoked.
  // Close the review/preview first, then remove all old detector results.
  useSmartCleanReviewStore.getState().close();
  useSmartCleanStore.getState().reset();
}

async function reconcilePhotoLibraryAccess(forceSmartCleanRescan: boolean) {
  const previousPermission = lastReconciledPermission ?? useAppStore.getState().permission.status;
  const previousIndex = useMediaIndexStore.getState();
  const previousOrderedIds = previousIndex.orderedIds;
  const previousAccessLevel = previousIndex.accessLevel;
  const hadSmartCleanHistory = hasSmartCleanHistory();

  // Read the live OS grant before rebuilding the index. On a full → limited
  // downgrade this lets us remove stale Smart Clean review data immediately,
  // rather than leaving it actionable until the limited scan finishes.
  const livePermission = await PermissionService.getMediaPermission();
  const permissionChangedBeforeRefresh =
    livePermission.status !== "error" && previousPermission !== livePermission.status;
  const liveCanRead = livePermission.status === "granted" || livePermission.status === "limited";
  const liveAccessLevel = livePermission.status === "limited" ? "limited" : "full";
  const accessMismatchBeforeRefresh =
    liveCanRead && previousAccessLevel !== undefined && previousAccessLevel !== liveAccessLevel;
  let invalidated = false;
  if (permissionChangedBeforeRefresh || accessMismatchBeforeRefresh || forceSmartCleanRescan) {
    invalidateSmartCleanMediaSnapshot();
    invalidated = true;
  }

  await useAppStore.getState().refreshPhotos();

  const nextPermission = useAppStore.getState().permission.status;
  lastReconciledPermission = nextPermission;
  const nextIndex = useMediaIndexStore.getState();
  const canRead = nextPermission === "granted" || nextPermission === "limited";
  const permissionChanged = previousPermission !== nextPermission;
  const accessLevelChanged =
    canRead && previousAccessLevel !== (nextPermission === "limited" ? "limited" : "full");
  // Limited access can keep the same permission status while the user swaps
  // selected assets. Identity changes only when the reconciled set changes.
  const limitedSelectionChanged = nextPermission === "limited" && previousOrderedIds !== nextIndex.orderedIds;
  const mediaScopeChanged = forceSmartCleanRescan || permissionChanged || accessLevelChanged || limitedSelectionChanged;

  if (!canRead) {
    if (!invalidated && (mediaScopeChanged || hadSmartCleanHistory)) invalidateSmartCleanMediaSnapshot();
    return;
  }

  if (!mediaScopeChanged) return;

  // A scope change invalidates every old group even if no automatic rescan can
  // run (for example, a subscription expired). Never retain inaccessible items.
  if (!invalidated) invalidateSmartCleanMediaSnapshot();
  if (!hadSmartCleanHistory || useSubscriptionStore.getState().subscriptionStatus !== "active") return;

  if (nextPermission === "granted") {
    // Full access needs the complete index, not only refreshPhotos' newest page.
    await useMediaIndexStore.getState().startFullScan({
      force: true,
      restart: true,
      ignoredSourceIds: useAppStore.getState().compressedMedia.map((item) => item.sourceId)
    });
  }

  const reconciledIndex = useMediaIndexStore.getState();
  const expectedAccess = nextPermission === "limited" ? "limited" : "full";
  if (reconciledIndex.status !== "complete" || reconciledIndex.accessLevel !== expectedAccess) return;

  const allowedIds = new Set(reconciledIndex.orderedIds);
  useSmartCleanFeatureCache.getState().pruneMissing(allowedIds);
  void useSmartCleanStore.getState().runScan({ resume: false });
}

/**
 * Public entry point used by both the root lifecycle listeners and Settings'
 * selected-media picker. Concurrent calls coalesce, then perform one trailing
 * pass so no permission transition is lost.
 */
export async function refreshPhotoLibraryAccess(options: { forceSmartCleanRescan?: boolean } = {}) {
  if (options.forceSmartCleanRescan) forceSmartCleanRescanQueued = true;
  if (refreshRunning) {
    refreshQueued = true;
    return;
  }
  refreshRunning = true;
  try {
    do {
      refreshQueued = false;
      const forceSmartCleanRescan = forceSmartCleanRescanQueued;
      forceSmartCleanRescanQueued = false;
      await reconcilePhotoLibraryAccess(forceSmartCleanRescan);
    } while (refreshQueued);
  } finally {
    refreshRunning = false;
  }
}

export function usePhotoLibrarySync() {
  const status = useAppStore((state) => state.permission.status);
  const refresh = useCallback(() => refreshPhotoLibraryAccess(), []);

  // Always-on foreground reload — attached even while access is denied. This is
  // what makes "grant in system Settings → return to the app → instant load"
  // work from any screen, and it re-reads the accessible set after the user
  // edits their "selected photos" (Android delivers no selection-change event,
  // so this foreground pass is what reconciles the limited set there).
  // refreshPhotos re-checks the live permission and either loads (granted /
  // limited) or refreshes the gate (denied); it never re-prompts.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // Library-change events and the periodic poll both need read access, so wire
  // them only when the app can actually read media. When refreshPhotos flips the
  // permission status, this effect re-runs and attaches/detaches accordingly.
  useEffect(() => {
    if (status !== "granted" && status !== "limited") {
      return undefined;
    }

    const mediaSubscription = MediaLibrary.addListener(() => {
      void refresh();
    });
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mediaSubscription.remove();
      clearInterval(interval);
    };
  }, [status, refresh]);
}
