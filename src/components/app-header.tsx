import { router } from "expo-router";
import { Settings } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLogo } from "@/components/app-logo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  title?: string;
  showBack?: boolean;
};

export function AppHeader({ title = "SwipeClean" }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerTitle = title === "SwipeClean" ? t("common.appName") : title;

  return (
    <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 22, paddingBottom: 18 }}>
      {/* Brand lockup (logo + wordmark) left-aligned; settings on the right. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
          <AppLogo size={32} color={theme.accent} />
          <Text selectable numberOfLines={1} style={{ color: theme.accent, fontSize: 26, fontWeight: "800", flexShrink: 1 }}>
            {headerTitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.openSettings")}
          onPress={() => router.push("/settings")}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Settings size={30} color={theme.text} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
