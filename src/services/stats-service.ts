import { AppStats, MarkedForDeletionItem, SwipeAction } from "@/models/photo";
import { sumBytes } from "@/utils/format";

export const emptyStats: AppStats = {
  totalSwipes: 0,
  totalSessions: 1,
  totalKept: 0,
  totalMarkedForDeletion: 0,
  totalDeleted: 0,
  totalRestored: 0,
  totalSuperLikes: 0,
  totalMissed: 0,
  totalDeletedSpaceBytes: 0
};

export const StatsService = {
  withSwipe(stats: AppStats, action: SwipeAction): AppStats {
    return {
      ...stats,
      totalSwipes: stats.totalSwipes + 1,
      totalKept: stats.totalKept + (action === "keep" ? 1 : 0),
      totalMarkedForDeletion: stats.totalMarkedForDeletion + (action === "delete" ? 1 : 0),
      totalSuperLikes: stats.totalSuperLikes + (action === "superLike" ? 1 : 0),
      totalMissed: stats.totalMissed + (action === "missed" ? 1 : 0)
    };
  },

  undoSwipe(stats: AppStats, action: SwipeAction): AppStats {
    return {
      ...stats,
      totalSwipes: Math.max(0, stats.totalSwipes - 1),
      totalKept: Math.max(0, stats.totalKept - (action === "keep" ? 1 : 0)),
      totalMarkedForDeletion: Math.max(0, stats.totalMarkedForDeletion - (action === "delete" ? 1 : 0)),
      totalSuperLikes: Math.max(0, stats.totalSuperLikes - (action === "superLike" ? 1 : 0)),
      totalMissed: Math.max(0, stats.totalMissed - (action === "missed" ? 1 : 0))
    };
  },

  withPermanentDelete(stats: AppStats, items: MarkedForDeletionItem[]): AppStats {
    return {
      ...stats,
      totalDeleted: stats.totalDeleted + items.length,
      totalDeletedSpaceBytes: stats.totalDeletedSpaceBytes + sumBytes(items)
    };
  }
};
