import * as MediaLibrary from "expo-media-library";
import { Image as CompressorImage, Video, createVideoThumbnail, getFileSize } from "react-native-compressor";
import { CompressedMediaItem, CompressionQuality, PhotoAsset } from "@/models/photo";

type CompressionProfile = {
  label: string;
  fidelity: string;
  description: string;
  imageQuality: number;
  imageMaxSize: number;
  videoMaxSize: number;
  estimatedRatio: number;
};

export const compressionProfiles: Record<CompressionQuality, CompressionProfile> = {
  low: {
    label: "Low",
    fidelity: "20%",
    description: "Smallest files for quick sharing.",
    imageQuality: 0.42,
    imageMaxSize: 1440,
    videoMaxSize: 720,
    estimatedRatio: 0.14
  },
  medium: {
    label: "Medium",
    fidelity: "50%",
    description: "Balances file size and visual fidelity. Recommended for social sharing and messaging.",
    imageQuality: 0.62,
    imageMaxSize: 1920,
    videoMaxSize: 1080,
    estimatedRatio: 0.2
  },
  high: {
    label: "High",
    fidelity: "80%",
    description: "Keeps more detail while still trimming heavy media.",
    imageQuality: 0.82,
    imageMaxSize: 2560,
    videoMaxSize: 1440,
    estimatedRatio: 0.34
  }
};

export const LARGE_PHOTO_MIN_BYTES = 5 * 1024 * 1024;
export const LARGE_PHOTO_MIN_PIXELS = 8_000_000;
export const VIDEO_MIN_BYTES = 20 * 1024 * 1024;

// Max source dimension we will decode a video frame from. Bounded by the heap:
// with android:largeHeap="true" an 8K ARGB frame (~140 MB) fits; larger sources
// fall back to a non-decoding placeholder. Mirror of media-thumbnail.tsx.
const SAFE_THUMBNAIL_MAX_DIMENSION = 8192;

const VIDEO_THUMBNAIL_CACHE_MAX = 1000;
const videoThumbnailCache = new Map<string, Promise<string>>();

export type CompressOptions = {
  quality: CompressionQuality;
  onProgress?: (progress: number) => void;
};

