import { probeCapability } from "@/features/smart-clean/native-capabilities";
import {
  BLUR_RESIZE,
  DHASH_RESIZE,
  dHashFromGray,
  downscaleGray,
  laplacianVariance,
  rgbaToGrayMatrix
} from "@/features/smart-clean/detectors/hash-utils";

/**
 * The ONLY module that touches expo-image-manipulator + jpeg-js. Both are
 * reached lazily inside functions (never at module top), and every entry point
 * returns undefined when the native side is absent (current APK) or decoding
 * fails — so Tier 2 detectors degrade to "not_available"/skip without crashing.
 *
 * Pipeline: manipulator downscales to a tiny JPEG (jpeg-js can ONLY decode
 * JPEG) → decode to RGBA → grayscale → perceptual hash / Laplacian variance.
 */

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const lookup = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) table[BASE64_ALPHABET.charCodeAt(i)] = i;
  return table;
})();

function base64ToBytes(base64: string): Uint8Array {
  // Strip any data-URI prefix and padding.
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  let length = clean.length;
  while (length > 0 && clean[length - 1] === "=") length -= 1;
  const byteLength = (length * 3) >> 2;
  const bytes = new Uint8Array(byteLength);
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < length; i++) {
    const value = lookup[clean.charCodeAt(i)];
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return outIndex === bytes.length ? bytes : bytes.subarray(0, outIndex);
}

async function decodeGray(uri: string, size: { width: number; height: number }): Promise<number[][] | undefined> {
  if (!(await probeCapability("imageManipulator"))) return undefined;
  try {
    const IM: any = await import("expo-image-manipulator");
    const jpeg: any = await import("jpeg-js");
    const result = await IM.manipulateAsync(uri, [{ resize: { width: size.width, height: size.height } }], {
      base64: true,
      compress: 1,
      format: IM.SaveFormat.JPEG
    });
    if (!result?.base64) return undefined;
    const decoded = jpeg.decode(base64ToBytes(result.base64), { useTArray: true, formatAsRGBA: true });
    if (!decoded?.data || !decoded.width || !decoded.height) return undefined;
    return rgbaToGrayMatrix(decoded.data, decoded.width, decoded.height);
  } catch {
    return undefined;
  }
}

/** dHash only (used for VIDEO thumbnails, which are already small single frames). */
export async function computeDHash(uri: string): Promise<string | undefined> {
  const gray = await decodeGray(uri, DHASH_RESIZE);
  return gray ? dHashFromGray(gray) : undefined;
}

/**
 * SINGLE-DECODE photo pipeline: decode ONCE at the 64x64 blur grid and derive
 * BOTH the dHash (by average-pooling the 64x64 gray to 9x8) and the blur
 * variance. This is the photo fast path used by the similar + blurry detectors
 * and the concurrent pre-pass — a photo that feeds both is now decoded once, not
 * twice. The blur grid is unchanged (64x64), so BLUR_VARIANCE_THRESHOLD stays
 * valid; the dHash is now derived from the 64x64 downscale rather than a direct
 * 9x8 resize, so the persisted feature cache is version-bumped to drop old
 * dHashes (see feature-cache-store).
 */
export async function computeGrayFeatures(uri: string): Promise<{ dHash: string; blurVar: number } | undefined> {
  const gray = await decodeGray(uri, BLUR_RESIZE);
  if (!gray) return undefined;
  const blurVar = laplacianVariance(gray);
  const dHash = dHashFromGray(downscaleGray(gray, DHASH_RESIZE.width, DHASH_RESIZE.height));
  return { dHash, blurVar };
}
