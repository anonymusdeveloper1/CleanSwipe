/**
 * Image → image conversion via expo-image-manipulator's SDK-54 context API
 * (`manipulate().renderAsync().saveAsync()`). Pure JS — no native rebuild
 * required, since ExpoImageManipulator is already linked into the build.
 *
 * We probe the native module BEFORE importing the wrapper: importing
 * expo-image-manipulator runs a top-level `requireNativeModule` that throws a
 * redbox when the native side is absent (older dev clients) — see
 * native-capabilities.ts.
 */
import { getFileSize } from "react-native-compressor";
import { probeCapability } from "@/features/smart-clean/native-capabilities";
import {
  ConvertEngineInput,
  ConvertEngineOutput,
  ConvertImageTarget,
  ConvertOptions,
  ConvertTarget
} from "@/features/convert/convert.types";

// JPEG/WEBP output quality (0..1). PNG is lossless and ignores this. High enough
// that a format change stays visually lossless while still re-encoding.
const IMAGE_OUTPUT_QUALITY = 0.92;

const SAVE_FORMAT_BY_TARGET: Record<ConvertImageTarget, "jpeg" | "png" | "webp"> = {
  jpg: "jpeg",
  png: "png",
  webp: "webp"
};

export async function convertImage(input: ConvertEngineInput, target: ConvertTarget, options: ConvertOptions): Promise<ConvertEngineOutput> {
  if (options.signal?.aborted) throw new Error("cancelled");

  const formatName = SAVE_FORMAT_BY_TARGET[target as ConvertImageTarget];
  if (!formatName) throw new Error(`Unsupported image target: ${target}`);

  if (!probeCapability("imageManipulator")) {
    throw new Error("image-manipulator-unavailable");
  }

  options.onProgress?.(0.1);
  const IM = await import("expo-image-manipulator");
  const context = IM.ImageManipulator.manipulate(input.uri);
  const rendered = await context.renderAsync();
  options.onProgress?.(0.6);

  const result = await rendered.saveAsync({
    format: toSaveFormat(IM, formatName),
    compress: IMAGE_OUTPUT_QUALITY
  });
  options.onProgress?.(0.95);
  return { outputUri: result.uri, outputSizeBytes: await readOutputSize(result.uri) };
}

function toSaveFormat(IM: typeof import("expo-image-manipulator"), format: "jpeg" | "png" | "webp") {
  if (format === "png") return IM.SaveFormat.PNG;
  if (format === "webp") return IM.SaveFormat.WEBP;
  return IM.SaveFormat.JPEG;
}

async function readOutputSize(uri: string): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}
