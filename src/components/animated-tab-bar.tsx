import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Archive, BarChart3, Layers, Star, Wand2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";

const PILL_WIDTH = 50;
const PILL_HEIGHT = 28;
const TOP_PADDING = 9;
// Matches the app's sheet spring (damping 22 / stiffness 220) — quick, minimal
// overshoot, for a subtle iOS-style glide.
const SPRING = { damping: 22, stiffness: 240, mass: 0.7 };

/**
 * Custom bottom tab bar with a single accent highlight pill that SLIDES (spring)
 * to the active tab, an accent-tinted active icon/label, and a selection haptic
 * on tab change (iOS feel). The highlight is accent + dark-mode aware, replacing
 * the old hardcoded pale-blue pill. Pairs with the `animation: "fade"` content
 * transition set on the Tabs navigator.
 */
export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { isPro } = useFeatureAccess();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 28);
  const [barWidth, setBarWidth] = useState(0);

  const tabWidth = state.routes.length > 0 ? barWidth / state.routes.length : 0;

  const translateX = useSharedValue(0);
  const didInit = useRef(false);
  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = state.index * tabWidth;
    // Jump (no spring) on first layout so the pill doesn't slide in from x=0.
    if (!didInit.current) {
      translateX.value = target;
      didInit.current = true;
    } else {
      translateX.value = withSpring(target, SPRING);
    }
  }, [state.index, tabWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const pillColor = theme.isDark ? `${theme.accent}33` : `${theme.accent}1F`;

  return (
    <View
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        backgroundColor: theme.surface,
        paddingTop: TOP_PADDING,
        paddingBottom: bottomPadding,
        height: 72 + bottomPadding,
        boxShadow: "0 -6px 18px rgba(15, 23, 42, 0.06)"
      }}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: TOP_PADDING, left: 0, width: tabWidth, height: PILL_HEIGHT, alignItems: "center", justifyContent: "center" },
            pillStyle
          ]}
        >
          <View style={{ width: PILL_WIDTH, height: PILL_HEIGHT, borderRadius: 16, backgroundColor: pillColor }} />
        </Animated.View>
      ) : null}

      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { icon: Icon, label } = tabMeta(route.name, isPro, t);
        const color = focused ? theme.accent : theme.muted;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            void Haptics.selectionAsync();
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={{ flex: 1, alignItems: "center", gap: 2 }}
          >
            <View style={{ height: PILL_HEIGHT, alignItems: "center", justifyContent: "center" }}>
              <Icon size={21} color={color} strokeWidth={focused ? 2.8 : 2.2} />
            </View>
            <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function tabMeta(routeName: string, isPro: boolean, t: (key: string) => string): { icon: LucideIcon; label: string } {
  switch (routeName) {
    case "index":
      return { icon: Layers, label: t("tabs.swipe") };
    case "history":
      return { icon: Archive, label: t("tabs.cleanup") };
    case "stats":
      return { icon: BarChart3, label: t("tabs.stats") };
    case "premium":
      return isPro ? { icon: Wand2, label: t("tabs.studio") } : { icon: Star, label: t("tabs.premium") };
    default:
      return { icon: Layers, label: routeName };
  }
}
