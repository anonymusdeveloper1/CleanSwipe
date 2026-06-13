import { CompressedMediaItem, CompressionQuality } from "@/models/photo";

export type CompressionJobStatus = "queued" | "preparing" | "compressing" | "completed" | "failed" | "cancelled";

export type CompressionMediaType = "photo" | "video";

export type CompressionOriginalAction =
  | "pending_decision"
  | "delete_original"
  | "keep_original"
  | "auto_deleted"
  | "delete_failed"
  | "not_required"
  | "compressed_deleted";

export type CompressionBatchStatus = "active" | "completed" | "failed" | "partially_completed";

export type CompressionJob = {
  id: string;
  mediaId: string;
  uri: string;
  fileName: string;
  mediaType: CompressionMediaType;
  width?: number;
  height?: number;
  duration?: number;
  monthKey?: string;
  originalSizeBytes?: number;
  estimatedReducedSizeBytes?: number;
  finalSizeBytes?: number;
  savedBytes?: number;
  quality: CompressionQuality;
  status: CompressionJobStatus;
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  outputUri?: string;
  tempOutputUri?: string;
  compressedItemId?: string;
  libraryAssetId?: string;
  errorMessage?: string;
  notificationDismissed?: boolean;
  inAppBannerDismissed?: boolean;
  originalAction?: CompressionOriginalAction;
  originalDeletedAt?: number;
  originalDeleteError?: string;
  shouldAskDeleteOriginal?: boolean;
  batchId?: string;
  queuePosition?: number;
  queueTotal?: number;
};

export type CompressionJobInput = {
  mediaId: string;
  uri: string;
  fileName?: string;
  mediaType: CompressionMediaType;
  width?: number;
  height?: number;
  duration?: number;
  monthKey?: string;
  originalSizeBytes?: number;
  estimatedReducedSizeBytes?: number;
  quality: CompressionQuality;
};

export type CompressionBatchInput = {
  jobs: CompressionJobInput[];
  quality: CompressionQuality;
};

export type CompressionResult = {
  item: CompressedMediaItem;
  outputUri: string;
  tempOutputUri?: string;
  originalSizeBytes: number;
  finalSizeBytes: number;
  savedBytes: number;
  compressionRatio: number;
  mediaType: CompressionMediaType;
  libraryAssetId?: string;
};

export type CompressionVerificationResult = {
  isValid: boolean;
  originalSizeBytes: number;
  finalSizeBytes: number;
  savedBytes: number;
  reason?: string;
};

export type CompressionBatch = {
  id: string;
  jobIds: string[];
  status: CompressionBatchStatus;
  totalOriginalSizeBytes: number;
  totalFinalSizeBytes: number;
  totalSavedBytes: number;
  completedCount: number;
  failedCount: number;
  shouldAskDeleteOriginals: boolean;
};
