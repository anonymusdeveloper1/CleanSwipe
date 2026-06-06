import { LucideIcon } from "lucide-react-native";
import { PropsWithChildren } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = PropsWithChildren<{
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
}>;

export function SettingsRow({ icon: Icon, title, subtitle, value, onValueChange, onPress, children }: Props) {
  const theme = useAppTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={{
        minHeight: 76,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.border
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} color={theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable numberOfLines={2} style={{ color: theme.muted, fontSize: 14 }}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {typeof value === "boolean" && onValueChange ? (
        <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.accent, false: theme.faint }} />
      ) : null}
    </Wrapper>
  );
}
