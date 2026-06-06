import { Text, View } from "react-native";
import { AppStats } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  stats: AppStats;
};

export function SwipeDistributionChart({ stats }: Props) {
  const theme = useAppTheme();
  const total = Math.max(1, stats.totalKept + stats.totalMarkedForDeletion + stats.totalSuperLikes + stats.totalRestored + stats.totalMissed);
  const rows = [
    { label: "Kept", value: stats.totalKept, color: "#5eead4" },
    { label: "Deleted", value: stats.totalMarkedForDeletion, color: "#ef4444" },
    { label: "Favorite", value: stats.totalSuperLikes, color: "#f59e0b" },
    { label: "Restored", value: stats.totalRestored, color: theme.accent },
    { label: "Missed", value: stats.totalMissed, color: theme.faint }
  ];

  return (
    <View style={{ padding: 22, borderRadius: 22, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, gap: 18 }}>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        Swipe Distribution
      </Text>
      <View style={{ height: 150, justifyContent: "flex-end", gap: 8 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: row.color }} />
            <Text selectable style={{ color: theme.muted, fontSize: 16, flex: 1 }}>
              {Math.round((row.value / total) * 100)}% {row.label}
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
