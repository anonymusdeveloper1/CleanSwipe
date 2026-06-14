/**
 * Centralized feature-flag catalogue for the Free vs Pro tier model.
 *
 * This is the SINGLE SOURCE OF TRUTH for which features belong to which tier.
 * Screens/components must NEVER hardcode an `isPro` check — they ask
 * `canUseFeature(featureKey)` (see feature-access.service.ts / useFeatureAccess)
 * which reads the tier from this file.
 *
 * To move a feature between tiers, change which array it lives in here; nothing
 * else needs to change.
 */

export const FREE_FEATURES = [
  "swipeToDelete",
  "unlimitedPhotoSwipeDelete",
  "unlimitedVideoSwipeDelete",
  "photoCompression",
  "backgroundPhotoCompression",
  "advancedCompressionSettings",
  "basicStats",
  "manualCleanup",
  "largeFileBrowsing",
  "sortBySize",
  "sortByDate"
] as const;

export const PRO_FEATURES = [
  "videoCompression",
  "batchVideoCompression",
  "compressAll",
  "smartClean",
  "duplicatePhotoDetection",
  "similarPhotoDetection",
  "duplicateVideoDetection",
  "blurryPhotoDetection",
  "screenshotCleanup",
  "memeCleanup",
  "largeVideoFinder",
  "largePhotoFinder",
  "oneTapRecommendations",
  "advancedStats",
  "noAds",
  "fasterScanning",
  "cleanupHistory",
  "compressionHistory"
] as const;

export type FreeFeatureKey = (typeof FREE_FEATURES)[number];
export type ProFeatureKey = (typeof PRO_FEATURES)[number];
export type FeatureKey = FreeFeatureKey | ProFeatureKey;

export type FeatureTier = "free" | "pro";

export const FEATURE_TIER: Record<FeatureKey, FeatureTier> = {
  ...Object.fromEntries(FREE_FEATURES.map((key) => [key, "free"] as const)),
  ...Object.fromEntries(PRO_FEATURES.map((key) => [key, "pro"] as const))
} as Record<FeatureKey, FeatureTier>;

export function isProFeature(key: FeatureKey): boolean {
  return FEATURE_TIER[key] === "pro";
}

export function isKnownFeature(key: string): key is FeatureKey {
  return key in FEATURE_TIER;
}
