import { inputKindForAsset, targetOutputKind } from "@/features/convert/convert-targets";
import { ConversionJobInput, ConvertTarget } from "@/features/convert/convert.types";
import { PhotoAsset } from "@/models/photo";
import { getOriginalBytes } from "@/services/compression-service";

/**
 * Builds the enqueue payload for a conversion. Returns undefined for an asset
 * whose media type can't be converted (e.g. "unknown"). Reuses
 * `getOriginalBytes` so a missing `sizeBytes` is estimated the same way the
 * compression pipeline does.
 */
export function createConversionJobInput(asset: PhotoAsset, target: ConvertTarget | undefined): ConversionJobInput | undefined {
  const inputKind = inputKindForAsset(asset);
  // Guard a missing target (e.g. an audio (m4a) target staged on a build without
  // the audio-extract module) so we never enqueue a job with target=undefined.
  if (!inputKind || !target) return undefined;
  return {
    mediaId: asset.id,
    uri: asset.uri,
    fileName: asset.filename,
    inputKind,
    target,
    outputKind: targetOutputKind(target),
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    originalSizeBytes: getOriginalBytes(asset)
  };
}
