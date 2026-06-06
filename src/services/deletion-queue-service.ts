import { MarkedForDeletionItem, PhotoAsset } from "@/models/photo";

export const DeletionQueueService = {
  fromPhoto(photo: PhotoAsset): MarkedForDeletionItem {
    return {
      photoId: photo.id,
      uri: photo.uri,
      filename: photo.filename,
      mediaType: photo.mediaType,
      sizeBytes: photo.sizeBytes,
      createdAt: new Date(photo.creationTime ?? Date.now()).toISOString(),
      markedAt: new Date().toISOString(),
      monthKey: photo.monthKey
    };
  }
};
