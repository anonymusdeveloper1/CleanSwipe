import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AppSettings,
  CompressedMediaItem,
  AppStats,
  DeletedHistoryItem,
  MarkedForDeletionItem,
  MediaTypeFilter,
  PermissionResult,
  PhotoAsset,
  SwipeAction
} from "@/models/photo";
import { recordCleanupEvent } from "@/store/cleanup-events-store";
import { DeletionQueueService } from "@/services/deletion-queue-service";
import { HistoryService } from "@/services/history-service";
import { PermissionService } from "@/services/permission-service";
import { PhotoLibraryService } from "@/services/photo-library-service";
import { defaultSettings } from "@/services/settings-service";
import { emptyStats, StatsService } from "@/services/stats-service";
import { MediaAccessLevel, selectIndexedMediaAssets, useMediaIndexStore } from "@/store/media-index-store";
import { normalizeLanguagePreference } from "@/i18n/languages";
import { filterMarkedItemsByScope, filterPhotosByScope } from "@/utils/months";

type LastSwipe = {
  photo: PhotoAsset;
  action: SwipeAction;
  index: number;
};

type AppStore = {
  photos: PhotoAsset[];
  loadingPhotos: boolean;
  loadingMorePhotos: boolean;
  photosHasNextPage: boolean;
  photosNextCursor?: string;
  requestingPermission: boolean;
  hasHydrated: boolean;
  photoLibrarySyncedAt?: number;
  permission: PermissionResult;
  selectedMonthKey: string;
  selectedMediaType: MediaTypeFilter;
  currentIndex: number;
  reviewedPhotoIds: string[];
  markedForDeletion: MarkedForDeletionItem[];
  compressedMedia: CompressedMediaItem[];
  history: DeletedHistoryItem[];
  stats: AppStats;
  settings: AppSettings;
  lastSwipe?: LastSwipe;
  error?: string;
  setHasHydrated: (hasHydrated: boolean) => void;
  loadInitialData: () => Promise<void>;
  refreshPhotos: () => Promise<void>;
  loadMorePhotos: () => Promise<void>;
  requestPhotoPermission: () => Promise<void>;
  refreshPermissionStatus: () => Promise<void>;
  setSelectedMonth: (key: string) => void;
  setSelectedMediaType: (mediaType: MediaTypeFilter) => void;
  swipeCurrentPhoto: (action: SwipeAction) => void;
  keepPhoto: (photoId: string) => void;
  markPhotoForDeletion: (photo: PhotoAsset) => void;
  undoLastSwipe: () => void;
  restoreMarkedPhoto: (photoId: string) => void;
  permanentlyDeleteMarked: (photoIds?: string[], options?: { emitDeletionEvent?: boolean }) => Promise<{ deletedCount: number; clearedBytes: number }>;
  restartCurrentSelection: () => { ok: boolean; blockedCount?: number };
  restoreHistoryItem: (historyId: string) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  visiblePhotos: () => PhotoAsset[];
  currentPhoto: () => PhotoAsset | undefined;
};

