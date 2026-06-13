import { Aperture, Copy, Film, Image as ImageIcon, Images, Smartphone, Smile, Video } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { SmartCleanDetector, SmartCleanDetectorKey } from "@/features/smart-clean/smart-clean.types";
import { largePhotosDetector, largeVideosDetector } from "@/features/smart-clean/detectors/tier0-large";
import { screenshotsDetector } from "@/features/smart-clean/detectors/tier1-screenshots";
import { duplicatePhotosDetector } from "@/features/smart-clean/detectors/tier1-duplicate-photos";
import { similarPhotosDetector } from "@/features/smart-clean/detectors/tier2-similar";
import { blurryPhotosDetector } from "@/features/smart-clean/detectors/tier2-blurry";
import { duplicateVideosDetector } from "@/features/smart-clean/detectors/tier2-duplicate-videos";
import { memesDetector } from "@/features/smart-clean/detectors/tier3-memes";

/**
 * The real Smart Clean detectors, in stable card order. Tier 0 (large) and
 * Tier 1 (screenshots, and md5-gated duplicates) run on the current APK; Tier 2
 * (similar/blurry/duplicate videos) and the md5 duplicate refinement are gated
 * on native capabilities and degrade to "not_available" until a native rebuild.
 *
 * IMPORTANT: this module (and the detectors it imports) must NOT statically
 * import the gated native modules — they are reached only via lazy dynamic
 * import inside detector/probe functions, so app startup never touches them.
 */
// DISPLAY order — the card order on the Smart Clean screen.
export const SMART_CLEAN_DETECTORS: SmartCleanDetector[] = [
  duplicatePhotosDetector,
  similarPhotosDetector,
  duplicateVideosDetector,
  blurryPhotosDetector,
  screenshotsDetector,
  memesDetector,
  largeVideosDetector,
  largePhotosDetector
];

// SCAN order — cheapest first. Tier-0 metadata (large files) is instant; Tier-1/3
// (screenshots, memes, exact-duplicate MD5) are cheap; the Tier-2 pixel detectors
// (duplicate videos, then similar + blurry, which decode EVERY photo) run last.
// On a cold cache this surfaces the fast categories' results in seconds while the
// expensive photo-fingerprinting finishes in the background. Cards still render in
// SMART_CLEAN_DETECTORS order; each one populates when its detector completes, so
// reordering the scan does NOT move the cards — fast categories just fill first.
export const SMART_CLEAN_SCAN_ORDER: SmartCleanDetector[] = [
  largePhotosDetector,
  largeVideosDetector,
  screenshotsDetector,
  memesDetector,
  duplicatePhotosDetector,
  duplicateVideosDetector,
  similarPhotosDetector,
  blurryPhotosDetector
];

export const CATEGORY_ICON: Record<SmartCleanDetectorKey, LucideIcon> = {
  duplicatePhotos: Copy,
  similarPhotos: Images,
  duplicateVideos: Film,
  blurryPhotos: Aperture,
  screenshots: Smartphone,
  memes: Smile,
  largeVideos: Video,
  largePhotos: ImageIcon
};
