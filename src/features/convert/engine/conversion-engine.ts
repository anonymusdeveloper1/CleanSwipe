/**
 * Engine seam for the converter. The store/UI call ONLY `convertMedia(...)` and
 * never import a concrete engine — so a target's backend can change without
 * touching callers.
 *
 *  - image targets (jpg/png/webp) → ImageManipulatorEngine (pure JS, always)
 *  - video → mp4                  → react-native-compressor (already linked)
 *  - video → audio (m4a)          → native OS audio-extract module (gated)
 */
import { targetOutputKind } from "@/features/convert/convert-targets";
import { ConvertCapabilities, ConvertEngineInput, ConvertEngineOutput, ConvertOptions, ConvertTarget } from "@/features/convert/convert.types";
import { extractAudioM4a, isAudioExtractAvailable } from "@/features/convert/engine/audio-engine";
import { convertImage } from "@/features/convert/engine/image-manipulator-engine";
import { convertVideoToMp4 } from "@/features/convert/engine/video-engine";

/** Which optional engines are present in this build (drives the format chips). */
export function getConvertCapabilities(): ConvertCapabilities {
  return { audioExtract: isAudioExtractAvailable() };
}

export async function convertMedia(input: ConvertEngineInput, target: ConvertTarget, options: ConvertOptions): Promise<ConvertEngineOutput> {
  const kind = targetOutputKind(target);
  if (kind === "audio") return extractAudioM4a(input, options);
  if (kind === "video") return convertVideoToMp4(input, options);
  return convertImage(input, target, options);
}
