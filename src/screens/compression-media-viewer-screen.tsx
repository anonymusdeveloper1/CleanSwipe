import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDown, ArrowLeft, Play } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { useAppStore } from "@/store/app-store";

export function CompressionMediaViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const photos = useAppStore((state) => state.photos);
  const asset = photos.find((item) => item.id === id);
  const translateY = useSharedValue(0);
  const [uri, setUri] = useState(asset?.uri);

  useEffect(() => {
    let mounted = true;
    setUri(asset?.uri);
    if (asset?.mediaType === "video") {
      CompressionService.createThumbnail(asset)
        .then((thumbnailUri) => {
          if (mounted) setUri(thumbnailUri);
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
    };
  }, [asset]);

  if (!asset || !uri) return null;

  const close = () => {
    router.back();
  };

  const panGesture = Gesture.Pan()
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

  return (
    <View style={{ flex: 1, backgroundColor: "#05070d" }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, backgroundColor: "#05070d" }, animatedBackdropStyle]} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animatedMediaStyle]}>
          <CachedImage uri={uri} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
          {asset.mediaType === "video" ? <VideoBadge /> : null}
        </Animated.View>
      </GestureDetector>

      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0 }, animatedChromeStyle]}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,7,13,0.78)", "rgba(5,7,13,0)"]} style={{ height: insets.top + 104 }} />
        <View style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={close} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 11, paddingVertical: 8 }}>
            <ArrowDown size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Swipe down</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function VideoBadge() {
  return (
    <View style={{ position: "absolute", alignSelf: "center", top: "45%", width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
      <Play size={30} color="#fff" fill="#fff" />
    </View>
  );
}
