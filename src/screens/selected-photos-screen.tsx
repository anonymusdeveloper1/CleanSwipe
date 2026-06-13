import { router } from "expo-router";
import { ArrowLeft, BrushCleaning, Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { EmptyState } from "@/components/empty-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { formatBytes, sumBytes } from "@/utils/format";
import { filterPhotosByMediaType, filterPhotosByScope, getMediaTypeAllLabel, getMediaTypeNoun, groupPhotosByMonth } from "@/utils/months";

export function SelectedPhotosScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const photos = useIndexedMediaAssets();
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const mark = useAppStore((state) => state.markPhotoForDeletion);
  const marked = useAppStore((state) => state.markedForDeletion);
  const markedIds = useMemo(() => new Set(marked.map((item) => item.photoId)), [marked]);
  const tileGap = 10;
  const tileSize = Math.floor((width - 44 - tileGap * 2) / 3);
  const selectedPhotos = useMemo(
    () => filterPhotosByScope(photos, selectedMonthKey, selectedMediaType),
    [photos, selectedMediaType, selectedMonthKey]
  );
  const selectedLabel = useMemo(
    () => groupPhotosByMonth(filterPhotosByMediaType(photos, selectedMediaType), getMediaTypeAllLabel(selectedMediaType)).find((month) => month.key === selectedMonthKey)?.label ?? getMediaTypeAllLabel(selectedMediaType),
    [photos, selectedMediaType, selectedMonthKey]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 16 }}>
      <View
        style={{
          paddingHorizontal: 22,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft size={30} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text selectable numberOfLines={1} style={{ color: theme.accent, fontSize: 19, fontWeight: "900" }}>
            {selectedLabel}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
            {selectedPhotos.length.toLocaleString()} {getMediaTypeNoun(selectedMediaType, selectedPhotos.length)} - {formatBytes(sumBytes(selectedPhotos))}
          </Text>
        </View>
        <View style={{ width: 46 }} />
      </View>
      {selectedPhotos.length === 0 ? (
        <EmptyState icon={BrushCleaning} title={t("swipe.noMediaTitle", { noun: getMediaTypeNoun(selectedMediaType) })} message={t("swipe.noMediaMessage", { noun: getMediaTypeNoun(selectedMediaType) })} />
      ) : (
        <FlatList
          data={selectedPhotos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentInsetAdjustmentBehavior="automatic"
          columnWrapperStyle={{ gap: tileGap }}
          contentContainerStyle={{ padding: 22, gap: tileGap, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isMarked = markedIds.has(item.id);
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/photo-preview", params: { id: item.id } })}
                style={{
                  width: tileSize,
                  height: tileSize,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: theme.surfaceStrong,
                  borderWidth: 1,
                  borderColor: isMarked ? theme.red : theme.border
                }}
              >
                <MediaThumbnail uri={item.uri} id={item.id} mediaType={item.mediaType} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
                {isMarked ? <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(220,38,38,0.16)" }} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isMarked ? t("selected.alreadyMarkedForDeletion") : t("selected.markPhotoForDeletion")}
                  onPress={() => mark(item)}
                  disabled={isMarked}
                  style={{
                    position: "absolute",
                    top: 7,
                    right: 7,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isMarked ? theme.red : theme.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.16)"
                  }}
                >
                  <Trash2 size={17} color={isMarked ? "#fff" : theme.red} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
