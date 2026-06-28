import { AppStateStatus } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getJobByMediaId as selectJobByMediaId, isActiveConversionJob } from "@/features/convert/convert.selectors";
import { convertMediaJob } from "@/features/convert/convert.service";
import { ConversionJob, ConversionJobInput, ConversionResult } from "@/features/convert/convert.types";
import { createDebouncedStorage } from "@/utils/debounced-storage";

/**
 * Conversion job runner — a trimmed mirror of useCompressionStore. It keeps the
 * generic queue/runner/persistence but DROPS the compression-only machinery
 * (keep/delete-original, App-Lock gate, app-store/compressedMedia coupling,
 * interstitial ads): conversion is non-destructive and produces a fresh artifact.
 */
type ConvertStore = {
  jobs: Record<string, ConversionJob>;
  jobIdByMediaId: Record<string, string>;
  completedMediaIds: Record<string, true>;
  activeJobId?: string;
  lastFinishedJobId?: string;
  lastErrorMessage?: string;
  queue: string[];
  enqueueConversion: (jobInput: ConversionJobInput) => Promise<string | undefined>;
  enqueueBatch: (inputs: ConversionJobInput[]) => string;
  retryJob: (jobId: string) => void;
  startNextJob: () => Promise<void>;
  updateProgress: (jobId: string, progress: number) => boolean;
  markCompleted: (jobId: string, result: ConversionResult) => void;
  markFailed: (jobId: string, error: unknown) => void;
  cancelJob: (jobId: string) => Promise<void>;
  getJobByMediaId: (mediaId?: string) => ConversionJob | undefined;
  isMediaConverting: (mediaId?: string) => boolean;
  isMediaQueued: (mediaId?: string) => boolean;
  isMediaConverted: (mediaId?: string) => boolean;
  resetCompletedJob: (jobId: string) => void;
  resumePendingJobs: () => Promise<void>;
  handleAppStateChange: (state: AppStateStatus) => void;
};

let runnerPromise: Promise<void> | undefined;

export const useConvertStore = create<ConvertStore>()(
  persist(
    (set, get) => ({
      jobs: {},
      jobIdByMediaId: {},
      completedMediaIds: {},
      activeJobId: undefined,
      lastFinishedJobId: undefined,
      lastErrorMessage: undefined,
      queue: [],

      async enqueueConversion(jobInput) {
        const existing = getJobForMedia(get(), jobInput.mediaId);
        // A new target on the same media should start a fresh job, so only short-
        // circuit while a job for this media is still running.
        if (existing && isActiveConversionJob(existing) && existing.target === jobInput.target) {
          return existing.id;
        }

        const job = createConversionJob(jobInput);
        set((state) => ({
          jobs: { ...state.jobs, [job.id]: job },
          jobIdByMediaId: { ...state.jobIdByMediaId, [job.mediaId]: job.id },
          queue: state.queue.includes(job.id) ? state.queue : [...state.queue, job.id]
        }));
        void get().startNextJob();
        return job.id;
      },

      enqueueBatch(inputs) {
        // One shared batchId; cap at 5; push every job in a single state update so
        // the existing serial runner drains them FIFO, one at a time.
        const batchId = `batch-${Date.now()}`;
        const created = inputs.slice(0, 5).map((input) => createConversionJob({ ...input, batchId }));
        set((state) => {
          const jobs = { ...state.jobs };
          const jobIdByMediaId = { ...state.jobIdByMediaId };
          const queue = [...state.queue];
          for (const job of created) {
            jobs[job.id] = job;
            jobIdByMediaId[job.mediaId] = job.id;
            if (!queue.includes(job.id)) queue.push(job.id);
          }
          return { jobs, jobIdByMediaId, queue };
        });
        void get().startNextJob();
        return batchId;
      },

      // Re-run a failed job, PRESERVING its batchId so the retried item stays in
      // the same batch view. Reset the old terminal entry first so the batch list
      // shows a single row for that media rather than the failed + retry pair.
      retryJob(jobId) {
        const job = get().jobs[jobId];
        if (!job) return;
        const input: ConversionJobInput = {
          batchId: job.batchId,
          mediaId: job.mediaId,
          uri: job.uri,
          fileName: job.fileName,
          inputKind: job.inputKind,
          target: job.target,
          outputKind: job.outputKind,
          width: job.width,
          height: job.height,
          duration: job.duration,
          originalSizeBytes: job.originalSizeBytes
        };
        get().resetCompletedJob(jobId);
        void get().enqueueConversion(input);
      },

      async startNextJob() {
        if (runnerPromise || get().activeJobId) {
          await runnerPromise;
          return;
        }

        const nextJobId = get().queue[0];
        if (!nextJobId) return;

        runnerPromise = runConversionJob(nextJobId).finally(() => {
          runnerPromise = undefined;
          if (!get().activeJobId && get().queue.length > 0) {
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
          if (job.status === "converting" && job.progress === clampedProgress) return state;
          changed = true;
          return {
            jobs: { ...state.jobs, [jobId]: { ...job, status: "converting", progress: clampedProgress } }
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
                outputSizeBytes: result.outputSizeBytes,
                libraryAssetId: result.libraryAssetId,
                savedToFile: result.savedToFile,
                errorMessage: undefined
              }
            }
          };
        });
      },

      markFailed(jobId, error) {
        const code = classifyConvertError(error);
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === "cancelled") return {};
          return {
            activeJobId: state.activeJobId === jobId ? undefined : state.activeJobId,
            lastFinishedJobId: jobId,
            lastErrorMessage: code,
            jobs: {
              ...state.jobs,
              [jobId]: { ...job, status: "failed", progress: 0, completedAt: Date.now(), errorMessage: code }
            }
          };
        });
      },

      async cancelJob(jobId) {
        const job = get().jobs[jobId];
        if (!job) return;
        set((state) => ({
          activeJobId: state.activeJobId === jobId ? undefined : state.activeJobId,
          queue: state.queue.filter((id) => id !== jobId),
          jobs: {
            ...state.jobs,
            [jobId]: { ...job, status: "cancelled", completedAt: Date.now(), errorMessage: undefined }
          }
        }));
      },

      getJobByMediaId(mediaId) {
        return getJobForMedia(get(), mediaId);
      },

      isMediaConverting(mediaId) {
        return getJobForMedia(get(), mediaId)?.status === "converting";
      },

      isMediaQueued(mediaId) {
        return getJobForMedia(get(), mediaId)?.status === "queued";
      },

      isMediaConverted(mediaId) {
        return getJobForMedia(get(), mediaId)?.status === "completed";
      },

      resetCompletedJob(jobId) {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === "queued" || job.status === "preparing" || job.status === "converting") return state;
          const { [jobId]: _removed, ...jobs } = state.jobs;
          const nextIndex = { ...state.jobIdByMediaId };
          const nextCompletedMediaIds = { ...state.completedMediaIds };
          if (nextIndex[job.mediaId] === jobId) delete nextIndex[job.mediaId];
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
        const state = get();
        const activeJob = state.activeJobId ? state.jobs[state.activeJobId] : undefined;
        // A job left "active" across a restart was interrupted — fail it so the
        // UI doesn't hang on a spinner that will never resolve.
        if (activeJob) {
          get().markFailed(activeJob.id, new Error("Conversion was interrupted. Please try again."));
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
      name: "swipeclean-convert-store",
      storage: createJSONStorage(() => createDebouncedStorage(900)),
      onRehydrateStorage: () => (state) => {
        void state?.resumePendingJobs();
      },
      partialize: (state) => ({
        jobs: state.jobs,
        jobIdByMediaId: state.jobIdByMediaId,
        completedMediaIds: state.completedMediaIds,
        activeJobId: state.activeJobId,
        lastFinishedJobId: state.lastFinishedJobId,
        lastErrorMessage: state.lastErrorMessage,
        queue: state.queue
      })
    }
  )
);

