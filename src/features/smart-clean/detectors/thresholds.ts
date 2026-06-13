/**
 * Smart Clean detector thresholds — the single tunable surface.
 *
 * These are the knobs to adjust when tuning detection quality on a real library.
 * They are deliberately gathered here (rather than scattered as inline magic
 * numbers) so a tuning pass is a one-file change. Everything here is pure data;
 * no native, no React. Detectors import from this module.
 *
 * NOTE: the perceptual thresholds are calibrated for the hash grids defined in
 * hash-utils.ts (DHASH_RESIZE 9x8 → 64-bit dHash; BLUR_RESIZE 64x64). Changing
 * those resize dimensions invalidates the Hamming/variance thresholds below.
 */

// ── Perceptual hashing (tier 2: similar / blurry / duplicate-videos) ──────────

/** Max Hamming distance (of 64 bits) to treat two photos as near-duplicate "similar". */
export const DHASH_SIMILAR_MAX = 10;

/** Tighter Hamming distance for duplicate VIDEOS compared via extracted thumbnails. */
export const DHASH_DUP_MAX = 6;

/** Variance-of-Laplacian below this ⇒ blurry (tuned for a 64x64 grayscale frame). */
export const BLUR_VARIANCE_THRESHOLD = 120;

// ── Screenshots (tier 1) ──────────────────────────────────────────────────────

/**
 * How close an asset's aspect ratio must be to the device screen's to count as a
 * screen-shaped image (one screenshot signal). Larger ⇒ more permissive.
 */
export const SCREENSHOT_ASPECT_TOLERANCE = 0.03;

/** Multi-signal score at/above which an asset is classified as a screenshot. */
export const SCREENSHOT_CLASSIFY_SCORE = 2;

// ── Memes (tier 3, conservative metadata heuristic) ───────────────────────────

/** A "small file" signal: under this many bytes (combined with a small long edge). */
export const MEME_MAX_BYTES = 600 * 1024;

/** Upper bound on the long edge (px) for the small-image meme signal. */
export const MEME_MAX_LONG_EDGE = 1280;

/** Normalized classifier confidence (0..1) at/above which an asset counts as a meme. */
export const MEME_CLASSIFY_THRESHOLD = 0.5;
