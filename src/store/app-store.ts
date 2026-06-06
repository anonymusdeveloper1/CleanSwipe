import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AppSettings,
  CompressedMediaItem,
  CompressionQuality,
  AppStats,
  DeletedHistoryItem,
  MarkedForDeletionItem,
  MediaTypeFilter,
  PermissionResult,
  PhotoAsset,
  SwipeAction
} from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { DeletionQueueService } from "@/services/deletion-queue-service";
import { HistoryService } from "@/services/history-service";
import { ImageCacheService } from "@/services/image-cache-service";
import { NotificationService } from "@/services/notification-service";
import { PermissionService } from "@/services/permission-service";
import { PhotoLibraryService } from "@/services/photo-library-service";
import { defaultSettings } from "@/services/settings-service";
import { emptyStats, StatsService } from "@/services/stats-service";
import { filterPhotosByScope } from "@/utils/months";

type LastSwipe = {
  photo: PhotoAsset;
  action: SwipeAction;
  index: number;
};

type AppStore = {
  photos: PhotoAsset[];
  loadingPhotos: boolean;
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
  compressingIds: string[];
  compressionProgress: Record<string, number>;
  compressionError?: string;
  history: DeletedHistoryItem[];
  stats: AppStats;
  settings: AppSettings;
  lastSwipe?: LastSwipe;
  error?: string;
  setHasHydrated: (hasHydrated: boolean) => void;
  loadInitialData: () => Promise<void>;
  refreshPhotos: () => Promise<void>;
  requestPhotoPermission: () => Promise<void>;
  setSelectedMonth: (key: string) => void;
  setSelectedMediaType: (mediaType: MediaTypeFilter) => void;
  swipeCurrentPhoto: (action: SwipeAction) => void;
  keepPhoto: (photoId: string) => void;
  markPhotoForDeletion: (photo: PhotoAsset) => void;
  undoLastSwipe: () => void;
  restoreMarkedPhoto: (photoId: string) => void;
  permanentlyDeleteMarked: (photoIds?: string[]) => Promise<{ deletedCount: number; clearedBytes: number }>;
  compressMedia: (photoId: string, quality: CompressionQuality) => Promise<CompressedMediaItem>;
  compressAllEligible: (quality: CompressionQuality, mediaType?: "all" | "video" | "photo") => Promise<CompressedMediaItem[]>;
  restoreHistoryItem: (historyId: string) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  visiblePhotos: () => PhotoAsset[];
  currentPhoto: () => PhotoAsset | undefined;
};