let initialLoadPromise: Promise<void> | undefined;
let refreshPromise: Promise<void> | undefined;
let loadMorePromise: Promise<void> | undefined;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      photos: [],
      loadingPhotos: false,
      loadingMorePhotos: false,
      photosHasNextPage: false,
      photosNextCursor: undefined,
      requestingPermission: false,
      hasHydrated: false,
      permission: { status: "not-requested" },
      selectedMonthKey: "all",
      selectedMediaType: "all",
      currentIndex: 0,
      reviewedPhotoIds: [],
      markedForDeletion: [],
      compressedMedia: [],
      history: [],
      stats: emptyStats,
      settings: defaultSettings,

      setHasHydrated(hasHydrated) {
        set({ hasHydrated });
      },

      async loadInitialData() {
        if (initialLoadPromise) return initialLoadPromise;

        initialLoadPromise = (async () => {
          const mediaIndex = useMediaIndexStore.getState();
          const cachedCount = selectIndexedMediaAssets(mediaIndex).length;

          set({ loadingPhotos: cachedCount === 0, error: undefined });

          let permission = await PermissionService.getMediaPermission();
          // First launch: proactively surface the native Android permission
          // dialog instead of dropping straight to the manual "Allow Access"
          // screen. Only auto-request when the OS says we've never asked, so we
          // never re-pop the dialog after the user has made a choice.
          if (permission.status === "not-requested") {
            set({ requestingPermission: true });
            permission = await PermissionService.requestMediaPermission();
            set({ requestingPermission: false });
          }
          if (!canReadMedia(permission)) {
            set({
              permission,
              photos: [],
              loadingPhotos: false,
              error: permission.message
            });
            return;
          }

          // Only trust the cached index for an instant first paint when it was
          // built under full access and we still hold full access. Otherwise
          // (limited access, or a cache from a previous, broader grant) we must
          // reconcile BEFORE rendering so we never show assets we can't read.
          const liveAccessLevel: MediaAccessLevel = permission.status === "limited" ? "limited" : "full";
          const cacheTrustworthy = cachedCount > 0 && liveAccessLevel === "full" && mediaIndex.accessLevel === "full";
          if (!cacheTrustworthy) {
            set({ loadingPhotos: true });
          }

          const accessLevel = await reconcileMediaIndex(permission);
          set({
            permission,
            photos: [],
            photosNextCursor: undefined,
            photosHasNextPage: useMediaIndexStore.getState().hasNextPage,
            loadingPhotos: false,
            photoLibrarySyncedAt: Date.now(),
            error: undefined
          });
          if (accessLevel === "full") {
            startInitialMediaIndexScan(getCompressedSourceIds());
          }
        })().finally(() => {
          initialLoadPromise = undefined;
        });

        return initialLoadPromise;
      },

      async refreshPhotos() {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
          const state = get();
          const permission = await PermissionService.getMediaPermission();
          if (!canReadMedia(permission)) {
            set({ permission, photos: [], loadingPhotos: false });
            return;
          }

          const currentPhotoId = state.currentPhoto()?.id;
          const accessLevel = await reconcileMediaIndex(permission);
          const indexedPhotos = selectIndexedMediaAssets(useMediaIndexStore.getState());
          const visiblePhotos = getVisiblePhotos(indexedPhotos, state);
          const matchingIndex = currentPhotoId
            ? visiblePhotos.findIndex((photo) => photo.id === currentPhotoId)
            : -1;
          const currentIndex =
            matchingIndex >= 0
              ? matchingIndex
              : Math.min(state.currentIndex, Math.max(visiblePhotos.length - 1, 0));

          set({
            permission,
            photos: [],
            photosNextCursor: undefined,
            photosHasNextPage: useMediaIndexStore.getState().hasNextPage,
            currentIndex,
            // Clear the loader that reconcileMediaIndex raises when pruning a
            // stale index after a downgrade to limited access, so refreshPhotos
            // can never strand the spinner.
            loadingPhotos: false,
            photoLibrarySyncedAt: Date.now(),
            error: undefined
          });
          if (accessLevel === "full") {
            startInitialMediaIndexScan(getCompressedSourceIds());
          }
        })().finally(() => {
          refreshPromise = undefined;
        });

        return refreshPromise;
      },

      async loadMorePhotos() {
        const state = get();
        if (loadMorePromise) return loadMorePromise;
        if (state.loadingPhotos || state.loadingMorePhotos) {
          return;
        }

        loadMorePromise = (async () => {
          set({ loadingMorePhotos: true, error: undefined });
          const permission = await PermissionService.getMediaPermission();
          if (!canReadMedia(permission)) {
            set({
              permission,
              loadingMorePhotos: false,
              photosHasNextPage: false,
              photosNextCursor: undefined,
              error: permission.message
            });
            return;
          }

          await useMediaIndexStore.getState().startFullScan({
            force: true,
            ignoredSourceIds: getCompressedSourceIds()
          });
          set(() => ({
            permission,
            photos: [],
            photosNextCursor: undefined,
            photosHasNextPage: useMediaIndexStore.getState().hasNextPage,
            loadingMorePhotos: false,
            photoLibrarySyncedAt: Date.now(),
            error: undefined
          }));
        })().finally(() => {
          loadMorePromise = undefined;
        });

        return loadMorePromise;
      },

      async requestPhotoPermission() {
        set({ requestingPermission: true, error: undefined });
        const permission = await PermissionService.requestMediaPermission();
        if (!canReadMedia(permission)) {
          set({
            permission,
            photos: [],
            requestingPermission: false,
            loadingPhotos: false,
            error: permission.message
          });
          return;
        }

        const hasCachedPhotos = selectIndexedMediaAssets(useMediaIndexStore.getState()).length > 0;
        set({
          permission,
          requestingPermission: false,
          loadingPhotos: !hasCachedPhotos,
          error: undefined
        });

        const accessLevel = await reconcileMediaIndex(permission);
        set({
          permission,
          photos: [],
          photosNextCursor: undefined,
          photosHasNextPage: useMediaIndexStore.getState().hasNextPage,
          photoLibrarySyncedAt: Date.now(),
          requestingPermission: false,
          loadingPhotos: false,
          error: undefined
        });
        if (accessLevel === "full") {
          startInitialMediaIndexScan(getCompressedSourceIds());
        }
      },

      async refreshPermissionStatus() {
        // Lightweight, read-only check used by surfaces (e.g. Settings) that
        // need the current access level without triggering a full reload or a
        // permission prompt.
        const permission = await PermissionService.getMediaPermission();
        set({ permission });
      },

      setSelectedMonth(key) {
        set({ selectedMonthKey: key, currentIndex: 0 });
      },

      setSelectedMediaType(mediaType) {
        set({ selectedMediaType: mediaType, currentIndex: 0 });
      },

      swipeCurrentPhoto(action) {
        const state = get();
        const photo = state.currentPhoto();
        if (!photo) return;

        const existingMarked = dedupeMarkedItems(state.markedForDeletion);
        const alreadyMarked = existingMarked.some((item) => item.photoId === photo.id);
        const reviewedPhotoIds = withReviewedPhoto(state.reviewedPhotoIds, photo.id);

        if (action === "delete" && alreadyMarked) {
          set({
            reviewedPhotoIds,
            markedForDeletion: existingMarked,
            currentIndex: state.currentIndex
          });
          return;
        }

        const markedForDeletion =
          action === "delete"
            ? [...existingMarked, DeletionQueueService.fromPhoto(photo)]
            : existingMarked;

        set({
          reviewedPhotoIds,
          markedForDeletion,
          stats: StatsService.withSwipe(state.stats, action),
          lastSwipe: { photo, action, index: state.currentIndex },
          currentIndex: state.currentIndex
        });
      },

      keepPhoto(photoId) {
        set((state) => {
          const photo = useMediaIndexStore.getState().assetsById[photoId];
          if (!photo || state.reviewedPhotoIds.includes(photoId)) {
            return {};
          }
          return {
            reviewedPhotoIds: withReviewedPhoto(state.reviewedPhotoIds, photoId),
            stats: StatsService.withSwipe(state.stats, "keep"),
            lastSwipe: { photo, action: "keep", index: state.currentIndex }
          };
        });
      },

      markPhotoForDeletion(photo) {
        set((state) => {
          const markedForDeletion = dedupeMarkedItems(state.markedForDeletion);
          const reviewedPhotoIds = withReviewedPhoto(state.reviewedPhotoIds, photo.id);
          if (markedForDeletion.some((item) => item.photoId === photo.id)) {
            return {
              markedForDeletion,
              reviewedPhotoIds
            };
          }
          return {
            markedForDeletion: [...markedForDeletion, DeletionQueueService.fromPhoto(photo)],
            reviewedPhotoIds,
            stats: StatsService.withSwipe(state.stats, "delete"),
            lastSwipe: { photo, action: "delete", index: state.currentIndex }
          };
        });
      },

      undoLastSwipe() {
        const state = get();
        if (!state.lastSwipe) return;
        const { action, photo, index } = state.lastSwipe;
        set({
          currentIndex: index,
          stats: StatsService.undoSwipe(state.stats, action),
          reviewedPhotoIds: state.reviewedPhotoIds.filter((id) => id !== photo.id),
          markedForDeletion:
            action === "delete"
              ? state.markedForDeletion.filter((item) => item.photoId !== photo.id)
              : state.markedForDeletion,
          lastSwipe: undefined
        });
      },

      restoreMarkedPhoto(photoId) {
        set((state) => ({
          markedForDeletion: state.markedForDeletion.filter((item) => item.photoId !== photoId),
          reviewedPhotoIds: state.reviewedPhotoIds.filter((id) => id !== photoId),
          stats: { ...state.stats, totalRestored: state.stats.totalRestored + 1 }
        }));
      },

      async permanentlyDeleteMarked(photoIds, options) {
        const state = get();
        const ids = photoIds ?? state.markedForDeletion.map((item) => item.photoId);
        const items = state.markedForDeletion.filter((item) => ids.includes(item.photoId));
        const result = await PhotoLibraryService.deletePhotos(ids);
        if (!result.success) {
          set({ error: result.message ?? "Deletion failed. Your marked photos are still safe." });
          throw new Error(result.message ?? "Deletion failed. Your marked photos are still safe.");
        }

        const clearedBytes = items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
        set({
          markedForDeletion: state.markedForDeletion.filter((item) => !ids.includes(item.photoId)),
          reviewedPhotoIds: state.reviewedPhotoIds.filter((id) => !ids.includes(id)),
          history: [...HistoryService.fromMarkedItems(items), ...state.history],
          stats: StatsService.withPermanentDelete(state.stats, items),
          photos: [],
          error: undefined
        });
        useMediaIndexStore.getState().removeMediaIds(ids);
        // Advanced-stats ledger: one batched event per delete op (after success).
        // Callers that record their own deletion event (e.g. Smart Clean, whose
        // ids aren't in markedForDeletion so items/bytes would be 0 here) opt out
        // via emitDeletionEvent:false to avoid a zeroed duplicate entry.
        if (options?.emitDeletionEvent !== false) {
          recordCleanupEvent({ type: "itemDeleted", count: items.length, bytes: clearedBytes });
        }
        return { deletedCount: items.length, clearedBytes };
      },

      restartCurrentSelection() {
        const state = get();
        const indexedPhotos = selectIndexedMediaAssets(useMediaIndexStore.getState());
        const scopedPhotos = filterPhotosByScope(indexedPhotos, state.selectedMonthKey, state.selectedMediaType);
        const scopedMarked = filterMarkedItemsByScope(
          state.markedForDeletion,
          state.selectedMonthKey,
          state.selectedMediaType,
          indexedPhotos
        );

        if (scopedMarked.length > 0) {
          return { ok: false, blockedCount: scopedMarked.length };
        }

        const scopedIds = new Set(scopedPhotos.map((photo) => photo.id));
        set({
          reviewedPhotoIds: state.reviewedPhotoIds.filter((id) => !scopedIds.has(id)),
          currentIndex: 0,
          lastSwipe: undefined
        });
        return { ok: true };
      },

      restoreHistoryItem(historyId) {
        set((state) => ({
          history: state.history.map((item) => (item.id === historyId ? { ...item, restored: true } : item)),
          stats: { ...state.stats, totalRestored: state.stats.totalRestored + 1 }
        }));
      },

      updateSetting(key, value) {
        set((state) => ({ settings: { ...state.settings, [key]: value } }));
      },

      visiblePhotos() {
        return getVisiblePhotos(selectIndexedMediaAssets(useMediaIndexStore.getState()), get());
      },

      currentPhoto() {
        const visiblePhotos = get().visiblePhotos();
        const index = Math.min(get().currentIndex, Math.max(visiblePhotos.length - 1, 0));
        return visiblePhotos[index];
      }
    }),
    {
      name: "swipeclean-free-store",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        // persistedState is undefined on a fresh install (and can be malformed
        // after a failed write). Default it so property reads below never throw
        // during hydration — a throw here leaves `state` undefined in
        // onRehydrateStorage, which would strand the app on the loading screen.
        const persisted = (persistedState ?? {}) as Partial<AppStore>;
        return {
          ...currentState,
          ...persisted,
          photos: [],
          photosHasNextPage: useMediaIndexStore.getState().hasNextPage,
          photosNextCursor: undefined,
          settings: normalizeSettings({
            ...currentState.settings,
            ...(persisted.settings ?? {})
          }),
          // Under "selected photos" access the cached index must be reconciled
          // before it can be trusted, so show the loader on the very first frame
          // (before loadInitialData's effect runs) rather than painting the
          // potentially-stale cache. Full access keeps its instant cache paint.
          loadingPhotos: persisted.permission?.status === "limited",
          loadingMorePhotos: false,
          requestingPermission: false,
          hasHydrated: currentState.hasHydrated,
          selectedMediaType: persisted.selectedMediaType ?? currentState.selectedMediaType,
          reviewedPhotoIds: dedupeIds(persisted.reviewedPhotoIds ?? currentState.reviewedPhotoIds),
          markedForDeletion: dedupeMarkedItems(persisted.markedForDeletion ?? currentState.markedForDeletion)
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Failed to rehydrate SwipeClean store", error);
        }
        // Always clear the hydration gate, even if rehydration failed (state is
        // undefined in that case), so the UI never hangs on the loading screen
        // and can proceed to request media permission.
        (state ?? useAppStore.getState()).setHasHydrated(true);
      },
      partialize: (state) => ({
        permission: canReadMedia(state.permission) ? state.permission : { status: "not-requested" },
        photoLibrarySyncedAt: state.photoLibrarySyncedAt,
        selectedMonthKey: state.selectedMonthKey,
        selectedMediaType: state.selectedMediaType,
        reviewedPhotoIds: dedupeIds(state.reviewedPhotoIds),
        markedForDeletion: dedupeMarkedItems(state.markedForDeletion),
        compressedMedia: state.compressedMedia,
        history: state.history,
        stats: state.stats,
        settings: state.settings
      })
    }
  )
);

