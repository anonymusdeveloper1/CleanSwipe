import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Determinate progress bar with a continuous shimmer sweep — the sweep keeps
 * moving even when the percentage is momentarily static, so the screen always
 * reads as "working". Shared by the single convert-run screen and the batch
 * converting screen.
 */
export function ShimmerProgressBar({ percent }: { percent: number }) {
  const theme = useAppTheme();
  const [barWidth, setBarWidth] = useState(0);
  const fill = useSharedValue(percent);
  const sweep = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(percent, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [percent, fill]);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [sweep]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, fill.value)}%` }));
  const highlightWidth = Math.max(barWidth * 0.35, 1);
  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -highlightWidth + sweep.value * (barWidth + highlightWidth) }] }));

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={{ alignSelf: "stretch", height: 12, borderRadius: 6, backgroundColor: theme.surfaceStrong, overflow: "hidden" }}
    >
      <Animated.View style={[fillStyle, { height: "100%", borderRadius: 6, backgroundColor: theme.accent }]} />
      {barWidth > 0 ? (
        <Animated.View style={[shimmerStyle, { position: "absolute", top: 0, bottom: 0, width: highlightWidth }]}>
          <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** "Converting" with cycling ellipsis dots, for a constant sign of life. */
export function WorkingLabel({ text }: { text: string }) {
  const theme = useAppTheme();
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((value) => (value % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return (
    <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: "800" }}>
      {text}
      {".".repeat(dots)}
    </Text>
  );
}
