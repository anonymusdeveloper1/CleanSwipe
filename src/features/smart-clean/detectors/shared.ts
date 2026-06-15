import * as MediaLibrary from "expo-media-library";
import { PhotoAsset } from "@/models/photo";
import { getOriginalBytes } from "@/services/compression-service";
import { SmartCleanDetectorKey, SmartCleanGroup, SmartCleanItem, SmartCleanResult } from "@/features/smart-clean/smart-clean.types";

/** Cooperative yield budget — matches media-index-store's scan loop. */
export const SCAN_YIELD_MS = 28;

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("Smart Clean scan aborted");
    error.name = "AbortError";
    throw error;
  }
}

/** Stable invalidation key for the feature cache (same fallback on read+write). */
export function modKeyOf(asset: PhotoAsset): number {
  return asset.modificationTime ?? asset.creationTime ?? 0;
}

/** Best-effort original byte size (never raw asset.sizeBytes which is often undefined). */
export function sizeOf(asset: PhotoAsset): number {
  return getOriginalBytes(asset);
}

export function toItem(asset: PhotoAsset): SmartCleanItem {
  return { mediaId: asset.id, uri: asset.uri, sizeBytes: sizeOf(asset), mediaType: asset.mediaType ?? "unknown" };
}

/**
 * Resolve a readable local file URI for native ops (md5 / manipulate /
 * thumbnail). content:// MediaLibrary URIs lack extensions and can't be read
 * directly; getAssetInfoAsync gives a localUri. Mirrors compression-service.
 */
export async function resolveReadableUri(asset: PhotoAsset): Promise<string> {
  if (!asset.id || asset.id.startsWith("demo-")) return asset.uri;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id);
    return info?.localUri ?? asset.uri;
  } catch {
    return asset.uri;
  }
}

/**
 * Iterate with cooperative yields + abort checks + progress. Heavy (pixel)
 * detectors use a small batchSize; metadata detectors a large one.
 */
export async function forEachYielding<T>(
  items: T[],
  batchSize: number,
  signal: AbortSignal | undefined,
  perItem: (item: T, index: number) => Promise<void> | void,
  onProgress?: (progress: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    throwIfAborted(signal);
    await perItem(items[i], i);
    if ((i + 1) % batchSize === 0) {
      onProgress?.((i + 1) / items.length);
      await sleep(SCAN_YIELD_MS);
    }
  }
  onProgress?.(1);
}

/**
 * Run `worker` over `items` with BOUNDED CONCURRENCY (up to `limit` in flight),
 * yielding cooperatively and reporting progress. This is how the photo pre-pass
 * overlaps the native decodes of several assets at once instead of awaiting them
 * one-by-one. Aborts promptly when the signal fires; a worker that throws is the
 * caller's concern (the pre-pass swallows per-asset failures), so one bad asset
 * never rejects the whole batch.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  signal: AbortSignal | undefined,
  worker: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const total = items.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return;
  }
  let next = 0;
  let done = 0;
  const lane = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) return;
      const index = next++;
      if (index >= total) return;
      await worker(items[index], index);
      done += 1;
      if (done % 8 === 0 || done === total) {
        onProgress?.(done, total);
        await sleep(SCAN_YIELD_MS);
      }
    }
  };
  const lanes = Math.min(Math.max(1, limit), total);
  await Promise.all(Array.from({ length: lanes }, () => lane()));
  onProgress?.(done, total);
}

/**
 * Derive status + itemCount + estimatedReclaimableBytes from groups. Candidates
 * are every item EXCEPT each group's keeper (keepMediaId). For keeper-less
 * detectors every item is a candidate.
 */
export function finalizeResult(key: SmartCleanDetectorKey, groups: SmartCleanGroup[]): SmartCleanResult {
  let candidateCount = 0;
  let bytes = 0;
  for (const group of groups) {
    for (const item of group.items) {
      if (group.keepMediaId && item.mediaId === group.keepMediaId) continue;
      candidateCount += 1;
      bytes += item.sizeBytes ?? 0;
    }
  }
  return {
    key,
    status: candidateCount > 0 ? "ready" : "empty",
    groups,
    itemCount: candidateCount,
    estimatedReclaimableBytes: bytes
  };
}

export const notAvailable = (key: SmartCleanDetectorKey): SmartCleanResult => ({
  key,
  status: "not_available",
  groups: [],
  itemCount: undefined,
  estimatedReclaimableBytes: undefined
});
