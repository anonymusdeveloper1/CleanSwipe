import { CompressionJobInput } from "@/features/compression/compression.types";
import { CompressionQuality, PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";

export function createCompressionJobInput(asset: PhotoAsset, quality: CompressionQuality): CompressionJobInput | undefined {
  if (asset.mediaType !== "photo" && asset.mediaType !== "video") return undefined;
  const estimate = CompressionService.estimate(asset, quality);
  return {
    mediaId: asset.id,
    uri: asset.uri,
    fileName: asset.filename,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    monthKey: asset.monthKey,
    originalSizeBytes: estimate.originalBytes,
    estimatedReducedSizeBytes: estimate.compressedBytes,
    quality
  };
}
