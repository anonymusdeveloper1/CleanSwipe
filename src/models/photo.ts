export type PhotoAsset = {
  id: string;
  uri: string;
  filename?: string;
  width?: number;
  height?: number;
  creationTime?: number;
  modificationTime?: number;
  duration?: number;
  mediaType?: "photo" | "video" | "unknown";
  sizeBytes?: number;
  monthKey: string;
};

export type CompressionQuality = "low" | "medium" | "high";

export type AfterCompressionOriginalPolicy = "ask_every_time" | "keep_original" | "delete_original_after_success";

export type CompressedMediaItem = {
  id: string;
  sourceId: string;
  sourceUri: string;
  outputUri: string;
  libraryAssetId?: string;
  filename?: string;
  mediaType?: "photo" | "video" | "unknown";
  quality: CompressionQuality;
  originalBytes: number;
  compressedBytes: number;
  savedBytes: number;
  progress: number;
  compressedAt: string;
};

export type CompressionJob = {
  mode: "single" | "batch";
  activeId?: string;
  activeLabel?: string;
  activeFilename?: string;
  activeMediaType?: "photo" | "video" | "unknown";
  totalCount: number;
  completedCount: number;
  startedAt: number;
};

export type SwipeAction = "keep" | "delete" | "superLike" | "missed" | "restore";

export type MarkedForDeletionItem = {
  photoId: string;
  uri: string;
  filename?: string;
  mediaType?: "photo" | "video" | "unknown";
  sizeBytes?: number;
  createdAt: string;
  markedAt: string;
  monthKey?: string;
};

export type DeletedHistoryItem = {
  id: string;
  photoId: string;
  uri: string;
  filename?: string;
  sizeBytes?: number;
  deletedAt: string;
  monthKey: string;
  restored?: boolean;
};

export type AppStats = {
  totalSwipes: number;
  totalSessions: number;
  totalKept: number;
  totalMarkedForDeletion: number;
  totalDeleted: number;
  totalRestored: number;
  totalSuperLikes: number;
  totalMissed: number;
  totalDeletedSpaceBytes: number;
};

export type SupportedLanguage = "en" | "es" | "pt-BR" | "fr" | "de" | "it" | "id" | "hi" | "ar" | "ja";

export type LanguagePreference = "system" | SupportedLanguage;

export type AppSettings = {
  biometricAuthEnabled: boolean;
  appLockEnabled: boolean;
  darkModeEnabled: boolean;
  accentColor: "blue" | "purple" | "green" | "orange" | "pink";
  language: LanguagePreference;
  notificationsEnabled: boolean;
  cleanupRemindersEnabled: boolean;
  compressionRemindersEnabled: boolean;
  proNotificationsEnabled: boolean;
  afterCompressionOriginalPolicy: AfterCompressionOriginalPolicy;
  // Global default compression quality; the per-item picker on the detail screen
  // pre-selects this but can override it for a single compression.
  defaultCompressionQuality: CompressionQuality;
};

export type PermissionStatus = "not-requested" | "granted" | "denied" | "limited" | "error";

export type PermissionResult = {
  status: PermissionStatus;
  canAskAgain?: boolean;
  message?: string;
};

export type MediaTypeFilter = "all" | "photo" | "video";

export type MonthGroup = {
  key: string;
  label: string;
  count: number;
  sizeBytes?: number;
};
