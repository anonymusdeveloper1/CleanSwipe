import { ImageContentFit } from "expo-image";
import { Play } from "lucide-react-native";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Thumbnail } from "@/components/thumbnail";
import { VideoThumbPlaceholder, isVideoUri } from "@/components/video-thumb-placeholder";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";

// A video's first frame is decoded at FULL resolution by the native extractor
// (MediaMetadataRetriever.getFrameAtTime). A ≤4K frame is ~33 MB; an 8K frame is
// ~140 MB+ (ARGB_8888). Even though ThumbnailService immediately downscales the
// extracted frame to a tiny cached JPEG, that ONE full-res frame still lands in
// native memory during extraction — and several in flight during a fast scroll
// is what OOM'd the app. So we keep a ceiling and route only ≤4K videos through
// the extractor; larger sources get a non-decoding placeholder. (A resolution-
// independent fix would be a native getScaledFrameAtTime extractor — deferred.)
const SAFE_MAX_DIMENSION = 4096;

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
 * Media thumbnail for grids/lists. Photos and (≤4K) video frames both render
 * through ThumbnailService via <Thumbnail/> — a small, disk-cached, downscaled
 * copy, so the decoder never receives a full-resolution source. Videos get a
 * play badge overlaid; oversized or unknown-resolution videos fall back to a
 * non-decoding placeholder tile (also play-badged) so they can never OOM.
 */
export function MediaThumbnail({ uri, id, mediaType, width, height, contentFit = "cover", style, backgroundColor }: Props) {
  const isVideo = mediaType === "video" || isVideoUri(uri);
  const indexed = useMediaIndexStore((state) =>
    isVideo && id && (width == null || height == null) ? selectIndexedMediaAsset(state, id) : undefined
  );

  if (!isVideo) {
    return <Thumbnail sourceUri={uri} cacheKey={id ?? uri} contentFit={contentFit} style={style} backgroundColor={backgroundColor} />;
  }

  const w = width ?? indexed?.width;
  const h = height ?? indexed?.height;
  const safeToDecode = !!w && !!h && Math.max(w, h) <= SAFE_MAX_DIMENSION;

  if (!safeToDecode) {
    return <VideoThumbPlaceholder style={style} backgroundColor={backgroundColor} />;
  }

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <Thumbnail
        sourceUri={uri}
        cacheKey={id ?? uri}
        isVideo
        contentFit={contentFit}
        backgroundColor={backgroundColor}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
          <Play size={17} color="#fff" fill="#fff" />
        </View>
      </View>
    </View>
  );
}
