import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { FeatureAccessService } from "@/features/subscription/feature-access.service";
import { FeatureKey } from "@/features/subscription/feature-flags";
import { SmartCleanDetectorKey, SmartCleanGroup, SmartCleanResult, SmartCleanStatus } from "@/features/smart-clean/smart-clean.types";
import { SMART_CLEAN_SCAN_ORDER } from "@/features/smart-clean/smart-clean.service";
import { prewarmPhotoFeatures } from "@/features/smart-clean/detectors/pre-pass";
import { featureCacheApi } from "@/features/smart-clean/feature-cache-store";
import { mediaScopeFingerprint } from "@/features/smart-clean/permission-reconcile";
import { SmartCleanScanNotifications } from "@/features/smart-clean/smart-clean-notifications";
import { BackgroundSmartCleanScanWorker } from "@/services/background-smart-clean-scan-worker";
import { SCAN_YIELD_MS, finalizeResult, notAvailable, sleep, toItem } from "@/features/smart-clean/detectors/shared";
import { IndexedMediaAsset, MediaAccessLevel, selectIndexedMediaAssets, useMediaIndexStore } from "@/store/media-index-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { createDebouncedStorage } from "@/utils/debounced-storage";
import i18n from "@/i18n";

/**
 * Smart Clean scan runner. Owns the scan lifecycle, progress, cancellation, and
 * sequential orchestration of the detectors — mirroring media-index-store's
 * module-level token discipline (JOIN, never preempt; check the token after
 * every await; resolve-with-error rather than reject so the UI loader never
 * strands).
 *
 * DURABILITY (this store is now PERSISTED):
 *  - The scan runs inside an Android foreground service ({@link BackgroundSmartCleanScanWorker})
 *    when the singleton service is free, so it keeps executing while the app is
 *    backgrounded / screen-off. If compression takes the service, the scan
 *    degrades to plain foreground JS (still checkpoints).
 *  - Results + phase + a library signature are persisted (compacted to mediaIds).
 *    An interrupted scan (kill/crash/background-suspend) AUTO-RESUMES from the
 *    first not-yet-completed detector on next launch — never from scratch. The
 *    expensive per-asset hashing is already durably cached (feature-cache-store),
 *    so a resumed detector reuses every prior hash.
 *
 * SUBSCRIPTION SAFETY: components subscribe ONLY to primitives (phase/progress/
 * activeIndex/activeDetectorKey/lastRunAt/hasHydrated) and to `resultsByKey` as a
 * stable ref. `resultsByKey` is expanded from the persisted compact form EXACTLY
 * ONCE (in hydrateFromPersisted), never rebuilt inside a selector — that would
 * reintroduce the Stage-1 fresh-object-selector crash.
 */
export type RunPhase = "idle" | "scanning" | "interrupted" | "complete" | "error";

type RunScanOptions = {
  /** Resume from the persisted checkpoint instead of starting fresh. */
  resume?: boolean;
};

/** Persisted shape — results stored as mediaIds only (re-resolved from the index). */
type CompactGroup = { id: string; keepMediaId?: string; itemIds: string[] };
type CompactResult = { key: SmartCleanDetectorKey; status: SmartCleanStatus; groups: CompactGroup[] };
type CompactResultMap = Record<string, CompactResult>;

type PersistedShape = {
  resultsCompact: CompactResultMap;
  runSignature?: string;
  phase: RunPhase;
  lastRunAt?: number;
};

type SmartCleanStore = {
  phase: RunPhase;
  progress: number;
  /** 1-based index of the detector currently running (0 when idle). Drives the
   * "X of Y" counter on BOTH the screen and the notification (no off-by-one). */
  activeIndex: number;
  activeDetectorKey?: SmartCleanDetectorKey;
  /** Coarse scan stage for the progress UI. "analyzing" = the photo pre-pass. */
  stage?: "metadata" | "analyzing" | "grouping";
  /** Photos with features computed so far / total photos (for the pre-pass label). */
  analyzed: number;
  analyzeTotal: number;
  resultsByKey: Record<string, SmartCleanResult>;
  /** Persisted compact results awaiting expansion against the media index. */
  restoredCompact: CompactResultMap | null;
  runSignature?: string;
  lastRunAt?: number;
  lastCheckpointAt?: number;
  hasHydrated: boolean;
  error?: string;
  setHasHydrated: (hasHydrated: boolean) => void;
  runScan: (options?: RunScanOptions) => Promise<void>;
  resumeIfInterrupted: () => void;
  hydrateFromPersisted: () => void;
  releaseForegroundService: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
};

