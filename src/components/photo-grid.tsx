import { RotateCcw } from "lucide-react-native";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { MarkedForDeletionItem } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  items: MarkedForDeletionItem[];
  onRestore: (photoId: string) => void;
  onOpen?: (photoId: string) => void;
};

export function PhotoGrid({ items, onRestore, onOpen }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tileGap = 12;
  // ScrollView padding is 16 on each side (total 32)
  const tileSize = Math.floor((width - 32 - tileGap * 2) / 3);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.photoId}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: tileGap }}
      contentContainerStyle={{ gap: tileGap }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen?.(item.photoId)}
          style={{
            width: tileSize,
            height: tileSize,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: theme.surfaceStrong,
            borderWidth: 1,
            borderColor: theme.border
          }}
        >
          <MediaThumbnail uri={item.uri} id={item.photoId} mediaType={item.mediaType} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
          <Pressable
            accessibilityLabel={t("reviewDelete.restorePhoto")}
            onPress={() => onRestore(item.photoId)}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: theme.surface,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(0,0,0,0.16)"
            }}
          >
            <RotateCcw size={15} color={theme.accent} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}
