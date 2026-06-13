import { router } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PhotoAsset } from "@/models/photo";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { formatDate } from "@/utils/date";
import { formatBytes, formatResolution } from "@/utils/format";

export function LargestPhotosScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const photos = useIndexedMediaAssets();
  const mark = useAppStore((state) => state.markPhotoForDeletion);
  const largest = [...photos].filter((photo) => photo.sizeBytes).sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)).slice(0, 25);
  const gap = 14;
  const cardWidth = Math.floor((width - 44 - gap) / 2);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 16 }}>
      <View style={{ paddingHorizontal: 22, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft size={30} color={theme.text} />
        </Pressable>
        <Text selectable style={{ color: theme.accent, fontSize: 18, fontWeight: "900" }}>
          {t("largest.title")}
        </Text>
        <View style={{ width: 46 }} />
      </View>
      <FlatList
        data={largest}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentInsetAdjustmentBehavior="automatic"
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 6, gap, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => (
          <LargestPhotoCard
            photo={item}
            width={cardWidth}
            onDelete={() => mark(item)}
            onOpen={() => router.push({ pathname: "/photo-preview", params: { id: item.id } })}
          />
        )}
      />
    </View>
  );
}

type LargestPhotoCardProps = {
  photo: PhotoAsset;
  width: number;
  onDelete: () => void;
  onOpen: () => void;
};

function LargestPhotoCard({ photo, width, onDelete, onOpen }: LargestPhotoCardProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <Pressable
      onPress={onOpen}
      style={{
        width,
        overflow: "hidden",
        borderRadius: 14,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <View style={{ width: "100%", aspectRatio: 1, backgroundColor: theme.surfaceStrong }}>
        <MediaThumbnail uri={photo.uri} id={photo.id} mediaType={photo.mediaType} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("largest.deleteButtonLabel")}
          onPress={onDelete}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#fff1f1",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.16)"
          }}
        >
          <Trash2 size={19} color={theme.red} />
        </Pressable>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
          {formatBytes(photo.sizeBytes)}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
          {formatDate(photo.creationTime)}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
          {formatResolution(photo.width, photo.height)}
        </Text>
      </View>
    </Pressable>
  );
}
