import { requireOptionalNativeModule } from "expo-modules-core";
import { PhotoAsset } from "@/models/photo";
import { getMonthKey } from "@/utils/date";

type ImagePickerModule = typeof import("expo-image-picker");

let pickerAvailability: boolean | undefined;
let pickerModulePromise: Promise<ImagePickerModule | undefined> | undefined;

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
  if (pickerAvailability !== undefined) return pickerAvailability;
  try {
    pickerAvailability = requireOptionalNativeModule("ExponentImagePicker") != null;
  } catch {
    pickerAvailability = false;
  }
  return pickerAvailability;
}

/**
 * Loads the JS wrapper before the user taps the button. The native capability
 * probe remains in place for older dev clients, while subsequent picker opens
 * can call the already-resolved module immediately.
 */
export function prepareCustomMediaPicker(): Promise<ImagePickerModule | undefined> {
  if (!isCustomPickerAvailable()) return Promise.resolve(undefined);
  pickerModulePromise ??= import("expo-image-picker").catch(() => undefined);
  return pickerModulePromise;
}

/**
 * Returns the picked file as a synthetic PhotoAsset (id `custom:<uri>`), or
 * undefined if the picker is unavailable, the user cancelled, or anything failed.
 */
export async function pickMediaForCompression(): Promise<PhotoAsset | undefined> {
  try {
    const ImagePicker = await prepareCustomMediaPicker();
    if (!ImagePicker) return undefined;
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

/**
 * Multi-select variant for batch conversion: opens the system picker in
 * multi-select mode and returns up to `limit` picks (mixed images + videos) as
 * synthetic PhotoAssets. Returns [] on unavailable/cancel/error. Reuses
 * `toPhotoAsset` (per-asset ms->s duration + drops assets with no uri). The
 * `slice` enforces the cap on Android versions that don't honor selectionLimit.
 */
export async function pickMediaForConversion(limit = 5): Promise<PhotoAsset[]> {
  try {
    const ImagePicker = await prepareCustomMediaPicker();
    if (!ImagePicker) return [];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 1,
      exif: false
    });
    if (result.canceled || !result.assets?.length) return [];
    return result.assets
      .slice(0, limit)
      .map(toPhotoAsset)
      .filter((asset): asset is PhotoAsset => asset != null);
  } catch {
    return [];
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
