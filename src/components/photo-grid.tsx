import { RotateCcw } from "lucide-react-native";
import { FlatList, Pressable, View } from "react-native";
import { CachedImage } from "@/components/cached-image";
import { MarkedForDeletionItem } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  items: MarkedForDeletionItem[];
  onRestore: (photoId: string) => void;
  onOpen?: (photoId: string) => void;
};

export function PhotoGrid({ items, onRestore, onOpen }: Props) {
  const theme = useAppTheme();
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.photoId}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ gap: 12 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen?.(item.photoId)}
          style={{
            flex: 1,
            aspectRatio: 1,
            borderRadius: 15,
            overflow: "hidden",
            backgroundColor: theme.surfaceStrong,
            borderWidth: 1,
            borderColor: theme.border
          }}
        >
          <CachedImage uri={item.uri} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
          <Pressable
            accessibilityLabel="Restore photo"
            onPress={() => onRestore(item.photoId)}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.surface,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(0,0,0,0.16)"
            }}
          >
            <RotateCcw size={21} color={theme.accent} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}
