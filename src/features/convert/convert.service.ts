import * as MediaLibrary from "expo-media-library";
import { getFileSize } from "react-native-compressor";
import { ConversionJob, ConversionResult } from "@/features/convert/convert.types";
import { convertMedia } from "@/features/convert/engine/conversion-engine";

/**
 * Runs one conversion job: convert → validate the artifact → persist it.
 *
 * Output handling diverges from compression:
 *  - image/video → saved to the device gallery (`MediaLibrary.createAssetAsync`).
 *    A failed save is a HARD failure (never silently dropped).
 *  - audio (m4a/wav) → NOT a library asset type; best-effort added to the device
 *    media store (Android) or left in the app sandbox (iOS), then opened in an
 *    external player from the result screen (`savedToFile`).
 *
 * Unlike compression there is no "did it shrink?" rejection — a format change can
 * legitimately produce a larger file; we only require a non-empty artifact.
 *
 * CANCELLATION: the engines cannot abort a native transcode mid-flight, so a
 * cancelled job keeps running to completion in the background. What we CAN
 * guarantee is that it leaves nothing behind: `isCancelled()` is re-checked
 * after the encode and BEFORE any library write, so a cancelled conversion never
 * deposits an artifact in the user's gallery, and the temp output is deleted.
 */
export async function convertMediaJob(
  job: ConversionJob,
  callbacks: {
    onProgress: (progress: number) => void;
    onCompleted: (result: ConversionResult) => void;
    onError: (error: Error) => void;
    /** True once the user cancelled this job. Re-read, never cached. */
    isCancelled?: () => boolean;
  }
) {
  try {
    callbacks.onProgress(0);
    const output = await convertMedia(
      { uri: job.uri, fileName: job.fileName, inputKind: job.inputKind, durationSec: job.duration },
      job.target,
      { onProgress: (progress) => callbacks.onProgress(Math.max(0, Math.min(progress, 0.99))) }
    );

    const outputSizeBytes = output.outputSizeBytes > 0 ? output.outputSizeBytes : await readFileSize(output.outputUri);
    if (!output.outputUri || outputSizeBytes <= 0) {
      throw new Error("convert-output-invalid");
    }

    // Cancelled while the native encode was running: discard the artifact rather
    // than saving it. Without this the user cancels, sees "cancelled", and still
    // finds the converted file in their gallery a moment later.
    if (callbacks.isCancelled?.()) {
      await deleteTempOutput(output.outputUri);
      return;
    }

    let result: ConversionResult;
    if (job.outputKind === "audio") {
      // Make the audio actually playable: best-effort add it to the device media
      // store (Android → appears in Music players). iOS Photos can't hold audio,
      // so this no-ops there and the file stays in the sandbox. Either way
      // `savedToFile` keeps the open/share affordance available cross-platform.
      const savedAudio = await saveAudioToLibrary(output.outputUri);
      // Keep the SANDBOX (documentDirectory) uri as outputUri, not the media-store
      // copy: the "Open with…" flow needs `expo-file-system.getContentUriAsync`,
      // whose FileProvider only serves the app's own dirs — a public
      // /storage/emulated/0/Music/... path would throw and force a share fallback.
      // The media-store copy still exists (libraryAssetId) so it shows in players.
      result = { outputUri: output.outputUri, outputSizeBytes, savedToFile: true, libraryAssetId: savedAudio?.id, target: job.target };
    } else {
      const saved = await saveToLibrary(output.outputUri);
      if (!saved) throw new Error("convert-save-failed");
      // Use the durable gallery uri (not the evictable engine temp file) so a
      // "Recent" thumbnail/viewer still resolves after an app restart.
      result = { outputUri: saved.uri, outputSizeBytes, libraryAssetId: saved.id, savedToFile: false, target: job.target };
    }

    callbacks.onProgress(1);
    callbacks.onCompleted(result);
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error("Conversion failed.");
    callbacks.onError(normalized);
    throw normalized;
  }
}

async function saveAudioToLibrary(uri: string): Promise<{ id: string; uri: string } | undefined> {
  try {
    const asset = await MediaLibrary.createAssetAsync(uri);
    return { id: asset.id, uri: asset.uri };
  } catch {
    // iOS Photos rejects audio, or the platform/permission blocked it — fall back
    // to the sandbox file (still shareable). Not a hard failure for audio.
    return undefined;
  }
}

async function saveToLibrary(uri: string): Promise<{ id: string; uri: string } | undefined> {
  try {
    const asset = await MediaLibrary.createAssetAsync(uri);
    // Resolve a durable, renderable uri for the saved asset (localUri is a file://
    // path; asset.uri is the fallback). The original temp output file may be
    // evicted from cache, so Recent rows must point at the gallery copy.
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      return { id: asset.id, uri: info?.localUri ?? asset.uri };
    } catch {
      return { id: asset.id, uri: asset.uri };
    }
  } catch {
    return undefined;
  }
}

/**
 * Best-effort removal of an engine temp artifact. Used when a job is cancelled
 * after the encode finished — the audio engine writes into documentDirectory,
 * which is NOT evictable, so an un-deleted orphan would live forever.
 */
async function deleteTempOutput(uri: string): Promise<void> {
  try {
    const FS: typeof import("expo-file-system/legacy") = await import("expo-file-system/legacy");
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    // Nothing actionable — the file is either already gone or unreadable.
  }
}

async function readFileSize(uri: string): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) ? size : 0;
  } catch {
    return 0;
  }
}
