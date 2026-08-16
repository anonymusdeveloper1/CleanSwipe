import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { createSmartCleanRescanIntent, orderedMediaIdsChanged } from "@/features/smart-clean/permission-reconcile";
import { useSmartCleanReviewStore } from "@/features/smart-clean/smart-clean-review-store";
import { useSmartCleanStore } from "@/features/smart-clean/smart-clean-store";
import { PermissionStatus } from "@/models/photo";
import { PermissionService } from "@/services/permission-service";
import { PhotoLibraryService } from "@/services/photo-library-service";
import { useAppStore } from "@/store/app-store";
import { useMediaIndexStore } from "@/store/media-index-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { librarySignatureChanged, LibrarySignature } from "@/utils/library-signature";

/**
 * How often the CHEAP library-change probe runs while the app is foregrounded.
 * One `getAssetsAsync({ first: 1 })` per tick — no per-asset info calls — so a
 * few seconds is affordable and makes newly downloaded/captured media appear
 * about as fast as the system gallery shows it.
 */
const CHANGE_PROBE_INTERVAL_MS = 3_000;

/**
 * Safety-net FULL reconcile. The probe catches asset changes; this still runs
 * periodically to catch things the probe cannot see (permission/scope drift).
 */
const POLL_INTERVAL_MS = 45_000;

// Last observed library fingerprint. Module-level so it survives the effect
// re-attaching (permission status changes) without re-triggering a refresh.
let lastLibrarySignature: LibrarySignature | undefined;

/** Drop the cached fingerprint so the next probe re-seeds instead of comparing
 *  against a library state from a different permission scope. */
function resetLibrarySignature() {
  lastLibrarySignature = undefined;
}

// Permission, AppState, and media-library events often arrive together. Never
// drop a later event while a reconcile is running: queue one more pass so a
// permission value that settles just after the first read is still observed.
let refreshRunning = false;
let refreshQueued = false;
let forceSmartCleanRescanQueued = false;
let reconcileExternalDeletionsQueued = false;
let lastReconciledPermission: PermissionStatus | undefined;
const smartCleanRescanIntent = createSmartCleanRescanIntent();

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

async function reconcilePhotoLibraryAccess(forceSmartCleanRescan: boolean, reconcileExternalDeletions: boolean) {
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
    smartCleanRescanIntent.request(hadSmartCleanHistory);
    invalidateSmartCleanMediaSnapshot();
    invalidated = true;
  }

  await useAppStore.getState().refreshPhotos();

  // The normal newest-page refresh is intentionally merge-only. Follow it with
  // a stable, ID-only full-library snapshot when an OS/library signal requests
  // deletion reconciliation, then remove only IDs proven absent from the device.
  const externallyDeletedIds = reconcileExternalDeletions
    ? await useAppStore.getState().reconcileExternalLibraryDeletions()
    : [];
  const externalLibraryDeletion = externallyDeletedIds.length > 0;

  const nextPermission = useAppStore.getState().permission.status;
  lastReconciledPermission = nextPermission;
  const nextIndex = useMediaIndexStore.getState();
  const canRead = nextPermission === "granted" || nextPermission === "limited";
  const permissionChanged = previousPermission !== nextPermission;
  const accessLevelChanged =
    canRead && previousAccessLevel !== (nextPermission === "limited" ? "limited" : "full");
  // Limited access can keep the same permission status while the user swaps
  // selected assets, including a same-count replacement. Compare the exact
  // reconciled IDs rather than relying on store reference identity.
  const limitedSelectionChanged =
    nextPermission === "limited" && orderedMediaIdsChanged(previousOrderedIds, nextIndex.orderedIds);
  const mediaScopeChanged =
    forceSmartCleanRescan ||
    externalLibraryDeletion ||
    permissionChanged ||
    accessLevelChanged ||
    limitedSelectionChanged;

  if (!canRead) {
    if (!invalidated && (mediaScopeChanged || hadSmartCleanHistory)) {
      smartCleanRescanIntent.request(hadSmartCleanHistory);
      invalidateSmartCleanMediaSnapshot();
    }
    return;
  }

  // A scope change invalidates every old group even if no automatic rescan can
  // run (for example, a subscription expired). Never retain inaccessible items.
  if (mediaScopeChanged && !invalidated) {
    smartCleanRescanIntent.request(hadSmartCleanHistory);
    invalidateSmartCleanMediaSnapshot();
  }

  // A prior queued pass may have cleared the stale results before its media
  // index was ready. Finish that pass's pending rescan instead of requiring this
  // invocation to rediscover the already-applied permission transition.
  if (!smartCleanRescanIntent.isPending()) return;
  if (useSubscriptionStore.getState().subscriptionStatus !== "active") {
    smartCleanRescanIntent.clear();
    return;
  }

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

  // Permission-scoped disappearance is not deletion. Keep hashes for hidden
  // assets so restoring full access reuses unchanged features. The cache is
  // already FIFO-bounded; confirmed deletion paths still prune real removals.
  smartCleanRescanIntent.clear();
  void useSmartCleanStore.getState().runScan({ resume: false });
}

