import { Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  label: string;
  value: string;
  tone?: "default" | "green" | "red";
};

export function StatsCard({ label, value, tone = "default" }: Props) {
  const theme = useAppTheme();
  const color = tone === "green" ? theme.green : tone === "red" ? theme.red : theme.accent;
  return (
    <View
      style={{
        flex: 1,
        minHeight: 84,
        padding: 16,
        borderRadius: 13,
        backgroundColor: theme.surfaceSoft,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: "center",
        gap: 5
      }}
    >
      <Text selectable style={{ color: theme.muted, fontSize: 15 }}>
        {label}
      </Text>
      <Text selectable style={{ color, fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}
