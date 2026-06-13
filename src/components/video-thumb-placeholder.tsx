import { Play } from "lucide-react-native";
import { StyleProp, View, ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

// Matches local video file URIs (this app uses file:///…/name.mp4 paths). Used to
// keep video files OUT of expo-image/Glide, whose VideoDecoder falls back to a
// FULL-RESOLUTION MediaMetadataRetriever.getFrameAtTime() for frames it can't
// scale (e.g. 4K/8K HEVC). A single such frame is 30–130+ MB and blows the 256 MB
// Java heap — the chronic OutOfMemoryError → MediaCodec.BufferInfo crash. There is
// no JS-only way to force a downscaled video-frame decode, so we render a
// placeholder tile instead of decoding the frame.
const VIDEO_URI = /\.(mp4|mov|m4v|3gp|3g2|mkv|webm|avi|wmv|flv|mpg|mpeg|ts|m2ts)(\?.*)?$/i;

export function isVideoUri(uri?: string): boolean {
  return !!uri && VIDEO_URI.test(uri);
}

/**
 * Lightweight stand-in for a video thumbnail — a surface-colored tile with a play
 * glyph. Fills its parent (pass the cell's size via `style`). Decodes nothing.
 */
export function VideoThumbPlaceholder({
  style,
  backgroundColor,
  iconSize = 22
}: {
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  iconSize?: number;
}) {
  const theme = useAppTheme();
  return (
    <View style={[{ backgroundColor: backgroundColor ?? theme.surfaceStrong, alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      <View style={{ width: iconSize * 2, height: iconSize * 2, borderRadius: iconSize, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
        <Play size={iconSize} color="#fff" fill="#fff" />
      </View>
    </View>
  );
}
