import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMediaIndexStore } from "@/store/media-index-store";

/**
 * A subtle, custom (non-native) pill that appears while the media index is
 * working — either a quick newest-page refresh (new photos just arrived) or a
 * full library scan. It gives the user feedback that the app is finding/indexing
 * media instead of showing nothing. Non-blocking; fades in/out and returns null
 * when the index is idle. Drop it into any screen (Swipe, gallery, …).
 */
export function IndexingIndicator() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const status = useMediaIndexStore((state) => state.status);
  const scannedCount = useMediaIndexStore((state) => state.summary.scannedCount);

  if (status !== "scanning" && status !== "refreshing") return null;

  const label = status === "scanning" ? t("smartClean.indexingGallery", { count: scannedCount }) : t("common.findingMedia");

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={{ alignItems: "center", paddingHorizontal: 22, paddingTop: 10 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          backgroundColor: theme.surfaceStrong,
          borderRadius: 22,
          paddingLeft: 12,
          paddingRight: 16,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: theme.border
        }}
      >
        <ActivityIndicator size="small" color={theme.accent} />
        <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "800" }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}