let runToken = 0;
let runPromise: Promise<void> | undefined;
let controller: AbortController | undefined;
// True only while the SCAN holds the foreground service. NOT the same as
// BackgroundService.isRunning() (which is global across the scan AND compression
// tasks) — we must never stop the service when compression is the one holding it.
let serviceHeld = false;
let lastNotifyAt = 0;

const NOTIFY_THROTTLE_MS = 1200;

function liveAccessLevel(): MediaAccessLevel {
  return useMediaIndexStore.getState().accessLevel === "limited" ? "limited" : "full";
}

/** Non-React entitlement check (the launch-time auto-resume has no React hook). */
function imperativeCanUse(featureKey: FeatureKey): boolean {
  const state = useSubscriptionStore.getState();
  return FeatureAccessService.canUseFeature(featureKey, {
    subscriptionStatus: state.subscriptionStatus
  });
}

/** Library snapshot fingerprint. Changes whenever the index reconciles. */
function computeSignature(): string {
  const state = useMediaIndexStore.getState();
  return `${state.lastFullScanCompletedAt ?? 0}|${mediaScopeFingerprint(state.accessLevel, state.orderedIds)}`;
}

function compactResults(resultsByKey: Record<string, SmartCleanResult>): CompactResultMap {
  const out: CompactResultMap = {};
  for (const key of Object.keys(resultsByKey)) {
    const result = resultsByKey[key];
    out[key] = {
      key: result.key,
      status: result.status,
      groups: result.groups.map((group) => ({
        id: group.id,
        keepMediaId: group.keepMediaId,
        itemIds: group.items.map((item) => item.mediaId)
      }))
    };
  }
  return out;
}

/**
 * Rebuild full results from the compact (mediaId-only) form against the current
 * media index, DROPPING items that no longer exist (the prune step), then
 * recompute counts/bytes via finalizeResult so stale numbers can't survive.
 */
function expandResults(compact: CompactResultMap, assetsById: Record<string, IndexedMediaAsset>): Record<string, SmartCleanResult> {
  const out: Record<string, SmartCleanResult> = {};
  for (const key of Object.keys(compact)) {
    const entry = compact[key];
    if (entry.status === "not_available") {
      out[key] = notAvailable(entry.key);
      continue;
    }
    const groups: SmartCleanGroup[] = [];
    for (const group of entry.groups) {
      const items = group.itemIds.map((id) => assetsById[id]).filter((asset): asset is IndexedMediaAsset => Boolean(asset)).map(toItem);
      if (items.length === 0) continue;
      const keeperBased = group.keepMediaId !== undefined;
      // Keeper-based groups (duplicates/similar) need >= 2 survivors to be meaningful.
      if (keeperBased && items.length < 2) continue;
      const keepMediaId = keeperBased
        ? items.some((item) => item.mediaId === group.keepMediaId)
          ? group.keepMediaId
          : items[0].mediaId // original keeper was pruned → keep any survivor
        : undefined;
      groups.push({ id: group.id, keepMediaId, items });
    }
    out[key] = finalizeResult(entry.key, groups);
  }
  return out;
}

function normalizePersistedPhase(phase: unknown): RunPhase {
  return phase === "interrupted" || phase === "complete" ? phase : "idle";
}

function updateScanNotification(current: number, total: number, progress: number) {
  if (Platform.OS !== "android") return;
  lastNotifyAt = Date.now();
  if (serviceHeld) {
    void BackgroundSmartCleanScanWorker.update({
      title: i18n.t("smartClean.title"),
      description: i18n.t("smartClean.scanningProgress", { current, total }),
      progress,
      linkingURI: "swipeclean://"
    });
  } else {
    // Degraded (compression holds the service, or non-service run): the
    // expo-notifications sticky notification WITH its Stop button.
    void SmartCleanScanNotifications.showProgress(current, total);
  }
}

