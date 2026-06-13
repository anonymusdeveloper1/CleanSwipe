import { CompressionJob, CompressionJobStatus } from "@/features/compression/compression.types";

const activeStatuses = new Set<CompressionJobStatus>(["queued", "preparing", "compressing"]);

export function getJobByMediaId(jobs: Record<string, CompressionJob>, mediaId?: string) {
  if (!mediaId) return undefined;
  return Object.values(jobs)
    .filter((job) => job.mediaId === mediaId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function isActiveCompressionJob(job?: CompressionJob) {
  return Boolean(job && activeStatuses.has(job.status));
}

export function isMediaCompressing(jobs: Record<string, CompressionJob>, mediaId?: string) {
  return getJobByMediaId(jobs, mediaId)?.status === "compressing";
}

export function isMediaQueued(jobs: Record<string, CompressionJob>, mediaId?: string) {
  return getJobByMediaId(jobs, mediaId)?.status === "queued";
}

export function isMediaCompleted(jobs: Record<string, CompressionJob>, mediaId?: string) {
  return getJobByMediaId(jobs, mediaId)?.status === "completed";
}

export function hasDuplicateCompressionJob(jobs: Record<string, CompressionJob>, mediaId: string) {
  return isActiveCompressionJob(getJobByMediaId(jobs, mediaId));
}
