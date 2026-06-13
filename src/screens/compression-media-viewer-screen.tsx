import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDown, ArrowLeft, Pause, Play } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { CompressionResultSheet } from "@/features/compression/components/compression-result-sheet";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { useAppStore } from "@/store/app-store";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";

export function CompressionMediaViewerScreen() {
  const { t } = useTranslation();
  const { id, result, origin } = useLocalSearchParams<{ id: string; result?: string; origin?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const asset = useMediaIndexStore((state) => selectIndexedMediaAsset(state, id));
  // Prefer the compressed copy's output when one exists for this source, so the
  // viewer shows the actual compressed result rather than the original.
  const compressed = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === id));
  const mediaUri = compressed?.outputUri ?? asset?.uri;
  const isVideo = (compressed?.mediaType ?? asset?.mediaType) === "video";
  // Android single-item result mode: the viewer also shows the post-compression
  // result sheet (data + original-file actions), the media drag-to-dismiss is
  // disabled (the sheet owns the bottom gesture), and Close returns to the origin.
  const isResultMode = Platform.OS === "android" && (result === "1" || Boolean(compressed));
  const translateY = useSharedValue(0);
  const [playing, setPlaying] = useState(true);

  const close = () => {
    if (isResultMode) {
      router.dismissTo((origin ?? "/(tabs)/history") as never);
      return;
    }
    router.back();
  };

  const panGesture = Gesture.Pan()
    .enabled(!isResultMode)
    .onUpdate((event) => {
      translateY.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      const shouldClose = translateY.value > Math.min(170, height * 0.22) || event.velocityY > 950;
      if (shouldClose) {
        translateY.value = withTiming(height, { duration: 180 }, () => runOnJS(close)());
        return;
      }
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const animatedMediaStyle = useAnimatedStyle(() => {
    const scale = interpolate(translateY.value, [0, height * 0.55], [1, 0.84], Extrapolation.CLAMP);
    const radius = interpolate(translateY.value, [0, height * 0.35], [0, 24], Extrapolation.CLAMP);
    return {
      borderRadius: radius,
      overflow: "hidden",
      transform: [{ translateY: translateY.value }, { scale }]
    };
  });

  const animatedChromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height * 0.25], [1, 0], Extrapolation.CLAMP)
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height * 0.6], [1, 0], Extrapolation.CLAMP)
  }));

  // Guard AFTER all hooks so the hook order stays stable across renders
  // (rules-of-hooks) — e.g. if the asset is deleted while the viewer is open and
  // mediaUri disappears, an earlier return would drop hook calls and crash React.
  if (!mediaUri) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#05070d" }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, backgroundColor: "#05070d" }, animatedBackdropStyle]} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animatedMediaStyle]}>
          {isVideo ? (
            <>
              <VideoMediaPlayer uri={mediaUri} autoPlay loop paused={!playing} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing ? t("compressionViewer.pauseVideo") : t("compressionViewer.playVideo")}
                onPress={() => setPlaying((value) => !value)}
                style={{ position: "absolute", alignSelf: "center", top: "43%", width: 74, height: 74, borderRadius: 37, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}
              >
                {playing ? <Pause size={30} color="#fff" /> : <Play size={31} color="#fff" fill="#fff" />}
              </Pressable>
            </>
          ) : (
            <CachedImage uri={mediaUri} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
          )}
        </Animated.View>
      </GestureDetector>

      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0 }, animatedChromeStyle]}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,7,13,0.78)", "rgba(5,7,13,0)"]} style={{ height: insets.top + 104 }} />
        <View style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("compressionViewer.goBack")} onPress={close} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          {isResultMode ? null : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 11, paddingVertical: 8 }}>
              <ArrowDown size={15} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{t("compressionViewer.swipeDown")}</Text>
            </View>
          )}
        </View>
      </Animated.View>
      {isResultMode ? <CompressionResultSheet mediaId={id} /> : null}
    </View>
  );
}
