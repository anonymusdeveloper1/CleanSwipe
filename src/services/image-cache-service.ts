import { Image } from "expo-image";
import { PhotoAsset } from "@/models/photo";

const PREFETCH_LIMIT = 36;

export const ImageCacheService = {
  prefetchPhotos(photos: PhotoAsset[], limit = PREFETCH_LIMIT) {
    const uris = photos
      .slice(0, limit)
      .map((photo) => photo.uri)
      .filter((uri): uri is string => Boolean(uri));

    if (uris.length === 0) return;

    void Image.prefetch(uris, { cachePolicy: "memory-disk" }).catch(() => undefined);
  }
};