/** Throttled intra-detector update so a long detector's bar doesn't look frozen. */
function throttledNotify(current: number, total: number, progress: number) {
  if (Platform.OS !== "android" || !serviceHeld) return; // expo body has no fraction → per-detector only
  if (Date.now() - lastNotifyAt < NOTIFY_THROTTLE_MS) return;
  updateScanNotification(current, total, progress);
}

function dismissAllScanNotifications() {
  void SmartCleanScanNotifications.dismiss();
}

export const useSmartCleanStore = create<SmartCleanStore>()(
  persist(
    (set, get) => ({
      phase: "idle",
      progress: 0,
      activeIndex: 0,
      activeDetectorKey: undefined,
      stage: undefined,
      analyzed: 0,
      analyzeTotal: 0,
      resultsByKey: {},
      restoredCompact: null,
      runSignature: undefined,
      lastRunAt: undefined,
      lastCheckpointAt: undefined,
      hasHydrated: false,
      error: undefined,

      setHasHydrated(hasHydrated) {
        set({ hasHydrated });
      },

      hydrateFromPersisted() {
        const state = get();
        if (!state.restoredCompact || !state.hasHydrated) return;
        const indexState = useMediaIndexStore.getState();
        if (indexState.orderedIds.length === 0) return; // index not ready/empty — defer
        set({ resultsByKey: expandResults(state.restoredCompact, indexState.assetsById), restoredCompact: null });
      },

      resumeIfInterrupted() {
        if (runPromise) return;
        const state = get();
        if (!state.hasHydrated || state.phase === "scanning") return;
        // Bring persisted results into resultsByKey for display (any phase).
        get().hydrateFromPersisted();
        if (get().restoredCompact) return; // couldn't expand yet (index not ready) — a later trigger retries
        if (get().phase !== "interrupted") return;
        if (get().runSignature !== computeSignature()) {
          // Library changed since the cut-off scan — show the pruned results as a
          // finished (stale) scan; the user can Scan again. Never auto-resume
          // against a changed library.
          set({ phase: "complete" });
          return;
        }
        void get().runScan({ resume: true });
      },

      runScan(options = {}) {
        if (runPromise) return runPromise;
        const resume = Boolean(options.resume);
        const token = ++runToken;
        controller = new AbortController();
        const signal = controller.signal;

        const assets = selectIndexedMediaAssets(useMediaIndexStore.getState());
        const accessLevel = liveAccessLevel();
        const canUse = imperativeCanUse;
        const currentSignature = computeSignature();

        // Seed from the persisted checkpoint when resuming an unchanged library.
        let seeded: Record<string, SmartCleanResult> = {};
        let signature = currentSignature;
        if (resume) {
          get().hydrateFromPersisted();
          if (get().restoredCompact) {
            // The media index isn't ready, so the persisted checkpoint couldn't be
            // expanded. Bail WITHOUT touching state (a later resume trigger retries)
            // — proceeding would seed empty and overwrite the saved results.
            return Promise.resolve();
          }
          if (get().runSignature === currentSignature) {
            seeded = { ...get().resultsByKey };
            signature = currentSignature;
          }
        }
        const total = SMART_CLEAN_SCAN_ORDER.length;
        // Pixel detectors depend on the concurrent photo pre-pass; the rest are
        // cheap metadata/MD5 passes that surface first. (duplicateVideos hashes
        // video thumbnails itself — videos are few — so it runs in the pixel phase.)
        const PIXEL_KEYS = new Set<SmartCleanDetectorKey>(["duplicateVideos", "similarPhotos", "blurryPhotos"]);
        const cheapDetectors = SMART_CLEAN_SCAN_ORDER.filter((detector) => !PIXEL_KEYS.has(detector.key));
        const pixelDetectors = SMART_CLEAN_SCAN_ORDER.filter((detector) => PIXEL_KEYS.has(detector.key));
        // Progress bands: cheap [0, 0.10] → pre-pass [0.10, 0.85] → pixel [0.85, 1].
        const CHEAP_END = 0.1;
        const PREPASS_END = 0.85;

        set({
          phase: "scanning",
          progress: 0,
          activeIndex: 1,
          activeDetectorKey: undefined,
          stage: "metadata",
          analyzed: 0,
          analyzeTotal: 0,
          error: undefined,
          resultsByKey: seeded,
          restoredCompact: null,
          runSignature: signature
        });

        const acc: Record<string, SmartCleanResult> = { ...seeded };

        // Run one detector within its progress band. Seeded detectors (resume) are
        // skipped. Keeps the per-detector checkpoint + token/abort discipline.
        const runDetector = async (
          detector: (typeof SMART_CLEAN_SCAN_ORDER)[number],
          bandStart: number,
          bandEnd: number,
          displayIndex: number
        ) => {
          if (token !== runToken) return;
          if (seeded[detector.key]) {
            set({ progress: bandEnd });
            return;
          }
          set({ activeIndex: displayIndex, activeDetectorKey: detector.key });
          updateScanNotification(displayIndex, total, bandStart);
          if (!canUse(detector.featureKey)) {
            acc[detector.key] = notAvailable(detector.key);
            set({ resultsByKey: { ...acc }, progress: bandEnd, lastCheckpointAt: Date.now() });
            return;
          }
          try {
            const result = await detector.detect({
              assets,
              accessLevel,
              signal,
              cache: featureCacheApi,
              onProgress: (fraction) => {
                if (token !== runToken) return;
                const p = bandStart + (bandEnd - bandStart) * fraction;
                set({ progress: p });
                throttledNotify(displayIndex, total, p);
              }
            });
            if (token !== runToken) return;
            acc[detector.key] = result;
          } catch {
            if (signal.aborted || token !== runToken) return;
            acc[detector.key] = notAvailable(detector.key);
          }
          // Per-detector checkpoint (persist is debounced).
          set({ resultsByKey: { ...acc }, progress: bandEnd, lastCheckpointAt: Date.now() });
          await sleep(SCAN_YIELD_MS);
        };

        const scanBody = async () => {
          // Phase A — cheap metadata/MD5 detectors surface in seconds.
          set({ stage: "metadata" });
          for (let i = 0; i < cheapDetectors.length; i++) {
            if (token !== runToken) return;
            const start = (CHEAP_END * i) / cheapDetectors.length;
            const end = (CHEAP_END * (i + 1)) / cheapDetectors.length;
            await runDetector(cheapDetectors[i], start, end, i + 1);
          }

          // Phase B — ONE concurrent single-decode sweep warms the photo feature
          // cache (the bulk of the work; resume skips already-cached photos).
          if (token !== runToken) return;
          set({ stage: "analyzing", activeDetectorKey: undefined, activeIndex: cheapDetectors.length });
          updateScanNotification(cheapDetectors.length, total, CHEAP_END);
          await prewarmPhotoFeatures(assets, signal, (fraction, analyzed, analyzeTotal) => {
            if (token !== runToken) return;
            const p = CHEAP_END + (PREPASS_END - CHEAP_END) * fraction;
            set({ progress: p, analyzed, analyzeTotal });
            throttledNotify(cheapDetectors.length, total, p);
          });

          // Phase C — pixel detectors now read the warm cache and surface together.
          if (token !== runToken) return;
          set({ stage: "grouping" });
          for (let i = 0; i < pixelDetectors.length; i++) {
            if (token !== runToken) return;
            const start = PREPASS_END + ((1 - PREPASS_END) * i) / pixelDetectors.length;
            const end = PREPASS_END + ((1 - PREPASS_END) * (i + 1)) / pixelDetectors.length;
            await runDetector(pixelDetectors[i], start, end, cheapDetectors.length + i + 1);
          }

          if (token !== runToken) return;
          set({
            phase: "complete",
            activeDetectorKey: undefined,
            activeIndex: total,
            stage: undefined,
            progress: 1,
            lastRunAt: Date.now(),
            resultsByKey: { ...acc }
          });
        };

        // Acquire the foreground service only if the singleton is free (compression
        // not running). Otherwise run plain-JS and still checkpoint.
        const useService = Platform.OS === "android" && !BackgroundSmartCleanScanWorker.isRunning();

        runPromise = (async () => {
          if (useService) {
            serviceHeld = true;
            try {
              await BackgroundSmartCleanScanWorker.run(i18n.t("smartClean.title"), scanBody);
            } finally {
              // Stop ONLY if the scan still owns the service. If compression took it
              // mid-scan (releaseForegroundService cleared serviceHeld), an
              // unconditional stop() here would tear down COMPRESSION's service —
              // BackgroundService.stop() is global across both tasks.
              if (serviceHeld) {
                serviceHeld = false;
                await BackgroundSmartCleanScanWorker.stop();
              }
            }
          } else {
            await scanBody();
          }
        })()
          .catch((error) => {
            if (token === runToken) {
              set({ phase: "error", activeDetectorKey: undefined, error: error instanceof Error ? error.message : "Scan failed." });
            }
          })
          .finally(() => {
            if (token === runToken) runPromise = undefined;
            dismissAllScanNotifications();
          });

        return runPromise;
      },

      async releaseForegroundService() {
        // Compression has priority and is about to acquire the singleton service.
        // Drop it if the scan holds it; the scan keeps running as plain JS and its
        // notifications fall back to the expo-notifications path.
        if (!serviceHeld) return;
        serviceHeld = false;
        await BackgroundSmartCleanScanWorker.stop();
      },

      cancel() {
        controller?.abort();
        runToken += 1;
        runPromise = undefined;
        const wasHeld = serviceHeld;
        serviceHeld = false;
        if (wasHeld) void BackgroundSmartCleanScanWorker.stop();
        dismissAllScanNotifications();
        // Manual stop → phase "idle" (NOT "interrupted") so it does not auto-resume
        // on next launch. Completed detectors' results stay visible.
        set({ phase: "idle", activeDetectorKey: undefined, activeIndex: 0, stage: undefined });
      },

      reset() {
        controller?.abort();
        runToken += 1;
        runPromise = undefined;
        const wasHeld = serviceHeld;
        serviceHeld = false;
        if (wasHeld) void BackgroundSmartCleanScanWorker.stop();
        dismissAllScanNotifications();
        set({
          phase: "idle",
          activeDetectorKey: undefined,
          activeIndex: 0,
          stage: undefined,
          analyzed: 0,
          analyzeTotal: 0,
          progress: 0,
          resultsByKey: {},
          restoredCompact: null,
          runSignature: undefined,
          lastRunAt: undefined,
          lastCheckpointAt: undefined,
          error: undefined
        });
      }
    }),
    {
      name: "swipeclean-smart-clean-results",
      storage: createJSONStorage(() => createDebouncedStorage(800)),
      partialize: (state): PersistedShape => ({
        // Before expansion, persist the still-compact restored form unchanged so a
        // pre-hydration write can't overwrite good results with an empty set.
        resultsCompact: state.restoredCompact ?? compactResults(state.resultsByKey),
        runSignature: state.runSignature,
        // A scan in flight persists as "interrupted" so the next launch resumes it.
        // error/idle/scanning(non-resumable) → "idle"; complete/interrupted kept.
        phase: state.phase === "scanning" || state.phase === "interrupted" ? "interrupted" : state.phase === "complete" ? "complete" : "idle",
        lastRunAt: state.lastRunAt
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedShape>;
        return {
          ...currentState,
          restoredCompact: persisted.resultsCompact ?? null,
          runSignature: persisted.runSignature,
          phase: normalizePersistedPhase(persisted.phase),
          lastRunAt: persisted.lastRunAt
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Failed to rehydrate smart-clean results", error);
        }
        (state ?? useSmartCleanStore.getState()).setHasHydrated(true);
      }
    }
  )
);