export const CompressionService = {
  isCompressible(asset: PhotoAsset) {
    if (asset.mediaType === "video") {
      return getOriginalBytes(asset) >= VIDEO_MIN_BYTES || (asset.duration ?? 0) >= 20;
    }
    if (asset.mediaType === "photo") {
      const pixels = (asset.width ?? 0) * (asset.height ?? 0);
      return getOriginalBytes(asset) >= LARGE_PHOTO_MIN_BYTES || pixels >= LARGE_PHOTO_MIN_PIXELS;
    }
    return false;
  },

  estimate(asset: PhotoAsset, quality: CompressionQuality = "medium") {
    const originalBytes = getOriginalBytes(asset);
    const ratio = getEstimatedRatio(asset, quality);
    const compressedBytes = Math.max(Math.round(originalBytes * ratio), 1);
    const savedBytes = Math.max(originalBytes - compressedBytes, 0);
    return {
      originalBytes,
      compressedBytes,
      savedBytes,
      savePercent: originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0
    };
  },

  createThumbnail(asset: PhotoAsset): Promise<string> {
    if (asset.mediaType !== "video") return Promise.resolve(asset.uri);
    // Frame extraction decodes the video's first frame at FULL resolution, so a
    // 6K/8K clip allocates a large bitmap. With android:largeHeap="true" (~512 MB,
    // set in AndroidManifest.xml) frames up to 8K (~140 MB) decode safely; we still
    // refuse anything larger or of unknown resolution so a pathological source can't
    // blow even the larger heap. Callers fall back to the video placeholder.
    // Keep SAFE_THUMBNAIL_MAX_DIMENSION in sync with media-thumbnail.tsx.
    const maxDimension = Math.max(asset.width ?? 0, asset.height ?? 0);
    if (maxDimension === 0 || maxDimension > SAFE_THUMBNAIL_MAX_DIMENSION) {
      return Promise.reject(new Error("video resolution too large to thumbnail safely"));
    }
    // Thumbnail extraction is native work that list cells request on every
    // mount/remount while scrolling — cache per asset (keyed on modification
    // time so an edited video re-extracts). Storing the promise also dedupes
    // concurrent requests for the same asset.
    // The uri is part of the key because some callers pass a re-resolved
    // readable uri rather than the indexed one — a failure for one must not
    // poison the other.
    const cacheKey = `${asset.id}:${asset.modificationTime ?? 0}:${asset.uri}`;
    const cached = videoThumbnailCache.get(cacheKey);
    if (cached) return cached;
    const pending = createVideoThumbnail(asset.uri, { quality: 0.7 }).then((thumbnail) => thumbnail.path);
    if (videoThumbnailCache.size >= VIDEO_THUMBNAIL_CACHE_MAX) {
      const oldestKey = videoThumbnailCache.keys().next().value;
      if (oldestKey) videoThumbnailCache.delete(oldestKey);
    }
    videoThumbnailCache.set(cacheKey, pending);
    pending.catch(() => {
      // Only evict our own entry — a rejected promise that was already evicted
      // must not delete a newer, healthy retry under the same key.
      if (videoThumbnailCache.get(cacheKey) === pending) videoThumbnailCache.delete(cacheKey);
    });
    return pending;
  },

  // Compresses to a temporary file only. The caller MUST verify the output and
  // then call saveToLibrary before treating the job as complete, so a failed
  // verification or a failed library save can never leave a deletable original
  // without a persisted compressed copy.
  async compress(asset: PhotoAsset, options: CompressOptions): Promise<CompressedMediaItem> {
    const profile = compressionProfiles[options.quality];
    const originalBytes = getOriginalBytes(asset);
    options.onProgress?.(0.05);

    // Re-resolve a fresh readable URI from MediaLibrary. The cached index URI can
    // be stale, and under scoped storage the compressor must be handed the
    // current localUri. If the asset is not accessible (e.g. "selected photos
    // only" access and this item wasn't selected) the underlying read fails with
    // EACCES, which is mapped to an actionable message upstream.
    const readableUri = await resolveReadableUri(asset);

    let outputUri: string;
    let cacheCopyUri: string | undefined;
    try {
      outputUri = await runCompression(asset, readableUri, profile, options);
    } catch (error) {
      // Under scoped storage ("selected photos only") the native compressor can
      // fail to read the raw file path (EACCES). As a last resort, copy the asset
      // into our own cache directory and retry once from a path we own. If the
      // copy or the retry fails, re-throw the ORIGINAL error so the upstream
      // friendly-message mapping is unchanged — this path can only help, never
      // regress the happy path (which never reaches here).
      if (!isLikelyAccessError(error)) throw error;
      cacheCopyUri = await copyToAppCache(asset, readableUri);
      if (!cacheCopyUri) throw error;
      try {
        outputUri = await runCompression(asset, cacheCopyUri, profile, options);
      } catch {
        throw error;
      }
    } finally {
      if (cacheCopyUri) await safeDeleteCache(cacheCopyUri);
    }

    options.onProgress?.(0.97);
    const compressedBytes = await readFileSize(outputUri, asset, options.quality);
    const savedBytes = Math.max(originalBytes - compressedBytes, 0);

    return {
      id: `${asset.id}-${Date.now()}`,
      sourceId: asset.id,
      sourceUri: asset.uri,
      outputUri,
      libraryAssetId: undefined,
      filename: asset.filename,
      mediaType: asset.mediaType,
      quality: options.quality,
      originalBytes,
      compressedBytes,
      savedBytes,
      progress: 1,
      compressedAt: new Date().toISOString()
    };
  },

  // Saves a verified compressed file into the device library. Returns the new
  // asset id, or undefined if the save failed (the caller must treat undefined
  // as a hard failure and keep the original).
  saveToLibrary(uri: string) {
    return saveCompressedCopy(uri);
  }
};

