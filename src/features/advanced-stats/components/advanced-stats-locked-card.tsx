import { BarChart3, Lock } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Free-user upsell shown in place of the advanced-stats section. The PARENT
 * (stats screen) decides Free vs Pro via canUseFeature("advancedStats") and
 * passes onPress (which opens the paywall) — no ad-hoc isPro check here.
 */
export function AdvancedStatsLockedCard({ onPress }: { onPress: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("advancedStats.lockedTitle")}
      onPress={onPress}
      style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
          <BarChart3 size={24} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>
            {t("advancedStats.lockedTitle")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
            {t("advancedStats.lockedMessage")}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 11, backgroundColor: theme.accent }}>
        <Lock size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{t("advancedStats.unlock")}</Text>
      </View>
    </Pressable>
  );
}
