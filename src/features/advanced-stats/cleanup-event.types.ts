/**
 * Advanced-stats event model (Pro).
 *
 * A small, flat, primitive-only analytics ledger of cleanup activity. No URIs,
 * filenames, or media objects are stored — just enough to derive the weekly /
 * monthly / trend / history reports. Kept lightweight so the persisted store
 * stays small (see EVENT_CAP in cleanup-events-store.ts).
 */

export type CleanupEventType =
  | "itemDeleted"
  | "itemCompressed"
  | "originalDeletedAfterCompression"
  | "compressionFailed"
  | "smartCleanSuggestionViewed"
  | "smartCleanActionConfirmed";

export type CleanupEventMediaType = "photo" | "video" | "unknown";

export type CleanupEvent = {
  id: string; // `${at}-${seq}` — collision-safe within the same millisecond
  type: CleanupEventType;
  at: number; // epoch ms
  bytes?: number; // reclaimed / saved bytes; treated as 0 when absent
  count?: number; // items represented (batched); treated as 1 when absent
  mediaType?: CleanupEventMediaType;
  detectorKey?: string; // smart-clean events only
};

/** Input accepted by recordEvent — id/at are filled in by the store. */
export type CleanupEventInput = Omit<CleanupEvent, "id" | "at"> & { at?: number };

export type CleanupReport = {
  deletedCount: number;
  deletedBytes: number;
  compressedCount: number;
  savedBytes: number;
  originalsDeletedCount: number;
  originalsDeletedBytes: number;
  failedCount: number;
};

export type StorageTrendBucket = {
  /** Whole weeks before "now" (0 = current week). The UI localizes the label. */
  weeksAgo: number;
  reclaimedBytes: number;
};
