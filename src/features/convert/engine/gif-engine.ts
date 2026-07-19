import { requireOptionalNativeModule } from "expo-modules-core";
import { getFileSize } from "react-native-compressor";
import { ConvertEngineInput, ConvertEngineOutput, ConvertOptions } from "@/features/convert/convert.types";

/**
 * Animated GIF engine (`SwipeCleanGif`): video → animated GIF.
 *   - iOS: native `SwipeCleanGif.videoToGif` (ImageIO CGImageDestination + UTType.gif).
 *   - Android: not implemented — the native module is absent, so `isGifAvailable()`
 *     is false and the GIF chip stays hidden.
 * Capability-probed — the GIF chip on a video stays hidden until the module ships on
 * a platform. (A GIF SOURCE converts to a still image via the image engine; animated
 * GIF→MP4 is not offered yet.)
 */
type GifModule = {
  videoToGif(inputUri: string, outputPath: string): Promise<string>;
};

let mod: GifModule | null | undefined;

function getModule(): GifModule | null {
  if (mod === undefined) mod = requireOptionalNativeModule<GifModule>("SwipeCleanGif");
  return mod ?? null;
}

export function isGifAvailable(): boolean {
  return getModule() != null;
}

/** video → animated gif. */
export async function convertToGif(input: ConvertEngineInput, options: ConvertOptions): Promise<ConvertEngineOutput> {
  if (options.signal?.aborted) throw new Error("cancelled");
  const native = getModule();
  if (!native) throw new Error("gif-unavailable");

  options.onProgress?.(0.1);
  const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
  const dir = FS.cacheDirectory ?? FS.documentDirectory;
  if (!dir) throw new Error("convert-output-invalid");
  const outputPath = `${dir.replace(/^file:\/\//, "")}convert-${Date.now()}.gif`;

  const outputUri = await native.videoToGif(input.uri, outputPath);
  options.onProgress?.(0.95);
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
