import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppStateStatus } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { deleteCompressedMediaCopy, deleteOriginalMedia } from "@/features/compression/compression-deletion.service";
import { compressMediaJob } from "@/features/compression/compression.service";
import { getJobByMediaId as selectJobByMediaId, isActiveCompressionJob } from "@/features/compression/compression.selectors";
import { CompressionBatch, CompressionBatchInput, CompressionJob, CompressionJobInput, CompressionResult } from "@/features/compression/compression.types";
import { CompressionNotifications } from "@/features/compression/compression.notifications";
import { InterstitialAdService } from "@/features/ads/interstitial.service";
import { useSmartCleanStore } from "@/features/smart-clean/smart-clean-store";
import { useAppStore } from "@/store/app-store";
import { recordCleanupEvent } from "@/store/cleanup-events-store";
import { useMediaIndexStore } from "@/store/media-index-store";

type CompressionStore = {
  jobs: Record<string, CompressionJob>;
  jobIdByMediaId: Record<string, string>;
  completedMediaIds: Record<string, true>;
  batches: Record<string, CompressionBatch>;
  activeJobId?: string;
  lastFinishedJobId?: string;
  lastErrorMessage?: string;
  queue: string[];
  paused: boolean;
  enqueueCompression: (jobInput: CompressionJobInput) => Promise<string | undefined>;
  enqueueCompressionBatch: (batchInput: CompressionBatchInput) => Promise<string[]>;
  startNextJob: () => Promise<void>;
  updateProgress: (jobId: string, progress: number) => boolean;
  markCompleted: (jobId: string, result: CompressionResult) => void;
  markFailed: (jobId: string, error: unknown) => void;
  cancelJob: (jobId: string) => Promise<void>;
  pauseCompression: () => void;
  resumeCompression: () => void;
  stopCompression: () => Promise<void>;
  requestOriginalDeletionDecision: (jobId: string) => void;
  deferOriginalDecision: (jobId: string) => void;
  keepOriginal: (jobId: string) => Promise<void>;
  deleteOriginal: (jobId: string) => Promise<void>;
  deleteCompressedCopy: (jobId: string) => Promise<void>;
  markOriginalDeleted: (jobId: string) => void;
  markOriginalDeleteFailed: (jobId: string, error: string) => void;
  dismissCompletionPrompt: (jobId: string) => void;
  deleteAllOriginals: (batchId: string) => Promise<void>;
  keepAllOriginals: (batchId: string) => Promise<void>;
  reviewBatchItems: (batchId: string) => void;
  dismissBatchPrompt: (batchId: string) => void;
  getJobByMediaId: (mediaId?: string) => CompressionJob | undefined;
  isMediaCompressing: (mediaId?: string) => boolean;
  isMediaQueued: (mediaId?: string) => boolean;
  isMediaCompleted: (mediaId?: string) => boolean;
  dismissInAppBanner: (jobId: string) => void;
  resetCompletedJob: (jobId: string) => void;
  resumePendingJobs: () => Promise<void>;
  handleAppStateChange: (state: AppStateStatus) => void;
};

let runnerPromise: Promise<void> | undefined;

