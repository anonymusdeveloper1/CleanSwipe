import * as MediaLibrary from "expo-media-library";
import { PhotoAsset } from "@/models/photo";
import { getMonthKey } from "@/utils/date";

export type GetPhotosOptions = {
  first?: number;
  after?: string;
};

export type DeletePhotosResult = {
  success: boolean;
  deletedIds: string[];
  message?: string;
};

export interface IPhotoLibraryService {
  requestPermissions(): Promise<unknown>;
  getPhotos(options?: GetPhotosOptions): Promise<PhotoAsset[]>;
  deletePhotos(photoIds: string[]): Promise<DeletePhotosResult>;
  getLargestPhotos(limit: number): Promise<PhotoAsset[]>;
}

export const PhotoLibraryService: IPhotoLibraryService = {
  async requestPermissions() {
    return MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
  },

  async getPhotos(options = {}) {
    try {
      const permission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
      if (!permission.granted && permission.status !== "granted") {
        return [];
      }

      const pageSize = options.first ?? 250;
      let after = options.after;
      let hasNextPage = true;
      const photos: PhotoAsset[] = [];

      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          first: pageSize,
          after,
          mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
          sortBy: [MediaLibrary.SortBy.creationTime]
        });

        const pagePhotos = await Promise.all(result.assets.map(mapAsset));
        photos.push(...(pagePhotos.filter(Boolean) as PhotoAsset[]));

        hasNextPage = result.hasNextPage;
        after = result.endCursor;
        if (!after || result.assets.length === 0) {
          hasNextPage = false;
        }
      }

      return photos;
    } catch {
      return [];
    }
  },

  async deletePhotos(photoIds: string[]) {
    try {
      const demoIds = photoIds.filter((id) => id.startsWith("demo-"));
      const nativeIds = photoIds.filter((id) => !id.startsWith("demo-"));
      if (nativeIds.length > 0) {
        await MediaLibrary.deleteAssetsAsync(nativeIds);
      }
      return { success: true, deletedIds: [...nativeIds, ...demoIds] };
    } catch (error) {
      return {
        success: false,
        deletedIds: [],
        message: error instanceof Error ? error.message : "Unable to delete these photos."
      };
    }
  },

  async getLargestPhotos(limit: number) {
    const photos = await this.getPhotos({ first: 250 });
    return [...photos]
      .filter((photo) => typeof photo.sizeBytes === "number")
      .sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
      .slice(0, limit);
  }
};

async function mapAsset(asset: MediaLibrary.Asset): Promise<PhotoAsset | null> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset);
    const creationTime = info.creationTime || info.modificationTime || Date.now();
    return {
      id: asset.id,
      uri: info.localUri ?? asset.uri,
      filename: asset.filename,
      width: asset.width,
      height: asset.height,
      creationTime,
      modificationTime: asset.modificationTime,
      duration: asset.duration,
      mediaType: asset.mediaType === "video" ? "video" : asset.mediaType === "photo" ? "photo" : "unknown",
      sizeBytes: getInfoSizeBytes(info) ?? estimateSizeBytes(asset.width, asset.height, asset.mediaType, asset.duration),
      monthKey: getMonthKey(creationTime)
    };
  } catch {
    return {
      id: asset.id,
      uri: asset.uri,
      filename: asset.filename,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
      modificationTime: asset.modificationTime,
      duration: asset.duration,
      mediaType: asset.mediaType === "video" ? "video" : asset.mediaType === "photo" ? "photo" : "unknown",
      sizeBytes: estimateSizeBytes(asset.width, asset.height, asset.mediaType, asset.duration),
      monthKey: getMonthKey(asset.creationTime)
    };
  }
}

function getInfoSizeBytes(info: MediaLibrary.AssetInfo) {
  const size = "fileSize" in info ? Number(info.fileSize) : "size" in info ? Number(info.size) : undefined;
  return Number.isFinite(size) && size && size > 0 ? size : undefined;
}

function estimateSizeBytes(width?: number, height?: number, mediaType?: MediaLibrary.MediaTypeValue, duration?: number) {
  if (!width || !height) return undefined;
  if (mediaType === "video") {
    return Math.round(width * height * Math.max(duration ?? 1, 1) * 0.18);
  }
  return Math.round(width * height * 0.55);
}