function canReadMedia(permission: PermissionResult) {
  return permission.status === "granted" || permission.status === "limited";
}

function getVisiblePhotos(photos: PhotoAsset[], state: Pick<AppStore, "selectedMonthKey" | "selectedMediaType" | "reviewedPhotoIds" | "markedForDeletion">) {
  const reviewedIds = new Set(state.reviewedPhotoIds);
  const markedIds = new Set(state.markedForDeletion.map((item) => item.photoId));
  return filterPhotosByScope(photos, state.selectedMonthKey, state.selectedMediaType).filter((photo) => !reviewedIds.has(photo.id) && !markedIds.has(photo.id));
}

function getCompressedSourceIds() {
  return useAppStore.getState().compressedMedia.map((item) => item.sourceId);
}

function startInitialMediaIndexScan(ignoredSourceIds: string[]) {
  const mediaIndex = useMediaIndexStore.getState();
  if (mediaIndex.status === "scanning") return;
  // startFullScan decides whether a rescan is actually needed (it reconciles on
  // any access-level change and always under limited access, but no-ops a
  // redundant full-access rescan).
  void mediaIndex.startFullScan({ ignoredSourceIds });
}

// Reconciles the media index to the currently-accessible set. Under "selected
// photos" (limited) access the accessible set is small and may differ from a
// previously cached full-access index, so we run a pruning full scan and await
// it before the UI renders. Under full access a quick newest-page refresh is
// enough for first paint (a background full scan follows). Returns the access
// level so callers can decide whether to kick off that background scan.
async function reconcileMediaIndex(permission: PermissionResult): Promise<MediaAccessLevel> {
  const accessLevel: MediaAccessLevel = permission.status === "limited" ? "limited" : "full";
  if (accessLevel === "limited") {
    // If the index was built under a broader/older grant it still lists assets
    // we can no longer read, and pruning only happens when the scan completes.
    // Raise the loader first so NO surface (Swipe, Cleanup, Stats) renders those
    // stale, inaccessible assets mid-prune. (No-op once the index is already
    // reconciled to limited access, so steady-state refreshes don't flicker.)
    const needsPrune = useMediaIndexStore.getState().accessLevel !== "limited";
    if (needsPrune) {
      useAppStore.setState({ loadingPhotos: true });
    }
    const startedAt = Date.now();
    await useMediaIndexStore.getState().startFullScan({ force: true, ignoredSourceIds: getCompressedSourceIds() });
    // Drop queue/badge entries pointing at assets the reconcile just pruned, so
    // the review list and counts never reference media we can no longer access.
    // Only do this when a limited-access scan actually COMPLETED since we began:
    // otherwise (a concurrently reset/superseded or half-built index) the asset
    // map is not authoritative and pruning against it would wrongly drop valid
    // queue entries. A later reconcile owns the prune in that case.
    const mediaIndex = useMediaIndexStore.getState();
    const reconciled = mediaIndex.accessLevel === "limited" && (mediaIndex.lastFullScanCompletedAt ?? 0) >= startedAt;
    if (reconciled) {
      const survivors = mediaIndex.assetsById;
      useAppStore.setState((state) => ({
        markedForDeletion: state.markedForDeletion.filter((item) => Boolean(survivors[item.photoId])),
        reviewedPhotoIds: state.reviewedPhotoIds.filter((id) => Boolean(survivors[id]))
      }));
    }
  } else {
    await useMediaIndexStore.getState().refreshNewestPage();
  }
  return accessLevel;
}

function withReviewedPhoto(ids: string[], photoId: string) {
  return ids.includes(photoId) ? ids : [...ids, photoId];
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}

function dedupeMarkedItems(items: MarkedForDeletionItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.photoId)) return false;
    seen.add(item.photoId);
    return true;
  });
}

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    language: normalizeLanguagePreference(settings.language)
  };
}
