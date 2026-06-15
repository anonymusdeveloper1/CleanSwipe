import { IndexedMediaAsset } from "@/store/media-index-store";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { featureCacheApi } from "@/features/smart-clean/feature-cache-store";
import { probeCapability } from "@/features/smart-clean/native-capabilities";
import { computeGrayFeatures } from "@/features/smart-clean/detectors/image-pipeline";
import { DHASH_SIMILAR_MAX, groupByHamming } from "@/features/smart-clean/detectors/hash-utils";
import { finalizeResult, forEachYielding, modKeyOf, notAvailable, resolveReadableUri, sizeOf, toItem } from "@/features/smart-clean/detectors/shared";

/**
 * Tier 2 — similar (near-duplicate) photos via perceptual dHash + Hamming
 * union-find. Requires the imageManipulator capability; degrades to
 * "not_available" on the current APK.
 *
 * keepMediaId = highest resolution; tie → larger bytes → newest.
 */
function pickHighestRes(list: IndexedMediaAsset[]): string {
  return [...list].sort(
    (a, b) =>
      (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0) ||
      sizeOf(b) - sizeOf(a) ||
      (b.creationTime ?? 0) - (a.creationTime ?? 0)
  )[0].id;
}

export const similarPhotosDetector: SmartCleanDetector = {
  key: "similarPhotos",
  featureKey: "similarPhotoDetection",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    if (!(await probeCapability("imageManipulator"))) return notAvailable("similarPhotos");

    const photos = assets.filter((asset) => asset.mediaType === "photo");
    const withHash: { asset: IndexedMediaAsset; hash: string }[] = [];
    await forEachYielding(photos, 16, signal, async (asset) => {
      const modKey = modKeyOf(asset);
      let hash = featureCacheApi.get(asset.id, modKey)?.dHash;
      if (!hash) {
        const uri = await resolveReadableUri(asset);
        // Single decode → cache BOTH dHash and blurVar so the blurry detector
        // reuses this decode (no second decode for the same photo).
        const features = await computeGrayFeatures(uri);
        if (features) {
          featureCacheApi.upsert(asset.id, modKey, { dHash: features.dHash, blurVar: features.blurVar });
          hash = features.dHash;
        }
      }
      if (hash) withHash.push({ asset, hash });
    }, onProgress);

    // Bucket by month + orientation to bound the O(n^2) pairwise comparison.
    const buckets = new Map<string, { asset: IndexedMediaAsset; hash: string }[]>();
    for (const entry of withHash) {
      const orientation = (entry.asset.width ?? 0) > (entry.asset.height ?? 0) ? "L" : "P";
      const bucketKey = `${entry.asset.monthKey}|${orientation}`;
      const list = buckets.get(bucketKey);
      if (list) list.push(entry);
      else buckets.set(bucketKey, [entry]);
    }

    const groups: SmartCleanGroup[] = [];
    for (const bucket of buckets.values()) {
      const indexGroups = groupByHamming(bucket.map((entry) => entry.hash), DHASH_SIMILAR_MAX);
      for (const indices of indexGroups) {
        const list = indices.map((i) => bucket[i].asset);
        groups.push({ id: `similarPhotos:${list[0].id}`, keepMediaId: pickHighestRes(list), items: list.map(toItem) });
      }
    }
    return finalizeResult("similarPhotos", groups);
  }
};
