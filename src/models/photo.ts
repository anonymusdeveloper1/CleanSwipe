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

export type AppSettings = {
  biometricAuthEnabled: boolean;
  appLockEnabled: boolean;
  darkModeEnabled: boolean;
  accentColor: "blue" | "purple" | "green" | "orange" | "pink";
  language: "en" | "mk" | "de" | "es";
  notificationsEnabled: boolean;
  cleanupRemindersEnabled: boolean;
  analyticsCollectionEnabled: boolean;
  usageDataCollectionEnabled: boolean;
  errorReportingEnabled: boolean;
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
