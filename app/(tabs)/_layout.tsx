import { Tabs } from "expo-router";
import { Easing } from "react-native";
import { useTranslation } from "react-i18next";
import { AnimatedTabBar } from "@/components/animated-tab-bar";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { isPro } = useFeatureAccess();

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // "Pop" page transition: the incoming tab screen rises up (translateY
        // 16→0), zooms from 0.9→1, and fades in. `current.progress` is 0 for the
        // active screen and ±1 for screens off either side, so an inactive screen
        // sits small + faded and pops to full size as it becomes active. Smooth,
        // quick ~220ms ease-out. The tab-bar sliding highlight + haptic live in
        // AnimatedTabBar and are independent of this.
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateY: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [16, 0, 16] }) },
              { scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.9, 1, 0.9] }) }
            ]
          }
        }),
        transitionSpec: {
          animation: "timing",
          config: { duration: 220, easing: Easing.out(Easing.cubic) }
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.swipe") }} />
      <Tabs.Screen name="history" options={{ title: t("tabs.cleanup") }} />
      <Tabs.Screen name="stats" options={{ title: t("tabs.stats") }} />
      {/* Same route ("premium") for both tiers — only the label/icon change for
          Pro (handled in AnimatedTabBar), so the /premium deep link is preserved. */}
      <Tabs.Screen name="premium" options={{ title: isPro ? t("tabs.studio") : t("tabs.premium") }} />
    </Tabs>
  );
}
