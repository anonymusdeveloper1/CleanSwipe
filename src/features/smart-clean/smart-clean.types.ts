import { FeatureKey } from "@/features/subscription/feature-flags";
import { IndexedMediaAsset, MediaAccessLevel } from "@/store/media-index-store";

/**
 * Smart Clean (Pro) detector contract.
 *
 * Detection is NOT implemented in Stage 2 — every shipped detector is a
 * placeholder returning `not_available` with empty groups and undefined
 * count/bytes (no fabricated results, no destructive affordance). The interface
 * is shaped so a real detector can drop in later without any UI rewrite: it
 * just returns `ready` with real groups + counts.
 */

export type SmartCleanDetectorKey =
  | "duplicatePhotos"
  | "similarPhotos"
  | "duplicateVideos"
  | "blurryPhotos"
  | "screenshots"
  | "memes"
  | "largeVideos"
  | "largePhotos";

export type SmartCleanItem = {
  mediaId: string;
  uri: string;
  sizeBytes?: number;
  mediaType?: "photo" | "video" | "unknown";
};

export type SmartCleanGroup = {
  id: string;
  /** The item to KEEP within the group (the rest are deletion candidates). */
  keepMediaId?: string;
  items: SmartCleanItem[];
};

// "idle"          = not scanned yet (the detector is implemented; run a scan)
// "not_available" = the detector's native capability is missing on this build
export type SmartCleanStatus = "idle" | "not_available" | "needs_permission" | "empty" | "ready";

export type SmartCleanResult = {
  key: SmartCleanDetectorKey;
  status: SmartCleanStatus;
  groups: SmartCleanGroup[];
  /** undefined => hidden in the UI (never show a fabricated 0). */
  itemCount?: number;
  estimatedReclaimableBytes?: number;
};

/**
 * A single computed-feature cache entry for one asset. Only small scalars/hex
 * strings are stored (never base64 pixel buffers). `modKey` is the asset's
 * modificationTime fallback used to invalidate stale features.
 */
export type FeatureEntry = {
  modKey: number;
  md5?: string;
  dHash?: string; // 16-hex (64-bit) perceptual hash
  blurVar?: number;
  vHash?: string; // video thumbnail perceptual hash (16-hex)
  updatedAt: number;
};

export type FeaturePatch = Partial<Omit<FeatureEntry, "modKey" | "updatedAt">>;

/**
 * Non-React facade detectors use to read/write the persisted feature cache.
 * Keeps detectors decoupled from the store (testability) and never exposes a
 * fresh-object selector.
 */
export type SmartCleanFeatureCacheApi = {
  get(mediaId: string, modKey: number): FeatureEntry | undefined;
  upsert(mediaId: string, modKey: number, patch: FeaturePatch): void;
};

export type SmartCleanDetectInput = {
  assets: IndexedMediaAsset[];
  accessLevel: MediaAccessLevel;
  /** Aborted when the user cancels or leaves the screen. */
  signal?: AbortSignal;
  /** 0..1 within this detector. */
  onProgress?: (progress: number) => void;
  cache?: SmartCleanFeatureCacheApi;
};

export interface SmartCleanDetector {
  key: SmartCleanDetectorKey;
  /** Per-card Pro flag (gated via canUseFeature). */
  featureKey: FeatureKey;
  /** When true, the detector can only run under full ("all photos") access. */
  requiresFullAccess: boolean;
  detect(input: SmartCleanDetectInput): Promise<SmartCleanResult>;
}
