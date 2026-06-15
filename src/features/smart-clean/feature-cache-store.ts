import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { FeatureEntry, FeaturePatch, SmartCleanFeatureCacheApi } from "@/features/smart-clean/smart-clean.types";
import { createDebouncedStorage } from "@/utils/debounced-storage";

/**
 * Persisted, capped per-asset computed-feature cache (md5 / perceptual hashes /
 * blur variance) so expensive detection runs are computed once and reused.
 *
 * Keyed by mediaId, invalidated by `modKey` (the asset's modificationTime
 * fallback): a feature is considered stale and recomputed when the stored
 * modKey differs, so an edited photo never reuses an old hash (a safety bug).
 *
 * Stores ONLY small scalars/hex strings — never base64 pixels — and is FIFO-
 * capped so AsyncStorage can't grow unbounded.
 *
 * SUBSCRIPTION SAFETY (the Stage 1 crash): components must NOT subscribe a
 * selector that builds an object/array from `entries` (e.g. Object.values).
 * Detectors read non-React via `featureCacheApi`; if the UI ever needs a count,
 * subscribe to the primitive `order.length`.
 */
const FEATURE_CACHE_CAP = 8000;

type FeatureCacheStore = {
  entries: Record<string, FeatureEntry>;
  order: string[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  getFeature: (mediaId: string, modKey: number) => FeatureEntry | undefined;
  upsertFeature: (mediaId: string, modKey: number, patch: FeaturePatch) => void;
  pruneMissing: (validIds: Set<string>) => void;
  clearFeatures: () => void;
};

export const useSmartCleanFeatureCache = create<FeatureCacheStore>()(
  persist(
    (set, get) => ({
      entries: {},
      order: [],
      hasHydrated: false,

      setHasHydrated(hasHydrated) {
        set({ hasHydrated });
      },

      getFeature(mediaId, modKey) {
        const entry = get().entries[mediaId];
        if (!entry || entry.modKey !== modKey) return undefined;
        return entry;
      },

      upsertFeature(mediaId, modKey, patch) {
        set((state) => {
          const existing = state.entries[mediaId];
          // Reset features when the asset changed (modKey mismatch).
          const base: FeatureEntry = existing && existing.modKey === modKey ? existing : { modKey, updatedAt: 0 };
          const nextEntry: FeatureEntry = { ...base, ...patch, modKey, updatedAt: Date.now() };
          const entries = { ...state.entries, [mediaId]: nextEntry };

          let order = state.order;
          if (!existing) {
            order = [...state.order, mediaId];
            // FIFO eviction over the cap.
            if (order.length > FEATURE_CACHE_CAP) {
              const overflow = order.length - FEATURE_CACHE_CAP;
              const evicted = order.slice(0, overflow);
              order = order.slice(overflow);
              for (const id of evicted) delete entries[id];
            }
          }
          return { entries, order };
        });
      },

      pruneMissing(validIds) {
        set((state) => {
          const entries: Record<string, FeatureEntry> = {};
          const order: string[] = [];
          for (const id of state.order) {
            if (validIds.has(id) && state.entries[id]) {
              entries[id] = state.entries[id];
              order.push(id);
            }
          }
          return { entries, order };
        });
      },

      clearFeatures() {
        set({ entries: {}, order: [] });
      }
    }),
    {
      name: "swipeclean-smart-clean-feature-cache",
      // Debounced: the cache upserts on EVERY asset during a scan (thousands of
      // writes on a large library). Periodic durability is fine — a hard kill
      // loses <1s of hashes, which recompute cheaply on resume.
      storage: createJSONStorage(() => createDebouncedStorage(800)),
      // v1: photo dHash derivation changed from a direct 9x8 resize to a 64x64→9x8
      // average-pool (single-decode pipeline). Old dHashes would compare wrong
      // against new ones (false negatives), so drop them — they recompute on the
      // next scan. blurVar (still 64x64), md5, and vHash (video, unchanged) are kept.
      version: 1,
      migrate: (persisted, fromVersion) => {
        const state = (persisted ?? {}) as { entries?: Record<string, FeatureEntry>; order?: string[] };
        if (fromVersion < 1 && state.entries) {
          for (const id of Object.keys(state.entries)) {
            const entry = state.entries[id];
            if (entry && entry.dHash !== undefined) delete entry.dHash;
          }
        }
        return state;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Failed to rehydrate smart-clean feature cache", error);
        }
        (state ?? useSmartCleanFeatureCache.getState()).setHasHydrated(true);
      },
      partialize: (state) => ({ entries: state.entries, order: state.order })
    }
  )
);

/** Non-React facade for detectors. */
export const featureCacheApi: SmartCleanFeatureCacheApi = {
  get: (mediaId, modKey) => useSmartCleanFeatureCache.getState().getFeature(mediaId, modKey),
  upsert: (mediaId, modKey, patch) => useSmartCleanFeatureCache.getState().upsertFeature(mediaId, modKey, patch)
};
