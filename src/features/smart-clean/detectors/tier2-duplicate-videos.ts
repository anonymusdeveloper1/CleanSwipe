import { IndexedMediaAsset } from "@/store/media-index-store";
import { CompressionService } from "@/services/compression-service";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { featureCacheApi } from "@/features/smart-clean/feature-cache-store";
import { probeCapability } from "@/features/smart-clean/native-capabilities";
import { computeDHash } from "@/features/smart-clean/detectors/image-pipeline";
import { DHASH_DUP_MAX, groupByHamming } from "@/features/smart-clean/detectors/hash-utils";
import { finalizeResult, forEachYielding, modKeyOf, notAvailable, resolveReadableUri, sizeOf, toItem } from "@/features/smart-clean/detectors/shared";

/**
 * Tier 2 — duplicate videos via a perceptual hash of the thumbnail frame.
 * Requires both videoThumbnail (react-native-compressor) and imageManipulator;
 * degrades to "not_available" otherwise. Tighter Hamming threshold than the
 * similar-photo detector.
 *
 * keepMediaId = largest bytes (best quality); tie → earliest creationTime.
 */
function bucketKeyOf(asset: IndexedMediaAsset): string {
  return `${Math.round(asset.duration ?? 0)}|${asset.width ?? 0}x${asset.height ?? 0}`;
}

function pickLargest(list: IndexedMediaAsset[]): string {
  return [...list].sort(
    (a, b) => sizeOf(b) - sizeOf(a) || (a.creationTime ?? Number.POSITIVE_INFINITY) - (b.creationTime ?? Number.POSITIVE_INFINITY)
  )[0].id;
}

export const duplicateVideosDetector: SmartCleanDetector = {
  key: "duplicateVideos",
  featureKey: "duplicateVideoDetection",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    const [thumbOk, manipulatorOk] = await Promise.all([
      probeCapability("videoThumbnail"),
      probeCapability("imageManipulator")
    ]);
    if (!thumbOk || !manipulatorOk) return notAvailable("duplicateVideos");

    const videos = assets.filter((asset) => asset.mediaType === "video");
    const buckets = new Map<string, IndexedMediaAsset[]>();
    for (const video of videos) {
      const key = bucketKeyOf(video);
      const list = buckets.get(key);
      if (list) list.push(video);
      else buckets.set(key, [video]);
    }
    const candidates = [...buckets.values()].filter((list) => list.length >= 2).flat();

    const withHash: { asset: IndexedMediaAsset; hash: string }[] = [];
    await forEachYielding(candidates, 8, signal, async (asset) => {
      const modKey = modKeyOf(asset);
      let hash = featureCacheApi.get(asset.id, modKey)?.vHash;
      if (!hash) {
        try {
          const readableUri = await resolveReadableUri(asset);
          const thumbnail = await CompressionService.createThumbnail({ ...asset, uri: readableUri });
          hash = await computeDHash(thumbnail);
        } catch {
          hash = undefined;
        }
        if (hash) featureCacheApi.upsert(asset.id, modKey, { vHash: hash });
      }
      if (hash) withHash.push({ asset, hash });
    }, onProgress);

    const rebucket = new Map<string, { asset: IndexedMediaAsset; hash: string }[]>();
    for (const entry of withHash) {
      const key = bucketKeyOf(entry.asset);
      const list = rebucket.get(key);
      if (list) list.push(entry);
      else rebucket.set(key, [entry]);
    }

    const groups: SmartCleanGroup[] = [];
    for (const bucket of rebucket.values()) {
      const indexGroups = groupByHamming(bucket.map((entry) => entry.hash), DHASH_DUP_MAX);
      for (const indices of indexGroups) {
        const list = indices.map((i) => bucket[i].asset);
        groups.push({ id: `duplicateVideos:${list[0].id}`, keepMediaId: pickLargest(list), items: list.map(toItem) });
      }
    }
    return finalizeResult("duplicateVideos", groups);
  }
};
