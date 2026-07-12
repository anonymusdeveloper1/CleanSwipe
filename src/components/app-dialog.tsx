import { Modal, Pressable, Text, View } from "react-native";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";

export type AppDialogTone = "success" | "error" | "info";

/** Add an alpha channel to a `#rgb`/`#rrggbb` color for soft tints. */
function withAlpha(hex: string, alpha: number) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  let h = match[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: AppDialogTone;
  /** Dismiss / single-action button. */
  onClose: () => void;
  dismissLabel?: string;
  /** Pass confirmLabel + onConfirm to render a 2-button confirm dialog. */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDanger?: boolean;
};

/**
 * In-app themed dialog that replaces the native `Alert.alert` popups so the
 * subscription/purchase flow (and any other flow) matches SwipeClean's design
 * instead of the platform's default OS alert. Single-action by default; pass
 * `confirmLabel` + `onConfirm` for a Cancel/Confirm two-button variant.
 */
export function AppDialog({
  visible,
  title,
  message,
  tone = "info",
  onClose,
  dismissLabel,
  confirmLabel,
  onConfirm,
  confirmDanger
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const toneColor = tone === "success" ? theme.green : tone === "error" ? theme.red : theme.accent;
  const ToneIcon = tone === "success" ? CheckCircle2 : tone === "error" ? XCircle : Info;
  const hasConfirm = Boolean(confirmLabel && onConfirm);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 26 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, gap: 18 }}>
          <View style={{ alignItems: "center", gap: 13 }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: withAlpha(toneColor, 0.14),
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <ToneIcon size={30} color={toneColor} strokeWidth={2.4} />
            </View>
            <View style={{ gap: 6 }}>
              <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
                {title}
              </Text>
              {message ? (
                <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
                  {message}
                </Text>
              ) : null}
            </View>
          </View>

          {hasConfirm ? (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={dismissLabel ?? t("common.cancel")}
                onPress={onClose}
                style={{ flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceStrong }}
              >
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>{dismissLabel ?? t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                onPress={onConfirm}
                style={{ flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: confirmDanger ? theme.red : theme.accent }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{confirmLabel}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dismissLabel ?? t("common.done")}
              onPress={onClose}
              style={{ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{dismissLabel ?? t("common.done")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
