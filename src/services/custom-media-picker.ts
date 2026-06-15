import { requireOptionalNativeModule } from "expo-modules-core";
import { PhotoAsset } from "@/models/photo";
import { getMonthKey } from "@/utils/date";

/**
 * Opens the system image/video picker and maps the choice into a PhotoAsset that
 * the existing compression flow can consume.
 *
 * Capability-probed: expo-image-picker is a NATIVE module that only exists after
 * a dev-client rebuild. On the current APK the probe returns false and the caller
 * shows a "needs an updated build" message instead of red-boxing (we never import
 * the wrapper before the probe passes — see native-capabilities.ts for why).
 */
export function isCustomPickerAvailable(): boolean {
  try {
    return requireOptionalNativeModule("ExponentImagePicker") != null;
  } catch {
    return false;
  }
}

/**
 * Returns the picked file as a synthetic PhotoAsset (id `custom:<uri>`), or
 * undefined if the picker is unavailable, the user cancelled, or anything failed.
 */
export async function pickMediaForCompression(): Promise<PhotoAsset | undefined> {
  if (!isCustomPickerAvailable()) return undefined;
  try {
    const ImagePicker: typeof import("expo-image-picker") = await import("expo-image-picker");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: false,
      quality: 1,
      exif: false
    });
    if (result.canceled || !result.assets?.length) return undefined;
    return toPhotoAsset(result.assets[0]);
  } catch {
    return undefined;
  }
}

function toPhotoAsset(asset: import("expo-image-picker").ImagePickerAsset): PhotoAsset | undefined {
  if (!asset?.uri) return undefined;
  const isVideo = asset.type === "video";
  const creationTime = Date.now();
  return {
    // Synthetic id so it never collides with a media-index asset; the picker
    // copies the file to cache, so the uri is unique per pick.
    id: `custom:${asset.uri}`,
    uri: asset.uri,
    filename: asset.fileName ?? undefined,
    width: asset.width || undefined,
    height: asset.height || undefined,
    // expo-image-picker reports duration in MILLISECONDS; PhotoAsset/compression
    // expect SECONDS (matches expo-media-library).
    duration: typeof asset.duration === "number" && asset.duration > 0 ? asset.duration / 1000 : undefined,
    mediaType: isVideo ? "video" : "photo",
    sizeBytes: asset.fileSize || undefined,
    creationTime,
    monthKey: getMonthKey(creationTime)
  };
}
