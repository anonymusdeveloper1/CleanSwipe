import { requireOptionalNativeModule } from "expo-modules-core";
import { getFileSize } from "react-native-compressor";
import { ConvertEngineInput, ConvertEngineOutput, ConvertOptions } from "@/features/convert/convert.types";

/**
 * Video → audio (M4A / AAC) extraction via the local `SwipeCleanAudioExtract`
 * Expo module (Android MediaMuxer/MediaExtractor remux, iOS AVAssetExportSession)
 * — OS frameworks only, NOT FFmpeg, no MP3.
 *
 * Capability-probed with `requireOptionalNativeModule` (returns null until the
 * module is compiled into the build — needs a dev-client rebuild), so until then
 * `getSelectableTargets` hides the M4A chip and this is never invoked.
 */
type NativeAudioExtract = {
  extractAudio(inputUri: string, outputPath: string): Promise<string>;
};

let cached: NativeAudioExtract | null | undefined;

function getModule(): NativeAudioExtract | null {
  if (cached === undefined) {
    cached = requireOptionalNativeModule<NativeAudioExtract>("SwipeCleanAudioExtract");
  }
  return cached ?? null;
}

export function isAudioExtractAvailable(): boolean {
  return getModule() != null;
}

export async function extractAudioM4a(input: ConvertEngineInput, options: ConvertOptions): Promise<ConvertEngineOutput> {
  if (options.signal?.aborted) throw new Error("cancelled");
  const native = getModule();
  if (!native) throw new Error("audio-extract-unavailable");

  options.onProgress?.(0.1);
  // Persist to the app documents dir (audio is Share-only, not a gallery asset).
  // The native side takes a plain filesystem path (MediaMuxer / fileURLWithPath).
  const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
  const dir = FS.documentDirectory;
  if (!dir) throw new Error("convert-output-invalid");
  const outputPath = `${stripScheme(dir)}convert-${Date.now()}.m4a`;

  const outputUri = await native.extractAudio(input.uri, outputPath);
  options.onProgress?.(0.95);
  return { outputUri, outputSizeBytes: await readOutputSize(outputUri) };
}

const stripScheme = (uri: string): string => uri.replace(/^file:\/\//, "");

async function readOutputSize(uri: string): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}