/**
 * Public entry point used by both the root lifecycle listeners and Settings'
 * selected-media picker. Concurrent calls coalesce, then perform one trailing
 * pass so no permission transition is lost.
 */
export async function refreshPhotoLibraryAccess(
  options: { forceSmartCleanRescan?: boolean; reconcileExternalDeletions?: boolean } = {}
) {
  if (options.forceSmartCleanRescan) forceSmartCleanRescanQueued = true;
  if (options.reconcileExternalDeletions) reconcileExternalDeletionsQueued = true;
  if (refreshRunning) {
    refreshQueued = true;
    return;
  }
  refreshRunning = true;
  try {
    do {
      refreshQueued = false;
      const forceSmartCleanRescan = forceSmartCleanRescanQueued;
      const reconcileExternalDeletions = reconcileExternalDeletionsQueued;
      forceSmartCleanRescanQueued = false;
      reconcileExternalDeletionsQueued = false;
      await reconcilePhotoLibraryAccess(forceSmartCleanRescan, reconcileExternalDeletions);
    } while (refreshQueued);
  } finally {
    refreshRunning = false;
  }
}

export function usePhotoLibrarySync() {
  const status = useAppStore((state) => state.permission.status);
  const appHydrated = useAppStore((state) => state.hasHydrated);
  const smartCleanHydrated = useSmartCleanStore((state) => state.hasHydrated);
  const subscriptionHydrated = useSubscriptionStore((state) => state.hasHydrated);
  const refresh = useCallback(
    () => refreshPhotoLibraryAccess({ reconcileExternalDeletions: true }),
    []
  );

  // Reconcile once on every JS/app launch after persisted state is ready.
  // AppState does not emit an active transition after Fast Refresh/reload, so
  // without this a stale full-access index can remain visible until the poll.
  useEffect(() => {
    if (appHydrated && smartCleanHydrated && subscriptionHydrated) void refresh();
  }, [appHydrated, refresh, smartCleanHydrated, subscriptionHydrated]);

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
      // Scope no longer readable — the cached fingerprint describes a library we
      // can't see any more, so don't compare against it when access returns.
      resetLibrarySignature();
      return undefined;
    }

    // Kept even though it is unreliable on Android (the native observer only
    // emits when a media type's TOTAL COUNT changes): when it does fire it is
    // the fastest possible signal, and it costs nothing to listen.
    const mediaSubscription = MediaLibrary.addListener(() => {
      void refresh();
    });

    // Cheap change detection. Runs often; escalates to the expensive reconcile
    // ONLY when the library actually changed. This is what makes a newly
    // downloaded photo/video appear promptly instead of waiting for the 45 s
    // full poll — and it behaves identically on Android and iOS.
    let probing = false;
    const probe = async () => {
      // Never probe in the background: nothing is visible, and the AppState
      // "active" listener already forces a full refresh on return.
      if (probing || AppState.currentState !== "active") return;
      probing = true;
      try {
        const signature = await PhotoLibraryService.getLibrarySignature();
        if (!signature) return;
        const changed = librarySignatureChanged(lastLibrarySignature, signature);
        lastLibrarySignature = signature;
        if (changed) await refreshPhotoLibraryAccess({ reconcileExternalDeletions: true });
      } finally {
        probing = false;
      }
    };

    const probeInterval = setInterval(() => {
      void probe();
    }, CHANGE_PROBE_INTERVAL_MS);
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mediaSubscription.remove();
      clearInterval(probeInterval);
      clearInterval(interval);
    };
  }, [status, refresh]);
}
