import { ArrowRight, Ban, Image as ImageIcon, Music, Video } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getSelectableTargets, sourceFormatLabel, targetLabel, targetOutputKind } from "@/features/convert/convert-targets";
import { ConvertCapabilities, ConvertOutputKind, ConvertTarget } from "@/features/convert/convert.types";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PhotoAsset } from "@/models/photo";

type Props = {
  asset?: PhotoAsset;
  caps: ConvertCapabilities;
  selected?: ConvertTarget;
  onSelect: (target: ConvertTarget) => void;
  onClose: () => void;
};

const GROUP_ORDER: ConvertOutputKind[] = ["image", "video", "audio"];

/**
 * Bottom-sheet format picker. Opened by tapping a staged item's "from → to" pill.
 * Detects the source format, lists every target the build can produce GROUPED by
 * output kind (Image / Video / Audio), and notes that the source's own format is
 * intentionally hidden. Tapping a format selects it and closes the sheet.
 */
export function ConvertFormatSheet({ asset, caps, selected, onSelect, onClose }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const visible = asset != null;

  const targets = asset ? getSelectableTargets(asset, caps) : [];
  const groups = GROUP_ORDER.map((kind) => ({ kind, items: targets.filter((target) => targetOutputKind(target) === kind) })).filter(
    (group) => group.items.length > 0
  );
  const sourceLabel = asset ? sourceFormatLabel(asset) : "";

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(5,6,10,0.62)", justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="none"
          onPress={() => undefined}
          style={{ backgroundColor: theme.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30, borderTopWidth: 1, borderColor: theme.border, gap: 16 }}
        >
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center" }} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>
              {t("convert.formatSheetTitle", { format: sourceLabel })}
            </Text>
            {asset?.filename ? (
              <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12.5, fontWeight: "700", maxWidth: 260 }}>{asset.filename}</Text>
            ) : null}
          </View>

          {groups.length === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center", paddingVertical: 14 }}>{t("convert.noTargets")}</Text>
          ) : (
            groups.map((group) => (
              <View key={group.kind} style={{ gap: 8 }}>
                <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" }}>
                  {t(`convert.group.${group.kind}`)}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {group.items.map((target) => {
                    const active = selected === target;
                    return (
                      <Pressable
                        key={target}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => onSelect(target)}
                        style={{
                          width: "47%",
                          flexGrow: 1,
                          borderRadius: 15,
                          borderWidth: 1.5,
                          borderColor: active ? theme.accent : theme.border,
                          backgroundColor: active ? `${theme.accent}14` : theme.surfaceSoft,
                          padding: 14,
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <FormatIcon kind={group.kind} color={active ? theme.accent : theme.muted} />
                        <Text style={{ color: active ? theme.accent : theme.text, fontSize: 15, fontWeight: "900" }}>{targetLabel(target)}</Text>
                        <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "700" }}>{t(`convert.note.${target}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, justifyContent: "center" }}>
            <Ban size={13} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: "700" }}>{t("convert.sameSourceHidden", { format: sourceLabel })}</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FormatIcon({ kind, color }: { kind: ConvertOutputKind; color: string }) {
  if (kind === "video") return <Video size={22} color={color} />;
  if (kind === "audio") return <Music size={22} color={color} />;
  return <ImageIcon size={22} color={color} />;
}

/** A compact "JPG → PNG ⌄" pill that opens the format sheet for a staged item. */
export function FormatPill({ sourceLabel, target, onPress }: { sourceLabel: string; target?: ConvertTarget; onPress: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("convert.changeFormat")}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: theme.accent, backgroundColor: `${theme.accent}14`, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}
    >
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "800" }}>{sourceLabel}</Text>
      <ArrowRight size={12} color={theme.accent} />
      <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "900" }}>{target ? targetLabel(target) : t("convert.pick")}</Text>
    </Pressable>
  );
}