export const useCompressionStore = create<CompressionStore>()(
  persist(
    (set, get) => ({
      jobs: {},
      jobIdByMediaId: {},
      completedMediaIds: {},
      batches: {},
      activeJobId: undefined,
      lastFinishedJobId: undefined,
      lastErrorMessage: undefined,
      queue: [],
      paused: false,

      async enqueueCompression(jobInput) {
        await CompressionNotifications.requestPermission();
        const existing = getJobForMedia(get(), jobInput.mediaId);
        if (existing && (isActiveCompressionJob(existing) || existing.status === "completed")) {
          return existing.id;
        }

        const job = createCompressionJob(jobInput);
        set((state) => ({
          jobs: { ...state.jobs, [job.id]: job },
          jobIdByMediaId: { ...state.jobIdByMediaId, [job.mediaId]: job.id },
          queue: state.queue.includes(job.id) ? state.queue : [...state.queue, job.id]
        }));
        void get().startNextJob();
        return job.id;
      },

      async enqueueCompressionBatch({ jobs, quality, originalPolicy = "ask" }) {
        await CompressionNotifications.requestPermission();
        const compressedSourceIds = new Set(useAppStore.getState().compressedMedia.map((item) => item.sourceId));
        const state = get();
        const seenMediaIds = new Set<string>();
        const inputs = jobs
          .filter((input) => !compressedSourceIds.has(input.mediaId))
          .filter((input) => {
            if (seenMediaIds.has(input.mediaId)) return false;
            seenMediaIds.add(input.mediaId);
            const existing = getJobForMedia(state, input.mediaId);
            return !(existing && (isActiveCompressionJob(existing) || existing.status === "completed"));
          });

        if (inputs.length === 0) return [];

        const batchId = `batch-${Date.now()}`;
        const batchJobs = inputs.map((input, index) =>
          createCompressionJob(
            {
              ...input,
              quality
            },
            {
              batchId,
              queuePosition: index + 1,
              queueTotal: inputs.length
            }
          )
        );

        set((current) => ({
          batches: {
            ...current.batches,
            [batchId]: {
              id: batchId,
              jobIds: batchJobs.map((job) => job.id),
              status: "active",
              totalOriginalSizeBytes: batchJobs.reduce((sum, job) => sum + (job.originalSizeBytes ?? 0), 0),
              totalFinalSizeBytes: 0,
              totalSavedBytes: 0,
              completedCount: 0,
              failedCount: 0,
              shouldAskDeleteOriginals: false,
              originalPolicy
            }
          },
          jobs: batchJobs.reduce(
            (nextJobs, job) => ({
              ...nextJobs,
              [job.id]: job
            }),
            current.jobs
          ),
          jobIdByMediaId: batchJobs.reduce(
            (nextIndex, job) => ({
              ...nextIndex,
              [job.mediaId]: job.id
            }),
            current.jobIdByMediaId
          ),
          queue: [...current.queue, ...batchJobs.map((job) => job.id)]
        }));
        void get().startNextJob();
        return batchJobs.map((job) => job.id);
      },

      async startNextJob() {
        if (get().paused) return;
        if (runnerPromise || get().activeJobId) {
          await runnerPromise;
          return;
        }

        const nextJobId = get().queue[0];
        if (!nextJobId) return;

        runnerPromise = runCompressionJob(nextJobId).finally(() => {
          runnerPromise = undefined;
          if (!get().paused && !get().activeJobId && get().queue.length > 0) {
            void get().startNextJob();
          }
        });
        await runnerPromise;
      },

      updateProgress(jobId, progress) {
        const clampedProgress = Math.round(Math.max(0, Math.min(progress, 1)) * 100) / 100;
        let changed = false;
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === "cancelled" || job.status === "completed") return state;
          const nextStatus = "compressing";
          if (job.status === nextStatus && job.progress === clampedProgress) return state;
          changed = true;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                status: nextStatus,
                progress: clampedProgress
              }
            }
          };
        });
        return changed;
      },

      markCompleted(jobId, result) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === "cancelled") return {};
          return {
            activeJobId: state.activeJobId === jobId ? undefined : state.activeJobId,
            lastFinishedJobId: jobId,
            lastErrorMessage: undefined,
            completedMediaIds: { ...state.completedMediaIds, [job.mediaId]: true },
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                status: "completed",
                progress: 1,
                completedAt: Date.now(),
                outputUri: result.outputUri,
                tempOutputUri: result.tempOutputUri,
                finalSizeBytes: result.finalSizeBytes,
                savedBytes: result.savedBytes,
                libraryAssetId: result.libraryAssetId,
                compressedItemId: result.item.id,
                originalAction: "not_required",
                shouldAskDeleteOriginal: false,
                errorMessage: undefined
              }
            }
          };
        });

        useAppStore.setState((state) => ({
          compressedMedia: [result.item, ...state.compressedMedia.filter((item) => item.sourceId !== result.item.sourceId)]
        }));
        applyPostCompressionPolicy(jobId);
        refreshBatchSummary(jobId);
        // Advanced-stats ledger. Guard on the POST-set status: the set() above
        // early-returns for cancelled jobs, so a cancelled job must not count.
        const completedJob = get().jobs[jobId];
        if (completedJob && completedJob.status === "completed") {
          recordCleanupEvent({ type: "itemCompressed", count: 1, bytes: result.savedBytes ?? 0, mediaType: completedJob.mediaType });
          // Monetize Free users after a successful compression. Self-gating:
          // no-op for Pro, and the shared full-screen-ad cooldown skips it right
          // after a rewarded video or an already-shown interstitial.
          InterstitialAdService.maybeShow();
        }
      },

      requestOriginalDeletionDecision(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status !== "completed") return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                originalAction: "pending_decision",
                shouldAskDeleteOriginal: true,
                originalDeleteError: undefined
              }
            }
          };
        });
      },

      async keepOriginal(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                originalAction: "keep_original",
                shouldAskDeleteOriginal: false,
                originalDeleteError: undefined
              }
            }
          };
        });
      },

      // Dismisses the global completion prompt without making a keep/delete
      // decision. The job stays in "pending_decision" so the choice is still
      // available later from the compression detail screen.
      deferOriginalDecision(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.originalAction !== "pending_decision") return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                shouldAskDeleteOriginal: false
              }
            }
          };
        });
      },

      async deleteOriginal(jobId) {
        const job = get().jobs[jobId];
        if (!job || job.status !== "completed") return;
        // Defense-in-depth: never delete an original unless a verified, durably
        // saved compressed copy exists AND it actually reclaimed space.
        if (!job.outputUri || !job.finalSizeBytes || job.finalSizeBytes <= 0 || !job.libraryAssetId) {
          get().markOriginalDeleteFailed(jobId, "The compressed copy could not be verified or saved. Your original file was not changed.");
          return;
        }
        if ((job.savedBytes ?? 0) <= 0) {
          get().markOriginalDeleteFailed(jobId, "Compression did not save space, so the original was kept.");
          return;
        }

        set((state) => ({
          jobs: {
            ...state.jobs,
            [jobId]: {
              ...job,
              originalAction: "delete_original",
              originalDeleteError: undefined
            }
          }
        }));

        try {
          await deleteOriginalMedia({ uri: job.uri, mediaId: job.mediaId, mediaType: job.mediaType });
          get().markOriginalDeleted(jobId);
        } catch (error) {
          get().markOriginalDeleteFailed(jobId, error instanceof Error ? error.message : "Could not delete original.");
        }
      },

      async deleteCompressedCopy(jobId) {
        const job = get().jobs[jobId];
        if (!job) return;
        try {
          await deleteCompressedMediaCopy(job.libraryAssetId);
          set((state) => ({
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                originalAction: "compressed_deleted",
                shouldAskDeleteOriginal: false,
                originalDeleteError: undefined
              }
            },
            completedMediaIds: withoutKey(state.completedMediaIds, job.mediaId)
          }));
          useAppStore.setState((state) => ({
            compressedMedia: state.compressedMedia.filter((item) => item.sourceId !== job.mediaId)
          }));
        } catch (error) {
          get().markOriginalDeleteFailed(jobId, error instanceof Error ? error.message : "Could not delete compressed copy.");
        }
      },

      markOriginalDeleted(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                originalAction: "auto_deleted",
                originalDeletedAt: Date.now(),
                originalDeleteError: undefined,
                shouldAskDeleteOriginal: false
              }
            }
          };
        });
        const job = get().jobs[jobId];
        if (job) {
          useAppStore.setState((state) => ({
            photos: state.photos.filter((photo) => photo.id !== job.mediaId),
            reviewedPhotoIds: state.reviewedPhotoIds.filter((id) => id !== job.mediaId),
            markedForDeletion: state.markedForDeletion.filter((item) => item.photoId !== job.mediaId)
          }));
          useMediaIndexStore.getState().removeMediaIds([job.mediaId]);
          // Advanced-stats ledger: verified original deletion after compression.
          recordCleanupEvent({ type: "originalDeletedAfterCompression", count: 1, bytes: job.savedBytes ?? 0, mediaType: job.mediaType });
        }
      },

      markOriginalDeleteFailed(jobId, error) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                originalAction: "delete_failed",
                originalDeleteError: error,
                shouldAskDeleteOriginal: true
              }
            },
            lastErrorMessage: error
          };
        });
      },

      dismissCompletionPrompt(jobId) {
        get().keepOriginal(jobId);
      },

      async deleteAllOriginals(batchId) {
        const batch = get().batches[batchId];
        if (!batch) return;
        const jobs = batch.jobIds.map((id) => get().jobs[id]).filter((job): job is CompressionJob => Boolean(job));
        const deletableJobs = jobs.filter((job) => job.status === "completed" && (job.savedBytes ?? 0) > 0);
        for (const job of deletableJobs) {
          await get().deleteOriginal(job.id);
        }
        get().dismissBatchPrompt(batchId);
      },

      async keepAllOriginals(batchId) {
        const batch = get().batches[batchId];
        if (!batch) return;
        for (const jobId of batch.jobIds) {
          const job = get().jobs[jobId];
          if (job?.status === "completed") {
            await get().keepOriginal(jobId);
          }
        }
        get().dismissBatchPrompt(batchId);
      },

      reviewBatchItems(batchId) {
        const batch = get().batches[batchId];
        if (!batch) return;
        set((state) => ({
          batches: {
            ...state.batches,
            [batchId]: {
              ...batch,
              shouldAskDeleteOriginals: false
            }
          },
          jobs: batch.jobIds.reduce((jobs, jobId) => {
            const job = jobs[jobId];
            if (!job || job.status !== "completed") return jobs;
            return {
              ...jobs,
              [jobId]: {
                ...job,
                originalAction: "pending_decision",
                shouldAskDeleteOriginal: true
              }
            };
          }, state.jobs)
        }));
      },

      dismissBatchPrompt(batchId) {
        set((state) => {
          const batch = state.batches[batchId];
          if (!batch) return state;
          return {
            batches: {
              ...state.batches,
              [batchId]: {
                ...batch,
                shouldAskDeleteOriginals: false
              }
            }
          };
        });
      },

      markFailed(jobId, error) {
        const message = getFriendlyCompressionError(error);
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === "cancelled") return {};
          return {
            activeJobId: state.activeJobId === jobId ? undefined : state.activeJobId,
            lastFinishedJobId: jobId,
            lastErrorMessage: message,
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                status: "failed",
                progress: 0,
                completedAt: Date.now(),
                errorMessage: message
              }
            }
          };
        });
        refreshBatchSummary(jobId);
        // Advanced-stats ledger. POST-set guard so cancelled jobs (whose set()
        // early-returns above) never inflate the failure count.
        const failedJob = get().jobs[jobId];
        if (failedJob && failedJob.status === "failed") {
          recordCleanupEvent({ type: "compressionFailed", count: 1, mediaType: failedJob.mediaType });
        }
      },

      async cancelJob(jobId) {
        const job = get().jobs[jobId];
        if (!job) return;
        const wasActive = get().activeJobId === jobId;
        set((state) => ({
          activeJobId: state.activeJobId === jobId ? undefined : state.activeJobId,
          queue: state.queue.filter((id) => id !== jobId),
          jobs: {
            ...state.jobs,
            [jobId]: {
              ...job,
              status: "cancelled",
              completedAt: Date.now(),
              errorMessage: undefined
            }
          }
        }));
        if (wasActive) {
          await CompressionNotifications.stopActive();
        }
      },

      pauseCompression() {
        // Queued jobs stay queued; the item currently encoding finishes (native
        // image compression can't pause mid-encode), then the loop halts because
        // startNextJob early-returns while `paused`.
        set({ paused: true });
      },

      resumeCompression() {
        set({ paused: false });
        void get().startNextJob();
      },

      async stopCompression() {
        const { activeJobId, queue } = get();
        const ids = [...new Set([activeJobId, ...queue].filter((id): id is string => Boolean(id)))];
        set((state) => {
          const jobs = { ...state.jobs };
          const now = Date.now();
          for (const id of ids) {
            const job = jobs[id];
            if (job && job.status !== "completed") {
              jobs[id] = { ...job, status: "cancelled", completedAt: now, errorMessage: undefined };
            }
          }
          return { jobs, queue: [], activeJobId: undefined, paused: false };
        });
        // Tear down the foreground service + notification. The in-flight native
        // task may still finish, but markCompleted/markFailed ignore a cancelled
        // job, so its result is discarded and the original is never touched.
        await CompressionNotifications.stopActive();
      },

      getJobByMediaId(mediaId) {
        return getJobForMedia(get(), mediaId);
      },

      isMediaCompressing(mediaId) {
        return getJobForMedia(get(), mediaId)?.status === "compressing";
      },

      isMediaQueued(mediaId) {
        return getJobForMedia(get(), mediaId)?.status === "queued";
      },

      isMediaCompleted(mediaId) {
        return getJobForMedia(get(), mediaId)?.status === "completed";
      },

      dismissInAppBanner(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                inAppBannerDismissed: true
              }
            }
          };
        });
      },

      resetCompletedJob(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === "queued" || job.status === "preparing" || job.status === "compressing") return state;
          const { [jobId]: _removed, ...jobs } = state.jobs;
          const nextIndex = { ...state.jobIdByMediaId };
          const nextCompletedMediaIds = { ...state.completedMediaIds };
          if (nextIndex[job.mediaId] === jobId) {
            delete nextIndex[job.mediaId];
          }
          delete nextCompletedMediaIds[job.mediaId];
          return {
            jobs,
            jobIdByMediaId: nextIndex,
            completedMediaIds: nextCompletedMediaIds,
            queue: state.queue.filter((id) => id !== jobId),
            activeJobId: state.activeJobId === jobId ? undefined : state.activeJobId,
            lastFinishedJobId: state.lastFinishedJobId === jobId ? undefined : state.lastFinishedJobId
          };
        });
      },

      async resumePendingJobs() {
        ensureCompressionIndex(get, set);
        const state = get();
        const activeJob = state.activeJobId ? state.jobs[state.activeJobId] : undefined;
        if (activeJob && !CompressionNotifications.isForegroundRunning()) {
          get().markFailed(activeJob.id, new Error("Compression was interrupted. Please try again."));
        }

        if (!get().activeJobId && get().queue.length > 0) {
          await get().startNextJob();
        }
      },

      handleAppStateChange(state) {
        if (state === "active") {
          void get().resumePendingJobs();
        }
      }
    }),
    {
      name: "swipeclean-compression-store",
      storage: createJSONStorage(() => createDebouncedStorage(900)),
      onRehydrateStorage: () => (state) => {
        void state?.resumePendingJobs();
      },
      partialize: (state) => ({
        jobs: state.jobs,
        jobIdByMediaId: state.jobIdByMediaId,
        completedMediaIds: state.completedMediaIds,
        batches: state.batches,
        activeJobId: state.activeJobId,
        lastFinishedJobId: state.lastFinishedJobId,
        lastErrorMessage: state.lastErrorMessage,
        queue: state.queue
      })
    }
  )
);

