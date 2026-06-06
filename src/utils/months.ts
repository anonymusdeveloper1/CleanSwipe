import { MarkedForDeletionItem, MediaTypeFilter, MonthGroup, PhotoAsset } from "@/models/photo";
import { getMonthKey, monthLabel } from "@/utils/date";
import { sumBytes } from "@/utils/format";

export function groupPhotosByMonth(photos: PhotoAsset[], allLabel = "All Photos"): MonthGroup[] {
  const map = new Map<string, PhotoAsset[]>();
  for (const photo of photos) {
    const bucket = map.get(photo.monthKey) ?? [];
    bucket.push(photo);
    map.set(photo.monthKey, bucket);
  }

  const months = [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: monthLabel(key),
      count: items.length,
      sizeBytes: sumBytes(items)
    }));

  return [
    { key: "all", label: allLabel, count: photos.length, sizeBytes: sumBytes(photos) },
    ...months
  ];
}

export function filterPhotosByMediaType(photos: PhotoAsset[], mediaType: MediaTypeFilter) {
  if (mediaType === "all") return photos;
  return photos.filter((photo) => photo.mediaType === mediaType);
}

export function filterPhotosByMonth(photos: PhotoAsset[], key: string) {
  if (key === "all") return photos;
  return photos.filter((photo) => photo.monthKey === key);
}

export function filterPhotosByScope(photos: PhotoAsset[], monthKey: string, mediaType: MediaTypeFilter) {
  return filterPhotosByMonth(filterPhotosByMediaType(photos, mediaType), monthKey);
}

export function filterMarkedItemsByMonth(items: MarkedForDeletionItem[], key: string, photos: PhotoAsset[] = []) {
  if (key === "all") return items;
  return items.filter((item) => getMarkedItemMonthKey(item) === key);
}

export function filterMarkedItemsByScope(items: MarkedForDeletionItem[], monthKey: string, mediaType: MediaTypeFilter, photos: PhotoAsset[] = []) {
  const photoTypes = new Map(photos.map((photo) => [photo.id, photo.mediaType]));
  return filterMarkedItemsByMonth(items, monthKey).filter((item) => {
    if (mediaType === "all") return true;
    return (item.mediaType ?? photoTypes.get(item.photoId)) === mediaType;
  });
}

export function getMediaTypeAllLabel(mediaType: MediaTypeFilter) {
  if (mediaType === "video") return "All Videos";
  if (mediaType === "photo") return "All Photos";
  return "All Media";
}

export function getMediaTypeNoun(mediaType: MediaTypeFilter, count?: number) {
  if (mediaType === "video") return count === 1 ? "video" : "videos";
  if (mediaType === "photo") return count === 1 ? "photo" : "photos";
  return count === 1 ? "item" : "media";
}

export function getMarkedItemMonthKey(item: MarkedForDeletionItem) {
  if (item.monthKey) return item.monthKey;
  const parsedCreatedAt = Date.parse(item.createdAt);
  return Number.isNaN(parsedCreatedAt) ? getMonthKey() : getMonthKey(parsedCreatedAt);
}
