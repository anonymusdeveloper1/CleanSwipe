import { FileUp, Gift } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  visible: boolean;
  /** Custom-file compressions the Free user has left today. */
  remaining: number;
  /** Daily free limit, shown as the denominator. */
  limit: number;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Free-tier opt-in dialog shown before a rewarded ad unlocks a single custom-file
 * compression. Mirrors VideoCompressAdDialog but worded for any picked file
 * (image or video).
 */
export function CustomCompressAdDialog({ visible, remaining, limit, onCancel, onConfirm }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 26 }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 24, gap: 16 }}>
          <View style={{ alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
            <FileUp size={28} color={theme.accent} />
          </View>
          <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
            {t("customCompress.adTitle")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 16, lineHeight: 22, textAlign: "center" }}>
            {t("customCompress.adBody")}
          </Text>
          <View
            style={{
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: theme.surfaceSoft,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10
            }}
          >
            <Gift size={18} color={theme.accent} />
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: "900" }}>
              {t("customCompress.freeLeft", { count: remaining, limit })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end", marginTop: 2 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onCancel} style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
              <Text style={{ color: theme.muted, fontSize: 16, fontWeight: "800" }}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("compressionDetail.watchAdConfirm")}
              onPress={onConfirm}
              style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: theme.accent, borderRadius: 14 }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("compressionDetail.watchAdConfirm")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
