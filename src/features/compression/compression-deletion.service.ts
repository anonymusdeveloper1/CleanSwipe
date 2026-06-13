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

export async function deleteCompressedMediaCopy(libraryAssetId?: string) {
  if (!libraryAssetId) {
    throw new Error("The saved compressed copy could not be found.");
  }

  try {
    await MediaLibrary.deleteAssetsAsync([libraryAssetId]);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Could not delete the compressed copy.");
  }
}
