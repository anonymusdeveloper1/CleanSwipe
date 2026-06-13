import { Dimensions } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { IndexedMediaAsset } from "@/store/media-index-store";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { finalizeResult, forEachYielding, throwIfAborted, toItem } from "@/features/smart-clean/detectors/shared";
import { SCREENSHOT_ASPECT_TOLERANCE, SCREENSHOT_CLASSIFY_SCORE } from "@/features/smart-clean/detectors/thresholds";

/**
 * Tier 1 — screenshots. Uses expo-media-library (natively present) so it works
 * on the current APK. Multi-signal score; classify when score >= 2. EXIF (the
 * expensive per-asset call) is probed ONLY for borderline candidates; album
 * membership short-circuits before any EXIF call.
 */

const FILENAME_RE = /^(screenshot|screen[ _-]?shot|scrnsht|capture)/i;

async function loadScreenshotAlbumIds(signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const screenshotAlbums = albums.filter((album) => /screenshot/i.test(album.title));
    for (const album of screenshotAlbums) {
      let after: MediaLibrary.AssetRef | undefined;
      // Paginate the (usually small) screenshots album.
      for (let page = 0; page < 50; page++) {
        throwIfAborted(signal);
        const result = await MediaLibrary.getAssetsAsync({ album, mediaType: ["photo"], first: 200, after });
        for (const asset of result.assets) ids.add(asset.id);
        if (!result.hasNextPage || !result.endCursor) break;
        after = result.endCursor;
      }
    }
  } catch {
    // No album access ⇒ rely on filename/dimension/EXIF heuristics only.
  }
  return ids;
}

function dimensionsMatchScreen(asset: IndexedMediaAsset): boolean {
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  if (w <= 0 || h <= 0) return false;
  const screen = Dimensions.get("screen");
  const screenAspect = screen.width / screen.height;
  const assetAspect = Math.min(w, h) / Math.max(w, h);
  const normalizedScreen = Math.min(screenAspect, 1 / screenAspect);
  return Math.abs(assetAspect - normalizedScreen) <= SCREENSHOT_ASPECT_TOLERANCE;
}

async function lacksCameraExif(assetId: string): Promise<boolean> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(assetId);
    const exif = (info?.exif ?? {}) as Record<string, unknown>;
    const make = exif.Make ?? exif["{TIFF}"];
    const model = exif.Model ?? exif.LensModel ?? exif.FNumber;
    return !make && !model;
  } catch {
    return false;
  }
}

export const screenshotsDetector: SmartCleanDetector = {
  key: "screenshots",
  featureKey: "screenshotCleanup",
  requiresFullAccess: true,
  async detect({ assets, signal, onProgress }) {
    const photos = assets.filter((asset) => asset.mediaType === "photo");
    const albumIds = await loadScreenshotAlbumIds(signal);
    const groups: SmartCleanGroup[] = [];

    await forEachYielding(photos, 40, signal, async (asset) => {
      let score = 0;
      if (albumIds.has(asset.id)) score += 3; // strong signal — short-circuits below
      if (FILENAME_RE.test(asset.filename ?? "")) score += 1;
      if (dimensionsMatchScreen(asset)) score += 1;
      // Only pay for EXIF when we're already borderline and haven't confirmed via album.
      if (score >= 1 && score < SCREENSHOT_CLASSIFY_SCORE && !albumIds.has(asset.id) && (await lacksCameraExif(asset.id))) {
        score += 1;
      }
      if (score >= SCREENSHOT_CLASSIFY_SCORE) groups.push({ id: `screenshots:${asset.id}`, items: [toItem(asset)] });
    }, onProgress);

    return finalizeResult("screenshots", groups);
  }
};
