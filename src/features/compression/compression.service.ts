import { CompressionJob, CompressionResult } from "@/features/compression/compression.types";
import { PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { getFileSize } from "react-native-compressor";

/**
 * CANCELLATION: react-native-compressor cannot be aborted mid-encode from here,
 * so a cancelled job runs to completion in the background. `isCancelled()` is
 * re-checked before the library write so a cancelled compression never leaves an
 * orphan copy in the gallery (which would also exclude the source from every
 * future cleanup scan), and the temp output is removed.
 */
export async function compressMediaJob(
  job: CompressionJob,
  callbacks: {
    onProgress: (progress: number) => void;
    onCompleted: (result: CompressionResult) => void;
    onError: (error: Error) => void;
    /** True once the user cancelled this job. Re-read, never cached. */
    isCancelled?: () => boolean;
  }
) {
  try {
    callbacks.onProgress(0);
    const compressed = await CompressionService.compress(toPhotoAsset(job), {
      quality: job.quality,
      onProgress: (progress) => callbacks.onProgress(Math.max(0, Math.min(progress, 0.99)))
    });

    // Verify the temporary output BEFORE persisting it to the library, so a
    // failed verification never leaves an orphaned asset in the gallery.
    const verification = await verifyCompressedOutput({
      originalUri: job.uri,
      originalSizeBytes: compressed.originalBytes,
      outputUri: compressed.outputUri,
      mediaType: job.mediaType
    });
    if (!verification.isValid) {
      throw new Error(verification.reason ?? "The compressed file could not be verified. Your original file was not changed.");
    }

    // Cancelled while the native encode was running: discard the output instead
    // of saving it. The store's markCompleted() already early-returns for a
    // cancelled job, but that runs AFTER saveToLibrary — so without this check
    // the gallery still gets a copy the user explicitly cancelled.
    if (callbacks.isCancelled?.()) {
      await deleteTempOutput(compressed.outputUri);
      return;
    }

    // Only now save to the device library. If the save fails (no asset id), the
    // job MUST fail — otherwise the user could delete the original with no
    // durable compressed copy and lose the media permanently.
    const libraryAssetId = await CompressionService.saveToLibrary(compressed.outputUri);
    if (!libraryAssetId) {
      throw new Error("The compressed copy could not be saved to your library. Your original file was not changed.");
    }

    const item = { ...compressed, libraryAssetId, savedBytes: verification.savedBytes };
    const result: CompressionResult = {
      item,
      outputUri: item.outputUri,
      tempOutputUri: item.outputUri,
      originalSizeBytes: verification.originalSizeBytes,
      finalSizeBytes: verification.finalSizeBytes,
      savedBytes: verification.savedBytes,
      compressionRatio: verification.originalSizeBytes > 0 ? verification.finalSizeBytes / verification.originalSizeBytes : 1,
      mediaType: job.mediaType,
      libraryAssetId
    };
    callbacks.onProgress(1);
    callbacks.onCompleted(result);
  } catch (error) {
    const normalizedError = normalizeCompressionError(error);
    callbacks.onError(normalizedError);
    throw normalizedError;
  }
}

export async function verifyCompressedOutput({
  originalUri,
  originalSizeBytes,
  outputUri,
  mediaType
}: {
  originalUri: string;
  originalSizeBytes?: number;
  outputUri: string;
  mediaType: "photo" | "video";
}) {
  const finalSizeBytes = await readKnownFileSize(outputUri);
  if (!Number.isFinite(finalSizeBytes) || finalSizeBytes <= 0) {
    return {
      isValid: false,
      originalSizeBytes: originalSizeBytes ?? 0,
      finalSizeBytes: 0,
      savedBytes: 0,
      reason: "The compressed file could not be verified. Your original file was not changed."
    };
  }

  // Delete-safety: this "did it shrink?" check gates whether the ORIGINAL may be
  // deleted, so it MUST compare against the REAL original file size, never the
  // caller's estimate. `originalSizeBytes` comes from getOriginalBytes(), which
  // returns a pixels-based ESTIMATE when the media index has no real size. An
  // estimate that over-states the original would let a compressed copy that is
  // actually LARGER than the true original pass verification and allow deleting
  // the smaller real file. So read the real size first; fall back to the estimate
  // only when the file genuinely cannot be read.
  const realOriginalSize = await readKnownFileSize(originalUri);
  const knownOriginalSize =
    realOriginalSize > 0 ? realOriginalSize : originalSizeBytes && originalSizeBytes > 0 ? originalSizeBytes : 0;
  if (!Number.isFinite(knownOriginalSize) || knownOriginalSize <= 0) {
    return {
      isValid: false,
      originalSizeBytes: 0,
      finalSizeBytes,
      savedBytes: 0,
      reason: "The original file could not be verified. Your original file was not changed."
    };
  }

  // Reject an output that did not actually shrink the file. Some sources are
  // already efficiently encoded (e.g. a low-bitrate or short video), and a
  // re-encode can produce a file the same size or LARGER than the original.
  // Saving it would add a bigger copy to the gallery and report negative
  // savings, so fail verification here — before saveToLibrary — which leaves
  // the original untouched and surfaces an "already optimized" message.
  if (finalSizeBytes >= knownOriginalSize) {
    return {
      isValid: false,
      originalSizeBytes: knownOriginalSize,
      finalSizeBytes,
      savedBytes: 0,
      reason: "This file is already optimized, so compressing it would not save space. Your original file was left unchanged."
    };
  }

  return {
    isValid: true,
    originalSizeBytes: knownOriginalSize,
    finalSizeBytes,
    savedBytes: knownOriginalSize - finalSizeBytes
  };
}

/** Best-effort removal of a compression temp artifact after a cancel. */
async function deleteTempOutput(uri: string): Promise<void> {
  try {
    const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    // Already gone or unreadable — nothing actionable.
  }
}

async function readKnownFileSize(uri: string) {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) ? size : 0;
  } catch {
    return 0;
  }
}

function toPhotoAsset(job: CompressionJob): PhotoAsset {
  return {
    id: job.mediaId,
    uri: job.uri,
    filename: job.fileName,
    mediaType: job.mediaType,
    width: job.width,
    height: job.height,
    duration: job.duration,
    sizeBytes: job.originalSizeBytes,
    monthKey: job.monthKey ?? "unknown"
  };
}

function normalizeCompressionError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error("Compression failed.");
}