// Matches the compression runner — throttle mid-encode progress to ~4/sec so a
// long video doesn't re-render the screen on every native tick.
const PROGRESS_THROTTLE_MS = 250;

async function runConversionJob(jobId: string) {
  const startedAt = Date.now();
  let lastProgressEmitAt = 0;
  useConvertStore.setState((state) => {
    const job = state.jobs[jobId];
    if (!job) return {};
    return {
      activeJobId: jobId,
      queue: state.queue.filter((id) => id !== jobId),
      jobs: {
        ...state.jobs,
        [jobId]: { ...job, status: "preparing", progress: 0, startedAt, errorMessage: undefined }
      }
    };
  });

  const job = useConvertStore.getState().jobs[jobId];
  if (!job) return;

  try {
    useConvertStore.getState().updateProgress(jobId, 0);
    await convertMediaJob(job, {
      onProgress: (progress) => {
        const now = Date.now();
        const isEdge = progress <= 0.001 || progress >= 0.95;
        if (!isEdge && now - lastProgressEmitAt < PROGRESS_THROTTLE_MS) return;
        lastProgressEmitAt = now;
        useConvertStore.getState().updateProgress(jobId, progress);
      },
      onCompleted: (result) => {
        useConvertStore.getState().markCompleted(jobId, result);
      },
      onError: (error) => {
        useConvertStore.getState().markFailed(jobId, error);
      }
    });
  } catch (error) {
    const currentJob = useConvertStore.getState().jobs[jobId];
    if (currentJob?.status !== "failed") {
      useConvertStore.getState().markFailed(jobId, error);
    }
  }
}

function createConversionJob(input: ConversionJobInput): ConversionJob {
  const createdAt = Date.now();
  const safeName = input.fileName?.trim() || (input.inputKind === "video" ? "Video" : "Photo");
  return {
    id: `${input.mediaId}-${createdAt}`,
    batchId: input.batchId,
    mediaId: input.mediaId,
    uri: input.uri,
    fileName: safeName,
    inputKind: input.inputKind,
    target: input.target,
    outputKind: input.outputKind,
    status: "queued",
    progress: 0,
    width: input.width,
    height: input.height,
    duration: input.duration,
    originalSizeBytes: input.originalSizeBytes,
    createdAt
  };
}

function getJobForMedia(state: Pick<ConvertStore, "jobs" | "jobIdByMediaId">, mediaId?: string) {
  if (!mediaId) return undefined;
  const indexedJobId = state.jobIdByMediaId[mediaId];
  const indexedJob = indexedJobId ? state.jobs[indexedJobId] : undefined;
  return indexedJob ?? selectJobByMediaId(state.jobs, mediaId);
}

/**
 * Maps an engine/service error to a stable code the UI localizes
 * (`convert.errors.<code>`). Keeping the code (not an English string) in the
 * store lets the run screen render it in the user's language.
 */
function classifyConvertError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/audio-extract-unavailable|image-manipulator-unavailable/i.test(message)) return "unavailable";
  if (/convert-save-failed/i.test(message)) return "saveFailed";
  if (/convert-output-invalid/i.test(message)) return "output";
  if (/cancel/i.test(message)) return "cancelled";
  if (/eacces|denied|permission|securityexception|open failed|filenotfound/i.test(message)) return "permission";
  if (/space|storage|disk/i.test(message)) return "space";
  if (/format|codec|unsupported/i.test(message)) return "format";
  return "generic";
}
