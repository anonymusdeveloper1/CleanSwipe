import { Image, ImageContentFit } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  uri: string;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

export function CachedImage({ uri, contentFit = "cover", style, backgroundColor }: Props) {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const surfaceColor = backgroundColor ?? theme.surfaceStrong;

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
