import { Image, ImageContentFit } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { VideoThumbPlaceholder, isVideoUri } from "@/components/video-thumb-placeholder";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  uri: string;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  // Allow decoding a video file's frame. OFF by default so a stray video URI can
  // never OOM-crash the app; MediaThumbnail turns it on only after checking the
  // source resolution is small enough to decode safely.
  allowVideo?: boolean;
};

export function CachedImage({ uri, contentFit = "cover", style, backgroundColor, allowVideo = false }: Props) {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const surfaceColor = backgroundColor ?? theme.surfaceStrong;

  // Never hand a video file to expo-image unless explicitly allowed — decoding a
  // high-res frame can OOM-crash the app (see video-thumb-placeholder). Callers
  // that actually play video use VideoMediaPlayer, not CachedImage.
  if (isVideoUri(uri) && !allowVideo) {
    return <VideoThumbPlaceholder style={style} backgroundColor={surfaceColor} />;
  }

  return (
    <View style={[{ backgroundColor: surfaceColor, overflow: "hidden" }, style]}>
      <Image
        source={{ uri }}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        transition={120}
        recyclingKey={uri}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
        style={StyleSheet.absoluteFill}
      />
      {loading ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    alignItems: "center",
    justifyContent: "center"
  }
});
