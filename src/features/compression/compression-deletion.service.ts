import * as MediaLibrary from "expo-media-library";
import { CompressionMediaType } from "@/features/compression/compression.types";
import { PhotoLibraryService } from "@/services/photo-library-service";

export async function deleteOriginalMedia({
  mediaId
}: {
  uri: string;
  mediaId: string;
  mediaType: CompressionMediaType;
}) {
  const permission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
  if (!permission.granted && permission.status !== "granted") {
    const requested = await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
    if (!requested.granted && requested.status !== "granted") {
      throw new Error("SwipeClean needs photo library permission to delete the original.");
    }
  }

  const result = await PhotoLibraryService.deletePhotos([mediaId]);
  if (!result.success) {
    throw new Error(result.message ?? "SwipeClean could not delete the original without permission.");
  }
}

// Deletes MANY originals in a single native call. On Android `deleteAssetsAsync`
// raises ONE system delete-consent dialog for the whole set, so a "delete all
// originals" batch asks the user once instead of once per image. Permission is
// checked a single time up front.
export async function deleteOriginalMediaBatch(mediaIds: string[]) {
  if (mediaIds.length === 0) return;

  const permission = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
  if (!permission.granted && permission.status !== "granted") {
    const requested = await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
    if (!requested.granted && requested.status !== "granted") {
      throw new Error("SwipeClean needs photo library permission to delete the originals.");
    }
  }

  const result = await PhotoLibraryService.deletePhotos(mediaIds);
  if (!result.success) {
    throw new Error(result.message ?? "SwipeClean could not delete the originals without permission.");
  }
}

export async function deleteCompressedMediaCopy(libraryAssetId?: string) {
  if (!libraryAssetId) {
    throw new Error("The saved compressed copy could not be found.");
  }

  let deleted: boolean;
  try {
    deleted = await MediaLibrary.deleteAssetsAsync([libraryAssetId]);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Could not delete the compressed copy.");
  }
  // deleteAssetsAsync resolves `false` when the deletion did not happen (e.g. the
  // user denied the system dialog); don't report success in that case.
  if (!deleted) {
    throw new Error("Could not delete the compressed copy.");
  }
}
