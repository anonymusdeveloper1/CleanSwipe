import { Tabs } from "expo-router";
import { BarChart3, BrushCleaning, Star } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 28);

  const tabIcon =
    (Icon: typeof BrushCleaning) =>
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
      <Tabs.Screen name="index" options={{ title: "Swipe", tabBarIcon: tabIcon(BrushCleaning) }} />
      <Tabs.Screen name="history" options={{ title: "Cleanup", tabBarIcon: tabIcon(BrushCleaning) }} />
      <Tabs.Screen name="stats" options={{ title: "Stats", tabBarIcon: tabIcon(BarChart3) }} />
      <Tabs.Screen name="premium" options={{ title: "Premium", tabBarIcon: tabIcon(Star) }} />
    </Tabs>
  );
}