async function runCompressionJob(jobId: string) {
  const startedAt = Date.now();
  useCompressionStore.setState((state) => {
    const job = state.jobs[jobId];
    if (!job) return {};
    return {
      activeJobId: jobId,
      queue: state.queue.filter((id) => id !== jobId),
      jobs: {
        ...state.jobs,
        [jobId]: {
          ...job,
          status: "preparing",
          progress: 0,
          startedAt,
          inAppBannerDismissed: false,
          errorMessage: undefined
        }
      }
    };
  });

  let completedResult: CompressionResult | undefined;
  const job = useCompressionStore.getState().jobs[jobId];
  if (!job) return;

  // A backgrounded Smart Clean scan holds the singleton foreground service —
  // yield it so this compression job can acquire it. Compression always has
  // priority; the scan continues as plain JS and resumes the service when free.
  await useSmartCleanStore.getState().releaseForegroundService();

  try {
    await CompressionNotifications.runInForeground(job, async () => {
      const activeJob = useCompressionStore.getState().jobs[jobId];
      if (!activeJob) return;

      useCompressionStore.getState().updateProgress(jobId, 0);
      await CompressionNotifications.updateProgress(activeJob, 0);

      await compressMediaJob(activeJob, {
        onProgress: (progress) => {
          useCompressionStore.getState().updateProgress(jobId, progress);
          const notificationJob = useCompressionStore.getState().jobs[jobId];
          if (notificationJob) {
            void CompressionNotifications.updateProgress(notificationJob, progress);
          }
        },
        onCompleted: (result) => {
          completedResult = result;
          useCompressionStore.getState().markCompleted(jobId, result);
        },
        onError: (error) => {
          useCompressionStore.getState().markFailed(jobId, error);
        }
      });
    });

    if (completedResult) {
      await notifyCompletedJob(jobId, completedResult);
    }
  } catch (error) {
    const currentJob = useCompressionStore.getState().jobs[jobId];
    if (currentJob?.status !== "failed") {
      useCompressionStore.getState().markFailed(jobId, error);
    }
    const failedJob = useCompressionStore.getState().jobs[jobId];
    if (failedJob) {
      await CompressionNotifications.showFailed(failedJob, failedJob.errorMessage ?? "We could not compress this file. Please try again.");
    }
  }
}

