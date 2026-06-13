import { IndexedMediaAsset } from "@/store/media-index-store";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { featureCacheApi } from "@/features/smart-clean/feature-cache-store";
import { computeMd5 } from "@/features/smart-clean/file-system-capability";
import { probeCapability } from "@/features/smart-clean/native-capabilities";
import { finalizeResult, forEachYielding, modKeyOf, notAvailable, resolveReadableUri, sizeOf, toItem } from "@/features/smart-clean/detectors/shared";

/**
 * Tier 1 — exact duplicate photos. Candidate pre-filter by (size, dimensions),
 * confirmed by MD5. Requires the `fileHashing` capability (expo-file-system
 * native) — without it we return "not_available" rather than emitting
 * byte+dimension-only "duplicates" (too false-positive-prone to ever delete).
 *
 * keepMediaId = earliest creationTime (the original); tie → larger bytes → id.
 */
function pickOriginal(list: IndexedMediaAsset[]): string {
  return [...list].sort(
    (a, b) =>
      (a.creationTime ?? Number.POSITIVE_INFINITY) - (b.creationTime ?? Number.POSITIVE_INFINITY) ||
      sizeOf(b) - sizeOf(a) ||
      (a.id < b.id ? -1 : 1)
  )[0].id;
}

export const duplicatePhotosDetector: SmartCleanDetector = {
  key: "duplicatePhotos",
  featureKey: "duplicatePhotoDetection",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    if (!(await probeCapability("fileHashing"))) return notAvailable("duplicatePhotos");

    const photos = assets.filter((asset) => asset.mediaType === "photo");
    const buckets = new Map<string, IndexedMediaAsset[]>();
    for (const photo of photos) {
      const bucketKey = `${Math.round(sizeOf(photo) / 4096)}|${photo.width ?? 0}x${photo.height ?? 0}`;
      const list = buckets.get(bucketKey);
      if (list) list.push(photo);
      else buckets.set(bucketKey, [photo]);
    }
    // Only hash assets that collide on size+dimensions (cheap pre-filter).
    const candidates = [...buckets.values()].filter((list) => list.length >= 2).flat();

    const byMd5 = new Map<string, IndexedMediaAsset[]>();
    await forEachYielding(candidates, 12, signal, async (asset) => {
      const modKey = modKeyOf(asset);
      let md5 = featureCacheApi.get(asset.id, modKey)?.md5;
      if (!md5) {
        const uri = await resolveReadableUri(asset);
        md5 = await computeMd5(uri);
        if (md5) featureCacheApi.upsert(asset.id, modKey, { md5 });
      }
      if (md5) {
        const list = byMd5.get(md5);
        if (list) list.push(asset);
        else byMd5.set(md5, [asset]);
      }
    }, onProgress);

    const groups: SmartCleanGroup[] = [];
    for (const [md5, list] of byMd5) {
      if (list.length < 2) continue;
      groups.push({ id: `duplicatePhotos:${md5}`, keepMediaId: pickOriginal(list), items: list.map(toItem) });
    }
    return finalizeResult("duplicatePhotos", groups);
  }
};
