import { requireOptionalNativeModule } from "expo-modules-core";
import { getFileSize } from "react-native-compressor";
import { ConvertEngineInput, ConvertEngineOutput, ConvertOptions, ConvertTarget } from "@/features/convert/convert.types";

/**
 * Video → audio extraction/encode. Three free, on-device targets:
 *   - m4a (AAC): OS frameworks — Android MediaMuxer/MediaExtractor remux, iOS
 *     AVAssetExportSession. Shipped by the legacy `SwipeCleanAudioExtract` module.
 *   - mp3: bundled LAME (LGPL) — decode the audio track to PCM, then LAME-encode.
 *   - wav: raw PCM + RIFF header — OS decoders only.
 * mp3 + wav (and a unified m4a path) live in the newer `SwipeCleanAudioEncode`
 * module. Both modules are capability-probed via `requireOptionalNativeModule`,
 * so a target stays hidden until its native side is compiled into the build.
 */
type LegacyExtract = { extractAudio(inputUri: string, outputPath: string): Promise<string> };
type AudioEncode = {
  encodeAudio(inputUri: string, outputPath: string, format: string): Promise<string>;
  // Reports whether the bundled LAME encoder is linked (false when the shared
  // library failed to load on this device/ABI, or on an older binary).
  supportsMp3?(): boolean;
};

let legacy: LegacyExtract | null | undefined;
let encoder: AudioEncode | null | undefined;

function getLegacy(): LegacyExtract | null {
  if (legacy === undefined) legacy = requireOptionalNativeModule<LegacyExtract>("SwipeCleanAudioExtract");
  return legacy ?? null;
}

function getEncoder(): AudioEncode | null {
  if (encoder === undefined) encoder = requireOptionalNativeModule<AudioEncode>("SwipeCleanAudioEncode");
  return encoder ?? null;
}

/** Which audio targets the current build can produce. */
export function audioCapabilities(): { m4a: boolean; mp3: boolean; wav: boolean } {
  const enc = getEncoder();
  const hasEncoder = enc != null;
  // m4a + wav are pure-SDK in the encode module; mp3 needs LAME linked, which the
  // native side reports via supportsMp3().
  let mp3 = false;
  try {
    mp3 = hasEncoder && typeof enc?.supportsMp3 === "function" && enc.supportsMp3() === true;
  } catch {
    mp3 = false;
  }
  return { m4a: hasEncoder || getLegacy() != null, mp3, wav: hasEncoder };
}

export async function convertAudio(input: ConvertEngineInput, target: ConvertTarget, options: ConvertOptions): Promise<ConvertEngineOutput> {
  if (options.signal?.aborted) throw new Error("cancelled");
  options.onProgress?.(0.1);

  // Audio is Share-only (not a gallery asset type) → app documents dir.
  const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
  const dir = FS.documentDirectory;
  if (!dir) throw new Error("convert-output-invalid");
  const outputPath = `${stripScheme(dir)}convert-${Date.now()}.${target}`;

  const enc = getEncoder();
  let outputUri: string;
  if (enc) {
    outputUri = await enc.encodeAudio(input.uri, outputPath, target);
  } else if (target === "m4a" && getLegacy()) {
    outputUri = await getLegacy()!.extractAudio(input.uri, outputPath);
  } else {
    throw new Error(
      target === "mp3" ? "audio-mp3-unavailable" : target === "wav" ? "audio-wav-unavailable" : "audio-extract-unavailable"
    );
  }

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
