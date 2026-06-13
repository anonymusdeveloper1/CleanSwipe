import { LucideIcon } from "lucide-react-native";
import { PropsWithChildren, ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = PropsWithChildren<{
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  /** Accessory rendered at the far right, vertically centered (chevron, checkbox, etc.). */
  trailing?: ReactNode;
  disabled?: boolean;
}>;

export function SettingsRow({ icon: Icon, title, subtitle, value, onValueChange, onPress, trailing, disabled, children }: Props) {
  const theme = useAppTheme();
  const Wrapper = onPress ? Pressable : View;
  const hasSwitch = typeof value === "boolean" && !!onValueChange;
  return (
    <Wrapper
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 58,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        opacity: disabled ? 0.5 : 1
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} color={theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable numberOfLines={2} style={{ color: theme.muted, fontSize: 12.5, lineHeight: 17 }}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {hasSwitch ? (
        <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: theme.accent, false: theme.faint }} />
      ) : trailing ? (
        <View style={{ alignItems: "center", justifyContent: "center" }}>{trailing}</View>
      ) : null}
    </Wrapper>
  );
}
