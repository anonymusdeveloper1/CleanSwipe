import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MediaTypeFilter, MonthGroup } from "@/models/photo";
import { formatBytes } from "@/utils/format";
import { getMediaTypeNoun } from "@/utils/months";

type Props = {
  visible: boolean;
  mediaType: MediaTypeFilter;
  monthKey: string;
  months: MonthGroup[];
  onSelectMediaType: (mediaType: MediaTypeFilter) => void;
  onSelectMonth: (monthKey: string) => void;
  onClose: () => void;
};

/**
 * Compress-screen filter dialog. A controlled bottom-sheet `Modal` (matching the
 * app's `DeleteConfirmationDialog` convention): a media-type segmented control
 * (Both / Photos / Videos) plus a month list ("All months" + each month). Mirrors
 * the look of `MonthSelectorBottomSheet` but owns no store/router state.
 */
export function CompressionFilterDialog({ visible, mediaType, monthKey, months, onSelectMediaType, onSelectMonth, onClose }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const mediaTypeOptions: { key: MediaTypeFilter; label: string }[] = [
    { key: "all", label: t("cleanup.bothMedia") },
    { key: "photo", label: t("months.photos") },
    { key: "video", label: t("months.videos") }
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop tap closes; the inner Pressable swallows taps on the sheet. */}
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" }}>
        <Pressable
          onPress={() => undefined}
          style={{ backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, maxHeight: "80%" }}
        >
          <View style={{ alignSelf: "center", width: 46, height: 5, borderRadius: 3, backgroundColor: theme.faint }} />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomColor: theme.border,
              borderBottomWidth: 1
            }}
          >
            <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
              {t("cleanup.filter")}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onClose} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
              <X size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
            <View accessibilityRole="tablist" style={{ minHeight: 44, borderRadius: 22, padding: 4, backgroundColor: theme.surfaceStrong, flexDirection: "row", gap: 4 }}>
              {mediaTypeOptions.map((option) => {
                const active = mediaType === option.key;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => onSelectMediaType(option.key)}
                    style={{ flex: 1, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: active ? theme.surface : "transparent" }}
                  >
                    <Text style={{ color: active ? theme.accent : theme.muted, fontSize: 15, fontWeight: "900" }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 6 }}>
            {months.map((month) => {
              const isSelected = month.key === monthKey;
              return (
                <Pressable
                  key={month.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelectMonth(month.key);
                    onClose();
                  }}
                  style={{
                    minHeight: 56,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.accent : theme.border,
                    backgroundColor: isSelected ? theme.surfaceSoft : theme.surface,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text selectable numberOfLines={1} style={{ color: isSelected ? theme.accent : theme.text, fontSize: 17, fontWeight: "900" }}>
                      {month.label}
                    </Text>
                    <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
                      {month.count.toLocaleString()} {getMediaTypeNoun(mediaType, month.count)} · {formatBytes(month.sizeBytes)}
                    </Text>
                  </View>
                  {isSelected ? <Check size={22} color={theme.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
