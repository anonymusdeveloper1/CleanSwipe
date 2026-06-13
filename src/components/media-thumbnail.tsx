import { ImageContentFit } from "expo-image";
import { Play } from "lucide-react-native";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { CachedImage } from "@/components/cached-image";
import { VideoThumbPlaceholder, isVideoUri } from "@/components/video-thumb-placeholder";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";

// A video's first frame is decoded at FULL resolution (expo-image/Glide and
// react-native-compressor both use MediaMetadataRetriever.getFrameAtTime). A ≤4K
// frame is ~33 MB; an 8K frame is ~140 MB (ARGB_8888). With android:largeHeap="true"
// (~512 MB heap, set in AndroidManifest.xml) an 8K frame fits with headroom, so we
// decode real thumbnails up to 8K. We keep a ceiling rather than removing the gate
// so a pathological >8K source can't blow even the larger heap; those still get a
// non-decoding placeholder. (Resolution-independent fix would be a native
// getScaledFrameAtTime extractor — deferred.) Keep in sync with compression-service.
const SAFE_MAX_DIMENSION = 8192;

type Props = {
  uri: string;
  // Library asset id — used to look up the source resolution from the media index
  // when the caller's item doesn't carry width/height (e.g. SmartCleanItem).
  id?: string;
  mediaType?: "photo" | "video" | "unknown";
  width?: number;
  height?: number;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

/**
 * Media thumbnail for grids/lists. Photos render straight through CachedImage.
 * Videos render their frame ONLY when it is safe to decode (≤4K source), with a
 * play badge overlaid; oversized or unknown-resolution videos fall back to a
 * placeholder tile (also play-badged) so they can never OOM the app.
 */
export function MediaThumbnail({ uri, id, mediaType, width, height, contentFit = "cover", style, backgroundColor }: Props) {
  const isVideo = mediaType === "video" || isVideoUri(uri);
  const indexed = useMediaIndexStore((state) =>
    isVideo && id && (width == null || height == null) ? selectIndexedMediaAsset(state, id) : undefined
  );

  if (!isVideo) {
    return <CachedImage uri={uri} contentFit={contentFit} style={style} backgroundColor={backgroundColor} />;
  }

  const w = width ?? indexed?.width;
  const h = height ?? indexed?.height;
  const safeToDecode = !!w && !!h && Math.max(w, h) <= SAFE_MAX_DIMENSION;

  if (!safeToDecode) {
    return <VideoThumbPlaceholder style={style} backgroundColor={backgroundColor} />;
  }

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <CachedImage uri={uri} allowVideo contentFit={contentFit} style={StyleSheet.absoluteFill} backgroundColor={backgroundColor} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
          <Play size={17} color="#fff" fill="#fff" />
        </View>
      </View>
    </View>
  );
}
