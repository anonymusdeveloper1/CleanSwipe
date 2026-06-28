/**
 * Pure target-resolution helpers for the converter — NO native/expo imports, so
 * this whole module is unit-testable under vitest (see convert-targets.test.ts).
 *
 * `getAvailableTargets` returns every format a given input could produce;
 * `getSelectableTargets` narrows that to what the current build can actually run
 * (image conversion is pure-JS and video→MP4 uses the always-linked compressor,
 * both always available; video→M4A needs an OS audio-extract native module).
 */
import { ConvertCapabilities, ConvertInputKind, ConvertOutputKind, ConvertTarget } from "@/features/convert/convert.types";
import { PhotoAsset } from "@/models/photo";

export const IMAGE_TARGETS: ConvertTarget[] = ["jpg", "png", "webp"];
export const VIDEO_TARGETS: ConvertTarget[] = ["mp4"];
export const AUDIO_TARGETS: ConvertTarget[] = ["m4a"];

const SHARE_MIME: Record<ConvertTarget, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  m4a: "audio/mp4"
};

export function inputKindForAsset(asset: Pick<PhotoAsset, "mediaType">): ConvertInputKind | undefined {
  if (asset.mediaType === "photo") return "image";
  if (asset.mediaType === "video") return "video";
  return undefined;
}

/** Every format this input could produce, regardless of build capabilities. */
export function getAvailableTargets(asset: Pick<PhotoAsset, "mediaType">): ConvertTarget[] {
  const kind = inputKindForAsset(asset);
  if (kind === "image") return [...IMAGE_TARGETS];
  if (kind === "video") return [...VIDEO_TARGETS, ...AUDIO_TARGETS];
  return [];
}

/** True if the target's engine is present in this build. */
export function isTargetAvailable(target: ConvertTarget, caps: ConvertCapabilities): boolean {
  if (target === "m4a") return caps.audioExtract;
  return true; // images + mp4 are always available
}

/** The targets the user can actually pick right now, given build capabilities. */
export function getSelectableTargets(asset: Pick<PhotoAsset, "mediaType">, caps: ConvertCapabilities): ConvertTarget[] {
  return getAvailableTargets(asset).filter((target) => isTargetAvailable(target, caps));
}

export function targetOutputKind(target: ConvertTarget): ConvertOutputKind {
  if (AUDIO_TARGETS.includes(target)) return "audio";
  if (VIDEO_TARGETS.includes(target)) return "video";
  return "image";
}

export function targetExtension(target: ConvertTarget): string {
  return target;
}

export function targetMimeForShare(target: ConvertTarget): string {
  return SHARE_MIME[target];
}

/** Display label for a format chip ("MP4", "JPG", …). */
export function targetLabel(target: ConvertTarget): string {
  return target.toUpperCase();
}
