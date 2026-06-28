import { ConversionJob, ConvertJobStatus } from "@/features/convert/convert.types";

const activeStatuses = new Set<ConvertJobStatus>(["queued", "preparing", "converting"]);

/** Latest job (by createdAt) for a given source media id. */
export function getJobByMediaId(jobs: Record<string, ConversionJob>, mediaId?: string) {
  if (!mediaId) return undefined;
  return Object.values(jobs)
    .filter((job) => job.mediaId === mediaId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function isActiveConversionJob(job?: ConversionJob) {
  return Boolean(job && activeStatuses.has(job.status));
}

export function isMediaConverting(jobs: Record<string, ConversionJob>, mediaId?: string) {
  return getJobByMediaId(jobs, mediaId)?.status === "converting";
}

export function isMediaQueued(jobs: Record<string, ConversionJob>, mediaId?: string) {
  return getJobByMediaId(jobs, mediaId)?.status === "queued";
}

export function isMediaConverted(jobs: Record<string, ConversionJob>, mediaId?: string) {
  return getJobByMediaId(jobs, mediaId)?.status === "completed";
}

/** All jobs in a batch, oldest first (the order they were enqueued). */
export function selectJobsByBatch(jobs: Record<string, ConversionJob>, batchId?: string): ConversionJob[] {
  if (!batchId) return [];
  return Object.values(jobs)
    .filter((job) => job.batchId === batchId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Aggregate progress for a batch: counts + an averaged fraction + a finished flag. */
export function selectBatchProgress(jobs: Record<string, ConversionJob>, batchId?: string) {
  const list = selectJobsByBatch(jobs, batchId);
  const total = list.length;
  const done = list.filter((job) => job.status === "completed").length;
  const failed = list.filter((job) => job.status === "failed" || job.status === "cancelled").length;
  // Count every TERMINAL job (completed/failed/cancelled) as fully resolved so
  // `finished` always implies `fraction === 1` — a failed item shouldn't hold the
  // averaged bar below 100% once the batch is done.
  const sum = list.reduce((acc, job) => acc + (job.status === "completed" || job.status === "failed" || job.status === "cancelled" ? 1 : job.progress), 0);
  return { total, done, failed, fraction: total ? sum / total : 0, finished: total > 0 && done + failed >= total };
}

/** Completed conversions, newest first — the "Recent converted" list source. */
export function selectRecentConvertedJobs(jobs: Record<string, ConversionJob>, limit = 30): ConversionJob[] {
  return Object.values(jobs)
    .filter((job) => job.status === "completed")
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
    .slice(0, limit);
}
