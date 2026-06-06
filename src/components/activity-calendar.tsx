import { Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

export function ActivityCalendar() {
  const theme = useAppTheme();
  const days = [0.3, 0.7, 0.45, 0.9, 0.2, 0.6, 0.8];
  return (
    <View style={{ gap: 10 }}>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        Last 7 Days
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {days.map((opacity, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              aspectRatio: 1,
              borderRadius: 8,
              backgroundColor: theme.accent,
              opacity
            }}
          />
        ))}
      </View>
    </View>
  );
}
