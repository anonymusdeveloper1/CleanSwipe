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

  async createThumbnail(asset: PhotoAsset) {
    if (asset.mediaType !== "video") return asset.uri;
    const thumbnail = await createVideoThumbnail(asset.uri, { quality: 0.7 });
    return thumbnail.path;
  },

  async compress(asset: PhotoAsset, options: CompressOptions): Promise<CompressedMediaItem> {
    const profile = compressionProfiles[options.quality];
    const originalBytes = getOriginalBytes(asset);
    options.onProgress?.(0.05);

    const outputUri = asset.mediaType === "video" ? await compressVideoInBackground(asset, profile, options) : await compressImage(asset, profile);

    options.onProgress?.(0.97);
    const compressedBytes = await readFileSize(outputUri, asset, options.quality);
    const libraryAssetId = await saveCompressedCopy(outputUri);
    const savedBytes = Math.max(originalBytes - compressedBytes, 0);

    options.onProgress?.(1);
    return {
      id: `${asset.id}-${Date.now()}`,
      sourceId: asset.id,
      sourceUri: asset.uri,
      outputUri,
      libraryAssetId,
      filename: asset.filename,
      mediaType: asset.mediaType,
      quality: options.quality,
      originalBytes,
      compressedBytes,
      savedBytes,
      progress: 1,
      compressedAt: new Date().toISOString()
    };
  }
};

async function compressVideoInBackground(asset: PhotoAsset, profile: CompressionProfile, options: CompressOptions) {
  let backgroundTaskActive = false;
  try {
    await Video.activateBackgroundTask(() => {
      options.onProgress?.(0.96);
    });
    backgroundTaskActive = true;
  } catch {
    backgroundTaskActive = false;
  }

  try {
    return await Video.compress(
      asset.uri,
      {
        compressionMethod: "auto",
        maxSize: profile.videoMaxSize,
        minimumFileSizeForCompress: 0
      },
      (progress) => options.onProgress?.(Math.max(0.08, Math.min(progress, 0.96)))
    );
  } finally {
    if (backgroundTaskActive) {
      await Video.deactivateBackgroundTask().catch(() => undefined);
    }
  }
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
