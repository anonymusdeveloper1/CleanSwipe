import { Images, Trash2 } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  visible: boolean;
  onCancel: () => void;
  /** Start the batch and delete each original after it is compressed. */
  onDelete: () => void;
  /** Start the batch and keep all originals. */
  onKeep: () => void;
};

/**
 * Shown when the user taps "Compress All". Asks UPFRONT whether to delete the
 * originals (after each file compresses) or keep them, then starts the batch
 * with that choice — replacing the old post-batch decision sheet for this flow.
 * A custom centered Modal matching `VideoCompressAdDialog`/`DeleteConfirmationDialog`.
 */
export function CompressAllOriginalDialog({ visible, onCancel, onDelete, onKeep }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 26 }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 24, gap: 16 }}>
          <View style={{ alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
            <Images size={28} color={theme.accent} />
          </View>
          <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
            {t("compression.compressAllTitle")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 16, lineHeight: 22, textAlign: "center" }}>
            {t("compression.compressAllOriginalsPrompt")}
          </Text>
          <View style={{ gap: 10, marginTop: 2 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("compression.deleteAllOriginalsButton")}
              onPress={onDelete}
              style={{ minHeight: 50, borderRadius: 14, backgroundColor: `${theme.red}18`, borderWidth: 1, borderColor: theme.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
            >
              <Trash2 size={18} color={theme.red} />
              <Text style={{ color: theme.red, fontSize: 16, fontWeight: "900" }}>{t("compression.deleteAllOriginalsButton")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("compression.keepAllOriginalsButton")}
              onPress={onKeep}
              style={{ minHeight: 50, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("compression.keepAllOriginalsButton")}</Text>
            </Pressable>
          </View>
          <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 16, textAlign: "center" }}>
            {t("compression.deleteWarning")}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onCancel} style={{ alignSelf: "center", paddingVertical: 8, paddingHorizontal: 18 }}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: "800" }}>{t("common.cancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
