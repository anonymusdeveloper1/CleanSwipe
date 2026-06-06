import { PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = PropsWithChildren<{ title: string }>;

export function SettingsSection({ title, children }: Props) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text selectable style={{ color: theme.accent, fontSize: 14, fontWeight: "900", letterSpacing: 0.4 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ backgroundColor: theme.surface, borderRadius: 13, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
        {children}
      </View>
    </View>
  );
}
