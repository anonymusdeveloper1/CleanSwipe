import { requireOptionalNativeModule } from "expo-modules-core";
import { getFileSize } from "react-native-compressor";
import { ConvertEngineInput, ConvertEngineOutput, ConvertOptions } from "@/features/convert/convert.types";

/**
 * Video → WebM (VP8/VP9). No OS framework muxes WebM, so this is a dedicated
 * native module (`SwipeCleanWebm`):
 *   - Android: MediaCodec (VP8/VP9 encoder) + MediaMuxer(MUXER_OUTPUT_WEBM).
 *   - iOS: bundled libvpx (VP8/VP9, BSD) + libwebm muxer — ships after Android
 *     (cross-platform parity caveat), so the probe returns null on iOS until then.
 * Capability-probed: the "WebM" chip is hidden wherever the module is absent.
 */
type WebmModule = { toWebm(inputUri: string, outputPath: string): Promise<string> };

let mod: WebmModule | null | undefined;

function getModule(): WebmModule | null {
  if (mod === undefined) mod = requireOptionalNativeModule<WebmModule>("SwipeCleanWebm");
  return mod ?? null;
}

export function isWebmAvailable(): boolean {
  return getModule() != null;
}

export async function convertVideoToWebm(input: ConvertEngineInput, options: ConvertOptions): Promise<ConvertEngineOutput> {
  if (options.signal?.aborted) throw new Error("cancelled");
  const native = getModule();
  if (!native) throw new Error("webm-unavailable");

  options.onProgress?.(0.1);
  const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
  const dir = FS.cacheDirectory ?? FS.documentDirectory;
  if (!dir) throw new Error("convert-output-invalid");
  const outputPath = `${dir.replace(/^file:\/\//, "")}convert-${Date.now()}.webm`;

  const outputUri = await native.toWebm(input.uri, outputPath);
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
