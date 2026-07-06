import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

type Props = {
  /** 0..1 fill fraction. */
  fraction: number;
  /** Fill color. */
  color: string;
  /** Track (background) color. */
  track: string;
  /** Entrance delay in ms (for staggered reveals). */
  delay?: number;
  height?: number;
};

/** A horizontal progress/proportion bar whose fill animates in from 0. */
export function AnimatedBar({ fraction, color, track, delay = 0, height = 8 }: Props) {
  const width = useSharedValue(0);
  const target = Math.max(0, Math.min(fraction, 1));

  useEffect(() => {
    width.value = withDelay(delay, withTiming(target, { duration: 700 }));
  }, [width, target, delay]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}
