import { IndexedMediaAsset } from "@/store/media-index-store";
import { featureCacheApi } from "@/features/smart-clean/feature-cache-store";
import { probeCapability } from "@/features/smart-clean/native-capabilities";
import { computeGrayFeatures } from "@/features/smart-clean/detectors/image-pipeline";
import { mapWithConcurrency, modKeyOf, resolveReadableUri } from "@/features/smart-clean/detectors/shared";

/** How many photo decodes overlap at once. Bounded so the JS thread stays free. */
export const PRE_PASS_CONCURRENCY = 4;

/**
 * Concurrent SINGLE-DECODE sweep that warms the feature cache (dHash + blurVar)
 * for every photo missing them. After it runs, the similar + blurry detectors are
 * pure cache hits, so all photo categories surface together instead of one-by-one
 * — this is the "parallel" scan. Decodes overlap up to {@link PRE_PASS_CONCURRENCY}.
 *
 * - No-op when the imageManipulator capability is absent (the pixel detectors
 *   then degrade to "not_available", exactly as before).
 * - Already-cached photos (current modKey) are skipped, so an interrupted scan
 *   resumes by finishing only the remaining photos — not re-decoding the library.
 *
 * `onProgress(fraction, analyzed, total)`: fraction is over the REMAINING photos
 * (drives the bar); analyzed/total are over ALL photos (drives the "1,240 / 3,000"
 * label), so the count reflects cache reuse on a resume.
 */
export async function prewarmPhotoFeatures(
  assets: IndexedMediaAsset[],
  signal: AbortSignal | undefined,
  onProgress?: (fraction: number, analyzed: number, total: number) => void
): Promise<void> {
  if (!(await probeCapability("imageManipulator"))) {
    onProgress?.(1, 0, 0);
    return;
  }
  const photos = assets.filter((asset) => asset.mediaType === "photo");
  const pending = photos.filter((asset) => {
    const entry = featureCacheApi.get(asset.id, modKeyOf(asset));
    return !entry || entry.dHash === undefined || entry.blurVar === undefined;
  });
  const alreadyCached = photos.length - pending.length;
  onProgress?.(pending.length === 0 ? 1 : 0, alreadyCached, photos.length);
  if (pending.length === 0) return;

  await mapWithConcurrency(
    pending,
    PRE_PASS_CONCURRENCY,
    signal,
    async (asset) => {
      const modKey = modKeyOf(asset);
      const uri = await resolveReadableUri(asset);
      const features = await computeGrayFeatures(uri);
      if (features) featureCacheApi.upsert(asset.id, modKey, { dHash: features.dHash, blurVar: features.blurVar });
    },
    (done, total) => onProgress?.(total === 0 ? 1 : done / total, alreadyCached + done, photos.length)
  );
}
