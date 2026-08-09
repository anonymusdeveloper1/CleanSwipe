import * as MediaLibrary from "expo-media-library";
import { IndexedMediaAsset } from "@/store/media-index-store";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { finalizeResult, forEachYielding, sizeOf, throwIfAborted, toItem } from "@/features/smart-clean/detectors/shared";
import { MEME_CLASSIFY_THRESHOLD } from "@/features/smart-clean/detectors/thresholds";
import { MEME_ALBUM_RE, memeNeedsExifCheck, memeScore } from "@/features/smart-clean/detectors/meme-classifier";

/**
 * Tier 3 — memes. Real meme recognition needs on-device ML (image labeling /
 * OCR). Until that ships we use a CONSERVATIVE metadata heuristic exposed
 * through a pluggable `MemeClassifier` interface, so a future ML classifier
 * drops in without touching the detector or screen. The heuristic is labeled
 * honestly in the UI and, like everything in Smart Clean, requires explicit
 * preview + confirmation before any deletion.
 */

export type MemeClassifierContext = {
  /** Membership in a likely-meme source album (Download / WhatsApp / Telegram). */
  inMemeAlbum: boolean;
  /** Lazily checks for absence of camera EXIF (paid only when the heuristic needs it). */
  lacksCameraExif: () => Promise<boolean>;
};

export interface MemeClassifier {
  /** Returns a 0..1 confidence that the asset is a meme/saved image. */
  classify(asset: IndexedMediaAsset, ctx: MemeClassifierContext): Promise<number>;
}

/** Default heuristic classifier. Swap for an ML implementation later. Scoring
 *  logic lives in the pure, unit-tested `meme-classifier` module. */
export const HeuristicMemeClassifier: MemeClassifier = {
  async classify(asset, ctx) {
    const filename = asset.filename ?? "";
    const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
    // Only pay for the (expensive) camera-EXIF lookup when it can change the outcome.
    const lacksCameraExif = memeNeedsExifCheck(filename, ctx.inMemeAlbum) ? await ctx.lacksCameraExif() : false;
    return memeScore({ filename, longEdge, sizeBytes: sizeOf(asset), inMemeAlbum: ctx.inMemeAlbum, lacksCameraExif });
  }
};

async function loadMemeAlbumIds(signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    for (const album of albums.filter((a) => MEME_ALBUM_RE.test(a.title))) {
      let after: MediaLibrary.AssetRef | undefined;
      for (let page = 0; page < 50; page++) {
        throwIfAborted(signal);
        const result = await MediaLibrary.getAssetsAsync({ album, mediaType: ["photo"], first: 200, after });
        for (const asset of result.assets) ids.add(asset.id);
        if (!result.hasNextPage || !result.endCursor) break;
        after = result.endCursor;
      }
    }
  } catch {
    // No album access — heuristic falls back to filename/size/EXIF only.
  }
  return ids;
}

async function lacksCameraExif(assetId: string): Promise<boolean> {
  try {
    // shouldDownloadFromNetwork:false — see tier1-screenshots. Reading EXIF must
    // never trigger an iCloud download; the lazy-EXIF gate already limits how
    // often this runs, but on a large library "often" is still thousands of calls.
    const info = await MediaLibrary.getAssetInfoAsync(assetId, { shouldDownloadFromNetwork: false });
    const exif = (info?.exif ?? {}) as Record<string, unknown>;
    return !(exif.Make ?? exif["{TIFF}"]) && !(exif.Model ?? exif.LensModel ?? exif.FNumber);
  } catch {
    return false;
  }
}

export function createMemesDetector(classifier: MemeClassifier = HeuristicMemeClassifier): SmartCleanDetector {
  return {
    key: "memes",
    featureKey: "memeCleanup",
    requiresFullAccess: true,
    async detect({ assets, signal, onProgress }) {
      const photos = assets.filter((asset) => asset.mediaType === "photo");
      const albumIds = await loadMemeAlbumIds(signal);
      const groups: SmartCleanGroup[] = [];
      await forEachYielding(photos, 40, signal, async (asset) => {
        const score = await classifier.classify(asset, {
          inMemeAlbum: albumIds.has(asset.id),
          lacksCameraExif: () => lacksCameraExif(asset.id)
        });
        if (score >= MEME_CLASSIFY_THRESHOLD) groups.push({ id: `memes:${asset.id}`, items: [toItem(asset)] });
      }, onProgress);
      return finalizeResult("memes", groups);
    }
  };
}

export const memesDetector: SmartCleanDetector = createMemesDetector();
