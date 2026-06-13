import * as MediaLibrary from "expo-media-library";
import { IndexedMediaAsset } from "@/store/media-index-store";
import { SmartCleanDetector, SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";
import { finalizeResult, forEachYielding, sizeOf, throwIfAborted, toItem } from "@/features/smart-clean/detectors/shared";
import { MEME_CLASSIFY_THRESHOLD, MEME_MAX_BYTES, MEME_MAX_LONG_EDGE } from "@/features/smart-clean/detectors/thresholds";

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

const MEME_FILENAME_RE = /(meme|whatsapp|telegram|download|fb_img|received|reddit|9gag|screenshot)/i;
const WHATSAPP_NAME_RE = /img-\d{8}-wa\d+/i;
const MEME_ALBUM_RE = /(download|whatsapp|telegram|saved|memes)/i;

/** Default heuristic classifier. Swap for an ML implementation later. */
export const HeuristicMemeClassifier: MemeClassifier = {
  async classify(asset, ctx) {
    let score = 0;
    if (ctx.inMemeAlbum) score += 2;
    const name = asset.filename ?? "";
    if (MEME_FILENAME_RE.test(name) || WHATSAPP_NAME_RE.test(name)) score += 1;
    const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
    if (sizeOf(asset) < MEME_MAX_BYTES && longEdge > 0 && longEdge <= MEME_MAX_LONG_EDGE) score += 1;
    // EXIF only when already borderline and not already album-confirmed.
    if (score >= 1 && !ctx.inMemeAlbum && (await ctx.lacksCameraExif())) score += 1;
    return Math.min(score / 4, 1);
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
    const info = await MediaLibrary.getAssetInfoAsync(assetId);
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
