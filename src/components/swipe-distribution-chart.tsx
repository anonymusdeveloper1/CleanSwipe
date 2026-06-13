import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppStats } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  stats: AppStats;
};

export function SwipeDistributionChart({ stats }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const total = Math.max(1, stats.totalKept + stats.totalMarkedForDeletion + stats.totalSuperLikes + stats.totalRestored + stats.totalMissed);
  const rows = [
    { labelKey: "distribution.kept", value: stats.totalKept, color: "#5eead4" },
    { labelKey: "distribution.deleted", value: stats.totalMarkedForDeletion, color: "#ef4444" },
    { labelKey: "distribution.favorite", value: stats.totalSuperLikes, color: "#f59e0b" },
    { labelKey: "distribution.restored", value: stats.totalRestored, color: theme.accent },
    { labelKey: "distribution.missed", value: stats.totalMissed, color: theme.faint }
  ];

  return (
    <View style={{ padding: 22, borderRadius: 22, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, gap: 18 }}>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        {t("distribution.title")}
      </Text>
      <View style={{ height: 150, justifyContent: "flex-end", gap: 8 }}>
        {rows.map((row) => (
          <View key={row.labelKey} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: row.color }} />
            <Text selectable style={{ color: theme.muted, fontSize: 16, flex: 1 }}>
              {Math.round((row.value / total) * 100)}% {t(row.labelKey)}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 16, fontVariant: ["tabular-nums"] }}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
