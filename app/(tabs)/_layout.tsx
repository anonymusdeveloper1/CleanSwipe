import { Tabs } from "expo-router";
import { Archive, BarChart3, Layers, Star, Wand2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { isPro } = useFeatureAccess();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 28);

  const tabIcon =
    (Icon: LucideIcon) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View
        style={{
          width: 50,
          height: 28,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? "#dbeafe" : "transparent"
        }}
      >
        <Icon size={21} color={color} strokeWidth={focused ? 2.8 : 2.2} />
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          height: 72 + bottomPadding,
          paddingTop: 9,
          paddingBottom: bottomPadding,
          boxShadow: "0 -6px 18px rgba(15, 23, 42, 0.06)"
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          marginHorizontal: 4
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          paddingTop: 2
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.swipe"), tabBarIcon: tabIcon(Layers) }} />
      <Tabs.Screen name="history" options={{ title: t("tabs.cleanup"), tabBarIcon: tabIcon(Archive) }} />
      <Tabs.Screen name="stats" options={{ title: t("tabs.stats"), tabBarIcon: tabIcon(BarChart3) }} />
      {/* Same route ("premium") for both tiers — only the label/icon change for
          Pro, so the back-stack and /premium deep links are preserved. */}
      <Tabs.Screen name="premium" options={{ title: isPro ? t("tabs.smartClean") : t("tabs.premium"), tabBarIcon: tabIcon(isPro ? Wand2 : Star) }} />
    </Tabs>
  );
}