async function notifyCompletedJob(jobId: string, result: CompressionResult) {
  const state = useCompressionStore.getState();
  const job = state.jobs[jobId];
  if (!job) return;

  if (!job.batchId || !job.queueTotal || job.queueTotal <= 1) {
    await CompressionNotifications.showCompleted(job, result);
    return;
  }

  const batchJobs = Object.values(state.jobs).filter((item) => item.batchId === job.batchId);
  const batchStillRunning = batchJobs.some((item) => item.status === "queued" || item.status === "preparing" || item.status === "compressing");
  if (batchStillRunning) return;

  const completedJobs = batchJobs.filter((item) => item.status === "completed");
  const savedBytes = completedJobs.reduce((sum, item) => sum + (item.savedBytes ?? 0), 0);
  await CompressionNotifications.showQueueCompleted(completedJobs.length, savedBytes);
}

function applyPostCompressionPolicy(jobId: string) {
  const state = useCompressionStore.getState();
  const job = state.jobs[jobId];
  if (!job || job.status !== "completed") return;
  if (job.batchId && job.queueTotal && job.queueTotal > 1) return;

  const policy = useAppStore.getState().settings.afterCompressionOriginalPolicy;
  if (policy === "keep_original") {
    void state.keepOriginal(jobId);
    return;
  }

  if (policy === "delete_original_after_success" && (job.savedBytes ?? 0) > 0) {
    void state.deleteOriginal(jobId);
    return;
  }

  state.requestOriginalDeletionDecision(jobId);
}

