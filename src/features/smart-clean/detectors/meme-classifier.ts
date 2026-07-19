import { MEME_CLASSIFY_THRESHOLD, MEME_MAX_BYTES, MEME_MAX_LONG_EDGE } from "@/features/smart-clean/detectors/thresholds";

/**
 * PURE meme-scoring core (no native, no React) so it can be unit-tested and kept
 * honest independently of the native detector wiring in tier3-memes.ts.
 *
 * Scoring is deliberately CONSERVATIVE: a "strong" signal — a meme-y filename or
 * a meme source album (Download / WhatsApp / Telegram / saved / memes) — is
 * REQUIRED to classify. The weak signals (small-image, no-camera-EXIF) may only
 * corroborate a strong one, never classify on their own. Without that gate,
 * every small EXIF-less saved image / screenshot gets flagged (it over-matched
 * ~27/32 on iOS, where filenames are IMG_#### and there is no meme album).
 */

export const MEME_FILENAME_RE = /(meme|whatsapp|telegram|download|fb_img|received|reddit|9gag|screenshot)/i;
export const WHATSAPP_NAME_RE = /img-\d{8}-wa\d+/i;
export const MEME_ALBUM_RE = /(download|whatsapp|telegram|saved|memes)/i;

export function hasMemeNameSignal(filename: string): boolean {
  return MEME_FILENAME_RE.test(filename) || WHATSAPP_NAME_RE.test(filename);
}

/**
 * Whether the (expensive) camera-EXIF lookup can affect the outcome for this
 * asset — true only when there's a filename signal and it isn't already album-
 * confirmed. Lets the detector skip `getAssetInfoAsync` for the common case.
 */
export function memeNeedsExifCheck(filename: string, inMemeAlbum: boolean): boolean {
  return hasMemeNameSignal(filename) && !inMemeAlbum;
}

export type MemeScoreInput = {
  filename: string;
  longEdge: number;
  sizeBytes: number;
  inMemeAlbum: boolean;
  /** Result of the camera-EXIF check; pass false when it wasn't run (see memeNeedsExifCheck). */
  lacksCameraExif: boolean;
};

/** 0..1 confidence that the asset is a meme/saved image. */
export function memeScore(input: MemeScoreInput): number {
  let score = 0;
  if (input.inMemeAlbum) score += 2; // strong: source album membership
  const nameSignal = hasMemeNameSignal(input.filename);
  if (nameSignal) score += 1; // strong-ish: meme-y filename
  if (input.sizeBytes < MEME_MAX_BYTES && input.longEdge > 0 && input.longEdge <= MEME_MAX_LONG_EDGE) score += 1; // weak: small image
  if (nameSignal && !input.inMemeAlbum && input.lacksCameraExif) score += 1; // weak: corroborates a name signal only
  return Math.min(score / 4, 1);
}

/** True when the score clears the classification threshold. */
export function isMeme(input: MemeScoreInput): boolean {
  return memeScore(input) >= MEME_CLASSIFY_THRESHOLD;
}
