import { router } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompressFilterStore } from "@/features/compression/compress-filter.store";
import { useCompressiblePool } from "@/features/compression/use-compressible-pool";
import i18n from "@/i18n";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MediaTypeFilter } from "@/models/photo";
import { formatBytes } from "@/utils/format";
import { filterPhotosByMediaType, getMediaTypeNoun, groupPhotosByMonth } from "@/utils/months";

/**
 * Compress-screen filter as a native form-sheet (mirrors `MonthSelectorBottomSheet`):
 * a Both/Photos/Videos segmented control + a month list scoped to the selected
 * type. Presented as a `formSheet` route so it's draggable-to-dismiss and the
 * month list nest-scrolls (scroll the list up; the sheet closes only at the top).
 */
export function CompressFilterSheet() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const monthKey = useCompressFilterStore((state) => state.monthKey);
  const mediaType = useCompressFilterStore((state) => state.mediaType);
  const setMediaType = useCompressFilterStore((state) => state.setMediaType);
  const setMonthKey = useCompressFilterStore((state) => state.setMonthKey);
  const { pool: compressiblePool } = useCompressiblePool();
  const months = useMemo(
    () => groupPhotosByMonth(filterPhotosByMediaType(compressiblePool, mediaType), t("cleanup.allMonths")),
    // i18n.language keeps the localized month titles + "All months" fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compressiblePool, mediaType, i18n.language]
  );

  const mediaTypeOptions: { key: MediaTypeFilter; label: string }[] = [
    { key: "all", label: t("cleanup.bothMedia") },
    { key: "photo", label: t("months.photos") },
    { key: "video", label: t("months.videos") }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" }}>
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
        <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>
          {t("cleanup.filter")}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={() => router.back()} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
          <X size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View accessibilityRole="tablist" style={{ minHeight: 44, borderRadius: 22, padding: 4, backgroundColor: theme.surfaceStrong, flexDirection: "row", gap: 4 }}>
          {mediaTypeOptions.map((option) => {
            const active = mediaType === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setMediaType(option.key)}
                style={{ flex: 1, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: active ? theme.surface : "transparent" }}
              >
                <Text style={{ color: active ? theme.accent : theme.muted, fontSize: 15, fontWeight: "900" }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* nestedScrollEnabled is REQUIRED on Android (defaults to false): without it
          the form sheet's BottomSheetBehavior wouldn't treat this list as its
          scrolling child and every downward drag would dismiss the sheet instead
          of scrolling the list. */}
      <ScrollView
        nestedScrollEnabled
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 6 }}
      >
        {months.map((month) => {
          const isSelected = month.key === monthKey;
          return (
            <Pressable
              key={month.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                setMonthKey(month.key);
                router.back();
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
    </View>
  );
}
