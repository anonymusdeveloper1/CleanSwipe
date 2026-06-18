import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDown, ArrowLeft, Pause, Play } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { CompressionResultSheet } from "@/features/compression/components/compression-result-sheet";
import { useCustomCompressStore } from "@/features/compression/custom-compress.store";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { useAppStore } from "@/store/app-store";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";

export function CompressionMediaViewerScreen() {
  const { t } = useTranslation();
  const { id, result, origin, compare, custom } = useLocalSearchParams<{ id: string; result?: string; origin?: string; compare?: string; custom?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const asset = useMediaIndexStore((state) => selectIndexedMediaAsset(state, id));
  const customTarget = useCustomCompressStore((state) => state.target);
  // Prefer the compressed copy's output when one exists for this source, so the
  // viewer shows the actual compressed result rather than the original.
  const compressed = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === id));
  const mediaUri = compressed?.outputUri ?? asset?.uri;
  const comparisonOriginal = asset?.uri ?? (custom === "1" && customTarget?.id === id ? customTarget.uri : undefined);
  const isVideo = (compressed?.mediaType ?? asset?.mediaType ?? customTarget?.mediaType) === "video";
  const isComparisonMode = compare === "1";
  // Android single-item result mode: the viewer also shows the post-compression
  // result sheet (data + original-file actions), the media drag-to-dismiss is
  // disabled (the sheet owns the bottom gesture), and Close returns to the origin.
  const isResultMode = !isComparisonMode && Platform.OS === "android" && (result === "1" || Boolean(compressed));
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

  if (isComparisonMode) {
    if (!comparisonOriginal || !compressed?.outputUri) return null;
    return (
      <ComparisonViewer
        originalUri={comparisonOriginal}
        compressedUri={compressed.outputUri}
        isVideo={isVideo}
        onClose={() => router.back()}
      />
    );
  }

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

function ComparisonViewer({
  originalUri,
  compressedUri,
  isVideo,
  onClose
}: {
  originalUri: string;
  compressedUri: string;
  isVideo: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [showOriginal, setShowOriginal] = useState(false);
  const [playing, setPlaying] = useState(true);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissY = useSharedValue(0);

  const resetZoom = () => {
    "worklet";
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    dismissY.value = 0;
  }, [showOriginal, dismissY, savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 4));
    })
    .onEnd(() => {
      if (scale.value <= 1.03) resetZoom();
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1.02) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
        return;
      }
      if (event.translationY > 0 && Math.abs(event.translationY) > Math.abs(event.translationX)) {
        dismissY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (scale.value > 1.02) return;
      const shouldClose = dismissY.value > Math.min(170, height * 0.22) || event.velocityY > 950;
      if (shouldClose) {
        dismissY.value = withTiming(height, { duration: 180 }, () => runOnJS(onClose)());
        return;
      }
      dismissY.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const mediaStyle = useAnimatedStyle(() => {
    const dismissalScale = interpolate(dismissY.value, [0, height * 0.55], [1, 0.84], Extrapolation.CLAMP);
    const radius = interpolate(dismissY.value, [0, height * 0.35], [0, 24], Extrapolation.CLAMP);
    return {
      borderRadius: radius,
      overflow: "hidden",
      transform: [
        { translateY: dismissY.value },
        { scale: dismissalScale },
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ]
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, height * 0.25], [1, 0], Extrapolation.CLAMP)
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, height * 0.6], [1, 0], Extrapolation.CLAMP)
  }));

  const selectedUri = showOriginal ? originalUri : compressedUri;

  return (
    <View style={{ flex: 1, backgroundColor: "#05070d" }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, backgroundColor: "#05070d" }, backdropStyle]} />
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
        <Animated.View style={[{ flex: 1 }, mediaStyle]}>
          {isVideo ? (
            <View style={{ flex: 1 }}>
              <VideoMediaPlayer key={selectedUri} uri={selectedUri} autoPlay loop paused={!playing} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing ? t("compressionViewer.pauseVideo") : t("compressionViewer.playVideo")}
                onPress={() => setPlaying((value) => !value)}
                style={{ position: "absolute", alignSelf: "center", top: "43%", width: 74, height: 74, borderRadius: 37, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}
              >
                {playing ? <Pause size={30} color="#fff" /> : <Play size={31} color="#fff" fill="#fff" />}
              </Pressable>
            </View>
          ) : (
            <CachedImage uri={selectedUri} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
          )}
        </Animated.View>
      </GestureDetector>

      <Animated.View pointerEvents="box-none" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, chromeStyle]}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,7,13,0.78)", "rgba(5,7,13,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 110 }} />
        <View style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("compressionViewer.goBack")} onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 11, paddingVertical: 8 }}>
            <ArrowDown size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{t("compressionViewer.swipeDown")}</Text>
          </View>
        </View>

        <ComparisonToggle
          showOriginal={showOriginal}
          onChange={(value) => {
            setShowOriginal(value);
            setPlaying(true);
          }}
          bottom={insets.bottom + 24}
        />
      </Animated.View>
    </View>
  );
}

function ComparisonToggle({ showOriginal, onChange, bottom }: { showOriginal: boolean; onChange: (value: boolean) => void; bottom: number }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const position = useSharedValue(showOriginal ? 1 : 0);
  useEffect(() => {
    position.value = withTiming(showOriginal ? 1 : 0, { duration: 200 });
  }, [showOriginal, position]);
  const half = Math.max((width - 8) / 2, 0);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * half }] }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ position: "absolute", left: 20, right: 20, bottom, flexDirection: "row", borderRadius: 15, padding: 4, backgroundColor: "rgba(31,41,55,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}
    >
      {half > 0 ? (
        <Animated.View style={[indicatorStyle, { position: "absolute", top: 4, left: 4, bottom: 4, width: half, borderRadius: 11, backgroundColor: "#075ec8" }]} />
      ) : null}
      <Pressable accessibilityRole="button" accessibilityState={{ selected: !showOriginal }} onPress={() => onChange(false)} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: showOriginal ? "rgba(255,255,255,0.7)" : "#fff", fontSize: 15, fontWeight: "900" }}>{t("compressRun.compressed")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: showOriginal }} onPress={() => onChange(true)} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: showOriginal ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "900" }}>{t("compressRun.original")}</Text>
      </Pressable>
    </View>
  );
}
