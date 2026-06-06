import { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }: Props) {
  const theme = useAppTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 16, padding: 34 }}>
      <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={34} color={theme.accent} />
      </View>
      <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
        {title}
      </Text>
      <Text selectable style={{ color: theme.muted, fontSize: 16, lineHeight: 23, textAlign: "center" }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ backgroundColor: theme.accent, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14 }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
