import { router } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MediaTypeFilter } from "@/models/photo";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { formatBytes } from "@/utils/format";
import { filterPhotosByMediaType, filterPhotosByMonth, getMarkedItemMonthKey, getMediaTypeAllLabel, getMediaTypeNoun, groupPhotosByMonth } from "@/utils/months";

const mediaTypeOptions: { key: MediaTypeFilter; labelKey: string }[] = [
  { key: "all", labelKey: "months.all" },
  { key: "photo", labelKey: "months.photos" },
  { key: "video", labelKey: "months.videos" }
];

export function MonthSelectorBottomSheet() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const photos = useIndexedMediaAssets();
  const selected = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const reviewedPhotoIds = useAppStore((state) => state.reviewedPhotoIds);
  const markedItems = useAppStore((state) => state.markedForDeletion);
  const setSelectedMonth = useAppStore((state) => state.setSelectedMonth);
  const setSelectedMediaType = useAppStore((state) => state.setSelectedMediaType);
  const scopedPhotos = useMemo(() => filterPhotosByMediaType(photos, selectedMediaType), [photos, selectedMediaType]);
  const months = useMemo(() => groupPhotosByMonth(scopedPhotos, getMediaTypeAllLabel(selectedMediaType)), [scopedPhotos, selectedMediaType]);
  const reviewedIds = useMemo(() => new Set(reviewedPhotoIds), [reviewedPhotoIds]);
  const markedIds = useMemo(() => new Set(markedItems.map((item) => item.photoId)), [markedItems]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surface,
        paddingTop: 10,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: "hidden"
      }}
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
        <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>
          {t("months.title")}
        </Text>
        <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
          <X size={24} color={theme.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View
          accessibilityRole="tablist"
          style={{
            minHeight: 44,
            borderRadius: 22,
            padding: 4,
            backgroundColor: theme.surfaceStrong,
            flexDirection: "row",
            gap: 4
          }}
        >
          {mediaTypeOptions.map((option) => {
            const active = selectedMediaType === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedMediaType(option.key)}
                style={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? theme.surface : "transparent"
                }}
              >
                <Text style={{ color: active ? theme.accent : theme.muted, fontSize: 15, fontWeight: "900" }}>{t(option.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 6 }}>
        {months.map((month) => {
          const isSelected = month.key === selected;
          const monthPhotos = filterPhotosByMonth(scopedPhotos, month.key);
          const monthMarkedIds = month.key === "all" ? markedIds : new Set(markedItems.filter((item) => getMarkedItemMonthKey(item) === month.key).map((item) => item.photoId));
          const clearedCount = monthPhotos.filter((photo) => reviewedIds.has(photo.id) || monthMarkedIds.has(photo.id)).length;
          const progress = month.count > 0 ? clearedCount / month.count : 0;
          return (
            <Pressable
              key={month.key}
              onPress={() => {
                setSelectedMonth(month.key);
                router.back();
              }}
              style={{
                minHeight: 58,
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}>
                <MonthProgress progress={progress} label={`${clearedCount}/${month.count}`} />
                <View style={{ gap: 3, flexShrink: 1, minWidth: 0 }}>
                  <Text selectable numberOfLines={1} style={{ color: isSelected ? theme.accent : theme.text, fontSize: 18, fontWeight: "900" }}>
                    {month.label}
                  </Text>
                  <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
                    {month.count.toLocaleString()} {getMediaTypeNoun(selectedMediaType, month.count)} - {formatBytes(month.sizeBytes)}
                  </Text>
                </View>
              </View>
              {isSelected ? <Check size={22} color={theme.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MonthProgress({ progress, label }: { progress: number; label: string }) {
  const theme = useAppTheme();
  const size = 42;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.surfaceStrong} strokeWidth={stroke} fill="transparent" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.accent}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clampedProgress)}
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <Text selectable={false} adjustsFontSizeToFit numberOfLines={1} style={{ color: theme.text, fontSize: 9, fontWeight: "900", maxWidth: 30 }}>
        {label}
      </Text>
    </View>
  );
}
