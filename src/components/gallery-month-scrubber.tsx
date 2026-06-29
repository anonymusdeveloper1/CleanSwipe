import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useAppTheme } from "@/hooks/use-app-theme";

const TRACK_WIDTH = 30; // touch strip width on the right edge
const THUMB_HEIGHT = 50;
const THUMB_WIDTH = 8;

function clampW(value: number, lo: number, hi: number) {
  "worklet";
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Right-edge fast-scroll handle for the dense, month-sectioned gallery. The
 * thumb tracks scroll position (driven by the shared `scrollY` value, no React
 * re-render); dragging it scrolls the list and pops a floating bubble with the
 * DATE of the item at the top of the viewport. Only rendered when the scope
 * spans >1 month.
 *
 * On touch-down (`onBegin`, before any movement) it fires `onScrubbingChange(true)`
 * so the screen can disable the list's native scroll while the thumb is dragged
 * (otherwise the ScrollView would steal the vertical drag). The track sits above
 * the list as a sibling overlay, so the pan receives the touch directly.
 */
export function GalleryMonthScrubber({
  scrollY,
  maxScroll,
  trackHeight,
  labelForOffset,
  onScrubbingChange,
  onScrubTo
}: {
  /** Live content offset in px (shared value updated from the list's onScroll). */
  scrollY: SharedValue<number>;
  /** Scrollable px range (content height − viewport), always ≥ 1. */
  maxScroll: number;
  /** Viewport height in px (the track spans this). */
  trackHeight: number;
  /** Resolves an absolute scroll offset to the bubble label (e.g. "Dec 25, 2025"). */
  labelForOffset: (offset: number) => string;
  /** Toggled true on touch-down / false on release so the list can disable scroll. */
  onScrubbingChange: (scrubbing: boolean) => void;
  /** Scroll the list to an absolute px offset (animated:false). */
  onScrubTo: (offset: number) => void;
}) {
  const theme = useAppTheme();
  const dragging = useSharedValue(0);
  const dragY = useSharedValue(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const lastLabelRef = useRef<string | null>(null);
  const travel = Math.max(1, trackHeight - THUMB_HEIGHT);

  const handleScrub = (fraction: number) => {
    const offset = fraction * maxScroll;
    const label = labelForOffset(offset);
    if (label !== lastLabelRef.current) {
      lastLabelRef.current = label;
      setBubble(label);
    }
    onScrubTo(offset);
  };

  const beginScrub = (fraction: number) => {
    onScrubbingChange(true);
    handleScrub(fraction);
  };

  const endScrub = () => {
    lastLabelRef.current = null;
    setBubble(null);
    onScrubbingChange(false);
  };

  const pan = Gesture.Pan()
    .onBegin((event) => {
      "worklet";
      dragging.value = 1;
      const ty = clampW(event.y - THUMB_HEIGHT / 2, 0, travel);
      dragY.value = ty;
      runOnJS(beginScrub)(ty / travel);
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

  // The root spans the full width (box-none, so only the right-edge track child
  // receives touches) — this gives the bubble room to extend LEFT of the track.
  // Anchoring it inside a 30px-wide box collapsed its shrink-to-fit width to ~0,
  // which squished the month text to nothing.
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: trackHeight }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", right: TRACK_WIDTH + 2, top: 0, alignItems: "flex-end" }, bubbleStyle]}>
        {bubble ? (
          <View
            style={{
              backgroundColor: theme.text,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              boxShadow: "0 6px 16px rgba(0,0,0,0.22)"
            }}
          >
            <Text numberOfLines={1} style={{ color: theme.background, fontSize: 14, fontWeight: "800" }}>
              {bubble}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={{ position: "absolute", top: 0, right: 0, width: TRACK_WIDTH, height: trackHeight }}>
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
    </View>
  );
}