async function resolveReadableUri(asset: PhotoAsset) {
  if (!asset.id || asset.id.startsWith("demo-")) return asset.uri;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id);
    return info?.localUri ?? asset.uri;
  } catch {
    return asset.uri;
  }
}

// Runs the native compressor against a specific (possibly re-resolved) source URI.
function runCompression(asset: PhotoAsset, uri: string, profile: CompressionProfile, options: CompressOptions) {
  const source = uri === asset.uri ? asset : { ...asset, uri };
  return source.mediaType === "video" ? compressVideo(source, profile, options) : compressImage(source, profile);
}

// True for errors that look like a scoped-storage / permission read failure —
// mirrors the EACCES branch of getFriendlyCompressionError so the retry only
// kicks in for the case it can actually help.
function isLikelyAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /eacces|denied|permission|securityexception|open failed/i.test(message);
}

// Copies the asset into the app cache (through expo-file-system, which reads via
// the content resolver) so the compressor can be handed a path the app owns.
// Returns the cache path, or undefined if the copy could not be made.
async function copyToAppCache(asset: PhotoAsset, fromUri: string): Promise<string | undefined> {
  try {
    const FS: any = await import("expo-file-system/legacy");
    const cacheDir: string | undefined = FS.cacheDirectory;
    if (!cacheDir) return undefined;
    const ext = guessExtension(asset);
    const dest = `${cacheDir}sc-compress-src-${asset.id}.${ext}`;
    await FS.copyAsync({ from: fromUri, to: dest });
    return dest;
  } catch {
    return undefined;
  }
}

async function safeDeleteCache(uri: string) {
  try {
    const FS: any = await import("expo-file-system/legacy");
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup; a leftover cache file is harmless (OS reclaims cache).
  }
}

function guessExtension(asset: PhotoAsset) {
  const fromName = asset.filename?.split(".").pop();
  if (fromName && fromName.length > 0 && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) {
    return fromName.toLowerCase();
  }
  return asset.mediaType === "video" ? "mp4" : "jpg";
}

async function compressVideo(asset: PhotoAsset, profile: CompressionProfile, options: CompressOptions) {
  return Video.compress(
    asset.uri,
    {
      compressionMethod: "auto",
      maxSize: profile.videoMaxSize,
      minimumFileSizeForCompress: 0
    },
    (progress) => options.onProgress?.(Math.max(0.08, Math.min(progress, 0.96)))
  );
}

async function compressImage(asset: PhotoAsset, profile: CompressionProfile) {
  return CompressorImage.compress(asset.uri, {
    compressionMethod: "manual",
    maxWidth: profile.imageMaxSize,
    maxHeight: profile.imageMaxSize,
    quality: profile.imageQuality,
    output: "jpg",
    returnableOutputType: "uri"
  });
}

export function getOriginalBytes(asset: PhotoAsset) {
  if (asset.sizeBytes && asset.sizeBytes > 0) return asset.sizeBytes;
  const pixels = (asset.width ?? 0) * (asset.height ?? 0);
  if (asset.mediaType === "video") {
    const duration = Math.max(asset.duration ?? 1, 1);
    return Math.round(Math.max(pixels, 1_000_000) * duration * 0.18);
  }
  return Math.round(Math.max(pixels, 1_000_000) * 0.55);
}

function getEstimatedRatio(asset: PhotoAsset, quality: CompressionQuality) {
  const base = compressionProfiles[quality].estimatedRatio;
  if (asset.mediaType === "video") return Math.min(base + 0.03, 0.44);
  return base;
}

async function readFileSize(uri: string, asset: PhotoAsset, quality: CompressionQuality) {
  try {
    const size = Number(await getFileSize(uri));
    if (Number.isFinite(size) && size > 0) return size;
  } catch {
    // Fall back to a deterministic estimate when native metadata is not available.
  }
  return CompressionService.estimate(asset, quality).compressedBytes;
}

async function saveCompressedCopy(uri: string) {
  try {
    const asset = await MediaLibrary.createAssetAsync(uri);
    return asset.id;
  } catch {
    return undefined;
  }
}
