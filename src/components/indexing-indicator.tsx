import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMediaIndexStore } from "@/store/media-index-store";

/**
 * A subtle, custom (non-native) pill that appears while the media index is
 * working — either a quick newest-page refresh (new photos just arrived) or a
 * full library scan. It gives the user feedback that the app is finding/indexing
 * media instead of showing nothing.
 *
 * FLOATS — it is absolutely positioned and takes NO layout space, so it behaves
 * like an in-app notification dropping in over the content. It used to be an
 * in-flow element, which meant the swipe card (and the gallery grid) visibly
 * jumped down when indexing started and back up when it finished — on a large
 * library that happens on most launches. `pointerEvents="none"` keeps the swipe
 * deck fully interactive underneath it.
 *
 * Mount it as the LAST child of the container it should float over, so it paints
 * above its siblings; `topOffset` nudges it below that container's own padding.
 */
export function IndexingIndicator({ topOffset = 10 }: { topOffset?: number }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const status = useMediaIndexStore((state) => state.status);
  const scannedCount = useMediaIndexStore((state) => state.summary.scannedCount);

  if (status !== "scanning" && status !== "refreshing") return null;

  const label = status === "scanning" ? t("smartClean.indexingGallery", { count: scannedCount }) : t("common.findingMedia");

  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: topOffset,
        left: 0,
        right: 0,
        zIndex: 50,
        alignItems: "center",
        paddingHorizontal: 22
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          // Surface (not surfaceStrong) + a soft drop shadow so it reads as a
          // layer ABOVE the media rather than a band within the page.
          backgroundColor: theme.surface,
          borderRadius: 22,
          paddingLeft: 12,
          paddingRight: 16,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: "0 6px 18px rgba(15,23,42,0.16)"
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
