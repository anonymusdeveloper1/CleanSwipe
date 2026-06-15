/**
 * Generates and caches small thumbnails so media grids NEVER hand a
 * full-resolution source to the image decoder.
 *
 * A 50+ MP photo decoded at native size is a 200 MB+ ARGB_8888 bitmap;
 * fast-scrolling a grid of them OOM-crashes the app (confirmed on-device: a
 * 222 MB allocation → OutOfMemoryError → GC storm → ANR). Capping the decode
 * resolution is the fix; raising the heap is not.
 *
 * IMPORTANT: we resize via react-native-compressor (`Image.compress`), NOT
 * expo-image-manipulator. The compressor downsamples DURING decode (Android
 * BitmapFactory inSampleSize), so a 53 MP source is read straight to ~512 px
 * and never allocates the full-res bitmap. expo-image-manipulator's `resize`
 * decodes the full bitmap first, which still spikes native memory (~1.3 GB with
 * a few concurrent) and janks the first scroll. react-native-compressor is also
 * statically linked (always present — it powers the compression feature), so
 * this works without a native rebuild.
 *
 * Strategy: downscale each source ONCE, cache the result on disk keyed by asset
 * id + target size, and feed the tiny file to expo-image. Subsequent mounts and
 * app restarts reuse the cached file. Fully fail-safe: on ANY failure it returns
 * the ORIGINAL uri — degrading to today's behavior, never worse. No top-level
 * native imports (red-box risk pre-rebuild — see native-capabilities.ts).
 */

const THUMB_MIN_PX = 256;
const THUMB_MAX_PX = 512;
const THUMB_STEP_PX = 128;
const THUMB_QUALITY = 0.6;
// Bound how many resizes run at once so a fast fling can't launch a burst of
// concurrent decodes. Video frame extraction is heavier, so keep this modest.
const MAX_CONCURRENT = 3;

// `${key}|${px}` -> resolved thumbnail uri. Skips the FS stat on re-mount.
const resolvedCache = new Map<string, string>();
// `${key}|${px}` -> in-flight generation. Dedupes concurrent requests so two
// cells asking for the same thumbnail don't both decode/move.
const inflight = new Map<string, Promise<string>>();

let active = 0;
const waiters: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  // Wait for a freed slot; release() hands it over without decrementing.
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) next();
  else active -= 1;
}

function bucketPx(requestedPx: number): number {
  const rounded = Math.ceil(requestedPx / THUMB_STEP_PX) * THUMB_STEP_PX;
  return Math.max(THUMB_MIN_PX, Math.min(THUMB_MAX_PX, rounded));
}

function safeFileKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "_");
}

function ensureFileUri(uri: string): string {
  return /^[a-z]+:\/\//i.test(uri) ? uri : `file://${uri}`;
}

/**
 * Returns a small cached thumbnail uri for `sourceUri`, or `sourceUri` itself if
 * a thumbnail can't be produced. `key` must be a stable per-asset identifier
 * (e.g. a MediaLibrary asset id). `targetPx` is the intended on-screen size in
 * DEVICE pixels (use PixelRatio.getPixelSizeForLayoutSize on the cell's dp size).
 * For videos, set `isVideo` so a frame is extracted before downscaling.
 */
export async function getThumbnailUri(
  sourceUri: string,
  opts: { key: string; targetPx: number; isVideo?: boolean }
): Promise<string> {
  const px = bucketPx(opts.targetPx);
  const cacheKey = `${opts.key}|${px}`;

  const done = resolvedCache.get(cacheKey);
  if (done) return done;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const task = resolveThumbnail(sourceUri, safeFileKey(opts.key), px, !!opts.isVideo)
    .then((uri) => {
      // Only cache real thumbnails — never poison the cache with the fallback,
      // so a transient failure can retry on the next mount.
      if (uri !== sourceUri) resolvedCache.set(cacheKey, uri);
      return uri;
    })
    .catch(() => sourceUri)
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, task);
  return task;
}

async function resolveThumbnail(sourceUri: string, fileKey: string, px: number, isVideo: boolean): Promise<string> {
  const FS: any = await import("expo-file-system/legacy");
  const cacheDir: string | undefined = FS.cacheDirectory;
  if (!cacheDir) return sourceUri;

  const dest = `${cacheDir}sc-thumb-${fileKey}-${px}.jpg`;

  // Cached from a previous session?
  if (await fileExists(FS, dest)) return dest;

  await acquire();
  try {
    // Another task may have produced it while we waited for a slot.
    if (await fileExists(FS, dest)) return dest;

    const compressor: any = await import("react-native-compressor");

    // For a video, pull a single frame first; compress() only takes images.
    let imageUri = sourceUri;
    if (isVideo) {
      const frame = await compressor.createVideoThumbnail(sourceUri, { quality: THUMB_QUALITY });
      if (!frame?.path) return sourceUri;
      imageUri = ensureFileUri(frame.path);
    }

    // Downscale-on-decode (inSampleSize) → the longest edge is capped at `px`,
    // so the worst-case bitmap is px*px*4 ≈ 1 MB (vs 200 MB+ for the source).
    const out: string = await compressor.Image.compress(imageUri, {
      compressionMethod: "manual",
      maxWidth: px,
      maxHeight: px,
      quality: THUMB_QUALITY,
      output: "jpg",
      returnableOutputType: "uri"
    });
    if (!out) return sourceUri;

    // Move into the deterministic cache path so it survives app restarts.
    try {
      await FS.moveAsync({ from: ensureFileUri(out), to: dest });
      return dest;
    } catch {
      // dest may already exist (raced by another writer) — prefer it and clean
      // up our temp output; otherwise use the compressor's (already small) output.
      if (await fileExists(FS, dest)) {
        await safeDelete(FS, out);
        return dest;
      }
      return ensureFileUri(out);
    }
  } finally {
    release();
  }
}

async function fileExists(FS: any, uri: string): Promise<boolean> {
  try {
    const info = await FS.getInfoAsync(uri);
    return !!info?.exists;
  } catch {
    return false;
  }
}

async function safeDelete(FS: any, uri: string): Promise<void> {
  try {
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort; a leftover temp file is harmless (OS reclaims the cache dir).
  }
}