let initialLoadPromise: Promise<void> | undefined;
let refreshPromise: Promise<void> | undefined;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      photos: [],
      loadingPhotos: false,
      requestingPermission: false,
      hasHydrated: false,
      permission: { status: "not-requested" },
      selectedMonthKey: "all",
      selectedMediaType: "all",
      currentIndex: 0,
      reviewedPhotoIds: [],
      markedForDeletion: [],
      compressedMedia: [],
      compressingIds: [],
      compressionProgress: {},
      history: [],
      stats: emptyStats,
      settings: defaultSettings,

      setHasHydrated(hasHydrated) {
        set({ hasHydrated });
      },

      async loadInitialData() {
        if (initialLoadPromise) return initialLoadPromise;

        initialLoadPromise = (async () => {
          const cachedPhotos = get().photos;
          const hasReadableCache = cachedPhotos.length > 0 && canReadMedia(get().permission);

          set({ loadingPhotos: !hasReadableCache, error: undefined });

          const permission = await PermissionService.getMediaPermission();
          if (!canReadMedia(permission)) {
            set({
              permission,
              photos: [],
              loadingPhotos: false,
              error: permission.message
            });
            return;
          }

          if (cachedPhotos.length > 0) {
            set({ permission, loadingPhotos: false, error: undefined });
            ImageCacheService.prefetchPhotos(cachedPhotos);
            void get().refreshPhotos();
            return;
          }

          const photos = await PhotoLibraryService.getPhotos({ first: 250 });
          set({
            permission,
            photos,
            loadingPhotos: false,
            photoLibrarySyncedAt: Date.now(),
            error: undefined
          });
          ImageCacheService.prefetchPhotos(photos);
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
            set({ permission, photos: [] });
            return;
          }

          const currentPhotoId = state.currentPhoto()?.id;
          const photos = await PhotoLibraryService.getPhotos({ first: 250 });
          const visiblePhotos = getVisiblePhotos(photos, state);
          const matchingIndex = currentPhotoId
            ? visiblePhotos.findIndex((photo) => photo.id === currentPhotoId)
            : -1;
          const currentIndex =
            matchingIndex >= 0
              ? matchingIndex
              : Math.min(state.currentIndex, Math.max(visiblePhotos.length - 1, 0));

          set({
            permission,
            photos,
            currentIndex,
            photoLibrarySyncedAt: Date.now(),
            error: undefined
          });
          ImageCacheService.prefetchPhotos(photos);
        })().finally(() => {
          refreshPromise = undefined;
        });

        return refreshPromise;
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

        const hasCachedPhotos = get().photos.length > 0;
        set({
          permission,
          requestingPermission: false,
          loadingPhotos: !hasCachedPhotos,
          error: undefined
        });

        const photos = await PhotoLibraryService.getPhotos({ first: 250 });
        set({
          permission,
          photos,
          photoLibrarySyncedAt: Date.now(),
          requestingPermission: false,
          loadingPhotos: false,
          error: undefined
        });
        ImageCacheService.prefetchPhotos(photos);
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
          const photo = state.photos.find((item) => item.id === photoId);
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

      async permanentlyDeleteMarked(photoIds) {
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
          photos: state.photos.filter((photo) => !ids.includes(photo.id)),
          error: undefined
        });
        return { deletedCount: items.length, clearedBytes };
      },

      async compressMedia(photoId, quality) {
        const asset = get().photos.find((photo) => photo.id === photoId);
        if (!asset) {
          throw new Error("Media item could not be found.");
        }
        const notificationLabel = getNotificationLabel(asset);

        set((state) => ({
          compressingIds: state.compressingIds.includes(photoId) ? state.compressingIds : [...state.compressingIds, photoId],
          compressionProgress: { ...state.compressionProgress, [photoId]: 0 },
          compressionError: undefined
        }));
        void NotificationService.notifyCompressionStarted(notificationLabel);

        try {
          const result = await CompressionService.compress(asset, {
            quality,
            onProgress: (progress) => {
              void NotificationService.notifyCompressionProgress(notificationLabel, progress);
              set((state) => ({
                compressionProgress: { ...state.compressionProgress, [photoId]: progress }
              }));
            }
          });
          void NotificationService.notifyCompressionComplete(notificationLabel);

          set((state) => ({
            compressedMedia: [result, ...state.compressedMedia.filter((item) => item.sourceId !== photoId)],
            compressingIds: state.compressingIds.filter((id) => id !== photoId),
            compressionProgress: { ...state.compressionProgress, [photoId]: 1 },
            compressionError: undefined
          }));
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Compression failed.";
          void NotificationService.notifyCompressionFailed(message);
          set((state) => ({
            compressingIds: state.compressingIds.filter((id) => id !== photoId),
            compressionProgress: { ...state.compressionProgress, [photoId]: 0 },
            compressionError: message
          }));
          throw error;
        }
      },

      async compressAllEligible(quality, mediaType = "all") {
        const assets = get().photos.filter((photo) => {
          if (!CompressionService.isCompressible(photo)) return false;
          if (mediaType === "video") return photo.mediaType === "video";
          if (mediaType === "photo") return photo.mediaType === "photo";
          return photo.mediaType === "video" || photo.mediaType === "photo";
        });
        const results: CompressedMediaItem[] = [];
        for (const asset of assets) {
          results.push(await get().compressMedia(asset.id, quality));
        }
        return results;
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
        return getVisiblePhotos(get().photos, get());
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
        const persisted = persistedState as Partial<AppStore>;
        return {
          ...currentState,
          ...persisted,
          loadingPhotos: false,
          requestingPermission: false,
          hasHydrated: currentState.hasHydrated,
          selectedMediaType: persisted.selectedMediaType ?? currentState.selectedMediaType,
          reviewedPhotoIds: dedupeIds(persisted.reviewedPhotoIds ?? currentState.reviewedPhotoIds),
          markedForDeletion: dedupeMarkedItems(persisted.markedForDeletion ?? currentState.markedForDeletion)
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        photos: state.photos,
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

function getNotificationLabel(asset: PhotoAsset) {
  return asset.filename?.replace(/\.[^.]+$/, "").replaceAll("_", " ") || (asset.mediaType === "video" ? "Video" : "Photo");
}
