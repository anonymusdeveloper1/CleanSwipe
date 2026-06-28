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
 *  - audio (mp3/m4a) → NOT a library asset type; left in the app sandbox and
 *    shared from the result screen (`savedToFile`).
 *
 * Unlike compression there is no "did it shrink?" rejection — a format change can
 * legitimately produce a larger file; we only require a non-empty artifact.
 */
export async function convertMediaJob(
  job: ConversionJob,
  callbacks: {
    onProgress: (progress: number) => void;
    onCompleted: (result: ConversionResult) => void;
    onError: (error: Error) => void;
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

    let result: ConversionResult;
    if (job.outputKind === "audio") {
      result = { outputUri: output.outputUri, outputSizeBytes, savedToFile: true, target: job.target };
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

async function readFileSize(uri: string): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) ? size : 0;
  } catch {
    return 0;
  }
}
