import { router } from "expo-router";
import { BrushCleaning, Settings } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  title?: string;
  showBack?: boolean;
};

export function AppHeader({ title = "SwipeClean" }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 22, paddingBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
          <BrushCleaning size={30} color={theme.accent} strokeWidth={2.5} />
          <Text selectable style={{ color: theme.accent, fontSize: 26, fontWeight: "800", flexShrink: 1 }}>
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push("/settings")}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Settings size={30} color={theme.text} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
