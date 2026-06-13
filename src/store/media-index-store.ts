import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import { create } from "zustand";
import { persist, PersistStorage, StorageValue } from "zustand/middleware";
import { PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { ImageCacheService } from "@/services/image-cache-service";
import { PermissionService } from "@/services/permission-service";
import { PhotoLibraryService } from "@/services/photo-library-service";

export type MediaIndexStatus = "idle" | "refreshing" | "scanning" | "complete" | "error";

export type IndexedMediaAsset = PhotoAsset & {
  compressible: boolean;
  estimatedOriginalBytes: number;
  estimatedCompressedBytes: number;
  estimatedSavedBytes: number;
  indexedAt: number;
};

export type MediaIndexSummary = {
  scannedCount: number;
  eligibleCount: number;
  estimatedOriginalBytes: number;
  estimatedCompressedBytes: number;
  estimatedSavedBytes: number;
};

export type MediaAccessLevel = "full" | "limited";

type MediaIndexStore = {
  assetsById: Record<string, IndexedMediaAsset>;
  orderedIds: string[];
  status: MediaIndexStatus;
  hasNextPage: boolean;
  nextCursor?: string;
  lastQuickRefreshAt?: number;
  lastFullScanStartedAt?: number;
  lastFullScanCompletedAt?: number;
  ignoredSourceKey?: string;
  // The media-access level the index currently reflects. When this differs from
  // the live permission (e.g. the user dropped from full to "selected photos"),
  // the index must be reconciled so it never lists assets we can't access.
  accessLevel?: MediaAccessLevel;
  summary: MediaIndexSummary;
  error?: string;
  refreshNewestPage: () => Promise<void>;
  startFullScan: (options?: { force?: boolean; ignoredSourceIds?: string[] }) => Promise<void>;
  removeMediaIds: (ids: string[]) => void;
  resetIndex: () => void;
};

const QUICK_PAGE_SIZE = 80;
const SCAN_PAGE_SIZE = 60;
const SCAN_YIELD_MS = 28;
// During a full scan, commit merged pages to the store every N pages instead of
// every page, so large libraries don't trigger a subscriber re-render cascade
// per 60 assets.
const SCAN_SET_BATCH_PAGES = 3;
const PERSIST_DEBOUNCE_MS = 800;

type PersistedMediaIndexState = {
  assetsById: Record<string, IndexedMediaAsset>;
  orderedIds: string[];
  status: MediaIndexStatus;
  hasNextPage: boolean;
  nextCursor: string | undefined;
  lastFullScanStartedAt: number | undefined;
  lastFullScanCompletedAt: number | undefined;
  ignoredSourceKey: string | undefined;
  accessLevel: MediaAccessLevel | undefined;
  summary: MediaIndexSummary;
  error: string | undefined;
};

function isSamePersistedState(a: PersistedMediaIndexState, b: PersistedMediaIndexState) {
  return (
    a.assetsById === b.assetsById &&
    a.orderedIds === b.orderedIds &&
    a.status === b.status &&
    a.hasNextPage === b.hasNextPage &&
    a.nextCursor === b.nextCursor &&
    a.lastFullScanStartedAt === b.lastFullScanStartedAt &&
    a.lastFullScanCompletedAt === b.lastFullScanCompletedAt &&
    a.ignoredSourceKey === b.ignoredSourceKey &&
    a.accessLevel === b.accessLevel &&
    a.summary === b.summary &&
    a.error === b.error
  );
}

// Serializing the index is expensive on large libraries (thousands of assets →
// a multi-megabyte JSON.stringify on the JS thread), and zustand persist writes
// on EVERY set(). This storage debounces writes so a burst of scan/refresh
// updates collapses into a single stringify + AsyncStorage write. The index is
// derived from the device library, so losing a trailing write on process death
// is harmless — the next quick refresh or scan rebuilds it.
function createDebouncedIndexStorage(): PersistStorage<PersistedMediaIndexState> {
  let pending: StorageValue<PersistedMediaIndexState> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The partialized state of the last write that actually landed (or was
  // loaded). Identity-stable merges keep field references unchanged across
  // no-op refreshes, so a cheap shallow compare lets idle polls skip the
  // multi-megabyte stringify entirely.
  let lastWritten: PersistedMediaIndexState | undefined;
  return {
    async getItem(name) {
      const raw = await AsyncStorage.getItem(name);
      if (!raw) return null;
      try {
        const value = JSON.parse(raw) as StorageValue<PersistedMediaIndexState>;
        lastWritten = value.state;
        return value;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      // Skip only when storage already holds this exact state AND nothing
      // different is queued — a queued write must always be superseded so
      // last-call-wins holds.
      if (!pending && lastWritten && isSamePersistedState(lastWritten, value.state)) return;
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const write = pending;
        pending = undefined;
        if (!write) return;
        lastWritten = write.state;
        void AsyncStorage.setItem(name, JSON.stringify(write)).catch(() => undefined);
      }, PERSIST_DEBOUNCE_MS);
    },
    removeItem(name) {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      lastWritten = undefined;
      return AsyncStorage.removeItem(name);
    }
  };
}

const emptySummary: MediaIndexSummary = {
  scannedCount: 0,
  eligibleCount: 0,
  estimatedOriginalBytes: 0,
  estimatedCompressedBytes: 0,
  estimatedSavedBytes: 0
};

let quickRefreshPromise: Promise<void> | undefined;
let fullScanPromise: Promise<void> | undefined;
let scanToken = 0;
// Set whenever startFullScan is called with { force: true } — even if that call
// ends up joining a scan already in flight — and consumed by the running scan so
// it never skips itself. This honours forced reconciles WITHOUT preempting the
// in-flight scan (preemption made callers' awaits resolve before the real scan
// finished, which corrupted the prune/loader lifecycle).
let forceRescanRequested = false;

export const useMediaIndexStore = create<MediaIndexStore>()(
  persist(
    (set, get) => ({
      assetsById: {},
      orderedIds: [],
      status: "idle",
      hasNextPage: false,
      nextCursor: undefined,
      summary: emptySummary,
      error: undefined,

      async refreshNewestPage() {
        if (quickRefreshPromise) return quickRefreshPromise;

        quickRefreshPromise = (async () => {
          const permission = await PermissionService.getMediaPermission();
          if (permission.status !== "granted" && permission.status !== "limited") {
            set({ status: "error", error: permission.message ?? "Media permission is required." });
            return;
          }

          set((state) => ({ status: state.status === "scanning" ? "scanning" : "refreshing", error: undefined }));
          const page = await PhotoLibraryService.getPhotosPage({ first: QUICK_PAGE_SIZE });
          set((state) => {
            const indexed = page.photos.map(toIndexedMediaAsset);
            const merged = mergeIndexedAssets(state, indexed);
            // An unchanged merge keeps the same assetsById/orderedIds references,
            // so subscribed screens skip their derive/re-render work entirely.
            const unchanged = merged.assetsById === state.assetsById && merged.orderedIds === state.orderedIds;
            return {
              ...merged,
              // Keep the summary in lockstep with the merged asset set so the
              // Cleanup savings estimate never diverges from what is indexed.
              summary: unchanged
                ? state.summary
                : summarizeIndexedAssets(selectIndexedMediaAssets(merged), state.ignoredSourceKey),
              hasNextPage: page.hasNextPage,
              nextCursor: page.endCursor,
              lastQuickRefreshAt: Date.now(),
              status: state.status === "scanning" ? "scanning" : "idle",
              error: undefined
            };
          });
          ImageCacheService.prefetchPhotos(page.photos);
        })().finally(() => {
          quickRefreshPromise = undefined;
        });

        return quickRefreshPromise;
      },

      async startFullScan(options = {}) {
        const ignoredSourceKey = createIgnoredSourceKey(options.ignoredSourceIds ?? []);
        // Record the force intent even when joining an in-flight scan, so that
        // scan won't skip itself. We deliberately JOIN (never preempt) an
        // in-flight scan: every caller then awaits the same scan and only
        // proceeds once it has actually completed and pruned the index.
        if (options.force) forceRescanRequested = true;
        if (fullScanPromise) return fullScanPromise;

        const token = ++scanToken;
        const ignoredSourceIds = new Set(options.ignoredSourceIds ?? []);
        const startedAt = Date.now();

        fullScanPromise = (async () => {
          const permission = await PermissionService.getMediaPermission();
          if (permission.status !== "granted" && permission.status !== "limited") {
            if (token !== scanToken) return;
            set({ status: "error", error: permission.message ?? "Media permission is required to scan media." });
            return;
          }

          const accessLevel: MediaAccessLevel = permission.status === "limited" ? "limited" : "full";
          const current = get();
          // Consume any pending force request (from this call or one that joined
          // this scan) so a forced reconcile is never skipped.
          const forced = forceRescanRequested;
          forceRescanRequested = false;
          // Skip a redundant rescan ONLY when nothing relevant changed: same
          // ignore set, a prior scan already completed, and we were and still are
          // on full access. Under "selected photos" (limited) access we always
          // reconcile — the accessible set is small and the user can change it at
          // any time — and any access-level change forces a fresh scan so stale
          // entries from a previous, broader grant are pruned out.
          const canSkip =
            !forced &&
            accessLevel === "full" &&
            current.accessLevel === "full" &&
            current.ignoredSourceKey === ignoredSourceKey &&
            Boolean(current.lastFullScanCompletedAt);
          if (canSkip || token !== scanToken) {
            return;
          }

          set({
            status: "scanning",
            lastFullScanStartedAt: startedAt,
            ignoredSourceKey,
            summary: emptySummary,
            error: undefined
          });

          let after: string | undefined;
          let hasNextPage = true;
          const scannedIds = new Set<string>();
          const summary: MediaIndexSummary = { ...emptySummary };
          let pendingIndexed: IndexedMediaAsset[] = [];
          let pagesSinceCommit = 0;

          while (hasNextPage && token === scanToken) {
            const page = await PhotoLibraryService.getPhotosPage({ first: SCAN_PAGE_SIZE, after });
            // A native page-read failure is NOT a genuine end of library. If we
            // treated it as one, the completion block below would run
            // removeUnseenAfterCompleteScan (pruning every asset past the failure
            // point) and record lastFullScanCompletedAt — silently truncating the
            // persisted index off one transient error. Instead, abort as a scan
            // error: throwing routes into the IIFE's .catch, which sets
            // status "error" WITHOUT pruning or marking the scan complete, and
            // still resolves the promise so awaiting callers clear their loaders.
            // A superseding scan (token changed mid-await) just bails quietly.
            if (page.error) {
              if (token !== scanToken) return;
              throw new Error("Media library read failed during scan.");
            }
            const indexed = page.photos.map(toIndexedMediaAsset);
            for (const asset of indexed) {
              scannedIds.add(asset.id);
              summary.scannedCount += 1;
              if (ignoredSourceIds.has(asset.id) || !asset.compressible) continue;
              summary.eligibleCount += 1;
              summary.estimatedOriginalBytes += asset.estimatedOriginalBytes;
              summary.estimatedCompressedBytes += asset.estimatedCompressedBytes;
              summary.estimatedSavedBytes += asset.estimatedSavedBytes;
            }

            after = page.endCursor;
            hasNextPage = page.hasNextPage;
            pendingIndexed.push(...indexed);
            pagesSinceCommit += 1;

            if (token !== scanToken) return;
            if (!hasNextPage || pagesSinceCommit >= SCAN_SET_BATCH_PAGES) {
              const commit = pendingIndexed;
              pendingIndexed = [];
              pagesSinceCommit = 0;
              set((current) => ({
                ...mergeIndexedAssets(current, commit),
                status: "scanning",
                hasNextPage,
                nextCursor: after,
                summary: { ...summary },
                ignoredSourceKey,
                error: undefined
              }));
            }

            if (page.photos.length > 0) {
              ImageCacheService.prefetchPhotos(page.photos, 12);
            }
            if (hasNextPage) {
              await sleep(SCAN_YIELD_MS);
            }
          }

          if (token !== scanToken) return;
          const completedAt = Date.now();
          set((current) => ({
            ...removeUnseenAfterCompleteScan(current, scannedIds),
            status: "complete",
            hasNextPage: false,
            nextCursor: undefined,
            summary,
            accessLevel,
            ignoredSourceKey,
            lastFullScanCompletedAt: completedAt,
            error: undefined
          }));
        })()
          .catch((error) => {
            // Resolve (don't reject) on failure so awaiting callers always
            // continue and clear their loaders; surface it as an error status.
            if (token === scanToken) {
              set({ status: "error", error: error instanceof Error ? error.message : "Media scan failed." });
            }
          })
          .finally(() => {
            if (token === scanToken) {
              fullScanPromise = undefined;
              // Clear any force intent the completed scan already satisfied, so a
              // request that joined this scan can't leak into and needlessly
              // un-cache the next independent scan.
              forceRescanRequested = false;
            }
          });

        return fullScanPromise;
      },

      removeMediaIds(ids) {
        if (ids.length === 0) return;
        set((state) => {
          const removeSet = new Set(ids);
          const assetsById = { ...state.assetsById };
          for (const id of ids) {
            delete assetsById[id];
          }
          const orderedIds = state.orderedIds.filter((id) => !removeSet.has(id));
          return {
            assetsById,
            orderedIds,
            summary: summarizeIndexedAssets(orderedIds.map((id) => assetsById[id]).filter(Boolean), state.ignoredSourceKey)
          };
        });
      },

      resetIndex() {
        scanToken += 1;
        quickRefreshPromise = undefined;
        fullScanPromise = undefined;
        forceRescanRequested = false;
        set({
          assetsById: {},
          orderedIds: [],
          status: "idle",
          hasNextPage: false,
          nextCursor: undefined,
          accessLevel: undefined,
          summary: emptySummary,
          error: undefined
        });
      }
    }),
    {
      name: "swipeclean-media-index-store",
      storage: createDebouncedIndexStorage(),
      // lastQuickRefreshAt is deliberately NOT persisted — it is never read, and
      // persisting it would force a full index write after every idle poll.
      partialize: (state): PersistedMediaIndexState => ({
        assetsById: state.assetsById,
        orderedIds: state.orderedIds,
        status: state.status === "scanning" || state.status === "refreshing" ? "idle" : state.status,
        hasNextPage: state.hasNextPage,
        nextCursor: state.nextCursor,
        lastFullScanStartedAt: state.lastFullScanStartedAt,
        lastFullScanCompletedAt: state.lastFullScanCompletedAt,
        ignoredSourceKey: state.ignoredSourceKey,
        accessLevel: state.accessLevel,
        summary: state.summary,
        error: state.error
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<MediaIndexStore>;
        const merged = { ...currentState, ...persisted };
        // A scan interrupted by process death can leave a partial summary in
        // storage (mid-scan states get persisted). Recompute it from the
        // rehydrated assets so the "unchanged merge keeps the summary"
        // optimization in refreshNewestPage always starts from a consistent
        // baseline.
        return {
          ...merged,
          summary: summarizeIndexedAssets(
            selectIndexedMediaAssets({ assetsById: merged.assetsById ?? {}, orderedIds: merged.orderedIds ?? [] }),
            merged.ignoredSourceKey
          )
        };
      }
    }
  )
);

export function selectIndexedMediaAssets(state: Pick<MediaIndexStore, "assetsById" | "orderedIds">) {
  return state.orderedIds.map((id) => state.assetsById[id]).filter((asset): asset is IndexedMediaAsset => Boolean(asset));
}

export function useIndexedMediaAssets() {
  const assetsById = useMediaIndexStore((state) => state.assetsById);
  const orderedIds = useMediaIndexStore((state) => state.orderedIds);
  return useMemo(
    () => orderedIds.map((id) => assetsById[id]).filter((asset): asset is IndexedMediaAsset => Boolean(asset)),
    [assetsById, orderedIds]
  );
}

export function selectIndexedMediaAsset(state: Pick<MediaIndexStore, "assetsById">, id?: string) {
  return id ? state.assetsById[id] : undefined;
}

function toIndexedMediaAsset(asset: PhotoAsset): IndexedMediaAsset {
  const estimate = CompressionService.estimate(asset);
  return {
    ...asset,
    compressible: CompressionService.isCompressible(asset),
    estimatedOriginalBytes: estimate.originalBytes,
    estimatedCompressedBytes: estimate.compressedBytes,
    estimatedSavedBytes: estimate.savedBytes,
    indexedAt: Date.now()
  };
}

// Two indexed views of the same library asset are interchangeable when every
// field that feeds the UI or the compression estimates matches. The derived
// fields are compared too so a persisted object computed by an older app
// version (different estimator constants) is replaced instead of kept forever.
// `indexedAt` is deliberately ignored — it is bookkeeping, not data.
function isSameIndexedAsset(existing: IndexedMediaAsset, incoming: IndexedMediaAsset) {
  return (
    existing.uri === incoming.uri &&
    existing.filename === incoming.filename &&
    existing.width === incoming.width &&
    existing.height === incoming.height &&
    existing.creationTime === incoming.creationTime &&
    existing.modificationTime === incoming.modificationTime &&
    existing.duration === incoming.duration &&
    existing.mediaType === incoming.mediaType &&
    existing.sizeBytes === incoming.sizeBytes &&
    existing.monthKey === incoming.monthKey &&
    existing.compressible === incoming.compressible &&
    existing.estimatedOriginalBytes === incoming.estimatedOriginalBytes &&
    existing.estimatedCompressedBytes === incoming.estimatedCompressedBytes &&
    existing.estimatedSavedBytes === incoming.estimatedSavedBytes
  );
}

function mergeIndexedAssets(
  state: Pick<MediaIndexStore, "assetsById" | "orderedIds">,
  incomingAssets: IndexedMediaAsset[]
) {
  // Keep existing object/map/order references when a merge carries no actual
  // changes. Identity churn here cascades into every subscribed screen (full
  // re-derives + re-renders) and an index re-persist — the periodic newest-page
  // refresh would otherwise pay that cost every 45 seconds for nothing.
  let changed = false;
  const assetsById = { ...state.assetsById };
  for (const asset of incomingAssets) {
    const existing = assetsById[asset.id];
    if (existing && isSameIndexedAsset(existing, asset)) continue;
    assetsById[asset.id] = asset;
    changed = true;
  }
  if (!changed) {
    return { assetsById: state.assetsById, orderedIds: state.orderedIds };
  }
  const orderedIds = Object.values(assetsById)
    .sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0))
    .map((asset) => asset.id);
  return { assetsById, orderedIds };
}

