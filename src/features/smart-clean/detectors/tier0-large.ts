import { LARGE_PHOTO_MIN_BYTES, LARGE_PHOTO_MIN_PIXELS, VIDEO_MIN_BYTES } from "@/services/compression-service";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { finalizeResult, forEachYielding, sizeOf, toItem } from "@/features/smart-clean/detectors/shared";

/**
 * Tier 0 — metadata only, no native deps. Works on the current APK.
 * Each item is its own group (no keeper); the action is delete or compress.
 */

function isLargePhoto(asset: { mediaType?: string; width?: number; height?: number; sizeBytes?: number; duration?: number }) {
  const pixels = (asset.width ?? 0) * (asset.height ?? 0);
  return sizeOf(asset as never) >= LARGE_PHOTO_MIN_BYTES || pixels >= LARGE_PHOTO_MIN_PIXELS;
}

function isLargeVideo(asset: { mediaType?: string; duration?: number; sizeBytes?: number; width?: number; height?: number }) {
  return sizeOf(asset as never) >= VIDEO_MIN_BYTES || (asset.duration ?? 0) >= 20;
}

export const largePhotosDetector: SmartCleanDetector = {
  key: "largePhotos",
  featureKey: "largePhotoFinder",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    const photos = assets.filter((asset) => asset.mediaType === "photo" && isLargePhoto(asset));
    photos.sort((a, b) => sizeOf(b) - sizeOf(a));
    const groups: SmartCleanGroup[] = [];
    await forEachYielding(photos, 500, signal, (asset) => {
      groups.push({ id: `largePhotos:${asset.id}`, items: [toItem(asset)] });
    }, onProgress);
    return finalizeResult("largePhotos", groups);
  }
};

export const largeVideosDetector: SmartCleanDetector = {
  key: "largeVideos",
  featureKey: "largeVideoFinder",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    const videos = assets.filter((asset) => asset.mediaType === "video" && isLargeVideo(asset));
    videos.sort((a, b) => sizeOf(b) - sizeOf(a));
    const groups: SmartCleanGroup[] = [];
    await forEachYielding(videos, 500, signal, (asset) => {
      groups.push({ id: `largeVideos:${asset.id}`, items: [toItem(asset)] });
    }, onProgress);
    return finalizeResult("largeVideos", groups);
  }
};
