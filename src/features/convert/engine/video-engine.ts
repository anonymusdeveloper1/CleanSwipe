import { getFileSize, Video } from "react-native-compressor";
import { ConvertEngineInput, ConvertEngineOutput, ConvertOptions } from "@/features/convert/convert.types";

/**
 * Video → MP4 (H.264) via react-native-compressor. The compressor is ALREADY
 * statically linked (the Compress feature uses it), so this needs NO native
 * rebuild and works on the current dev client. It re-encodes into an MP4
 * container; "auto" picks a reasonable bitrate. No FFmpeg, no GPL, no 16KB hunt.
 */
export async function convertVideoToMp4(input: ConvertEngineInput, options: ConvertOptions): Promise<ConvertEngineOutput> {
  if (options.signal?.aborted) throw new Error("cancelled");
  const outputUri = await Video.compress(
    input.uri,
    { compressionMethod: "auto" },
    (progress) => options.onProgress?.(Math.max(0, Math.min(progress, 0.99)))
  );
  return { outputUri, outputSizeBytes: await readOutputSize(outputUri) };
}

async function readOutputSize(uri: string): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}
