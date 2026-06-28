import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useAppTheme } from "@/hooks/use-app-theme";
import { monthLabel } from "@/utils/date";
import type { MonthSpan } from "@/utils/gallery-grid";

const TRACK_WIDTH = 30; // touch strip width on the right edge
const THUMB_HEIGHT = 50;
const THUMB_WIDTH = 8;

function clampW(value: number, lo: number, hi: number) {
  "worklet";
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Right-edge fast-scroll handle for the dense gallery. The thumb tracks scroll
 * position (driven by the shared `scrollY` value, no React re-render); dragging
 * it scrolls the list and pops a floating bubble with the month currently in
 * view. Only rendered when the scope spans more than one month.
 */
export function GalleryMonthScrubber({
  scrollY,
  maxScroll,
  trackHeight,
  total,
  spans,
  onScrubTo
}: {
  /** Live content offset in px (shared value updated from the list's onScroll). */
  scrollY: SharedValue<number>;
  /** Scrollable px range (content height − viewport), always ≥ 1. */
  maxScroll: number;
  /** Viewport height in px (the track spans this). */
  trackHeight: number;
  /** Total item count (for index ↔ fraction mapping). */
  total: number;
  /** Contiguous month runs over the filtered list. */
  spans: MonthSpan[];
  /** Scroll the list to an absolute px offset (animated:false). */
  onScrubTo: (offset: number) => void;
}) {
  const theme = useAppTheme();
  const dragging = useSharedValue(0);
  const dragY = useSharedValue(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const lastLabelRef = useRef<string | null>(null);
  const travel = Math.max(1, trackHeight - THUMB_HEIGHT);

  const labelForFraction = (fraction: number) => {
    if (total <= 0 || spans.length === 0) return "";
    const index = Math.min(total - 1, Math.max(0, Math.round(fraction * (total - 1))));
    let span = spans[0];
    for (const candidate of spans) {
      if (candidate.startIndex <= index) span = candidate;
      else break;
    }
    return monthLabel(span.key);
  };

  const handleScrub = (fraction: number) => {
    const label = labelForFraction(fraction);
    if (label !== lastLabelRef.current) {
      lastLabelRef.current = label;
      setBubble(label);
    }
    onScrubTo(fraction * maxScroll);
  };

  const endScrub = () => {
    lastLabelRef.current = null;
    setBubble(null);
  };

  const pan = Gesture.Pan()
    .onBegin((event) => {
      "worklet";
      dragging.value = 1;
      const ty = clampW(event.y - THUMB_HEIGHT / 2, 0, travel);
      dragY.value = ty;
      runOnJS(handleScrub)(ty / travel);
    })
    .onUpdate((event) => {
      "worklet";
      const ty = clampW(event.y - THUMB_HEIGHT / 2, 0, travel);
      dragY.value = ty;
      runOnJS(handleScrub)(ty / travel);
    })
    .onFinalize(() => {
      "worklet";
      dragging.value = 0;
      runOnJS(endScrub)();
    });

  const thumbStyle = useAnimatedStyle(() => {
    const follow = maxScroll > 0 ? clampW((scrollY.value / maxScroll) * travel, 0, travel) : 0;
    const y = dragging.value ? dragY.value : follow;
    return { transform: [{ translateY: y }, { scaleX: dragging.value ? 1.6 : 1 }] };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const follow = maxScroll > 0 ? clampW((scrollY.value / maxScroll) * travel, 0, travel) : 0;
    const y = dragging.value ? dragY.value : follow;
    return {
      transform: [{ translateY: clampW(y + THUMB_HEIGHT / 2 - 18, 0, Math.max(0, trackHeight - 36)) }],
      opacity: dragging.value
    };
  });

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, width: TRACK_WIDTH, height: trackHeight }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", right: TRACK_WIDTH, top: 0 }, bubbleStyle]}>
        {bubble ? (
          <View
            style={{
              backgroundColor: theme.text,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              marginRight: 6,
              boxShadow: "0 6px 16px rgba(0,0,0,0.22)"
            }}
          >
            <Text style={{ color: theme.background, fontSize: 14, fontWeight: "800" }}>{bubble}</Text>
          </View>
        ) : null}
      </Animated.View>

      <GestureDetector gesture={pan}>
        <View style={{ width: TRACK_WIDTH, height: trackHeight, alignItems: "flex-end" }}>
          <Animated.View
            style={[
              {
                width: THUMB_WIDTH,
                height: THUMB_HEIGHT,
                borderRadius: THUMB_WIDTH / 2,
                marginRight: 4,
                backgroundColor: theme.accent,
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)"
              },
              thumbStyle
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
