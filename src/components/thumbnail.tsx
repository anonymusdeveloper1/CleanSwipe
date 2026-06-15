import { Image, ImageContentFit } from "expo-image";
import { memo, useEffect, useState } from "react";
import { PixelRatio, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { getThumbnailUri } from "@/services/thumbnail-service";
import { useAppTheme } from "@/hooks/use-app-theme";

// Decode target when the caller can't supply a concrete cell size (e.g. a
// flex-sized tile). Buckets to the service's max — still a ~1 MB bitmap.
const DEFAULT_TARGET_PX = 512;

type Props = {
  // Original full-resolution media uri.
  sourceUri: string;
  // Stable per-asset id used as the thumbnail cache key.
  cacheKey: string;
  // On-screen cell size in DP; the decode resolution is derived from this. When
  // omitted (flex-sized cells), a 512 px thumbnail is requested.
  cellDp?: number;
  // When true, a single frame is extracted before downscaling (video sources).
  isVideo?: boolean;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

/**
 * A grid thumbnail backed by ThumbnailService: it resolves a small, disk-cached
 * downscaled copy of the source and renders THAT, so the decoder never receives
 * a full-resolution (50+ MP photo / 4K+ video frame) source. Until the thumbnail
 * resolves, the cell shows its surface background (no full-res flash, no spinner
 * noise in a grid). A video play badge is the caller's responsibility.
 */
export const Thumbnail = memo(function Thumbnail({
  sourceUri,
  cacheKey,
  cellDp,
  isVideo = false,
  contentFit = "cover",
  style,
  backgroundColor
}: Props) {
  const theme = useAppTheme();
  const surface = backgroundColor ?? theme.surfaceStrong;
  const [uri, setUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setUri(undefined);
    const targetPx = cellDp != null ? PixelRatio.getPixelSizeForLayoutSize(cellDp) : DEFAULT_TARGET_PX;
    getThumbnailUri(sourceUri, { key: cacheKey, targetPx, isVideo })
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch(() => {
        if (!cancelled) setUri(sourceUri);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceUri, cacheKey, cellDp, isVideo]);

  return (
    <View style={[{ backgroundColor: surface, overflow: "hidden" }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit={contentFit}
          // "disk" (not "memory-disk"): decoded bitmaps live on Android's native
          // heap, and a memory cache retains them even after a cell scrolls
          // off-screen — scrolling thousands of thumbnails pushed the heap to
          // 700-800 MB. We already disk-cache a tiny (~512 px) JPEG per asset, so
          // re-reading from disk on scroll-back is cheap; this bounds resident
          // bitmaps to roughly the visible window.
          cachePolicy="disk"
          allowDownscaling
          priority="low"
          transition={120}
          recyclingKey={uri}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
});