function refreshBatchSummary(jobId: string) {
  const state = useCompressionStore.getState();
  const job = state.jobs[jobId];
  if (!job?.batchId) return;

  const batch = state.batches[job.batchId];
  if (!batch) return;

  const batchJobs = batch.jobIds.map((id) => state.jobs[id]).filter((item): item is CompressionJob => Boolean(item));
  const completedJobs = batchJobs.filter((item) => item.status === "completed");
  const failedJobs = batchJobs.filter((item) => item.status === "failed" || item.status === "cancelled");
  const activeJobs = batchJobs.filter((item) => item.status === "queued" || item.status === "preparing" || item.status === "compressing");
  const totalOriginalSizeBytes = completedJobs.reduce((sum, item) => sum + (item.originalSizeBytes ?? 0), 0);
  const totalFinalSizeBytes = completedJobs.reduce((sum, item) => sum + (item.finalSizeBytes ?? 0), 0);
  const totalSavedBytes = completedJobs.reduce((sum, item) => sum + (item.savedBytes ?? 0), 0);
  const completedCount = completedJobs.length;
  const failedCount = failedJobs.length;
  const isDone = activeJobs.length === 0 && completedCount + failedCount === batch.jobIds.length;
  const policy = batch.originalPolicy ?? "ask";
  // Only the legacy "ask" policy defers to the post-batch decision sheet. With an
  // upfront "delete"/"keep" choice we never show the sheet and auto-apply below.
  const askAfterBatch = isDone && completedCount > 0 && policy === "ask";

  useCompressionStore.setState((current) => ({
    batches: {
      ...current.batches,
      [batch.id]: {
        ...batch,
        totalOriginalSizeBytes,
        totalFinalSizeBytes,
        totalSavedBytes,
        completedCount,
        failedCount,
        status: !isDone ? "active" : completedCount === 0 ? "failed" : failedCount > 0 ? "partially_completed" : "completed",
        shouldAskDeleteOriginals: askAfterBatch
      }
    }
  }));

  // Apply the upfront choice once the batch finishes (fires only on the final
  // job's completion/failure, since isDone is reached exactly once). "delete"
  // removes originals of completed jobs that actually saved space; "keep" marks
  // them kept. Both no-op the post-batch prompt.
  if (isDone && completedCount > 0 && policy !== "ask") {
    const store = useCompressionStore.getState();
    if (policy === "delete") void store.deleteAllOriginals(batch.id);
    else void store.keepAllOriginals(batch.id);
  }
}

