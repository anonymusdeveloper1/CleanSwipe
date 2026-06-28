import { Trash2, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Top bar shown while the gallery is in multi-select mode. Replaces the normal
 * header: ✕ exits selection, the centre shows the live count, and the trash
 * marks the selection for deletion (routes into the existing deletion queue —
 * not an immediate OS delete).
 */
export function SelectionActionBar({
  count,
  onClose,
  onDelete
}: {
  count: number;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const canDelete = count > 0;
  const label = count === 1 ? t("selected.selectedCountOne", { count }) : t("selected.selectedCountOther", { count });

  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={t("selected.exitSelection")} onPress={onClose} hitSlop={8} style={{ padding: 8 }}>
        <X size={28} color={theme.text} />
      </Pressable>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: theme.text, fontSize: 18, fontWeight: "900" }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("selected.deleteSelected")}
        accessibilityState={{ disabled: !canDelete }}
        onPress={onDelete}
        disabled={!canDelete}
        hitSlop={8}
        style={{ padding: 8, opacity: canDelete ? 1 : 0.4 }}
      >
        <Trash2 size={26} color={theme.red} />
      </Pressable>
    </View>
  );
}
