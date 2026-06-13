import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { featureCacheApi } from "@/features/smart-clean/feature-cache-store";
import { probeCapability } from "@/features/smart-clean/native-capabilities";
import { computeBlurVariance } from "@/features/smart-clean/detectors/image-pipeline";
import { BLUR_VARIANCE_THRESHOLD } from "@/features/smart-clean/detectors/hash-utils";
import { finalizeResult, forEachYielding, modKeyOf, notAvailable, resolveReadableUri, toItem } from "@/features/smart-clean/detectors/shared";

/**
 * Tier 2 — blurry photos via variance-of-Laplacian (low variance ⇒ blurry).
 * Requires the imageManipulator capability; degrades to "not_available" on the
 * current APK. Keeper-less — each blurry photo is independently deletable.
 */
export const blurryPhotosDetector: SmartCleanDetector = {
  key: "blurryPhotos",
  featureKey: "blurryPhotoDetection",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    if (!(await probeCapability("imageManipulator"))) return notAvailable("blurryPhotos");

    const photos = assets.filter((asset) => asset.mediaType === "photo");
    const groups: SmartCleanGroup[] = [];
    await forEachYielding(photos, 16, signal, async (asset) => {
      const modKey = modKeyOf(asset);
      let blurVar = featureCacheApi.get(asset.id, modKey)?.blurVar;
      if (blurVar === undefined) {
        const uri = await resolveReadableUri(asset);
        blurVar = await computeBlurVariance(uri);
        if (blurVar !== undefined) featureCacheApi.upsert(asset.id, modKey, { blurVar });
      }
      if (blurVar !== undefined && blurVar < BLUR_VARIANCE_THRESHOLD) {
        groups.push({ id: `blurryPhotos:${asset.id}`, items: [toItem(asset)] });
      }
    }, onProgress);

    return finalizeResult("blurryPhotos", groups);
  }
};