function createCompressionJob(input: CompressionJobInput, batch?: Pick<CompressionJob, "batchId" | "queuePosition" | "queueTotal">): CompressionJob {
  const createdAt = Date.now();
  const safeName = input.fileName?.trim() || (input.mediaType === "video" ? "Video" : "Photo");
  return {
    id: `${input.mediaId}-${createdAt}`,
    mediaId: input.mediaId,
    uri: input.uri,
    fileName: safeName,
    mediaType: input.mediaType,
    width: input.width,
    height: input.height,
    duration: input.duration,
    monthKey: input.monthKey,
    originalSizeBytes: input.originalSizeBytes,
    estimatedReducedSizeBytes: input.estimatedReducedSizeBytes,
    quality: input.quality,
    status: "queued",
    progress: 0,
    createdAt,
    ...batch
  };
}

function getJobForMedia(state: Pick<CompressionStore, "jobs" | "jobIdByMediaId">, mediaId?: string) {
  if (!mediaId) return undefined;
  const indexedJobId = state.jobIdByMediaId[mediaId];
  const indexedJob = indexedJobId ? state.jobs[indexedJobId] : undefined;
  return indexedJob ?? selectJobByMediaId(state.jobs, mediaId);
}

function ensureCompressionIndex(get: () => CompressionStore, set: (partial: Partial<CompressionStore>) => void) {
  const state = get();
  const jobs = Object.values(state.jobs);
  if (jobs.length === 0) return;

  const nextIndex = { ...state.jobIdByMediaId };
  const nextCompletedMediaIds = { ...state.completedMediaIds };
  let changed = false;
  for (const job of jobs) {
    if (nextIndex[job.mediaId] !== job.id) {
      const existingJob = nextIndex[job.mediaId] ? state.jobs[nextIndex[job.mediaId]] : undefined;
      if (!existingJob || existingJob.createdAt <= job.createdAt) {
        nextIndex[job.mediaId] = job.id;
        changed = true;
      }
    }

    if (job.status === "completed" && !nextCompletedMediaIds[job.mediaId]) {
      nextCompletedMediaIds[job.mediaId] = true;
      changed = true;
    }
  }

  if (changed) {
    set({ jobIdByMediaId: nextIndex, completedMediaIds: nextCompletedMediaIds });
  }
}

function withoutKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function createDebouncedStorage(delayMs: number): StateStorage {
  const pendingWrites: Record<string, string> = {};
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};

  return {
    getItem(name) {
      return AsyncStorage.getItem(name);
    },
    setItem(name, value) {
      pendingWrites[name] = value;
      if (timers[name]) {
        clearTimeout(timers[name]);
      }
      timers[name] = setTimeout(() => {
        const pendingValue = pendingWrites[name];
        delete pendingWrites[name];
        delete timers[name];
        void AsyncStorage.setItem(name, pendingValue).catch(() => undefined);
      }, delayMs);
    },
    removeItem(name) {
      if (timers[name]) {
        clearTimeout(timers[name]);
        delete timers[name];
      }
      delete pendingWrites[name];
      return AsyncStorage.removeItem(name);
    }
  };
}

function getFriendlyCompressionError(error: unknown) {
  const technicalMessage = error instanceof Error ? error.message : String(error);
  // Output wasn't smaller than the source — the file is already efficiently
  // encoded. Check this FIRST: a generic "space" match below would otherwise
  // swallow it. Surfaced as a calm, non-retry message.
  if (/already optimized/i.test(technicalMessage)) {
    return "This video is already optimized, so it was left unchanged — compressing it would not save space.";
  }
  // Scoped-storage / "selected photos only" access: the file can't be read.
  if (/eacces|denied|permission to access|securityexception|filenotfound|open failed/i.test(technicalMessage)) {
    return "SwipeClean can only read your selected photos. Allow access to all photos and videos in Settings, then compress again.";
  }
  if (/permission/i.test(technicalMessage)) return "Permission was denied. Please allow media access and try again.";
  if (/space|storage|disk/i.test(technicalMessage)) return "There is not enough storage space to save the compressed file.";
  if (/format|codec|unsupported/i.test(technicalMessage)) return "This media format is not supported for compression.";
  if (/missing|not found|no such file/i.test(technicalMessage)) return "This file could not be found. It may have been moved or deleted.";
  return "We could not compress this file. Please try again.";
}
