import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { targetLabel, targetOutputKind } from "@/features/convert/convert-targets";
import { ConvertOutputKind, ConvertTarget } from "@/features/convert/convert.types";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  targets: ConvertTarget[];
  selected?: ConvertTarget;
  onSelect: (target: ConvertTarget) => void;
};

const GROUP_ORDER: ConvertOutputKind[] = ["image", "video", "audio"];

/**
 * Format chips, grouped by output kind (e.g. a video shows a "Video" row and an
 * "Audio" row). Selected chip = accent border + tint, mirroring the QualityCard
 * selection style from the compression detail screen.
 */
export function ConvertFormatPicker({ targets, selected, onSelect }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  const groups = GROUP_ORDER.map((kind) => ({
    kind,
    items: targets.filter((target) => targetOutputKind(target) === kind)
  })).filter((group) => group.items.length > 0);

  return (
    <View style={{ gap: 14 }}>
      {groups.map((group) => (
        <View key={group.kind} style={{ gap: 8 }}>
          <Text style={{ color: theme.muted, fontSize: 12.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 }}>
            {t(`convert.group.${group.kind}`)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {group.items.map((target) => {
              const active = selected === target;
              return (
                <Pressable
                  key={target}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(target)}
                  style={{
                    minWidth: 78,
                    minHeight: 46,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: active ? theme.accent : theme.border,
                    backgroundColor: active ? `${theme.accent}14` : theme.surfaceSoft,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: active ? theme.accent : theme.text, fontSize: 15, fontWeight: "900" }}>{targetLabel(target)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
