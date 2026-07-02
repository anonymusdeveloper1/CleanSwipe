/**
 * Pure target-resolution helpers for the converter — NO native/expo imports, so
 * this whole module is unit-testable under vitest (see convert-targets.test.ts).
 *
 * Targets depend on BOTH the media kind AND the SOURCE format: we never offer a
 * conversion back to the file's own format (PNG→PNG, MP4→MP4 make no sense), and
 * a few sources have bespoke target sets (an animated GIF can become a static
 * image or an MP4). `getSelectableTargets` then narrows that to the formats whose
 * engine actually ships in the current build (capability-gated), so cross-platform
 * parity gaps (e.g. WebM landing on Android before iOS) degrade gracefully.
 */
import { ConvertCapabilities, ConvertInputKind, ConvertOutputKind, ConvertTarget } from "@/features/convert/convert.types";
import { PhotoAsset } from "@/models/photo";

export const IMAGE_TARGETS: ConvertTarget[] = ["jpg", "png", "webp"];
export const VIDEO_TARGETS: ConvertTarget[] = ["mp4", "webm", "gif"];
export const AUDIO_TARGETS: ConvertTarget[] = ["mp3", "m4a", "wav"];

const OUTPUT_KIND: Record<ConvertTarget, ConvertOutputKind> = {
  jpg: "image",
  png: "image",
  webp: "image",
  gif: "image",
  mp4: "video",
  webm: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio"
};

const SHARE_MIME: Record<ConvertTarget, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav"
};

// Display label for a format chip ("MP4", "JPG", …). Kept distinct from the raw
// token so we can prettify (e.g. always show "JPG", never "JPEG").
const DISPLAY_LABEL: Record<ConvertTarget, string> = {
  jpg: "JPG",
  png: "PNG",
  webp: "WEBP",
  gif: "GIF",
  mp4: "MP4",
  webm: "WebM",
  mp3: "MP3",
  m4a: "M4A",
  wav: "WAV"
};

export function inputKindForAsset(asset: Pick<PhotoAsset, "mediaType">): ConvertInputKind | undefined {
  if (asset.mediaType === "photo") return "image";
  if (asset.mediaType === "video") return "video";
  return undefined;
}

/**
 * Normalizes a filename or uri to a short format token ("jpg", "png", "mp4", …)
 * — the basis for both the source badge and the same-format exclusion. Returns
 * undefined when no usable extension is present.
 */
export function sourceFormat(fileNameOrUri?: string): ConvertTarget | "heic" | "mov" | undefined {
  if (!fileNameOrUri) return undefined;
  const clean = fileNameOrUri.split(/[?#]/)[0];
  const base = clean.split("/").pop() ?? clean;
  const dot = base.lastIndexOf(".");
  // Need a real extension delimiter that isn't the first or last char.
  if (dot <= 0 || dot === base.length - 1) return undefined;
  const ext = base.slice(dot + 1).toLowerCase();
  if (ext.length < 2 || ext.length > 5 || !/^[a-z0-9]+$/.test(ext)) return undefined;
  if (ext === "jpeg" || ext === "jpe" || ext === "jfif") return "jpg";
  if (ext === "heif") return "heic";
  if (ext === "qt") return "mov";
  return ext as ConvertTarget | "heic" | "mov";
}

/** Uppercase source badge label ("JPG", "HEIC", "MP4"); falls back to a kind label. */
export function sourceFormatLabel(asset: Pick<PhotoAsset, "mediaType" | "filename" | "uri">): string {
  const fmt = sourceFormat(asset.filename) ?? sourceFormat(asset.uri);
  if (fmt) return fmt.toUpperCase();
  return asset.mediaType === "video" ? "VIDEO" : "PHOTO";
}

/** Every format this input could produce — same-format excluded, regardless of build capabilities. */
export function getAvailableTargets(asset: Pick<PhotoAsset, "mediaType" | "filename" | "uri">): ConvertTarget[] {
  const kind = inputKindForAsset(asset);
  const fmt = sourceFormat(asset.filename) ?? sourceFormat(asset.uri);
  let base: ConvertTarget[];
  if (kind === "image") {
    // A GIF source converts to a still image (first frame) via the image engine;
    // animated GIF→MP4 is not offered. Video→GIF is the headline GIF feature.
    base = [...IMAGE_TARGETS];
  } else if (kind === "video") {
    base = [...VIDEO_TARGETS, ...AUDIO_TARGETS];
  } else {
    return [];
  }
  // Never offer converting to the source's own format.
  return base.filter((target) => target !== fmt);
}

/** True if the target's engine is present in this build. */
export function isTargetAvailable(target: ConvertTarget, caps: ConvertCapabilities): boolean {
  switch (target) {
    case "jpg":
    case "png":
    case "webp":
    case "mp4":
      return true; // pure-JS image engine + always-linked compressor
    case "m4a":
      return caps.audioM4a;
    case "mp3":
      return caps.audioMp3;
    case "wav":
      return caps.audioWav;
    case "webm":
      return caps.webm;
    case "gif":
      return caps.gif;
    default:
      return false;
  }
}

/** The targets the user can actually pick right now, given build capabilities. */
export function getSelectableTargets(asset: Pick<PhotoAsset, "mediaType" | "filename" | "uri">, caps: ConvertCapabilities): ConvertTarget[] {
  return getAvailableTargets(asset).filter((target) => isTargetAvailable(target, caps));
}

export function targetOutputKind(target: ConvertTarget): ConvertOutputKind {
  return OUTPUT_KIND[target];
}

export function targetExtension(target: ConvertTarget): string {
  return target;
}

export function targetMimeForShare(target: ConvertTarget): string {
  return SHARE_MIME[target];
}

/** Display label for a format chip ("MP4", "JPG", …). */
export function targetLabel(target: ConvertTarget): string {
  return DISPLAY_LABEL[target] ?? target.toUpperCase();
}
