import { DeletedHistoryItem, MarkedForDeletionItem } from "@/models/photo";
import { getMonthKey } from "@/utils/date";

export const HistoryService = {
  fromMarkedItems(items: MarkedForDeletionItem[]): DeletedHistoryItem[] {
    const deletedAt = new Date().toISOString();
    return items.map((item, index) => ({
      id: `${item.photoId}-${deletedAt}-${index}`,
      photoId: item.photoId,
      uri: item.uri,
      filename: item.filename,
      sizeBytes: item.sizeBytes,
      deletedAt,
      monthKey: getMonthKey(new Date(item.createdAt).getTime()),
      restored: false
    }));
  }
};