function removeUnseenAfterCompleteScan(
  state: Pick<MediaIndexStore, "assetsById" | "orderedIds">,
  seenIds: Set<string>
) {
  // Pruning preserves the existing (already sorted) order, so when nothing was
  // removed the same references go back into the store and subscribers skip.
  const orderedIds = state.orderedIds.filter((id) => seenIds.has(id) && state.assetsById[id]);
  if (orderedIds.length === state.orderedIds.length) {
    return { assetsById: state.assetsById, orderedIds: state.orderedIds };
  }
  const assetsById: Record<string, IndexedMediaAsset> = {};
  for (const id of orderedIds) {
    assetsById[id] = state.assetsById[id];
  }
  return { assetsById, orderedIds };
}

function summarizeIndexedAssets(assets: IndexedMediaAsset[], ignoredSourceKey?: string): MediaIndexSummary {
  const ignoredSourceIds = new Set((ignoredSourceKey ?? "").split("|").filter(Boolean));
  return assets.reduce(
    (summary, asset) => {
      summary.scannedCount += 1;
      if (ignoredSourceIds.has(asset.id) || !asset.compressible) return summary;
      summary.eligibleCount += 1;
      summary.estimatedOriginalBytes += asset.estimatedOriginalBytes;
      summary.estimatedCompressedBytes += asset.estimatedCompressedBytes;
      summary.estimatedSavedBytes += asset.estimatedSavedBytes;
      return summary;
    },
    { ...emptySummary }
  );
}

function createIgnoredSourceKey(ids: string[]) {
  if (ids.length === 0) return "";
  return [...ids].sort().join("|");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
