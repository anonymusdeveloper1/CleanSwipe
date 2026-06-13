import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationDialog({ visible, onCancel, onConfirm }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 26 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 24, gap: 18 }}>
          <Text selectable style={{ color: theme.text, fontSize: 26, fontWeight: "900" }}>
            {t("delete.title")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 17, lineHeight: 24 }}>
            {t("delete.message")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end" }}>
            <Pressable onPress={onCancel} style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
              <Text style={{ color: theme.muted, fontSize: 17, fontWeight: "700" }}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{ paddingVertical: 14, paddingHorizontal: 18, backgroundColor: theme.red, borderRadius: 14 }}
            >
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>{t("delete.confirm")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
