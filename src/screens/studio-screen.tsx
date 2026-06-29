import { useCallback, useState } from "react";
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { interpolateColor, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { AppHeader } from "@/components/app-header";
import { ConvertScreen } from "@/screens/convert-screen";
import { SmartCleanScreen } from "@/screens/smart-clean-screen";
import { useAppTheme } from "@/hooks/use-app-theme";

type StudioMode = "clean" | "convert";

const SEG_PAD = 4; // inner padding of the segmented control
const SEG_GAP = 4; // gap between the two segments
const SEG_INNER_H = 36; // height of each segment / the sliding pill

/**
 * Pro "Studio" tab (tab 4 when subscribed) — hosts Smart Clean and the media
 * format Converter behind one shared brand header + a [ Clean | Convert ]
 * control. Free users never reach this screen (premium-screen.tsx shows the
 * paywall), which keeps Convert Pro-gated.
 *
 * The two panes live in a horizontal paging ScrollView so the user can SWIPE
 * between them (left → Convert, right → Clean) in addition to tapping a segment
 * (which animates via scrollTo instead of snapping). A single shared `scrollX`
 * drives both the page position and the segmented control's sliding pill + label
 * colors, so the toggle tracks the swipe 1:1. SmartCleanScreen renders with
 * `showHeader={false}` to avoid a doubled header.
 */
export function StudioScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<StudioMode>("clean");
  const [pagerW, setPagerW] = useState(0);
  const [pagerH, setPagerH] = useState(0);
  const [segW, setSegW] = useState(0);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);

  const options: { key: StudioMode; label: string }[] = [
    { key: "clean", label: t("studio.clean") },
    { key: "convert", label: t("studio.convert") }
  ];

  // Pill geometry derived from the measured control width.
  const segInnerW = Math.max(0, segW - SEG_PAD * 2);
  const segmentW = segInnerW > 0 ? (segInnerW - SEG_GAP) / 2 : 0;
  const pillTravel = segmentW + SEG_GAP; // distance from segment 0 to segment 1

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    }
  });

  // progress: 0 at Clean, 1 at Convert.
  const pillStyle = useAnimatedStyle(() => {
    const progress = pagerW > 0 ? scrollX.value / pagerW : 0;
    return { transform: [{ translateX: progress * pillTravel }] };
  });
  const cleanLabelStyle = useAnimatedStyle(() => {
    const progress = pagerW > 0 ? scrollX.value / pagerW : 0;
    return { color: interpolateColor(progress, [0, 1], [theme.accent, theme.muted]) };
  });
  const convertLabelStyle = useAnimatedStyle(() => {
    const progress = pagerW > 0 ? scrollX.value / pagerW : 0;
    return { color: interpolateColor(progress, [0, 1], [theme.muted, theme.accent]) };
  });

  const goTo = useCallback(
    (index: number) => {
      if (pagerW > 0) scrollRef.current?.scrollTo({ x: index * pagerW, animated: true });
      setMode(index === 0 ? "clean" : "convert");
    },
    [pagerW, scrollRef]
  );

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pagerW <= 0) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / pagerW);
      setMode(index === 0 ? "clean" : "convert");
    },
    [pagerW]
  );

  const onPagerLayout = useCallback((event: LayoutChangeEvent) => {
    setPagerW(event.nativeEvent.layout.width);
    setPagerH(event.nativeEvent.layout.height);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <View
          accessibilityRole="tablist"
          onLayout={(event) => setSegW(event.nativeEvent.layout.width)}
          style={{ minHeight: 44, borderRadius: 22, padding: SEG_PAD, backgroundColor: theme.surfaceStrong, flexDirection: "row", gap: SEG_GAP }}
        >
          {/* Sliding pill behind the labels — tracks the swipe / animates on tap. */}
          {segmentW > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                { position: "absolute", top: SEG_PAD, left: SEG_PAD, width: segmentW, height: SEG_INNER_H, borderRadius: 18, backgroundColor: theme.surface },
                pillStyle
              ]}
            />
          ) : null}
          {options.map((option, index) => (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === option.key }}
              onPress={() => goTo(index)}
              style={{ flex: 1, minHeight: SEG_INNER_H, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
            >
              <Animated.Text style={[{ fontSize: 15, fontWeight: "900" }, index === 0 ? cleanLabelStyle : convertLabelStyle]}>{option.label}</Animated.Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flex: 1 }} onLayout={onPagerLayout}>
        {pagerW > 0 && pagerH > 0 ? (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={scrollHandler}
            onMomentumScrollEnd={onMomentumEnd}
            bounces={false}
            // The two panes own their vertical scrolling; this only pages horizontally.
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ width: pagerW, height: pagerH }}>
              <SmartCleanScreen showHeader={false} />
            </View>
            <View style={{ width: pagerW, height: pagerH }}>
              <ConvertScreen />
            </View>
          </Animated.ScrollView>
        ) : null}
      </View>
    </View>
  );
}
