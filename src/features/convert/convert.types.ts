/**
 * Types for the media format converter ("Convert"). Mirrors the compression
 * "transform job" model (see compression.types.ts) but for FORMAT conversion:
 * a job takes a source file + a target format and produces a NEW artifact.
 *
 * Two deliberate divergences from compression:
 *  - Conversion is NON-DESTRUCTIVE — there is no keep/delete-original machinery
 *    and no App-Lock gate. The source is never touched.
 *  - Audio output (mp3/m4a) is NOT a MediaLibrary asset type, so it is saved to
 *    the app documents dir (`savedToFile`) and surfaced via Share, while
 *    image/video output is saved to the gallery (`libraryAssetId`).
 */

export type ConvertInputKind = "image" | "video";
export type ConvertOutputKind = "image" | "video" | "audio";

export type ConvertImageTarget = "jpg" | "png" | "webp";
export type ConvertVideoTarget = "mp4";
export type ConvertAudioTarget = "m4a";
export type ConvertTarget = ConvertImageTarget | ConvertVideoTarget | ConvertAudioTarget;

export type ConvertJobStatus = "queued" | "preparing" | "converting" | "completed" | "failed" | "cancelled";

export type ConversionJob = {
  id: string;
  // Groups jobs picked together as one batch (<=5). Undefined for single jobs.
  batchId?: string;
  mediaId: string;
  uri: string;
  fileName: string;
  inputKind: ConvertInputKind;
  target: ConvertTarget;
  outputKind: ConvertOutputKind;
  status: ConvertJobStatus;
  progress: number;
  width?: number;
  height?: number;
  duration?: number;
  originalSizeBytes?: number;
  outputUri?: string;
  outputSizeBytes?: number;
  // Set when image/video output is persisted to the device library.
  libraryAssetId?: string;
  // Set when audio output is written to the app documents dir (Share-only).
  savedToFile?: boolean;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
};

export type ConversionJobInput = {
  batchId?: string;
  mediaId: string;
  uri: string;
  fileName?: string;
  inputKind: ConvertInputKind;
  target: ConvertTarget;
  outputKind: ConvertOutputKind;
  width?: number;
  height?: number;
  duration?: number;
  originalSizeBytes?: number;
};

export type ConversionResult = {
  outputUri: string;
  outputSizeBytes: number;
  libraryAssetId?: string;
  savedToFile: boolean;
  target: ConvertTarget;
};

// --- Engine layer (kept here so it stays native-import-free and both the
// dispatcher and the concrete engines can share it without an import cycle). ---

export type ConvertProgress = (fraction: number) => void;

export type ConvertOptions = {
  onProgress?: ConvertProgress;
  signal?: AbortSignal;
};

export type ConvertEngineInput = {
  uri: string;
  fileName: string;
  inputKind: ConvertInputKind;
  durationSec?: number;
};

export type ConvertEngineOutput = {
  outputUri: string;
  outputSizeBytes: number;
};

// Which optional conversion engines are present in this build (drives the chips).
export type ConvertCapabilities = {
  audioExtract: boolean;
};
