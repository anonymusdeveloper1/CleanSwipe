/**
 * Engine seam for the converter. The store/UI call ONLY `convertMedia(...)` and
 * never import a concrete engine — so a target's backend can change (or land on a
 * new platform) without touching callers.
 *
 *  - image targets (jpg/png/webp) → ImageManipulatorEngine (pure JS; also decodes
 *    HEIC/HEIF and a GIF's first frame, so those sources convert with no native add)
 *  - video → mp4                  → react-native-compressor (already linked)
 *  - gif source → mp4             → GifEngine (frame-decode → H.264)
 *  - video → webm                 → WebmEngine (native VP8/VP9, capability-gated)
 *  - video → gif                  → GifEngine (native, capability-gated)
 *  - video → audio (mp3/m4a/wav)  → AudioEngine (native, capability-gated)
 */
import { targetOutputKind } from "@/features/convert/convert-targets";
import { ConvertCapabilities, ConvertEngineInput, ConvertEngineOutput, ConvertOptions, ConvertTarget } from "@/features/convert/convert.types";
import { audioCapabilities, convertAudio } from "@/features/convert/engine/audio-engine";
import { convertToGif, isGifAvailable } from "@/features/convert/engine/gif-engine";
import { convertImage } from "@/features/convert/engine/image-manipulator-engine";
import { convertVideoToMp4 } from "@/features/convert/engine/video-engine";
import { convertVideoToWebm, isWebmAvailable } from "@/features/convert/engine/webm-engine";

/** Which optional engines are present in this build (drives the format chips). */
export function getConvertCapabilities(): ConvertCapabilities {
  const audio = audioCapabilities();
  return {
    audioM4a: audio.m4a,
    audioMp3: audio.mp3,
    audioWav: audio.wav,
    webm: isWebmAvailable(),
    gif: isGifAvailable()
  };
}

export async function convertMedia(input: ConvertEngineInput, target: ConvertTarget, options: ConvertOptions): Promise<ConvertEngineOutput> {
  const kind = targetOutputKind(target);
  if (kind === "audio") return convertAudio(input, target, options);
  if (target === "webm") return convertVideoToWebm(input, options);
  if (target === "gif") return convertToGif(input, options);
  if (target === "mp4") return convertVideoToMp4(input, options);
  return convertImage(input, target, options);
}
