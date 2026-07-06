import { useEffect, useRef, useState } from "react";
import { Animated, StyleProp, Text, TextStyle } from "react-native";

type Props = {
  /** Target value to count up to. */
  value: number;
  /** Formats the animating number for display (default: rounded, locale-grouped). */
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  /** Count-up duration in ms. */
  duration?: number;
};

/**
 * A number that animates (counts up) from its previous value to `value` — used
 * across the Stats screen so figures "roll in" instead of snapping. The formatter
 * runs on every frame, so it also drives animated byte sizes (e.g. "0 MB" →
 * "1.2 GB"). Uses a JS-driven Animated.Value (a text value can't be native-driven)
 * and a ref for the formatter so an inline `format` arrow never re-triggers the run.
 */
export function AnimatedStatValue({ value, format = (n) => Math.round(n).toLocaleString(), style, duration = 850 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const formatRef = useRef(format);
  formatRef.current = format;
  const [display, setDisplay] = useState(() => formatRef.current(0));

  useEffect(() => {
    const id = anim.addListener(({ value: current }) => setDisplay(formatRef.current(current)));
    const animation = Animated.timing(anim, { toValue: value, duration, useNativeDriver: false });
    animation.start();
    return () => {
      animation.stop();
      anim.removeListener(id);
    };
  }, [anim, value, duration]);

  return (
    <Text selectable numberOfLines={1} style={style}>
      {display}
    </Text>
  );
}
